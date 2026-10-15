/**
 * T3MP3ST Blue Operator — defender-side detection & hardening (pure functions, no I/O).
 *
 * Doctrine: every red finding maps to a detection coverage decision (none / partial /
 * covered) and a concrete, prioritized control recommendation. These functions never
 * run offensive tooling — they score findings against telemetry descriptions.
 */

/** Coverage decision per red finding. */
export interface DetectionGap {
  findingId: string;
  coverage: 'none' | 'partial' | 'covered';
  recommendedControl: string;
}

export interface RedFindingShape {
  id: string;
  title?: string;
  severity?: string;
  evidence?: string[];
}

export interface TelemetrySourceShape {
  source: string;
  coveredIds?: string[];
}

/**
 * Observed artifact ids keyed by finding id. A finding is `covered` only when
 * its entry holds at least one observed artifact id: id membership in a
 * telemetry declaration is overlap, not proof. An omitted map (or an empty
 * entry) fails closed — overlap without an artifact caps at `partial`.
 */
export type ObservedArtifactIds = Readonly<Record<string, readonly string[]>>;

/** Concrete control recommendations per severity tier. */
const CONTROL_BY_SEVERITY: Record<string, string> = {
  critical: 'SIEM correlation rule with page-on-occur alerting across endpoint and identity telemetry, plus an emergency containment control for the affected service',
  high: 'High-priority SIEM detection rule on the affected service plus an access-control or patch control closing the exploited path',
  medium: 'Scheduled log-review rule plus a configuration-hardening control for the affected component',
  low: 'Telemetry retention improvement plus a low-cost hygiene control (headers, flags, version disclosure)',
  info: 'Telemetry retention improvement so future corroborating observations are kept for correlation',
};

function severityWord(severity: string | undefined): string {
  return severity && CONTROL_BY_SEVERITY[severity] ? severity : 'medium';
}

/**
 * Decide detection coverage per finding. Telemetry sources list the finding ids they
 * cover, but id membership alone is only overlap: `covered` additionally requires
 * an observed artifact id for that finding (see ObservedArtifactIds). Overlap
 * without an artifact is `partial` with a limitation; telemetry that exists but
 * does not overlap the id is `partial`; no telemetry at all is `none`. A
 * recommendation string never upgrades coverage — it is output, not input.
 */
export function detectionGaps(
  findings: RedFindingShape[],
  telemetry?: TelemetrySourceShape[],
  observed?: ObservedArtifactIds,
): DetectionGap[] {
  const coveredIds = new Set<string>();
  for (const source of telemetry || []) {
    for (const id of source.coveredIds || []) coveredIds.add(id);
  }
  const hasTelemetry = (telemetry || []).length > 0;

  return findings.map(finding => {
    const severity = severityWord(finding.severity);
    const subject = finding.title ? `"${finding.title}"` : finding.id;
    const observedIds = observed?.[finding.id] || [];
    const hasObservedArtifact = observedIds.length > 0;
    if (coveredIds.has(finding.id)) {
      if (hasObservedArtifact) {
        return {
          findingId: finding.id,
          coverage: 'covered' as const,
          recommendedControl: `Retain and regression-test the existing detection covering ${finding.id} (${subject}); replay the stored evidence against it quarterly`,
        };
      }
      return {
        findingId: finding.id,
        coverage: 'partial' as const,
        recommendedControl: `Extend existing telemetry to cover ${finding.id} (${subject}): add a ${severity}-priority detection rule on the sources already deployed and close the logged-but-not-alerted gap. Limitation: finding-id overlap alone is not coverage; supply an observed artifact id for ${finding.id} before calling it covered`,
      };
    }
    if (hasTelemetry) {
      return {
        findingId: finding.id,
        coverage: 'partial' as const,
        recommendedControl: `Extend existing telemetry to cover ${finding.id} (${subject}): add a ${severity}-priority detection rule on the sources already deployed and close the logged-but-not-alerted gap`,
      };
    }
    return {
      findingId: finding.id,
      coverage: 'none' as const,
      recommendedControl: `No telemetry covers ${finding.id} (${subject}): deploy ${severity}-severity logging on the affected surface, then add a ${severity}-priority SIEM rule — ${CONTROL_BY_SEVERITY[severity]}`,
    };
  });
}

/** Retest outcome for a hardening work item. Only item-linked baseline and
 * retest evidence ids can move an item to `successful-retest` or
 * `failed-retest`: a prose checklist sentence alone is `insufficient-evidence`.
 * Fresh plan items start `open`. */
