---
phase: 23-one-risk-signal
plan: "23-01"
subsystem: api
tags: [purple, risk-tier, residual-risk, parity-pin, docs-sync, supersession]

# Dependency graph
requires:
  - phase: 20-purple-v2-defend-ui
    provides: 20-VALIDATION verification map (P20-C1/C2b/C3a/C4 rows re-evidenced here)
  - phase: 22-roe-records
    provides: phase-22 precedent for the SUPERSESSION.md row shape
provides:
  - Single tier-keyed residualRisk writer in src/teams/purple.ts (UNIFY-01)
  - Whole-vocabulary prose↔tier parity pin in teams-modules.test.ts
  - Tier-rendering operators UI, tier-documenting contract doc, tier-relaying skill
affects: [phase-24, phase-25, defend-ui, purple-surface]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 12700
  tasks: 3
  commits: 2
tech-stack:
  added: []
  patterns: ["Record<PurpleRiskTier, renderer> compile-enforced totality for prose derivation", "whole-vocabulary string-equality parity pin (purple-v2 CASES-loop idiom)"]

key-files:
  created: []
  modified:
    - src/teams/purple.ts
    - src/__tests__/teams-modules.test.ts
    - docs/operators.html
    - docs/API_REFERENCE.md
    - grokbot/skills/dark-purple/SKILL.md
    - docsite/t3mp3st-docs/content/API_REFERENCE.md
    - .planning/milestones/v1.3-phases/SUPERSESSION.md

key-decisions:
  - "Strict tier-keyed templates verbatim from the plan table; violation remediation clause dropped per Remediation-clause note"
  - "Two-commit split per dispatch binding: feat (derivation+consumers+supersession) then docs (mirror wholesale)"
  - "Supersession row uses explicit P20-C1/C2b/C3a/C4 tokens for grep-proof acceptance"

patterns-established:
  - "Single prose writer: Record<PurpleRiskTier, (findingId, subject) => string> makes a missing tier a compile error"
  - "Parity pin asserts residualRisk string equality per tier across the whole vocabulary plus adjacency floor/bump rows"

