/**
 * T3MP3ST Purple synthesis — the "dark purple" posture ledger (pure functions, no I/O).
 *
 * Purple is an orchestrator-level capability, NOT a spawnable operator archetype.
 * synthesize() correlates red findings ↔ blue detection coverage ↔ white verdicts
 * into a single ledger-record-shaped result: a coverage matrix, the unresolved
 * items, and the concrete next missions that close them.
 *
 * Correlation convention (v2): verdicts join to findings by FINDING ID via the
 * optional `verdictsByFinding` map — the verdict stored under key X always lands
 * on finding X, regardless of insertion order. When that map is absent the v1
 * positional join remains as a fallback (verdict i is the ROE verdict for the
 * action that surfaced finding i; verdicts beyond the finding list are ignored)
 * and the result declares it via `correlation: 'positional-fallback'`.
 */

import { detectionGaps, type DetectionGap, type RedFindingShape, type TelemetrySourceShape } from './blue.js';
import { roeAudit, type AuditedAction, type RoeSpec, type RoeVerdict } from './white.js';
import type { CoverageGap } from './blue/coverage.js';

/** One white verdict keyed by finding id — the v2 id-keyed correlation input. */
export interface PurpleVerdictByFinding {
  verdict: RoeVerdict['verdict'];
  rationale?: string;
}

/** How verdicts were joined to findings; declared on every synthesis result. */
export type PurpleCorrelationMode = 'id' | 'positional-fallback';

/** Residual-risk tier — same vocabulary as finding severity, not free prose. */
export type PurpleRiskTier = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DarkPurpleSynthesis {
  coverageMatrix: Array<{
    findingId: string;
    detection: 'none' | 'partial' | 'covered';
    verdict?: string;
    /** Present only when the joined verdict carried a rationale. */
    rationale?: string;
    /** Deterministic f(severity, detection coverage, verdict); see the RISK_TIER_* constants. */
    riskTier: PurpleRiskTier;
    residualRisk: string;
  }>;
  unresolved: string[];
  nextMissions: string[];
  /** 'id' when verdictsByFinding drove the join, 'positional-fallback' otherwise. */
  correlation: PurpleCorrelationMode;
}

// ── Residual-risk prose model ───────────────────────────────────────────────
// Single writer: prose is a pure derived rendering of the tier computed by
// residualRiskTier() below. Templates key STRICTLY on the tier — no branch on
// detection, verdict, or severity — so tier/prose contradiction is structurally
// impossible. {findingId}{subject} interpolate rendered data, not signal inputs.
// Tier-honest framing only: no template claims a specific detection or verdict
// fact, since e.g. tier high serves both no-detection and violation rows.
const RISK_PROSE_BY_TIER: Record<PurpleRiskTier, (findingId: string, subject: string) => string> = {
  critical: (id, s) => `critical residual risk — ${id}${s} sits at the top tier; do not declare the posture acceptable while this row is critical`,
  high: (id, s) => `high residual risk — ${id}${s} sits above appetite; do not declare the posture acceptable while this row is high`,
  medium: (id, s) => `medium residual risk — ${id}${s} sits at the middle tier; harden the open items on its matrix row before declaring the posture acceptable`,
  low: (id, s) => `low residual risk — ${id}${s} sits at a low tier; confirm its matrix row before declaring the posture acceptable`,
  info: (id, s) => `informational residual risk — ${id}${s} carries no tiered risk; track its matrix row only`,
};

// ── Residual-risk tier model ────────────────────────────────────────────────
// Deterministic f(severity, detection coverage, verdict), never prose:
//   1. Base tier from severity — critical=4, high=3, medium=2, low=1, info=0.
//   2. Detection 'none' bumps the tier one step up (an undetected finding is
//      one tier worse than its severity implies), capped at the top of the scale.
//   3. A 'violation' verdict floors the tier at high — a ROE violation never
//      carries low residual risk, even when fully detected.
// Missing or unknown severity falls back to MEDIUM (index 2): the honest
// default when the input never stated a severity, rather than guessing low.
const RISK_TIER_SCALE: readonly PurpleRiskTier[] = ['info', 'low', 'medium', 'high', 'critical'];
const RISK_TIER_BY_SEVERITY: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};
const RISK_TIER_DEFAULT_INDEX = 2; // medium — missing/unknown severity input
const RISK_TIER_NONE_DETECTION_BUMP = 1;
const RISK_TIER_VIOLATION_FLOOR = 3; // high

