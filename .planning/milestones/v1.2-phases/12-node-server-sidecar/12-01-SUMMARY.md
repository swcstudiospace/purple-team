# Summary 12-01: Node server sidecar

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE (host smoke; full installer bundle not built here)

## What changed

- `scripts/build-sidecar.mjs` + `scripts/sidecar.pkg.json` compile `dist/server.js` (the existing `tsc` output) into `src-tauri/binaries/t3mp3st-server-<triple>` with `@yao-pkg/pkg`. The directory is gitignored.
- Runtime is **node22**, not node20. `@yao-pkg/pkg-fetch` 3.6 dropped node20 base binaries; a missing base binary compiles Node from source and would blow the CI job. node22 matches `package.json` engines and is still published (v3.6 asset, sha256-checked before use).
- `web-tree-sitter` ships `exports` and no `main`, which made pkg omit it and the binary crash on startup. The build script temporarily sets `main` to `./tree-sitter.cjs`, passes wasm assets, and restores `package.json`.
- `tauri.conf.json`: `bundle.externalBin` plus `resources` mapping `../docs/` → `docs/`. Dev flow unchanged (`beforeDevCommand` still `npm run server`; sidecar spawns only when `!tauri::is_dev()`).
- `src-tauri/src/lib.rs` spawns the installed binary with `std::process::Command` (no `tauri-plugin-shell`; capabilities stay `core:default`). cwd is the resource dir when `docs/` is there, so the sidecar's `express.static('docs')` serves `/ui`. Ready = TCP to `127.0.0.1:3333`. The webview then navigates to `http://127.0.0.1:3333/ui/`. Exit kills and reaps the child (`Child::kill` is SIGKILL; default state is in-memory, so there is no flush to lose).
- Windows asset host is `http://tauri.localhost`. `docs/assets/shell.js` sends that host to the loopback API. The server allows that origin on CORS, CSRF, and SSE, and still rejects `Host: tauri.localhost` (the Host allow-list stays literal loopback).
- `npm run tauri:build` builds the sidecar first. CI runs `npm run sidecar:build` after `npm run build` and before `tauri-action`.
- `docs/TAURI.md` §2/§3 record the decision. Node SEA was rejected (postject, no cross-build story).

## Verification

- `npm run sidecar:build` produced `t3mp3st-server-linux-x64` and the Rust-triple copy `t3mp3st-server-x86_64-unknown-linux-gnu`.
- Standalone smoke, `T3MP3ST_PORT=3399`: `GET /api/mission/status` returned JSON; `GET /ui/` returned 200; `Origin: http://tauri.localhost` received `Access-Control-Allow-Origin`; `Origin: https://evil.example` POST returned 403; `Host: tauri.localhost` returned 403.
- `cargo check` in `src-tauri/` finished green (externalBin resolved).
- `tauri-scaffold-static` + `local-api-hardening-static`: 37/37. `tsc --noEmit` clean via `npm run build`.
- A full `tauri build` installer was not produced on this host. CI is the first place the deb/appimage/msi/dmg matrix runs.

## Not done here

- Cross-compiled macOS/Windows sidecar binaries (CI builds the host triple per matrix runner; `--all` / `--triple` exist on the script).
