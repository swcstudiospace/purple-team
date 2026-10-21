/**
 * T3MP3ST White ROE routes (phase 39): HTTP handlers over the append-only ROE
 * verdict ledger (teams/white/roe-ledger.ts). server.ts keeps the route
 * literals and registers these handlers; every emitted body is
 * redactSecrets-wrapped.
 *
 * Fail-closed doctrine: a corrupt ledger never yields a verdict. GET keeps its
 * always-200 cannot-derive report and names the corrupt line; the write and
 * history routes answer 409 so corruption is never hidden behind an empty list
 * or a silent append.
 */
import type { Request, Response } from 'express';
import { redactSecrets } from '../../redact.js';
import { roeAudit, type AuditedAction } from '../white.js';
import { parseRoe } from './roe-parser.js';
import {
  buildRevision,
  getRevision,
  isValidRoeAction,
  latestRevision,
  listRevisions,
  parseMissionId,
  type LedgerAppendResult,
  type LedgerRead,
  type MissionId,
  type RoeLedgerStore,
} from './roe-ledger.js';

/** Body cap for ROE text, in utf8 bytes. */
export const ROE_BODY_CAP_BYTES = 64 * 1024;

/** A positive decimal integer with no sign, leading zeros or exponent. */
const REVISION_PARAM_RE = /^[1-9][0-9]*$/;

export interface RoeRouteDeps {
  store: RoeLedgerStore;
  emitContractEvent: (type: string, payload: Record<string, unknown>) => void;
  recordReceipt: (binding: {
    runId: string;
    missionId: string;
    stage: string;
    tool: string;
    inputSha256: string;
    itemId: string;
  }) => unknown;
}

export interface RoeHandlers {
  putRoe: (req: Request, res: Response) => Promise<void>;
  getRoe: (req: Request, res: Response) => Promise<void>;
  getRoeRevisions: (req: Request, res: Response) => Promise<void>;
  getRoeRevision: (req: Request, res: Response) => Promise<void>;
}

/** The honest zeroed report for a mission with no usable ROE text. */
function cannotDerive(missionId: MissionId): Record<string, unknown> {
  return { ...parseRoe(''), summary: 'no ROE text on record', missionId };
}

/** Body for a corrupt ledger; `line` is the 1-based physical line that failed. */
function corruptBody(read: { line: number; reason: string }): Record<string, unknown> {
  return { error: `ROE ledger is corrupt at line ${read.line}`, line: read.line, reason: read.reason };
}

