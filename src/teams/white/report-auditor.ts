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
}

export interface ReportAudit {
  /** One audit per finding, in report order. */
  findings: FindingAudit[];
  reportReady: number;
  withGaps: number;
  /** Ledger entries no finding claims — coverage checked in the other direction too. */
  unclaimedEvidence: UnclaimedEvidence[];
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

    for (const evidenceId of finding.evidenceIds) {
      const entry = byId.get(evidenceId);
      if (!entry) {
        links.push({ evidenceId, present: false, verdict: 'absent' });
        gaps.push(`evidence "${evidenceId}" is referenced but absent from the ledger`);
        continue;
      }
      claimed.add(evidenceId);
      const strength = resolveLedgerStrength(entry);
      const verdict = rulings.get(evidenceId)?.verdict ?? 'insufficient';
      links.push({ evidenceId, present: true, verdict, strength });
      if (verdict === 'accepted') carrying.push(strength);
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

    return {
      findingId: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: gaps.length ? 'coverage_gaps' as const : 'report_ready' as const,
      links,
      gaps,
      conditions,
    };
  });

  const unclaimedEvidence = evidence
    .filter(entry => !claimed.has(entry.id))
    .map(entry => ({
      evidenceId: entry.id,
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
    summary: `${reportReady}/${audits.length} findings report-ready; ${unclaimedEvidence.length} unclaimed ledger entries`,
  };
}
