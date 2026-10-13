# Phase 25: Lint Re-baseline & Close-Out - Research

**Researched:** 2026-10-13
**Domain:** eslint warning-baseline measurement, fix-vs-suppress policy, enforcement pin wiring (doctor / CI)
**Confidence:** HIGH (every load-bearing claim measured or read from source this session; repo-internal research, no external docs needed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 25-CONTEXT.md `## Implementation Decisions`)
- LINT-01 closes the milestone: only a post-VAL, post-code re-measure is meaningful (VAL-added tests moved counts); every phase 21–24 already reported its running count (177 held throughout, 0 errors)
- Fix in code first; narrow line-scoped suppression only with a recorded reason; NO config loosening, NO file-level disables, NO `.mjs` scope dodge, NO deletion of real logic
- The lint-hygiene pin is mechanical and enforced (doctor check or CI step) — not prose
- Close-out gate table records the MEASURED number, not a remembered one

### Claude's Discretion (verbatim)
- The specific doctor/CI enforcement shape (whichever binds most naturally to existing doctor checks / CI wiring)

### Deferred Ideas (OUT OF SCOPE, verbatim)
- Per-rule warning budgets (v2 differentiator)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINT-01 | Baseline returns to ≤176 (0 errors intact); net-new phase-20 warning fixed in code or narrowly suppressed with recorded reason; measured count in close-out gate table; lint-hygiene pin (inline-disable ceiling + config-diff watch); running count reported, no net-new warnings | Warning identified exactly (`src/__tests__/purple-v2.test.ts:17`, §The Net-New Warning); fix surface quoted with two ranked options (§Fix Surface); measurement semantics resolved — the 177/176 universe is the `npm run lint` glob scope, measured 2026-10-13 (§Gate Scope Semantics); pin shapes designed against real doctor/CI wiring (§Enforcement Pin); forbidden channels enumerated with config diff baseline (§What Must Not Happen) |
</phase_requirements>

## Summary

Phase 25 closes the v1.4 milestone on a measured lint number. Research accomplished three things. **First, the net-new phase-20 warning is identified with a closed evidence chain**: `src/__tests__/purple-v2.test.ts:17:10`, rule `@typescript-eslint/no-non-null-assertion`, on the line `return entry!;` inside the `row()` test helper — a file created by phase-20 commit `4c37232`, never modified since, and the only warning-bearing file among phase 20's lint-scope outputs. **Second, the measurement semantics of the 177/176 baseline are now fully understood** — and they are not what STACK.md §4's snippet implies: `package.json:88` runs `eslint src/**/*.ts` with the glob **unquoted**, so npm's sh expands `**` as a single `*` and the gate lints exactly the 160 depth-2 files (`src/*/*.ts`), measuring **0 errors / 177 warnings** (re-measured today, matching every gate receipt). A quoted recursive glob would lint 178 files and measure **16 errors / 289 warnings** — a different universe, including 18 files (`src/*.ts` depth-1, `src/teams/*/*.ts` depth-3) the gate has never seen. **Third, the enforcement pin has two concrete, verified wiring targets**: `scripts/doctor.mjs`'s one-line `check(name, passed, detail, severity)` registration (which already propagates to CI because `npm run test:pr` chains `npm run doctor`), or a one-line CI step riding the same script via `npm run lint -- --max-warnings 176`.

**Primary recommendation:** Fix `purple-v2.test.ts:17` with a guard-throw (replaces the `expect(...).toBeDefined()` + `return entry!` pair, message preserved verbatim, same failure semantics, matches house throw-in-test style) → re-measure `npm run lint` → expect exactly `✖ 176 problems (0 errors, 176 warnings)`; record that measured output in the close-out gate table; enforce with a doctor check (inline-disable census ≤ 5 over `src/**/*.ts` recursive + verbatim `eslint.config.js` rule/ignores anchors) since doctor already runs inside CI's `test:pr`; hold with `npm run lint -- --max-warnings 176`. Record the 18-file/16-hidden-error scope gap as an owner follow-up — out of phase scope.

## Gate Scope Semantics — the load-bearing finding

**Read this before planning any task that runs eslint.** The number 177 is not "all warnings in the repo"; it is "warnings within the gate's glob scope," and the scope is narrower than it looks.

