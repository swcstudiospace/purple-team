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

**Re-probe 2026-10-10 (v1.2 Phase 11):** `@tauri-apps/cli` 2.12.1 installed as
a devDependency (registry reachable); `src-tauri/Cargo.toml` + `src/main.rs` +
`src/lib.rs` added (mobile-template shape — the v1.1 scaffold shipped no Rust
sources, so the wrapper was unbuildable); icons generated and committed
(section 9); `tauri.conf.json` + `capabilities/default.json` converted to
strict JSON (`cargo check` rejected the commented JSON: `key must be a string
at line 4 column 3`); mobile init attempted with recorded blockers (section 5);
`cargo check` outcome recorded in section 10.

## 2. Backend strategy (decision record)

The Tauri webview is a pure UI shell; all execution stays in the server
process. Phase 12 bundles that server as a sidecar the shell spawns itself
(see the prod sequence below). Dev still runs the server alongside:

- **Desktop dev:** run the loopback server alongside, then open the shell
  against it.

  ```sh
  npm run server          # loopback API + /ui on http://127.0.0.1:3333
  npm run tauri:dev       # webview at devUrl http://127.0.0.1:3333/ui
  ```

  (`beforeDevCommand` in `tauri.conf.json` records the `npm run server` pairing.)

- **Desktop prod (Phase 12):** the bundled app self-starts the API sidecar —
  run the installed app; there is no alongside-server step anymore.

  ```sh
  npm run sidecar:build   # dist/server.js -> src-tauri/binaries/t3mp3st-server-<triple> (@yao-pkg/pkg, node22)
  npm run tauri:build     # also builds the sidecar, then bundles it (externalBin)
  ```

  The Rust shell (`src-tauri/src/lib.rs`) spawns the installed
  `t3mp3st-server` (bundler strips the triple suffix; found next to the main
  executable) with `T3MP3ST_PORT=3333` via `std::process::Command` when
  `!tauri::is_dev()`, waits for the loopback listener, and kills+reaps it on
  exit. `bundle.resources` maps `docs/` into the resource directory and the
  sidecar's cwd is that directory, so `express.static('docs')` serves `/ui`.
  Once the listener answers, the shell navigates the webview to
  `http://127.0.0.1:3333/ui/` (same origin as the API). On Windows the asset
  host is `http://tauri.localhost`; `docs/assets/shell.js` points that host at
  the loopback API, and the server treats that origin as the desktop shell
  (not as a loopback Host).

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
  T3MP3ST_HOST=0.0.0.0 T3MP3ST_BEARER_TOKEN=… npm run server   # refuses to start without the token
  npm run tauri:ios      # or: npm run tauri:android
  ```

  On a non-loopback bind the server's strict loopback gates stand down for the
  operator's own same-origin UI by design (see `isSameOriginAsHost`), which is
  exactly the exposure this mode opts into. Treat the LAN as untrusted.

## 3. Follow-ups (NOT this unit — each with its unblock condition)

1. **Bearer-auth upgrade (CLOSED 2026-10-10, Phase 13):** a non-loopback bind
   refuses to start without `T3MP3ST_BEARER_TOKEN` or `T3MP3ST_BEARER_TOKEN_FILE`.
   `/api` requires the bearer and is rate-limited. Loopback, including the
   desktop sidecar, is unchanged. Mobile LAN pairing still needs the token
   (section 2). The Tauri shell does not collect it.
2. **Node sidecar bundling (CLOSED 2026-10-10, Phase 12):** shipped — the
   bundled app now self-starts the API sidecar (section 2 run sequence), so
   desktop prod needs no alongside `npm run server` step. Decision: reuse the
   `npm run build` tsc output (`dist/server.js`) and compile it with
   `@yao-pkg/pkg` (maintained pkg fork) targeting `node22` —
   `npm run sidecar:build` emits `src-tauri/binaries/t3mp3st-server-<triple>`
   (gitignored build artifact), wired via `bundle.externalBin`; the Rust shell
   spawns it with `std::process::Command` (no `tauri-plugin-shell`;
   capabilities stay `core:default` only). Node SEA was rejected:
   postject/binary-patching complexity with no cross-build story. Dev flow
   unchanged (`beforeDevCommand` still runs `npm run server`; the sidecar
   spawns only when `!tauri::is_dev()`).
3. **CLI-dependent generation (closed 2026-10-10, Phase 11):** icons generated
   and committed (section 9); `tauri android init` / `tauri ios init` attempted
   with exact blockers recorded (section 5 — Java/SDK missing; iOS is
   macOS-gated). Remaining unblock conditions live in section 5.

## 4. Capabilities lockdown

`src-tauri/capabilities/default.json` grants only `core:default` on the `main`
window. The file is strict JSON (comments moved here at v1.2 Phase 11): the
deliberate absences are no `shell:*` (no child processes from the webview —
execution stays server-side), no `fs:*` (the UI persists via the API, not
disk), no `dialog:*`, and no request backends beyond the loopback CSP. The
deny-list is pinned by the static test. Rationale: execution already lives
server-side behind the loopback guards, so the renderer gets no new
capability — a compromised webview gains nothing.

## 5. Mobile init (attempted 2026-10-10 — outcomes recorded)

Both commands were run for real on this Linux host with `@tauri-apps/cli` 2.12.1:

- `tauri android init` → **blocked: Java missing.** Exact error: `failed to
  ensure Android environment: Java not found in PATH, default Android Studio
  Java installation not found at /opt/android-studio/jbr and JAVA_HOME
  environment variable is not set. Please install Java before proceeding`.
  No `gen/android` was generated. Unblock: JDK (apt candidate
  `openjdk-17-jdk-headless` exists) + Android SDK/NDK with `ANDROID_HOME` set,
  then rerun `npx tauri android init`.
- `tauri ios init` → **blocked: macOS-gated subcommand.** The CLI exposes no
  `ios` subcommand on Linux (`tauri --help` lists `android` only; the command
  errors `unrecognized subcommand 'ios'`). No `gen/apple` was generated.
  Unblock: run on macOS with Xcode.

No `gen/` output exists to commit and none was invented; rerun the above on an
equipped machine and commit the result.

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

`install-launch` (phase 41) runs after the desktop matrix on pull requests to
`main` and on pushes to `main`. It downloads the `desktop-linux` artifact
(`.deb` and `.AppImage`) and runs `scripts/desktop-install-launch-check.sh`
inside a headless `ubuntu:22.04` container with no DISPLAY and no X server. The
check installs the `.deb` with `apt-get install -y`, confirms `dpkg -s` reports
`install ok installed`, runs `ldd` on each installed ELF executable, starts the
installed `t3mp3st-server` sidecar with a bearer token and polls
`GET /health` for HTTP 200, then stops it and records its exit code. It extracts
the AppImage with `--appimage-extract` (no FUSE mount) and repeats the sidecar
health check on the bundled sidecar, or records not-applicable if the AppImage
does not bundle one. The JSON receipt is uploaded as the
`desktop-install-launch-receipt` artifact (`receipt.json`) and carries each
artifact's sha256 and byte size, the container image reference, and one status
per check. Claim boundary, verbatim: "headless install + ldd + sidecar /health
only; no GUI window or desktop session was launched."

AppImage sidecar restore (phase 41, owner decision). `linuxdeploy --appdir` runs
patchelf on the ELF files in the AppDir. On the bundled `t3mp3st-server` that
inserts 8 KiB before the section headers and shifts the pkg payload appended to
the sidecar, so the AppImage copy fails with `Pkg: Error reading from file` or a
`SyntaxError`. The deb copy of the same build passes. The sidecar format is not
changed. After `tauri-action` builds the AppImage, the `Restore pre-linuxdeploy
sidecar in AppImage` step in `.github/workflows/tauri-build.yml` runs
`scripts/repack-linux-appimage.sh`. The script extracts the AppImage, copies the
build-output sidecar (`src-tauri/binaries/t3mp3st-server-x86_64-unknown-linux-gnu`)
back over the one in the AppDir, rebuilds the AppImage with `appimagetool` 1.9.1
(pinned by sha256), and re-extracts the result to confirm the sidecar matches.
The bundler's sidecar placement is unchanged (`externalBin`, `usr/bin`) for both
packages. The install-launch check records the sha256 of the deb and AppImage
sidecars and fails `appimage-sidecar-identity` unless they match. The check stays
fail-closed and AC-41-06 is not relaxed.

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

## 9. Icons (generated + committed 2026-10-10)

Source of truth `src-tauri/icons/t3mp3st.svg` (512x512 shield + bolt). Rasters
generated with `@tauri-apps/cli` 2.12.1 (`npx tauri icon src-tauri/icons/t3mp3st.svg`)
and committed: the four `bundle.icon` paths (`128x128.png`, `128x128@2x.png`,
`icon.icns`, `icon.ico`) plus the CLI's extra sizes (`32x32.png`, `64x64.png`,
`icon.png`, Windows Store logos, `android/` + `ios/` asset sets). Regenerate
after editing the SVG; the static test pins every `bundle.icon` entry to a real
file on disk.

## 10. Smoke: cargo check (PASS — 2026-10-10)

`cargo check` in `src-tauri/` completed green once Phase 11 added the
manifest + sources and converted the config to strict JSON. First run failed
on the commented JSON (`key must be a string at line 4 column 3` — recorded in
the re-probe above); after the strict-JSON fix: `Finished 'dev' profile
[unoptimized + debuginfo] target(s) in 37.61s`, exit 0, with `tauri 2.12.2` /
`wry 0.57.0` / `tauri-runtime-wry 2.12.1` resolved. CI (section 7) runs the
real bundle build on pushes touching `src-tauri/**` — re-record the bundle
artifact outcome there after the first CI-backed `tauri build`.

## 11. React dashboard in the bundle (PASS — 2026-10-19)

The desktop window lands on the React dashboard (`/app/`), not the static pages.

- `bundle.resources` maps `../ui/dist/` to `ui/dist/` beside `../docs/`. The sidecar's working directory is the resource dir, so its cwd-relative `ui/dist` mount (`/app`) resolves inside the bundle. `src-tauri/src/lib.rs` navigates the window to `/app/` when `<resource dir>/ui/dist/index.html` exists and to `/ui/` otherwise.
- `beforeBuildCommand` is `npm run build && npm run ui:build`, so `tauri build` always bundles a fresh UI. `beforeDevCommand` runs `npm run ui:build` first, so `tauri dev` works from a clean checkout.
- Tauri validates resource paths at build time. A bare `cargo check` in `src-tauri/` fails with `resource path ../ui/dist doesn't exist` until `npm run ui:build` has run; a glob source is rejected the same way (`path not found or didn't match any files`). The sidecar binary is a prerequisite in the same way (`npm run sidecar:build`).
- Smoke on this host (Linux x86_64): `npm run build && npm run sidecar:build && npx tauri build --bundles deb` produced `Purple Team_1.0.0_amd64.deb` (43.4 MB) containing `usr/bin/t3mp3st`, the 117 MB `usr/bin/t3mp3st-server` sidecar, and `usr/lib/Purple Team/{docs,ui/dist}`. The extracted binary was launched under Xvfb: it logged `sidecar spawned`, the sidecar answered `/app/` with 200 and `/` with a 302 to `/app/`, and a screenshot of the window showed the dashboard Overview with live status cards.
- Headless hosts: GTK and WebKitGTK stall before `setup` when the session bus cannot finish portal activation. Stock `MiniBrowser` showed the same blank window, so this is the host, not the app. Run under a private bus: `xvfb-run -a -s "-screen 0 1280x800x24" dbus-run-session -- env NO_AT_BRIDGE=1 GSETTINGS_BACKEND=memory WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 <extracted>/usr/bin/t3mp3st`. The packaged app uses fixed port 3333, so stop any other server on it first.
- Not exercised here: the Windows and macOS bundles are built in CI only, and their windows were not launched. Installers built before this section (for example prerelease `build-965beb0`) open the static UI.
