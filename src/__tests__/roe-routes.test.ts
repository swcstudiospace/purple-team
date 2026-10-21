import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { redactSecrets } from '../redact.js';
import { createRoeHandlers, ROE_BODY_CAP_BYTES, roeLedgerBackendFor } from '../teams/white/roe-routes.js';
import type { LedgerRead } from '../teams/white/roe-ledger.js';
import {
  createRoeLedgerStore,
  fsBackend,
  migrateLegacyLatest,
  type RoeLedgerBackend,
  type RoeLedgerStore,
} from '../teams/white/roe-ledger.js';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

const OK_TEXT = ['# Engagement ROE', 'scope: app.example.com, api.example.com', 'allow active: no', ''].join('\n');
const ACTIONS = [
  { command: 'nmap -sV app.example.com', target: 'app.example.com', approved: false },
  { command: 'curl https://app.example.com/health', target: 'app.example.com' },
];
const SECRET = 'sk-ant-api03-abcdefghijklmnop1234';
const SECRET_TEXT = `${OK_TEXT}# token ${SECRET}\n`;

interface Reply {
  status: number;
  text: string;
  body: Record<string, unknown>;
}

interface Mounted {
  base: string;
  emitted: Array<{ type: string; payload: Record<string, unknown> }>;
  receipts: Array<Record<string, unknown>>;
}

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const next = cleanups.pop();
    await next?.();
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'roe-routes-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function mount(
  store: RoeLedgerStore,
  overrides: { emitContractEvent?: (type: string, payload: Record<string, unknown>) => void } = {},
): Promise<Mounted> {
  const emitted: Mounted['emitted'] = [];
  const receipts: Mounted['receipts'] = [];
  const handlers = createRoeHandlers({
    store,
    emitContractEvent: overrides.emitContractEvent ?? ((type, payload) => {
      emitted.push({ type, payload });
    }),
    recordReceipt: (binding) => {
      receipts.push({ ...binding });
      return binding;
    },
  });
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.put('/api/teams/white/roe', handlers.putRoe);
  app.get('/api/teams/white/roe', handlers.getRoe);
  app.get('/api/teams/white/roe/revisions', handlers.getRoeRevisions);
  app.get('/api/teams/white/roe/revisions/:revision', handlers.getRoeRevision);
  const server: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  cleanups.push(() => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));
  return { base: `http://127.0.0.1:${addr.port}`, emitted, receipts };
}

async function request(base: string, method: string, path: string, body?: unknown): Promise<Reply> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text, body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

function setup(): { dir: string; ledgerDir: string; store: RoeLedgerStore; backend: RoeLedgerBackend } {
  const dir = tempDir();
  const ledgerDir = join(dir, 'roe-ledger');
  const backend = fsBackend(ledgerDir);
  return { dir, ledgerDir, store: createRoeLedgerStore(backend), backend };
}

function sha16(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}

