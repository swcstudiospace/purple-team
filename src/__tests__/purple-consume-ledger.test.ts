import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createRoeHandlers } from '../teams/white/roe-routes.js';
import {
  consumeLedgerVerdicts,
  createPurpleSynthesizeHandlers,
  type PurpleSynthesisRecord,
} from '../teams/purple-synthesize-routes.js';
import { synthesize } from '../teams/purple.js';
import {
  buildRevision,
  createRoeLedgerStore,
  fsBackend,
  type LedgerRead,
  type MissionId,
  type RoeLedgerBackend,
  type RoeLedgerStore,
} from '../teams/white/roe-ledger.js';

/**
 * Purple auto-consumption of recorded ROE verdicts (phase 40). The smoke tests mount the real
 * ROE handlers and the real purple handlers over one ledger; nothing is mocked.
 */

const LATEST = 'latest' as MissionId;
const T = '2026-10-21T00:00:00.000Z';
const SYNTH = '/api/teams/purple/synthesize';
const OK_TEXT = ['# Engagement ROE', 'scope: app.example.com, api.example.com', 'allow active: no', ''].join('\n');
const OK_TEXT_ACTIVE = ['# Engagement ROE', 'scope: app.example.com, api.example.com', 'allow active: yes', ''].join('\n');
const ACTIONS = [
  { command: 'nmap -sV app.example.com', target: 'app.example.com', approved: false },
  { command: 'curl https://app.example.com/health', target: 'app.example.com' },
];

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

