# T3MP3ST Tauri 2.0 shell

Desktop (and later mobile) wrapper around the existing static UI (`docs/`, served
at `/ui`) plus the loopback API server (`src/server.ts`). Threat model stays
single-operator localhost throughout.

Ownership: `tauri/**` is owned by `bot-02-web-edge` per
`/root/src/repos/programming-desk/ownership.yaml` (~lines 38-42: Tauri listed
under the Web & Desktop runtimes; ~lines 329-333: `tauri/**` pattern owned by
`bot-02-web-edge`).

## 1. Toolchain probe (2026-10-09, recorded — never re-invented)

Probed read-only on the scaffold machine:

| Tool | Result |
| --- | --- |
| `cargo --version` | PRESENT — `cargo 1.98.1` |
| `node_modules/.bin/tauri` | ABSENT — no `node_modules/.bin/tauri` (CLI not installed) |
| `npx --no-install @tauri-apps/cli --version` | ABSENT — npx refused without a fetch (`missing packages and no YES option`) |
| `src-tauri/` | ABSENT before this unit — scaffolded fresh |
| `package.json` name / version | `t3mp3st` / `1.0.0` — no tenant/id hints |
| `tenants.json` | docs-tenant only (`t3mp3st-docs`) — no app-id hint |

Consequences:

- The scaffold is complete and correct regardless: `tauri.conf.json`,
  `capabilities/default.json`, `build.rs`, `icons/t3mp3st.svg` are all committed.
- Anything requiring the CLI was NOT run and NOT faked: icon raster generation
  (`tauri icon`) and mobile init (`tauri ios init` / `tauri android init`) are
  deferred below with exact commands.
- No Tauri npm dependency was added to `package.json` (only the four `tauri:*`
  scripts, which invoke the `tauri` binary). Installing the CLI
  (`npm i -D @tauri-apps/cli@2`) is a prerequisite for running them, on a
  machine with registry access. Verification therefore degrades gracefully: the
  committed static test (`src/__tests__/tauri-scaffold-static.test.ts`) pins the
  scaffold shape without needing the CLI, Rust build, or icon binaries.

## 2. Backend strategy (decision record)

Node is NOT bundled as a sidecar in this unit. The Tauri webview is a pure UI
shell; all execution stays in the existing server process:

- **Desktop dev:** run the loopback server alongside, then open the shell
  against it.

  ```sh
  npm run server          # loopback API + /ui on http://127.0.0.1:3333
  npm run tauri:dev       # webview at devUrl http://127.0.0.1:3333/ui
  ```

  (`beforeDevCommand` in `tauri.conf.json` records the `npm run server` pairing.)

- **Desktop prod:** build, then run the server alongside the bundled app.

  ```sh
  npm run tauri:build     # bundles ../docs as the frontend
  npm run server:prod     # loopback API the bundled UI calls
  ```

  The bundled UI calls the same loopback origin, so the server's existing
  posture applies unchanged: CORS locked to localhost origins, state-changing
  cross-origin guard, Host-header anti-rebinding allow-list on loopback binds
  (`src/server.ts` ~lines 161-297; `/ui` static mount + `/` redirect ~lines
  8159-8163). The webview CSP (`security.csp` in `tauri.conf.json`) additionally
  restricts `connect-src` to loopback so the renderer cannot be pointed at a
  remote backend. Same origin-guard posture as the browser UI — no new trust.

- **Mobile (LAN-paired):** the phone/tablet webview cannot reach the dev
  machine's loopback, so the server binds LAN-reachable while the app is used:

  ```sh
  T3MP3ST_HOST=0.0.0.0 npm run server   # explicit opt-in bind (server warns)
  npm run tauri:ios      # or: npm run tauri:android
  ```

  On a non-loopback bind the server's strict loopback gates stand down for the
  operator's own same-origin UI by design (see `isSameOriginAsHost`), which is
  exactly the exposure this mode opts into. Treat the LAN as untrusted.

## 3. Follow-ups (NOT this unit — each with its unblock condition)

1. **Bearer-auth upgrade (with mobile):** `src/server.ts` states the upgrade
   path explicitly — if the API is ever exposed beyond localhost (the mobile
   LAN mode above), add real Bearer-token auth. Until then the origin/Host
   guards are the defense; do not ship mobile beyond a trusted LAN without it.
   Unblock: server-side auth design + implementation; no Tauri change unblocks
   this — the Tauri side only documents the pairing (section 2).
2. **Node sidecar bundling:** shipping node inside the Tauri bundle so desktop
   prod needs no alongside `npm run server` step. Recorded, not started.
   Unblock: a bundling decision (which runtime, sidecar wiring in
   `tauri.conf.json` + capabilities) made on a CLI-equipped machine that can
   actually build and smoke-test the bundle.
3. **CLI-dependent generation:** `tauri icon src-tauri/icons/t3mp3st.svg` and
   `tauri ios init` / `tauri android init` on a CLI-equipped machine (mobile:
   section 5; icons: section 9). Unblock: `npm i -D @tauri-apps/cli@2` on a
   machine with registry access (plus Xcode for iOS, Android SDK+NDK for Android).

