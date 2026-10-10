/**
 * Regression guard for issue #111 — "APP doesn't initialize / unresponsive".
 *
 * Every /ui page carries classic inline <script> blocks. A parse error in one
 * inline script breaks that entire script tag, so we compile every classic
 * inline <script> of EVERY docs/*.html page the way a browser would (a
 * `vm.Script` is parsed as a classic script — no module/CORS/DOM needed) and
 * require each to compile. This catches the whole class of "the page won't
 * boot because the script won't parse" regressions with no browser and no new
 * dependency.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { Linter } from 'eslint';

const docsDir = join(process.cwd(), 'docs');
const pages = readdirSync(docsDir).filter((f) => f.endsWith('.html'));

/**
 * Extract the bodies of bare inline `<script>` blocks (each page's own
 * scripts). We deliberately match only `<script>` with no attributes:
 * external libs are `<script src=…>` and never inline code, and no page uses
 * `type="module"`. In-string occurrences (`'<script'`, the escaped
 * `<\/script>` inside a regex literal) can't false-match: they aren't a bare
 * `<script>` open, and the real close tag is `</script>` while the in-string
 * one is written `<\/script>`.
 */
function inlineScripts(source: string): string[] {
  const blocks: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) blocks.push(m[1]);
  return blocks;
}

const perPage = new Map<string, string[]>();
for (const file of pages) {
  perPage.set(file, inlineScripts(readFileSync(join(docsDir, file), 'utf8')));
}

describe('docs/*.html inline scripts (issue #111 regression)', () => {
  it('every page ships at least one inline script (guard against a vacuous pass)', () => {
    expect(pages.length).toBeGreaterThanOrEqual(10);
    for (const [file, blocks] of perPage) {
      expect(blocks.length, `${file} has no inline classic script`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every classic inline <script> on every page compiles without a SyntaxError', () => {
    const failures: string[] = [];
    for (const [file, blocks] of perPage) {
      blocks.forEach((src, i) => {
        try {
          new vm.Script(src, { filename: `docs/${file}#inline-${i}` });
        } catch (e) {
          failures.push(`${file} inline #${i}: ${(e as Error).message}`);
        }
      });
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});

/**
 * Second layer — semantic defect gate (#111 hardening).
 *
 * The vm.Script check above catches outright *parse* failures. This catches the
 * shapes a conflict-concatenating auto-merge leaves behind that still PARSE but are
 * always bugs — duplicate declarations, code after a `return`, duplicate object
 * keys — using ESLint's high-precision "possible problem" rules run programmatically.
 * No new dependency (`eslint` is already a devDependency) and no eslint.config / CI
 * change: this rides the existing `npm test`.
 *
 * The rule set is deliberately a tight, always-a-bug set, and each `<script>` is
 * linted in isolation, so it is false-positive-free. Notably EXCLUDED, by design:
 *   - `no-undef` / `no-unused-vars` — pages rely on cross-<script> and browser
 *     globals a per-block lint can't see; enabling them would flood.
 *   - `no-func-assign` — pages legitimately share globals across script blocks,
 *     a pattern that rule flags.
 */
const SCAR_RULES: Linter.RulesRecord = {
  'no-redeclare': 'error',
  'no-unreachable': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-const-assign': 'error',
  'no-import-assign': 'error',
  'no-class-assign': 'error',
};

describe('docs/*.html inline scripts — semantic defect gate (#111 hardening)', () => {
  it('no duplicate declarations, unreachable code, or duplicate keys in any inline <script>', () => {
    const linter = new Linter();
    const config: Linter.Config = {
      languageOptions: { ecmaVersion: 'latest', sourceType: 'script' },
      rules: SCAR_RULES,
    };
    const findings: string[] = [];
    for (const [file, blocks] of perPage) {
      blocks.forEach((src, i) => {
        for (const m of linter.verify(src, config)) {
          findings.push(`${file} inline #${i} L${m.line}:${m.column} [${m.ruleId ?? 'parse'}] ${m.message}`);
        }
      });
    }
    expect(findings, findings.join('\n')).toEqual([]);
  }, 30_000);
});

describe('operators.html hats panel scripts (v1.1 hats surface)', () => {
  it('ships a hats loader covering prompts, tool-grants, and spawn', () => {
    const blocks = perPage.get('operators.html') ?? [];
    const joined = blocks.join('\n');
    for (const marker of [
      '/api/operators/prompts',
      '/api/teams/tool-grants',
      '/api/operators/spawn',
      'hatsGrid',
      'dispatchHat',
    ]) {
      expect(joined, `operators.html inline scripts missing "${marker}"`).toContain(marker);
    }
  });
});
