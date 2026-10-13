---
phase: 25-lint-re-baseline-close-out
plan: 01
subsystem: testing
tags: [eslint, lint-baseline, doctor, guard-throw, vitest, close-out]

# Dependency graph
requires:
  - phase: 24-ops-evidence-on-this-host
    provides: [phase-close gate discipline; running lint count 177 carried into close-out]
provides:
  - Guard-throw fix in purple-v2 row() helper; measured baseline 176 with 0 errors
  - Doctor lint-hygiene pin (inline-disable ceiling 5 + eslint.config.js anchors) at block severity
  - Hold knob `npm run lint -- --max-warnings 176` proven exit 0
  - F-25-01 owner follow-up finding (18-file gate-scope gap)
affects: [verify-work, ship, v2-lint-scope]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 2600
  tasks: 3
  commits: 3
  plan_head_before: c77c4f6036ae935b37a34926e37ec6a361fbd2e0

# Tech tracking
tech-stack:
  added: []
  patterns: [guard-throw-narrows-find, verbatim-anchor-config-watch, census-ceiling-pin, hold-knob-max-warnings]

key-files:
  created:
    - .planning/phases/25-lint-re-baseline-close-out/25-01-SUMMARY.md
  modified:
    - src/__tests__/purple-v2.test.ts
    - scripts/doctor.mjs
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Option A guard-throw (locked D-fix-in-code-first): message string verbatim, same failure semantics, ceiling stays 5"
  - "Doctor venue for the hygiene pin (Claude's Discretion): one implementation gates local + CI via test:pr"
  - "F-25-01 scope gap registered as owner follow-up, NOT phase work (F-20-01 precedent)"

patterns-established:
  - "Measured-number close-out: gate table pastes the lint summary line verbatim with command citation"
  - "Ceiling is a literal constant, never computed from the live count"

requirements-completed: [LINT-01]

coverage:
  - id: D1
    description: "Phase-20 net-new warning fixed in code; plain npm run lint reads exactly 176 with 0 errors"
    requirement: "LINT-01"
    verification:
      - kind: other
        ref: "npm run lint → `✖ 176 problems (0 errors, 176 warnings)`"
        status: pass
      - kind: unit
        ref: "src/__tests__/purple-v2.test.ts (11 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Doctor lint-hygiene pin (ceiling 5 + config anchors) green at block severity; hold knob exit 0"
    requirement: "LINT-01"
    verification:
      - kind: other
        ref: "npm run doctor → both hygiene checks ok, 0 blockers"
        status: pass
      - kind: other
        ref: "npm run lint -- --max-warnings 176 → exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full test:pr green; ROADMAP/STATE/REQUIREMENTS reflect LINT-01 completion; F-25-01 registered"
    requirement: "LINT-01"
    verification:
      - kind: other
        ref: "npm run test:pr → exit 0 (lint 176/0, typecheck clean, vitest 102/1125, doctor 0 blockers)"
        status: pass
    human_judgment: false

duration: ~12min
completed: 2026-10-13
status: complete
---

# Phase 25 Plan 01: Lint Re-baseline & Close-Out Summary

**Baseline restored to a measured 176 with 0 errors via guard-throw fix, pinned by two block-severity doctor checks, full test:pr green, scope gap honestly registered as F-25-01.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-10-13T02:04:40Z
- **Tasks:** 3
- **Files modified:** 6 (2 code + 4 planning)

## Accomplishments

- Phase-20 net-new warning (`purple-v2.test.ts:17` non-null assertion) fixed in code with the failure message verbatim; file carries 0 warnings; purple-v2 suite 11/11 green
- Measured baseline exactly 176 warnings / 0 errors on the unquoted gate scope; hold knob proven exit 0
- Lint-hygiene pin enforced in doctor at block severity inside the test:pr chain (local + CI)
- Milestone closes on measured numbers: ROADMAP Phase 25 flipped, STATE close entry, REQUIREMENTS LINT-01 checked

## Close-Out Gate Table (all rows MEASURED this phase, 2026-10-13)

