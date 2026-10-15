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
// Wave-1 staged workflow exports the six specialists delegate to. Hats add
// specialist framing only; standing, pairing, and aggregation verdicts come
// from these modules, never from wrapper-local heuristics.
import { runBlackWorkflow } from './black/workflow.js';
import { exfilCostModel, type RouteEvidence } from './black/exfil.js';
import { runBlueDetectionStage, runBlueRetestStage } from './blue/workflow.js';
import { pairDisputeRulings, aggregateEvidenceStanding, type PairedDisputeRuling, type AggregateStanding } from './white/workflow.js';

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
const SPECTER_TOOLS = ['host', 'subfinder', 'dnsx', 'waybackurls', 'wafw00f', 'attack-navigator', 'attack-flow', 'cover-story', 'noise-vocabulary', 'ja3-catalog', 'beacon-cadence', 'stealth-route-pack'] as const;
const WRAITH_TOOLS = ['host', 'amass', 'dnsx', 'curl', 'httpx', 'caldera', 'dns-tunnel-model', 'egress-ledger', 'channel-cost-table', 'opsec-checklist-pack', 'callback-budget', 'exfil-path-pack'] as const;
const SENTINEL_TOOLS = ['file', 'yara', 'strings', 'semgrep', 'dig', 'whois', 'sigma', 'd3fend', 'atomic-red-team', 'osquery', 'suricata', 'velociraptor', 'gitleaks', 'trufflehog', 'checksec', 'openssl'] as const;
const WARDEN_TOOLS = ['file', 'exiftool', 'openssl', 'gitleaks', 'trivy', 'grype', 'osv-scanner', 'checkov', 'syft', 'semgrep', 'checksec', 'slither', 'solhint', 'mobsfscan', 'apkleaks', 'jadx'] as const;
const ARBITER_TOOLS = ['file', 'strings', 'openssl', 'gitleaks', 'dig', 'whois', 'nist-800-115', 'ptes', 'osstmm', 'owasp-asvs', 'owasp-wstg', 'cis-controls', 'cwe', 'cvss'] as const;
const AUDITOR_TOOLS = ['file', 'yara', 'exiftool', 'strings', 'binwalk', 'openssl', 'radare2', 'objdump', 'readelf', 'jadx', 'ghidra', 'checksec', 'nist-csf', 'mitre-atlas'] as const;

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
  const staged = runBlackWorkflow({ actions, egress: plan.egress });
  const realismFlags: string[] = [];
  if (staged.outcome === 'insufficient') {
    realismFlags.push('insufficient: empty plan — no actions supplied, nothing to analyze and no bill of health');
  }
  if (staged.outcome === 'refused') {
    realismFlags.push(`refused boundary: ${staged.reason} — zero effects, see the authorized alternative`);
  }
  for (const action of actions) {
    if (STAGED_CLAIM_PATTERN.test(action)) {
      realismFlags.push(`staged-looking claim: "${action}" — tradecraft claims need tool-grade evidence to read as real`);
    }
    if (DESTRUCTIVE_PATTERN.test(action)) {
      realismFlags.push(`destructive tradecraft refused: "${action}" — awareness-only review, never destructive`);
    }
  }
  const leakCount = reviews.reduce((n, r) => n + r.leaks.length, 0);
  const blownByEvidence = realismFlags.some(f => f.includes('destructive'))
    || noise.score < 40
    || (actions.length > 0 && leakCount >= actions.length * 2);
  const verdict = blownByEvidence
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
  /**
   * Route standing from exfilCostModel(): declared/modeled/unverified for
   * strings, verified only with observed route evidence for the same path id.
   */
  standing: 'declared' | 'modeled' | 'unverified' | 'verified';
  /** Evidence id that verified this route, if any. */
  routeEvidenceId?: string;
  /**
   * True only when standing is verified by observed route evidence. A
   * nonempty egress string declares a route; it never verifies one.
   */
  egressVerified: boolean;
}

export interface WraithExfilSim {
  paths: WraithPathSim[];
  /** Whole-run noise scoring over the simulated channels. */
  budget: NoiseBudgetResult;
  totalVolumeMb: number;
}


