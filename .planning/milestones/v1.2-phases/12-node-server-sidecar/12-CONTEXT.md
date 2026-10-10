# Phase 12: Node Server Sidecar - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

The desktop app runs without the operator manually starting `npm run server`
alongside: the loopback API server ships inside the Tauri bundle as a sidecar
executable that the shell spawns on launch and reaps on exit.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence:

- **Dev flow unchanged:** `devUrl` stays `http://127.0.0.1:3333/ui`;
  `beforeDevCommand` still runs `npm run server`. The sidecar spawns only in
  non-dev builds (guard with `tauri::is_dev()`).
- **No new webview capability.** The capabilities lockdown (core:default only)
  is deliberately preserved: the Rust shell spawns the sidecar directly via
  `std::process::Command` — NOT via `tauri-plugin-shell`, so the renderer still
  gains zero execution surface.
- **Bundler:** esbuild (already in the dependency tree) bundles
  `src/server.ts` → one JS file, then `@yao-pkg/pkg` (maintained pkg fork)
  compiles the single-file executable. Record the decision in docs/TAURI.md.
- **Binaries are build artifacts, not source:** `src-tauri/binaries/` is
  gitignored; `npm run sidecar:build` (new script via
  `scripts/build-sidecar.mjs`) produces `t3mp3st-server-<target-triple>`
  next to the conf's `bundle.externalBin` base name.
- Server port env: read from `src/server.ts` (grep the actual env name — the
  conf comment says PORT defaults to 3333; do not guess).
- Lifecycle: no orphaned-process path — kill + wait on `RunEvent::Exit`;
  handle spawn failure without crashing the UI shell (log + continue degraded).

</decisions>

<code_context>
## Existing Code Insights

- `src-tauri/src/lib.rs` (Phase 11): minimal builder; extend with setup +
  run-event handling. `Cargo.toml` needs no new crates for Command-based spawn.
- `src-tauri/tauri.conf.json`: strict JSON since Phase 11 — add
  `bundle.externalBin: ["binaries/t3mp3st-server"]`.
- `.github/workflows/tauri-build.yml` builds the desktop matrix — needs a
  sidecar-build step before `tauri build` (externalBin must exist at build time).
- CI (`docs/TAURI.md` §7) and §2/§3 document the alongside-server strategy —
  both must move to the sidecar as the prod default.

</code_context>

<specifics>
## Specific Ideas

- Smoke on this host: `npm run sidecar:build` → run the produced linux-x64
  executable standalone → it answers the loopback API; `cargo check` green with
  the spawn logic.

</specifics>

<deferred>
## Deferred Ideas

- macOS/Windows sidecar cross-builds: build for the host triple first; the
  script accepts extra triples and CI builds per-matrix (record, don't fake).

</deferred>