| Gate | Command | Result |
|------|---------|--------|
| lint | `npm run lint` | `✖ 176 problems (0 errors, 176 warnings)` |
| lint file census | `npm run lint` output grep | `src/__tests__/purple-v2.test.ts` absent — 0 warnings |
| hold knob | `npm run lint -- --max-warnings 176` | exit 0, same `✖ 176 problems (0 errors, 176 warnings)` line |
| typecheck | `npm run typecheck` (`tsc --noEmit`) | clean, exit 0 |
| vitest | `npx vitest run src` | 102 files / 1125 tests passed |
| unit pin | `npx vitest run src/__tests__/purple-v2.test.ts` | 1 file / 11 tests passed |
| doctor | `npm run doctor` | 30/35 checks passed, 5 warning(s) (pre-existing optional-tool/API-offline warns), 0 blocker(s); both `Lint hygiene:` checks `ok` |
| full chain | `npm run test:pr` | exit 0 |
| config guard | `git diff --stat HEAD -- eslint.config.js` | empty (byte-identical) |

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — fix the phase-20 net-new warning and measure 176** - `42a9191` (fix)
2. **Task 2: Lint-hygiene pin in doctor plus hold-knob proof** - `836013f` (feat)
3. **Task 3: Close-out evidence (this SUMMARY + milestone surfaces)** - docs close-out commit (this commit; hash in PLAN COMPLETE receipt)

## Files Created/Modified

- `src/__tests__/purple-v2.test.ts` - row() helper: expect+`!` pair replaced by guard throw (`if (!entry) throw new Error(...)` verbatim message), find-callback param renamed entry→row; test bodies untouched
- `scripts/doctor.mjs` - `readdir` import + two block-severity checks: inline-disable census ceiling 5 (recursive `src/**/*.ts` walk, `eslint-disable` substring count) and eslint.config.js five verbatim anchors (no-unused-vars / no-explicit-any / no-non-null-assertion warns, curly multi-line, ignores line)
- `.planning/phases/25-lint-re-baseline-close-out/25-01-SUMMARY.md` - this file: gate table + F-25-01
- `.planning/ROADMAP.md` - Phase 25 checkbox flipped, Phase 25 section completed
- `.planning/STATE.md` - current position + metrics + decision entries
- `.planning/REQUIREMENTS.md` - LINT-01 checkbox + traceability row → Complete

## Decisions Made

- Option A guard-throw per locked decision D-fix-in-code-first; Option B fallback unused, no recorded reason needed
- Doctor (not CI-step) venue per Claude's Discretion: rides `test:pr` locally and in CI with one implementation
- Census-before-config check order in doctor; ceiling literal `5`, never derived from the live count

## Deviations from Plan

None - plan executed exactly as written.

## Finding F-25-01 (owner follow-up, NOT phase work)

**Gate-scope gap: 18 never-linted files carrying 16 hidden errors + 112 hidden warnings.** The gate script `eslint src/**/*.ts` runs unquoted, so sh expands `**` as `*` and lints exactly 160 depth-2 files. The quoted recursive glob (`npx eslint "src/**/*.ts"`) reaches 178 files with 16 errors / 289 warnings. Largest out-of-scope carriers: `src/server.ts` (101w/2e), `src/index.ts` (3w/5e), `src/cli.ts` (3w/5e), `src/redact.ts` (0w/3e). Widening the scope would break the 0-error-intact constraint mid-close-out and is new work; per the F-20-01 precedent (registered in 21-02-SUMMARY), the owner decides in v2 whether to widen the gate. Scope was NOT widened in this phase.

## Issues Encountered

None - every verify command passed on first run (lint 176/0, vitest 11/11, doctor 0 blockers, hold-knob exit 0, test:pr exit 0).

## Threat Flags

None - no new network endpoints, auth paths, file-access patterns, or schema changes. The doctor diff is strictly additive (one import widened, two `check()` calls); no existing check modified; zero new dependencies (T-25-SC clean); eslint.config.js untouched (T-25-01 clean); no new disables (T-25-02 clean, census still 5/5).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- v1.4 milestone closes: LINT-01 complete, all owner-visible surfaces flipped
- Owner decision queued: F-25-01 gate-scope widening (v2 candidate alongside per-rule lint budgets)
- Verify-work / ship may proceed on the measured close-out evidence above

---
*Phase: 25-lint-re-baseline-close-out*
*Completed: 2026-10-13*

## Self-Check: PASSED
