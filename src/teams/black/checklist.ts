/**
 * Black opsec checklists — phase-keyed operational-security review items.
 * Pure functions, no I/O.
 *
 * Phases are the vendored ATT&CK tactics black's doctrine covers (see
 * ./attack-data.ts), in doctrine order. Items are T3MP3ST doctrine, written
 * awareness-first: every item names what an action class LEAVES BEHIND and
 * what honest mitigation looks like. Anti-forensics items are awareness only —
 * identify and report residue, never wipe, tamper, or destroy evidence.
 *
 * opsecReview() ties the checklists to a plan: actions are matched through the
 * disclosed vocabulary in ./noise.ts, matched techniques group into phases,
 * and each present phase contributes its checklist. Unknown phases throw,
 * mirroring hatToolGrants() in ../hats.ts.
 */

import { ATTACK_BY_ID, ATTACK_BY_TACTIC, ATTACK_TACTICS, type AttackTacticKey } from './attack-data.js';
import { matchVocabulary } from './noise.js';

/** OPSEC checklist phases = vendored tactics, in doctrine order. */
export type OpsecPhase = AttackTacticKey;

/** The phases, in doctrine order (recon → discovery → stealth → collection → C2 → exfil). */
export const OPSEC_PHASES: readonly OpsecPhase[] = ATTACK_TACTICS.map(tactic => tactic.key);

/** One checklist item: the check, and why (what the action class leaves behind). */
export interface OpsecCheckItem {
  /** Stable id, e.g. "EXF-02". */
  id: string;
  /** The check itself, imperative. */
  check: string;
  /** Doctrine rationale, citing the vendored technique ids that anchor it. */
  why: string;
}

/** The full checklist for one phase. */
export interface OpsecChecklist {
  phase: OpsecPhase;
  /** ATT&CK tactic id for the phase, e.g. "TA0010". */
  tacticId: string;
  tacticName: string;
  items: readonly OpsecCheckItem[];
  /** Every vendored technique id for the phase, as review references. */
  techniqueRefs: readonly string[];
}

/** One phase found in a reviewed plan. */
export interface OpsecReviewPhase {
  phase: OpsecPhase;
  /** Vendored technique ids the plan's actions matched in this phase. */
  matchedTechniques: readonly string[];
  checklist: readonly OpsecCheckItem[];
}

/** Whole-plan opsec review. */
export interface OpsecReview {
  phases: readonly OpsecReviewPhase[];
  egressDeclared: boolean;
  /** Deterministic egress findings (the C2 phase checklist assumes a declared route). */
  egressNotes: readonly string[];
  /** Total checklist items across present phases. */
  itemCount: number;
}