function ledgerLines(file: string): Array<Record<string, unknown>> {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('ROE routes over the verdict ledger (phase 39)', () => {
  it('PUT answers revision, textHash and missionId, and appends exactly one JSON line (AC-39-01, AC-39-03, AC-39-10)', async () => {
    const { ledgerDir, store } = setup();
    const m = await mount(store);
    const reply = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ revision: 1, missionId: 'latest', ok: true });
    expect(reply.body.textHash).toBe(sha16(OK_TEXT));
    expect(typeof reply.body.summary).toBe('string');

    const file = join(ledgerDir, 'latest.jsonl');
    const lines = ledgerLines(file);
    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0]).sort()).toEqual(
      ['actions', 'actionsHash', 'createdAt', 'missionId', 'parseOk', 'provenance', 'recordedAt', 'revision', 'schemaVersion', 'text', 'textHash', 'verdicts'].sort(),
    );
    expect(lines[0]).toMatchObject({ schemaVersion: 1, revision: 1, missionId: 'latest', parseOk: true });
    expect(lines[0].verdicts).toHaveLength(ACTIONS.length);
    expect(m.emitted).toEqual([
      expect.objectContaining({ type: 'white.roe.on-record', payload: expect.objectContaining({ missionId: 'latest', revision: 1 }) }),
    ]);
  });

  it('never rewrites, truncates or prunes earlier lines; revisions are contiguous from 1 (AC-39-01, AC-39-02)', async () => {
    const { ledgerDir, store } = setup();
    const m = await mount(store);
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const file = join(ledgerDir, 'latest.jsonl');
    const firstBytes = readFileSync(file, 'utf8');
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: `${OK_TEXT}# second\n`, actions: ACTIONS });
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: [] });
    const finalBytes = readFileSync(file, 'utf8');
    expect(finalBytes.startsWith(firstBytes)).toBe(true);
    expect(ledgerLines(file).map((line) => line.revision)).toEqual([1, 2, 3]);
  });

  it('hashes the redacted text and actions; secrets appear in no response, file or history (AC-39-09)', async () => {
    const { ledgerDir, store } = setup();
    const m = await mount(store);
    const put = await request(m.base, 'PUT', '/api/teams/white/roe', { text: SECRET_TEXT, actions: ACTIONS });
    expect(put.status).toBe(200);
    const redacted = redactSecrets({ text: SECRET_TEXT, actions: ACTIONS }) as { text: string };
    expect(put.body.textHash).toBe(sha16(redacted.text));
    expect(redacted.text).not.toContain(SECRET);

    const file = readFileSync(join(ledgerDir, 'latest.jsonl'), 'utf8');
    expect(file).not.toContain(SECRET);

    const get = await request(m.base, 'GET', '/api/teams/white/roe');
    const history = await request(m.base, 'GET', '/api/teams/white/roe/revisions');
    const one = await request(m.base, 'GET', '/api/teams/white/roe/revisions/1');
    for (const reply of [put, get, history, one]) {
      expect(reply.text).not.toContain(SECRET);
    }
  });

  it('accepts a mission id, scopes ledgers per mission, and refuses ids that are not safe path segments (AC-39-04)', async () => {
    const { dir, ledgerDir, store } = setup();
    const m = await mount(store);
    const named = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, missionId: 'alpha-1_b' });
    expect(named.status).toBe(200);
    expect(named.body.missionId).toBe('alpha-1_b');
    expect(existsSync(join(ledgerDir, 'alpha-1_b.jsonl'))).toBe(true);
    expect(existsSync(join(ledgerDir, 'latest.jsonl'))).toBe(false);

    const scoped = await request(m.base, 'GET', '/api/teams/white/roe?missionId=alpha-1_b');
    expect(scoped.body.missionId).toBe('alpha-1_b');
    expect(scoped.body.ok).toBe(true);

    for (const bad of ['../escape', '-leading', 'a'.repeat(65), 'has space']) {
      const reply = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: [], missionId: bad });
      expect(reply.status, `PUT missionId ${bad}`).toBe(400);
    }
    for (const bad of [null, 7, ['a']]) {
      const reply = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: [], missionId: bad });
      expect(reply.status, `PUT missionId ${JSON.stringify(bad)}`).toBe(400);
    }
    const traversal = await request(m.base, 'GET', '/api/teams/white/roe?missionId=../escape');
    expect(traversal.status).toBe(400);
    expect(existsSync(join(dir, 'escape.jsonl'))).toBe(false);
    expect(readdirSync(dir)).toEqual(['roe-ledger']);
  });

  it('GET with no ledger answers the cannot-derive report with no verdicts (AC-39-05)', async () => {
    const { store } = setup();
    const m = await mount(store);
    const reply = await request(m.base, 'GET', '/api/teams/white/roe');
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ ok: false, summary: 'no ROE text on record', missionId: 'latest' });
    expect(reply.body).not.toHaveProperty('verdicts');
    expect(reply.body).not.toHaveProperty('ledger');
  });

  it('GET derives the report and stamped verdicts from the newest revision (AC-39-05)', async () => {
    const { store } = setup();
    const m = await mount(store);
    const put = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const get = await request(m.base, 'GET', '/api/teams/white/roe');
    expect(get.body.ok).toBe(true);
    expect(get.body.provenance).toMatchObject({ revision: 2, textHash: put.body.textHash });
    const verdicts = get.body.verdicts as Array<Record<string, unknown>>;
    expect(verdicts).toHaveLength(ACTIONS.length);
    expect(verdicts[0]).toMatchObject({ roeRevision: 2, roeTextHash: put.body.textHash, verdict: 'violation' });
    expect(verdicts[0].roeLines).toEqual([2, 3]);
  });

  it('GET fails closed on a corrupt line, names the line, and PUT refuses to append past it (AC-39-05, AC-39-06)', async () => {
    const { ledgerDir, store } = setup();
    const m = await mount(store);
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const file = join(ledgerDir, 'latest.jsonl');
    appendFileSync(file, 'not json\n');
    const before = readFileSync(file, 'utf8');

    const get = await request(m.base, 'GET', '/api/teams/white/roe');
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ ok: false, summary: 'no ROE text on record', ledger: { status: 'corrupt', line: 2 } });
    expect(get.body).not.toHaveProperty('verdicts');

    const put = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    expect(put.status).toBe(409);
    expect(put.body).toMatchObject({ line: 2 });
    expect(readFileSync(file, 'utf8')).toBe(before);

    expect((await request(m.base, 'GET', '/api/teams/white/roe/revisions')).status).toBe(409);
    expect((await request(m.base, 'GET', '/api/teams/white/roe/revisions/1')).status).toBe(409);
  });

  it('answers 503 on GET (cannot-derive, unreadable), PUT and history when the backend throws (AC-39-05)', async () => {
    const failing: RoeLedgerBackend = {
      readLines: async () => {
        throw new Error('EIO: simulated read failure');
      },
      appendLine: async () => {
        throw new Error('EIO: simulated write failure');
      },
    };
    const m = await mount(createRoeLedgerStore(failing));
    const get = await request(m.base, 'GET', '/api/teams/white/roe');
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ ok: false, ledger: { status: 'unreadable' } });
    expect((await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: [] })).status).toBe(503);
    expect((await request(m.base, 'GET', '/api/teams/white/roe/revisions')).status).toBe(503);
  });

  it('lists the full history per revision with verdict counts (AC-39-06)', async () => {
    const { store } = setup();
    const m = await mount(store);
    const empty = await request(m.base, 'GET', '/api/teams/white/roe/revisions?missionId=fresh');
    expect(empty.body).toEqual({ missionId: 'fresh', revisions: [] });

    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: 'hello world', actions: ACTIONS });
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const history = await request(m.base, 'GET', '/api/teams/white/roe/revisions');
    expect(history.status).toBe(200);
    const revisions = history.body.revisions as Array<Record<string, unknown>>;
    expect(revisions.map((r) => r.revision)).toEqual([1, 2, 3]);
    expect(revisions[0]).toMatchObject({
      textHash: sha16(OK_TEXT),
      parseOk: true,
      verdictCounts: { compliant: 1, violation: 1, needs_approval: 0 },
    });
    expect(revisions[0]).toHaveProperty('actionsHash');
    expect(revisions[0]).toHaveProperty('recordedAt');
    expect(revisions[1]).toMatchObject({ parseOk: false, verdictCounts: { compliant: 0, violation: 0, needs_approval: 0 } });
  });

  it('returns one full revision, 404 for an unknown revision or mission, 400 for a non-positive-integer revision (AC-39-06)', async () => {
    const { store } = setup();
    const m = await mount(store);
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: `${OK_TEXT}# two\n`, actions: ACTIONS });

    const one = await request(m.base, 'GET', '/api/teams/white/roe/revisions/2');
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ revision: 2, missionId: 'latest', schemaVersion: 1, parseOk: true });
    expect(one.body.text).toContain('# two');

    expect((await request(m.base, 'GET', '/api/teams/white/roe/revisions/9')).status).toBe(404);
    expect((await request(m.base, 'GET', '/api/teams/white/roe/revisions/2?missionId=missing')).status).toBe(404);
    for (const bad of ['0', '-1', '1.5', 'abc', '01', '99999999999999999999']) {
      const reply = await request(m.base, 'GET', `/api/teams/white/roe/revisions/${bad}`);
      expect(reply.status, `revision ${bad}`).toBe(400);
    }
  });

  it('rejects malformed text and action bodies with 400 and caps text at 64 KiB with 413 (AC-39-10)', async () => {
    const { ledgerDir, store } = setup();
    const m = await mount(store);
    expect((await request(m.base, 'PUT', '/api/teams/white/roe', { text: '', actions: [] })).status).toBe(400);
    expect((await request(m.base, 'PUT', '/api/teams/white/roe', { actions: [] })).status).toBe(400);
    expect((await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT })).status).toBe(400);
    expect((await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ['nope'] })).status).toBe(400);

    // Word-separated filler: an unbroken 64 KiB token makes redactString's URL-userinfo rule quadratic (see the commit body).
    const capText = 'a '.repeat(ROE_BODY_CAP_BYTES / 2);
    const atCap = await request(m.base, 'PUT', '/api/teams/white/roe', { text: capText, actions: [] });
    expect(atCap.status).toBe(200);
    expect(atCap.body.ok).toBe(false);
    const over = await request(m.base, 'PUT', '/api/teams/white/roe', { text: `${capText}a`, actions: [] });
    expect(over.status).toBe(413);
    expect(over.body).toEqual({ error: 'ROE text exceeds the 64 KiB cap' });
    expect(ledgerLines(join(ledgerDir, 'latest.jsonl'))).toHaveLength(1);
  });

  it('mints a parseRoe receipt only for a parse that is ok (phase 26 receipt contract)', async () => {
    const { store } = setup();
    const m = await mount(store);
    const ok = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    expect(m.receipts).toEqual([
      expect.objectContaining({
        runId: 'roe-rev-1',
        missionId: 'roe-record',
        stage: 'parse',
        tool: 'parseRoe',
        inputSha256: ok.body.textHash,
        itemId: 'latest',
      }),
    ]);
    const failed = await request(m.base, 'PUT', '/api/teams/white/roe', { text: 'hello world', actions: [] });
    expect(failed.body.ok).toBe(false);
    expect(m.receipts).toHaveLength(1);
  });

  it('imports a legacy latest row once as its existing revision and keeps contiguous revisions after it (AC-39-07)', async () => {
    const { store, backend } = setup();
    const legacyText = OK_TEXT;
    const legacyRow = {
      id: 'latest',
      revision: 7,
      textHash: sha16(legacyText),
      actionsHash: sha16(JSON.stringify(ACTIONS)),
      text: legacyText,
      actions: ACTIONS,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    };
    expect(await migrateLegacyLatest(backend, [legacyRow])).toBe('imported');
    expect(await migrateLegacyLatest(backend, [legacyRow])).toBe('already-present');

    const m = await mount(store);
    const history = await request(m.base, 'GET', '/api/teams/white/roe/revisions');
    expect((history.body.revisions as Array<Record<string, unknown>>).map((r) => r.revision)).toEqual([7]);
    const next = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    expect(next.body.revision).toBe(8);
  });

  it('memory mode (T3MP3ST_STATE_DIR unset): PUT succeeds, writes no file under a memory directory, GET reads the revision from memory (AC-39-01)', async () => {
    const savedStateDir = process.env.T3MP3ST_STATE_DIR;
    delete process.env.T3MP3ST_STATE_DIR;
    try {
      // Mirrors server.ts stateRoot(): with the env unset the root is `memory`.
      const root = process.env.T3MP3ST_STATE_DIR ? process.env.T3MP3ST_STATE_DIR : 'memory';
      const m = await mount(createRoeLedgerStore(roeLedgerBackendFor(root)));
      const put = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
      expect(put.status).toBe(200);
      expect(put.body.revision).toBe(1);
      const get = await request(m.base, 'GET', '/api/teams/white/roe');
      expect(get.body).toMatchObject({ ok: true, provenance: { revision: 1, textHash: put.body.textHash } });
      expect(existsSync(join(process.cwd(), 'memory')), 'no memory directory is created on disk').toBe(false);
    } finally {
      if (savedStateDir === undefined) delete process.env.T3MP3ST_STATE_DIR;
      else process.env.T3MP3ST_STATE_DIR = savedStateDir;
    }
    expect(serverSource, 'the server selects the ledger backend through the shared helper').toContain('roeLedgerBackendFor(stateRoot())');
    expect(serverSource, 'stateRoot() keeps its memory fallback when the env is unset').toContain(": 'memory')");
  });

  it('caps the serialized actions payload at 64 KiB: one byte over is 413, the cap itself is accepted (Security F1)', async () => {
    const { ledgerDir, store } = setup();
    const m = await mount(store);
    // `[{"command":"<X>"}]` serializes to X plus 16 bytes, so X = cap - 16 lands exactly on the cap.
    const atCapCommand = 'a '.repeat((ROE_BODY_CAP_BYTES - 16) / 2);
    const atCap = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: [{ command: atCapCommand }] });
    expect(atCap.status).toBe(200);
    expect(ledgerLines(join(ledgerDir, 'latest.jsonl'))).toHaveLength(1);

    const overCommand = `${atCapCommand}a`;
    const over = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: [{ command: overCommand }] });
    expect(over.status).toBe(413);
    expect(over.body).toEqual({ error: 'ROE actions exceed the 64 KiB cap' });
    expect(ledgerLines(join(ledgerDir, 'latest.jsonl'))).toHaveLength(1);
  });

  it('gives every verdict its own roeLines array of numbers, with no shared reference (Greptile)', async () => {
    const { store } = setup();
    const m = await mount(store);
    await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const get = await request(m.base, 'GET', '/api/teams/white/roe');
    const verdicts = get.body.verdicts as Array<Record<string, unknown>>;
    expect(verdicts).toHaveLength(ACTIONS.length);
    for (const verdict of verdicts) {
      const lines = verdict.roeLines as unknown[];
      expect(Array.isArray(lines)).toBe(true);
      expect(lines.every((line) => typeof line === 'number')).toBe(true);
      expect(lines).toEqual([2, 3]);
    }
    expect(get.text, 'a shared array would be redacted to [circular]').not.toContain('[circular]');
  });

  it('refuses action objects with __proto__, constructor or prototype keys with 400 and stores nothing (Greptile)', async () => {
    const { ledgerDir, store } = setup();
    const m = await mount(store);
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      // Raw JSON, so the key is an own property exactly as a client would send it.
      const body = `{"text":${JSON.stringify(OK_TEXT)},"actions":[{"command":"curl x","target":"app.example.com","${key}":{"polluted":true}}]}`;
      const res = await fetch(`${m.base}/api/teams/white/roe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(res.status, `key ${key}`).toBe(400);
      expect(await res.json(), `key ${key}`).toEqual({ error: 'actions must not carry __proto__, constructor or prototype keys' });
    }
    // A null element must be a 400, not a thrown TypeError answered as 500.
    const nullAction = await request(m.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: [null] });
    expect(nullAction.status).toBe(400);
    expect(existsSync(join(ledgerDir, 'latest.jsonl')), 'no line is appended for a refused payload').toBe(false);
  });

  it('answers 500 JSON when a handler throws unexpectedly, instead of leaving the request open (Greptile)', async () => {
    const { store } = setup();
    const failingEmit = await mount(store, {
      emitContractEvent: () => {
        throw new Error('forced failure');
      },
    });
    const put = await request(failingEmit.base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    expect(put.status).toBe(500);
    expect(put.body).toEqual({ error: 'ROE PUT failed unexpectedly' });
    expect(put.text, 'the forced error text must not reach the client').not.toContain('forced failure');

    // A ledger read that yields no records makes the GET derivation throw.
    const malformed: RoeLedgerStore = {
      read: async () => ({ ok: true, records: null }) as unknown as LedgerRead,
      append: async () => {
        throw new Error('unused');
      },
    };
    const failingGet = await mount(malformed);
    const get = await request(failingGet.base, 'GET', '/api/teams/white/roe');
    expect(get.status).toBe(500);
    expect(get.body).toEqual({ error: 'ROE GET failed unexpectedly' });
  });

  it('keeps every ROE route under /api/ and the legacy roeRecords slot out of the server (AC-39-08, AC-39-11)', () => {
    for (const route of [
      "app.put('/api/teams/white/roe'",
      "app.get('/api/teams/white/roe'",
      "app.get('/api/teams/white/roe/revisions'",
      "app.get('/api/teams/white/roe/revisions/:revision'",
    ]) {
      expect(serverSource, route).toContain(route);
    }
    expect(serverSource.match(/['"`]\/teams\/white\/roe/g), 'no ROE route outside /api/').toBeNull();
    expect(serverSource, 'the in-memory roeRecords Map is removed (ledger is the only ROE store)').not.toContain('new Map<string, RoeRecord>');
    const snapshotStart = serverSource.indexOf('function buildStateSnapshot(');
    expect(snapshotStart, 'buildStateSnapshot must exist').toBeGreaterThanOrEqual(0);
    const snapshotBody = serverSource.slice(snapshotStart, serverSource.indexOf('\n}\n', snapshotStart));
    expect(snapshotBody, 'state.json snapshot must not carry a roeRecords key').not.toContain('roeRecords: [');
    expect(serverSource, 'startup imports the legacy row once').toContain('migrateLegacyLatest(roeLedgerBackend, legacyRoeRows)');
  });
});
