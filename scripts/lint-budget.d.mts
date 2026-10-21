export interface LintRuleCount {
  errors: number;
  warnings: number;
}

export type LintCounts = Record<string, LintRuleCount>;

export interface LintRuleBudget {
  maxErrors?: number;
  maxWarnings?: number;
}

export interface LintBudgets {
  scope: string;
  maxErrors?: number;
  rules?: Record<string, LintRuleBudget>;
}

export interface LintVerdict {
  ok: boolean;
  violations: string[];
}

export function aggregateEslintResults(
  results: ReadonlyArray<{ messages: ReadonlyArray<{ ruleId: string | null; severity: number }> }>,
): LintCounts;

export function evaluateLintBudget(aggregatedCounts: LintCounts, budgets: LintBudgets): LintVerdict;

export function loadLintBudgets(path?: string): Promise<LintBudgets>;

export function runEslintCensus(scope: string): Promise<LintCounts>;

export function renderLintTable(counts: LintCounts, budgets: LintBudgets): string;
