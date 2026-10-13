---
phase: 22-roe-text-as-server-state
plan: 01
subsystem: api
tags: [express, roe, provenance, redaction, fail-closed, vitest, bench]

# Dependency graph
requires:
  - phase: 19-white-suite
    provides: [white routes, static honesty pins, roe-adjudication bench + corpus]
  - phase: 21-retroactive-validation
    provides: [SUPERSESSION.md append-only rule, 19-VALIDATION per-task map]
provides:
  - roeRecords single-slot store with snapshot/restore in src/server.ts
  - PUT /api/teams/white/roe (validation, 64 KiB cap, revision/textHash stamping)
  - fail-closed GET /api/teams/white/roe (parse + provenance-stamped verdicts iff ok:true)
  - sharpened static pins, store wiring pins, live PUT guard cases
  - stored-record-provenance bench case + regenerated report
  - synced API/MCP/skills honesty surfaces + phase-19 supersession row
affects: [23-unify, white-arbiter-skill, dark-purple-skill, mcp-proxy]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 6944
  tasks: 3
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns: [single-slot latest-record store with snapshot/restore, in-handler byte cap, recompute-and-compare integrity gate, per-verb static route pins]

key-files:
  created: [src/__tests__/roe-store-pins.test.ts]
  modified: [src/server.ts, src/__tests__/white-routes-static.test.ts, src/__tests__/remote-access-guard.test.ts, bench/roe-adjudication/corpus.json, bench/roe-adjudication/report.json, docs/API_REFERENCE.md, docs/MCP_GUIDE.md, src/mcp-server.ts, grokbot/skills/white-arbiter/SKILL.md, grokbot/skills/dark-purple/SKILL.md, .planning/milestones/v1.3-phases/SUPERSESSION.md]

key-decisions:
  - "Single atomic commit for all three tasks per the plan's same-commit bindings (pins sharpen same-commit; supersession row same-commit as the surface-mutating change)"
  - "Hash-mismatch converges on the kept empty-state cannot-derive report (no separate corrupt wording) per research OQ1 resolution"
  - "SUPERSESSION.md Commit column cites the feat(22-01) subject, not the hash — a same-commit hash is a self-reference paradox"

