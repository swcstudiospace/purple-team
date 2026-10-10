/**
 * T3MP3ST Purple synthesis — the "dark purple" posture ledger (pure functions, no I/O).
 *
 * Purple is an orchestrator-level capability, NOT a spawnable operator archetype.
 * synthesize() correlates red findings ↔ blue detection coverage ↔ white verdicts
 * into a single ledger-record-shaped result: a coverage matrix, the unresolved
 * items, and the concrete next missions that close them.
 *
 * Correlation convention: white verdicts are matched to findings positionally —
 * verdict i is the ROE verdict for the action that surfaced finding i. Verdicts
 * beyond the finding list are ignored.
 */

import { detectionGaps, type DetectionGap, type RedFindingShape, type TelemetrySourceShape } from './blue.js';
import { roeAudit, type AuditedAction, type RoeSpec, type RoeVerdict } from './white.js';

export interface DarkPurpleSynthesis {
  coverageMatrix: Array<{
    findingId: string;
    detection: 'none' | 'partial' | 'covered';
    verdict?: string;
    residualRisk: string;
  }>;
  unresolved: string[];
  nextMissions: string[];
}

const RISK_BY_SEVERITY: Record<string, string> = {
  critical: 'severe',
  high: 'high',
  medium: 'moderate',
  low: 'low',
  info: 'informational',
};

function riskWord(severity: string | undefined): string {
  return (severity && RISK_BY_SEVERITY[severity]) || 'moderate';
}

/**
 * Correlate the three team outputs into the dark-purple posture ledger. A finding is
 * unresolved when detection coverage is absent or a white verdict flagged a
 * violation; every unresolved item gets a concrete follow-up mission.
 */
export function synthesize(input: {
  findings: Array<{ id: string; title?: string; severity?: string }>;
  detections: DetectionGap[];
  verdicts: RoeVerdict[];
}): DarkPurpleSynthesis {
  const coverageByFinding = new Map<string, DetectionGap['coverage']>();
  for (const gap of input.detections) coverageByFinding.set(gap.findingId, gap.coverage);

  const coverageMatrix = input.findings.map((finding, index) => {
    const detection = coverageByFinding.get(finding.id) || 'none';
    const verdict = input.verdicts[index]?.verdict;
    const risk = riskWord(finding.severity);
    const subject = finding.title ? ` (${finding.title})` : '';

    let residualRisk: string;
    if (detection === 'none') {
      residualRisk = `${risk} residual risk — no detection covers ${finding.id}${subject}; close the gap before declaring the posture acceptable`;
    } else if (detection === 'partial') {
      residualRisk = `${risk} residual risk — detection is partial for ${finding.id}${subject}; harden the missing chain links`;
    } else if (verdict === 'violation') {
      residualRisk = `low residual risk — detection covers ${finding.id}${subject}, pending ROE remediation of the violating action`;
    } else {
      residualRisk = `low residual risk — detection covers ${finding.id}${subject}`;
    }

    return { findingId: finding.id, detection, verdict, residualRisk };
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

  return { coverageMatrix, unresolved, nextMissions };
}

// Re-exported so wave-2 server integration can mount the whole loop from one module.
export { detectionGaps, roeAudit };
export type { RedFindingShape, TelemetrySourceShape, AuditedAction, RoeSpec };
