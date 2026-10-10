/**
 * T3MP3ST Black Operator — opsec & stealth discipline (pure functions, no I/O).
 *
 * Doctrine: footprint minimization, egress/proxy hygiene, noise budgeting, and an
 * operational-security review of every planned action. Anti-forensics is AWARENESS
 * ONLY — identify and report the logs/metadata/timestamps an action leaves behind;
 * never wipe, tamper, or destroy evidence. These heuristics are the deterministic
 * scoring half of that review; the LLM black operator adds judgment on top.
 */

export interface NoiseBudgetResult {
  /** 0-100, higher is quieter. */
  score: number;
  violations: string[];
}

/** Actions that spend detection surface. */
const NOISY_PATTERN = /scan|nmap|masscan|fuzz|brute|spray|wordlist|gobuster|ffuf|feroxbuster|dirb|nuclei|nikto|sqlmap|hydra|payload|inject/i;

/** Markers that bound a noisy action (port ranges, rate limits, counts). */
const BOUNDED_PATTERN = /--top-ports|-p\s|top-\d+|--max-rate|--rate|\brate\b|\blimit\b|\bcount\b|\d+\s*(?:ports|hosts|requests|paths|endpoints)|first\s+\d+/i;

/**
 * Score a mission plan's noise budget. Every violation is deterministic and
 * explainable: the ledger entry is the point, not just the number.
 */
export function noiseBudget(plan: { actions: string[]; egress?: string[] }): NoiseBudgetResult {
  const violations: string[] = [];
  let score = 100;

  // Egress routing: uncontrolled egress is the loudest failure a plan can have.
  if (!plan.egress || plan.egress.length === 0) {
    violations.push('no egress routing declared: every action would egress uncontrolled');
    score -= 20;
  }

  // Unbounded scans: noisy actions without an explicit bound.
  for (const action of plan.actions) {
    if (NOISY_PATTERN.test(action) && !BOUNDED_PATTERN.test(action)) {
      violations.push(`unbounded scan: "${action}" — no rate/count/port bound found`);
      score -= 12;
    }
  }

  // Repeated probes: the same action fired more than twice burns budget for nothing.
  const counts: Record<string, number> = {};
  for (const action of plan.actions) {
    const key = action.trim().toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  for (const [action, count] of Object.entries(counts)) {
    if (count > 2) {
      violations.push(`repeated probe (${count}x): "${action}"`);
      score -= 10;
    }
  }

  return { score: Math.max(0, Math.min(100, score)), violations };
}

export interface CoverAuditResult {
  /** Human-readable leaks the action leaves behind (awareness only — report, never erase). */
  leaks: string[];
  checklist: Array<{ item: string; clean: boolean }>;
}

/** ISO-8601-ish timestamp residue. */
const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}|ts=|--timestamp|\bdate -u\b/i;

/** Credential-shaped material embedded directly in a command line. */
const CREDENTIAL_PATTERN = /password|passwd|\btoken\b|api[_-]?key|secret|authorization:\s*bearer|\bcookie\s*:/i;

/** Tools whose default user agent identifies the tooling. */
const UA_TOOL_PATTERN = /\b(?:curl|wget|httpx)\b/i;
/** Custom user-agent markers (any of these means the operator set one deliberately). */
const UA_CUSTOM_PATTERN = /--user-agent|-a\s|user-agent:\s*\S|-a=/i;

/** DNS-resolution tooling: residue is whether the query bypasses the approved resolver. */
const DNS_TOOL_PATTERN = /\b(?:dig|nslookup|host)\b/i;
/** Public resolver pinning (@resolver / --server) keeps DNS residue on the approved path. */
const DNS_APPROVED_RESOLVER_PATTERN = /@|--server|--dnsserver/i;

/** Temp-file residue: artifacts written to throwaway paths. */
const TEMP_PATH_PATTERN = /\/tmp\/|\btemp\b|\.tmp\b|\.out\b|response\.txt|output\.txt/i;

/**
 * Pure cover assessment for a single planned or executed action. Every leak found
 * here is something to REPORT (and for the blue team to detect), never something
 * to destroy after the fact.
 */
export function coverAudit(action: { command: string; artifacts?: string[] }): CoverAuditResult {
  const command = action.command || '';
  const artifacts = action.artifacts || [];
  const haystack = [command, ...artifacts].join('\n');

  const leaks: string[] = [];
  const checklist: Array<{ item: string; clean: boolean }> = [];

  // User-agent leakage: default tool identity betrays the operator stack.
  const uaLeak = UA_TOOL_PATTERN.test(command) && !UA_CUSTOM_PATTERN.test(command);
  if (uaLeak) leaks.push('default user-agent reveals tooling (set an explicit, neutral -A/user-agent)');
  checklist.push({ item: 'user-agent hygiene', clean: !uaLeak });

  // Timestamp exposure: operational timestamps embedded in commands or artifacts.
  const tsLeak = TIMESTAMP_PATTERN.test(haystack);
  if (tsLeak) leaks.push('operational timestamp embedded in command/artifacts (correlates runs)');
  checklist.push({ item: 'timestamp exposure', clean: !tsLeak });

  // DNS residue: resolver-based lookups not pinned to the approved resolver path.
  const dnsLeak = DNS_TOOL_PATTERN.test(command) && !DNS_APPROVED_RESOLVER_PATTERN.test(command);
  if (dnsLeak) leaks.push('dns queries not pinned to the approved resolver (fresh recursive residue)');
  checklist.push({ item: 'dns residue', clean: !dnsLeak });

  // Temp-file residue: throwaway artifacts left on disk after the action.
  const tempLeak = artifacts.some(a => TEMP_PATH_PATTERN.test(a));
  if (tempLeak) leaks.push('temp-file residue in artifacts (evidence on disk, and that is a finding — report it, do not delete it)');
  checklist.push({ item: 'temp-file residue', clean: !tempLeak });

  // Credential material in args: secrets belong in receipts/streams, never argv.
  const credLeak = CREDENTIAL_PATTERN.test(command);
  if (credLeak) leaks.push('credential-shaped material in command line (leaks into shell history and process lists)');
  checklist.push({ item: 'credential material in args', clean: !credLeak });

  return { leaks, checklist };
}
