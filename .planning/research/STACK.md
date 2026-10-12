# STACK Research — v1.4 Hardening & Validation

Research date: 2026-10-12 · Host: linux x64, Ubuntu 24.04.4 · Repo: `swcstudiospace/purple-team` (T3MP3ST)
Scope: tooling/versions/commands for (a) VAL-01 retroactive validation of phases 15–20, (b) OPS-01 real-container docker healthcheck, (c) OPS-02 local installer matrix, (d) LINT-01 lint baseline 177→≤176. No new capabilities; everything below already exists in the repo.

---

## 1. Host toolchain inventory (verified on this host, 2026-10-12)

| Tool | Host version | Repo requirement | Verdict |
|---|---|---|---|
| node | v24.18.0 | `engines.node >=22.19.0` (package.json:175); CI pins node 22 (ci.yml:29) | ✓ satisfies engines; sidecar is unaffected (pkg bundles its own node22) |
| npm | 11.16.0 | lockfileVersion-driven `npm ci` | ✓ |
| docker | 29.6.2 (daemon up, Ubuntu 24.04) | Dockerfile:1 `docker/dockerfile:1`, buildkit default | ✓ |
| docker compose | v5.3.1 | docker-compose.yml | ✓ |
| rustc / cargo | 1.98.1 | tauri-build/tauri = `"2"` (src-tauri/Cargo.toml:15,19) — no MSRV pin in repo | ✓ stable channel is what CI uses (`dtolnay/rust-toolchain@stable`, tauri-build.yml:66) |
| @tauri-apps/cli | 2.12.1 (local, `npx --no-install`) | `^2.12.1` (package.json:168) | ✓ matches |
| eslint | 9.39.2 (flat config) | `^9.39.2` | ✓ |
| typescript | 5.9.3 installed | `^5.3.3` | ✓ |
| vitest | 4.1.9 | `^4.1.9`; coverage `@vitest/coverage-v8` 4.1.9 | ✓ |
| @yao-pkg/pkg | 6.23.0 (+ pkg-fetch 3.6.6) | `^6.23.0`; NODE_TARGET `node22` (scripts/build-sidecar.mjs:38) | ✓ pkg-fetch 3.6 still publishes node22 bases; script pre-seeds + sha-verifies and falls back to `PKG_FETCH_FALLBACK_TAG='v3.5'` (build-sidecar.mjs:46) |

**Host gaps (installer matrix only):**
- `patchelf` — NOT installed; present in apt candidates. Required by the Tauri Linux bundler (AppImage/DEB ELF patching). CI installs it explicitly (tauri-build.yml:70: `apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`).
- `libappindicator3-dev` — absent from noble, but the noble equivalent `libayatana-appindicator3-dev` 0.5.93 **is installed**. `tauri = { features = [] }` (src-tauri/Cargo.toml:19) means no tray feature, so appindicator is not compile-critical here.
- `libwebkit2gtk-4.1-dev` 2.52.6 and `librsvg2-dev` 2.58.0 already installed.

