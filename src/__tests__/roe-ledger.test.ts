import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditedAction } from '../teams/white.js';
import { parseRoe } from '../teams/white/roe-parser.js';
import {
  buildRevision,
  createRoeLedgerStore,
  fsBackend,
  getRevision,
  isValidRoeAction,
  latestRevision,
  listRevisions,
  memoryBackend,
  migrateLegacyLatest,
  parseLedger,
  parseMissionId,
  provenanceOf,
  redactionFidelity,
  serializeLine,
  type LedgerAppendResult,
  type LedgerRead,
  type MissionId,
  type RoeLedgerLine,
  type RoeLedgerStore,
} from '../teams/white/roe-ledger.js';

const ROE_TEXT = 'scope: example.com\nallow active: yes';
const RECORDED_AT = '2026-10-20T10:00:00.000Z';
const LEGACY_CREATED = '2026-10-01T00:00:00.000Z';
const LEGACY_UPDATED = '2026-10-02T00:00:00.000Z';
const SECRET = 'sk-abcdefghijklmnopqrstuvwxyz0123';

function asMission(raw: string): MissionId {
  const parsed = parseMissionId(raw);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.missionId;
}

const LATEST = asMission('latest');

function sha16(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}

async function revise(
  store: RoeLedgerStore,
  missionId: MissionId,
  text: string,
  actions: AuditedAction[] = [],
): Promise<LedgerAppendResult> {
  return store.append(missionId, (previous) =>
    buildRevision({ missionId, text, actions, previous, recordedAt: RECORDED_AT }),
  );
}

async function reviseOk(
  store: RoeLedgerStore,
  missionId: MissionId,
  text: string,
  actions: AuditedAction[] = [],
): Promise<RoeLedgerLine> {
  const result = await revise(store, missionId, text, actions);
  if (!result.ok) throw new Error(result.reason);
  return result.line;
}

function legacyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const actions = [{ command: 'ls', target: 'example.com' }];
  return {
    id: 'latest',
    revision: 4,
    textHash: sha16(ROE_TEXT),
    actionsHash: sha16(JSON.stringify(actions)),
    text: ROE_TEXT,
    actions,
    createdAt: LEGACY_CREATED,
    updatedAt: LEGACY_UPDATED,
    ...overrides,
  };
}

const first = buildRevision({ missionId: LATEST, text: ROE_TEXT, actions: [], previous: null, recordedAt: RECORDED_AT });
const second = buildRevision({ missionId: LATEST, text: ROE_TEXT, actions: [], previous: first, recordedAt: RECORDED_AT });
const third = buildRevision({ missionId: LATEST, text: ROE_TEXT, actions: [], previous: second, recordedAt: RECORDED_AT });

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'roe-ledger-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe('parseMissionId', () => {
  it('defaults an absent id to latest and accepts lowercase ids', () => {
    expect(parseMissionId(undefined)).toEqual({ ok: true, missionId: 'latest' });
    expect(parseMissionId('latest')).toEqual({ ok: true, missionId: 'latest' });
    expect(parseMissionId('mission-1')).toEqual({ ok: true, missionId: 'mission-1' });
    expect(parseMissionId('a-1_b')).toMatchObject({ ok: true, missionId: 'a-1_b' });
    expect(parseMissionId('a'.repeat(64))).toMatchObject({ ok: true });
    expect(parseMissionId('com0')).toMatchObject({ ok: true, missionId: 'com0' });
  });

  it('rejects uppercase ids so case-insensitive volumes cannot alias two missions', () => {
    expect(parseMissionId('LATEST').ok).toBe(false);
    expect(parseMissionId('Mission-1').ok).toBe(false);
  });

  it('rejects Windows reserved device names in any letter case', () => {
    for (const name of ['CON', 'nul', 'PRN', 'Aux', 'COM1', 'lpt9', 'com5']) {
      expect(parseMissionId(name)).toEqual({ ok: false, reason: 'missionId must not be a reserved device name' });
    }
  });

  it('rejects path segments, empty, over-long, leading-dash, and non-string ids', () => {
    for (const bad of ['../x', '', 'a'.repeat(65), '-a', 'a/b', null, 42, ['a']]) {
      expect(parseMissionId(bad).ok).toBe(false);
    }
  });
});