/**
 * Simulate exfil paths as analysis, never as bulk execution. Costs, tiers,
 * feasibility, and route standing come from exfilCostModel(): each path
 * becomes ledger arithmetic with an ATT&CK technique, and noiseBudget()
 * scores the whole run so simulated channels spend detection surface like
 * real ones would. A string declares a route; only observed route evidence
 * for the same path id verifies it.
 */
export function wraithExfilSim(input: { paths: ExfilPathShape[]; egress?: string[]; routeEvidence?: RouteEvidence[] }): WraithExfilSim {
  const paths = input.paths || [];
  const egress = input.egress || [];
  const budget = noiseBudget({
    actions: paths.map(p => `simulated exfil ${p.channel || p.id} volume ${p.volumeMb ?? 0}MB`),
    egress,
  });
  const report = exfilCostModel({ paths, egress, routeEvidence: input.routeEvidence });
  const sims: WraithPathSim[] = report.paths.map(costed => ({
    pathId: costed.pathId,
    feasible: costed.feasible,
    noiseCost: costed.tier,
    pressureNotes: [...costed.notes],
    standing: costed.standing,
    ...(costed.routeEvidenceId ? { routeEvidenceId: costed.routeEvidenceId } : {}),
    egressVerified: costed.standing === 'verified',
  }));
  return { paths: sims, budget, totalVolumeMb: report.totalVolumeMb };
}

// ── Sentinel: detection engineering ───────────────────────────────────────────

export interface SentinelDetectorMap {
  /** Coverage decision per finding (reuses the blue-team function). */
  gaps: DetectionGap[];
  /** Concrete detector recommendations as text artifacts, one per uncovered/partial finding. */
  detectorRecommendations: string[];
  /** Finding ids ordered by detection-gap priority (critical first). */
  gapPriority: string[];
  /**
   * Stage standing when the caller binds artifacts: complete only with
   * artifact ids plus bytes read; otherwise insufficient-evidence. Absent
   * when no stage binding was supplied (id/tech overlap alone is not coverage).
   */
  detectionStatus?: 'complete' | 'insufficient-evidence' | 'unavailable';
  /** Stage limitations (id-only overlap, missing artifacts), if any. */
  limitations?: string[];
}

/** Artifact binding that routes sentinel through the staged detection workflow. */
export interface SentinelStageBinding {
  runId: string;
  missionId: string;
  family: string;
  artifactIds: string[];
  artifactBytes: string;
}

const SENTINEL_PRIORITY: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };

/**
 * Map findings to telemetry via detectionGaps(), then write one detector
 * recommendation per uncovered/partial finding and order the gaps by severity.
 * When the caller supplies an artifact stage binding, gaps come from
 * runBlueDetectionStage() instead: supplied artifacts plus evidence yield
 * covered, id-only overlap yields partial with a limitation, and missing
 * artifacts fail closed as insufficient-evidence, never covered.
 */
