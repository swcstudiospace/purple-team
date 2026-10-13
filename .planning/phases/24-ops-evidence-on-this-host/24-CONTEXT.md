# Phase 24: Ops Evidence on This Host - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The two "edited but never executed" ops claims become receipt-grade evidence: the docker healthcheck observed live in a real container (healthy path, failure path, fail-closed refusal) and the desktop installer matrix built on this host with per-target sha256 receipts. Deliverables: Dockerfile/compose/docs probes reconciled (HEALTHCHECK repointed to the deliberately-open `/health`; NO new guard exemption); three evidenced container runs; `.deb` + AppImage built on-host with a per-target receipt table (path/byte size/sha256/launched?) and explicit `CI-evidence-only` cells for msi/nsis/app/dmg; receipts recorded in phase artifacts.

</domain>

<decisions>
## Implementation Decisions

### Owner-decided direction (locked at research/roadmap time)
- **OPS-01 probe reconciliation**: Dockerfile HEALTHCHECK repoints to the open `/health` handler (serves both `/health` and `/api/health`); compose probe already correct (bearer header); NO new bearer-guard exemption — `/api/health` stays guarded. DOCKER.md curl examples fixed to match.
- **Three evidenced runs**: (a) with `T3MP3ST_BEARER_TOKEN` — observed `starting → healthy` transition with inspect receipts; (b) failure path observed — retries exhausting into `unhealthy` (a probe only ever seen healthy proves nothing); (c) no-token run — fail-closed startup refusal.
- **OPS-02 receipts discipline**: per-target table (target / built-on-host? / artifact path / byte size / sha256 / launched?); msi/nsis/app/dmg recorded as `CI-evidence-only`; cross-compiled artifacts NEVER count as host-observed; tool versions + wall time recorded.
- **One phase carries both requirements** (roadmap-approved grouping): shared receipt discipline, shared host prep.

### Host prep (decided)
- `patchelf` install (apt) sequenced as step 0 of OPS-02 — required for deb/appimage bundling per STACK research; if the host blocks the install, the receipt table records the blocker honestly (partial green, no laundering).

### Locked constraints (binding)
- Guard semantics untouched; no endpoint that 200s regardless of server health; loopback-only runs don't count.
- Fresh `sidecar:build` before tauri build (stale `src-tauri/binaries/` fails the bundle); CI's exact bundle args (`--bundles deb,appimage`).
- Image pinned by digest in receipts; container IDs + `docker inspect` output + exit codes recorded.
- `tauri-scaffold-static.test.ts` pins kept true if first-run config fixes land.
- Running lint count in gate receipts (ops reconciliation touches no lint-scoped code; if it does, explain); 0 errors.
- Supersession: Dockerfile/DOCKER.md are NOT named in any v1.3 VALIDATION map (phase 13 surfaces are v1.2-era) — supersession row only if a mapped file is touched; otherwise note the check.

</domain>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dockerfile HEALTHCHECK (lines ~36-38, probes guarded `/api/health` unauthenticated — the verified defect); docker-compose.yml:14-20 healthcheck already sends the bearer
- `/health` handler serves both paths (server.ts:4968; guard exemption comment refers to root `/health`)
- Bearer fail-closed startup: non-loopback/DOCKER binds refuse without `T3MP3ST_BEARER_TOKEN[_FILE]` (v1.2 Phase 13)
- Tauri chain: `npm run tauri:build` = build → sidecar:build → tauri build (package.json:122); `npx tauri build --bundles deb,appimage` is CI parity; bundle outputs land `src-tauri/target/release/bundle/{deb,appimage}`
- Host toolchain (STACK-probed 2026-10-12): docker 29.6.2 + compose v5.3.1 (daemon up), tauri-cli 2.12.1, @yao-pkg/pkg 6.23.0, node 24, cargo 1.98.1; `libayatana-appindicator3-dev` present (noble substitute); `patchelf` MISSING (apt-available)

### Established Patterns
- Receipt tables in phase artifacts (v1.3 gate tables); env examples `.env.example:36-37` token placeholders
- `.env`/compose `$$` expansion for `T3MP3ST_BEARER_TOKEN_FILE` (confirm exercised during run)

### Integration Points
- Dockerfile, docker-compose.yml, docs/DOCKER.md — OPS-01 reconciliation
- src-tauri/ bundle chain — OPS-02 execution (config fixes only if first-run failures demand; pins kept true)
- Phase artifacts: receipts live in the phase dir (24-01-SUMMARY or a receipts section per plan)
- `.planning/milestones/v1.3-phases/SUPERSESSION.md` — only if a mapped file touched

</code_context>

<specifics>
## Specific Ideas

- Failure path: run the with-token container but point HEALTHCHECK at a wrong port via env override if supported, or temporarily break the probe in a throwaway image tag — the honest mechanism is whatever the plan specifies; the requirement is an OBSERVED unhealthy transition, not a staged lie (record the mechanism used)
- Research inputs: `.planning/research/SUMMARY.md` §Phase 4, `STACK.md` §3 (evidence scripts), `ARCHITECTURE.md` §4, `PITFALLS.md` §4 (ops false greens)

</specifics>

<deferred>
## Deferred Ideas

- deb/AppImage install-and-launch verification (v2 differentiator; `ar`/`tar` listing optional differentiator if cheap)
- per-rule lint budgets (v2)

</deferred>