One-time host prep (mirrors CI's apt line, noble spellings):
```bash
sudo apt-get update && sudo apt-get install -y patchelf   # libayatana-appindicator3-dev substitutes libappindicator3-dev on 24.04
```

## 2. VAL-01 — retroactive validate-phase evidence, phases 15–20

The audit states validate-phase "was never run"; evidence lives in gate runs + three deterministic benches (v1.3-MILESTONE-AUDIT.md tech_debt[0], Nyquist: phases 15–20 `not_validated`). No VALIDATION.md files exist anywhere under `.planning/` (verified). Every evidence command is already scripted — nothing new is needed.

**Gate parity with CI** (`.github/workflows/ci.yml:46` runs exactly this):
```bash
npm run test:pr        # package.json:81 = lint && typecheck && test && doctor
```
- `lint` = `eslint src/**/*.ts` (package.json:88) — 0-error gate; warnings counted, see §4.
- `typecheck` = `tsc --noEmit` (package.json:89).
- `test` = `vitest run src && test-ops-preflight && test-model-matrix && refusal-frontier --self-test` (package.json:80). The v1.3 "CI-pinned catalog tests" (110→115 pins, benches' ground truth) run inside this vitest pass.
- `doctor` = `node scripts/doctor.mjs` (package.json:25) — env/npm-script/asset/health checks, blockers+warnings; exits nonzero on blockers (scripts/doctor.mjs:129-152).

**Full release-grade chain** (for the milestone-level evidence table; `.github/workflows/ci.yml:104` runs this on tags):
```bash
npm run test:release   # package.json:84 = test:pr chain + test:coverage + verify-claims
                       #   + no-fitting/no-self-fitting/no-phantom-tools + test:gate
                       #   + prompt:audit + smoke + build + pack:dry-run
```
- `test:coverage` (package.json:86) uses `@vitest/coverage-v8` 4.1.9; CI additionally enforces the 50% changed-line floor via `npm run test:pr-coverage` with `PR_CHANGED_LINE_COVERAGE=50` (ci.yml:53-60, package.json:82) — replicate locally with `PR_CHANGED_LINE_COVERAGE=50 npm run test:pr-coverage`.
- `test:gate` rebuilds then runs `scripts/test-gate.mjs` (package.json:111) — needs `dist/` fresh.

**Bench evidence (phases 16/18/19; the audit's 4/4, 6/6, 6/6):** benches import the real `dist/` pipeline (v1.3-MILESTONE-AUDIT.md §Integration), so build first, then:
```bash
npm run build          # package.json:20 = tsc  (prerequisite for all three)
npm run blue:bench     # package.json:48  scripts/detection-coverage-bench.mjs
npm run black:bench    # package.json:47  scripts/opsec-review-bench.mjs
npm run white:bench    # package.json:49  scripts/roe-adjudication-bench.mjs
```
Exit semantics: each bench self-reports gate counts and exits nonzero on gate failure (deterministic; no live LLM calls — only the `:live` variants hit networks and are NOT part of validation evidence).

Phase→evidence mapping for VALIDATION.md (all from audit table):
- 15 blue core → catalog-grant pins (in `npm test`) + blue:bench
- 16 blue playbook/bench → blue:bench 4/4 + hats/gateway pins (in `npm test`)
- 17 black core → 16-row numeric noise table + disjointness pins (in `npm test`)
- 18 black playbook/bench → black:bench 6/6 + ATTACK_BY_ID pin test
- 19 white suite → white:bench 6/6 + parser-honesty + roe.allowedTargets regression pin
- 20 purple v2/Defend UI → shuffled-map id-join test + Defend page asset pins (in `npm test`)

VAL-01 also covers ROE-01/UNIFY-01 once implemented: same gates + white:bench; no extra tooling.

## 3. OPS-01 — Docker healthcheck in a real container

Wiring (all existing):
- Image: `Dockerfile:33-38` — `ENV DOCKER=true`, `EXPOSE 3333`, `HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD wget --spider http://localhost:3333/api/health`, `CMD npm run server` (Dockerfile:40). Base `node:22-alpine` pinned by digest (Dockerfile:3); apk adds `curl` and `wget` (busybox) exists.
- Bind logic: `DOCKER=true` → `HOST=0.0.0.0` (src/server.ts:188) → non-loopback → **server refuses to start without `T3MP3ST_BEARER_TOKEN[_FILE]`** (src/server.ts:8424-8430) and mounts the remote guard on **every `/api/*` path** (src/server.ts:345-349; scope check src/net/remote-access.ts:94) returning **401** without `Authorization: Bearer` (src/net/remote-access.ts:103-108). The root `/health` route is OUTSIDE the guard (remote-access.ts:86 comment + 94 check) and is registered at src/server.ts:4968 as `['/health', '/api/health']`.
- Compose: `docker-compose.yml:14-20` overrides the image healthcheck with a bearer-carrying probe: `wget --spider --header="Authorization: Bearer $$T3MP3ST_BEARER_TOKEN" http://127.0.0.1:3333/api/health`; `env_file: .env` (line 7) supplies the token; host port stays loopback-pinned `127.0.0.1:3333:3333` (line 14).

**Consequence the phase must plan for (verified from the wiring above):** in any validly-started container (bearer mandatory), the **image-level** HEALTHCHECK probes the guarded `/api/health` with no auth → 401 → busybox `wget --spider` fails → `docker run` reports `unhealthy` forever, while the **compose-level** healthcheck (bearer header) reports `healthy`. Expected evidence semantics:

```bash
# (a) compose-managed healthcheck — expected: healthy
cp .env.example .env && $EDITOR .env        # set T3MP3ST_BEARER_TOKEN (placeholders at .env.example:36-37); required or the server exits(1)
docker compose up -d --build
docker compose ps                            # STATUS shows (health: starting) → (healthy) within ~40s start_period + 1 probe
docker inspect --format '{{json .State.Health}}' t3mp3st   # FailingStays 0; Log shows 200 probes
docker compose logs app | grep -i health

# (b) bare image HEALTHCHECK — expected current behavior: unhealthy (401 on guarded /api/health)
docker build -t t3mp3st:ops01 .
docker run -d --name t3mp3st-ops01 -e T3MP3ST_BEARER_TOKEN=evidence-token -e T3MP3ST_PORT=3333 t3mp3st:ops01
docker inspect --format '{{.State.Health.Status}}' t3mp3st-ops01   # → "unhealthy" (documents the gap)
docker logs t3mp3st-ops01
docker rm -f t3mp3st-ops01 && docker compose down
```
The minimal remediation (switch the Dockerfile probe to the unguarded `/health`, or send the header there) is OPS-01 phase work, not research; this file only pins the observed wiring and the reproduce/verify commands. No new tooling: docker + compose only.

## 4. LINT-01 — measure and hold the warning baseline

- Gate: `npm run lint` = `eslint src/**/*.ts` (package.json:88) against flat config `eslint.config.js` (recommended sets + warn rules: `no-unused-vars`, `no-explicit-any`, `no-non-null-assertion`, `curly` multi-line; ignores `dist/`, `node_modules/`, `*.js`, `*.mjs`). No `--max-warnings` anywhere in the repo (grepped) → warnings never fail the gate; CI enforces 0 errors only.
- Drift: audit records 176 → 177 from phase 20 (v1.3-MILESTONE-AUDIT.md tech_debt phase 20).

Measure deterministically (existing eslint, JSON formatter, no new deps):
```bash
npx eslint "src/**/*.ts" --format json \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d);console.log("errors",r.reduce((s,f)=>s+f.errorCount,0),"warnings",r.reduce((s,f)=>s+f.warningCount,0))})'
# hold: fail if warnings > 176
npx eslint "src/**/*.ts" --max-warnings 176        # exit 1 when exceeded; human summary via plain `npm run lint`
```
Fix path is code-level (delete dead code / type the `any` / underscore-prefix unused per existing `argsIgnorePattern:'^_'`), not config-level. VALIDATION.md should record: count before, count after, and `--max-warnings 176` green.

## 5. OPS-02 — installer matrix on this linux x64 host

Existing chain (package.json:122): `tauri:build` = `npm run build && npm run sidecar:build && tauri build`.
```bash
# one-time: sudo apt-get install -y patchelf   (see §1)
npm run tauri:build
# or mirror CI's explicit Linux target selection (tauri-build.yml:56 args: --bundles deb,appimage):
npm run build && npm run sidecar:build && npx tauri build --bundles deb,appimage
```
- Sidecar: `scripts/build-sidecar.mjs` packs `dist/server.js` with @yao-pkg/pkg 6.23.0 at `node22`, emitting `src-tauri/binaries/t3mp3st-server-linux-x64` AND `…-x86_64-unknown-linux-gnu` (both names required: `bundle.externalBin = ["binaries/t3mp3st-server"]`, src-tauri/tauri.conf.json:44; tauri appends the cargo triple `x86_64-unknown-linux-gnu`). Default (no args) = host triple; `--all` = linux/win/darwin×2 (build-sidecar.mjs:33-40) — **do not use `--all` locally**: win/darwin bases are cross-fetches the matrix doesn't need. A stale/stripped `src-tauri/binaries/` (already present from a prior build) fails the bundle, so run `sidecar:build` fresh.
- Expected outputs: `src-tauri/target/release/bundle/deb/t3mp3st_1.0.0_amd64.deb` and `…/appimage/t3mp3st_1.0.0_amd64.AppImage` (productName/version from src-tauri/tauri.conf.json:3-4; currently absent — directory not created yet).
- `tauri.conf.json:42` lists all six targets (`deb,appimage,msi,nsis,app,dmg`); on Linux the bundler builds the two applicable ones — passing `--bundles deb,appimage` (CI's exact args) keeps the log unambiguous for evidence. msi/nsis/app/dmg remain CI-only per the matrix (windows-latest/macos-latest, tauri-build.yml:49-54); evidence for OPS-02 is the Linux pair built on this host + CI green for the rest.
- Smoke after build (optional but recommended): `./src-tauri/target/release/bundle/appimage/*.AppImage --appimage-extract-and-run &` then `curl -s http://127.0.0.1:3333/api/health` (loopback sidecar, no bearer needed — v1.2 posture).

## 6. Integration points (no new code required by research)

- `npm run build` is the shared prerequisite for benches, test:gate, sidecar:build, and the docker image — run it before any of them.
- `src/server.ts` health routes (4968) + `src/net/remote-access.ts` guard scope are the only OPS-01-relevant integration surface.
- `scripts/doctor.mjs` probes `GET /api/health` live when the server runs (scripts/doctor.mjs:109) — evidence runs can pair `npm run server` + `npm run doctor` for the live-API check block.
- Tauri dev loop for post-OPS-02 sanity: `npm run tauri:dev` (package.json:121) — same `beforeDevCommand: npm run server` from tauri.conf.json:9.

## 7. What must NOT be added

1. **No new runtime dependencies** — PROJECT.md constraint ("Stack: no new runtime dependencies unless unavoidable"); every command above uses existing devDeps/scripts. wget/curl in the healthcheck come from the alpine base (Dockerfile:6-11), not new packages.
2. **No new lint suppression to hit ≤176** — no `eslint-disable` comments, no rule downgrades/removals in `eslint.config.js`, no file ignores appended: LINT-01 is "fix warnings in code"; `--max-warnings` on the CLI invocation is the only acceptable enforcement knob.
3. **No live-network variants in validation evidence** — `*:live` bench variants, `smoke:live`, `probe:frontier` are out; deterministic gates only.
4. **No mobile targets on this host** — iOS/Android stay manual-dispatch CI jobs (tauri-build.yml:82-119); no JDK/Android SDK/Xcode work locally.
5. **No new test runner/framework or coverage tool** — vitest 4.1.9 + `@vitest/coverage-v8` stay; VALIDATION.md cites existing gate outputs, it doesn't add a second evidence pipeline.
6. **No Dockerfile/compose semantic drift while gathering evidence** — probe the system as committed first (recording the image-HEALTHCHECK-unhealthy finding), then let OPS-01's own phase change the wiring deliberately; don't pre-emptively rewrite the healthcheck "to make it green."
7. **No `--all` sidecar builds or extra bundle targets locally** — linux-x64 + deb/appimage only; cross-target bases and msi/nsis/app/dmg belong to CI.
