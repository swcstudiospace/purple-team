/**
 * T3MP3ST Purple synthesize routes (phase 40): HTTP handlers for the dark-purple posture
 * synthesis (teams/purple.ts synthesize). server.ts keeps the route literals and registers
 * these handlers; every emitted body is redactSecrets-wrapped.
 *
 * Verdict source: when a request omits `verdicts`, the verdicts of the latest revision of the
 * ROE ledger for `missionId` (default `latest`) are consumed. They are ordered by action index,
 * while synthesize() joins by finding position, so consumed verdicts never enter the positional
 * join. They join findings ONLY through `verdictsByFinding` (id-keyed). Without it the join input
 * is empty and the consumed verdicts are reported in `verdictSource`. When a request supplies a
 * `verdicts` array, that array is the positional join input, unchanged. Nothing is fabricated: no
 * revision, or an unparsed latest revision, gives zero verdicts with kind `none`.
 */
import type { Request, Response } from 'express';
import { redactSecrets } from '../redact.js';
import type { DetectionGap } from './blue.js';
import { synthesize, type DarkPurpleSynthesis, type PurpleVerdictByFinding } from './purple.js';
import {
  latestRevision,
  parseMissionId,
  type LedgerRead,
  type MissionId,
  type RoeLedgerStore,
  type StampedVerdict,
} from './white/roe-ledger.js';
import type { RoeVerdict } from './white.js';

/** Where the verdicts of one synthesis came from. */
export type VerdictSource =
  | { kind: 'ledger'; missionId: string; revision: number; textHash: string; verdicts: StampedVerdict[] }
  | { kind: 'request'; reason?: string }
  | { kind: 'none'; missionId: string; reason: 'no-ledger' | 'parse-not-ok' };

/** The latest synthesis, one slot, persisted through state.json. */
export interface PurpleSynthesisRecord {
  id: string;
  createdAt: string;
  correlation: DarkPurpleSynthesis['correlation'];
  synthesis: DarkPurpleSynthesis;
  /** Absent on records written before phase 40; read as a request-supplied legacy source. */
  verdictSource?: VerdictSource;
}

/** Records written before verdictSource existed came from the explicit route, which required verdicts. */
const LEGACY_VERDICT_SOURCE: VerdictSource = {
  kind: 'request',
  reason: 'recorded before verdictSource existed; verdicts were request-supplied',
};

export type ConsumeResult =
  | { ok: true; verdictSource: VerdictSource }
  | { ok: false; line: number; reason: string };

function noVerdicts(missionId: MissionId, reason: 'no-ledger' | 'parse-not-ok'): ConsumeResult {
  return { ok: true, verdictSource: { kind: 'none', missionId, reason } };
}

/**
 * The verdict source of the latest ledger revision for a mission: its verdicts, stamped with
 * that revision, and the revision identity. `read` is the ledger store result: null when no
 * ledger file exists. A corrupt ledger is a failure, never verdicts. Pure.
 */
export function consumeLedgerVerdicts(read: LedgerRead | null, missionId: MissionId): ConsumeResult {
  if (read === null) return noVerdicts(missionId, 'no-ledger');
  if (!read.ok) return { ok: false, line: read.line, reason: read.reason };
  const latest = latestRevision(read.records);
  if (latest === null) return noVerdicts(missionId, 'no-ledger');
  if (!latest.parseOk) return noVerdicts(missionId, 'parse-not-ok');
  return {
    ok: true,
    verdictSource: {
      kind: 'ledger',
      missionId,
      revision: latest.revision,
      textHash: latest.textHash,
      verdicts: latest.verdicts.map((verdict) => ({
        ...verdict,
        roeRevision: latest.revision,
        roeTextHash: latest.textHash,
      })),
    },
  };
}

export interface PurpleSynthesizeDeps {
  /** Read access to the ROE ledger only. */
  store: Pick<RoeLedgerStore, 'read'>;
  /** Read-only view of the findings ledger, merged into findings by id. Never mutated here. */
  findings: ReadonlyMap<string, { title?: string; severity?: string }>;
  purpleSyntheses: Map<string, PurpleSynthesisRecord>;
  emitContractEvent: (type: string, payload: Record<string, unknown>) => void;
  nowIso: () => string;
}

export interface PurpleSynthesizeHandlers {
  getSynthesis: (req: Request, res: Response) => void;
  postSynthesis: (req: Request, res: Response) => Promise<void>;
}

