/**
 * T3MP3ST White v2 — evidence-chain validator over the receipt ledger (pure, no I/O).
 *
 * Doctrine: evidence carries a finding only at tool-grade provenance or better
 * (the platform ranking in ../white.ts), and replayable material must name its
 * replay hook — the exact command or uri a third party re-runs. A chain that
 * cannot be re-walked is broken no matter how confident the narrative is; every
 * verdict carries the platform ruling, the exact defect, and the conditions that
 * restore the chain. Entries arrive shaped like src/server.ts EvidenceEntry —
 * routes pass the live evidenceLedger, not mock data.
 */

import { adjudicateEvidence, type EvidenceEntryShape, type EvidenceVerdict, type ProvenanceStrength } from '../white.js';

/**
 * A receipt-ledger entry the validator consumes. Structurally compatible with
 * src/server.ts EvidenceEntry: the live ledger persists provenanceStrength, and
 * the v1 EvidenceEntryShape strength override wins when both are present.
 */
export interface LedgerEvidenceShape extends EvidenceEntryShape {
  /** Provenance strength as persisted by the server ledger (src/server.ts). */
  provenanceStrength?: ProvenanceStrength;
  /** Who produced the entry: human | agent | tool | system. */
  source?: string;
  /** Replay hook: where the artifact/receipt lives. */
  uri?: string;
  /** Replay hook: the exact command to re-run. */
  command?: string;
  /** Finding this entry claims to support (ledger back-reference). */
  findingId?: string;
}

export type ChainLinkStatus = 'intact' | 'broken';

export interface ChainLinkVerdict {
  evidenceId: string;
  status: ChainLinkStatus;
  strength: ProvenanceStrength;
  /** The platform ruling from ../white.ts adjudicateEvidence: accepted at tool-grade or better. */
  verdict: EvidenceVerdict['verdict'];
  /** Exact command or uri that re-runs this evidence; absent when none is attached. */
  replayHook?: string;
  reason: string;
  /** Appeal path: what restores the chain (empty when intact with a hook attached). */
  conditions: string[];
}

export interface EvidenceChainAudit {
  /** One verdict per ledger entry, in ledger order. */
  links: ChainLinkVerdict[];
  intact: number;
  broken: number;
  /** One-line operator-readable audit outcome. */
  summary: string;
}

/**
 * Resolve the provenance strength of a ledger entry: an explicit strength (v1
 * shape override) or the server-persisted provenanceStrength wins; otherwise the
 * type mapping mirrors ../white.ts inferStrength and src/server.ts
 * inferEvidenceProvenanceStrength (receipt/screenshot → replayable,
 * command → tool, artifact/log/source/report → context, anything else → weak).
 */
export function resolveLedgerStrength(entry: LedgerEvidenceShape): ProvenanceStrength {
  if (entry.strength) return entry.strength;
  if (entry.provenanceStrength) return entry.provenanceStrength;
  const type = String(entry.type || '').toLowerCase();
  if (type === 'receipt' || type === 'screenshot') return 'replayable';
  if (type === 'command') return 'tool';
  if (type === 'artifact' || type === 'log' || type === 'source' || type === 'report') return 'context';
  return 'weak';
}

/**
 * Validate every receipt-ledger entry's chain: the platform ruling (accepted at
 * tool-grade or better, via the shared adjudicateEvidence) plus the replay-hook
 * requirement for replayable material. Duplicate ledger ids break the chain —
 * the records can no longer be told apart. Empty ledgers audit to zeroed counts
 * so callers can return honest empty state.
 */
export function auditEvidenceChain(entries: LedgerEvidenceShape[]): EvidenceChainAudit {
  const seen = new Set<string>();

  const links = entries.map(entry => {
    const strength = resolveLedgerStrength(entry);
    const [ruling] = adjudicateEvidence([{ id: entry.id, type: entry.type, strength }]);
    const replayHook = entry.command?.trim() || entry.uri?.trim();

    if (seen.has(entry.id)) {
      return {
        evidenceId: entry.id,
        status: 'broken' as const,
        strength,
        verdict: ruling.verdict,
        replayHook,
        reason: `duplicate evidence id "${entry.id}": ledger records must key uniquely or the chain cannot be told apart`,
        conditions: ['remove or rename the duplicate entry so every ledger id is unique'],
      };
    }
    seen.add(entry.id);

    if (ruling.verdict === 'insufficient') {
      return {
        evidenceId: entry.id,
        status: 'broken' as const,
        strength,
        verdict: ruling.verdict,
        replayHook,
        reason: ruling.rationale,
        conditions: ['corroborate with tool output or a replayable receipt'],
      };
    }

    if (strength === 'replayable' && !replayHook) {
      return {
        evidenceId: entry.id,
        status: 'broken' as const,
        strength,
        verdict: ruling.verdict,
        replayHook,
        reason: 'replayable entry carries no replay hook (no command or uri attached); the receipt cannot be re-opened',
        conditions: ['attach the receipt uri or the exact command so the evidence can be replayed'],
      };
    }

    return {
      evidenceId: entry.id,
      status: 'intact' as const,
      strength,
      verdict: ruling.verdict,
      replayHook,
      reason: replayHook
        ? `intact: provenance strength "${strength}" carries the finding; replay hook "${replayHook}" re-walks it`
        : `intact: provenance strength "${strength}" carries the finding, but no replay hook is attached — the chain cannot be re-walked yet`,
      conditions: replayHook ? [] : ['attach the exact command or artifact uri to make this evidence replayable'],
    };
  });

  const intact = links.filter(link => link.status === 'intact').length;
  return {
    links,
    intact,
    broken: links.length - intact,
    summary: `${intact} intact, ${links.length - intact} broken of ${links.length} ledger entries`,
  };
}
