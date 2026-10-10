# Roadmap: v1.2 — Re-home Completion: Tauri Bundling & Remote Hardening

Milestones v1.0 (Phases 1-5) and v1.1 (Phases 6-10) shipped 2026-10-09 — archived in
`.planning/milestones/`. This file tracks v1.2 (Phases 11-14), built from the follow-ups
recorded in `STATE.v1.1.md` and `docs/TAURI.md` at v1.1 close-out. Continuous phase
numbering per GSD convention.

Re-home context (2026-10-10, pre-phase): repository reset to a fresh root commit and
pushed to `github.com/swcstudiospace/purple-team`; license replaced AGPL-3.0 → MIT;
docs identity swept. Recorded as completed context in `STATE.md`.

## Overview

Finish what v1.1 deferred: complete the Tauri 2.0 wrapper (icons, mobile init where the
host toolchain allows), bundle the Node server as a Tauri sidecar so the desktop app is
self-contained, and harden the non-loopback path (bearer auth + bot rate limits) that the
Grok Bot integration recorded as a follow-up. Closes with full gates and docs.

## Phases

- [x] **Phase 11: Tauri Bundle Completion** - install @tauri-apps/cli, generate icon rasters from the committed SVG, init mobile targets where the host toolchain permits, verify bundle config (2026-10-10)
- [x] **Phase 12: Node Server Sidecar** - bundle the loopback server as a Tauri sidecar so `tauri build` yields a self-contained desktop app (2026-10-10)
- [ ] **Phase 13: Remote-Access Hardening** - bearer-token auth for non-loopback bot hosting + bot rate limits, with tests
- [ ] **Phase 14: v1.2 Hardening & Close-out** - full gates, docs, planning final

## Phase Details

### Phase 11: Tauri Bundle Completion
**Goal**: The Tauri wrapper ships real icon binaries and initialized mobile targets (host-toolchain permitting), not just the static scaffold.
**Depends on**: v1.1 Phase 9 (src-tauri scaffold)
**Requirements**: add `@tauri-apps/cli@2` devDependency; `tauri icon src-tauri/icons/t3mp3st.svg` → committed rasters (128x128.png, 128x128@2x.png, icon.icns, icon.ico); `tauri android init` and `tauri ios init` attempted and their real outcomes recorded; `tauri.conf.json` bundle.icon paths verified; docs/TAURI.md updated from "deferred" to actual state
**Success Criteria** (what must be TRUE):
  1. Icon rasters exist under src-tauri/icons/ and match tauri.conf.json bundle.icon entries
  2. Mobile init outcomes are real: generated project dirs committed, or a recorded toolchain blocker (e.g. no Xcode on Linux) with the exact error
  3. `npm run tauri:build`-path config validates as far as the host allows; static scaffold test still green
  4. docs/TAURI.md reflects the new state; no "deferred" language remains for completed items

**Plans**: 1 plan

Plans:
- [x] 11-01: Tauri bundle completion (icons + mobile init + docs)

### Phase 12: Node Server Sidecar
**Goal**: The desktop app runs without the operator manually starting `npm run server` alongside.
**Depends on**: Phase 11 (final bundle shape)
**Requirements**: server entry built as a single executable (pkg/nexe/Node SEA — pick per repo evidence and record decision) registered as a Tauri sidecar (`externalBin`) with shutdown handling; dev flow unchanged; docs/TAURI.md updated
**Success Criteria** (what must be TRUE):
  1. `tauri.conf.json` declares the sidecar and the build produces/locates it
  2. Launching the bundled app starts the API server and the UI reaches it (smoke-verified as far as host toolchain allows)
  3. Sidecar lifecycle (spawn/shutdown) has no orphaned-process path; decision + verification recorded

**Plans**: 1 plan

Plans:
- [x] 12-01: Node server sidecar (bundle, wire, spawn, docs)

### Phase 13: Remote-Access Hardening
**Goal**: Non-loopback bot hosting is guarded by bearer auth and rate limits instead of standing down entirely.
**Depends on**: v1.0 Phase 4 (grokbot gateway surface)
**Requirements**: bearer-token middleware active only when T3MP3ST_HOST binds non-loopback (loopback trust unchanged); token delivery via env/file, never committed; per-route bot rate limits; tests for both modes; grokbot README updated
**Success Criteria** (what must be TRUE):
  1. Non-loopback requests without a valid bearer are refused (401) — pinned by test
  2. Loopback operation is byte-for-byte unchanged (no auth prompt, no rate limit on interactive UI paths) — pinned by test
  3. Rate limiting triggers deterministically under burst — pinned by test
  4. No token material in committed files; grokbot/README.md documents the new auth model

### Phase 14: v1.2 Hardening & Close-out
**Goal**: v1.2 verifiably green and documented.
**Depends on**: Phases 11-13
**Requirements**: lint, typecheck, full test suite, doctor, prompt:audit; phase commits; planning final; docs touch-ups
**Success Criteria** (what must be TRUE):
  1. All gates pass; tree green
  2. Docs cover bundle completion, sidecar, and remote hardening
  3. ROADMAP/STATE reflect completion

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Tauri Bundle Completion | 1/1 | Complete | 2026-10-10 |
| 12. Node Server Sidecar | 1/1 | Complete | 2026-10-10 |
| 13. Remote-Access Hardening | 0/0 | Not Started | — |
| 14. v1.2 Hardening & Close-out | 0/0 | Not Started | — |
