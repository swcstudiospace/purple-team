/**
 * Black noise budget v2 — tactic-tier weighting over ATT&CK-matched actions.
 * Pure functions, no I/O.
 *
 * Every planned action is matched against a disclosed regex vocabulary (below),
 * each vocabulary id resolving into the vendored ATT&CK subset
 * (./attack-data.ts). Cost is arithmetic over the vendored tactic tiers —
 * heuristic, but deterministic, documented, and explainable per action: the
 * ledger entry is the point, not just the number. Unmatched actions cost 0 —
 * "unmatched" is not "safe": per-action residue (user agents, timestamps, temp
 * files) stays the job of coverAudit() in ../black.ts.
 *
 * Anti-forensics (T1070.*) is doctrine refusal, not stealth: matches cost a
 * fixed penalty and raise a violation, because black identifies and REPORTS
 * residue — it never wipes, tampers, or destroys evidence.
 */

import { ATTACK_BY_ID, type AttackTacticKey } from './attack-data.js';

/** One vocabulary hit: the vendored technique an action's wording maps to. */
export interface NoiseMatch {
  id: string;
  name: string;
  tactic: AttackTacticKey;
}

/** Per-action noise ledger entry. */
export interface NoiseEntry {
  action: string;
  /** Vendored techniques the action's vocabulary matched, in vocabulary order. */
  matches: readonly NoiseMatch[];
  /** Deterministic cost in budget points (see the formula below). */
  cost: number;
  /** The arithmetic that produced the cost, so every entry is auditable. */
  rationale: string;
}

/** Whole-plan structured noise report. */
export interface StructuredNoiseReport {
  entries: readonly NoiseEntry[];
  /** Sum of all entry costs. */
  total: number;
  /** Declared budget (default NOISE_BUDGET_DEFAULT). */
  budget: number;
  /** Whether the plan stays within budget. */
  within: boolean;
  /** Total relative to budget: quiet (0), low (≤½), moderate (≤ budget), loud (over). */
  tier: 'quiet' | 'low' | 'moderate' | 'loud';
  /** Doctrine violations: anti-forensics matches, undeclared egress, probe repetition. */
  violations: readonly string[];
}

/** Default spend budget for a plan (points; one tier weight per matched action). */
export const NOISE_BUDGET_DEFAULT = 20;

/**
 * Tactic-tier weights: the detection-surface cost of one action whose loudest
 * match sits in that tactic. Reconnaissance leaves third-party query residue;
 * discovery interacts with victim telemetry; C2 patterns correlate over time;
 * bulk exfiltration is the loudest single event class. Stealth/collection sit
 * between: concealment tradecraft is moderate surface, reads are quiet.
 */
const TACTIC_NOISE_WEIGHT: Record<AttackTacticKey, number> = {
  reconnaissance: 2,
  discovery: 5,
  stealth: 3,
  collection: 3,
  'command-and-control': 4,
  exfiltration: 6,
};

/** Fixed penalty per anti-forensics match — doctrine refusal, awareness only. */
const ANTI_FORENSICS_PENALTY = 8;

/** Per-action surcharge when the plan declares no egress routing. */
const UNDECLARED_EGRESS_SURCHARGE = 3;

/** Anti-forensics ids: wiping/tampering evidence is refused, never scored as stealth. */
const ANTI_FORENSICS_IDS: readonly string[] = ['T1070.004', 'T1070.006'];

/**
 * The disclosed action vocabulary. Each pattern is a deterministic cue; an
 * action matching several patterns pays the loudest tier plus one point per
 * additional distinct match. Every id must exist in ATTACK_BY_ID — a vocabulary
 * entry pointing outside the vendored subset is a bug.
 */