export function createPurpleSynthesizeHandlers(deps: PurpleSynthesizeDeps): PurpleSynthesizeHandlers {
  const { store, findings, purpleSyntheses, emitContractEvent, nowIso } = deps;

  // GET /api/teams/purple/synthesize — the latest synthesis plus its verdict source.
  function getSynthesis(_req: Request, res: Response): void {
    const latest = purpleSyntheses.get('latest');
    if (!latest) {
      res.json({ synthesis: null });
      return;
    }
    res.json(redactSecrets({
      synthesis: latest.synthesis,
      createdAt: latest.createdAt,
      correlation: latest.correlation,
      verdictSource: latest.verdictSource ?? LEGACY_VERDICT_SOURCE,
    }));
  }

  // POST /api/teams/purple/synthesize — correlate red findings, blue detection gaps and white
  // verdicts. Body: { findings, detections, verdicts?, verdictsByFinding?, missionId? }.
  async function synthesizeFromRequest(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const findingsInput = body.findings;
    const detections = body.detections;
    if (!Array.isArray(findingsInput) || !Array.isArray(detections)) {
      res.status(400).json({ error: 'findings and detections must each be an array' });
      return;
    }
    const rawVerdictsByFinding = body.verdictsByFinding;
    let verdictsByFinding: Record<string, PurpleVerdictByFinding> | undefined;
    if (rawVerdictsByFinding !== undefined && rawVerdictsByFinding !== null) {
      if (typeof rawVerdictsByFinding !== 'object' || Array.isArray(rawVerdictsByFinding)) {
        res.status(400).json({ error: 'verdictsByFinding must be an object of findingId → { verdict, rationale? }' });
        return;
      }
      const byFinding: Record<string, PurpleVerdictByFinding> = {};
      for (const [findingId, rawEntry] of Object.entries(rawVerdictsByFinding as Record<string, unknown>)) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
          res.status(400).json({ error: `verdictsByFinding[${findingId}] must be an object with a verdict` });
          return;
        }
        const entry = rawEntry as Record<string, unknown>;
        const verdict = entry.verdict;
        if (verdict !== 'compliant' && verdict !== 'violation' && verdict !== 'needs_approval') {
          res.status(400).json({ error: `verdictsByFinding[${findingId}].verdict must be one of: compliant, violation, needs_approval` });
          return;
        }
        byFinding[findingId] = typeof entry.rationale === 'string' && entry.rationale
          ? { verdict, rationale: entry.rationale }
          : { verdict };
      }
      verdictsByFinding = byFinding;
    }

    const rawVerdicts = body.verdicts;
    // The positional join input. Consumed ledger verdicts never enter it (see the module doc).
    let verdictInputs: RoeVerdict[];
    let verdictSource: VerdictSource;
    if (rawVerdicts === undefined) {
      const mission = parseMissionId(body.missionId);
      if (!mission.ok) {
        res.status(400).json({ error: mission.reason });
        return;
      }
      let read: LedgerRead | null;
      try {
        read = await store.read(mission.missionId);
      } catch (error) {
        console.warn(`[purple-team] ROE ledger read for synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
        res.status(503).json(redactSecrets({ error: 'ROE ledger is unreadable; no synthesis recorded' }));
        return;
      }
      const consumed = consumeLedgerVerdicts(read, mission.missionId);
      if (!consumed.ok) {
        res.status(409).json(redactSecrets({
          error: `ROE ledger is corrupt at line ${consumed.line}`,
          line: consumed.line,
          reason: consumed.reason,
        }));
        return;
      }
      verdictInputs = [];
      verdictSource = consumed.verdictSource;
    } else {
      if (!Array.isArray(rawVerdicts)) {
        res.status(400).json({ error: 'verdicts must be an array when present' });
        return;
      }
      verdictInputs = (rawVerdicts as unknown[]).filter(
        (raw): raw is RoeVerdict => Boolean(raw) && typeof raw === 'object',
      );
      verdictSource = { kind: 'request' };
    }

    const correlated = (findingsInput as unknown[])
      .filter((raw): raw is Record<string, unknown> => Boolean(raw) && typeof raw === 'object')
      .map((raw) => {
        const id = typeof raw.id === 'string' ? raw.id : '';
        const ledger = id ? findings.get(id) : undefined;
        return {
          id,
          title: typeof raw.title === 'string' && raw.title ? raw.title : ledger?.title,
          severity: typeof raw.severity === 'string' && raw.severity ? raw.severity : ledger?.severity,
        };
      })
      .filter((entry) => entry.id);
    const gapInputs = (detections as unknown[]).filter(
      (raw): raw is DetectionGap => Boolean(raw) && typeof raw === 'object',
    );
    const synthesis = synthesize({
      findings: correlated,
      detections: gapInputs,
      verdicts: verdictInputs,
      verdictsByFinding,
    });
    // Persist the LATEST synthesis through the existing snapshot machinery: one slot keyed
    // 'latest', overwritten per synthesis; emitContractEvent below schedules the debounced
    // full-snapshot write that flushes it to state.json.
    purpleSyntheses.set('latest', {
      id: 'latest',
      createdAt: nowIso(),
      correlation: synthesis.correlation,
      synthesis,
      verdictSource,
    });
    emitContractEvent('purple.synthesis', {
      findings: correlated.length,
      detections: gapInputs.length,
      verdicts: verdictInputs.length,
      correlation: synthesis.correlation,
      unresolved: synthesis.unresolved.length,
      nextMissions: synthesis.nextMissions.length,
    });
    res.status(201).json(redactSecrets({ ...synthesis, verdictSource }));
  }

  // Express 4 does not catch a rejected async handler, so an unexpected failure is answered here.
  async function postSynthesis(req: Request, res: Response): Promise<void> {
    try {
      await synthesizeFromRequest(req, res);
    } catch (error) {
      console.warn(`[purple-team] purple synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent) {
        res.status(500).json(redactSecrets({ error: 'purple synthesis failed; nothing recorded' }));
      }
    }
  }

  return { getSynthesis, postSynthesis };
}
