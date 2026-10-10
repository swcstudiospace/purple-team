/**
 * T3MP3ST Specialized Team Hats — specter/wraith (black), sentinel/warden (blue),
 * arbiter/auditor (white). Pure functions, no I/O.
 *
 * Each hat is a subset-disciplined slice of its parent team: hatToolGrants(hat)
 * only ever returns ids its parent team's teamToolGrants() already grants, so
 * black hats stay disjoint from blue/white exactly like the black team itself.
 * Per-hat behaviors reuse the parent-team functions where honest (cover/noise
 * scoring from black, detection/hardening from blue, ROE/evidence verdicts from
 * white) and add only the hat's own deterministic layer on top.
 */

import { noiseBudget, coverAudit, type NoiseBudgetResult, type CoverAuditResult } from './black.js';
import { detectionGaps, hardeningPlan, type DetectionGap, type RedFindingShape, type TelemetrySourceShape, type HardeningItem } from './blue.js';
import { roeAudit, adjudicateEvidence, type AuditedAction, type RoeSpec, type RoeVerdict, type EvidenceEntryShape, type EvidenceVerdict } from './white.js';

/** The six spawnable specialist hats. */
export type HatArchetype = 'specter' | 'wraith' | 'sentinel' | 'warden' | 'arbiter' | 'auditor';

/** The spawnable hats, in doctrine order (black → blue → white). */
export const HAT_ARCHETYPES: readonly ['specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor'] = [
  'specter',
  'wraith',
  'sentinel',
  'warden',
  'arbiter',
  'auditor',
] as const;

/** Which parent team each hat specializes. */
export const hatTeam: Record<HatArchetype, 'black' | 'blue' | 'white'> = {
  specter: 'black',
  wraith: 'black',
  sentinel: 'blue',
  warden: 'blue',
  arbiter: 'white',
  auditor: 'white',
};

// Grant slices — every id must already be granted to the hat's parent team
// (see src/teams/index.ts BLACK_TOOLS / BLUE_TOOLS / WHITE_TOOLS). Subsets only;
// never invent an id here, and never take one from another team.
// Black slices stay disjoint from blue/white because the black set itself is.
const SPECTER_TOOLS = ['host', 'subfinder', 'dnsx', 'waybackurls', 'wafw00f'] as const;
const WRAITH_TOOLS = ['host', 'amass', 'dnsx', 'curl', 'httpx'] as const;
const SENTINEL_TOOLS = ['file', 'yara', 'strings', 'semgrep', 'dig', 'whois'] as const;
const WARDEN_TOOLS = ['file', 'exiftool', 'openssl', 'gitleaks', 'trivy', 'grype', 'osv-scanner', 'checkov'] as const;
const ARBITER_TOOLS = ['file', 'strings', 'openssl', 'gitleaks', 'dig', 'whois'] as const;
const AUDITOR_TOOLS = ['file', 'yara', 'exiftool', 'strings', 'binwalk', 'openssl'] as const;

/**
 * Tool grants per hat. Unknown hats throw — grants only exist for the six
 * spawnable hats, mirroring teamToolGrants() for the three parent teams.
 */
export function hatToolGrants(hat: HatArchetype): string[] {
  switch (hat) {
    case 'specter': return [...SPECTER_TOOLS];
    case 'wraith': return [...WRAITH_TOOLS];
    case 'sentinel': return [...SENTINEL_TOOLS];
    case 'warden': return [...WARDEN_TOOLS];
    case 'arbiter': return [...ARBITER_TOOLS];
    case 'auditor': return [...AUDITOR_TOOLS];
    default:
      throw new Error(`hatToolGrants: "${hat}" is not a hat archetype (expected one of ${HAT_ARCHETYPES.join(', ')})`);
  }
}

// ── Specter: covert tradecraft review ─────────────────────────────────────────

export interface SpecterReview {
  /** Per-action cover assessments, in plan order. */
  reviews: CoverAuditResult[];
  /** Whole-plan noise scoring. */
  noise: NoiseBudgetResult;
  /** Realism flags an adversary's counterintelligence would raise. */
  realismFlags: string[];
  /** Overall tradecraft verdict. */
  verdict: 'holds' | 'fragile' | 'blown';
}