requirements-completed: [UNIFY-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Single tier-keyed prose writer in src/teams/purple.ts; RISK_BY_SEVERITY/riskWord path deleted"
    requirement: "UNIFY-01"
    verification:
      - kind: unit
        ref: "src/__tests__/teams-modules.test.ts#derives residualRisk strictly from riskTier across the whole tier vocabulary"
        status: pass
      - kind: unit
        ref: "src/__tests__/purple-v2.test.ts (16-row tier table, unmodified)"
        status: pass
      - kind: unit
        ref: "src/__tests__/v13-class-probes.test.ts (orphan pin, unmodified)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Consumers cut over: operators Tier column, API_REFERENCE riskTier+derived+vocabulary note, skill tier relay at both points"
    requirement: "UNIFY-01"
    verification:
      - kind: unit
        ref: "src/__tests__/ui-inline-scripts-parse.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Docsite mirror regenerated wholesale via docs:sync; supersession row same-commit; gates green"
    requirement: "UNIFY-01"
    verification:
      - kind: other
        ref: "npm run test:pr → exit 0 (102 files / 1125 tests)"
        status: pass
      - kind: other
        ref: "npm run lint → 0 errors, 177 warnings (at cap, no net-new)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tier cell browser render reads correctly in a real browser"
    verification: []
    human_judgment: true
    rationale: "No harness renders docs/operators.html against a live server; matches the 20-VALIDATION Manual-Only precedent"

# Metrics
duration: 15min
completed: 2026-10-13
status: complete
---

# Phase 23 Plan 23-01: One Risk Signal Summary

**residualRisk prose collapsed into a single Record<PurpleRiskTier, renderer> derivation with whole-vocabulary string-equality parity pins, tier-rendering UI, and wholesale mirror regen**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-13T00:11:00Z
- **Completed:** 2026-10-13T00:27:00Z
- **Tasks:** 3
- **Files modified:** 11 (6 source/test/doc/skill + 5 docsite mirror)

## Accomplishments

- Exactly one prose writer exists in `src/teams/purple.ts`: `RISK_PROSE_BY_TIER`, a `Record<PurpleRiskTier, (findingId, subject) => string>`; `RISK_BY_SEVERITY`/`riskWord`/detection-before-verdict branches deleted (grep over `src/` returns zero hits)
- Whole-vocabulary parity pin in `teams-modules.test.ts`: per-tier `EXPECTED` record with `toBe` string-equality inside a loop over all five tiers, plus adjacency floor/bump rows (medium+none→high, low+none→medium, high+none→critical, covered+violation→high) and missing/empty-title interpolation tests
- Operators UI renders a Tier column (`Shell.escHtml(row.riskTier)` badge); contract doc documents `riskTier`, marks `residualRisk` derived, and carries the PurpleRiskTier vs arsenal RiskTier side-by-side note; dark-purple SKILL.md relays tier at the §6 row relay and the §7 completion summary
- Docsite mirror regenerated via `npm run docs:sync` and committed wholesale (238 insertions across 5 pages, untrimmed); supersession row naming P20-C1, P20-C2b, P20-C3a, P20-C4 committed in the same commit as the `purple.ts` change
- Gates: `test:pr` exit 0 (102 files / 1125 tests), `build` clean, `docs:sync` clean, lint 0 errors with 177 warnings measured (at cap, no net-new)

## Per-Tier Template Table (as implemented — owner review)

Interpolation rule: `{findingId}` is `finding.id` and `{subject}` is the existing ` (title)` suffix or empty string when title is missing or empty. Templates key strictly on the tier: no branch on detection, verdict, or severity.

| Tier | Exact template |
|------|----------------|
| critical | `critical residual risk — {findingId}{subject} sits at the top tier; do not declare the posture acceptable while this row is critical` |
| high | `high residual risk — {findingId}{subject} sits above appetite; do not declare the posture acceptable while this row is high` |
| medium | `medium residual risk — {findingId}{subject} sits at the middle tier; harden the open items on its matrix row before declaring the posture acceptable` |
| low | `low residual risk — {findingId}{subject} sits at a low tier; confirm its matrix row before declaring the posture acceptable` |
| info | `informational residual risk — {findingId}{subject} carries no tiered risk; track its matrix row only` |

## Task Commits

Each task was committed atomically per the plan's binding co-commit rules:

1. **Task 1: Tracer — single tier-keyed prose writer plus whole-vocabulary parity pin** - `c510ba7` (feat: derivation + pin + consumers + supersession row, same commit per binding)
2. **Task 2: Consumer and contract-doc cutover to the single signal** - `c510ba7` (same commit as Task 1 per "every consumer updated in the same commit")
3. **Task 3: Docsite regen, supersession row, and gate receipts** - `e38d657` (docs: mirror wholesale, its own commit per dispatch binding)

## Files Created/Modified

- `src/teams/purple.ts` - `RISK_PROSE_BY_TIER` single writer replaces severity-word composition; row builder derives prose by indexing the Record with the untouched `residualRiskTier()` result
- `src/__tests__/teams-modules.test.ts` - f1/f2 substring pins strengthened to tier + exact-template `toBe`; three new `it` blocks (vocabulary loop, adjacency boundaries, title interpolation)
- `docs/operators.html` - Tier `<th>` header + `row.riskTier` badge cell through `Shell.escHtml`
- `docs/API_REFERENCE.md` - `riskTier` documented, `residualRisk` marked derived, PurpleRiskTier vs arsenal RiskTier vocabulary note
- `grokbot/skills/dark-purple/SKILL.md` - `riskTier` added to the §6 row relay; §7 summary mentions tiers
- `docsite/t3mp3st-docs/content/*.md` (5 pages) - wholesale `docs:sync` regen including the pre-existing stale-mirror catch-up diff
- `.planning/milestones/v1.3-phases/SUPERSESSION.md` - phase-23 row (same commit as derivation)

## Decisions Made

- Template wording used verbatim from the plan's template table; the old covered-branch `pending ROE remediation` clause dropped per the plan's Remediation-clause note (violation follow-up stays covered by unresolved/nextMissions invariants, untouched)
- `subject` keeps the existing title interpolation unchanged (` (title)` or empty)
- New writer is module-local (not exported): totality is compile-enforced via `Record<PurpleRiskTier, …>` and wiring is guarded by the runtime parity pin

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supersession row tokens expanded to explicit P20-C2b/P20-C3a/P20-C4 form**
- **Found during:** Task 3 (gate-receipt check before committing)
- **Issue:** The compact `P20-C1/C2b/C3a/C4` form (mirroring the phase-22 precedent) does not contain `P20-C2b` as a contiguous substring, so a strict acceptance grep for each named row would fail
- **Fix:** Rewrote the row as `20-VALIDATION P20-C1, P20-C2b, P20-C3a, P20-C4`; rebuilt the two local unpushed commits (`reset --soft` to the pre-plan base, re-committed identically) so the same-commit binding still holds
- **Files modified:** .planning/milestones/v1.3-phases/SUPERSESSION.md
- **Verification:** Grep confirms all four tokens present; `vitest` trio re-run green (46 passed) on the rebuilt commits
- **Committed in:** c510ba7 (rebuilt feat commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/acceptance-hardening)
**Impact on plan:** No scope change; the binding (supersession row same-commit as the derivation) is preserved on the final hashes.

## Issues Encountered

None - all verify commands passed on first run (tracer trio 46/46, ui-parse 4/4, build clean, docs:sync clean, test:pr exit 0 with 102 files / 1125 tests, lint 0 errors / 177 warnings).

## Gate Receipts

| Gate | Command | Result |
|------|---------|--------|
| Tracer trio | `npx vitest run src/__tests__/teams-modules.test.ts src/__tests__/purple-v2.test.ts src/__tests__/v13-class-probes.test.ts` | 3 files, 46 tests, all pass (purple-v2 + v13 probes unmodified) |
| Consumer parse | `npx vitest run src/__tests__/ui-inline-scripts-parse.test.ts` | 1 file, 4 tests pass |
| Build | `npm run build` | clean (tsc, no errors) |
| Mirror | `npm run docs:sync` | clean; no `dist/` paths staged (gitignored); manifest/tenants/config byte-identical |
| Lint | `npm run lint` | 0 errors, 177 warnings (at cap 177, no net-new) |
| Full gate | `npm run test:pr` | exit 0: lint + typecheck + 102 files / 1125 tests + doctor (5 optional-tool warnings only) |

## Threat Flags

None - no new security-relevant surface beyond the plan's threat model. T-23-01 mitigated (tier cell through `Shell.escHtml`); T-23-02 mitigated (strict tier-keyed single writer + string-equality parity pin); T-23-03 mitigated (prose marked derived + vocabulary note in source, mirror regenerated same-phase via `docs:sync`, never hand-edited).

## Known Stubs

None - no placeholders, TODOs, or unwired data paths introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UNIFY-01 complete: tier/prose contradiction structurally impossible; API response shape unchanged (field names, set, 400/201 behavior identical; `server.ts` untouched)
- Manual-only remainder: browser render of the new Tier cell has no harness (20-VALIDATION precedent); owner review of the template table above
- No blockers


## Self-Check: PASSED

- All 7 key files verified present on disk; commits `c510ba7` and `e38d657` verified in history
- Acceptance greps re-verified post-commit: zero `RISK_BY_SEVERITY`/`riskWord` hits in `src/`; `Tier` th + `Shell.escHtml(row.riskTier` in operators.html; `riskTier` + `derived` + `PurpleRiskTier` + `local_read` in API_REFERENCE.md; `riskTier` in SKILL.md §6 and `tier` in §7; P20-C1/C2b/C3a/C4 tokens in SUPERSESSION.md
---
*Phase: 23-one-risk-signal*
*Completed: 2026-10-13*
