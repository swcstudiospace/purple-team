# Phase 26 Plan 01: Runtime Tracer Summary

**Phase:** 26-runtime-authority-bound-inputs-and-retained-execution / Plan 01
**Status:** complete
**Commits:** 889e34d (tracer), f030c41 (Q1 coverage)

## Objective
End-to-end tracer on the existing Express process: legacy Red start
compatibility, one structured role-bound start with a bounded inline artifact
and server-computed hash, and the role-denial gate proving a forbidden tool
never reaches its handler.

## What was built
- `src/teams/contracts.ts` (new): eight-Red-workflow inventory rows citing
  real source paths with `unavailable` labels for the five missing workflow
  prompts; bounded inline artifact contract (text/plain, utf8, single
  element, 64 KiB cap, server-issued id, caller id as label); server-side
  sha256 helper emitting four 16-hex groups joined by hyphens;
  `resolveRunAllowlist` over teamToolGrants/hatToolGrants with unknown roles
  throwing (callers catch as deny-all); `isStructuredStart` discriminator and
  `validateStructuredStart` (objective/roles/uniqueness, 400 naming the role,
  minted runId, artifact-only flag).
- `src/types/index.ts`: DTO unions only (StructuredRoleInput,
  InlineArtifactInput, BoundInlineArtifact, MissionTargetContext,
  StructuredMissionStart). No purple added.
- `src/arsenal/index.ts`: `execute` takes an optional per-call `runAllowlist`.
  After tool lookup and before the scope gate: unknown name still throws
  ToolNotFound; name outside the set returns an AUTHORITY DENIED result with
  zero handler invocation; omitted set preserves library/test mode; empty set
  denies all; nothing stored on the shared instance.
- `src/agent/index.ts`: `AgentLoopOptions.role` + `redDefaultTools`; the
  frozen set resolves once at construction (Red freezes defaultTools, teams
  and hats freeze catalog grants, Blue/White families never freeze
  probe-grade defaultTools, unknown role caught as deny-all) and
  `executeTool` passes it into `Arsenal.execute` on every call. Denial
  returns a result and never throws into decompose.
- `src/server.ts`: POST /api/mission/start branches on presence of
  roleInputs/family/targetContext; inlineArtifacts alone never flips the
  branch. Artifacts validate/hash before any mission state on both branches
  (400/413, no mission on failure). Structured validates before
  createTempestCommandInstance, binds the staged hash in the same synchronous
  turn before the tick interval arms, spawns per validated role (spawn throw
  yields `unavailable` with retained runId, never model prose), and returns
  runId + artifact hash + attributable run. Artifact-only
  (`targetContext.kind: artifacts`) inserts no targets and never calls
  generateTasksForTarget. POST /api/evidence still cannot set origin
  (EvidenceEntry has no origin field; body.origin ignored).
- Q1 tests: 15 new cases in teams-modules (branch, unknown/duplicate role,
  run-id identity, artifact bounds) and 12 in hats-modules (denial with zero
  handler calls incl. end-to-end via AgentLoop, empty grant, grant
  isolation, discipline map, purple rejection). No existing assertion
  modified or removed.

## Verify results (exit 0)
- `npx vitest run src/__tests__/teams-archetypes.test.ts src/__tests__/hats-archetypes.test.ts src/__tests__/arsenal-approval-gate.test.ts` — 33 passed
- `npx vitest run src/__tests__/teams-modules.test.ts src/__tests__/hats-modules.test.ts` — 76 passed
- `npx vitest run src/__tests__/teams-archetypes.test.ts src/__tests__/hats-archetypes.test.ts` — 25 passed
- Regression: agent-parallel, agent-error-feedback, arsenal-scope-gate,
  arsenal-validation, approval, local-api-hardening-static — 66 passed
- `npx tsc --noEmit` — clean

## Deviations
None — plan executed as written. Two inline fixes, both in-plan: `Required<>`
strips explicit `| undefined` under TS 5.9 (options field retyped as
Required<Omit<…>> & Pick<…>), and `64 * 1024 as const` replaced with a typed
numeric const.

## Not claimed
FH-EXEC-4 remains unmounted; no new routes, scheduler, store, or
dependencies; no API_REFERENCE.md changes; STATE.md/ROADMAP.md untouched.
User WIP left uncommitted; only the seven plan-owned paths were staged.
