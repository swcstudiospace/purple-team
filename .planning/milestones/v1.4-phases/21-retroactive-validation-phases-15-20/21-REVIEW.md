---
phase: 21
status: findings
reviewed: 2026-10-12T00:00:00Z
scope: src/__tests__/v13-class-probes.test.ts
---

# Phase 21 Review: v13-class-probes

**Verdict: probes are correct, deterministic, and honest. Two WARNINGs on static-pin strength. No BLOCKERs.**

All six probes were traced to implementation ground truth and each pins its bug
class (not just the fixed instance). All assertions are non-vacuous, all imports
are used, conventions match `white-suite.test.ts` (describe/it, `.js`-suffixed
imports), and the file is pure/deterministic (no mocks, timers, randomness, or
shared state; the only I/O is a synchronous `readFileSync` of two committed
bench scripts).

Ground truth verified this pass:
- `roeAudit` (`src/teams/white.ts:40`): `ACTIVE_PATTERN` matches `nmap`; empty
  `RoeSpec` (`{}`) leaves `allowActive` undefined so unapproved active work
  returns `needs_approval`, never all-`compliant`; explicit `allowActive: false`
  returns `violation` even when approved. All three P19 facets hold.
- `parseRoe` (`src/teams/white/roe-parser.ts:215`): `ok = resolved.length > 0 &&
  unresolved.length === 0`, so `parseRoe('').ok === false`. Fail-closed facet holds.
- `coverageGaps` (`src/teams/blue/coverage.ts:114`) + ontology: `D3-PA` is a real
  id (ontology line 146), `D3-P` is an unresolved prefix lookalike; unresolved
  ids are excluded from `covered`, and `buildGap` appends `reported, not used`
  (coverage.ts:94). All five P15 assertions hold.
- `structuredNoiseBudget` (`src/teams/black/noise.ts:166`): zero vocabulary
  matches yields `cost 0` with rationale `unmatched is not safe`; the probe
  declares egress so no surcharge masks the zero. Both P17 assertions hold.
- `synthesize` (`src/teams/purple.ts:105`): `verdictsByFinding` keyed lookup
  means orphan keys (`NOPE-1/2`) resolve to `undefined` for `F-1`, identical to
  the positional `verdicts: []` base; comparing only `coverageMatrix` (not the
  `correlation` flag, which legitimately differs) is the correct isolation check.
- Bench scripts exist with the asserted strings (`dist/teams/blue` + ``run `npm
  run build` `` in `scripts/detection-coverage-bench.mjs`; `dist/teams/black`
  analogue in `scripts/opsec-review-bench.mjs`).

## WARNING

### WR-01: Static bench pins assert incidental strings, not the dist-pipeline load

**File:** `src/__tests__/v13-class-probes.test.ts:56-61` (P16), `78-83` (P18)
**Issue:** Both pins check `source).toContain('dist/teams/<color>')` and
`toContain('run \`npm run build\`')`. The `dist/teams/...` substring is satisfied
by the file-header comment (e.g. bench line 4: `Scores the REAL blue pipeline
(dist/teams/blue/coverage.js, ...)`) and the throw text alone — neither proves
the bench dynamically imports the real dist pipeline. A vendored-copy regression
that inlines the scorer while leaving the comment and the missing-dist error
string intact would still pass, so the probes under-pin the claimed
"vendored-copy bench" class (false-negative risk). The real load is a dynamic
`import(pathToFileURL(path.join(blue, 'coverage.js'))...)` (bench lines 37-39;
black analogue lines 39-42).
**Suggested fix:** Bind the pin to the load mechanism, e.g. also assert
`source).toContain('import(')` (or `pathToFileURL`) in proximity to the dist
path, or assert the absence of a vendored scorer (e.g. `not.toContain('function
coverageGaps')` / `not.toContain('function structuredNoiseBudget')` in the bench
source). Apply symmetrically to P16 and P18.

## INFO

None.

---

_Reviewer: Review21 (gsd-code-review)_
_Depth: standard + targeted ground-truth tracing_
_Files reviewed: src/__tests__/v13-class-probes.test.ts (plus white.ts, roe-parser.ts, coverage.ts, noise.ts, purple.ts, both bench scripts as evidence)_