export function createRoeHandlers(deps: RoeRouteDeps): RoeHandlers {
  const { store, emitContractEvent, recordReceipt } = deps;

  /**
   * Read the mission ledger. Backend I/O errors resolve to 'unreadable' and are
   * logged with their message only; the caller decides the response.
   */
  async function loadLedger(missionId: MissionId): Promise<LedgerRead | null | 'unreadable'> {
    try {
      return await store.read(missionId);
    } catch (error) {
      console.warn(`[purple-team] ROE ledger read failed: ${error instanceof Error ? error.message : String(error)}`);
      return 'unreadable';
    }
  }

  // PUT /api/teams/white/roe — append one revision for the mission (default
  // `latest`). Body: { text, actions, missionId? }.
  async function putRoe(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = body.text;
    if (typeof text !== 'string' || text.length === 0) {
      res.status(400).json({ error: 'text must be a non-empty string' });
      return;
    }
    const rawActions = body.actions;
    if (!Array.isArray(rawActions) || !rawActions.every(isValidRoeAction)) {
      res.status(400).json({ error: 'actions must be an array of action objects' });
      return;
    }
    const actions = rawActions as AuditedAction[];
    const mission = parseMissionId(body.missionId);
    if (!mission.ok) {
      res.status(400).json({ error: mission.reason });
      return;
    }
    const missionId = mission.missionId;
    if (Buffer.byteLength(text, 'utf8') > ROE_BODY_CAP_BYTES) {
      res.status(413).json({ error: 'ROE text exceeds the 64 KiB cap' });
      return;
    }
    if (Buffer.byteLength(JSON.stringify(actions), 'utf8') > ROE_BODY_CAP_BYTES) {
      res.status(413).json({ error: 'ROE actions exceed the 64 KiB cap' });
      return;
    }
    let appended: LedgerAppendResult;
    try {
      appended = await store.append(missionId, (previous) =>
        buildRevision({ missionId, text, actions, previous, recordedAt: new Date().toISOString() }),
      );
    } catch (error) {
      console.warn(`[purple-team] ROE ledger append failed: ${error instanceof Error ? error.message : String(error)}`);
      res.status(503).json(redactSecrets({ error: 'ROE ledger write failed; nothing recorded' }));
      return;
    }
    if (!appended.ok) {
      res.status(409).json(redactSecrets(corruptBody(appended)));
      return;
    }
    const line = appended.line;
    emitContractEvent('white.roe.on-record', {
      missionId,
      revision: line.revision,
      textHash: line.textHash,
      actions: line.actions.length,
    });
    const parse = parseRoe(line.text);
    // A successful parseRoe is a real computation returning, so it mints one
    // observed receipt bound to the stored text. Parse failure mints nothing.
    if (parse.ok) {
      recordReceipt({
        runId: `roe-rev-${line.revision}`,
        missionId: 'roe-record',
        stage: 'parse',
        tool: 'parseRoe',
        inputSha256: line.textHash,
        itemId: missionId,
      });
    }
    res.json(redactSecrets({
      revision: line.revision,
      textHash: line.textHash,
      missionId,
      ok: parse.ok,
      summary: parse.summary,
    }));
  }

  // GET /api/teams/white/roe — parse of the newest revision's text, plus
  // roeAudit verdicts when and only when that parse is ok:true.
  async function getRoe(req: Request, res: Response): Promise<void> {
    const mission = parseMissionId(req.query.missionId);
    if (!mission.ok) {
      res.status(400).json(redactSecrets({ error: mission.reason }));
      return;
    }
    const missionId = mission.missionId;
    const read = await loadLedger(missionId);
    if (read === 'unreadable') {
      res.json(redactSecrets({ ...cannotDerive(missionId), ledger: { status: 'unreadable' } }));
      return;
    }
    if (read === null) {
      res.json(redactSecrets(cannotDerive(missionId)));
      return;
    }
    if (!read.ok) {
      res.json(redactSecrets({ ...cannotDerive(missionId), ledger: { status: 'corrupt', line: read.line, reason: read.reason } }));
      return;
    }
    const latest = latestRevision(read.records);
    if (latest === null) {
      res.json(redactSecrets(cannotDerive(missionId)));
      return;
    }
    const parse = parseRoe(latest.text);
    const provenance = { revision: latest.revision, textHash: latest.textHash, recordedAt: latest.recordedAt };
    if (!parse.ok) {
      res.json(redactSecrets({ ...parse, missionId, provenance }));
      return;
    }
    const resolvedLines = parse.resolved.map((r) => r.line);
    const verdicts = roeAudit(latest.actions, parse.roe).map((v) => ({
      ...v,
      roeRevision: latest.revision,
      roeTextHash: latest.textHash,
      roeLines: resolvedLines,
    }));
    res.json(redactSecrets({ ...parse, missionId, provenance, verdicts }));
  }

  // GET /api/teams/white/roe/revisions — history summary, oldest first.
  async function getRoeRevisions(req: Request, res: Response): Promise<void> {
    const mission = parseMissionId(req.query.missionId);
    if (!mission.ok) {
      res.status(400).json(redactSecrets({ error: mission.reason }));
      return;
    }
    const missionId = mission.missionId;
    const read = await loadLedger(missionId);
    if (read === 'unreadable') {
      res.status(503).json(redactSecrets({ error: 'ROE ledger is unreadable' }));
      return;
    }
    if (read === null) {
      res.json(redactSecrets({ missionId, revisions: [] }));
      return;
    }
    if (!read.ok) {
      res.status(409).json(redactSecrets(corruptBody(read)));
      return;
    }
    res.json(redactSecrets({ missionId, revisions: listRevisions(read.records) }));
  }

  // GET /api/teams/white/roe/revisions/:revision — one full revision record.
  async function getRoeRevision(req: Request, res: Response): Promise<void> {
    const rawRevision = req.params.revision;
    if (!REVISION_PARAM_RE.test(rawRevision) || !Number.isSafeInteger(Number(rawRevision))) {
      res.status(400).json({ error: 'revision must be a positive integer' });
      return;
    }
    const revision = Number(rawRevision);
    const mission = parseMissionId(req.query.missionId);
    if (!mission.ok) {
      res.status(400).json(redactSecrets({ error: mission.reason }));
      return;
    }
    const missionId = mission.missionId;
    const read = await loadLedger(missionId);
    if (read === 'unreadable') {
      res.status(503).json(redactSecrets({ error: 'ROE ledger is unreadable' }));
      return;
    }
    if (read === null) {
      res.status(404).json(redactSecrets({ error: 'no ROE ledger for mission', missionId }));
      return;
    }
    if (!read.ok) {
      res.status(409).json(redactSecrets(corruptBody(read)));
      return;
    }
    const line = getRevision(read.records, revision);
    if (line === null) {
      res.status(404).json(redactSecrets({ error: 'unknown ROE revision', missionId, revision }));
      return;
    }
    res.json(redactSecrets(line));
  }

  return { putRoe, getRoe, getRoeRevisions, getRoeRevision };
}
