import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runtime exercise for the ROE routes (src/server.ts PUT/GET
// /api/teams/white/roe) plus the roeRecords slot wiring (declare, snapshot,
// restore). The server module owns its express app privately (no export), so
// the test boots the REAL server in-process via dynamic import with
// loopback + ephemeral-port env set first, then drives it over loopback
// fetch — the same listen(app)+fetch shape as remote-access-guard.test.ts,
// except the listen happens inside the server's own startServer().
// A second boot (after vi.resetModules, so the module state is fresh) loads
// a tampered persisted record to prove the GET integrity ladder fails
// closed. No LLM keys needed: initLLM degrades to null without them.
//
// Static import cannot work here: T3MP3ST_PORT/T3MP3ST_STATE_DIR must be set
// before the module first evaluates (PORT/HOST are import-time consts), and
// the tampered-record boot needs a fresh module registry, so both imports
// are dynamic and the second follows vi.resetModules().

const HAPPY_TEXT = 'scope: app.example.com\nallow active: no';
const HAPPY_ACTIONS = [{ command: 'curl -s https://app.example.com/login', target: 'app.example.com' }];
const SECOND_TEXT = 'scope: api.example.com\nallow active: yes';
const SECOND_ACTIONS = [{ command: 'curl -s https://api.example.com/status', target: 'api.example.com' }];
const CONTRADICTORY_TEXT = 'scope: app.example.com\nallow active: permitted\nactive testing: forbidden';

const TAMPERED_STATE = {
  schema_version: 't3mp3st_state/v1',
  roeRecords: [
    {
      id: 'latest',
      revision: 1,
      textHash: 'tamperedtampered',
      actionsHash: 'tamperedtampered',
      text: HAPPY_TEXT,
      actions: HAPPY_ACTIONS,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
};

interface RoeStoredSnapshot {
  roeRecords: Array<{
    id: string;
    revision: number;
    textHash: string;
    text: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

function sha16(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

async function freePort(): Promise<number> {
  const probe = createServer();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => resolve());
  await promise;
  const addr = probe.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  const { promise: closed, resolve: onClosed } = Promise.withResolvers<void>();
  probe.close(() => onClosed());
  await closed;
  return port;
}

async function waitReady(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/teams/white/roe`);
      await res.text();
      if (res.status === 200) {
        return;
      }
      lastError = new Error(`unexpected status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 150);
    await promise;
  }
  throw new Error(`ROE server at ${base} never became ready: ${String(lastError)}`);
}

// Genuine delay (not a faked timer): the persist debounce lives inside the
// booted server module (PERSIST_DEBOUNCE_MS, no flush hook exported), and
// fake timers in this worker would also freeze the boot I/O and readiness
// polling. A real wait is the only way to let the snapshot land on disk.
async function flushTo(dir: string, expectRevision: number): Promise<void> {
  // Await the real signal: flushPersist clears the server's pending debounced
  // snapshot and writes it through, so no wall-clock wait is needed (fake
  // timers would freeze the server's boot I/O in this in-process worker).
  const flush = serverAModule.flushPersist;
  if (!flush) throw new Error('server module did not expose flushPersist');
  await flush();
  const snapshot = readRoeSnapshot(dir);
  const record = (snapshot.roeRecords as Array<{ revision: number }>)[0];
  expect(record?.revision).toBe(expectRevision);
}

async function putRoe(base: string, payload: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}/api/teams/white/roe`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json: unknown = await res.json();
  return { status: res.status, json };
}

async function getRoe(base: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}/api/teams/white/roe`);
  const json: unknown = await res.json();
  return { status: res.status, json };
}

function readRoeSnapshot(dir: string): RoeStoredSnapshot {
  const parsed: unknown = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !('roeRecords' in parsed)) {
    throw new Error(`state snapshot in ${dir} carries no roeRecords slot`);
  }
  return parsed as RoeStoredSnapshot;
}

let baseA = '';
let baseB = '';
let serverAModule: { flushPersist?: () => Promise<void> } = {};
let dirA = '';
let dirB = '';
let savedEnv: Record<string, string | undefined> = {};

