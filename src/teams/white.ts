/**
 * T3MP3ST White Operator — neutral referee: ROE/scope auditing and evidence
 * adjudication (pure functions, no I/O).
 *
 * Doctrine: compliance is decided by the ROE text and receipts, not by either team's
 * narrative; evidence is ranked by the platform's provenance-strength model
 * (weak < context < tool < replayable, mirroring src/server.ts); every verdict
 * carries rationale, conditions, and an appeal path. Red and blue outputs are
 * untrusted evidence to inspect, never authority.
 */

export interface AuditedAction {
  command?: string;
  target?: string;
  approved?: boolean;
  scope?: string[];
}

export interface RoeSpec {
  allowedTargets?: string[];
  allowActive?: boolean;
}

export interface RoeVerdict {
  actionIndex: number;
  verdict: 'compliant' | 'violation' | 'needs_approval';
  rationale: string;
  conditions: string[];
}

/** Commands that perform active/offensive testing against the target. */
const ACTIVE_PATTERN = /scan|exploit|fuzz|brute|spray|inject|payload|nmap|masscan|sqlmap|nuclei|ffuf|nikto|hydra|metasploit|post exploit/i;

/**
 * Audit actions against the ROE. Precedence: out-of-scope targets are violations
 * (approval does not expand scope); active techniques without allowActive are
 * violations; active techniques without an individual approval receipt are
 * needs_approval; everything else is compliant with evidence conditions.
 */
export function roeAudit(actions: AuditedAction[], roe: RoeSpec): RoeVerdict[] {
  const allowedTargets = roe.allowedTargets || [];

  return actions.map((action, actionIndex) => {
    const command = action.command || '';
    const target = action.target?.trim().toLowerCase();
    // Suffix/substring matching: an allowed entry like "app.example.com" covers
    // paths and subpaths under it, but nothing outside it.
    const inScope = !target || !allowedTargets.length || allowedTargets.some(allowed => {
      const a = allowed.trim().toLowerCase();
      return target === a || target.endsWith(a) || target.includes(a);
    });
    const active = ACTIVE_PATTERN.test(command);

    if (!inScope) {
      return {
        actionIndex,
        verdict: 'violation' as const,
        rationale: `target "${target}" is outside the ROE allowed targets (${allowedTargets.join(', ')})`,
        conditions: ['remove the target from the plan, or amend the ROE with a signed scope change before execution'],
      };
    }
    if (active && roe.allowActive === false) {
      return {
        actionIndex,
        verdict: 'violation' as const,
        rationale: `active technique ("${command}") is disallowed by the ROE (allowActive=false)`,
        conditions: ['replace with a passive or simulator-based equivalent'],
      };
    }
    if (active && action.approved !== true) {
      return {
        actionIndex,
        verdict: 'needs_approval' as const,
        rationale: `active technique ("${command}") requires an approval receipt before execution`,
        conditions: ['obtain the approval receipt for this action', 'log the action and receipt to the mission ledger before running it'],
      };
    }
    return {
      actionIndex,
      verdict: 'compliant' as const,
      rationale: active
        ? `approved active technique within the allowed scope${target ? ` (target "${target}")` : ''}`
        : `passive/inspection action within the allowed scope`,
      conditions: ['attach the execution evidence and approval receipt to the mission ledger'],
    };
  });
}

// ── Evidence adjudication ────────────────────────────────────────────────────

export type ProvenanceStrength = 'weak' | 'context' | 'tool' | 'replayable';

const STRENGTH_RANK: Record<ProvenanceStrength, number> = { weak: 0, context: 1, tool: 2, replayable: 3 };

export interface EvidenceEntryShape {
  id: string;
  type?: string;
  strength?: ProvenanceStrength;
}

export interface EvidenceVerdict {
  entryId: string;
  verdict: 'accepted' | 'insufficient';
  rationale: string;
}

/**
 * Infer provenance strength from the entry type when none is stated — mirrors
 * src/server.ts inferEvidenceProvenanceStrength: receipt/screenshot → replayable,
 * command → tool, artifact/log/source/report → context, anything else → weak.
 */
function inferStrength(entry: EvidenceEntryShape): ProvenanceStrength {
  if (entry.strength) return entry.strength;
  const type = String(entry.type || '').toLowerCase();
  if (type === 'receipt' || type === 'screenshot') return 'replayable';
  if (type === 'command') return 'tool';
  if (type === 'artifact' || type === 'log' || type === 'source' || type === 'report') return 'context';
  return 'weak';
}

/**
 * Adjudicate evidence entries against the platform's provenance ranking
 * (weak < context < tool < replayable). Entries at tool-grade or better carry a
 * finding; weaker entries are insufficient with an exact statement of what is missing.
 */
export function adjudicateEvidence(entries: EvidenceEntryShape[]): EvidenceVerdict[] {
  return entries.map(entry => {
    const strength = inferStrength(entry);
    const rank = STRENGTH_RANK[strength];
    if (rank >= STRENGTH_RANK.tool) {
      return {
        entryId: entry.id,
        verdict: 'accepted' as const,
        rationale: `accepted: provenance strength "${strength}" (rank ${rank}) is tool-grade or better and can carry a finding`,
      };
    }
    return {
      entryId: entry.id,
      verdict: 'insufficient' as const,
      rationale: `insufficient: provenance strength "${strength}" (rank ${rank}) is below the tool-grade threshold; corroborate with tool output or a replayable receipt`,
    };
  });
}
