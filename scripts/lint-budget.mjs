#!/usr/bin/env node
// Per-rule lint budget ratchet for the widened src/**/*.ts scope. Budgets may only go down.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import process from 'node:process';

const execFileAsync = promisify(execFile);

// ESLint reports syntax failures without a ruleId; they are budgeted under this name.
const PARSE_RULE = 'parse';

export function aggregateEslintResults(results) {
  const counts = {};
  for (const file of results) {
    for (const message of file.messages) {
      const rule = message.ruleId ?? PARSE_RULE;
      counts[rule] ??= { errors: 0, warnings: 0 };
      if (message.severity >= 2) counts[rule].errors += 1;
      else counts[rule].warnings += 1;
    }
  }
  return counts;
}

/**
 * Pure budget evaluator.
 * @param {Record<string, {errors: number, warnings: number}>} aggregatedCounts per-rule ESLint counts
 * @param {{maxErrors?: number, rules?: Record<string, {maxWarnings?: number, maxErrors?: number}>}} budgets
 * @returns {{ok: boolean, violations: string[]}}
 */
export function evaluateLintBudget(aggregatedCounts, budgets) {
  const defaultMaxErrors = budgets.maxErrors ?? 0;
  const ruleBudgets = budgets.rules ?? {};
  const violations = [];
  for (const [rule, counts] of Object.entries(aggregatedCounts).sort(([a], [b]) => a.localeCompare(b))) {
    const budget = ruleBudgets[rule];
    const maxErrors = budget?.maxErrors ?? defaultMaxErrors;
    if (counts.errors > maxErrors) {
      violations.push(`${rule}: ${counts.errors} error(s) exceed maxErrors ${maxErrors}`);
    }
    if (!budget) {
      if (counts.warnings > 0) {
        violations.push(`${rule}: ${counts.warnings} warning(s) with no budget entry`);
      }
      continue;
    }
    const maxWarnings = budget.maxWarnings ?? 0;
    if (counts.warnings > maxWarnings) {
      violations.push(`${rule}: ${counts.warnings} warning(s) exceed maxWarnings ${maxWarnings}`);
    }
  }
  return { ok: violations.length === 0, violations };
}

export async function loadLintBudgets(path = resolve('lint-budgets.json')) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function runEslintCensus(scope) {
  // Run ESLint's JS entry through Node: the node_modules/.bin shim cannot be exec'd on Windows.
  const eslintEntry = resolve('node_modules/eslint/bin/eslint.js');
  let stdout;
  try {
    ({ stdout } = await execFileAsync(process.execPath, [eslintEntry, '--format', 'json', scope], { maxBuffer: 256 * 1024 * 1024 }));
  } catch (error) {
    // ESLint exits non-zero whenever it reports errors; the JSON report is still on stdout.
    if (typeof error.stdout !== 'string' || error.stdout === '') throw error;
    stdout = error.stdout;
  }
  return aggregateEslintResults(JSON.parse(stdout));
}

export function renderLintTable(counts, budgets) {
  const ruleNames = [...new Set([...Object.keys(budgets.rules ?? {}), ...Object.keys(counts)])].sort();
  const header = ['rule', 'errors', 'maxErrors', 'warnings', 'maxWarnings'];
  const rows = ruleNames.map(rule => {
    const count = counts[rule] ?? { errors: 0, warnings: 0 };
    const budget = budgets.rules?.[rule];
    return [
      rule,
      String(count.errors),
      String(budget?.maxErrors ?? budgets.maxErrors ?? 0),
      String(count.warnings),
      budget ? String(budget.maxWarnings ?? 0) : 'none',
    ];
  });
  const table = [header, ...rows];
  const widths = header.map((_, column) => Math.max(...table.map(row => row[column].length)));
  return table.map(row => row.map((cell, column) => cell.padEnd(widths[column])).join('  ')).join('\n');
}

async function main() {
  const budgets = await loadLintBudgets();
  const counts = await runEslintCensus(budgets.scope);
  const verdict = evaluateLintBudget(counts, budgets);
  console.log(`Lint budget scope: ${budgets.scope}`);
  console.log(renderLintTable(counts, budgets));
  for (const violation of verdict.violations) {
    console.error(`violation: ${violation}`);
  }
  console.log(verdict.ok ? 'lint budget: OK' : 'lint budget: FAILED');
  process.exitCode = verdict.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`lint budget failed: ${error.stack || error.message || error}`);
    process.exitCode = 1;
  });
}
