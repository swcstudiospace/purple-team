import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createRoeHandlers } from '../teams/white/roe-routes.js';
import {
  buildRevision,
  createRoeLedgerStore,
  fsBackend,
  migrateLegacyLatest,
  parseLedger,
  type MissionId,
  type RoeLedgerBackend,
  type RoeLedgerLine,
  type RoeLedgerStore,
} from '../teams/white/roe-ledger.js';

/** Provenance tests for the ROE routes (phase 40): recorded author, server time, unknown reads. */

const LATEST = 'latest' as MissionId;
const OK_TEXT = ['# Engagement ROE', 'scope: app.example.com, api.example.com', 'allow active: no', ''].join('\n');
const ACTIONS = [
  { command: 'nmap -sV app.example.com', target: 'app.example.com', approved: false },
  { command: 'curl https://app.example.com/health', target: 'app.example.com' },
];
const SECRET = 'sk-ant-api03-abcdefghijklmnop1234';

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const next = cleanups.pop();
    await next?.();
  }
});

function setup(): { ledgerFile: string; store: RoeLedgerStore; backend: RoeLedgerBackend } {
  const dir = mkdtempSync(join(tmpdir(), 'roe-provenance-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const ledgerDir = join(dir, 'roe-ledger');
  const backend = fsBackend(ledgerDir);
  return { ledgerFile: join(ledgerDir, 'latest.jsonl'), store: createRoeLedgerStore(backend), backend };
}

async function mount(store: RoeLedgerStore): Promise<string> {
  const handlers = createRoeHandlers({
    store,
    emitContractEvent: () => undefined,
    recordReceipt: (binding) => binding,
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
  return `http://127.0.0.1:${addr.port}`;
}

async function request(base: string, method: string, path: string, body?: unknown): Promise<Reply> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

/** The stored lines of the latest ledger, validated by the real parser (typed, no casts). */
function storedLines(file: string): RoeLedgerLine[] {
  const read = parseLedger(LATEST, readFileSync(file, 'utf8').split('\n'));
  if (!read.ok) throw new Error(`ledger corrupt at line ${read.line}: ${read.reason}`);
  return read.records;
}

function sha16(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}

describe('ROE text provenance (phase 40)', () => {
  it('stamps recorded provenance with server time, source api and the trimmed author (AC-40-01)', async () => {
    const { ledgerFile, store } = setup();
    const base = await mount(store);
    const before = Date.now();
    const put = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: '  alice  ' });
    expect(put.status).toBe(200);
    const [line] = storedLines(ledgerFile);
    expect(line.provenance).toEqual({ status: 'recorded', recordedAt: expect.any(String), source: 'api', recordedBy: 'alice' });
    const recordedAt = line.provenance?.recordedAt ?? '';
    expect(recordedAt).toBe(line.recordedAt);
    expect(new Date(recordedAt).toISOString()).toBe(recordedAt);
    expect(Date.parse(recordedAt)).toBeGreaterThanOrEqual(before);
  });

  it('records recordedBy null when the author is absent, null or blank after trimming (AC-40-01)', async () => {
    const { ledgerFile, store } = setup();
    const base = await mount(store);
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: null });
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: '   ' });
    const lines = storedLines(ledgerFile);
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.provenance).toMatchObject({ status: 'recorded', source: 'api', recordedBy: null });
    }
  });

  it('refuses a non-string author or one over 128 characters with 400 and appends nothing; 128 is accepted', async () => {
    const { ledgerFile, store } = setup();
    const base = await mount(store);
    const numeric = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: 42 });
    expect(numeric.status).toBe(400);
    expect(numeric.body.error).toMatch(/author must be a string/);
    const tooLong = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: 'a'.repeat(129) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error).toMatch(/at most 128 characters/);
    expect(existsSync(ledgerFile)).toBe(false);
    const boundary = await request(base, 'PUT', '/api/teams/white/roe', {
      text: OK_TEXT,
      actions: ACTIONS,
      author: ` ${'a'.repeat(128)} `,
    });
    expect(boundary.status).toBe(200);
    const lines = storedLines(ledgerFile);
    expect(lines).toHaveLength(1);
    expect(lines[0].provenance?.recordedBy).toBe('a'.repeat(128));
  });

  it('redacts a secret in the author before it is written to the ledger file', async () => {
    const { ledgerFile, store } = setup();
    const base = await mount(store);
    const put = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: `operator ${SECRET}` });
    expect(put.status).toBe(200);
    expect(readFileSync(ledgerFile, 'utf8')).not.toContain(SECRET);
    const [line] = storedLines(ledgerFile);
    expect(line.provenance?.recordedBy).toMatch(/redacted/);
  });

  it('GET exposes the provenance of the newest revision (AC-40-03)', async () => {
    const { store } = setup();
    const base = await mount(store);
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: 'first' });
    const put = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: 'bob' });
    const get = await request(base, 'GET', '/api/teams/white/roe');
    expect(get.body.provenance).toEqual({
      revision: 2,
      textHash: put.body.textHash,
      status: 'recorded',
      recordedAt: expect.any(String),
      source: 'api',
      recordedBy: 'bob',
    });
  });

  it('the revisions list and the one-revision route expose each revision provenance (AC-40-03)', async () => {
    const { store } = setup();
    const base = await mount(store);
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, author: 'carol' });
    const history = await request(base, 'GET', '/api/teams/white/roe/revisions');
    expect(history.body).toMatchObject({
      revisions: [{ provenance: { status: 'recorded', source: 'api', recordedBy: 'carol' } }],
    });
    const one = await request(base, 'GET', '/api/teams/white/roe/revisions/1');
    expect(one.body.provenance).toEqual({
      status: 'recorded',
      recordedAt: expect.any(String),
      source: 'api',
      recordedBy: 'carol',
    });
    expect(one.body).toHaveProperty('text');
  });

  it('a revision written before this phase reads as unknown with no recorded values (AC-40-02)', async () => {
    const { store } = setup();
    const base = await mount(store);
    await store.append(LATEST, (previous) =>
      buildRevision({
        missionId: LATEST,
        text: OK_TEXT,
        actions: ACTIONS,
        previous,
        recordedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    const one = await request(base, 'GET', '/api/teams/white/roe/revisions/1');
    expect(one.body.provenance).toEqual({ status: 'unknown' });
    const get = await request(base, 'GET', '/api/teams/white/roe');
    expect(get.body.provenance).toEqual({ revision: 1, textHash: one.body.textHash, status: 'unknown' });
    expect(get.body.provenance).not.toHaveProperty('recordedAt');
    const history = await request(base, 'GET', '/api/teams/white/roe/revisions');
    expect(history.body).toMatchObject({ revisions: [{ provenance: { status: 'unknown' } }] });
  });

  it('a migrated legacy revision reads as unknown and no provenance is invented (AC-40-02)', async () => {
    const { store, backend } = setup();
    const base = await mount(store);
    const row = {
      id: 'latest',
      revision: 4,
      text: OK_TEXT,
      actions: ACTIONS,
      textHash: sha16(OK_TEXT),
      actionsHash: sha16(JSON.stringify(ACTIONS)),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    expect(await migrateLegacyLatest(backend, [row])).toBe('imported');
    const one = await request(base, 'GET', '/api/teams/white/roe/revisions/4');
    expect(one.status).toBe(200);
    expect(one.body.provenance).toEqual({ status: 'unknown' });
    expect(one.body.createdAt).toBe(row.createdAt);
    expect(one.body.recordedAt).toBe(row.updatedAt);
  });
});