describe('isValidRoeAction', () => {
  it('accepts action objects and rejects anything else', () => {
    expect(isValidRoeAction({ command: 'ls', target: 'x', approved: true, scope: ['a'] })).toBe(true);
    expect(isValidRoeAction({})).toBe(true);
    expect(isValidRoeAction(null)).toBe(false);
    expect(isValidRoeAction(['ls'])).toBe(false);
    expect(isValidRoeAction({ command: 1 })).toBe(false);
    expect(isValidRoeAction({ scope: [1] })).toBe(false);
  });
});

describe('buildRevision', () => {
  it('starts at revision 1 and hashes the stored text and actions', () => {
    expect(first).toMatchObject({
      schemaVersion: 1,
      revision: 1,
      missionId: 'latest',
      textHash: sha16(ROE_TEXT),
      actionsHash: sha16('[]'),
      text: ROE_TEXT,
      parseOk: true,
      createdAt: RECORDED_AT,
      recordedAt: RECORDED_AT,
    });
    expect(first).not.toHaveProperty('provenance');
  });

  it('continues the revision and keeps createdAt from the previous line', () => {
    const later = buildRevision({
      missionId: LATEST,
      text: ROE_TEXT,
      actions: [],
      previous: first,
      recordedAt: '2026-10-21T00:00:00.000Z',
    });
    expect(later.revision).toBe(2);
    expect(later.createdAt).toBe(RECORDED_AT);
    expect(later.recordedAt).toBe('2026-10-21T00:00:00.000Z');
  });

  it('redacts secrets in text and actions before hashing them', () => {
    const text = `scope: example.com\nallow active: yes\n# key ${SECRET}`;
    const line = buildRevision({
      missionId: LATEST,
      text,
      actions: [{ command: `ls ${SECRET}`, target: 'example.com' }],
      previous: null,
      recordedAt: RECORDED_AT,
    });
    const redactedText = 'scope: example.com\nallow active: yes\n# key [redacted]';
    const redactedActions = [{ command: 'ls [redacted]', target: 'example.com' }];
    expect(line.text).toBe(redactedText);
    expect(line.textHash).toBe(sha16(redactedText));
    expect(line.actions).toEqual(redactedActions);
    expect(line.actionsHash).toBe(sha16(JSON.stringify(redactedActions)));
    expect(JSON.stringify(line)).not.toContain(SECRET);
  });

  it('stamps verdicts with the revision, text hash and resolved ROE lines', () => {
    const line = buildRevision({
      missionId: LATEST,
      text: ROE_TEXT,
      actions: [
        { command: 'ls', target: 'example.com' },
        { command: 'nmap -sV', target: 'example.com' },
      ],
      previous: null,
      recordedAt: RECORDED_AT,
    });
    const roeLines = parseRoe(ROE_TEXT).resolved.map((r) => r.line);
    expect(line.verdicts.map((v) => v.verdict)).toEqual(['compliant', 'needs_approval']);
    for (const verdict of line.verdicts) {
      expect(verdict).toMatchObject({ roeRevision: 1, roeTextHash: line.textHash, roeLines });
    }
  });

  it('records no verdicts when the ROE text does not parse', () => {
    const line = buildRevision({
      missionId: LATEST,
      text: 'nothing here',
      actions: [{ command: 'ls', target: 'example.com' }],
      previous: null,
      recordedAt: RECORDED_AT,
    });
    expect(line.parseOk).toBe(false);
    expect(line.verdicts).toEqual([]);
  });
});

