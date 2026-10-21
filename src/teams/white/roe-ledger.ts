/**
 * T3MP3ST White — ROE verdict ledger: append-only JSONL revision history per mission.
 *
 * Storage: one file per mission at `<dir>/<missionId>.jsonl`, one JSON object per line.
 * Lines are only ever appended. Revisions are contiguous from the first line in the file.
 * Text and actions are redacted BEFORE they are hashed, so every stored hash matches the
 * stored content and a later read can recompute it.
 *
 * Failure policy: validation, corruption and missing data are returned as results.
 * Backend I/O errors are thrown. A corrupt line fails reads and writes for its mission
 * closed; it is never skipped.
 *
 * Only this module and its backends touch the filesystem. Pure helpers take values.
 */

import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactSecrets, redactString } from '../../redact.js';
import { roeAudit, type AuditedAction, type RoeVerdict } from '../white.js';
import { parseRoe } from './roe-parser.js';

/** Directory name under the state root that holds the per-mission ledger files. */
export const ROE_LEDGER_DIR = 'roe-ledger';

/** Mission used when a request does not name one (the single-slot scope of phase 28 and earlier). */
export const DEFAULT_MISSION_ID = 'latest';

/** Accepted mission id shape: lowercase only, so case-insensitive volumes cannot map two ids onto one file. Mission ids become file names, so this regex is the path-safety gate. */
export const MISSION_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** Windows reserved device names. A file named after one is a device on Windows, so these ids are refused in any case. */
const RESERVED_DEVICE_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A mission id that passed parseMissionId. Backends accept only this type. */
export type MissionId = string & { readonly __brand: 'MissionId' };

export type MissionIdParse = { ok: true; missionId: MissionId } | { ok: false; reason: string };

/** Validate a caller-supplied mission id. `undefined` means the default mission. Never throws. */
export function parseMissionId(raw: unknown): MissionIdParse {
  if (raw === undefined) return { ok: true, missionId: DEFAULT_MISSION_ID as MissionId };
  if (typeof raw !== 'string') return { ok: false, reason: 'missionId must be a string' };
  if (RESERVED_DEVICE_NAME_RE.test(raw)) {
    return { ok: false, reason: 'missionId must not be a reserved device name' };
  }
  if (!MISSION_ID_RE.test(raw)) {
    return { ok: false, reason: 'missionId must match ^[a-z0-9][a-z0-9_-]{0,63}$' };
  }
  return { ok: true, missionId: raw as MissionId };
}

/** Provenance recorded on a revision. Phase 39 writes none; phase 40 writes this shape. */
export interface RecordedProvenance {
  status: 'recorded';
  recordedAt: string;
  source: 'api';
  recordedBy: string | null;
}

/** Revisions written before provenance existed read as `unknown`. */
export type Provenance = { status: 'unknown' } | RecordedProvenance;

/** A roeAudit verdict stamped with the revision and text it was derived from. */
export interface StampedVerdict extends RoeVerdict {
  roeRevision: number;
  roeTextHash: string;
  roeLines: number[];
}

/** One physical line of a mission ledger file (schemaVersion 1). */
export interface RoeLedgerLine {
  schemaVersion: 1;
  revision: number;
  missionId: string;
  textHash: string;
  actionsHash: string;
  text: string;
  actions: AuditedAction[];
  parseOk: boolean;
  verdicts: StampedVerdict[];
  createdAt: string;
  recordedAt: string;
  provenance?: RecordedProvenance;
}

export interface BuildRevisionInput {
  missionId: MissionId;
  text: string;
  actions: AuditedAction[];
  previous: RoeLedgerLine | null;
  recordedAt: string;
  provenance?: RecordedProvenance;
}