## 4. Capabilities lockdown

`src-tauri/capabilities/default.json` grants only `core:default` on the `main`
window. Each grant (and each deliberate absence — no `shell:*`, no `fs:*`, no
`dialog:*`) carries its why-comment in that file; the deny-list is pinned by
the static test. Rationale: execution already lives server-side behind the
loopback guards, so the renderer gets no new capability — a compromised
webview gains nothing.

## 5. Mobile init (deferred — CLI absent)

Run on a machine with the Tauri CLI (`@tauri-apps/cli@2`) and the mobile
prerequisites (Xcode for iOS; Android Studio/SDK+NDK for Android):

```sh
npm i -D @tauri-apps/cli@2
npx tauri ios init        # expected: src-tauri/gen/apple/ + ios/ Xcode project
npx tauri android init    # expected: src-tauri/gen/android/ + android/ Gradle project
```

Neither command was run here (CLI absent — see probe); no `gen/` output is
committed, and no `ios/`/`android/` project directories were invented.
Re-run the probe row after init and update this section.

Viewport-safe UI contract the redesigned pages already satisfy (so no page
work blocks init — verified against `docs/assets/tokens.css` 2026-10-09):
drawer nav takes over below `900px`; the `640px` mobile pass (titled "360px")
collapses grids to one column, stacks form rows, and degrades tables to cards;
toasts fit via `max-width: min(360px, 90vw)`; coarse-pointer targets stay
`>= 44px` (`--touch`). The phone webview therefore gets the same single-column
layout a narrow desktop window gets — init adds no new breakpoints.

## 6. Window sizing

Default `1280x800`, minimum `360x600`, honoring `docs/assets/tokens.css`: the
content column caps at `1200px` (fits the default width), the nav collapses to
a single column below `900px` (usable at the minimum), and toasts size to
`min(360px, 90vw)` (fits the minimum width).

## 7. CI

`.github/workflows/` exists, so `tauri-build.yml` is committed: desktop bundle
matrix (`deb`/`appimage` on Linux, `msi`/`nsis` on Windows, `app`/`dmg` on
macOS); iOS/Android jobs exist as `workflow_dispatch`-only manual jobs because
they need signing identities and SDK/NDK toolchains unavailable to push builds.

## 8. Bundle wiring manifest (verified 2026-10-09 against docs/IA.md)

`frontendDist` is `../docs`, so the bundle ships the FINAL static asset set —
confirmed present on disk, pinned by `tauri-scaffold-static.test.ts`
("bundled frontendDist asset set", fails loudly on drift):

- Ten content pages: `overview.html`, `mission.html`, `operators.html`,
  `evidence.html`, `arsenal.html`, `terminal.html`, `range.html`,
  `engagements.html`, `settings.html`, `about.html`.
- `index.html` — the `/ui/` landing (same document as `overview.html`, so
  existing bookmarks keep working).
- `assets/shell.js` + `assets/tokens.css` — the shared shell and token
  stylesheet every page consumes.

What ships, end to end: the webview renders those bundled `docs/` pages; the
pages call the alongside server (`npm run server` in dev, `npm run server:prod`
beside the installed bundle in prod — section 2 run sequences); mobile pairs
over the LAN opt-in bind with the Bearer-auth upgrade still the named
follow-up (section 3.1). CI builds the desktop matrix on push/PR touching
`src-tauri/**` or `docs/**` and keeps iOS/Android manual (section 7).

## 9. Icons (deferred — CLI absent)

Source of truth `src-tauri/icons/t3mp3st.svg` (512x512 shield + bolt) plus its
README stay committed; no raster/ICNS/ICO binaries are committed and none were
faked. On a CLI-equipped machine run:

```sh
npm i -D @tauri-apps/cli@2
npx tauri icon src-tauri/icons/t3mp3st.svg
```

Expected outputs: the four `bundle.icon` paths `tauri.conf.json` references —
`src-tauri/icons/128x128.png`, `src-tauri/icons/128x128@2x.png`,
`src-tauri/icons/icon.icns`, `src-tauri/icons/icon.ico` — regenerated from the
SVG. Nothing else is expected; if the CLI emits additional sizes, leave the
conf's list as-is unless the bundle build demands otherwise.

## 10. Smoke: cargo check (not runnable here — no Cargo.toml)

`cargo check --manifest-path src-tauri/Cargo.toml` was NOT run: there is no
`src-tauri/Cargo.toml` on disk (verified 2026-10-09 — `src-tauri/` holds only
`tauri.conf.json`, `capabilities/`, `build.rs`, `icons/`). The manifest is
created by `tauri init` / the CLI on a CLI-equipped machine, which also pulls
the `tauri`/`tauri-build` crates `build.rs` already references — so a check
here would only prove the absence, not the build. Outcome honestly recorded:
not verifiable offline on this machine. CI (section 7) runs the real bundle
build once the manifest exists; re-record the outcome here after the first
CLI-backed `tauri build`.