describe('parseLedger', () => {
  it('reads an empty ledger and tolerates one trailing newline', () => {
    expect(parseLedger(LATEST, [])).toEqual({ ok: true, records: [] });
    expect(parseLedger(LATEST, [JSON.stringify(first), ''])).toEqual({ ok: true, records: [first] });
  });

  it.each([
    ['a blank middle line', [JSON.stringify(first), '', JSON.stringify(second), ''], 2, 'blank line'],
    ['a torn tail', [JSON.stringify(first), JSON.stringify(second).slice(0, 40)], 2, 'not valid JSON'],
    ['a revision gap', [JSON.stringify(first), JSON.stringify(third), ''], 2, 'revision must be 2'],
    [
      'a tampered text',
      [JSON.stringify(first), JSON.stringify({ ...second, text: 'scope: evil.com\nallow active: yes' }), ''],
      2,
      'textHash',
    ],
    ['a non-object line', [JSON.stringify(first), '[1,2]', ''], 2, 'not a JSON object'],
    ['a foreign mission', [JSON.stringify({ ...first, missionId: 'other' }), ''], 1, 'missionId'],
  ])('fails closed on %s and names line %i', (_label, lines, line, reason) => {
    expect(parseLedger(LATEST, lines)).toEqual({ ok: false, line, reason: expect.stringContaining(reason) });
  });

  it('accepts a provenance block only in the recorded shape', () => {
    const recorded = { ...first, provenance: { status: 'recorded', recordedAt: RECORDED_AT, source: 'api', recordedBy: null } };
    expect(parseLedger(LATEST, [JSON.stringify(recorded), ''])).toMatchObject({ ok: true });
    const malformed = { ...first, provenance: { status: 'unknown' } };
    expect(parseLedger(LATEST, [JSON.stringify(malformed), ''])).toMatchObject({
      ok: false,
      line: 1,
      reason: expect.stringContaining('provenance'),
    });
  });
});