/** Claims that read as staged unless backed by tool-grade evidence. */
const STAGED_CLAIM_PATTERN = /zero-?day|0day|undetectable|unpatchable|nation-?state|apt\b/i;
/** Destructive tradecraft has no place in an awareness-only review. */
const DESTRUCTIVE_PATTERN = /rm\s+-rf|wiper|ransomware|drop\s+table|delete\s+from|format\s+\w:|dd\s+if=/i;

/**
 * Critique a red plan from the adversary's eyes: per-action cover via
 * coverAudit(), whole-plan noise via noiseBudget(), plus deterministic realism
 * flags. Awareness-only — every flag is something to report, never to erase.
 */
export function specterCoverReview(plan: { actions: string[]; egress?: string[] }): SpecterReview {
  const actions = plan.actions || [];
  const reviews = actions.map(command => coverAudit({ command }));
  const noise = noiseBudget({ actions, egress: plan.egress });
  const realismFlags: string[] = [];
  for (const action of actions) {
    if (STAGED_CLAIM_PATTERN.test(action)) {
      realismFlags.push(`staged-looking claim: "${action}" — tradecraft claims need tool-grade evidence to read as real`);
    }
    if (DESTRUCTIVE_PATTERN.test(action)) {
      realismFlags.push(`destructive tradecraft refused: "${action}" — awareness-only review, never destructive`);
    }
  }
  const leakCount = reviews.reduce((n, r) => n + r.leaks.length, 0);
  const verdict = realismFlags.some(f => f.includes('destructive')) || noise.score < 40 || leakCount >= actions.length * 2
    ? 'blown'
    : noise.violations.length > 0 || leakCount > 0 || realismFlags.length > 0
      ? 'fragile'
      : 'holds';
  return { reviews, noise, realismFlags, verdict };
}

// ── Wraith: exfil simulation + opsec pressure ─────────────────────────────────

export interface ExfilPathShape {
  id: string;
  /** Exfil channel, e.g. "api-pagination", "dns-tunnel", "cloud-storage-put". */
  channel?: string;
  /** Estimated volume in megabytes. */
  volumeMb?: number;
  /** Whether the channel encrypts in transit. */
  encrypted?: boolean;
}

export interface WraithPathSim {
  pathId: string;
  /** Whether the path is analyzable inside the noise budget. */
  feasible: boolean;
  noiseCost: 'low' | 'medium' | 'high';
  /** Deterministic pressure notes (controls that should fire, gaps exposed). */
  pressureNotes: string[];
  /** Whether the path stays on the declared egress route. */
  egressVerified: boolean;
}

export interface WraithExfilSim {
  paths: WraithPathSim[];
  /** Whole-run noise scoring over the simulated channels. */
  budget: NoiseBudgetResult;
  totalVolumeMb: number;
}

const TUNNEL_PATTERN = /dns|icmp|tunnel|covert/i;

/**
 * Simulate exfil paths as analysis, never as bulk execution. Reuses
 * noiseBudget() for enforcement: each path becomes a ledger action and the
 * simulated channels spend detection surface like real ones would.
 */
export function wraithExfilSim(input: { paths: ExfilPathShape[]; egress?: string[] }): WraithExfilSim {
  const paths = input.paths || [];
  const egress = input.egress || [];
  const budget = noiseBudget({
    actions: paths.map(p => `simulated exfil ${p.channel || p.id} volume ${p.volumeMb ?? 0}MB`),
    egress,
  });
  let totalVolumeMb = 0;
  const sims: WraithPathSim[] = paths.map(p => {
    const volumeMb = p.volumeMb ?? 0;
    totalVolumeMb += volumeMb;
    const pressureNotes: string[] = [];
    if (!p.encrypted) pressureNotes.push(`unencrypted channel on "${p.id}" — DLP and egress inspection should catch this in cleartext`);
    if (volumeMb > 100) pressureNotes.push(`bulk volume on "${p.id}" (${volumeMb}MB) — anomaly detection should fire before completion`);
    if (p.channel && TUNNEL_PATTERN.test(p.channel)) pressureNotes.push(`tunneling-shaped channel on "${p.id}" — DNS/ICMP inspection gap if no telemetry covers it`);
    if (egress.length === 0) pressureNotes.push(`no egress routing declared for "${p.id}" — path would egress uncontrolled`);
    const noiseCost = volumeMb > 100 || (p.channel && TUNNEL_PATTERN.test(p.channel)) ? 'high' : !p.encrypted ? 'medium' : 'low';
    return {
      pathId: p.id,
      feasible: egress.length > 0 && noiseCost !== 'high',
      noiseCost,
      pressureNotes,
      egressVerified: egress.length > 0,
    };
  });
  return { paths: sims, budget, totalVolumeMb };
}

