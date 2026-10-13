---
phase: 24-ops-evidence-on-this-host
plan: 01
subsystem: infra
tags: [docker, healthcheck, tauri, deb, appimage, sidecar, patchelf, evidence]

# Dependency graph
requires:
  - phase: 23-one-risk-signal
    provides: [phase-close gate discipline carried into ops evidence]
provides:
  - Dockerfile HEALTHCHECK reconciled to the open /health (IPv4 literal), image t3mp3st:ops01
  - Three container-run receipts (healthy / failure-path / fail-closed) with inspect output
  - Host-built deb + AppImage with per-target sha256 receipt table
  - 24-receipts.md as the receipt-grade evidence file for OPS-01/OPS-02
affects: [phase-25, verify-work, ship]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 450
  tasks: 3
  commits: 3
  plan_head_before: ca35d87~1

# Tech tracking
tech-stack:
  added: [patchelf-0.18.0-via-apt]
  patterns: [receipt-grade-evidence, glob-first-artifact-receipts, prefix-only-token-discipline]

key-files:
  created:
    - .planning/phases/24-ops-evidence-on-this-host/24-receipts.md
  modified:
    - Dockerfile
    - docs/DOCKER.md
    - src-tauri/tauri.conf.json

key-decisions:
  - "Rule-1: probe hostname localhost -> 127.0.0.1 (busybox wget resolves ::1-first; server is IPv4-only)"
  - "Rule-1: bundler category Security -> Utility (invalid category; no pin constrains it)"
  - "Failure path replays pre-fix probe via --health-cmd override on the same digest, 127.0.0.1 literal to isolate the guard-401 mechanism"
  - "AppImage launched? = no (truthful): extract-and-run attempted, GTK init fails headless"

patterns-established:
  - "Receipt-grade evidence: every claim cites a real observation (inspect JSON, exit code, sha256 re-read)"
  - "Token prefix-only discipline: first-8-chars + sha256 in committed receipts, full value never committed"

requirements-completed: [OPS-01, OPS-02]

coverage:
  - id: D1
    description: "Dockerfile HEALTHCHECK probes the open /health; DOCKER.md curls match; no guard exemption"
    requirement: "OPS-01"
    verification:
      - kind: other
        ref: "docker image inspect t3mp3st:ops01 + grep -c '/health' Dockerfile = 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "With-token container observed starting-to-healthy with inspect receipts"
    requirement: "OPS-01"
    verification:
      - kind: other
        ref: "docker inspect --format '{{json .State.Health}}' t3mp3st-ops01-healthy (Status healthy, FailingStreak 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failure path observed exhausting into unhealthy via real Docker health machinery"
    requirement: "OPS-01"
    verification:
      - kind: other
        ref: "docker inspect t3mp3st-ops01-fail (unhealthy, verbatim 401 Log Output)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No-token run exits 1 with verbatim fail-closed refusal"
    requirement: "OPS-01"
    verification:
      - kind: other
        ref: "docker inspect --format '{{.State.ExitCode}}' t3mp3st-ops01-notoken = 1 + refusal line"
        status: pass
    human_judgment: false
  - id: D5
    description: "deb + AppImage built on-host with path/bytes/sha256/launched rows; msi/nsis/app/dmg CI-evidence-only"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "stat + sha256sum re-read of bundle globs; CI matrix link in 24-receipts.md"
        status: pass
    human_judgment: false
  - id: D6
    description: "Gate receipts: lint 0 errors, scaffold pins true, test:pr green"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "npm run test:pr (exit 0) + tauri-scaffold-static.test.ts 26/26"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-10-13
status: complete
---

# Phase 24 Plan 01: Ops Evidence on This Host Summary

**Reconciled Docker healthcheck to the open /health, evidenced healthy/failure/refusal container runs off one image digest, and built host deb + AppImage with sha256 receipts — all transcribed in 24-receipts.md.**

## Performance

- **Duration:** 19 min (01:05:38Z → ~01:24Z)
- **Started:** 2026-10-13T01:05:38Z
- **Completed:** 2026-10-13T01:24:30Z
- **Tasks:** 3
- **Files modified:** 4 (Dockerfile, docs/DOCKER.md, src-tauri/tauri.conf.json, 24-receipts.md)

## Accomplishments

- OPS-01: Dockerfile + compose + docs probes agree on /health semantics with zero src/ diff and the guard proven intact (401/200/200 probe trio)
- OPS-01: three evidenced runs off final image `t3mp3st:ops01` (`.Id 55d8c979…`): starting→healthy (streak 0), streak 1-2-3→unhealthy with verbatim 401 Log Output, exit-1 verbatim refusal
- OPS-02: CI-verbatim chain (build 7 s → sidecar:build 9 s → tauri build 128 s) produced `T3MP3ST_1.0.0_amd64.deb` (36,376,766 B) and `.AppImage` (112,257,528 B) with re-verified sha256; msi/nsis/app/dmg explicit CI-evidence-only
- Gate receipts: `test:pr` exit 0, lint 0 errors / 177 pre-existing warnings, 1125 tests pass, scaffold pins 26/26, doctor 0 blockers

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — reconcile probes and build one evidence image** - `ca35d87` (feat)
2. **Task 2: Three evidenced container runs with inspect receipts** - `cbf29c4` (feat)
3. **Task 3: Host installer matrix with glob-first bundle receipts** - `ecc3df2` (feat)