describe('ledger store on the filesystem', () => {
  it('creates the file and appends exactly one line', async () => {
    const store = createRoeLedgerStore(fsBackend(dir));
    const line = await reviseOk(store, LATEST, ROE_TEXT);
    expect(line.revision).toBe(1);
    const content = readFileSync(join(dir, 'latest.jsonl'), 'utf8');
    expect(content.split('\n')).toHaveLength(2);
    expect(JSON.parse(content.split('\n')[0])).toMatchObject({ revision: 1 });
  });

  it('keeps the first line byte-identical after a second append', async () => {
    const store = createRoeLedgerStore(fsBackend(dir));
    await reviseOk(store, LATEST, ROE_TEXT);
    const before = readFileSync(join(dir, 'latest.jsonl'), 'utf8');
    const second = await reviseOk(store, LATEST, 'scope: other.com\nallow active: no');
    const after = readFileSync(join(dir, 'latest.jsonl'), 'utf8');
    expect(second.revision).toBe(2);
    expect(after.startsWith(before)).toBe(true);
    expect(after.split('\n')).toHaveLength(3);
  });

  it('numbers revisions contiguously', async () => {
    const store = createRoeLedgerStore(fsBackend(dir));
    await reviseOk(store, LATEST, ROE_TEXT);
    await reviseOk(store, LATEST, ROE_TEXT);
    await reviseOk(store, LATEST, ROE_TEXT);
    const read = await store.read(LATEST);
    if (!read || !read.ok) throw new Error('ledger must read back ok');
    expect(read.records.map((r) => r.revision)).toEqual([1, 2, 3]);
  });

  it('serializes 25 concurrent appends into revisions 1..25', async () => {
    const store = createRoeLedgerStore(fsBackend(dir));
    const results = await Promise.all(Array.from({ length: 25 }, () => revise(store, LATEST, ROE_TEXT)));
    const revisions = results.map((r) => (r.ok ? r.line.revision : -1)).sort((a, b) => a - b);
    expect(revisions).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
  });

  it('reports a missing file as null, not as an error, and creates nothing', async () => {
    const store = createRoeLedgerStore(fsBackend(dir));
    expect(await store.read(LATEST)).toBeNull();
    expect(existsSync(join(dir, 'latest.jsonl'))).toBe(false);
  });

  it('fails closed on a corrupt line for reads and writes and leaves the file untouched', async () => {
    const file = join(dir, 'latest.jsonl');
    writeFileSync(file, `${serializeLine(first)}not json\n${serializeLine(second)}`);
    const before = readFileSync(file, 'utf8');
    const store = createRoeLedgerStore(fsBackend(dir));
    expect(await store.read(LATEST)).toEqual({ ok: false, line: 2, reason: 'line is not valid JSON' });
    expect(await revise(store, LATEST, ROE_TEXT)).toEqual({ ok: false, line: 2, reason: 'line is not valid JSON' });
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('rejects when the backend fails with an I/O error instead of hiding it', async () => {
    mkdirSync(join(dir, 'latest.jsonl'));
    await expect(createRoeLedgerStore(fsBackend(dir)).read(LATEST)).rejects.toThrow();
  });

  it('stores redacted text and actions that read back with matching hashes', async () => {
    const store = createRoeLedgerStore(fsBackend(dir));
    const text = `scope: example.com\nallow active: yes\n# key ${SECRET}`;
    const line = await reviseOk(store, LATEST, text, [{ command: `ls ${SECRET}`, target: 'example.com' }]);
    expect(line.text).toBe('scope: example.com\nallow active: yes\n# key [redacted]');
    expect(readFileSync(join(dir, 'latest.jsonl'), 'utf8')).not.toContain(SECRET);
    expect(await store.read(LATEST)).toMatchObject({ ok: true, records: [{ revision: 1 }] });
  });
});

describe('ledger store in memory', () => {
  it('appends and reads back the same revisions', async () => {
    const store = createRoeLedgerStore(memoryBackend());
    await reviseOk(store, LATEST, ROE_TEXT);
    await reviseOk(store, LATEST, ROE_TEXT);
    expect(await store.read(LATEST)).toMatchObject({ ok: true, records: [{ revision: 1 }, { revision: 2 }] });
    expect(await createRoeLedgerStore(memoryBackend()).read(asMission('other'))).toBeNull();
  });
});

describe('legacy migration', () => {
  it('imports the legacy latest record once, keeping its revision and timestamps', async () => {
    const backend = fsBackend(dir);
    const store = createRoeLedgerStore(backend);
    expect(await migrateLegacyLatest(backend, [legacyRow()])).toBe('imported');
    const read = await store.read(LATEST);
    if (!read || !read.ok) throw new Error('migrated ledger must read back ok');
    const [migrated] = read.records;
    expect(migrated).toMatchObject({
      revision: 4,
      textHash: sha16(ROE_TEXT),
      createdAt: LEGACY_CREATED,
      recordedAt: LEGACY_UPDATED,
      parseOk: true,
    });
    expect(provenanceOf(migrated)).toEqual({ status: 'unknown' });
    expect((await reviseOk(store, LATEST, 'scope: other.com\nallow active: no')).revision).toBe(5);
  });

  it('appends nothing when the migration runs again', async () => {
    const backend = fsBackend(dir);
    expect(await migrateLegacyLatest(backend, [legacyRow()])).toBe('imported');
    const before = readFileSync(join(dir, 'latest.jsonl'), 'utf8');
    expect(await migrateLegacyLatest(backend, [legacyRow()])).toBe('already-present');
    expect(readFileSync(join(dir, 'latest.jsonl'), 'utf8')).toBe(before);
  });

  it('does not import a legacy row whose stored hash does not match, and warns without its text', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const backend = fsBackend(dir);
    expect(await migrateLegacyLatest(backend, [legacyRow({ textHash: '0000000000000000' })])).toBe('skipped-drift');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('do not match'));
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('scope:');
    expect(await createRoeLedgerStore(backend).read(LATEST)).toBeNull();
  });

  it('skips an invalid legacy row and reports no legacy record for other ids', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const backend = fsBackend(dir);
    expect(await migrateLegacyLatest(backend, [legacyRow({ revision: 0 })])).toBe('skipped-invalid');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await migrateLegacyLatest(backend, [legacyRow({ id: 'other' })])).toBe('no-legacy');
    expect(await migrateLegacyLatest(backend, undefined)).toBe('no-legacy');
  });
});

