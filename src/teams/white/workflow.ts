/**
 * T3MP3ST White v2 — staged referee workflow: ROE gate, approval receipts,
 * paired dispute rulings, and honest evidence aggregates (pure, no I/O).
 *
 * Doctrine: White is a neutral referee that fails closed. The workflow refuses
 * before calling roeAudit when the ROE text does not parse ok or the
 * allow-list is empty; a boolean `approved: true` is never a receipt — an
 * active action is compliant only when the caller supplies the approval
 * evidence id; opposed claims on one action index become one ruling keeping
 * both positions (a missing side is insufficiency, never a one-sided record);
 * aggregate standing reuses per-item chain/report status and can never be
 * sufficient or 100 while any required item is insufficient, missing, broken,
 * or contradictory. Caller-supplied revision, text hash, and source line are
 * echoed, never minted — stamps are written only on the PUT path in
 * src/server.ts, which this module never calls.
 */

import { roeAudit, type AuditedAction, type RoeSpec, type RoeVerdict } from '../white.js';
import { parseRoe } from './roe-parser.js';
import { auditEvidenceChain, type LedgerEvidenceShape } from './evidence-chain.js';
import { auditReport, type FindingShape } from './report-auditor.js';

/** An audited action that may carry its approval receipt reference. */
export interface ApprovalBearingAction extends AuditedAction {
  /** Ledger evidence id of the approval receipt covering this action. */
  approvalEvidenceId?: string;
}

/** Caller-supplied ROE provenance, echoed onto verdicts, never minted here. */
export interface RoeStageMeta {
  revision?: string;
  textHash?: string;
  sourceLine?: number;
}

export type StageRefusalReason = 'roe-parse-failed' | 'roe-scope-empty';

export interface StagedRoeRefusal {
  ok: false;
  reason: StageRefusalReason;
  detail: string;
}

export interface StagedRoeAudit {
  ok: true;
  verdicts: RoeVerdict[];
  revision?: string;
  textHash?: string;
  sourceLine?: number;
}

export type StageRoeResult = StagedRoeRefusal | StagedRoeAudit;

/**
 * Stage an ROE audit: parse the operator ROE text, refuse before roeAudit when
 * the parse is not ok or the allow-list is empty, then audit each action.
 * Active actions with `approved: true` but no supplied approval evidence id
 * are held at needs_approval — the boolean is not a stamp. Supplied revision,
 * text hash, and source line are echoed onto the result.
 */
export function stageRoeAudit(
  roeText: string,
  actions: ApprovalBearingAction[],
  meta?: RoeStageMeta,
): StageRoeResult {
  const parse = parseRoe(roeText);
  if (!parse.ok) {
    return {
      ok: false,
      reason: 'roe-parse-failed',
      detail: `ROE text did not parse cleanly (${parse.summary}); holding the engagement instead of running against a permissive partial spec`,
    };
  }
  const allowedTargets = parse.roe.allowedTargets || [];
  if (allowedTargets.length === 0) {
    return {
      ok: false,
      reason: 'roe-scope-empty',
      detail: 'parsed ROE carries an empty allow-list; every host is out of scope until scope is declared',
    };
  }
  const roe: RoeSpec = parse.roe;
  const verdicts = roeAudit(actions, roe).map((verdict, i) => {
    const action = actions[i];
    const reachedCompliantViaApprovalFlag =
      verdict.verdict === 'compliant'
      && verdict.rationale.startsWith('approved active technique')
      && !!action
      && action.approved === true;
    if (reachedCompliantViaApprovalFlag && action && !action.approvalEvidenceId?.trim()) {
      return {
        ...verdict,
        verdict: 'needs_approval' as const,
        rationale: `active technique ("${action.command || ''}") is approved in the flag but names no approval evidence id; a boolean is not a receipt`,
        conditions: ['supply the approval evidence id covering this command and target', 'log the action and receipt to the mission ledger before running it'],
      };
    }
    return verdict;
  });
  return {
    ok: true,
    verdicts,
    ...(meta?.revision ? { revision: meta.revision } : {}),
    ...(meta?.textHash ? { textHash: meta.textHash } : {}),
    ...(meta?.sourceLine !== undefined ? { sourceLine: meta.sourceLine } : {}),
  };
}


// ── Paired dispute rulings ───────────────────────────────────────────────────

export interface DisputeClaim {
  /** Which side advances the position. */
  side: 'red' | 'blue';
  /** One-line position, e.g. "scan was approved under receipt R-12". */
  position: string;
  /** Index of the disputed action in the audited action list. */
  actionIndex: number;
}

export interface PairedDisputeRuling {
  actionIndex: number;
  redPosition?: string;
  bluePosition?: string;
  ruling: RoeVerdict['verdict'];
  /** 'paired' when both sides are on record; 'insufficient' when a side is missing. */
  status: 'paired' | 'insufficient';
  rationale: string;
  appealPath: string;
}