const VOCABULARY: readonly { id: string; pattern: RegExp }[] = [
  // Reconnaissance — quiet tiers, third-party residue.
  { id: 'T1595.001', pattern: /\b(?:nmap|masscan|zmap)\b|\bport\s*scan\b/i },
  { id: 'T1595.002', pattern: /\b(?:nuclei|nikto|nessus|openvas)\b|\bvuln(?:erability)?\s*scan\b/i },
  { id: 'T1595.003', pattern: /\b(?:ffuf|gobuster|feroxbuster|dirb|wfuzz)\b|\bwordlist\b/i },
  { id: 'T1596.001', pattern: /\b(?:dnsx|subfinder|amass|dig|nslookup|host)\b|\bpassive\s*dns\b/i },
  { id: 'T1596.002', pattern: /\bwhois\b/i },
  { id: 'T1592', pattern: /\bwafw00f\b|\bwhatweb\b|\bhttpx\b|\bfingerprint|\btechnology\s*detect/i },
  // Discovery — direct victim-side interaction.
  { id: 'T1018', pattern: /\bping\s*sweep\b|\bfping\b|\barp-?scan\b|\barp\s+-a\b/i },
  { id: 'T1046', pattern: /\bbanner\s*grab\b|\bservice\s*(?:version\s*)?scan\b|\bnc\s+-zv\b/i },
  { id: 'T1049', pattern: /\bnetstat\b|\bss\s+-\w*i\b|\blsof\s+-i\b/i },
  { id: 'T1057', pattern: /\bps\s+aux\b|\btasklist\b|\bprocess\s*enum/i },
  { id: 'T1082', pattern: /\buname\b|\bsysteminfo\b|\bsysinfo\b/i },
  { id: 'T1083', pattern: /\bfind\s+\/\S|\btree\s+\//i },
  { id: 'T1087', pattern: /\b(?:account|user)\s*enum|\benum4linux\b/i },
  { id: 'T1135', pattern: /\bsmbclient\s+-L\b|\bshowmount\b|\bshare\s*enum/i },
  // Stealth — concealment tradecraft; anti-forensics rows are doctrine refusals.
  { id: 'T1027', pattern: /\bbase64\s+-d\b|\bopenssl\s+enc\b|\bxxd\b|\bobfuscat/i },
  { id: 'T1036', pattern: /\bmasquerad|\brename\s+(?:binary|tool)\b/i },
  { id: 'T1070.004', pattern: /\brm\s+-\w*[rf]\b|\bshred\b|\bsecure\s*delete\b|\bwipe\b/i },
  { id: 'T1070.006', pattern: /\btimestomp\b|\btouch\s+-t\b/i },
  { id: 'T1497', pattern: /\bsandbox\s*(?:check|evade|detect)\b|\bvm\s*detect/i },
  // Command and control — egress patterns that correlate.
  { id: 'T1071.001', pattern: /\b(?:curl|wget)\b/i },
  { id: 'T1071.004', pattern: /\bdns\s*tunnel|\bdnscat\b/i },
  { id: 'T1090', pattern: /\bproxychains\b|\btorsocks\b|--proxy\b/i },
  { id: 'T1090.003', pattern: /\bmulti.?hop\b|\bproxy\s*chain/i },
  { id: 'T1095', pattern: /\braw\s*(?:tcp|socket)\b|\bnc\s+(?:-e|-c)\b/i },
  { id: 'T1105', pattern: /\bcertutil\s+-urlcache\b|\bwget\s+-O\b|\bcurl\s+-o\b/i },
  { id: 'T1132', pattern: /\bencod(?:e|ing)\s+(?:payload|data)\b/i },
  { id: 'T1571', pattern: /\bnon-?standard\s*port\b|\bport\s*(?:4444|8443)\b/i },
  { id: 'T1572', pattern: /\bssh\s+-[DLR]\b|\bchisel\b|\bngrok\b|\btunnel\b/i },
  { id: 'T1573', pattern: /\bencrypt(?:ed)?\s*channel\b|\btls\s*pinn?ing\b/i },
  // Collection — reads and staging.
  { id: 'T1005', pattern: /\bcollect\b|\bharvest\b/i },
  { id: 'T1039', pattern: /\b(?:smb|share)\s*(?:copy|pull|download)\b/i },
  { id: 'T1074', pattern: /\bstag(?:e|ing)\b/i },
  { id: 'T1560.001', pattern: /\btar\s+-?cz?f?\b|\bzip\s+-r\b|\b7z\s+a\b|\bgzip\s+\S/i },
  // Exfiltration — bulk egress, the loudest event class.
  { id: 'T1041', pattern: /\bexfil\w*\s+(?:over\s+)?c2\b|\bc2\s+exfil/i },
  { id: 'T1020', pattern: /\bbeacon\b|\bautomated\s*exfil/i },
  { id: 'T1029', pattern: /\bscheduled\s*transfer\b|\b(?:cron|schedule[dr]?)\b.*\b(?:transfer|exfil|upload|sync)\b/i },
  { id: 'T1030', pattern: /\bchunk(?:ing)?\b|\bsize\s*limits?\b|\bsplit\s*(?:upload|transfer)\b/i },
  { id: 'T1048.003', pattern: /\b(?:dns|icmp)\s*tunnel|\bexfil\w*\s+unencrypted\b/i },
  { id: 'T1537', pattern: /\bcloud\s*(?:account|sync|copy)\b|\brclone\b/i },
  { id: 'T1567', pattern: /\bweb\s*service\s*upload\b|\bwebhook\b.*\bexfil|\bexfil\w*\s+webhook\b/i },
  { id: 'T1567.001', pattern: /\bcode\s*repo\s*(?:push|exfil)/i },
  { id: 'T1567.002', pattern: /\bs3\s*cp\b|\bgsutil\b|\b(?:az|azure)\s+(?:blob|storage)\b|\bcloud\s*storage\s*(?:put|upload)\b/i },
];

/**
 * Match one action's wording against the vocabulary. Deterministic, exported
 * for opsecReview() in ./checklist.ts: ids are vendored, order is vocabulary
 * order, duplicates are collapsed.
 */
export function matchVocabulary(action: string): readonly NoiseMatch[] {
  const matches: NoiseMatch[] = [];
  for (const { id, pattern } of VOCABULARY) {
    if (!pattern.test(action)) continue;
    const technique = ATTACK_BY_ID[id];
    if (!technique) throw new Error(`noise vocabulary references non-vendored id "${id}"`);
    matches.push({ id, name: technique.name, tactic: technique.tactics[0] });
  }
  return matches;
}

function tierOf(total: number, budget: number): StructuredNoiseReport['tier'] {
  if (total === 0) return 'quiet';
  if (total <= budget / 2) return 'low';
  if (total <= budget) return 'moderate';
  return 'loud';
}

/**
 * Score a plan's noise spend with tactic-tier weighting. Every cost is
 * arithmetic over the disclosed tables — the rationale field shows the
 * computation for each action, so the report reads as a ledger, not prose.
 */
export function structuredNoiseBudget(plan: {
  actions: readonly string[];
  egress?: readonly string[];
  budget?: number;
}): StructuredNoiseReport {
  const actions = plan.actions ?? [];
  const egress = plan.egress ?? [];
  const budget = Math.max(1, plan.budget ?? NOISE_BUDGET_DEFAULT);
  const egressDeclared = egress.length > 0;

  const violations: string[] = [];
  if (!egressDeclared) {
    violations.push('no egress routing declared: every action pays the undeclared-egress surcharge');
  }

  // Repeated probes: the same action fired more than twice burns budget for nothing.
  const counts: Record<string, number> = {};
  for (const action of actions) {
    const key = action.trim().toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  for (const [action, count] of Object.entries(counts)) {
    if (count > 2) violations.push(`repeated probe (${count}x): "${action}"`);
  }

  const entries: NoiseEntry[] = actions.map(action => {
    const matches = matchVocabulary(action);
    const weights = matches.map(m => TACTIC_NOISE_WEIGHT[m.tactic]);
    const antiForensics = matches.filter(m => ANTI_FORENSICS_IDS.includes(m.id));
    const loudest = matches.reduce(
      (a, b) => (TACTIC_NOISE_WEIGHT[b.tactic] > TACTIC_NOISE_WEIGHT[a.tactic] ? b : a),
      matches[0],
    );

    let cost = matches.length > 0 ? Math.max(...weights) + (matches.length - 1) : 0;
    cost += antiForensics.length * ANTI_FORENSICS_PENALTY;
    if (!egressDeclared) cost += UNDECLARED_EGRESS_SURCHARGE;

    const parts: string[] = matches.length > 0
      ? [`${TACTIC_NOISE_WEIGHT[loudest.tactic]} = loudest tier (${loudest.tactic} for ${matches.map(m => m.id).join(', ')})`]
      : ['0 = no vocabulary match (unmatched is not safe — run coverAudit)'];
    if (matches.length > 1) parts.push(`+${matches.length - 1} extra distinct match${matches.length > 2 ? 'es' : ''}`);
    if (antiForensics.length > 0) {
      parts.push(`+${antiForensics.length * ANTI_FORENSICS_PENALTY} anti-forensics (${antiForensics.map(m => m.id).join(', ')})`);
      for (const m of antiForensics) {
        violations.push(`anti-forensics refused (awareness only, never wipe/tamper): "${action}" matched ${m.id} ${m.name}`);
      }
    }
    if (!egressDeclared) parts.push(`+${UNDECLARED_EGRESS_SURCHARGE} undeclared egress`);

    return { action, matches, cost, rationale: parts.join('; ') };
  });

  const total = entries.reduce((sum, entry) => sum + entry.cost, 0);
  return { entries, total, budget, within: total <= budget, tier: tierOf(total, budget), violations };
}