export function sentinelDetectorMap(
  findings: RedFindingShape[],
  telemetry?: TelemetrySourceShape[],
  stage?: SentinelStageBinding,
): SentinelDetectorMap {
  const staged = stage
    ? runBlueDetectionStage({ ...stage, findings, telemetry })
    : undefined;
  const gaps = staged ? [...staged.gaps] : detectionGaps(findings, telemetry);
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
  return staged
    ? { gaps, detectorRecommendations, gapPriority, detectionStatus: staged.status, limitations: [...staged.limitations] }
    : { gaps, detectorRecommendations, gapPriority };
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
 * and an explicit misconfiguration call-out list. Fresh items start open with
 * no linked evidence; when the caller supplies item-linked evidence, each
 * linked item resolves through runBlueRetestStage() — a prose checklist
 * sentence alone stays insufficient-evidence, never successful-retest.
 */
export function wardenHardeningReview(
  findings: RedFindingShape[],
  retest?: { runId: string; missionId: string; links: Array<{ itemIndex: number; baselineEvidenceIds: string[]; retestEvidenceIds: string[]; retestPassed: boolean }> },
): WardenHardeningReview {
  let items = hardeningPlan(findings);
  if (retest) {
    items = items.map((item, index) => {
      const link = retest.links.find(l => l.itemIndex === index);
      if (!link) return item;
      return runBlueRetestStage({
        runId: retest.runId,
        missionId: retest.missionId,
        item,
        baselineEvidenceIds: link.baselineEvidenceIds,
        retestEvidenceIds: link.retestEvidenceIds,
        retestPassed: link.retestPassed,
      }).item;
    });
  }
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
  /** One ruling per disputed action: both positions, the verdict, pairing status, and the appeal path. */
  resolutions: Array<{ actionIndex: number; redPosition?: string; bluePosition?: string; ruling: RoeVerdict['verdict']; status: PairedDisputeRuling['status']; rationale: string; appealPath: string }>;
}

/**
 * Adjudicate actions via roeAudit(), then pair opposed claims per action via
 * pairDisputeRulings(): the ROE text decides, both positions stay on the
 * record, a missing side is insufficiency (never a one-sided record), and
 * every ruling names the evidence or receipt that would overturn it.
 */
export function arbiterDispute(input: { actions: AuditedAction[]; roe: RoeSpec; claims?: DisputeClaim[] }): ArbiterDisputeResolution {
  const verdicts = roeAudit(input.actions, input.roe);
  const verdictByIndex: Record<number, RoeVerdict> = {};
  for (const v of verdicts) verdictByIndex[v.actionIndex] = v;
  const paired = pairDisputeRulings(input.claims || [], verdicts);
  const resolutions = paired.map(ruling => {
    const verdict = verdictByIndex[ruling.actionIndex];
    const decided = verdict ? verdict.verdict : 'needs_approval';
    const rationale = verdict
      ? `dispute on action ${ruling.actionIndex} settled against the ROE text: ${verdict.rationale}${ruling.status === 'paired' ? '' : ' — held as insufficiency until both positions are on record'}`
      : `dispute on action ${ruling.actionIndex} has no audited action — held as needs_approval until the action is submitted for audit`;
    return {
      actionIndex: ruling.actionIndex,
      ...(ruling.redPosition !== undefined ? { redPosition: ruling.redPosition } : {}),
      ...(ruling.bluePosition !== undefined ? { bluePosition: ruling.bluePosition } : {}),
      ruling: decided,
      status: ruling.status,
      rationale,
      appealPath: ruling.appealPath,
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
  /**
   * Honest aggregate standing from aggregateEvidenceStanding(): sufficient
   * only when every finding is report-ready on intact chain links. Any
   * insufficient, missing, broken, or one-sided row withholds sufficiency.
   */
  standing: AggregateStanding;
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
 * (accepted entries weigh 25 points each toward 100). Standing comes from
 * aggregateEvidenceStanding(): any insufficient row withholds sufficiency and
 * caps the score below 100, so a mixed ledger can never claim a perfect score.
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
  const acceptedIds = new Set(scores.filter(s => s.accepted).map(s => s.entryId));
  const standing = aggregateEvidenceStanding(
    scores.map(s => ({
      id: s.entryId,
      title: s.entryId,
      severity: 'medium' as const,
      evidenceIds: [s.entryId],
      recommendedFix: acceptedIds.has(s.entryId)
        ? `Fix the pattern entry "${s.entryId}" demonstrates, then re-run its retest criterion`
        : undefined,
      acceptanceCriteria: acceptedIds.has(s.entryId) ? [s.retestCriterion] : undefined,
    })),
    entries,
    { requiredFindingIds: scores.map(s => s.entryId) },
  );
  const score = insufficient > 0
    ? Math.min(99, accepted * 25)
    : Math.min(100, accepted * 25);
  return { verdicts, scores, aggregate: { accepted, insufficient, score }, standing };
}

// ── Phase 28 re-exports ─────────────────────────────────────────────────────
// The staged workflow exports the six specialists delegate to, re-exported so
// Phase 28 server/MCP integration can mount the whole loop from the hats
// module without adding HTTP or MCP forwarding here.
export {
  runBlackWorkflow,
  exfilCostModel,
  runBlueDetectionStage,
  runBlueRetestStage,
  pairDisputeRulings,
  aggregateEvidenceStanding,
};
export type { RouteEvidence, PairedDisputeRuling, AggregateStanding };
