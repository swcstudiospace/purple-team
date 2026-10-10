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
 * cover: an id covered by any source is 'covered'; telemetry that exists but does not
 * cover the id is 'partial'; no telemetry at all is 'none'.
 */
export function detectionGaps(
  findings: RedFindingShape[],
  telemetry?: TelemetrySourceShape[],
): DetectionGap[] {
  const coveredIds = new Set<string>();
  for (const source of telemetry || []) {
    for (const id of source.coveredIds || []) coveredIds.add(id);
  }
  const hasTelemetry = (telemetry || []).length > 0;

  return findings.map(finding => {
    const severity = severityWord(finding.severity);
    const subject = finding.title ? `"${finding.title}"` : finding.id;
    if (coveredIds.has(finding.id)) {
      return {
        findingId: finding.id,
        coverage: 'covered' as const,
        recommendedControl: `Retain and regression-test the existing detection covering ${finding.id} (${subject}); replay the stored evidence against it quarterly`,
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

/** One prioritized hardening work item (a severity tier with its findings). */
export interface HardeningItem {
  priority: number;
  findingIds: string[];
  control: string;
  effort: 'low' | 'medium' | 'high';
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
 * Unrecognized severities fall into the medium tier rather than being dropped.
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
    }))
    .sort((a, b) => a.priority - b.priority);
}