requirements-completed: [ROE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "PUT stores a stamped latest ROE record; GET returns parse plus provenance-stamped verdicts iff parseRoe is ok:true, else a 200 cannot-derive report with no verdicts"
    requirement: "ROE-01"
    verification:
      - kind: unit
        ref: "white-routes-static.test.ts + roe-store-pins.test.ts + remote-access-guard.test.ts + v13-class-probes.test.ts (30 tests pass)"
        status: pass
      - kind: manual_procedural
        ref: "loopback smoke: PUT→GET (verdicts carry roeRevision 1, roeTextHash, roeLines [1,2]) → PUT (revision 2, createdAt preserved) → empty-text 400, oversize 413 → wipe state + restart → 200 cannot-derive"
        status: pass
    human_judgment: false
  - id: D2
    description: "stored-record-provenance bench case proves the text-to-parse-to-verdict chain with regenerated deterministic report"
    requirement: "ROE-01"
    verification:
      - kind: unit
        ref: "roe-adjudication-bench.test.ts (passes against regenerated report)"
        status: pass
      - kind: other
        ref: "node scripts/roe-adjudication-bench.mjs → ALL PASS (13/13 cases, 27/27 adjudication)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Docs, MCP description, both skills, and the phase-19 supersession row agree with shipped route behavior"
    requirement: "ROE-01"
    verification:
      - kind: other
        ref: "grep for stale claims (until a real source lands, no ROE text is on record yet, no server state carries ROE text today, no second store) → no matches"
        status: pass
    human_judgment: true
    rationale: "Wording and naming of the synced honesty surfaces need a human read; the behavior behind them is smoke-verified in D1."

# Metrics
duration: 9min
completed: 2026-10-12
status: complete
---

# Phase 22 Plan 01: ROE Text as Server State Summary

**Sanctioned single-slot ROE store with a validated PUT route and a fail-closed provenance-stamped GET, sharpened pins, bench evidence, and lockstep surface sync**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-12T23:20:05Z
- **Completed:** 2026-10-12T23:30:00Z
- **Tasks:** 3
- **Files modified:** 12 (1 created, 11 modified)

## Accomplishments

- Operator PUTs `{ text, actions }` to `PUT /api/teams/white/roe`; GET returns deterministic parse plus `roeAudit` verdicts when and only when `parseRoe` is `ok:true` — `ok:false` responses carry no `verdicts` key
- Every verdict carries provenance: stored `revision`, 16-char `textHash` (below the 40-char self-redaction floor), and `parse.resolved` line refs; provenance stamps come from stored fields only
- Missing, corrupt, or hash-mismatched state fails closed to a 200 cannot-derive report; empty-string text → 400; oversize text → 413 via the in-handler 64 KiB `Buffer.byteLength` check; `roeAudit(actions, {})` class pin stays green
- Guard semantics untouched: PUT inherits bearer + rate-limit via the method-agnostic `/api/*` mount (proven live: 401 without/wrong bearer, 200 with)
- `SUPERSESSION.md` carries the phase-19 row in the same commit as the surface-mutating change; lint 0 errors, 177 warnings (no net-new vs baseline 177)

## Task Commits

All three tasks landed in a single atomic commit per the plan's same-commit bindings (pins sharpen same-commit as the change that breaks/fulfills them; supersession row same-commit as the surface-mutating change):

1. **Task 1: Tracer — roeRecords store plus PUT plus GET happy path end to end** - `d79fea9` (feat)
2. **Task 2: Sharpen pins and prove guard coverage for the new verb** - `d79fea9` (feat, same commit per plan binding)
3. **Task 3: Bench case plus surfaces sync plus supersession entry** - `d79fea9` (feat, same commit per plan binding)

## Files Created/Modified

- `src/server.ts` - `RoeRecord` + `roeRecords` latest-slot map, snapshot spread, `replaceMapContents` restore, `roeAudit` import, `PUT /api/teams/white/roe` (400/413, revision+textHash stamping, `white.roe.on-record` event), rewritten fail-closed GET (recompute-and-compare, ok gate, provenance stamps, redaction wraps)
- `src/__tests__/white-routes-static.test.ts` - per-verb counting (GET once + PUT once), PUT-block pins (store set, revision, empty-text 400, 413), GET-block pins (ok gate, mismatch cannot-derive without verdicts, 4× redaction wraps), kept POST-forbidden / no-500 / drafts-mutation / empty-state pins
- `src/__tests__/roe-store-pins.test.ts` - NEW: Map declaration, snapshot spread, restore call, `latest` slot key, 16-char hash slice
- `src/__tests__/remote-access-guard.test.ts` - live PUT cases (401 missing, 401 wrong, 200 correct bearer); wiring pin byte-identical
- `bench/roe-adjudication/corpus.json` - new `stored-record-provenance` text-to-parse-to-verdict case (compliant / needs_approval / violation)
- `bench/roe-adjudication/report.json` - regenerated deterministically (total incremented by one)
- `docs/API_REFERENCE.md` - rewritten GET row + new PUT row (64 KiB text-bytes cap, 400/413); purple section untouched for Phase 23
- `docs/MCP_GUIDE.md`, `src/mcp-server.ts` - verdicts-on-record with provenance, operator-PUT recording, no MCP mutation tool (GET-only handler unchanged)
- `grokbot/skills/white-arbiter/SKILL.md`, `grokbot/skills/dark-purple/SKILL.md` - stale until-a-real-source-lands clauses rewritten; empty-state honesty sentences kept
- `.planning/milestones/v1.3-phases/SUPERSESSION.md` - phase-19 row with the green re-evidencing command

## Decisions Made

- One atomic commit for all three tasks (plan-mandated same-commit bindings over per-task commits; recorded here as the deliberate deviation from the default each-task-a-commit convention)
- Mismatch shares the kept empty-state cannot-derive report (no separate corrupt wording), per research OQ1 resolution and plan key_link 2
- SUPERSESSION.md Commit column cites the `feat(22-01)` subject with a pointer to this SUMMARY for the hash — a same-commit hash is a self-reference paradox (any amend changes the hash it records)
- PUT success answers 200 (replace-latest semantics) per research A4; `createdAt` preserved across overwrites, `updatedAt` restamped

## Deviations from Plan

### Auto-fixed Issues

None - no bugs, missing functionality, or blockers encountered. One deliberate process deviation:

**1. [Process] Three tasks landed in one commit instead of three per-task commits**
- **Found during:** Task 2/3 commit planning
- **Issue:** The plan binds the pin rewrite ("same commit as the route change") and the supersession row ("same commit as the surface-mutating change") to the route-change commit, which is incompatible with one-commit-per-task
- **Fix:** Single atomic commit `d79fea9` carrying tasks 1+2+3; plan bindings (more specific) took precedence over the default convention
- **Files modified:** all 12 plan files
- **Verification:** `git show --stat HEAD` lists all 12 files; post-commit deletion check clean
- **Committed in:** d79fea9

---

**Total deviations:** 1 process (plan bindings over default convention; no scope change).
**Impact on plan:** None — every must-have truth, artifact, and verification in the plan is met with real evidence.

## Issues Encountered

- First smoke-server launch resolved the wrong cwd (`/root/src/repos/src/server.ts`); relaunched with an absolute `cd` prefix — no code impact.
- Smoke port 3457 was already occupied; moved the smoke server to 3491 — no code impact.
- Intentional `kill` of smoke servers surfaces as supervised-process failure notices; expected, no code impact.

## Verification Evidence (all real runs, this session)

- `npx tsc --noEmit` → exit 0
- Quick suite (white-routes-static, roe-store-pins, white-suite, v13-class-probes, remote-access-guard, roe-adjudication-bench) → 6 files, 54 tests, all pass
- `node scripts/roe-adjudication-bench.mjs` → ALL PASS, 13/13 cases, 27/27 adjudication outputs match
- `npm run lint` → 0 errors, 177 warnings (baseline 177, no net-new)
- Two-PUT loopback smoke (port 3491, temp state dir): PUT1 → `{revision:1, textHash:22d6c24e6f0ef0fb}`; GET1 → verdicts with `roeRevision:1, roeTextHash:22d6c24e6f0ef0fb, roeLines:[1,2]` + provenance; PUT2 → `revision:2`; state.json shows `createdAt` = PUT1 time preserved, `updatedAt` = PUT2 time; empty text → 400; 66 000-byte text → 413; state wiped + restart → `200 {"roe":{},"resolved":[],"unresolved":[],"commentLines":0,"ok":false,"summary":"no ROE text on record"}` with no verdicts member

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ROE verdicts now have a real text source with provenance; Phase 23 (UNIFY-01) owns the `docs/API_REFERENCE.md` purple section and `docs/operators.html` — sequence respected, no overlap
- Deferred to v2 per CONTEXT: persisted verdict ledger, revision history/listing endpoint, purple auto-consumption, extended provenance fields
- Stray `./Heads-up: while wiring GET` directory at repo root left untouched per REQUIREMENTS Out of Scope (follow-up, not milestone work)

## Self-Check: PASSED

- All 12 files exist on disk; `d79fea9` present in `git log`; no deletions in the commit; no stub patterns introduced (no TODO/placeholder/empty-value emissions in new code paths)

---
*Phase: 22-roe-text-as-server-state*
*Completed: 2026-10-12*