function setup(): { ledgerDir: string; ledgerFile: string; store: RoeLedgerStore; backend: RoeLedgerBackend } {
  const dir = mkdtempSync(join(tmpdir(), 'purple-consume-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const ledgerDir = join(dir, 'roe-ledger');
  const backend = fsBackend(ledgerDir);
  return { ledgerDir, ledgerFile: join(ledgerDir, 'latest.jsonl'), store: createRoeLedgerStore(backend), backend };
}

interface MountOptions {
  store: RoeLedgerStore;
  purpleSyntheses?: Map<string, PurpleSynthesisRecord>;
  nowIso?: () => string;
}

async function mount(options: MountOptions): Promise<{ base: string; purpleSyntheses: Map<string, PurpleSynthesisRecord> }> {
  const purpleSyntheses = options.purpleSyntheses ?? new Map<string, PurpleSynthesisRecord>();
  const emit = (): void => undefined;
  const roe = createRoeHandlers({ store: options.store, emitContractEvent: emit, recordReceipt: (binding) => binding });
  const purple = createPurpleSynthesizeHandlers({
    store: options.store,
    findings: new Map<string, { title?: string; severity?: string }>(),
    purpleSyntheses,
    emitContractEvent: emit,
    nowIso: options.nowIso ?? (() => T),
  });
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.put('/api/teams/white/roe', roe.putRoe);
  app.get('/api/teams/white/roe', roe.getRoe);
  app.get('/api/teams/white/roe/revisions', roe.getRoeRevisions);
  app.get('/api/teams/white/roe/revisions/:revision', roe.getRoeRevision);
  app.get(SYNTH, purple.getSynthesis);
  app.post(SYNTH, purple.postSynthesis);
  const server: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  cleanups.push(() => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));
  return { base: `http://127.0.0.1:${addr.port}`, purpleSyntheses };
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

describe('consumeLedgerVerdicts (phase 40)', () => {
  it('no ledger gives no verdicts with reason no-ledger (AC-40-05)', () => {
    expect(consumeLedgerVerdicts(null, LATEST)).toEqual({
      ok: true,
      verdictSource: { kind: 'none', missionId: 'latest', reason: 'no-ledger' },
    });
  });

  it('an empty ledger file gives no verdicts with reason no-ledger (AC-40-05)', () => {
    expect(consumeLedgerVerdicts({ ok: true, records: [] }, LATEST)).toEqual({
      ok: true,
      verdictSource: { kind: 'none', missionId: 'latest', reason: 'no-ledger' },
    });
  });

  it('a corrupt ledger is a failure and never yields verdicts (AC-40-05)', () => {
    const corrupt: LedgerRead = { ok: false, line: 3, reason: 'line is not valid JSON' };
    expect(consumeLedgerVerdicts(corrupt, LATEST)).toEqual({ ok: false, line: 3, reason: 'line is not valid JSON' });
  });

  it('an unparsed latest revision gives no verdicts with reason parse-not-ok (AC-40-05)', () => {
    const unparsed = buildRevision({
      missionId: LATEST,
      text: 'just prose, no rules',
      actions: ACTIONS,
      previous: null,
      recordedAt: T,
    });
    expect(unparsed.parseOk).toBe(false);
    expect(consumeLedgerVerdicts({ ok: true, records: [unparsed] }, LATEST)).toEqual({
      ok: true,
      verdictSource: { kind: 'none', missionId: 'latest', reason: 'parse-not-ok' },
    });
  });

  it('verdicts come from the latest revision, stamped with its revision and text hash (AC-40-04)', () => {
    const first = buildRevision({ missionId: LATEST, text: OK_TEXT, actions: ACTIONS, previous: null, recordedAt: T });
    const second = buildRevision({
      missionId: LATEST,
      text: OK_TEXT_ACTIVE,
      actions: ACTIONS,
      previous: first,
      recordedAt: T,
    });
    expect(second.verdicts).toHaveLength(ACTIONS.length);
    expect(consumeLedgerVerdicts({ ok: true, records: [first, second] }, LATEST)).toEqual({
      ok: true,
      verdictSource: {
        kind: 'ledger',
        missionId: 'latest',
        revision: 2,
        textHash: second.textHash,
        verdicts: second.verdicts.map((verdict) => ({ ...verdict, roeRevision: 2, roeTextHash: second.textHash })),
      },
    });
  });
});

describe('POST /api/teams/purple/synthesize over the ROE ledger (phase 40)', () => {
  it('AC-40-08 smoke: PUT ROE with an action, then POST without verdicts consumes that revision', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    const put = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    expect(put.status).toBe(200);
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [] });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({
      verdictSource: {
        kind: 'ledger',
        missionId: 'latest',
        revision: put.body.revision,
        textHash: put.body.textHash,
        verdicts: expect.arrayContaining([expect.objectContaining({ actionIndex: 0, verdict: 'violation' })]),
      },
      coverageMatrix: [expect.not.objectContaining({ verdict: expect.anything() })],
    });
    const get = await request(base, 'GET', SYNTH);
    expect(get.body).toMatchObject({ verdictSource: { kind: 'ledger', revision: put.body.revision } });
  });

  it('an explicit verdicts array keeps the request path and declares kind request (AC-40-04, AC-40-06)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    const post = await request(base, 'POST', SYNTH, {
      findings: [{ id: 'F-1' }],
      detections: [],
      verdicts: [{ actionIndex: 0, verdict: 'compliant', rationale: 'approved window' }],
    });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({
      verdictSource: { kind: 'request' },
      coverageMatrix: [{ findingId: 'F-1', verdict: 'compliant' }],
    });
  });

  it('consumes the newest revision, not an earlier one (AC-40-04)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const second = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT_ACTIVE, actions: ACTIONS });
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [] });
    expect(post.body).toMatchObject({
      verdictSource: { kind: 'ledger', revision: 2, textHash: second.body.textHash },
    });
  });

  it('a mission named by missionId is consumed from its own ledger (AC-40-04)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS, missionId: 'm-1' });
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [], missionId: 'm-1' });
    expect(post.body).toMatchObject({ verdictSource: { kind: 'ledger', missionId: 'm-1', revision: 1 } });
  });

  it('a missing ledger gives kind none with reason no-ledger and no verdicts (AC-40-05)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [] });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({
      verdictSource: { kind: 'none', missionId: 'latest', reason: 'no-ledger' },
      coverageMatrix: [{ findingId: 'F-1', detection: 'none' }],
    });
  });

  it('an unparsed latest revision gives kind none with reason parse-not-ok (AC-40-05)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    const put = await request(base, 'PUT', '/api/teams/white/roe', { text: 'just prose, no rules', actions: ACTIONS });
    expect(put.body.ok).toBe(false);
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [] });
    expect(post.body).toMatchObject({ verdictSource: { kind: 'none', missionId: 'latest', reason: 'parse-not-ok' } });
  });

  it('a corrupt ledger answers 409 with the line and stores no synthesis (AC-40-05)', async () => {
    const { store, ledgerDir, ledgerFile } = setup();
    const { base } = await mount({ store });
    mkdirSync(ledgerDir, { recursive: true });
    writeFileSync(ledgerFile, 'not json\n');
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [] });
    expect(post.status).toBe(409);
    expect(post.body).toMatchObject({ line: 1 });
    const get = await request(base, 'GET', SYNTH);
    expect(get.body).toEqual({ synthesis: null });
  });

  it('an unreadable ledger answers 503 and stores no synthesis', async () => {
    const { backend } = setup();
    const failing: RoeLedgerBackend = {
      readLines: async () => {
        throw new Error('disk gone');
      },
      appendLine: backend.appendLine,
    };
    const { base, purpleSyntheses } = await mount({ store: createRoeLedgerStore(failing) });
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [] });
    expect(post.status).toBe(503);
    expect(purpleSyntheses.size).toBe(0);
  });

  it('an unexpected failure answers 500 and stores no synthesis', async () => {
    const { store } = setup();
    const { base, purpleSyntheses } = await mount({
      store,
      nowIso: () => {
        throw new Error('clock unavailable');
      },
    });
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }], detections: [], verdicts: [] });
    expect(post.status).toBe(500);
    expect(post.body.error).toMatch(/nothing recorded/);
    expect(purpleSyntheses.size).toBe(0);
  });

  it('verdicts present but not an array are refused with 400 (AC-40-04)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    const text = await request(base, 'POST', SYNTH, { findings: [], detections: [], verdicts: 'nope' });
    expect(text.status).toBe(400);
    const nothing = await request(base, 'POST', SYNTH, { findings: [], detections: [], verdicts: null });
    expect(nothing.status).toBe(400);
  });

  it('an invalid missionId is refused with 400 before the ledger is read (AC-40-04)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    const post = await request(base, 'POST', SYNTH, { findings: [], detections: [], missionId: '../x' });
    expect(post.status).toBe(400);
    expect(post.body.error).toMatch(/missionId/);
  });

  it('id-keyed verdictsByFinding keeps its correlation when verdicts are absent (AC-40-07)', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const post = await request(base, 'POST', SYNTH, {
      findings: [{ id: 'F-1' }, { id: 'F-2' }],
      detections: [],
      verdictsByFinding: { 'F-2': { verdict: 'compliant' } },
    });
    expect(post.body).toMatchObject({
      correlation: 'id',
      coverageMatrix: [{ findingId: 'F-1' }, { findingId: 'F-2', verdict: 'compliant' }],
    });
  });

  it('a record written before verdictSource existed reads as request-supplied (AC-40-06)', async () => {
    const { store } = setup();
    const legacy: PurpleSynthesisRecord = {
      id: 'latest',
      createdAt: '2026-01-01T00:00:00.000Z',
      correlation: 'positional-fallback',
      synthesis: synthesize({ findings: [], detections: [], verdicts: [] }),
    };
    const { base } = await mount({ store, purpleSyntheses: new Map([['latest', legacy]]) });
    const get = await request(base, 'GET', SYNTH);
    expect(get.body).toMatchObject({
      verdictSource: {
        kind: 'request',
        reason: 'recorded before verdictSource existed; verdicts were request-supplied',
      },
    });
  });
});