| Fact | Evidence |
|---|---|
| Script is unquoted | [VERIFIED: package.json:88] `"lint": "eslint src/**/*.ts",` |
| npm runs scripts under sh; `globstar` off → `**` collapses to `*` | [VERIFIED: measured this session — `sh -c 'printf "%s\n" src/**/*.ts'` → 160 paths, all depth-2 `src/<dir>/<file>.ts`] |
| Gate scope = 160 files → **0 errors / 177 warnings** | [VERIFIED: measured 2026-10-13 — eslint on exactly those 160 files: `errors 0 warnings 177`; `npm run lint` summary line `✖ 177 problems (0 errors, 177 warnings)` — matches every gate receipt 20-01 through 24-01] |
| Quoted glob `"src/**/*.ts"` → eslint's own recursive globby → 178 files → **16 errors / 289 warnings** | [VERIFIED: measured 2026-10-13 — `npx eslint "src/**/*.ts" --format json` → `TOTAL errors 16 warnings 289`, 178 files] |
| Per-rule inside the real gate scope: `no-explicit-any` 81 + `no-non-null-assertion` 96 = 177 | [VERIFIED: measured 2026-10-13, JSON census of the 160-file run] |
| The 18 never-linted files (quoted-only delta) | [VERIFIED: measured 2026-10-13] depth-1: `src/cli.ts` 3w/5e, `src/index.ts` 3w/5e, `src/mcp-server.ts` 4w/0e, `src/redact.ts` 0w/3e, `src/server.ts` 101w/2e, `src/setup.ts` 1w/0e; depth-3: `src/teams/black/{attack-data,checklist,exfil,noise}.ts`, `src/teams/blue/{coverage,d3fend-ontology,d3fend,rulepacks,telemetry}.ts` (d3fend-ontology 0w/1e), `src/teams/white/{evidence-chain,report-auditor,roe-parser}.ts` — all 0w except noted. Sum: 112 hidden warnings + 16 hidden errors |

**Consequences the plan MUST encode:**

1. **Baseline arithmetic uses `npm run lint` semantics only.** 177 → fix the one warning → 176. The hold knob is `npm run lint -- --max-warnings 176` (npm appends the flag to the same script → identical glob scope by construction; eslint exits 1 when warnings exceed the cap). An unquoted `npx eslint src/**/*.ts --max-warnings 176` is scope-identical; the npm-flag form is preferred because it cannot drift.
2. **STACK.md §4 correction:** its "measure deterministically" snippet uses the **quoted** glob (`npx eslint "src/**/*.ts" --format json`) → yields 289/16, NOT the baseline universe. For the close-out receipt, record the plain `npm run lint` summary line (or JSON-parse the depth-2 expansion). Do not chase the 16 errors and do not record 289.
3. **Hidden-error scope gap is real but out of phase scope.** "0 errors" is true within the gate's defined scope; 16 errors + 112 warnings exist outside it (incl. `src/server.ts` 101w/2e). Widening the scope is new work + an instant gate break — violates the milestone's no-new-scope / 0-error-intact constraints. Register as an owner follow-up (the F-20-01 precedent exists in 21-02-SUMMARY). [VERIFIED: measurement; the out-of-scope classification is a research recommendation — see Open Questions]
4. CI parity holds automatically: ci.yml's `test` job runs `npm run test:pr` → same sh expansion on the runner; the gate is scope-consistent locally and in CI. [VERIFIED: .github/workflows/ci.yml:34-35 + package.json:81]

## The Net-New Warning (closed attribution chain)

**Identity** [VERIFIED: measured 2026-10-13, eslint JSON census of gate scope]:

```
src/__tests__/purple-v2.test.ts:17:10
rule: @typescript-eslint/no-non-null-assertion
message: Forbidden non-null assertion.
source:   return entry!;
```

**Attribution chain** — why this is the phase-20 net-new and nothing else is:

