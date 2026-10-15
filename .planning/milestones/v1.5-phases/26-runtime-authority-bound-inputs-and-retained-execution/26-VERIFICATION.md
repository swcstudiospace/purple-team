---
status: passed
phase: 26-runtime-authority-bound-inputs-and-retained-execution
verified: 2026-10-15
score: 5/5 success criteria verified in source
commits:
  - 889e34d
  - f030c41
  - e07491a
  - c7e3020
  - "8172833"
  - b37138f
suite_observed: npm test exit 0 (102 files, 1156 tests passed; ops preflight 11/11; model-matrix 19/19); npx tsc --noEmit exit 0
known_controller_gap: FH-EXEC-4 unmounted (swarm_amend not mounted in this host); not a product-criterion failure
---

# Phase 26 Verification Report — Runtime Authority, Bound Inputs and Retained Execution

**Goal (ROADMAP.md):** Operators can submit scoped, role-authorized mission/task inputs, receive immutable origin-bound identities and retrieve retained real outcomes while existing Red starts and execution remain usable.

**Method:** source inspection of the six product commits listed above against the five ROADMAP Phase 26 success criteria. Suite results are orchestrator-observed (not rerun by this verifier). A criterion passes only if the behavior exists in product source, not merely in a SUMMARY claim.

## Criterion results

### SC1 — Source-linked Red inventory; 17 roles → exactly four disciplines, Purple synthesis-only — PASSED

- `src/teams/contracts.ts`: `RED_WORKFLOW_INVENTORY` — eight rows, every row cites a real source path; the five workflow prompts with no implementation carry an explicit `unavailable: ...` label rather than a fake path.
- `DISCIPLINES = ['red','blue','black','white']`; `RED_ARCHETYPES` (8) + `SPAWNABLE_ARCHETYPES` (8 Red + 3 teams + 6 hats = 17); `disciplineOf()` returns the parent discipline and throws for purple/unknown ("purple never spawns").
- `src/teams/hats.ts`: `hatTeam` maps specter/wraith→black, sentinel/warden→blue, arbiter/auditor→white; unknown hats throw. `src/types/index.ts`: 17-role `OperatorArchetype` union, no purple member.
- Q1 pins in `teams-archetypes` / `hats-archetypes` cover the discipline map and purple-spawn rejection.

### SC2 — Genuine authorized Red tracer; legacy compatible; roles validated; Blue families defensive; unavailable hats honest — PASSED

- `src/server.ts` `POST /api/mission/start`: discriminator is presence of `roleInputs`/`family`/`targetContext` (`isStructuredStart`); `inlineArtifacts` alone never flips the branch. Legacy target-only path preserved.
- Structured path: `validateStructuredStart` requires objective + known nonempty unique roles (400 naming the offending role, duplicate rejected) before `createTempestCommandInstance`; artifact hash bound in the same synchronous turn before the tick arms; spawn per validated role; spawn throw yields `unavailable` with retained `runId`, never model prose. Artifact-only (`targetContext.kind: artifacts`) inserts no targets, never calls `generateTasksForTarget`.
- `src/teams/index.ts`: `FAMILY_TEAM_MAPPING` blue entry gains `ai_red_team` and `agent_warfare`; black entries kept; no grant id list touched (family routes, never grants).
- `src/agent/index.ts`: frozen per-run allowlist resolved once at construction via `resolveRunAllowlist` (Red freezes `redDefaultTools`, teams/hats freeze catalog grants, Blue/White never freeze probe-grade defaults, unknown→deny-all caught as `[]`); `executeTool` passes it into `Arsenal.execute` on every call.

### SC3 — Forbidden/invalid/out-of-scope/unapproved fail before handler, zero effects; isolation; poisoned-input safe; no leakage — PASSED

