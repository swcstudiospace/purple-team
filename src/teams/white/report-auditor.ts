/**
 * T3MP3ST White v2 — report auditor: findings ↔ evidence coverage (pure, no I/O).
 *
 * Doctrine: a finding ships only when its evidence chain holds — every
 * referenced ledger entry exists and at least one tool-grade-or-better link
 * carries it — and the report contract is met: a recommended fix and retest
 * acceptance criteria. Gaps are named exactly; ledger entries no finding claims
 * are reported rather than ignored, so the report cannot quietly drop collected
 * evidence. Findings arrive shaped like src/server.ts FindingRecord and entries
 * like src/server.ts EvidenceEntry — routes pass the live ledgers, not mock data.
 */

import { adjudicateEvidence, type ProvenanceStrength } from '../white.js';
import { resolveLedgerStrength, type LedgerEvidenceShape } from './evidence-chain.js';

/** A finding the auditor covers. Structurally compatible with src/server.ts FindingRecord. */
export interface FindingShape {
  id: string;
  title: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  /** Ledger evidence ids the finding claims as support. */
  evidenceIds: string[];
  /** Remediation text; a report finding without one is a coverage gap. */
  recommendedFix?: string;
  /** Retest acceptance criteria; a report finding without any is a coverage gap. */
  acceptanceCriteria?: string[];
}

export interface FindingEvidenceLink {
  evidenceId: string;
  /** false ⇒ referenced but absent from the ledger. */
  present: boolean;
  /** 'absent' for dangling references; otherwise the platform ruling for the entry. */
  verdict: 'absent' | 'accepted' | 'insufficient';
  /** Resolved provenance strength; set only for entries present in the ledger. */
  strength?: ProvenanceStrength;
}

export type FindingAuditStatus = 'report_ready' | 'coverage_gaps';

export interface FindingAudit {
  findingId: string;
  title: string;
  severity: FindingShape['severity'];
  status: FindingAuditStatus;
  /** Where an accepted carrying link came from, when the finding is report-ready. Observed wins when both exist. */
  acceptedOrigin?: 'observed' | 'claimed' | 'unlabeled';
  /** Accepted links split by origin and by strength. Present when at least one link is accepted. */
  acceptedCounts?: { observed: number; claimed: number; unlabeled: number; replayable: number; tool: number };
  /** Referenced evidence split by presence and ruling. Present when the finding names any evidence. */
  linkCounts?: { referenced: number; absent: number; insufficient: number; accepted: number };
  /** Accepted evidence ids with the origin and strength that carried them. */
  carryingLinks?: Array<{ id: string; origin: 'observed' | 'claimed' | 'unlabeled'; strength: ProvenanceStrength }>;
  /** Accepted ids that are not replayable, for a high or critical finding. */
  belowReplayable?: string[];
  /** Referenced ids that are present but not accepted. */
  insufficientLinks?: Array<{ id: string; strength: ProvenanceStrength }>;
  /** Referenced ids that are not in the evidence set. */
  absentIds?: string[];
  /** Remediation text that was audited, when the finding supplied one. */
  recommendedFix?: string;
  /** Retest criteria that were audited, when the finding supplied any. */
  acceptanceCriteria?: string[];
  /** One link per referenced evidence id, in reference order. */
  links: FindingEvidenceLink[];
  /** Exactly what blocks the finding from shipping (empty when report-ready). */
  gaps: string[];
  /** Hardening conditions that do not block shipping. */
  conditions: string[];
}

export interface UnclaimedEvidence {
  evidenceId: string;
  reason: string;
  /** Finding the unclaimed entry names, when it names one. */
  findingId?: string;
  /** Resolved strength; omitted when the entry has none. */
  strength?: ProvenanceStrength;
  /** Platform ruling for the unclaimed entry. */
  verdict?: 'accepted' | 'insufficient';
  title?: string;
  type?: string;
  origin?: 'claimed' | 'observed';
  source?: string;
  tool?: string;
  createdAt?: string;
}