/** Whether a value is a plain JSON object (not null, not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Hash used for textHash and actionsHash: sha256 hex, first 16 characters. */
function hashHex16(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Own keys that a plain-object copy (redaction, spread) does not reproduce faithfully. An action
 * carrying one is refused so the saved action is exactly the redacted one that was hashed.
 */
const FORBIDDEN_ACTION_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/** Validates one action object from a request or a stored line. Moved from server.ts. */
export function isValidRoeAction(a: unknown): a is AuditedAction {
  if (!isPlainObject(a)) return false;
  for (const key of FORBIDDEN_ACTION_KEYS) {
    if (Object.hasOwn(a, key)) return false;
  }
  if (a.command !== undefined && typeof a.command !== 'string') return false;
  if (a.target !== undefined && typeof a.target !== 'string') return false;
  if (a.approved !== undefined && typeof a.approved !== 'boolean') return false;
  if (a.scope !== undefined && (!Array.isArray(a.scope) || a.scope.some((s) => typeof s !== 'string'))) return false;
  return true;
}

/** Parse the (already redacted) text and audit the (already redacted) actions. */
function deriveVerdicts(
  text: string,
  actions: AuditedAction[],
  revision: number,
  textHash: string,
): { parseOk: boolean; verdicts: StampedVerdict[] } {
  const parse = parseRoe(text);
  if (!parse.ok) return { parseOk: false, verdicts: [] };
  const roeLines = parse.resolved.map((r) => r.line);
  const verdicts = roeAudit(actions, parse.roe).map((v): StampedVerdict => ({
    ...v,
    roeRevision: revision,
    roeTextHash: textHash,
    roeLines,
  }));
  return { parseOk: true, verdicts };
}

/**
 * Build the next revision for a mission. Redacts text and actions first, then hashes and
 * audits the redacted values, so the persisted text is the hashed text. Pure.
 */
export function buildRevision(input: BuildRevisionInput): RoeLedgerLine {
  const text = redactString(input.text);
  const actions = redactSecrets(input.actions) as AuditedAction[];
  const revision = input.previous ? input.previous.revision + 1 : 1;
  const textHash = hashHex16(text);
  const actionsHash = hashHex16(JSON.stringify(actions));
  const { parseOk, verdicts } = deriveVerdicts(text, actions, revision, textHash);
  return {
    schemaVersion: 1,
    revision,
    missionId: input.missionId,
    textHash,
    actionsHash,
    text,
    actions,
    parseOk,
    verdicts,
    createdAt: input.previous?.createdAt ?? input.recordedAt,
    recordedAt: input.recordedAt,
    ...(input.provenance ? { provenance: input.provenance } : {}),
  };
}

/** One ledger line as stored: JSON followed by a newline. */
export function serializeLine(line: RoeLedgerLine): string {
  return `${JSON.stringify(line)}\n`;
}

export type LedgerRead =
  | { ok: true; records: RoeLedgerLine[] }
  | { ok: false; line: number; reason: string };

type LineCheck = { ok: true; line: RoeLedgerLine } | { ok: false; reason: string };

function isRecordedProvenance(value: unknown): value is RecordedProvenance {
  return (
    isPlainObject(value) &&
    value.status === 'recorded' &&
    typeof value.recordedAt === 'string' &&
    value.source === 'api' &&
    (value.recordedBy === null || typeof value.recordedBy === 'string')
  );
}

/** The verdict vocabulary roeAudit emits. listRevisions indexes its counts by this value. */
const VERDICT_KINDS: readonly string[] = ['compliant', 'violation', 'needs_approval'];

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Whether a stored verdict has the StampedVerdict shape. Anything else makes its line corrupt. */
function isStampedVerdict(value: unknown): value is StampedVerdict {
  return (
    isPlainObject(value) &&
    typeof value.verdict === 'string' &&
    VERDICT_KINDS.includes(value.verdict) &&
    isNonNegativeSafeInteger(value.actionIndex) &&
    typeof value.rationale === 'string' &&
    Array.isArray(value.conditions) &&
    value.conditions.every((condition) => typeof condition === 'string') &&
    isPositiveSafeInteger(value.roeRevision) &&
    typeof value.roeTextHash === 'string' &&
    Array.isArray(value.roeLines) &&
    value.roeLines.every(isPositiveSafeInteger)
  );
}

/** Applies validation rules 1 to 8 to one physical line. */
function checkLine(missionId: string, raw: string, previousRevision: number | null): LineCheck {
  const fail = (reason: string): LineCheck => ({ ok: false, reason });
  if (raw.trim() === '') return fail('blank line is not allowed');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('line is not valid JSON');
  }
  if (!isPlainObject(value)) return fail('line is not a JSON object');
  if (value.schemaVersion !== 1) return fail('schemaVersion must be 1');
  if (value.missionId !== missionId) return fail("missionId does not match the ledger's mission");
  if (!isPositiveSafeInteger(value.revision)) return fail('revision must be a positive safe integer');
  if (previousRevision !== null && value.revision !== previousRevision + 1) {
    return fail(`revision must be ${previousRevision + 1} to continue the ledger`);
  }
  if (typeof value.text !== 'string') return fail('text must be a string');
  if (!Array.isArray(value.actions) || !value.actions.every(isValidRoeAction)) {
    return fail('actions must be an array of action objects');
  }
  if (value.textHash !== hashHex16(value.text)) return fail('textHash does not match the stored text');
  if (value.actionsHash !== hashHex16(JSON.stringify(value.actions))) {
    return fail('actionsHash does not match the stored actions');
  }
  if (typeof value.parseOk !== 'boolean') return fail('parseOk must be a boolean');
  if (!Array.isArray(value.verdicts) || !value.verdicts.every(isStampedVerdict)) {
    return fail('verdicts must be an array of stamped verdict objects');
  }
  if (typeof value.createdAt !== 'string' || typeof value.recordedAt !== 'string') {
    return fail('createdAt and recordedAt must be strings');
  }
  if (value.provenance !== undefined && !isRecordedProvenance(value.provenance)) {
    return fail('provenance must be a recorded provenance object when present');
  }
  // Every field was checked above; the double cast only names the validated shape.
  return { ok: true, line: value as unknown as RoeLedgerLine };
}