// ── Sentinel: detection engineering ───────────────────────────────────────────

export interface SentinelDetectorMap {
  /** Coverage decision per finding (reuses the blue-team function). */
  gaps: DetectionGap[];
  /** Concrete detector recommendations as text artifacts, one per uncovered/partial finding. */
  detectorRecommendations: string[];
  /** Finding ids ordered by detection-gap priority (critical first). */
  gapPriority: string[];
}

const SENTINEL_PRIORITY: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };

/**
 * Map findings to telemetry via detectionGaps(), then write one detector
 * recommendation per uncovered/partial finding and order the gaps by severity.
 */
export function sentinelDetectorMap(
  findings: RedFindingShape[],
  telemetry?: TelemetrySourceShape[],
): SentinelDetectorMap {
  const gaps = detectionGaps(findings, telemetry);
  const severityOf = (id: string): string => {
    const found = findings.find(f => f.id === id);
    return found && found.severity && SENTINEL_PRIORITY[found.severity] ? found.severity : 'medium';
  };
  const detectorRecommendations = gaps
    .filter(g => g.coverage !== 'covered')
    .map(g => {
      const severity = severityOf(g.findingId);
      const subject = findings.find(f => f.id === g.findingId)?.title || g.findingId;
      return `Detector (${severity}) for ${g.findingId} ("${subject}"): fire on the stored evidence pattern at ${g.coverage === 'none' ? 'a newly-deployed SIEM rule' : 'the existing telemetry with a closing alert'}; prove it with a replay of the red evidence — ${g.recommendedControl}`;
    });
  const gapPriority = gaps
    .filter(g => g.coverage !== 'covered')
    .map(g => g.findingId)
    .sort((a, b) => (SENTINEL_PRIORITY[severityOf(a)] ?? 3) - (SENTINEL_PRIORITY[severityOf(b)] ?? 3));
  return { gaps, detectorRecommendations, gapPriority };
}

// ── Warden: hardening audit ───────────────────────────────────────────────────

export interface WardenHardeningReview {
  /** Severity-tiered hardening work items (reuses the blue-team function). */
  items: HardeningItem[];
  /** Exact retest per work item proving the fix worked. */
  verificationChecklist: string[];
  /** Findings whose titles read as misconfigurations, called out explicitly. */
  misconfigurations: string[];
}

const MISCONFIG_PATTERN = /misconfig|default (credential|password|account)|open (bucket|share|admin)|missing header|permissive|unencrypted|exposed/i;

/**
 * Audit hardening via hardeningPlan(), plus a per-item verification checklist
 * and an explicit misconfiguration call-out list.
 */
export function wardenHardeningReview(findings: RedFindingShape[]): WardenHardeningReview {
  const items = hardeningPlan(findings);
  const verificationChecklist = items.map(
    item => `Retest priority-${item.priority} control (${item.findingIds.join(', ')}): replay the red evidence against the hardened surface and confirm the exploited pattern no longer reproduces — ${item.control}`,
  );
  const misconfigurations = findings
    .filter(f => (f.title && MISCONFIG_PATTERN.test(f.title)) || (f.severity === 'medium' && f.title))
    .filter(f => f.title && MISCONFIG_PATTERN.test(f.title))
    .map(f => `${f.id}: "${f.title}" — configuration review target, verify the control not just the patch`);
  return { items, verificationChecklist, misconfigurations };
}

// ── Arbiter: ROE adjudication + dispute resolution ────────────────────────────

export interface DisputeClaim {
  /** Which side advances the position. */
  side: 'red' | 'blue';
  /** One-line position, e.g. "scan was approved under receipt R-12". */
  position: string;
  /** Index of the disputed action in the audited action list. */
  actionIndex: number;
}

