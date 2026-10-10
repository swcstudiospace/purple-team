// Types for the detection-coverage benchmark's pure exports (consumed by the vitest test).
// The runnable logic lives in the sibling .mjs (scripts run under bare `node`, no build step);
// the hunter itself is the REAL pipeline loaded from dist/teams/blue at runtime.
export interface CoverageCaseFinding {
  id: string;
  title?: string;
  severity?: string;
  evidence?: string[];
  countermeasures?: string[];
}
export interface CoverageCaseTelemetry {
  source: string;
  countermeasures?: string[];
  coveredIds?: string[];
}
export interface CoverageExpectation {
  coverage: 'covered' | 'partial' | 'none';
  uncovered?: string[];
  unresolved?: string[];
}
export interface CoverageCase {
  id: string;
  desc: string;
  domains?: string[];
  decoy?: boolean;
  findings: CoverageCaseFinding[];
  telemetry: CoverageCaseTelemetry[];
  expect: Record<string, CoverageExpectation>;
}
export interface CoverageCorpus {
  note: string;
  decoy_penalty: number;
  cases: CoverageCase[];
}
export interface CoverageHunter {
  coverageGaps(
    findings: CoverageCaseFinding[],
    telemetry: CoverageCaseTelemetry[],
  ): Array<{
    findingId: string;
    coverage: 'covered' | 'partial' | 'none';
    countermeasures: string[];
    coveredCountermeasures: string[];
    uncoveredCountermeasures: string[];
    unresolvedCountermeasures: string[];
    recommendation: string;
  }>;
  D3FEND_BY_ID: Record<string, unknown>;
  TELEMETRY_BY_SOURCE: Record<string, unknown>;
}
export interface CoverageScore {
  coverage: { hits: number; total: number; rate: number };
  discrimination: { decoyFindings: number; decoyCovered: number };
  penalty: { perDecoy: number; applied: number; penalizedHits: number };
  perCase: Array<{
    id: string;
    decoy: boolean;
    ok: boolean;
    misses: Array<{ findingId: string; reasons: string[] }>;
  }>;
}
export function loadCorpus(): CoverageCorpus;
export function loadHunter(): Promise<CoverageHunter>;
export function huntCorpus(hunter: CoverageHunter, corpus: CoverageCorpus): Record<string, ReturnType<CoverageHunter['coverageGaps']>>;
export function scoreCorpus(corpus: CoverageCorpus, byCase: Record<string, ReturnType<CoverageHunter['coverageGaps']>>): CoverageScore;