const CHECKLISTS: Record<OpsecPhase, readonly OpsecCheckItem[]> = {
  reconnaissance: [
    {
      id: 'REC-01',
      check: 'Pin every DNS lookup to the approved resolver before the first query.',
      why: 'Fresh recursive residue maps the operator\'s infrastructure (T1596.001); resolver pinning keeps queries on the approved path.',
    },
    {
      id: 'REC-02',
      check: 'Set an explicit, neutral user agent on every web client.',
      why: 'Default tool identity fingerprints the operator stack (T1592); whatweb/httpx/wafw00f banners read as recon from either side.',
    },
    {
      id: 'REC-03',
      check: 'Rate-bound and scope-bound every active scan; declare ports and counts.',
      why: 'Active scanning is direct victim interaction (T1595, T1595.001–.003): unbounded scans are the loudest single recon choice.',
    },
    {
      id: 'REC-04',
      check: 'Prefer passive sources first; log which third parties were queried.',
      why: 'Passive DNS and WHOIS look cheap but each third-party query is a correlation point (T1596, T1596.002) — account for them in the ledger.',
    },
  ],
  discovery: [
    {
      id: 'DSP-01',
      check: 'Jitter and bound discovery sweeps; never fire identical probes back to back.',
      why: 'Service and remote-system discovery is exactly what internal analytics baseline (T1046, T1018); regular intervals correlate.',
    },
    {
      id: 'DSP-02',
      check: 'Stay read-only: enumerate, never modify, during discovery.',
      why: 'Discovery tooling that touches state turns quiet reads into events (T1083, T1087, T1135); reads alone stay inside the noise budget.',
    },
    {
      id: 'DSP-03',
      check: 'Declare expected discovery volume in the mission ledger before running it.',
      why: 'Connection/process/system enumeration burns internal telemetry (T1049, T1057, T1082) — the budget must say how much was planned.',
    },
  ],
  stealth: [
    {
      id: 'STL-01',
      check: 'Awareness only: identify the residue an action leaves; report it, never wipe it.',
      why: 'File deletion and timestomping are anti-forensics (T1070.004, T1070.006) — black doctrine refuses them outright and reports what would have leaked.',
    },
    {
      id: 'STL-02',
      check: 'Treat every obfuscation step as an artifact you must be able to explain.',
      why: 'Encoded or packed content leaves decoder artifacts and analysis hooks (T1027); if you cannot explain it, do not ship it.',
    },
    {
      id: 'STL-03',
      check: 'Do not masquerade tooling inside victim namespaces; run from declared operator paths.',
      why: 'Masquerading breaks provenance checks and turns concealment into tamper evidence (T1036).',
    },
    {
      id: 'STL-04',
      check: 'Declare sandbox/VM assumptions instead of probing for them.',
      why: 'Sandbox and virtualization probes are themselves observable behavior (T1497) — analysis-first means documenting the assumption, not testing it live.',
    },
  ],
  collection: [
    {
      id: 'COL-01',
      check: 'Stage minimally: collect only what the mission receipt requires.',
      why: 'Local and share reads are quiet individually but read-heavy patterns flag on file telemetry (T1005, T1039).',
    },
    {
      id: 'COL-02',
      check: 'Name the staging location in the plan; keep it off system paths.',
      why: 'Staged data sitting in predictable locations is a high-value forensic artifact (T1074, T1074.001) — placement is part of the review.',
    },
    {
      id: 'COL-03',
      check: 'Cost the archive step: compressed bundles draw both size and entropy analytics.',
      why: 'Archive utilities are a distinct collection event with a visible artifact (T1560, T1560.001) — declare format and expected size.',
    },
  ],
  'command-and-control': [
    {
      id: 'C2C-01',
      check: 'Declare the egress route before the first callback; verify every action uses it.',
      why: 'Undeclared egress is the loudest failure a plan can have; proxies and multi-hop chains must be named up front (T1090, T1090.003).',
    },
    {
      id: 'C2C-02',
      check: 'Keep callbacks on ports and protocols the route justifies.',
      why: 'Non-standard ports and raw sockets stand out against egress baselines (T1571, T1095); web protocols still need the declared route (T1071.001).',
    },
    {
      id: 'C2C-03',
      check: 'Encrypt channels and pin exactly one encoding per stream.',
      why: 'Encrypted channels limit content inspection (T1573, T1573.001–.002); switching encodings mid-stream is a correlation gift (T1132).',
    },
    {
      id: 'C2C-04',
      check: 'Model beacon timing honestly: jitter, schedule, and fallback channels in the ledger.',
      why: 'Regular beacons correlate over time and fallback channels inherit the pattern (T1008); tunneling needs a named telemetry-gap analysis (T1572).',
    },
    {
      id: 'C2C-05',
      check: 'Stage tooling deliberately: every pull is an egress event on the same route.',
      why: 'Ingress transfers multiply the callback footprint (T1105) — batch them, or accept the cost in the budget.',
    },
  ],
  exfiltration: [
    {
      id: 'EXF-01',
      check: 'Cost every path with the egress model before the first byte moves.',
      why: 'C2-channel and alternative-protocol exfil have different volumetric fingerprints (T1041, T1048, T1048.001–.003); the model makes the tradeoff explicit.',
    },
    {
      id: 'EXF-02',
      check: 'Declare third-party surfaces: cloud storage, web services, and repo pushes burn external logs.',
      why: 'Web-service and cloud-account paths leave evidence the operator does not control (T1567, T1567.001–.002, T1537).',
    },
    {
      id: 'EXF-03',
      check: 'If you chunk, say so: size-limit splitting is a detectable pattern, not invisibility.',
      why: 'Chunked transfers still sum in flow analytics (T1030); scheduled and automated transfers correlate on timing (T1029, T1020).',
    },
    {
      id: 'EXF-04',
      check: 'Exfil within the run budget or escalate for more budget — never exceed silently.',
      why: 'Bulk egress is the loudest single event class in the noise tables; an over-budget exfil is a decision, and the ledger must show who made it.',
    },
  ],
};

/**
 * The checklist for one phase. Unknown phases throw — callers pass doctrine
 * keys, and a typo'd phase is a bug, not an empty checklist.
 */
export function opsecChecklist(phase: OpsecPhase): OpsecChecklist {
  const tactic = ATTACK_TACTICS.find(t => t.key === phase);
  if (!tactic) {
    throw new Error(`opsecChecklist: "${phase}" is not an opsec phase (expected one of ${OPSEC_PHASES.join(', ')})`);
  }
  const refs = ATTACK_BY_TACTIC[phase];
  return {
    phase,
    tacticId: tactic.id,
    tacticName: tactic.name,
    items: CHECKLISTS[phase],
    techniqueRefs: [...refs],
  };
}

/**
 * Review a plan: match actions through the noise vocabulary, group the matched
 * techniques into phases, and hand back each present phase's checklist. Empty
 * plan → empty phases and the undeclared-egress note if no route is declared.
 */
export function opsecReview(plan: {
  actions?: readonly string[];
  egress?: readonly string[];
}): OpsecReview {
  const actions = plan.actions ?? [];
  const egress = plan.egress ?? [];
  const egressDeclared = egress.length > 0;

  const matchedByPhase: Record<OpsecPhase, Set<string>> = {
    reconnaissance: new Set<string>(),
    discovery: new Set<string>(),
    stealth: new Set<string>(),
    collection: new Set<string>(),
    'command-and-control': new Set<string>(),
    exfiltration: new Set<string>(),
  };

  for (const action of actions) {
    for (const match of matchVocabulary(action)) {
      const technique = ATTACK_BY_ID[match.id];
      for (const tactic of technique.tactics) {
        matchedByPhase[tactic].add(match.id);
      }
    }
  }

  const phases: OpsecReviewPhase[] = OPSEC_PHASES
    .filter(phase => matchedByPhase[phase].size > 0)
    .map(phase => ({
      phase,
      matchedTechniques: [...matchedByPhase[phase]].sort(),
      checklist: CHECKLISTS[phase],
    }));

  const egressNotes: string[] = [];
  if (!egressDeclared) {
    egressNotes.push('no egress routing declared: C2C-01 fails by default and every exfil path is infeasible');
  }

  return {
    phases,
    egressDeclared,
    egressNotes,
    itemCount: phases.reduce((sum, phase) => sum + phase.checklist.length, 0),
  };
}