/**
 * Parse the physical lines of one mission ledger. The first failing rule wins and is reported
 * with its 1-based line number; no line after a corrupt one is returned. Every line must end in a
 * newline: a final element that is not empty is a torn tail and fails closed on its own line
 * number, so no separator is added silently. Pure.
 */
export function parseLedger(missionId: MissionId, lines: string[]): LedgerRead {
  const terminated = lines.length === 0 || lines[lines.length - 1] === '';
  const body = terminated ? lines.slice(0, -1) : lines;
  const records: RoeLedgerLine[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const previousRevision = records.at(-1)?.revision ?? null;
    const check = checkLine(missionId, body[index], previousRevision);
    if (!check.ok) return { ok: false, line: index + 1, reason: check.reason };
    if (!terminated && index === body.length - 1) {
      return { ok: false, line: index + 1, reason: 'last line has no trailing newline (torn tail)' };
    }
    records.push(check.line);
  }
  return { ok: true, records };
}

export type LegacyImport =
  | { ok: true; line: RoeLedgerLine }
  | { ok: false; kind: 'invalid' | 'drift'; reason: string };

/**
 * Convert one legacy state.json roeRecords row into a ledger line. The row's stored hashes must
 * match its stored text and actions (hashes are computed over redacted values since phase 39);
 * a mismatch is `drift` and the row is not imported. Verdicts are re-derived, not copied.
 */
export function importLegacyRecord(row: unknown): LegacyImport {
  const invalid = (reason: string): LegacyImport => ({ ok: false, kind: 'invalid', reason });
  if (!isPlainObject(row)) return invalid('legacy row is not an object');
  if (!isPositiveSafeInteger(row.revision)) return invalid('legacy revision is not a positive safe integer');
  if (typeof row.text !== 'string') return invalid('legacy text is not a string');
  if (!Array.isArray(row.actions) || !row.actions.every(isValidRoeAction)) {
    return invalid('legacy actions are not an array of action objects');
  }
  if (typeof row.textHash !== 'string' || typeof row.actionsHash !== 'string') {
    return invalid('legacy hashes are not strings');
  }
  if (typeof row.createdAt !== 'string' || typeof row.updatedAt !== 'string') {
    return invalid('legacy timestamps are not strings');
  }
  const actions = row.actions as AuditedAction[];
  if (hashHex16(row.text) !== row.textHash || hashHex16(JSON.stringify(actions)) !== row.actionsHash) {
    return { ok: false, kind: 'drift', reason: 'legacy stored hashes do not match the stored text or actions' };
  }
  if (redactString(row.text) !== row.text || JSON.stringify(redactSecrets(actions)) !== JSON.stringify(actions)) {
    return invalid('legacy text or actions are not redacted');
  }
  const { parseOk, verdicts } = deriveVerdicts(row.text, actions, row.revision, row.textHash);
  return {
    ok: true,
    line: {
      schemaVersion: 1,
      revision: row.revision,
      missionId: DEFAULT_MISSION_ID,
      textHash: row.textHash,
      actionsHash: row.actionsHash,
      text: row.text,
      actions,
      parseOk,
      verdicts,
      createdAt: row.createdAt,
      recordedAt: row.updatedAt,
    },
  };
}

export type LegacyMigrationOutcome =
  | 'imported'
  | 'already-present'
  | 'no-legacy'
  | 'skipped-invalid'
  | 'skipped-drift';

/**
 * Import the legacy `latest` record (rows = state.json roeRecords) into the ledger, once.
 * Runs only when the `latest` ledger file does not exist yet, so a second run appends nothing.
 * A skipped row logs a warning with its reason only.
 */
export async function migrateLegacyLatest(backend: RoeLedgerBackend, rows: unknown): Promise<LegacyMigrationOutcome> {
  const row = Array.isArray(rows)
    ? rows.find((candidate: unknown): boolean => isPlainObject(candidate) && candidate.id === DEFAULT_MISSION_ID)
    : undefined;
  if (row === undefined) return 'no-legacy';
  const latest = DEFAULT_MISSION_ID as MissionId;
  if ((await backend.readLines(latest)) !== null) return 'already-present';
  const imported = importLegacyRecord(row);
  if (!imported.ok) {
    console.warn(`[purple-team] ROE ledger migration skipped the legacy latest record: ${imported.reason}`);
    return imported.kind === 'drift' ? 'skipped-drift' : 'skipped-invalid';
  }
  await backend.appendLine(latest, serializeLine(imported.line));
  return 'imported';
}

