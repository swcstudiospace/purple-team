# Phase 22-01: Review Disposition (ROE Text as Server State)

Source review: `22-REVIEW.md` (diff `d79fea9`, 0 BLOCKER / 1 WARNING / 1 INFO).
Fix commit: `e219d3b` — all findings below land in that single atomic commit.

| Finding | Severity | Status | Fix SHA | Change |
|---------|----------|--------|---------|--------|
| WR-01: GET shape guard misses element-level action corruption | WARNING | fixed | `e219d3b` | GET guard now mirrors the PUT element predicate (`!a \|\| typeof a !== 'object' \|\| Array.isArray(a)`) via `actionsOk`, so null/undefined elements fall to the 200 cannot-derive report instead of a 500 inside `roeAudit`. |
| IN-01: Restored-record scalars trusted verbatim | INFO | fixed | `e219d3b` | PUT coerces `prevRevision` via `Number.isFinite` (non-finite → 0) and `createdAt` via string check; GET treats non-numeric `revision` / non-string timestamps as corrupt (`revisionOk`/`timestampsOk`) → 200 cannot-derive, no new status codes. |

Pins added (sharpen-only) in `src/__tests__/roe-store-pins.test.ts`: null-element GET rejection; non-numeric-revision coercion.

Verification (real output, pre-commit): `vitest run` on `roe-store-pins` + `white-routes-static` + `white-suite` → 3 files / 36 tests passed; `npx tsc --noEmit` exit 0; `npm run lint` → 0 errors, 177 warnings.