describe('ledger views', () => {
  it('lists, selects and summarises revisions', () => {
    const audited = buildRevision({
      missionId: LATEST,
      text: ROE_TEXT,
      actions: [
        { command: 'ls', target: 'example.com' },
        { command: 'nmap -sV', target: 'example.com' },
      ],
      previous: null,
      recordedAt: RECORDED_AT,
    });
    expect(listRevisions([audited])).toEqual([
      {
        revision: 1,
        textHash: audited.textHash,
        actionsHash: audited.actionsHash,
        recordedAt: RECORDED_AT,
        parseOk: true,
        verdictCounts: { compliant: 1, violation: 0, needs_approval: 1 },
        provenance: { status: 'unknown' },
      },
    ]);
    expect(getRevision([audited], 1)).toBe(audited);
    expect(getRevision([audited], 2)).toBeNull();
    expect(latestRevision([])).toBeNull();
    expect(latestRevision([first, audited])).toBe(audited);
  });
});

describe('fail-closed on torn tails, malformed verdicts and prototype keys', () => {
  const goodVerdict = {
    actionIndex: 0,
    verdict: 'compliant',
    rationale: 'passive action within the allowed scope',
    conditions: [],
    roeRevision: 1,
    roeTextHash: sha16(ROE_TEXT),
    roeLines: [1],
  };

  it('treats a last line with no trailing newline as a torn tail named by its line number', () => {
    expect(parseLedger(LATEST, [JSON.stringify(first)])).toEqual({
      ok: false,
      line: 1,
      reason: expect.stringContaining('torn tail'),
    });
    expect(parseLedger(LATEST, [JSON.stringify(first), JSON.stringify(second)])).toEqual({
      ok: false,
      line: 2,
      reason: expect.stringContaining('torn tail'),
    });
  });

  it('fails a store read on a torn tail and leaves the file bytes unchanged', async () => {
    const content = `${serializeLine(first)}${JSON.stringify(second)}`;
    writeFileSync(join(dir, 'latest.jsonl'), content);
    const store = createRoeLedgerStore(fsBackend(dir));
    expect(await store.read(LATEST)).toEqual({
      ok: false,
      line: 2,
      reason: expect.stringContaining('torn tail'),
    });
    expect(readFileSync(join(dir, 'latest.jsonl'), 'utf8')).toBe(content);
  });

  it('reports malformed stored verdicts as corrupt and never throws', () => {
    const malformed: unknown[] = [
      null,
      'compliant',
      { ...goodVerdict, verdict: 'constructor' },
      { ...goodVerdict, verdict: 'approved' },
      { ...goodVerdict, actionIndex: -1 },
      { ...goodVerdict, conditions: [1] },
      { ...goodVerdict, roeLines: [0] },
      { ...goodVerdict, roeTextHash: undefined },
    ];
    for (const verdict of malformed) {
      const raw = JSON.stringify({ ...first, verdicts: [verdict] });
      let read: LedgerRead | undefined;
      expect(() => {
        read = parseLedger(LATEST, [raw, '']);
      }).not.toThrow();
      expect(read).toEqual({
        ok: false,
        line: 1,
        reason: 'verdicts must be an array of stamped verdict objects',
      });
    }
  });

  it('accepts a line whose verdicts are well-formed stamped verdicts', () => {
    const line = { ...first, verdicts: [goodVerdict] };
    expect(parseLedger(LATEST, [JSON.stringify(line), ''])).toMatchObject({ ok: true, records: [{ revision: 1 }] });
  });

  it('refuses action objects with own __proto__, constructor or prototype keys', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const action = JSON.parse(`{"command":"ls","target":"example.com","${key}":{"x":1}}`);
      expect(isValidRoeAction(action)).toBe(false);
      const raw = JSON.stringify({ ...first, actions: [action] });
      expect(parseLedger(LATEST, [raw, ''])).toEqual({
        ok: false,
        line: 1,
        reason: 'actions must be an array of action objects',
      });
    }
  });
});