export interface ReportAudit {
  /** One audit per finding, in report order. */
  findings: FindingAudit[];
  reportReady: number;
  withGaps: number;
  /** Ledger entries no finding claims — coverage checked in the other direction too. */
  unclaimedEvidence: UnclaimedEvidence[];
  /** Unclaimed entries whose stored origin is observed. */
  unclaimedObserved: number;
  /** Unclaimed entries whose stored origin is claimed. */
  unclaimedClaimed: number;
  /** Unclaimed entries the platform accepts at tool-grade or better. */
  unclaimedAccepted: number;
  /** Report-ready findings with at least one accepted observed link. */
  readyOnObserved: number;
  /** Report-ready findings whose accepted links are claimed and none are observed. */
  readyOnClaimedOnly: number;
  /** Report-ready findings whose accepted links have no origin label. */
  readyUnlabeled: number;
  /** One-line operator-readable audit outcome. */
  summary: string;
}

/**
 * Audit findings ↔ evidence coverage against the live ledgers. A finding is
 * report-ready when every referenced evidence id resolves, at least one accepted
 * (tool-grade or better) link carries it, and the report contract (recommended
 * fix + retest acceptance criteria) is met. High/critical claims additionally
 * draw a condition when nothing replayable backs them. Unclaimed ledger entries
 * are reported — including entries whose findingId names a finding absent from
 * the report — so neither side of the report can silently drop the other.
 */