| Step | Evidence |
|---|---|
| Phase-20 commit `4c37232` (2026-10-10) touched lint-scope files: `src/__tests__/purple-v2.test.ts` (NEW, +206), `src/teams/purple.ts` (+85), `src/__tests__/tauri-scaffold-static.test.ts` (+3/-1); `src/server.ts` (+59) is depth-1 → outside gate scope, cannot have contributed | [VERIFIED: `git show --stat 4c37232`] |
| `purple-v2.test.ts` never modified after `4c37232` | [VERIFIED: `git log --oneline 4c37232..HEAD -- src/__tests__/purple-v2.test.ts` → empty] |
| Today it carries exactly 1 warning; `purple.ts` and `tauri-scaffold-static.test.ts` carry 0 | [VERIFIED: 2026-10-13 census] |
| Gate table at 20-close recorded 177 = "176 pre-existing baseline + 1 net-new"; audit: "Lint warning baseline drifted 176 → 177 (one net-new warning in new code; 0-error gate intact)" | [VERIFIED: `.planning/milestones/v1.3-phases/20-purple-v2-defend-ui/20-01-SUMMARY.md` (Verification table, lint row); `.planning/v1.3-MILESTONE-AUDIT.md:31`] |
| Phases 21–24 added zero net-new warnings: only 8 `src/` files changed since `4c37232`; **intersection with the 35 warning-bearing files is empty**; the 2 added test files (`v13-class-probes.test.ts` + a roe/white pin file) carry 0 warnings; receipts "0 errors, 177 warnings" held at 21-01/02/03, 22-01, 23-01 | [VERIFIED: `git diff --name-only`/`--diff-filter=A 4c37232..HEAD -- src/` intersected with census; `.planning/phases/*/2{1,2,3}-*-SUMMARY.md` gate rows] |

## Fix Surface

Flagged code, verbatim [VERIFIED: src/__tests__/purple-v2.test.ts:14-18]:

```typescript
function row(synthesis: DarkPurpleSynthesis, findingId: string): DarkPurpleSynthesis['coverageMatrix'][number] {
  const entry = synthesis.coverageMatrix.find(entry => entry.findingId === findingId);
  expect(entry, `coverageMatrix row missing for ${findingId}`).toBeDefined();
  return entry!;
}
```

What it does: test helper looked up a `coverageMatrix` row; `expect(...).toBeDefined()` communicates failure to the human but does **not** narrow TypeScript's `find()` result, so the author appended `!`. The warning is the `!`.

**Option A — code fix (preferred per locked decision):** replace the expect+non-null pair with a guard throw; message string preserved verbatim:

```typescript
function row(synthesis: DarkPurpleSynthesis, findingId: string): DarkPurpleSynthesis['coverageMatrix'][number] {
  const entry = synthesis.coverageMatrix.find(row => row.findingId === findingId);
  if (!entry) throw new Error(`coverageMatrix row missing for ${findingId}`);
  return entry;
}
```

