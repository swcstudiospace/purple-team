import { describe, it, expect } from 'vitest';
import { evaluateLintBudget } from '../../scripts/lint-budget.mjs';

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
