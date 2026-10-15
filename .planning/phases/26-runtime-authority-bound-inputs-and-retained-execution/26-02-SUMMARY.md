# Phase 26 Plan 02: Authority-Bound Inputs and Retained Execution Summary

**Phase:** 26-runtime-authority-bound-inputs-and-retained-execution / Plan 02
**Status:** complete
**Commits:** c7e3020 (task 1), 8172833 (task 2), plus task-3 commit below

## Objective

Expansion from the proven 26-01 tracer: family routing, scope/approval
gate preservation, claimed-versus-observed receipts, retained attributed
lifecycle, poisoned-input isolation, and the operator-facing contract.

## What was built

- `src/teams/index.ts`: blue `FAMILY_TEAM_MAPPING` gains `ai_red_team`
  and `agent_warfare`; black entries kept; no grant id list touched.
  (One edit dropped the white entry; restored verbatim in the next edit —
  verified identical to the original line.)
- `src/teams/hats.ts`: no change (parent map stays, no new hat, unknown
  hat still throws) — verified by untouched Q1 pins.
- `src/operators/index.ts`: `decomposeTask` refuses authority-denial
  failures (denied/not-authorized/out-of-scope/needs-approval/unapproved/
  unavailable/permission-denied/forbidden) before any LLM call; task text
  stays data, grants never read from task text, `defaultTools` profiles
  never authority.
- `src/validation/index.ts`: `validateBoundArtifactFields` — envelope
  (array, max 1) plus per-field bounds through the shared
  `validateToolArgs` path plus media/encoding enum and 64 KiB byte check.
  No per-tool condition chains; no minting (bind stays in contracts.ts).
- `src/server.ts`: private `recordReceipt` (only minter of
  `origin: observed`, full run/mission/stage/tool/input-hash/item
  binding); `observedReceipts` + `operatorTaskRuns` ledgers; PUT ROE
  hook mints one receipt on `parseRoe` ok only; `POST /api/evidence`
  ignores `body.origin`; snapshot slot for both ledgers; restore drops
  forged observed rows and marks pending/running runs `interrupted` with
  `executionSettled: true`; stop answers `cancelAcknowledged: false`;
  no cancel route added.
- `src/index.ts`: `ensureMission` documents start-only creation,
  pending-targets label never an artifact-only target, staged artifact
  consumed before the tick arms. No behavior change.
- `src/mission/index.ts`: `completeForMission` (mission-pinned
  completion, false on mismatch, never retargets); `createMission`
  documents server-minted ids (no id param by construction).
- `src/__tests__/teams-archetypes.test.ts`: +2 (blue family routing with
  unchanged read-only grants; probe-grade profiles not authority).
- `src/__tests__/hats-archetypes.test.ts`: +3 (late result cannot
  retarget; stop source pin incl. no cancel route; snapshot slots behind
  the scrub).
- `docs/RUNTIME_CONTRACT_PHASE26.md` (new, plan-owned): adopted
  discriminator, artifact caps, validation errors, receipt boundary,
  unavailable behavior, honest cancellation, absent-route statement,
  FH-EXEC-4 unmounted statement, unchanged bounds.

## Verify results (exit 0)

- Task 1: teams-archetypes + arsenal-validation + arsenal-scope-gate +
  arsenal-approval-gate — 50 passed.
- Task 2: teams-modules + hats-modules + redact — 83 passed.
- Task 3: teams-archetypes + hats-archetypes — 30 passed (25 prior + 5 new).
- `npx tsc --noEmit` — clean (run with each suite).

## Deviations

- **API_REFERENCE.md untouched by design.** The file already carries
  unrelated user rebrand hunks in the dirty tree; per assignment the
  contract notes went into plan-owned `docs/RUNTIME_CONTRACT_PHASE26.md`
  and API_REFERENCE.md was left unstaged. No user diff reverted.
- `isAuthorityDenial` was first added as a module helper inside the class
  body (syntax break, caught immediately); inlined the regex into
  `decomposeTask` instead — also satisfies the no-tiny-function rule.
- Dispatch `allTargets[0]` fallback kept for legacy seeded/chase tasks
  (both embed or miss addresses unpredictably); attribution retention is
  enforced at the completion layer (`completeForMission`) and the restore
  layer instead. No missionId fallback exists in dispatch; dispatch
  creates no mission (only `start()` → `ensureMission` does).

## Not claimed

FH-EXEC-4 remains unmounted; no `orch_amend.py` invocation; no new
routes, scheduler, store, or dependencies; STATE.md/ROADMAP.md untouched;
user WIP (incl. `src/mcp-server.ts`, API_REFERENCE.md rebrand) left
uncommitted — only plan-owned paths staged.

## Self-Check: PASSED

- Plan-owned files exist; `git log` shows c7e3020, 8172833 (+ task-3).
- No stubs: no TODO/placeholder/mock additions; receipt/run ledgers are
  live code paths, not scaffolds.