describe('consumed verdicts join findings only through verdictsByFinding (amended AC-40-04)', () => {
  it('a subset of findings joins only the ids named in verdictsByFinding', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const post = await request(base, 'POST', SYNTH, {
      findings: [{ id: 'F-1' }, { id: 'F-2' }, { id: 'F-3' }],
      detections: [],
      verdictsByFinding: { 'F-1': { verdict: 'violation' }, 'F-3': { verdict: 'compliant' } },
    });
    expect(post.body).toMatchObject({
      correlation: 'id',
      coverageMatrix: [
        { findingId: 'F-1', verdict: 'violation' },
        { findingId: 'F-2' },
        { findingId: 'F-3', verdict: 'compliant' },
      ],
    });
    expect(post.body.coverageMatrix).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ findingId: 'F-2', verdict: expect.anything() })]),
    );
  });

  it('reordered findings join by id under verdictsByFinding, never by position', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const post = await request(base, 'POST', SYNTH, {
      findings: [{ id: 'F-2' }, { id: 'F-1' }],
      detections: [],
      verdictsByFinding: { 'F-1': { verdict: 'violation' }, 'F-2': { verdict: 'compliant' } },
    });
    expect(post.body).toMatchObject({
      correlation: 'id',
      coverageMatrix: [
        { findingId: 'F-2', verdict: 'compliant' },
        { findingId: 'F-1', verdict: 'violation' },
      ],
    });
  });

  it('without verdictsByFinding the join input is empty and consumed verdicts are reported only in verdictSource', async () => {
    const { store } = setup();
    const { base } = await mount({ store });
    const put = await request(base, 'PUT', '/api/teams/white/roe', { text: OK_TEXT, actions: ACTIONS });
    const post = await request(base, 'POST', SYNTH, { findings: [{ id: 'F-1' }, { id: 'F-2' }], detections: [] });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({
      correlation: 'positional-fallback',
      verdictSource: {
        kind: 'ledger',
        missionId: 'latest',
        revision: put.body.revision,
        textHash: put.body.textHash,
        verdicts: [
          { actionIndex: 0, verdict: 'violation', roeRevision: put.body.revision, roeTextHash: put.body.textHash },
          { actionIndex: 1, roeRevision: put.body.revision, roeTextHash: put.body.textHash },
        ],
      },
      coverageMatrix: [{ findingId: 'F-1' }, { findingId: 'F-2' }],
    });
    expect(post.body.coverageMatrix).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ verdict: expect.anything() })]),
    );
  });
});
