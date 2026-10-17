import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  __resetOAuthState,
  __setOAuthNow,
  clearOAuth,
  ensureOAuthAccessToken,
  hasOAuth,
  oauthStatus,
  oauthStorePath,
  parseOpenAiAuthCode,
  peekOAuthAccessToken,
  pollXaiDeviceFlow,
  startXaiDeviceFlow,
} from '../llm/oauth.js';
import { config } from '../config/index.js';

function fakeFetch(handler: (url: string, init?: { body?: string; headers?: Record<string, string> }) => { ok: boolean; status: number; body: unknown }) {
  return vi.fn(async (url: string, init?: { body?: string; headers?: Record<string, string> }) => ({
    ok: handler(url, init).ok,
    status: handler(url, init).status,
    json: async () => handler(url, init).body,
    text: async () => JSON.stringify(handler(url, init).body),
  }));
}

describe('subscription OAuth', () => {
  const dirs: string[] = [];

  afterEach(() => {
    __resetOAuthState();
    __setOAuthNow(undefined);
    delete process.env.T3MP3ST_OAUTH_STORE;
    delete process.env.T3MP3ST_XAI_OAUTH_CLIENT_ID;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function tempStore(): string {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-oauth-'));
    dirs.push(dir);
    const path = join(dir, 'oauth.json');
    process.env.T3MP3ST_OAUTH_STORE = path;
    return path;
  }

  it('starts an xAI device flow against auth.x.ai with the public Grok CLI client', async () => {
    tempStore();
    const f = fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        device_code: 'dev-1',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://auth.x.ai/device',
        verification_uri_complete: 'https://auth.x.ai/device?user_code=ABCD-EFGH',
        expires_in: 600,
        interval: 5,
      },
    }));

    const start = await startXaiDeviceFlow({ fetchImpl: f });
    expect(start.userCode).toBe('ABCD-EFGH');
    expect(start.verificationUri).toBe('https://auth.x.ai/device');
    expect(start.verificationUriComplete).toContain('ABCD-EFGH');
    expect(start.flowId).toBeTruthy();

    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://auth.x.ai/oauth2/device/code');
    expect(String(init?.body)).toContain('client_id=b1a00492-073a-47ea-816f-4c329264a828');
    expect(String(init?.body)).toContain('grok-cli%3Aaccess');
    expect(String(init?.body)).toContain('api%3Aaccess');
  });

  it('rejects a non-https or off-allowlist verification_uri', async () => {
    tempStore();
    const f = fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        device_code: 'dev-1',
        user_code: 'ABCD',
        verification_uri: 'http://evil.example/phish',
        expires_in: 600,
        interval: 5,
      },
    }));
    await expect(startXaiDeviceFlow({ fetchImpl: f })).rejects.toThrow(/https|allowed/i);
  });

  it('polls pending then stores tokens on authorization (file mode 0600, status has no secrets)', async () => {
    const path = tempStore();
    const startFetch = fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        device_code: 'dev-1',
        user_code: 'CODE',
        verification_uri: 'https://auth.x.ai/device',
        expires_in: 600,
        interval: 5,
      },
    }));
    const start = await startXaiDeviceFlow({ fetchImpl: startFetch });

    const pending = fakeFetch(() => ({
      ok: false,
      status: 400,
      body: { error: 'authorization_pending' },
    }));
    expect(await pollXaiDeviceFlow(start.flowId, { fetchImpl: pending })).toEqual({
      status: 'pending',
      interval: 5,
    });

    const done = fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        access_token: 'xai-access-secret',
        refresh_token: 'xai-refresh-secret',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    }));
    expect(await pollXaiDeviceFlow(start.flowId, { fetchImpl: done })).toEqual({ status: 'authorized' });

    expect(hasOAuth('xai')).toBe(true);
    expect(peekOAuthAccessToken('xai')).toBe('xai-access-secret');
    const st = oauthStatus();
    expect(st.xai.connected).toBe(true);
    expect(st.xai.label).toMatch(/Super Grok Heavy/);
    expect(JSON.stringify(st)).not.toContain('xai-access-secret');
    expect(JSON.stringify(st)).not.toContain('xai-refresh-secret');

    expect(oauthStorePath()).toBe(path);
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
    expect(readFileSync(path, 'utf8')).toContain('xai-access-secret');

    clearOAuth('xai');
    expect(hasOAuth('xai')).toBe(false);
  });

  it('bumps the poll interval on slow_down and expires unknown flows', async () => {
    tempStore();
    const startFetch = fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        device_code: 'dev-1',
        user_code: 'CODE',
        verification_uri: 'https://auth.x.ai/device',
        expires_in: 600,
        interval: 5,
      },
    }));
    const start = await startXaiDeviceFlow({ fetchImpl: startFetch });
    const slow = fakeFetch(() => ({ ok: false, status: 400, body: { error: 'slow_down' } }));
    const r = await pollXaiDeviceFlow(start.flowId, { fetchImpl: slow });
    expect(r.status).toBe('slow_down');
    if (r.status === 'slow_down') expect(r.interval).toBeGreaterThan(5);

    expect(await pollXaiDeviceFlow('no-such-flow', { fetchImpl: slow })).toMatchObject({ status: 'expired' });
  });

  it('refreshes an expiring SuperGrok token and rotates the refresh token', async () => {
    tempStore();
    const startFetch = fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        device_code: 'dev-1',
        user_code: 'CODE',
        verification_uri: 'https://auth.x.ai/device',
        expires_in: 600,
        interval: 5,
      },
    }));
    const start = await startXaiDeviceFlow({ fetchImpl: startFetch });
    const t0 = 1_000_000;
    __setOAuthNow(() => t0);
    await pollXaiDeviceFlow(start.flowId, {
      fetchImpl: fakeFetch(() => ({
        ok: true,
        status: 200,
        body: { access_token: 'old-access', refresh_token: 'old-refresh', expires_in: 60 },
      })),
    });

    __setOAuthNow(() => t0 + 50_000);
    const refreshed = await ensureOAuthAccessToken('xai', {
      fetchImpl: fakeFetch((url, init) => {
        expect(url).toBe('https://auth.x.ai/oauth2/token');
        expect(String(init?.body)).toContain('grant_type=refresh_token');
        expect(String(init?.body)).toContain('old-refresh');
        return {
          ok: true,
          status: 200,
          body: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 },
        };
      }),
    });
    expect(refreshed).toBe('new-access');
    expect(peekOAuthAccessToken('xai')).toBe('new-access');
  });

  it('parses a full ChatGPT callback URL into code + state', () => {
    const p = parseOpenAiAuthCode('http://localhost:1455/auth/callback?code=abc&state=xyz');
    expect(p).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('hydrates getLLMConfig with SuperGrok OAuth as authType oauth (no API key)', async () => {
    tempStore();
    const startFetch = fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        device_code: 'dev-1',
        user_code: 'CODE',
        verification_uri: 'https://auth.x.ai/device',
        expires_in: 600,
        interval: 5,
      },
    }));
    const start = await startXaiDeviceFlow({ fetchImpl: startFetch });
    await pollXaiDeviceFlow(start.flowId, {
      fetchImpl: fakeFetch(() => ({
        ok: true,
        status: 200,
        body: { access_token: 'supergrok-access', refresh_token: 'r', expires_in: 3600 },
      })),
    });
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      const cfg = config.getLLMConfig('xai', 'grok-4-heavy');
      expect(cfg.authType).toBe('oauth');
      expect(cfg.apiKey).toBe('supergrok-access');
      expect(cfg.model).toBe('grok-4-heavy');
      expect(cfg.baseUrl).toBe('https://api.x.ai/v1');
      expect(config.getConfiguredProviders()).toContain('xai');
    } finally {
      if (prev === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = prev;
    }
  });
});
