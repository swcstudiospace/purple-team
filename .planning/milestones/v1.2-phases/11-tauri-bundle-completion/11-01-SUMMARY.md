# Summary 11-01: Tauri bundle completion

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE (with recorded toolchain blockers)

## What changed

- `@tauri-apps/cli` 2.12.1 added as devDependency (`package.json` + lock).
- `src-tauri/Cargo.toml`, `src/main.rs`, `src/lib.rs` added (mobile-template lib
  shape). The v1.1 scaffold had shipped NO Rust sources — the wrapper was
  unbuildable; `tauri android init` failed on the missing manifest.
- Icon rasters generated from `src-tauri/icons/t3mp3st.svg` and committed: the
  four `bundle.icon` paths (`128x128.png`, `128x128@2x.png`, `icon.icns`,
  `icon.ico`) plus CLI extras (`32x32.png`, `64x64.png`, `icon.png`, Store
  logos, `android/` + `ios/` sets). `icons/README.md` updated to reality.
- `tauri.conf.json` + `capabilities/default.json` converted to strict JSON —
  `cargo check` proved the Rust toolchain rejects the commented JSON
  (`key must be a string at line 4 column 3`). Rationale prose lives in
  `docs/TAURI.md` §4.
- `docs/TAURI.md`: re-probe block (§1), follow-up 3 closed (§3), capabilities
  rationale relocated (§4), mobile-init outcomes (§5), icons done (§9),
  cargo-check PASS record (§10).
- `src/__tests__/tauri-scaffold-static.test.ts`: CLI-devDependency pin flipped
  (was: no CLI in deps), icons-on-disk pin added, stale comments updated.

## Decisions

- Mobile init blockers recorded, not worked around: `android init` needs
  Java + Android SDK/NDK (exact error captured); `ios` subcommand is
  macOS-gated (absent from `tauri --help` on Linux). Installing a system JDK
  would still dead-end at ANDROID_HOME/NDK — recorded unblock conditions in
  `docs/TAURI.md` §5 instead.
- Extra CLI icon sizes committed (not pruned to the conf's four): the mobile
  sets are consumed by the future `gen/` targets; pruning would force
  regeneration at init time.

## Verification results

- `cargo check` (src-tauri): **exit 0** — `Finished 'dev' profile … 37.61s`,
  tauri 2.12.2 / wry 0.57.0 resolved. First-build failure on commented JSON
  captured in §10.
- `npx vitest run src/__tests__/tauri-scaffold-static.test.ts`: **25/25
  passed** (incl. new bundle.icon-on-disk pin).
- Typecheck: run at phase commit (see below).
- Every `bundle.icon` entry resolves to a committed file (pinned by test).
