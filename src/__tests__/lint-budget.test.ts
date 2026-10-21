import { describe, it, expect } from 'vitest';
import { evaluateLintBudget, aggregateEslintResults } from '../../scripts/lint-budget.mjs';

const budgets = {
  scope: 'src/**/*.ts',
  maxErrors: 0,
  rules: {
    '@typescript-eslint/no-explicit-any': { maxWarnings: 2 },
    curly: { maxWarnings: 1 },
  },
};

describe('evaluateLintBudget', () => {
  it('passes when every rule sits exactly at its budget', () => {
    const counts = {
      '@typescript-eslint/no-explicit-any': { errors: 0, warnings: 2 },
      curly: { errors: 0, warnings: 1 },
    };
    expect(evaluateLintBudget(counts, budgets)).toEqual({ ok: true, violations: [] });
  });

  it('fails on any error, even when warnings are within budget', () => {
    const counts = {
      '@typescript-eslint/no-explicit-any': { errors: 1, warnings: 0 },
    };
    const result = evaluateLintBudget(counts, budgets);
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
  });

  it('fails when one rule exceeds its warning budget while others pass', () => {
    const counts = {
      '@typescript-eslint/no-explicit-any': { errors: 0, warnings: 3 },
      curly: { errors: 0, warnings: 1 },
    };
    const result = evaluateLintBudget(counts, budgets);
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('@typescript-eslint/no-explicit-any');
  });

  it('fails for a rule with warnings but no budget entry', () => {
    const counts = {
      'prefer-const': { errors: 0, warnings: 1 },
    };
    const result = evaluateLintBudget(counts, budgets);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain('prefer-const');
  });

  it('passes when a rule is under its budget', () => {
    const counts = {
      '@typescript-eslint/no-explicit-any': { errors: 0, warnings: 0 },
    };
    expect(evaluateLintBudget(counts, budgets)).toEqual({ ok: true, violations: [] });
  });
});

describe('aggregateEslintResults', () => {
  it('aggregates a multi-file ESLint report per rule and feeds the budget evaluator', () => {
    const report = [
      {
        filePath: '/repo/src/a.ts',
        messages: [
          { ruleId: '@typescript-eslint/no-explicit-any', severity: 2 },
          { ruleId: 'curly', severity: 1 },
        ],
      },
      {
        filePath: '/repo/src/b.ts',
        messages: [
          { ruleId: '@typescript-eslint/no-explicit-any', severity: 1 },
          { ruleId: null, severity: 2 },
        ],
      },
    ];
    const counts = aggregateEslintResults(report);
    expect(counts).toEqual({
      '@typescript-eslint/no-explicit-any': { errors: 1, warnings: 1 },
      curly: { errors: 0, warnings: 1 },
      parse: { errors: 1, warnings: 0 },
    });

    const passingBudgets = {
      scope: 'src/**/*.ts',
      maxErrors: 0,
      rules: {
        '@typescript-eslint/no-explicit-any': { maxErrors: 1, maxWarnings: 1 },
        curly: { maxWarnings: 1 },
        parse: { maxErrors: 1 },
      },
    };
    expect(evaluateLintBudget(counts, passingBudgets)).toEqual({ ok: true, violations: [] });

    const failingBudgets = {
      scope: 'src/**/*.ts',
      maxErrors: 0,
      rules: {
        '@typescript-eslint/no-explicit-any': { maxErrors: 0, maxWarnings: 0 },
        curly: { maxWarnings: 1 },
      },
    };
    expect(evaluateLintBudget(counts, failingBudgets)).toEqual({
      ok: false,
      violations: [
        '@typescript-eslint/no-explicit-any: 1 error(s) exceed maxErrors 0',
        '@typescript-eslint/no-explicit-any: 1 warning(s) exceed maxWarnings 0',
        'parse: 1 error(s) exceed maxErrors 0',
      ],
    });
  });
});