function residualRiskTier(
  severity: string | undefined,
  detection: DetectionGap['coverage'],
  verdict: string | undefined,
): PurpleRiskTier {
  const baseIndex = severity !== undefined && Object.prototype.hasOwnProperty.call(RISK_TIER_BY_SEVERITY, severity)
    ? RISK_TIER_BY_SEVERITY[severity]
    : RISK_TIER_DEFAULT_INDEX;
  let tierIndex = baseIndex;
  if (detection === 'none') tierIndex = Math.min(baseIndex + RISK_TIER_NONE_DETECTION_BUMP, RISK_TIER_SCALE.length - 1);
  if (verdict === 'violation') tierIndex = Math.max(tierIndex, RISK_TIER_VIOLATION_FLOOR);
  return RISK_TIER_SCALE[tierIndex];
}

/**
 * Correlate the three team outputs into the dark-purple posture ledger. A finding is
 * unresolved when detection coverage is absent or a white verdict flagged a
 * violation; every unresolved item gets a concrete follow-up mission.
 *
 * Verdict correlation: when `verdictsByFinding` is provided (an object, even an
 * empty one) it wins outright — each finding looks up its verdict by its own id
 * and the positional `verdicts` array is ignored, so map insertion order cannot
 * skew the join. Without it, the v1 positional join applies and the result says
 * so via `correlation: 'positional-fallback'`.
 */
export function synthesize(input: {
  findings: Array<{ id: string; title?: string; severity?: string }>;
  /**
   * Detection standings joined by finding id — DetectionGap rows from the
   * detection stage or CoverageGap rows from the artifact-bound coverage
   * stage. Only findingId and coverage are consumed; Purple is not a fifth
   * hat and never re-derives coverage, it only correlates standings by id.
   */
  detections: Array<DetectionGap | Pick<CoverageGap, 'findingId' | 'coverage'>>;
  verdicts: RoeVerdict[];
  verdictsByFinding?: Record<string, PurpleVerdictByFinding>;
}): DarkPurpleSynthesis {
  const coverageByFinding = new Map<string, DetectionGap['coverage']>();
  for (const gap of input.detections) coverageByFinding.set(gap.findingId, gap.coverage);

  const verdictById = input.verdictsByFinding && typeof input.verdictsByFinding === 'object'
    ? input.verdictsByFinding
    : undefined;

  const coverageMatrix = input.findings.map((finding, index) => {
    const detection = coverageByFinding.get(finding.id) || 'none';
    const joined = verdictById
      ? (Object.prototype.hasOwnProperty.call(verdictById, finding.id) ? verdictById[finding.id] : undefined)
      : input.verdicts[index];
    const verdict = joined?.verdict;
    const rationale = joined && 'rationale' in joined && joined.rationale ? joined.rationale : undefined;
    const subject = finding.title ? ` (${finding.title})` : '';
    const riskTier = residualRiskTier(finding.severity, detection, verdict);
    const residualRisk = RISK_PROSE_BY_TIER[riskTier](finding.id, subject);
    return rationale
      ? { findingId: finding.id, detection, verdict, rationale, riskTier, residualRisk }
      : { findingId: finding.id, detection, verdict, riskTier, residualRisk };
  });

  const unresolved: string[] = [];
  const nextMissions: string[] = [];

  for (const entry of coverageMatrix) {
    const finding = input.findings.find(f => f.id === entry.findingId);
    const severity = finding?.severity || 'medium';
    const subject = finding?.title ? ` (${finding.title})` : '';

    const isUnresolved = entry.detection === 'none' || entry.verdict === 'violation';
    if (isUnresolved) unresolved.push(entry.findingId);

    if (entry.detection === 'none') {
      nextMissions.push(
        severity === 'critical' || severity === 'high'
          ? `Detection engineering: build and verify a page-on-occur detector for ${entry.findingId}${subject} before any retest`
          : `Telemetry backlog: add detection coverage for ${entry.findingId}${subject}`,
      );
    }
    if (entry.verdict === 'violation') {
      nextMissions.push(`ROE remediation: review the violating action behind ${entry.findingId}${subject}, re-brief the operators, and record the corrective verdict`);
    }
    if (entry.verdict === 'needs_approval') {
      nextMissions.push(`Approval path: secure the outstanding receipt for the action behind ${entry.findingId}${subject} before retest`);
    }
  }

  nextMissions.push('Purple regression: retest remediated findings end-to-end and re-run the dark-purple coverage matrix');

  return {
    coverageMatrix,
    unresolved,
    nextMissions,
    correlation: verdictById ? 'id' : 'positional-fallback',
  };
}

// Re-exported so wave-2 server integration can mount the whole loop from one module.
export { detectionGaps, roeAudit };
export type { RedFindingShape, TelemetrySourceShape, AuditedAction, RoeSpec };