export type HardeningRetestOutcome = 'open' | 'failed-retest' | 'successful-retest' | 'insufficient-evidence';
/** One prioritized hardening work item (a severity tier with its findings). */
export interface HardeningItem {
   priority: number;
   findingIds: string[];
   control: string;
   effort: 'low' | 'medium' | 'high';
  /** Baseline evidence ids the fix is measured against (empty until linked). */
  baselineEvidenceIds: string[];
  /** Retest evidence ids proving the fix (empty until linked). */
  retestEvidenceIds: string[];
  /** Retest standing; see HardeningRetestOutcome. */
  retestOutcome: HardeningRetestOutcome;
 }

const PRIORITY_BY_SEVERITY: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };
const EFFORT_BY_SEVERITY: Record<string, HardeningItem['effort']> = {
  critical: 'high',
  high: 'medium',
  medium: 'medium',
  low: 'low',
  info: 'low',
};

const CONTROL_BY_TIER: Record<string, string> = {
  critical: 'Contain and close the exploited path (patch or restrict), then add page-on-occur detection so recurrence is impossible to miss',
  high: 'Patch or restrict the affected surface and add a detection rule that fires on the exploited pattern',
  medium: 'Apply the configuration hardening that removes the vulnerable pattern and log the affected component at debug-or-better',
  low: 'Apply hygiene fixes (security headers, cookie flags, version hiding) under the normal release train',
  info: 'Record the observation in the risk register; revisit if it chains with a higher-severity finding',
};

/**
 * Group findings into severity-tiered hardening work items, highest priority first.
 * Unrecognized severities fold into the medium tier rather than being dropped.
 * Fresh items start `open` with no linked evidence; only
 * evaluateHardeningRetest moves them, and only on linked evidence ids.
 */
export function hardeningPlan(findings: RedFindingShape[]): HardeningItem[] {
  const bySeverity: Record<string, string[]> = {};
  for (const finding of findings) {
    const severity = severityWord(finding.severity);
    (bySeverity[severity] = bySeverity[severity] || []).push(finding.id);
  }

  return Object.entries(bySeverity)
    .map(([severity, ids]) => ({
      priority: PRIORITY_BY_SEVERITY[severity],
      findingIds: ids,
      control: CONTROL_BY_TIER[severity],
      effort: EFFORT_BY_SEVERITY[severity],
      baselineEvidenceIds: [],
      retestEvidenceIds: [],
      retestOutcome: 'open' as HardeningRetestOutcome,
    }))
    .sort((a, b) => a.priority - b.priority);
}

/** Nonempty-string evidence ids from an untrusted caller value. */
function cleanEvidenceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const id = entry.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Resolve a hardening retest outcome from item-linked evidence ids. Both the
 * baseline and the retest id lists must be nonempty, and the caller must pass
 * an explicit boolean retest verdict derived from comparing the linked
 * evidence: true is `successful-retest`, false is `failed-retest`. Anything
 * else — a prose sentence, one-sided ids, or a missing verdict — is
 * `insufficient-evidence`, never a passing retest.
 */
export function evaluateHardeningRetest(input: {
  baselineEvidenceIds?: unknown;
  retestEvidenceIds?: unknown;
  retestPassed?: unknown;
}): HardeningRetestOutcome {
  const baseline = cleanEvidenceIds(input?.baselineEvidenceIds);
  const retest = cleanEvidenceIds(input?.retestEvidenceIds);
  if (baseline.length === 0 || retest.length === 0) return 'insufficient-evidence';
  if (typeof input?.retestPassed !== 'boolean') return 'insufficient-evidence';
  return input.retestPassed ? 'successful-retest' : 'failed-retest';
}

/**
 * Return a copy of the item with the retest evidence linked and the outcome
 * resolved. The input item is never mutated.
 */
export function applyHardeningRetest(
  item: HardeningItem,
  verdict: { baselineEvidenceIds?: unknown; retestEvidenceIds?: unknown; retestPassed?: unknown },
): HardeningItem {
  const baselineEvidenceIds = cleanEvidenceIds(verdict?.baselineEvidenceIds);
  const retestEvidenceIds = cleanEvidenceIds(verdict?.retestEvidenceIds);
  return {
    ...item,
    baselineEvidenceIds,
    retestEvidenceIds,
    retestOutcome: evaluateHardeningRetest(verdict),
  };
}