export function auditReport(findings: FindingShape[], evidence: LedgerEvidenceShape[]): ReportAudit {
  const byId = new Map(evidence.map(entry => [entry.id, entry]));
  const rulings = new Map(adjudicateEvidence(evidence).map(ruling => [ruling.entryId, ruling]));
  const claimed = new Set<string>();

  const audits = findings.map(finding => {
    const links: FindingEvidenceLink[] = [];
    const gaps: string[] = [];
    const conditions: string[] = [];
    // Strengths of the accepted links that can actually carry the finding.
    const carrying: ProvenanceStrength[] = [];
    let acceptedObserved = 0;
    let acceptedClaimed = 0;
    let acceptedUnlabeled = 0;
    let acceptedReplayable = 0;
    let acceptedTool = 0;
    let absent = 0;
    let insufficient = 0;
    const carryingLinks: Array<{ id: string; origin: 'observed' | 'claimed' | 'unlabeled'; strength: ProvenanceStrength }> = [];
    const insufficientLinks: Array<{ id: string; strength: ProvenanceStrength }> = [];
    const absentIds: string[] = [];

    for (const evidenceId of finding.evidenceIds) {
      const entry = byId.get(evidenceId);
      if (!entry) {
        links.push({ evidenceId, present: false, verdict: 'absent' });
        gaps.push(`evidence "${evidenceId}" is referenced but absent from the ledger`);
        absent += 1;
        absentIds.push(evidenceId);
        continue;
      }
      claimed.add(evidenceId);
      const strength = resolveLedgerStrength(entry);
      const verdict = rulings.get(evidenceId)?.verdict ?? 'insufficient';
      links.push({ evidenceId, present: true, verdict, strength });
      if (verdict === 'accepted') {
        carrying.push(strength);
        const origin = entry.origin === 'observed' ? 'observed' as const : entry.origin === 'claimed' ? 'claimed' as const : 'unlabeled' as const;
        carryingLinks.push({ id: evidenceId, origin, strength });
        if (origin === 'observed') acceptedObserved += 1;
        else if (origin === 'claimed') acceptedClaimed += 1;
        else acceptedUnlabeled += 1;
        if (strength === 'replayable') acceptedReplayable += 1;
        else if (strength === 'tool') acceptedTool += 1;
      } else {
        insufficient += 1;
        insufficientLinks.push({ id: evidenceId, strength });
      }
    }

    if (!finding.evidenceIds.length) {
      gaps.push('finding references no evidence');
    } else if (!carrying.length) {
      gaps.push('no tool-grade or better evidence carries this finding');
    }
    if (!String(finding.recommendedFix || '').trim()) {
      gaps.push('no recommended fix: the report cannot ship a finding without remediation');
    }
    if (!finding.acceptanceCriteria?.length) {
      gaps.push('no retest acceptance criteria: the report cannot ship without a retest path');
    }
    if ((finding.severity === 'high' || finding.severity === 'critical') && !carrying.includes('replayable')) {
      conditions.push(`${finding.severity}-severity claim rests below replayable grade; attach a receipt a third party can re-run`);
    }
    const belowReplayable = (finding.severity === 'high' || finding.severity === 'critical')
      ? carryingLinks.filter(link => link.strength !== 'replayable').map(link => link.id)
      : [];

    const status = gaps.length ? 'coverage_gaps' as const : 'report_ready' as const;
    const recommendedFix = String(finding.recommendedFix || '').trim();
    const acceptedTotal = acceptedObserved + acceptedClaimed + acceptedUnlabeled;
    const acceptedOrigin = acceptedTotal === 0
      ? undefined
      : acceptedObserved > 0 ? 'observed' as const : acceptedClaimed > 0 ? 'claimed' as const : 'unlabeled' as const;
    const acceptedCounts = acceptedTotal === 0 ? undefined : {
      observed: acceptedObserved,
      claimed: acceptedClaimed,
      unlabeled: acceptedUnlabeled,
      replayable: acceptedReplayable,
      tool: acceptedTool,
    };
    return {
      findingId: finding.id,
      title: finding.title,
      severity: finding.severity,
      status,
      ...(status === 'report_ready' && acceptedOrigin ? { acceptedOrigin } : {}),
      ...(acceptedCounts ? { acceptedCounts } : {}),
      ...(finding.evidenceIds.length ? { linkCounts: { referenced: finding.evidenceIds.length, absent, insufficient, accepted: carryingLinks.length } } : {}),
      ...(carryingLinks.length ? { carryingLinks } : {}),
      ...(belowReplayable.length ? { belowReplayable } : {}),
      ...(insufficientLinks.length ? { insufficientLinks } : {}),
      ...(absentIds.length ? { absentIds } : {}),
      ...(recommendedFix ? { recommendedFix } : {}),
      ...(finding.acceptanceCriteria?.length ? { acceptanceCriteria: [...finding.acceptanceCriteria] } : {}),
      links,
      gaps,
      conditions,
    };
  });

  const unclaimedEvidence = evidence
    .filter(entry => !claimed.has(entry.id))
    .map(entry => ({
      evidenceId: entry.id,
      ...(entry.findingId ? { findingId: entry.findingId } : {}),
      ...(resolveLedgerStrength(entry) ? { strength: resolveLedgerStrength(entry) } : {}),
      ...(rulings.get(entry.id)?.verdict ? { verdict: rulings.get(entry.id)?.verdict } : {}),
      ...(entry.title ? { title: entry.title } : {}),
      ...(entry.type ? { type: entry.type } : {}),
      ...(entry.origin ? { origin: entry.origin } : {}),
      ...(entry.source ? { source: entry.source } : {}),
      ...(entry.observation?.tool ? { tool: entry.observation.tool } : {}),
      ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
      reason:
        entry.findingId && !findings.some(finding => finding.id === entry.findingId)
          ? `references finding "${entry.findingId}", which is not in the audited report`
          : 'not referenced by any finding in the report',
    }));

  const reportReady = audits.filter(audit => audit.status === 'report_ready').length;
  return {
    findings: audits,
    reportReady,
    withGaps: audits.length - reportReady,
    unclaimedEvidence,
    unclaimedObserved: unclaimedEvidence.filter(entry => entry.origin === 'observed').length,
    unclaimedClaimed: unclaimedEvidence.filter(entry => entry.origin === 'claimed').length,
    unclaimedAccepted: unclaimedEvidence.filter(entry => entry.verdict === 'accepted').length,
    readyOnObserved: audits.filter(audit => audit.acceptedOrigin === 'observed').length,
    readyOnClaimedOnly: audits.filter(audit => audit.acceptedOrigin === 'claimed').length,
    readyUnlabeled: audits.filter(audit => audit.acceptedOrigin === 'unlabeled').length,
    summary: `${reportReady}/${audits.length} findings report-ready; ${unclaimedEvidence.length} unclaimed ledger entries`,
  };
}