function pinLoopbackEnv(): void {
  // Deployment settings (DOCKER=true, T3MP3ST_HOST) must not leak into the
  // test worker: a non-loopback bind refuses to start without a bearer, which
  // would kill the worker or stall readiness. Pin loopback for the imports,
  // restore the operator's environment in afterAll.
  savedEnv = {
    DOCKER: process.env.DOCKER,
    T3MP3ST_HOST: process.env.T3MP3ST_HOST,
    T3MP3ST_BEARER_TOKEN: process.env.T3MP3ST_BEARER_TOKEN,
    T3MP3ST_BEARER_TOKEN_FILE: process.env.T3MP3ST_BEARER_TOKEN_FILE,
  };
  delete process.env.DOCKER;
  process.env.T3MP3ST_HOST = '127.0.0.1';
  delete process.env.T3MP3ST_BEARER_TOKEN;
  delete process.env.T3MP3ST_BEARER_TOKEN_FILE;
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeAll(async () => {
  pinLoopbackEnv();
  dirA = mkdtempSync(join(tmpdir(), 'roe-routes-a-'));
  writeFileSync(join(dirA, 'state.json'), '{}');
  dirB = mkdtempSync(join(tmpdir(), 'roe-routes-b-'));
  writeFileSync(join(dirB, 'state.json'), JSON.stringify(TAMPERED_STATE));
  const portA = await freePort();
  process.env.T3MP3ST_STATE_DIR = dirA;
  process.env.T3MP3ST_PORT = String(portA);
  serverAModule = await import('../server.js');
  expect(serverAModule).toBeDefined();
  baseA = `http://127.0.0.1:${portA}`;
  await waitReady(baseA, 90000);
}, 180000);

afterAll(() => {
  restoreEnv();
  rmSync(dirA, { recursive: true, force: true });
  rmSync(dirB, { recursive: true, force: true });
});

describe('roe routes runtime (clean slot)', () => {
  it('GET with no record returns the honest zeroed parse', { timeout: 30000 }, async () => {
    const { status, json } = await getRoe(baseA);
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: false, summary: 'no ROE text on record' });
    expect(json).not.toHaveProperty('verdicts');
    expect(json).not.toHaveProperty('provenance');
  });

  it('PUT happy path records revision 1 and GET returns provenance-stamped verdicts', { timeout: 30000 }, async () => {
    const put = await putRoe(baseA, { text: HAPPY_TEXT, actions: HAPPY_ACTIONS });
    expect(put.status).toBe(200);
    expect(put.json).toMatchObject({ revision: 1, textHash: sha16(HAPPY_TEXT), ok: true });

    const { status, json } = await getRoe(baseA);
    expect(status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      provenance: { revision: 1, textHash: sha16(HAPPY_TEXT) },
    });
    expect(json).toHaveProperty('provenance.recordedAt', expect.any(String));
    expect(json).toHaveProperty('verdicts.length', HAPPY_ACTIONS.length);
    expect(json).toHaveProperty('verdicts.0.verdict', 'compliant');
    expect(json).toHaveProperty('verdicts.0.roeRevision', 1);
    expect(json).toHaveProperty('verdicts.0.roeTextHash', sha16(HAPPY_TEXT));
    expect(json).toHaveProperty('verdicts.0.roeLines', [1, 2]);
  });

  it('PUT rejects empty text, oversize text, and malformed actions', { timeout: 30000 }, async () => {
    const empty = await putRoe(baseA, { text: '', actions: [] });
    expect(empty.status).toBe(400);

    const missing = await putRoe(baseA, { actions: [] });
    expect(missing.status).toBe(400);

    const oversize = await putRoe(baseA, { text: 'x'.repeat(64 * 1024 + 1), actions: [] });
    expect(oversize.status).toBe(413);
    expect(oversize.json).toHaveProperty('error', expect.stringContaining('64 KiB'));

    const badTarget = await putRoe(baseA, {
      text: HAPPY_TEXT,
      actions: [{ command: 'nmap -sV app.example.com', target: 123 }],
    });
    expect(badTarget.status).toBe(400);

    const badShape = await putRoe(baseA, { text: HAPPY_TEXT, actions: 'nope' });
    expect(badShape.status).toBe(400);
  });

  it('second PUT increments revision and preserves createdAt across the persist cycle', { timeout: 30000 }, async () => {
    // Flush the first PUT's debounced snapshot through the real signal, then
    // capture its stamp.
    await flushTo(dirA, 1);
    const before = readRoeSnapshot(dirA);
    expect(before.roeRecords).toHaveLength(1);
    expect(before.roeRecords[0].revision).toBe(1);

    const put = await putRoe(baseA, { text: SECOND_TEXT, actions: SECOND_ACTIONS });
    expect(put.status).toBe(200);
    expect(put.json).toMatchObject({ revision: 2, textHash: sha16(SECOND_TEXT) });

    await flushTo(dirA, 2);
    const after = readRoeSnapshot(dirA);
    expect(after.roeRecords).toHaveLength(1);
    expect(after.roeRecords[0].revision).toBe(2);
    expect(after.roeRecords[0].textHash).toBe(sha16(SECOND_TEXT));
    expect(after.roeRecords[0].createdAt).toBe(before.roeRecords[0].createdAt);

    const { status, json } = await getRoe(baseA);
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, provenance: { revision: 2 } });
    expect(json).toHaveProperty('verdicts.length', SECOND_ACTIONS.length);
  });

  it('contradictory directives record ok:false and yield no verdicts', { timeout: 30000 }, async () => {
    const put = await putRoe(baseA, { text: CONTRADICTORY_TEXT, actions: HAPPY_ACTIONS });
    expect(put.status).toBe(200);
    expect(put.json).toMatchObject({ ok: false, revision: 3 });

    const { status, json } = await getRoe(baseA);
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: false, provenance: { revision: 3 } });
    expect(json).not.toHaveProperty('verdicts');
  });

  it('black noise route answers the empty-ledger budget', { timeout: 30000 }, async () => {
    const res = await fetch(`${baseA}/api/teams/black/noise`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 0, tier: 'quiet' });
  });
});

describe('roe routes runtime (tampered persisted record)', () => {
  beforeAll(async () => {
    pinLoopbackEnv();
    // Server A's debounced snapshot must land in dirA BEFORE dirB becomes the
    // state dir, or the delayed write clobbers the tampered fixture.
    await serverAModule.flushPersist?.();
    vi.resetModules();
    const portB = await freePort();
    process.env.T3MP3ST_STATE_DIR = dirB;
    process.env.T3MP3ST_PORT = String(portB);
    const serverB = await import('../server.js');
    expect(serverB).toBeDefined();
    baseB = `http://127.0.0.1:${portB}`;
    await waitReady(baseB, 90000);
    process.env.T3MP3ST_STATE_DIR = dirA;
  }, 180000);

  it('tampered text/actions hashes fail closed with cannot-derive and no verdicts', { timeout: 30000 }, async () => {
    const { status, json } = await getRoe(baseB);
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: false, summary: 'no ROE text on record' });
    expect(json).not.toHaveProperty('verdicts');
    expect(json).not.toHaveProperty('provenance');
  });
});
