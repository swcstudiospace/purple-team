# Phase 28 Plan 02: Operators staged consumers Summary

## One-liner
Stage-review forms on operators.html (blue/black/white) with fail-closed live announcements plus a matching HTML-assertion test.

## What was done
- Added a "Stage review" section to `docs/operators.html` immediately after the Specialist hats section and before the Dark Purple synthesis section, with three forms (`opBlueStage`, `opBlackReview`, `opWhiteStage`), three `role="status"` / `aria-live="polite"` live regions, labeled inputs, and Retry buttons. No autofocus, no new page, no dispatch button; the Purple synthesize button is untouched.
- Added a new `<script>` immediately after `<script src="assets/shell.js"></script>` with submit/Retry handlers that `preventDefault`, post via `Shell.apiPost` to `/api/teams/blue/coverage`, `/api/teams/black/workflow`, and `/api/teams/white/stage`, announce only through `Shell.escHtml` into the live regions, and resubmit retained values on retry.
- Created `src/__tests__/phase28-staged-consumers.test.ts` in the style of `phase28-defend-form.test.ts`, asserting the form ids, label bindings, live regions, the three `Shell.apiPost` routes, `Shell.escHtml`, `artifactBytes`, the `not a clean bill` / `out of scope` / receipt copy, and the absence of `id list alone is coverage`.

## artifactBytes correction versus defend.html
- `docs/defend.html` posts blue coverage without `artifactBytes` and without `telemetry`, so an empty artifact throws a 400 validation error instead of reaching the server's insufficient-evidence branch.
- The new operators blue handler always sends `artifactBytes` (raw string, may be empty) and `telemetry: []`, with `artifactIds` fail-closed (`[]` when the id is blank), so empty bytes reach the insufficient-evidence branch and announce `fail-closed`, never covered.

## Commit
No commit was made. The commit was left to the orchestrator because the tree holds uncommitted rebrand WIP that must not be staged or committed by this task.
