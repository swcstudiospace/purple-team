// Types for the roe-adjudication benchmark's pure exports (consumed by vitest tests).
// The runnable logic lives in the sibling .mjs (scripts run under bare `node`, no build step);
// the engines themselves are the REAL pipeline loaded from dist/teams/white at runtime.
export interface MissionAction {
  command?: string;
  target?: string;
  approved?: boolean;
  scope?: string[];
}
export interface MissionEvidence {
  id: string;
  type?: string;
  strength?: 'weak' | 'context' | 'tool' | 'replayable';
  provenanceStrength?: 'weak' | 'context' | 'tool' | 'replayable';
  source?: string;
  uri?: string;
  command?: string;
  findingId?: string;
}
export interface MissionFinding {
  id: string;
  title: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  evidenceIds: string[];
  recommendedFix?: string;
  acceptanceCriteria?: string[];
}
export interface ParseExpectation {
  ok: boolean;
  commentLines: number;
  allowedTargets?: string[];
  allowActive?: boolean;
  resolved: Array<{ field: 'allowedTargets' | 'allowActive'; line: number; value: string }>;
  unresolved: Array<{ line: number; reason: string }>;
  summary: string;
}
export interface AdjudicationExpectation {
  actionIndex: number;
  verdict: 'compliant' | 'violation' | 'needs_approval';
}
export interface ChainExpectation {
  intact: number;
  broken: number;
  links: Array<{ evidenceId: string; status: 'intact' | 'broken'; verdict: 'accepted' | 'insufficient' }>;
}
export interface ReportExpectation {
  reportReady: number;
  withGaps: number;
  findings: Array<{ findingId: string; status: 'report_ready' | 'coverage_gaps'; gaps: string[]; conditions: string[] }>;
  unclaimed: Array<{ evidenceId: string; reason: string }>;
}
export interface RoeCase {
  id: string;
  desc: string;
  decoy?: boolean;
  roe: string;
  actions?: MissionAction[];
  evidence?: MissionEvidence[];
  findings?: MissionFinding[];
  expect: {
    parse: ParseExpectation;
    adjudication?: AdjudicationExpectation[];
    chain?: ChainExpectation;
    report?: ReportExpectation;
  };
}
export interface RoeCorpus {
  note: string;
  decoy_penalty: number;
  cases: RoeCase[];
}
export interface ParsedRoeRun {
  roe: { allowedTargets?: string[]; allowActive?: boolean };
  resolved: Array<{ field: 'allowedTargets' | 'allowActive'; line: number; raw: string; value: string }>;
  unresolved: Array<{ line: number; text: string; reason: string }>;
  commentLines: number;
  ok: boolean;
  summary: string;
}
export interface RoeRunVerdict {
  actionIndex: number;
  verdict: 'compliant' | 'violation' | 'needs_approval';
  rationale: string;
  conditions: string[];
}
export interface ChainRunAudit {
  links: Array<{
    evidenceId: string;
    status: 'intact' | 'broken';
    strength: 'weak' | 'context' | 'tool' | 'replayable';
    verdict: 'accepted' | 'insufficient';
    replayHook?: string;
    reason: string;
    conditions: string[];
  }>;
  intact: number;
  broken: number;
  summary: string;
}
export interface ReportRunAudit {
  findings: Array<{
    findingId: string;
    title: string;
    severity: MissionFinding['severity'];
    status: 'report_ready' | 'coverage_gaps';
    links: Array<{ evidenceId: string; present: boolean; verdict: 'absent' | 'accepted' | 'insufficient'; strength?: 'weak' | 'context' | 'tool' | 'replayable' }>;
    gaps: string[];
    conditions: string[];
  }>;
  reportReady: number;
  withGaps: number;
  unclaimedEvidence: Array<{ evidenceId: string; reason: string }>;
  summary: string;
}
export interface WhiteEngines {
  parseRoe(text: string): ParsedRoeRun;
  roeAudit(actions: MissionAction[], roe: ParsedRoeRun['roe']): RoeRunVerdict[];
  auditEvidenceChain(entries: MissionEvidence[]): ChainRunAudit;
  auditReport(findings: MissionFinding[], evidence: MissionEvidence[]): ReportRunAudit;
}
export interface CaseRun {
  parse: ParsedRoeRun;
  adjudication?: RoeRunVerdict[];
  chain?: ChainRunAudit;
  report?: ReportRunAudit;
}
export interface RoeScore {
  verdicts: { hits: number; total: number; rate: number };
  discrimination: { decoyMissions: number; decoyFlagged: number };
  penalty: { perDecoy: number; applied: number; penalizedHits: number };
  perCase: Array<{
    id: string;
    decoy: boolean;
    ok: boolean;
    flagged: boolean;
    misses: Array<{ group: string; reasons: string[] }>;
  }>;
}
export function loadCorpus(): RoeCorpus;
export function loadEngines(): Promise<WhiteEngines>;
export function runCorpus(engines: WhiteEngines, corpus: RoeCorpus): Record<string, CaseRun>;
export function scoreCorpus(corpus: RoeCorpus, runs: Record<string, CaseRun>): RoeScore;