describe('appending to a file that does not end in a newline', () => {
  it('starts the new revision on its own line and keeps the existing bytes', async () => {
    const file = join(dir, 'latest.jsonl');
    const tail = serializeLine(first).slice(0, -1);
    writeFileSync(file, tail);
    await fsBackend(dir).appendLine(LATEST, serializeLine(second));
    const content = readFileSync(file, 'utf8');
    expect(content).toBe(`${tail}\n${serializeLine(second)}`);
    expect(parseLedger(LATEST, content.split('\n'))).toEqual({ ok: true, records: [first, second] });
  });

  it('adds no separator after a file that already ends in a newline, or into an empty file', async () => {
    const backend = fsBackend(dir);
    await backend.appendLine(LATEST, serializeLine(first));
    await backend.appendLine(LATEST, serializeLine(second));
    expect(readFileSync(join(dir, 'latest.jsonl'), 'utf8')).toBe(`${serializeLine(first)}${serializeLine(second)}`);
  });
});

describe('legacy migration into an existing but empty ledger file', () => {
  it('imports the legacy latest record into an empty latest.jsonl, which holds no revision yet', async () => {
    writeFileSync(join(dir, 'latest.jsonl'), '');
    const backend = fsBackend(dir);
    expect(await migrateLegacyLatest(backend, [legacyRow()])).toBe('imported');
    expect(await createRoeLedgerStore(backend).read(LATEST)).toMatchObject({
      ok: true,
      records: [{ revision: 4, createdAt: LEGACY_CREATED }],
    });
  });

  it('does not append after a file that holds only blank lines, and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const file = join(dir, 'latest.jsonl');
    writeFileSync(file, '\n  \n');
    expect(await migrateLegacyLatest(fsBackend(dir), [legacyRow()])).toBe('skipped-invalid');
    expect(readFileSync(file, 'utf8')).toBe('\n  \n');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only blank lines'));
  });
});

describe('redaction fidelity', () => {
  const HOST_A = `${'a'.repeat(40)}.example.com`;
  const HOST_B = `${'b'.repeat(40)}.example.com`;

  it('refuses a revision whose out-of-scope host redaction makes read as allowed, naming no value', () => {
    const result = redactionFidelity(`scope: ${HOST_A}\nallow active: no`, [{ command: 'curl x', target: HOST_B }]);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('action 0') });
    expect(JSON.stringify(result)).not.toContain('aaaa');
    expect(JSON.stringify(result)).not.toContain('bbbb');
  });

  it('accepts a secret-shaped host whose verdict redaction leaves unchanged', () => {
    expect(redactionFidelity(`scope: ${HOST_A}\nallow active: no`, [{ command: 'curl x', target: HOST_A }])).toEqual({ ok: true });
  });

  it('accepts ordinary hostnames and IPs in scope and out of scope', () => {
    const text = 'scope: app.example.com, 10.0.0.5, k8s-deploy-7f9c5d6b8a-x2k4p.internal.example.com\nallow active: no';
    const targets = ['app.example.com', '10.0.0.5', 'k8s-deploy-7f9c5d6b8a-q8w1z.internal.example.com', '192.168.1.9'];
    expect(redactionFidelity(text, targets.map((target) => ({ command: 'curl x', target })))).toEqual({ ok: true });
  });
});

describe('stored size of a revision', () => {
  it('keeps a revision under twice its request when the allowed list is long and every action is out of scope', () => {
    const targets = Array.from({ length: 1000 }, (_, i) => `host${String(i).padStart(4, '0')}.corp.example.net`);
    const text = `scope: ${targets.join(', ')}\nallow active: no`;
    const actions = Array.from({ length: 50 }, (_, i) => ({ command: 'curl', target: `out${i}.other.test` }));
    const line = buildRevision({ missionId: LATEST, text, actions, previous: null, recordedAt: RECORDED_AT });
    const request = Buffer.byteLength(text, 'utf8') + Buffer.byteLength(JSON.stringify(actions), 'utf8');
    expect(Buffer.byteLength(serializeLine(line), 'utf8')).toBeLessThan(2 * request);
  });
});