- `src/arsenal/index.ts` `execute(..., runAllowlist?)`: after tool lookup, before scope gate and handler — unknown name throws `ToolNotFound`; name outside the set returns `AUTHORITY DENIED` result with zero handler invocation; omitted set preserves library/test mode; empty set denies all; nothing stored on the shared instance.
- `src/operators/index.ts` `decomposeTask`: authority-denial failures (denied/not-authorized/out-of-scope/needs-approval/unapproved/unavailable/permission-denied/forbidden) return `[]` before any LLM call; task text stays data, grants never read from task text, `defaultTools` profiles never authority.
- `src/validation/index.ts` `validateBoundArtifactFields`: envelope + per-field bounds through the shared `validateToolArgs` path; media/encoding enum + 64 KiB byte check.
- Hash-before-redaction ordering, hyphenated digests (`artifactHash` emits four 16-hex groups, never bare 64-char hex), no secret-named fields; cross-role/cross-mission leakage fixtures green per observed suite.

### SC4 — Bounded inline artifacts, server-computed hashes, atomic binding; claimed vs observed receipts — PASSED

- `src/teams/contracts.ts`: `INLINE_ARTIFACT_*` (text/plain, utf8, max 1 element, 64 KiB cap); `artifactHash` server-side sha256 via `node:crypto`; caller id treated as label only (`label` field); `bindInlineArtifacts` validates/hashes; both server branches bind before any mission state (400/413, no mission on failure).
- `src/server.ts`: private `recordReceipt` is the only minter of `origin: observed` with full run/mission/stage/tool/input-hash/item binding; first honest hook is successful `parseRoe` on the existing PUT (nothing on parse failure, nothing from GET); public `POST /api/evidence` ignores `body.origin` (`EvidenceEntry` has no origin field); historical rows stay unlabeled, no backfill, no public receipt-minting route.
- `docs/RUNTIME_CONTRACT_PHASE26.md` (new, plan-owned): documents discriminator, caps, validation errors, receipt boundary, unavailable behavior, honest cancellation, absent-route statement (`POST /api/mission/artifacts` does not exist), and FH-EXEC-4 unmounted statement. `API_REFERENCE.md` deliberately untouched (unrelated user rebrand hunks left alone) — no divergence introduced.

### SC5 — Retained attribution within finite bounds; honest cancellation — PASSED

- `src/server.ts`: `observedReceipts` + `operatorTaskRuns` ledgers with snapshot slot; restore drops forged `origin: observed` rows and marks pending/running runs `interrupted` with `executionSettled: true` (never resumed).
- `src/mission/index.ts`: `completeForMission` is mission-pinned (false on mismatch, never retargets); `createMission` takes no caller id by construction. `src/index.ts`: `ensureMission` documents start-only creation; staged artifact consumed before tick arms. No behavior change to finite bounds (no new scheduler; existing maxRetries/timeout/iteration constants unchanged).
- Stop answers `{ success: true, message: 'Mission stopped', cancelAcknowledged: false }`; no cancel route added; scheduler stop / transport abort never masquerades as acknowledged termination/resume.

## Known non-blocking gap

- **FH-EXEC-4 remains unmounted** (`swarm_amend` not mounted in this host, `ULTRATHINK_SWARM_ROOT` unset). This is the documented controller prerequisite gap, explicitly stated in `docs/RUNTIME_CONTRACT_PHASE26.md` and both plan summaries. It is not a product-criterion failure: no product code invokes `orch_amend.py`, invents a signature, re-leases DONE tasks, or claims the amendment closed.

## What was NOT claimed

- No milestone acceptance (Phase 29 owns that). No Blue/Black/White substantive engines (Phase 27), no UI/MCP/skill consumers (Phase 28), no new routes/scheduler/store/dependencies. STATE.md/ROADMAP.md untouched. User WIP left uncommitted; only plan-owned paths staged.

## Verdict

Phase 26 goal met: all five success criteria are implemented in source and covered by the observed-green suite.

status: passed

## VERIFICATION PASSED