## Files Created/Modified

- `.planning/phases/24-ops-evidence-on-this-host/24-receipts.md` - All container + bundle receipts (created)
- `Dockerfile` - HEALTHCHECK `/api/health` → `/health`, then `localhost` → `127.0.0.1` (modified)
- `docs/DOCKER.md` - Bearer header on `/api/*` curls + plain `/health` open-probe example (modified)
- `src-tauri/tauri.conf.json` - Bundler `category` `Security` → `Utility` (modified)

## Decisions Made

- D-01 (plan): Dockerfile repoint to open /health + DOCKER.md curl fixes, no guard exemption — implemented in Task 1
- D-02 + D-06 (plan): three evidenced runs; throwaway token prefix-only (`dc6401a1` + sha256) — implemented in Task 2
- D-03 + D-05 + D-07 (plan): per-target receipt table with CI-evidence-only rows; patchelf step 0; extract-and-run smoke with truthful cell — implemented in Task 3
- D-04 (plan): one plan carries OPS-01 + OPS-02 — this plan
- Executor Rule-1: probe hostname `localhost` → `127.0.0.1` (see Deviations)
- Executor Rule-1: bundler category `Security` → `Utility` (see Deviations)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Probe hostname localhost → 127.0.0.1**
- **Found during:** Task 2 (Three evidenced container runs)
- **Issue:** First with-token run against the path-only fix went starting→unhealthy: busybox wget resolves `localhost` IPv6-first (`::1`), while the server binds IPv4-only `0.0.0.0:3333` — the image probe was doubly broken (guarded path AND unroutable hostname). Verified: `ss -tlnp` showed `0.0.0.0:3333 LISTEN` while `wget localhost:3333` got connection-refused and `wget 127.0.0.1:3333/health` returned 200.
- **Fix:** `Dockerfile:40` hostname → `127.0.0.1` (same literal compose and DOCKER.md already use); rebuilt same tag (new `.Id 55d8c979…`, 73 s); stale container removed before rebuild. No guard/exemption/compose/src change.
- **Files modified:** Dockerfile, 24-receipts.md
- **Verification:** Re-run went `starting → healthy` in ~5 s, FailingStreak 0
- **Committed in:** cbf29c4 (Task 2 commit)

**2. [Rule 1 - Bug / Rule 3 - Blocking] Bundler category Security → Utility**
- **Found during:** Task 3 (Host installer matrix)
- **Issue:** First `tauri build` compiled the release binary then failed `failed to build bundler settings: invalid category` — `"Security"` is not a valid Tauri AppCategory (no desktop taxonomy ships one).
- **Fix:** `"category": "Utility"` (closest honest category). Grep proved no scaffold pin constrains `category`; pins re-verified 26/26 after the fix. Second attempt bundled both targets.
- **Files modified:** src-tauri/tauri.conf.json, 24-receipts.md
- **Verification:** `T3MP3ST_1.0.0_amd64.deb` + `.AppImage` produced; `vitest tauri-scaffold-static` 26/26
- **Committed in:** ecc3df2 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs/blockers)
**Impact on plan:** Both fixes were required for correctness — without them no healthy run and no bundle exist. No scope creep: zero src/ changes, zero compose changes, guard untouched, pins kept true.

## Issues Encountered

- Failure-run streak keeps climbing after unhealthy (streak 3 → 9 → 18): expected — Docker keeps probing unhealthy containers on the 5 s interval. The transition into unhealthy at streak 3 is the receipt; later values are steady-state.
- AppImage `--appimage-extract-and-run` smoke: binary executes then panics on GTK init (headless host, no display). Recorded truthfully as `launched? = no`; install-and-launch stays a v2 item per CONTEXT.
- `test:pr` doctor reports 5 warnings (optional scanners missing, API-health offline) — pre-existing, 0 blockers.

## User Setup Required

None - no external service configuration required. (patchelf installed via apt as the plan's step 0.)

## Next Phase Readiness

- OPS-01 and OPS-02 are receipt-backed on this host; `verify-work` can sweep 24-receipts.md against the plan's `<verification>` block.
- Image tag `t3mp3st:ops01` remains local (never pushed); evidence containers torn down; throwaway token shredded.
- No stubs, no skipped tests, no unrun verifies. Threat surfaces introduced: none (no new endpoints, auth paths, or schema changes).

## Self-Check: PASSED

- `[ -f 24-receipts.md ]` FOUND; `[ -f 24-01-SUMMARY.md ]` FOUND (this file)
- Commits `ca35d87`, `cbf29c4`, `ecc3df2` verified in `git log`
- Full token value grep-absent from receipts (prefix-only discipline holds)

---
*Phase: 24-ops-evidence-on-this-host*
*Completed: 2026-10-13*