/** Provenance of a revision. A line without provenance reads as `unknown`. */
export function provenanceOf(line: RoeLedgerLine): Provenance {
  return line.provenance ?? { status: 'unknown' };
}

export interface RoeLedgerBackend {
  /** Physical lines of the mission file, or null when the file does not exist. */
  readLines(missionId: MissionId): Promise<string[] | null>;
  /** Append one already-serialized line (JSON plus newline). Never rewrites earlier bytes. */
  appendLine(missionId: MissionId, line: string): Promise<void>;
}

/** File-backed ledger under `dir`, one `<missionId>.jsonl` per mission. */
export function fsBackend(dir: string): RoeLedgerBackend {
  return {
    async readLines(missionId) {
      try {
        return (await readFile(join(dir, `${missionId}.jsonl`), 'utf8')).split('\n');
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    },
    async appendLine(missionId, line) {
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, `${missionId}.jsonl`), line, 'utf8');
    },
  };
}

/** In-process ledger for the memory state mode. Same semantics as fsBackend, lost on exit. */
export function memoryBackend(): RoeLedgerBackend {
  const files = new Map<MissionId, string>();
  return {
    async readLines(missionId) {
      const content = files.get(missionId);
      return content === undefined ? null : content.split('\n');
    },
    async appendLine(missionId, line) {
      files.set(missionId, (files.get(missionId) ?? '') + line);
    },
  };
}

export type LedgerAppendResult =
  | { ok: true; line: RoeLedgerLine }
  | { ok: false; line: number; reason: string };

export interface RoeLedgerStore {
  /** The mission's ledger, `null` when no ledger file exists. Backend I/O errors reject. */
  read(missionId: MissionId): Promise<LedgerRead | null>;
  /**
   * Build the next line from the current latest record and append it. `build` receives null for
   * the first revision. A corrupt ledger returns ok:false and appends nothing.
   */
  append(
    missionId: MissionId,
    build: (previous: RoeLedgerLine | null) => RoeLedgerLine,
  ): Promise<LedgerAppendResult>;
}

/**
 * Serialize all reads and writes per mission on a promise chain, so two appends cannot compute the
 * same revision and a read cannot observe a half-written line. A failed task does not poison later
 * ones; its own caller still receives the rejection.
 */
export function createRoeLedgerStore(backend: RoeLedgerBackend): RoeLedgerStore {
  const tails = new Map<MissionId, Promise<void>>();

  function queue<T>(missionId: MissionId, task: () => Promise<T>): Promise<T> {
    const run = (tails.get(missionId) ?? Promise.resolve()).then(task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    tails.set(missionId, tail);
    void tail.then(() => {
      if (tails.get(missionId) === tail) tails.delete(missionId);
    });
    return run;
  }

  return {
    read(missionId) {
      return queue(missionId, async (): Promise<LedgerRead | null> => {
        const lines = await backend.readLines(missionId);
        return lines === null ? null : parseLedger(missionId, lines);
      });
    },
    append(missionId, build) {
      return queue(missionId, async (): Promise<LedgerAppendResult> => {
        const lines = await backend.readLines(missionId);
        const current = parseLedger(missionId, lines ?? []);
        if (!current.ok) return current;
        const line = build(current.records.at(-1) ?? null);
        await backend.appendLine(missionId, serializeLine(line));
        return { ok: true, line };
      });
    },
  };
}

/** The newest revision, or null for an empty ledger. */
export function latestRevision(records: readonly RoeLedgerLine[]): RoeLedgerLine | null {
  return records.at(-1) ?? null;
}

/** One revision by number, or null when the ledger has no such revision. */
export function getRevision(records: readonly RoeLedgerLine[], revision: number): RoeLedgerLine | null {
  return records.find((line) => line.revision === revision) ?? null;
}

export interface RevisionSummary {
  revision: number;
  textHash: string;
  actionsHash: string;
  recordedAt: string;
  parseOk: boolean;
  verdictCounts: { compliant: number; violation: number; needs_approval: number };
  provenance: Provenance;
}

/** History summary for every revision, oldest first. */
export function listRevisions(records: readonly RoeLedgerLine[]): RevisionSummary[] {
  return records.map((line): RevisionSummary => {
    const verdictCounts = { compliant: 0, violation: 0, needs_approval: 0 };
    for (const verdict of line.verdicts) verdictCounts[verdict.verdict] += 1;
    return {
      revision: line.revision,
      textHash: line.textHash,
      actionsHash: line.actionsHash,
      recordedAt: line.recordedAt,
      parseOk: line.parseOk,
      verdictCounts,
      provenance: provenanceOf(line),
    };
  });
}
