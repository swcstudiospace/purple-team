import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import express from 'express';
import {
  REMOTE_RATE_BURST,
  REMOTE_RATE_PER_MINUTE,
  bearerMatches,
  createRemoteGuard,
  createTokenBucket,
  resolveBearerToken,
} from '../net/remote-access.js';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

function listen(app: express.Express): Promise<{ server: Server; port: number }> {
  const server = createServer(app);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('no port'));
        return;
      }
      resolve({ server, port: addr.port });
    });
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

describe('bearer token load', () => {
  it('prefers the env var and never needs the file', () => {
    const loaded = resolveBearerToken(
      { T3MP3ST_BEARER_TOKEN: ' from-env ', T3MP3ST_BEARER_TOKEN_FILE: '/nope' },
      () => {
        throw new Error('file should not be read');
      },
    );
    expect(loaded).toEqual({ ok: true, token: 'from-env' });
  });

  it('reads a trimmed token from the file and reports an unreadable path', () => {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-bearer-'));
    const file = join(dir, 'token');
    writeFileSync(file, 'file-token\n');
    expect(resolveBearerToken({ T3MP3ST_BEARER_TOKEN_FILE: file }, (p) => readFileSync(p, 'utf8'))).toEqual({
      ok: true,
      token: 'file-token',
    });
    expect(resolveBearerToken({ T3MP3ST_BEARER_TOKEN_FILE: join(dir, 'missing') }, (p) => readFileSync(p, 'utf8'))).toEqual({
      ok: false,
      reason: 'unreadable',
      file: join(dir, 'missing'),
    });
    expect(resolveBearerToken({}, () => '')).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects a wrong or missing bearer without distinguishing them', () => {
    expect(bearerMatches(undefined, 'secret')).toBe(false);
    expect(bearerMatches('Bearer wrong', 'secret')).toBe(false);
    expect(bearerMatches('Bearer secret', 'secret')).toBe(true);
    expect(bearerMatches('secret', 'secret')).toBe(false);
  });
});

describe('remote /api guard', () => {
  it('returns 401 without a token, 200 with the token, and leaves /ui open', async () => {
    const now = { t: 0 };
    const app = express();
    app.use(createRemoteGuard({
      token: 'secret',
      bucket: createTokenBucket({ perMinute: 60, burst: 10 }),
      now: () => now.t,
    }));
    app.get('/api/mission/status', (_req, res) => res.json({ ok: true }));
    app.get('/ui/', (_req, res) => res.type('text').send('ui'));
    const { server, port } = await listen(app);
    try {
      const missing = await fetch(`http://127.0.0.1:${port}/api/mission/status`);
      expect(missing.status).toBe(401);
      const wrong = await fetch(`http://127.0.0.1:${port}/api/mission/status`, {
        headers: { Authorization: 'Bearer nope' },
      });
      expect(wrong.status).toBe(401);
      const ok = await fetch(`http://127.0.0.1:${port}/api/mission/status`, {
        headers: { Authorization: 'Bearer secret' },
      });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ ok: true });
      const ui = await fetch(`http://127.0.0.1:${port}/ui/`);
      expect(ui.status).toBe(200);
      expect(await ui.text()).toBe('ui');
    } finally {
      await close(server);
    }
  });

  it('rate-limits a burst deterministically and refills one token per second at 60/min', async () => {
    const now = { t: 1_000 };
    const bucket = createTokenBucket({ perMinute: REMOTE_RATE_PER_MINUTE, burst: 2 });
    const app = express();
    app.use(createRemoteGuard({ token: 'secret', bucket, now: () => now.t }));
    app.get('/api/mission/status', (_req, res) => res.json({ ok: true }));
    const { server, port } = await listen(app);
    const headers = { Authorization: 'Bearer secret' };
    try {
      expect((await fetch(`http://127.0.0.1:${port}/api/mission/status`, { headers })).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${port}/api/mission/status`, { headers })).status).toBe(200);
      const limited = await fetch(`http://127.0.0.1:${port}/api/mission/status`, { headers });
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBe('1');
      now.t += 999;
      expect((await fetch(`http://127.0.0.1:${port}/api/mission/status`, { headers })).status).toBe(429);
      now.t += 1;
      expect((await fetch(`http://127.0.0.1:${port}/api/mission/status`, { headers })).status).toBe(200);
    } finally {
      await close(server);
    }
  });

  it('does not rate-limit when the guard is absent (loopback shape)', async () => {
    const app = express();
    app.get('/api/mission/status', (_req, res) => res.json({ ok: true }));
    const { server, port } = await listen(app);
    try {
      for (let i = 0; i < 5; i += 1) {
        const res = await fetch(`http://127.0.0.1:${port}/api/mission/status`);
        expect(res.status).toBe(200);
      }
    } finally {
      await close(server);
    }
  });
});

describe('server wires the guard only off loopback', () => {
  it('mounts createRemoteGuard behind !HOST_IS_LOOPBACK and fail-closes without a token', () => {
    expect(REMOTE_RATE_PER_MINUTE).toBe(60);
    expect(REMOTE_RATE_BURST).toBe(120);
    const mount = serverSource.indexOf('if (!HOST_IS_LOOPBACK && bearerLoad.ok)');
    const guard = serverSource.indexOf('createRemoteGuard(', mount);
    expect(mount).toBeGreaterThan(0);
    expect(guard).toBeGreaterThan(mount);
    expect(serverSource).toContain('Refusing to bind non-loopback');
    expect(serverSource).toContain('T3MP3ST_BEARER_TOKEN');
    expect(serverSource).not.toMatch(/T3MP3ST_BEARER_TOKEN\s*=\s*['"][A-Za-z0-9]/);
  });
});
