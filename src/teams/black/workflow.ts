/**
 * Black staged workflow — analysis-only depth with an honest empty plan and a
 * no-effect refusal boundary.
 *
 * Stage order: refusal boundary first, then empty-plan insufficiency, then
 * scoring (exfilCostModel, structuredNoiseBudget, opsecReview). Refusals are a
 * boundary returned before scoring, not flags inside a scored review. An empty
 * plan returns insufficient before any verdict selection — never blown, never
 * a clean bill of health. ATT&CK vocabulary hits stay labeled
 * modeled/imported, never observed.
 */

import { exfilCostModel, type ExfilPath, type RouteEvidence } from './exfil.js';
import { structuredNoiseBudget } from './noise.js';
import { opsecReview } from './checklist.js';

/** Staged workflow outcome: insufficient (empty), refused (boundary), complete. */
export type BlackWorkflowOutcome = 'insufficient' | 'refused' | 'complete';

/** Tools the workflow can cite as the analysis behind a complete result. */
export type BlackWorkflowTool = 'exfilCostModel' | 'structuredNoiseBudget' | 'opsecReview';

export interface BlackWorkflowInput {
  actions?: readonly string[];
  paths?: readonly ExfilPath[];
  egress?: readonly string[];
  routeEvidence?: readonly RouteEvidence[];
  requestKind?: 'analysis' | 'destructive-concealment' | 'live-probe' | 'live-bulk-exfil' | 'verify-route';
  approved?: boolean;
}

export interface BlackWorkflowEvidence {
  tool: BlackWorkflowTool;
  inputHash: string;
  refs: readonly string[];
}

export interface BlackWorkflowResult {
  outcome: BlackWorkflowOutcome;
  reason: string;
  /** Always empty: analysis only, zero effects — including on refusal. */
  effects: readonly [];
  alternative?: string;
  /** ATT&CK hits are modeled/imported vocabulary matches, never observed. */
  provenance: 'modeled' | 'imported';
  evidence?: BlackWorkflowEvidence;
}

/** Deterministic FNV-1a hash over the JSON input, cited with every result. */
export function hashBlackInput(input: BlackWorkflowInput): string {
  const text = JSON.stringify(input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

const DESTRUCTIVE_PATTERN = /wipe|shred|delet\w*\s+(logs?|evidence)|clear\w*\s+(event\s+)?logs?|tamper|destroy\w*\s+evidence|anti-?forens|cover\s+tracks/i;
const LIVE_PROBE_PATTERN = /live\s+prob|active\s+scan|port.?scan|exploit|unapproved\s+prob/i;
const LIVE_EXFIL_PATTERN = /bulk\s+exfil|exfiltrat\w*\s+live|live\s+exfil|move\s+\d+\s*MB/i;

function refusalFor(input: BlackWorkflowInput): BlackWorkflowResult | null {
  const actions = input.actions ?? [];
  const kinds = input.requestKind;
  if (kinds === 'destructive-concealment' || actions.some(a => DESTRUCTIVE_PATTERN.test(a))) {
    return {
      outcome: 'refused',
      reason: 'destructive concealment is awareness-only: refuse to wipe, tamper, or destroy evidence',
      effects: [],
      alternative: 'file an authorized evidence-preservation review via opsecReview instead of wiping or tampering',
      provenance: 'modeled',
    };
  }
  if (kinds === 'live-probe' || (input.approved !== true && actions.some(a => LIVE_PROBE_PATTERN.test(a)))) {
    return {
      outcome: 'refused',
      reason: 'unapproved probing refused: live probes need written authorization',
      effects: [],
      alternative: 'run an approved scoped discovery plan with written authorization instead of live probing',
      provenance: 'modeled',
    };
  }
  if (kinds === 'live-bulk-exfil' || actions.some(a => LIVE_EXFIL_PATTERN.test(a))) {
    return {
      outcome: 'refused',
      reason: 'live bulk exfil refused: analysis only, never move data',
      effects: [],
      alternative: 'cost the routes as declared with exfilCostModel (analysis-only) instead of moving data',
      provenance: 'modeled',
    };
  }
  if (kinds === 'verify-route') {
    const observed = (input.routeEvidence ?? []).some(
      record => record.observed && record.evidenceId.length > 0,
    );
    if (!observed) {
      return {
        outcome: 'refused',
        reason: 'route verification without observed route evidence refused: a string declares, only observation verifies',
        effects: [],
        alternative: 'declare the route as declared/modeled with exfilCostModel and attach an observed route-evidence id for the path',
        provenance: 'modeled',
      };
    }
  }
  return null;
}

/**
 * Run the staged Black workflow. Refusal boundary first, then empty-plan
 * insufficiency, then scoring. Zero effects in every branch.
 */
export function runBlackWorkflow(input: BlackWorkflowInput): BlackWorkflowResult {
  const refused = refusalFor(input);
  if (refused) return refused;

  const actions = input.actions ?? [];
  const paths = input.paths ?? [];
  if (actions.length === 0 && paths.length === 0) {
    return {
      outcome: 'insufficient',
      reason: 'empty plan: no actions or paths supplied, nothing to analyze',
      effects: [],
      provenance: 'modeled',
      evidence: { tool: 'opsecReview', inputHash: hashBlackInput(input), refs: [] },
    };
  }
  const egress = input.egress ?? [];
  const noise = structuredNoiseBudget({ actions, egress });
  const costs = exfilCostModel({ paths, egress, routeEvidence: input.routeEvidence });
  const review = opsecReview({ actions, egress });
  void noise;
  void review;
  const refs = [
    ...actions.map((action, index) => `plan[${index}]: ${action}`),
    ...costs.paths.map(path => `path:${path.pathId}`),
  ];
  return {
    outcome: 'complete',
    reason: `analyzed ${actions.length} action(s) and ${paths.length} path(s): ATT&CK matches are modeled/imported vocabulary matches, never field sightings`,
    effects: [],
    provenance: 'modeled',
    evidence: {
      tool: costs.sufficient ? 'exfilCostModel' : 'structuredNoiseBudget',
      inputHash: hashBlackInput(input),
      refs,
    },
  };
}

export { opsecReview };
