// Types for the opsec-review benchmark's pure exports (consumed by vitest tests).
// The runnable logic lives in the sibling .mjs (scripts run under bare `node`, no build step);
// the engines themselves are the REAL pipeline loaded from dist/teams/black at runtime.
export interface OpsecCasePlan {
  actions: string[];
  egress: string[];
}
export interface OpsecExfilPath {
  id: string;
  channel?: string;
  volumeMb?: number;
  encrypted?: boolean;
}
export interface OpsecExfilSpec {
  paths: OpsecExfilPath[];
}
export interface NoiseExpectation {
  total: number;
  tier: 'quiet' | 'low' | 'moderate' | 'loud';
  within: boolean;
  violations: string[];
}
export interface ReviewPhaseExpectation {
  phase: string;
  matchedTechniques: string[];
}
export interface ReviewExpectation {
  phases: ReviewPhaseExpectation[];
  itemCount: number;
  egressDeclared: boolean;
  egressNotes: string[];
}
export interface ExfilPathExpectation {
  pathId: string;
  channel: string;
  techniqueId: string;
  baseCost: number;
  volumeCost: number;
  penalty: number;
  totalCost: number;
  tier: 'low' | 'medium' | 'high';
  feasible: boolean;
}
export interface ExfilExpectation {
  paths: ExfilPathExpectation[];
  totalCost: number;
  within: boolean;
}
export interface OpsecCase {
  id: string;
  desc: string;
  decoy?: boolean;
  plan: OpsecCasePlan;
  exfil?: OpsecExfilSpec;
  expect: {
    noise: NoiseExpectation;
    review: ReviewExpectation;
    exfil?: ExfilExpectation;
  };
}
export interface OpsecCorpus {
  note: string;
  decoy_penalty: number;
  cases: OpsecCase[];
}
export interface NoiseEngineReport {
  total: number;
  tier: 'quiet' | 'low' | 'moderate' | 'loud';
  within: boolean;
  violations: string[];
  entries: ReadonlyArray<{ action: string; matches: unknown[]; cost: number; rationale: string }>;
}
export interface ReviewEngineReport {
  phases: ReadonlyArray<{ phase: string; matchedTechniques: readonly string[]; checklist: readonly unknown[] }>;
  egressDeclared: boolean;
  egressNotes: readonly string[];
  itemCount: number;
}
export interface ExfilPathCost {
  pathId: string;
  channel: string;
  techniqueId: string;
  techniqueName: string;
  baseCost: number;
  volumeCost: number;
  penalty: number;
  totalCost: number;
  tier: 'low' | 'medium' | 'high';
  feasible: boolean;
  notes: readonly string[];
}
export interface ExfilEngineReport {
  paths: readonly ExfilPathCost[];
  totalVolumeMb: number;
  totalCost: number;
  budget: number;
  within: boolean;
}
export interface BlackEngines {
  structuredNoiseBudget(plan: { actions: readonly string[]; egress?: readonly string[] }): NoiseEngineReport;
  opsecReview(plan: { actions?: readonly string[]; egress?: readonly string[] }): ReviewEngineReport;
  exfilCostModel(input: { paths?: readonly OpsecExfilPath[]; egress?: readonly string[] }): ExfilEngineReport;
  ATTACK_BY_ID: Record<string, unknown>;
  OPSEC_PHASES: readonly string[];
  EXFIL_CHANNELS: readonly string[];
}
export interface CaseRun {
  noise: NoiseEngineReport;
  review: ReviewEngineReport;
  exfil: ExfilEngineReport;
}
export interface OpsecScore {
  verdicts: { hits: number; total: number; rate: number };
  discrimination: { decoyPlans: number; decoyFlagged: number };
  penalty: { perDecoy: number; applied: number; penalizedHits: number };
  perCase: Array<{
    id: string;
    decoy: boolean;
    ok: boolean;
    flagged: boolean;
    misses: Array<{ group: string; reasons: string[] }>;
  }>;
}
export function loadCorpus(): OpsecCorpus;
export function loadEngines(): Promise<BlackEngines>;
export function runCorpus(engines: BlackEngines, corpus: OpsecCorpus): Record<string, CaseRun>;
export function scoreCorpus(corpus: OpsecCorpus, runs: Record<string, CaseRun>): OpsecScore;
