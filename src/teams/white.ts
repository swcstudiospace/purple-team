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
const ACTIVE_PATTERN = /scan|exploit|fuzz|brute|spray|inject|payload|nmap|masscan|sqlmap|nuclei|ffuf|nikto|hydra|metasploit|post exploit|naabu|katana|dalfox|feroxbuster|gobuster|whatweb/i;

/** Host part of a target: strips scheme, userinfo, path, query, fragment, port, and IPv6 brackets. */
function hostOf(target: string): string {
  let rest = target.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0];
  const at = rest.lastIndexOf('@');
  if (at >= 0) rest = rest.slice(at + 1);
  if (rest.startsWith('[')) {
    const closeIdx = rest.indexOf(']');
    if (closeIdx > 0) {
      return rest.slice(1, closeIdx);
    }
  }
  const colonCount = (rest.match(/:/g) ?? []).length;
  if (colonCount === 1) {
    rest = rest.replace(/:\d+$/, '');
  }
  return rest;
}

/**
 * Label-boundary host match. "app.example.com" covers itself and its subdomains;
 * "*.example.com" covers subdomains only. Substring matches like "notexample.com"
 * against "example.com" are rejected.
 */
function hostInScope(host: string, allowed: string): boolean {
  const a = hostOf(allowed.trim().toLowerCase());
  if (a.startsWith('*.')) {
    const suffix = a.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === a || host.endsWith(`.${a}`);
}

/**
 * Audit actions against the ROE. Precedence: out-of-scope targets are violations
 * (approval does not expand scope); active techniques without allowActive are
 * violations; active techniques without an individual approval receipt are
 * needs_approval; everything else is compliant with evidence conditions.
 */
export function roeAudit(actions: AuditedAction[], roe: RoeSpec): RoeVerdict[] {
  const allowedTargets = Array.isArray(roe.allowedTargets)
    ? roe.allowedTargets.filter((t): t is string => typeof t === 'string')
    : [];

  return actions.map((action, actionIndex) => {
    const safeAction = (action && typeof action === 'object') ? action : {};
    const command = typeof safeAction.command === 'string' ? safeAction.command : '';
    const target = typeof safeAction.target === 'string' ? safeAction.target.trim().toLowerCase() : undefined;
    // Host-level label-boundary matching (see hostInScope). Fail closed: a
    // missing target or an empty allow-list is out of scope, never in scope.
    const host = target ? hostOf(target) : '';
    const inScope = !!target && allowedTargets.length > 0 && allowedTargets.some(allowed => hostInScope(host, allowed));
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
    if (active && safeAction.approved !== true) {
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