export interface ArbiterDisputeResolution {
  /** Binding per-action verdicts (reuses the white-team audit). */
  verdicts: RoeVerdict[];
  /** Per-dispute ruling with both positions, the verdict, and the appeal path. */
  resolutions: Array<{ actionIndex: number; redPosition?: string; bluePosition?: string; ruling: RoeVerdict['verdict']; rationale: string; appealPath: string }>;
}

/**
 * Adjudicate actions via roeAudit(), then resolve each red↔blue dispute against
 * the verdict: the ROE text decides, both positions stay on the record, and
 * every ruling names the evidence or receipt that would overturn it.
 */
export function arbiterDispute(input: { actions: AuditedAction[]; roe: RoeSpec; claims?: DisputeClaim[] }): ArbiterDisputeResolution {
  const verdicts = roeAudit(input.actions, input.roe);
  const verdictByIndex: Record<number, RoeVerdict> = {};
  for (const v of verdicts) verdictByIndex[v.actionIndex] = v;
  const resolutions = (input.claims || []).map(claim => {
    const verdict = verdictByIndex[claim.actionIndex];
    const ruling = verdict ? verdict.verdict : 'needs_approval';
    const rationale = verdict
      ? `dispute on action ${claim.actionIndex} settled against the ROE text: ${verdict.rationale}`
      : `dispute on action ${claim.actionIndex} has no audited action — held as needs_approval until the action is submitted for audit`;
    return {
      actionIndex: claim.actionIndex,
      redPosition: claim.side === 'red' ? claim.position : undefined,
      bluePosition: claim.side === 'blue' ? claim.position : undefined,
      ruling,
      rationale,
      appealPath: verdict && verdict.conditions.length > 0
        ? verdict.conditions.join('; ')
        : 'submit the action with its approval receipt for re-audit',
    };
  });
  return { verdicts, resolutions };
}

// ── Auditor: evidence review + scoring ────────────────────────────────────────

export type AuditorConfidence = 'high' | 'medium' | 'low' | 'very-low';

export interface AuditorFindingScore {
  entryId: string;
  /** Provenance-derived confidence label. */
  confidence: AuditorConfidence;
  /** Accepted entries carry a finding; weaker ones do not. */
  accepted: boolean;
  /** Exact retest proving the fix (accepted) or the recipe for sufficiency (insufficient). */
  retestCriterion: string;
}

export interface AuditorScore {
  /** Per-entry verdicts (reuses the white-team adjudication). */
  verdicts: EvidenceVerdict[];
  /** Per-entry confidence + scoring. */
  scores: AuditorFindingScore[];
  /** Aggregate: accepted count, insufficient count, 0-100 evidence-strength score. */
  aggregate: { accepted: number; insufficient: number; score: number };
}

const CONFIDENCE_BY_VERDICT_RANK: Record<string, AuditorConfidence> = {
  replayable: 'high',
  tool: 'medium',
  context: 'low',
  weak: 'very-low',
};

function confidenceOf(rationale: string): AuditorConfidence {
  const match = rationale.match(/provenance strength "(\w+)"/);
  if (match && CONFIDENCE_BY_VERDICT_RANK[match[1]]) return CONFIDENCE_BY_VERDICT_RANK[match[1]];
  return 'very-low';
}

/**
 * Review evidence via adjudicateEvidence(), label each entry with its
 * provenance-derived confidence, and aggregate an evidence-strength score
 * (accepted entries weigh 25 points each toward 100, capped).
 */
export function auditorScore(entries: EvidenceEntryShape[]): AuditorScore {
  const verdicts = adjudicateEvidence(entries);
  const scores: AuditorFindingScore[] = verdicts.map(v => {
    const confidence = confidenceOf(v.rationale);
    const accepted = v.verdict === 'accepted';
    return {
      entryId: v.entryId,
      confidence,
      accepted,
      retestCriterion: accepted
        ? `Replay entry "${v.entryId}" (${confidence} confidence): re-run the recorded commands against the fixed surface and attach the output proving the pattern no longer reproduces`
        : `Corroborate entry "${v.entryId}" (${confidence} confidence): attach tool output or a replayable receipt — ${v.rationale}`,
    };
  });
  const accepted = scores.filter(s => s.accepted).length;
  const insufficient = scores.length - accepted;
  return { verdicts, scores, aggregate: { accepted, insufficient, score: Math.min(100, accepted * 25) } };
}