- Same failure semantics: a missing row still fails the running test with the same message (a throw inside `it()` fails the test) [ASSUMED: standard vitest behavior — universally exercised in this repo's suites; house throw-in-test style exists: `throw new Error` appears in `src/__tests__/{remote-access-guard,arsenal-validation,adapter-tools,proxy-local-bypass,agent-error-feedback}.test.ts` [VERIFIED: grep 2026-10-13]]
- Removes the warning at the root; no other line in the file (or repo) carries a warning, so the post-fix count is exactly 176 [VERIFIED: census shows this is the file's only warning]
- Renaming the find-callback param `entry`→`row` removes the shadowing of the outer `entry` — cosmetic, keep or drop
- Pin-safety: `purple-v2.test.ts` assertions are untouched; no test weakens

**Option B — narrow suppression (fallback only, requires recorded reason):** insert immediately above line 17:

```typescript
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- row() helper: expect(...).toBeDefined() above reports to humans; TS cannot narrow Array.find()
```

- Line-scoped, single rule, reason in the comment AND in the phase SUMMARY (locked decision requires the recorded reason)
- **Sequencing consequence:** this raises the inline-disable census 5 → 6, so the new ceiling pin must be set to the post-fix census. Choosing Option A keeps the ceiling at 5 — one more reason to prefer A.

## Enforcement Pin (doctor / CI wiring — both targets verified)

### Venue recommendation: doctor check

`npm run test:pr` chains lint → typecheck → test → **doctor** [VERIFIED: package.json:81 `"test:pr": "npm run lint && npm run typecheck && npm test && npm run doctor",`], and CI's PR gate runs `test:pr` [VERIFIED: .github/workflows/ci.yml:34-35]. **A doctor check is therefore enforced locally AND in CI with one implementation** — it "binds most naturally," satisfying the discretion clause.

**Registration pattern** [VERIFIED: scripts/doctor.mjs:11-14]:

```javascript
const checks = [];

function check(name, passed, detail = '', severity = 'block') {
  checks.push({ name, passed: Boolean(passed), detail, severity });
}
```

Exit semantics: `passed: blocks.length === 0 && (!strictMode || warnings.length === 0)`; `process.exitCode = result.passed ? 0 : 1` [VERIFIED: scripts/doctor.mjs:135-152]. Use `severity: 'block'` (default) so a violation fails `test:pr` — this is a gate, not a warning.

**Check 1 — inline-disable ceiling.** Recursively read `src/**/*.ts` (plain `fs.readdir {recursive:true}` walk or per-file reads — no new deps), count occurrences of `eslint-disable`, assert ≤ ceiling. Today's census = **5** [VERIFIED: `grep -rn eslint-disable src/ --include='*.ts'` 2026-10-13]:
- `src/index.ts:414` — `// eslint-disable-next-line no-console` (note: this file is outside the linted scope; the disable is vestigial, but the census is content-based and counts it)
- `src/validation/index.ts:12,14,283,336` — trailing `// eslint-disable-line @typescript-eslint/no-explicit-any` (house per-line justification pattern [VERIFIED: read this session])

**Check 2 — config-diff watch.** Assert `eslint.config.js` still contains the rule/ignores anchors verbatim (guards against `warn→off` downgrades, error→warn softening, ignores-glob growth). Verbatim anchors to assert (all present today) [VERIFIED: eslint.config.js, lines per grep 2026-10-13]:

```
'@typescript-eslint/no-unused-vars': ['warn', {      // line 16
'@typescript-eslint/no-explicit-any': 'warn',        // line 20
'@typescript-eslint/no-non-null-assertion': 'warn',  // line 22
'curly': ['warn', 'multi-line'],                     // line 29
ignores: ['dist/**', 'node_modules/**', '*.js', '*.mjs'],  // line 33
```

Design note: verbatim-substring anchors beat a file hash — they fail exactly on loosening, survive benign reformatting, and self-document. The two legitimate `'off'` rules (`no-console`, `explicit-function-return-type`) must NOT be flagged by a blunt "contains 'off'" check; anchor-assertion sidesteps that trap. Alternative (hash pin of the whole file) is stricter but breaks on any comment edit — acceptable, but noisier.

### Venue alternative: CI step

In the `test` job (runs-on ubuntu-latest, after `npm ci`), add one step adjacent to the existing gate step at ci.yml:34-35:

```yaml
      - name: Hold lint warning baseline
        run: npm run lint -- --max-warnings 176
```

Redundant if the doctor check lands (doctor already rides `test:pr` through CI); choose this only if the planner wants the ceiling visible as a dedicated CI row without touching doctor.

### What the pin must NOT do
- No ceiling ratchet: the ceiling is a constant in the check, never computed from current count at runtime (that would auto-legitimize drift).
- The pin is additive: no existing doctor check is modified or removed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Warning fix (`purple-v2.test.ts:17`) | Source code (test suite) | — | The warning lives in code; only a code change or line-scoped disable removes it |
| Baseline measurement | Repo tooling (`package.json` scripts / eslint CLI) | — | `npm run lint` is the gate; its glob semantics define the number |
| Hold knob (`--max-warnings 176`) | Repo tooling (npm script flag passthrough) | CI step (optional) | Built-in eslint exit-code gate; no new tooling |
| Hygiene pin (ceiling + config watch) | Repo tooling (`scripts/doctor.mjs`) | CI (via `test:pr` chaining) | Doctor already gates `test:pr` locally and in CI |
| Close-out evidence (gate table, ROADMAP/STATE) | Planning docs (`.planning/`) | — | Recorded, measured numbers; owner-visible completion state |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| eslint (flat config) | 9.39.2 | The gate and the count | Already the repo's linter; `npm run lint` [VERIFIED: `npx eslint --version` 2026-10-13; package.json:88] |
| node | v24.18.0 | Runs doctor + fs walk for census | Existing runtime, ≥ engines floor [VERIFIED: `node --version` 2026-10-13] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.9 | Only if planner picks a static-pin *test* venue for the pin | Existing runner; `include: ['src/**/*.test.ts']` [VERIFIED: 21-RESEARCH.md:74 cites vitest.config.ts:17] — not required for the doctor venue |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Doctor check pin | Dedicated CI step | Doctor = one implementation covering local + CI; CI step = dedicated row but duplicates what test:pr already gates |
| Verbatim config anchors | Whole-file sha256 pin | Hash catches any edit (including benign); anchors fail only on real loosening and are self-documenting |
| `npm run lint -- --max-warnings 176` | Custom warning-counter script | Custom scripts re-implement eslint's exit semantics — hand-rolling a gate the CLI already provides |

**Installation:** none. Zero new packages; everything exists. (Milestone constraint: no new runtime dependencies.)

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All work uses the existing eslint 9.39.2 devDependency and node stdlib. No registry lookups required; no `[ASSUMED]` package names anywhere in this research.

## Architecture Patterns

### Measurement / Enforcement Flow

```
src/**/*.ts (unquoted glob → sh expands depth-2 only → 160 files)
        │
        ▼
  eslint 9.39.2 flat config          warn rules: no-unused-vars / no-explicit-any /
        │                            no-non-null-assertion / curly (multi-line)
        │
        ├── errors → must stay 0 (hard gate, npm run lint exit code)
        │
        └── warnings = 177 today ──fix purple-v2.test.ts:17──▶ 176 (close-out measured)
                    │                                             │
                    │                                             ▼
                    │                              npm run lint -- --max-warnings 176
                    │                                (hold knob: exit 1 if > 176)
                    ▼
   doctor (scripts/doctor.mjs, block severity)
        ├── check: inline eslint-disable census in src/**/*.ts ≤ 5
        └── check: eslint.config.js rule + ignores anchors verbatim
                    │
                    ▼
        npm run test:pr = lint && typecheck && test && doctor
                    │
                    ▼
        ci.yml "test" job (PR gate) — step at ci.yml:34-35
```

Primary use case trace: executor fixes line 17 → runs `npm run lint` → reads `✖ 176 problems (0 errors, 176 warnings)` → runs `npm run doctor` (hygiene checks present, 0 blockers) → records both outputs in the close-out gate table → flips ROADMAP:24 checkbox.

### Recommended change shape (no new files needed)
```
src/__tests__/purple-v2.test.ts   # Option A: 2-line edit (or Option B: +1 comment line)
scripts/doctor.mjs                # +~15 lines: two check() calls + small census helper
.planning/ROADMAP.md              # flip Phase 25 checkbox (:24), phase section (:89)
.planning/STATE.md                # v1.4 close entry with measured numbers
.planning/REQUIREMENTS.md         # LINT-01 checkbox + traceability row
.planning/phases/25-.../25-01-SUMMARY.md  # gate table with MEASURED output
```

### Anti-Patterns to Avoid
- **Measuring with a quoted glob** (`"src/**/*.ts"`): measures 178 files / 289 warnings / 16 errors — the wrong universe. Record gate numbers from `npm run lint` output only.
- **Chasing the 16 hidden errors** in this phase: scope widening is new work and breaks the 0-error-intact constraint mid-close-out. Follow-up item.
- **Computing the ceiling from live count**: a ceiling that reads the current census is a tautology, not a pin.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Warning-count gate | A script that parses lint JSON and exits on threshold | eslint's built-in `--max-warnings N` | CLI already implements exact exit semantics; zero drift risk |
| Disable census | Glob library / walker dependency | `fs.readdir` recursive walk or per-file `readFile` in doctor.mjs | ~10 lines stdlib; no new deps allowed |
| Config-diff watch | JS/YAML parser or AST of eslint.config.js | Verbatim substring anchors via `includes()` | Fails only on real loosening; no parse edge cases |
| Per-rule breakdown for receipts | Persistent tooling | One-off `--format json` node one-liner (STACK.md §4 style, depth-2 expansion) | Measurement receipt, not a gate |

**Key insight:** every knob this phase needs already exists in the repo — the entire phase is locate (done, this document), fix (2 lines), pin (~15 lines in doctor), measure (2 commands), record (planning docs).

## Common Pitfalls

### Pitfall 1: Wrong-universe measurement
**What goes wrong:** Executor uses `npx eslint "src/**/*.ts"` (quoted, per STACK.md §4's snippet) and records 289 warnings / 16 errors — or tries to "fix" the 16 hidden errors.
**Why it happens:** Quoted globs delegate to eslint's recursive globby; the npm script's unquoted glob is depth-2 only.
**How to avoid:** All gate numbers come from plain `npm run lint` output; the hold check rides the same script (`npm run lint -- --max-warnings 176`).
**Warning signs:** Any count ≠ 177 pre-fix or ≠ 176 post-fix; any mention of errors in a gate table that previously said 0.

### Pitfall 2: Suppression games (PITFALLS.md §5, verbatim failure modes)
**What goes wrong:** Count drops while hygiene worsens — inline-disable stuffing, rule downgrades/removals, `ignores` growth, `.mjs`/`.js` relocation of linted logic, deletion of real logic, gate-check erosion.
**How to avoid:** Fix-or-justified-disable only; the new pin makes the first two mechanically visible; the config anchors make rule erosion fail doctor; the doctor check itself must be reviewed as a pin (never weakened later).
**Warning signs:** `grep -c eslint-disable src` rises while total warnings fall; diff touches `eslint.config.js`; a new `.mjs` in a src-imported path.

### Pitfall 3: Ceiling sequencing
**What goes wrong:** Pin sets ceiling to 5, then executor picks Option B (suppression) → census becomes 6 → doctor blocks the close-out commit.
**How to avoid:** Decide fix-vs-suppress FIRST (Option A strongly preferred), then set the ceiling to the post-fix census (5 with Option A).

### Pitfall 4: Closing on a remembered number
**What goes wrong:** Gate table copies "176" from the plan instead of pasting measured output.
**How to avoid:** Locked decision: the table records the MEASURED line — `npm run lint` run after the fix, output pasted verbatim.
**Warning signs:** Gate table lacks a command citation or a pasted summary line.

### Pitfall 5: Breaking the 0-error gate while editing
**What goes wrong:** The fix or the doctor edit introduces an eslint error (e.g., malformed TS in the test file), turning "0 errors intact" false even though warnings dropped.
**How to avoid:** Run `npm run lint` (which fails on errors) before committing; `test:pr` catches it at phase gate regardless.

### Pitfall 6: Doctor check breaks unrelated workflows
**What goes wrong:** A block-severity check that's red on some contributor machine (e.g., wrong cwd) poisons `test:pr` everywhere.
**How to avoid:** Census walks repo-relative `src/` from cwd — doctor.mjs already assumes repo-root cwd (its other checks read `package.json` relatively); keep that assumption, document it in the check detail string.

## Code Examples

### Hold knob (gate-grade, scope-exact)
```bash
# Fails (exit 1) if warnings > 176; identical glob scope as npm run lint by construction
npm run lint -- --max-warnings 176
```

### Doctor checks (shape, matching scripts/doctor.mjs conventions)
```javascript
// scripts/doctor.mjs — add before the summary block, after existing checks
async function countInlineDisables() {
  const { readdir, readFile } = await import('node:fs/promises');
  const entries = await readdir('src', { recursive: true, withFileTypes: true });
  let count = 0;
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.ts')) continue;
    const dir = e.parentPath ?? e.path; // node 20+ parentPath
    const text = await readFile(`${dir}/${e.name}`, 'utf8');
    count += (text.match(/eslint-disable/g) ?? []).length;
  }
  return count;
}

const disableCount = await countInlineDisables();
check('Lint hygiene: inline eslint-disable ceiling', disableCount <= 5,
  `${disableCount}/5 inline disables in src/**/*.ts`, 'block');

const cfg = await readFile('eslint.config.js', 'utf8');
const anchors = [
  "'@typescript-eslint/no-unused-vars': ['warn', {",
  "'@typescript-eslint/no-explicit-any': 'warn',",
  "'@typescript-eslint/no-non-null-assertion': 'warn',",
  "'curly': ['warn', 'multi-line'],",
  "ignores: ['dist/**', 'node_modules/**', '*.js', '*.mjs'],",
];
const missing = anchors.filter(a => !cfg.includes(a));
check('Lint hygiene: eslint config not loosened', missing.length === 0,
  missing.length ? `missing/weakened: ${missing.join(' | ')}` : 'all rule + ignores anchors intact', 'block');
```

### The fix (Option A)
```typescript
// src/__tests__/purple-v2.test.ts — replaces lines 15-17 of the row() helper
const entry = synthesis.coverageMatrix.find(row => row.findingId === findingId);
if (!entry) throw new Error(`coverageMatrix row missing for ${findingId}`);
return entry;
```

## What Must NOT Happen (diff baseline)

Locked prohibitions, with the current config as the diff-against reference. **Current `eslint.config.js` in full** [VERIFIED: read 2026-10-13]:

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // General rules
      'no-console': 'off', // Allow console for CLI tool
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['warn', 'multi-line'],  // Allow single-line if without braces
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.mjs'],
  }
);
```

Forbidden diff outcomes against this baseline: any severity change (`warn`→`off`, `error`→`warn`/`off`), any `ignores` addition, any file-top `/* eslint-disable */` banner, relocating warning-generating logic into `*.js`/`*.mjs`/`scripts/`, deleting the flagged helper or its callers to make the count move, and any `--max-warnings` value other than the post-fix measured count (176 if Option A).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No warning hold (warnings never failed the gate) | `--max-warnings` hold knob + hygiene pin | This phase | Drift becomes mechanically visible instead of audit-discovered |

**Deprecated/outdated in-repo claims:**
- STACK.md §4's quoted-glob measurement snippet: measures the wrong universe (289/16). Superseded by this document's scope finding (gate numbers come from `npm run lint` output / depth-2 expansion).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitHub Actions ubuntu-latest expands the unquoted glob the same as local sh (bash default: globstar off) | Gate Scope Semantics | Low — the recommended hold knob routes through `npm run lint --`, so runner shell semantics never matter; only the optional dedicated CI step would care |
| A2 | The 18-file / 16-hidden-error scope gap is owner-follow-up material, NOT phase-25 work | Gate Scope Semantics, Consequence 3 | Scope call, not a technical claim — if the owner disagrees, phase 25 grows a second fix campaign (and the baseline definition changes); planner should surface this at review |
| A3 | A throw inside a vitest `it()` fails that test (guard-throw ≡ expect-toBeDefined in failure semantics) | Fix Surface, Option A | Very low — universal runner behavior, exercised across the repo's suites; if wrong, the helper's tests would still fail (differently) and the suite would catch it immediately |

## Open Questions (RESOLVED)

1. **Pin venue (within Claude's Discretion — resolved recommendation, planner confirms) — ADOPTED by the plan (Task 2 doctor pin):**
   - What we know: doctor check is enforced via `test:pr` locally AND in CI with one implementation; CI step is visible as a dedicated row but redundant.
   - Recommendation: doctor check (two `check()` calls, block severity). Falls squarely in the CONTEXT discretion clause. Adopted — Task 2 implements the two block-severity doctor checks.
2. **Fix option A vs B — ADOPTED by the plan (Task 1 Option A guard-throw):**
   - What we know: A is preferred by the locked decision order ("fix in code first"), keeps the ceiling at 5, and is a 2-line edit with preserved failure semantics.
   - Recommendation: Option A. Reserve B only if review surfaces a reason the helper must keep the expect form. Adopted — Task 1 applies the Option A guard-throw; Option B remains fallback-only with a recorded reason.
3. **Where to register the scope-gap follow-up (A2) — ADOPTED by the plan (Task 3 F-25-01 finding):**
   - What we know: precedent exists — phase 21 registered F-20-01 as an owner follow-up in 21-02-SUMMARY.
   - Recommendation: register the 18-file / 16-error gate-scope gap as a finding in the phase SUMMARY (not silently dropped); owner decides whether v2 widens the gate. Adopted — Task 3 records F-25-01 as an owner follow-up finding in 25-01-SUMMARY.md.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | doctor edit, census walk, all gates | ✓ (verified 2026-10-13) | v24.18.0 | — |
| eslint | measurement, hold knob, fix validation | ✓ (verified 2026-10-13) | 9.39.2 | — |
| npm script passthrough (`--`) | hold knob invocation | ✓ | npm 11.x | unquoted `npx eslint src/**/*.ts --max-warnings 176` (scope-identical) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (existing; only relevant if planner chooses a static-pin *test* venue — the recommended doctor venue adds no tests) |
| Config file | vitest.config.ts (include `src/**/*.test.ts`) |
| Quick run command | `npm run lint` (expect `✖ 176 problems (0 errors, 176 warnings)` after fix) |
| Full suite command | `npm run test:pr` (= lint && typecheck && test && doctor) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINT-01 | Net-new warning eliminated in code | gate | `npm run lint` → 0 errors, 176 warnings, and census of `purple-v2.test.ts` = 0 | ✅ |
| LINT-01 | Hold: warnings ≤ 176 | gate | `npm run lint -- --max-warnings 176` → exit 0 | ✅ |
| LINT-01 | Hygiene pin enforced (ceiling 5 + config anchors) | gate | `npm run doctor` → two hygiene checks present, 0 blockers | ✅ (doctor.mjs) |
| LINT-01 | Full gates green at close-out | gate | `npm run test:pr` → exit 0 | ✅ |
| LINT-01 | No forbidden channels (config byte-identical, no new disables beyond ceiling) | receipts | `git diff --stat HEAD -- eslint.config.js` → empty; doctor hygiene check green | ✅ |
| LINT-01 | Measured count recorded in close-out gate table; ROADMAP/STATE flipped | docs | review of `.planning/ROADMAP.md:24`, `.planning/STATE.md`, SUMMARY gate table | ✅ |

### Sampling Rate
- **Per task commit:** `npm run lint` (0 errors; count must read exactly 176 after the fix) + the touched suite if tests edited
- **Per wave merge:** `npm run test:pr`
- **Phase gate:** full `npm run test:pr` green + measured lint line pasted into the gate table + doctor hygiene checks green, before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test/gate infrastructure covers all phase requirements; no new test files, fixtures, or framework config needed.

## Security Domain

Applicable (config.json absent → enforcement enabled; scoped honestly to this phase's surface):

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No new inputs, routes, or parsers in this phase |
| V2/V3/V4/V6 | no | No auth/session/access-control/crypto surface touched |
| Tamper-evidence (repo gate integrity) | **yes** | The hygiene pin itself: config anchors + disable ceiling + block-severity doctor exit, enforced in CI via `test:pr` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Gate erosion (rule downgrade / ignores growth / disable stuffing to move the count) | Tampering | Verbatim config anchors + ceiling constant in doctor, block severity, CI-enforced |
| Check-the-check erosion (later weakening the doctor hygiene check itself) | Tampering | Pin-review discipline: doctor checks are in the "never weakened" pin family; reviewer verifies additive-only diff |

## Sources

### Primary (HIGH confidence — all read/measured this session, 2026-10-13)
- Direct measurement: `npm run lint` → `✖ 177 problems (0 errors, 177 warnings)`; quoted-glob run → 16 errors / 289 warnings / 178 files; depth-2 expansion run → 0 errors / 177 warnings / 160 files; per-rule census (81 any + 96 non-null = 177)
- `package.json:81,88` — gate chain and lint script (verbatim quoted in doc)
- `eslint.config.js` (full, verbatim quoted) — rules lines 16/20/22/29, ignores line 33
- `src/__tests__/purple-v2.test.ts:14-18` — fix surface (verbatim quoted); unmodified since `4c37232` (git log)
- `scripts/doctor.mjs:11-14,125-152` — check registration + exit semantics
- `.github/workflows/ci.yml:34-35` — PR gate step
- `git show --stat 4c37232`, `git diff --name-only/--diff-filter=A 4c37232..HEAD -- src/` — attribution intersection (empty)
- Disable census: `src/index.ts:414`; `src/validation/index.ts:12,14,283,336` (contexts read)
- `.planning/milestones/v1.3-phases/20-purple-v2-defend-ui/20-01-SUMMARY.md` — gate table "177 warnings (176 pre-existing + 1 net-new)"
- `.planning/v1.3-MILESTONE-AUDIT.md:31` — drift record
- `.planning/research/PITFALLS.md` §5 — suppression failure modes; `.planning/research/STACK.md` §4 — measurement mechanics (with the quoted-glob correction noted above)
- Gate receipts 21-01/02/03, 22-01, 23-01 SUMMARies/VALIDATIONs — "0 errors, 177 warnings" held
- `.planning/REQUIREMENTS.md` (LINT-01), `.planning/ROADMAP.md:13,24,89`, `.planning/STATE.md:42`

### Secondary (MEDIUM confidence)
- None needed — repo-internal research per STACK.md's "execution-only" flag

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; existing tools version-verified this session
- Architecture: HIGH — pin targets read in full (doctor.mjs, ci.yml); enforcement routing verified end-to-end
- Measurement/attribution: HIGH — every number re-measured 2026-10-13; attribution chain closed with git archaeology
- Pitfalls: HIGH — PITFALLS §5 plus a new, measured scope-semantics pitfall

**Research date:** 2026-10-13
**Valid until:** ~2026-11-12 (repo-internal facts; invalidated only by lint-script/config edits or new src changes)