/**
 * Group opposed claims by action index into one ruling per action. Both
 * positions stay on the record; a missing side records insufficiency, never a
 * one-sided record. The ROE verdict decides the ruling; a missing audit holds
 * at needs_approval.
 */
export function pairDisputeRulings(claims: DisputeClaim[], verdicts: RoeVerdict[]): PairedDisputeRuling[] {
  const verdictByIndex = new Map(verdicts.map(v => [v.actionIndex, v]));
  const byAction = new Map<number, { red?: string; blue?: string }>();
  for (const claim of claims) {
    let slot = byAction.get(claim.actionIndex);
    if (!slot) {
      slot = {};
      byAction.set(claim.actionIndex, slot);
    }
    if (claim.side === 'red' && slot.red === undefined) slot.red = claim.position;
    else if (claim.side === 'blue' && slot.blue === undefined) slot.blue = claim.position;
  }
  return [...byAction.entries()].map(([actionIndex, sides]) => {
    const verdict = verdictByIndex.get(actionIndex);
    const ruling = verdict ? verdict.verdict : 'needs_approval';
    const appealPath = verdict && verdict.conditions.length > 0
      ? verdict.conditions.join('; ')
      : 'submit the action with its approval receipt for re-audit';
    if (sides.red === undefined || sides.blue === undefined) {
      const missing = sides.red === undefined && sides.blue === undefined
        ? 'both sides'
        : sides.red === undefined ? 'the red position' : 'the blue position';
      return {
        actionIndex,
        ...(sides.red !== undefined ? { redPosition: sides.red } : {}),
        ...(sides.blue !== undefined ? { bluePosition: sides.blue } : {}),
        ruling,
        status: 'insufficient' as const,
        rationale: `dispute on action ${actionIndex} is missing ${missing}; held as insufficiency until both positions are on record`,
        appealPath,
      };
    }
    return {
      actionIndex,
      redPosition: sides.red,
      bluePosition: sides.blue,
      ruling,
      status: 'paired' as const,
      rationale: verdict
        ? `dispute on action ${actionIndex} settled against the ROE text: ${verdict.rationale}`
        : `dispute on action ${actionIndex} has no audited action — held as needs_approval until the action is submitted for audit`,
      appealPath,
    };
  });
}

// ── Honest evidence aggregates ───────────────────────────────────────────────

export interface AggregateStanding {
  /** True only when every required item is intact, present, accepted, and uncontested. */
  sufficient: boolean;
  /** 0-100; never 100 unless sufficient. */
  score: number;
  gaps: string[];
}

/**
 * Aggregate standing over findings ↔ evidence, reusing per-item chain and
 * report status. Any required item that is insufficient, missing, broken, or
 * contradictory withholds sufficiency and caps the score below 100.
 */
export function aggregateEvidenceStanding(
  findings: FindingShape[],
  evidence: LedgerEvidenceShape[],
  options?: { requiredFindingIds?: string[]; disputes?: PairedDisputeRuling[] },
): AggregateStanding {
  const gaps: string[] = [];
  const requiredIds = options?.requiredFindingIds;
  const required = requiredIds ? findings.filter(f => requiredIds.includes(f.id)) : findings;
  if (requiredIds) {
    for (const id of requiredIds) {
      if (!findings.some(f => f.id === id)) gaps.push(`required finding "${id}" is missing from the report`);
    }
  }
  const chain = auditEvidenceChain(evidence);
  const brokenById = new Map(chain.links.filter(l => l.status === 'broken').map(l => [l.evidenceId, l]));
  const report = auditReport(findings, evidence);
  const auditById = new Map(report.findings.map(a => [a.findingId, a]));

  let ready = 0;
  for (const finding of required) {
    const audit = auditById.get(finding.id);
    if (!audit || audit.status !== 'report_ready') {
      gaps.push(`required finding "${finding.id}" is not report-ready`);
      continue;
    }
    const brokenRefs = finding.evidenceIds.filter(id => brokenById.has(id));
    if (brokenRefs.length > 0) {
      gaps.push(`required finding "${finding.id}" rests on broken chain link(s): ${brokenRefs.join(', ')}`);
      continue;
    }
    ready += 1;
  }
  for (const dispute of options?.disputes || []) {
    if (dispute.status === 'insufficient') {
      gaps.push(`dispute on action ${dispute.actionIndex} is contradictory or one-sided; held as insufficiency`);
    }
  }
  const total = required.length;
  const sufficient = total > 0 && ready === total && gaps.length === 0;
  const raw = total === 0 ? 0 : Math.floor((100 * ready) / total);
  const score = sufficient ? 100 : Math.min(raw, 99);
  return { sufficient, score, gaps };
}
