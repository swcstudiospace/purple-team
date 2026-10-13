# Phase 24: Ops Evidence on This Host - Research

**Researched:** 2026-10-13
**Domain:** Docker healthcheck evidence (OPS-01) + host-built Tauri installer matrix (OPS-02)
**Confidence:** HIGH (all wiring verified in-source this session; host probed live; wall-times estimated)

## Summary

Both OPS requirements are **execution+evidence phases over already-correct machinery** — almost nothing needs inventing, but several traps will silently launder or destroy evidence if the plan doesn't route around them. The OPS-01 defect is confirmed on this checkout verbatim: the Dockerfile HEALTHCHECK (Dockerfile:39-40) probes guarded `/api/health` with no auth header, while the guard (`createRemoteGuard`, src/net/remote-access.ts:87) exempts only non-`/api` paths and 401s everything under `/api/*` without the bearer — so the image-level probe can never go healthy in the only sanctioned Docker mode (`DOCKER=true` → 0.0.0.0 → non-loopback → bearer mandatory). The reconciliation is a **one-line Dockerfile edit** (repoint probe to the deliberately-open `/health`, which the same handler serves at src/server.ts:4982) plus curl-example fixes in docs/DOCKER.md:22-23. Compose needs **zero changes** — its probe already sends the bearer (docker-compose.yml:18). The three evidenced runs all work against **one reconciled image**: healthy run as-built; failure run via the documented `docker run --health-cmd` runtime override replaying the pre-fix probe verbatim (401 → FailingStreak 1→2→3 → unhealthy — honest because it exercises real Docker health machinery against the server's real guard behavior); no-token refusal is a plain foreground `docker run` capturing `process.exit(1)` and the exact refusal line (src/server.ts:8529-8530).

For OPS-02 the chain is CI-verbatim: `npm run build && npm run sidecar:build && npx tauri build --bundles deb,appimage` (mirrors .github/workflows/tauri-build.yml:59-66). `patchelf` is confirmed **missing** on this host but installed as root-capable NOPASSWD (`sudo -n true` OK, apt candidate 0.18.0-1.1build1 present) — step 0 is one apt command with an honest-blocker fallback. The stale `src-tauri/binaries/` sidecars (both names, Oct 10, 89,571,371 bytes each) are present and **must be regenerated fresh** — `tauri build`'s `beforeBuildCommand` only runs `tsc`, never `sidecar:build`, so a skipped step silently ships yesterday's server into the artifacts. Receipt discipline: bundle filenames are NOT reliably predictable (product-name casing in deb/AppImage names) — glob the bundle dirs post-build and record what exists; locally built docker images have empty `RepoDigests`, so pin by image config digest (`docker image inspect --format '{{.Id}}'`).

**Primary recommendation:** One image, four receipts. Edit Dockerfile:40 → `/health` + fix DOCKER.md curls; build `t3mp3st:ops01`; run (a) healthy, (b) `--health-cmd` override to guarded `/api/health` no-auth → unhealthy, (c) foreground no-token → exit 1; record `{{.Id}}`, `{{json .State.Health}}`, exit codes. Then patchelf, fresh `sidecar:build`, `npx tauri build --bundles deb,appimage`, glob-artifact receipt table with `stat -c %s` + `sha256sum`, `CI-evidence-only` rows for msi/nsis/app/dmg citing a green CI run.

<user_constraints>

## User Constraints (from CONTEXT.md — verbatim, binding)

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

### Deferred Ideas (OUT OF SCOPE)
- deb/AppImage install-and-launch verification (v2 differentiator; `ar`/`tar` listing optional differentiator if cheap)
- per-rule lint budgets (v2)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Docker healthcheck evidenced in a real container: probes reconciled (repoint to open `/health`, no new guard exemption), with-token `starting → healthy`, failure path exhausting into `unhealthy`, no-token fail-closed refusal; container IDs + inspect receipts | Verified defect at Dockerfile:39-40; handler duality at src/server.ts:4982-4984; guard scope at src/net/remote-access.ts:86-102; refusal text at src/server.ts:8528-8532; three-run matrix + exact inspect format strings below |
| OPS-02 | Desktop installer matrix built on this host: fresh `sidecar:build` → `tauri build --bundles deb,appimage`, per-target receipt table (path/bytes/sha256/launched?), `CI-evidence-only` cells for msi/nsis/app/dmg | Chain at package.json:120-122 + tauri-build.yml:59-66; dual-name sidecar emission in scripts/build-sidecar.mjs; patchelf missing/apt-available, sudo NOPASSWD; stale binaries confirmed on host; receipt commands below |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Health probe semantics (`/health` vs `/api/health`) | Infra (Dockerfile HEALTHCHECK) | API (existing guard + handler, read-only) | The defect is infra config; the server already implements the correct duality — no src/ change |
| Fail-closed bind refusal | API (existing, src/server.ts:8526-8532) | — | Already shipped v1.2 Phase 13; this phase only evidences it |
| Bearer guard on `/api/*` | API (existing, src/net/remote-access.ts:87) | — | Frozen semantics; evidenced, never modified |
| Sidecar binary production | Build tooling (scripts/build-sidecar.mjs via @yao-pkg/pkg) | — | Existing script; run, don't modify |
| deb/AppImage bundling | Build tooling (tauri-bundler + patchelf) | OS (apt host prep) | Existing config; host prep is the only new step |
| msi/nsis/app/dmg evidence | CI (tauri-build.yml matrix) | — | Not buildable on linux-x64; record CI run, never cross-build |

## Standard Stack

No new npm/PyPI packages are installed by this phase — everything is existing tooling.

### Core (all versions probed on this host, 2026-10-13)
| Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docker (client+server) | 29.6.2, daemon up | Image build + all three evidenced runs | Repo's own deployment path [VERIFIED: probe `docker version`] |
| docker compose | v5.3.1 | Compose-probe parity evidence (optional run d) | Existing docker-compose.yml [VERIFIED: probe] |
| node / npm | v24.18.0 / 11.16.0 | `npm run build`, `sidecar:build` | engines `>=22.19.0` (package.json:177) [VERIFIED: probe] |
| cargo / rustc | 1.98.1 / 1.98.1 | tauri release build | CI uses `dtolnay/rust-toolchain@stable` [VERIFIED: probe + tauri-build.yml:47] |
| tauri-cli | 2.12.1 (local `node_modules/.bin/tauri`) | `npx tauri build --bundles deb,appimage` | matches devDep `^2.12.1` [VERIFIED: probe] |
| @yao-pkg/pkg | 6.23.0 | sidecar packing, node22 base | existing devDep; script pre-seeds + sha-verifies base binary [CITED: STACK §1] |
| patchelf | candidate 0.18.0-1.1build1 (apt; **currently MISSING**) | ELF patching by tauri Linux bundler | CI installs it explicitly [VERIFIED: tauri-build.yml:57; probe] |

### Supporting (host receipt tooling, all present)
`openssl` (/usr/bin/openssl — throwaway token), `sha256sum`, `stat`, `ar`, `tar` (optional cheap differentiator) — [VERIFIED: probe].

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `--health-cmd` runtime override for failure run | Build a second throwaway image with a broken probe | Override is zero-build, same image digest for all receipts, and replays the exact pre-fix probe — strictly more honest and cheaper |
| `docker inspect` polling | `docker events --filter event=health_status` | Polling gives a timestamped status+FailingStreak transcript deterministically; events are a fine supplement but attribute shapes are less stable to cite |
| compose-only runs | plain `docker run` | Plain runs avoid compose's `restart: unless-stopped` crash-loop on the no-token refusal and give 1:1 control of `--health-*` flags |

**Installation (step 0 of OPS-02 only):**
```bash
sudo apt-get update && sudo apt-get install -y patchelf
```
Host runs as uid 0 with NOPASSWD sudo [VERIFIED: probe] — fallback if apt is blocked: record the blocker in the receipt table (partial green, no laundering — locked decision).

## Package Legitimacy Audit

**N/A — this phase installs no npm/PyPI/crates packages.** The only system install is `patchelf` (Ubuntu noble distro package, candidate 0.18.0-1.1build1, installed explicitly by CI for the same purpose [VERIFIED: tauri-build.yml:57]) — distro-package provenance via apt, no registry slopsquat surface. `tauri-scaffold-static.test.ts` pins and `@tauri-apps/cli`/`@yao-pkg/pkg` are pre-existing pinned devDeps, unchanged by this phase.

## Architecture Patterns

### System Architecture Diagram (evidence flow)

```
                        ┌──────────────────────────────┐
                        │ docker build -t t3mp3st:ops01 .  │
                        │  (context: .dockerignore-filtered)│
                        └──────────────┬───────────────┘
                                       │ image config digest ({{.Id}})
             ┌─────────────────────────┼──────────────────────────┐
             ▼                         ▼                          ▼
   RUN (a) with-token        RUN (b) failure path         RUN (c) no-token
   image HEALTHCHECK:        --health-cmd override:        foreground docker run
   GET /health → 200         GET /api/health NO AUTH       no T3MP3ST_BEARER_*
   starting ──► healthy      → 401 → streak 1,2,3          DOCKER=true → 0.0.0.0
   (inspect State.Health)    → unhealthy                   → refuse + process.exit(1)
             │                         │                          │
             └────────────┬────────────┴──────────────┬──────────┘
                          ▼                           ▼
              receipts: container IDs, {{json .State.Health}} logs,
              exit codes, docker logs transcript        (OPS-01 done)
                                                       │
   OPS-02: patchelf (step 0) ─► npm run build ─► sidecar:build (fresh,
                          both binary names) ─► npx tauri build --bundles deb,appimage
                                                       │
                          ┌────────────────────────────┴───────────┐
                          ▼                                        ▼
              bundle/deb/*.deb + bundle/appimage/*.AppImage   msi/nsis/app/dmg
              glob → stat -c %s → sha256sum → receipt row      = CI-evidence-only
```

### Pattern 1: The three-run evidence matrix (OPS-01)

One reconciled image; three containers; each receipt = container ID + health JSON + exit code.

| Run | Container | Mechanism | Expected observed transition | Why honest |
|---|---|---|---|---|
| (a) healthy | `t3mp3st-ops01-healthy` | image HEALTHCHECK as reconciled (probes `/health`, open) | `starting` → `healthy`, FailingStreak 0, Log ExitCode 0 | Real probe, real server, no override |
| (b) failure | `t3mp3st-ops01-fail` | `--health-cmd` runtime override replaying the **verbatim pre-fix probe** (guarded `/api/health`, no auth) + compressed `--health-interval=5s --health-timeout=5s --health-start-period=5s --health-retries=3` | FailingStreak 1→2→3 → `unhealthy`; Log Output shows wget 401 error | Docker's real health machinery failing against the server's real guard (the documented defect); no fake endpoint, no staged file; record the mechanism in the receipt |
| (c) no-token | `t3mp3st-ops01-notoken` | foreground `docker run`, no `-e T3MP3ST_BEARER*` | immediate exit code 1; log line `[T3MP3ST] Refusing to bind non-loopback host "0.0.0.0" without a bearer token. Set T3MP3ST_BEARER_TOKEN or T3MP3ST_BEARER_TOKEN_FILE and restart.` | Verbatim fail-closed path from src/server.ts:8526-8532 |

Optional run (d): `docker compose up -d --build` → compose's bearer-carrying probe (docker-compose.yml:18) goes healthy — proves the guarded endpoint + token works, complementing (b)'s 401. Requires a host `.env` (compose `env_file`, docker-compose.yml:8-9) with a **throwaway** token: `openssl rand -hex 32` — never a real secret (the value may be recorded; it protects only an ephemeral 127.0.0.1-published evidence container). Missing `.env` hard-fails compose.

### Pattern 2: OPS-02 build chain (CI-verbatim order)

```bash
# step 0 (host prep, once)
sudo apt-get update && sudo apt-get install -y patchelf

# chain — exactly CI's order (tauri-build.yml:59-66); sidecar FRESH, never stale
npm run build \
  && npm run sidecar:build \
  && npx tauri build --bundles deb,appimage
```

Ordering facts that make this non-negotiable:
- `package.json:122` `tauri:build` = `npm run build && npm run sidecar:build && tauri build` — same order.
- `tauri.conf.json:10` `beforeBuildCommand: "npm run build"` runs tsc again inside tauri build but **never** rebuilds the sidecar.
- `scripts/build-sidecar.mjs` emits **both** names per target [VERIFIED: scripts/build-sidecar.mjs:5-14, 240-245]: `src-tauri/binaries/t3mp3st-server-linux-x64` (pkg name) AND `t3mp3st-server-x86_64-unknown-linux-gnu` (Rust-triple name tauri's bundler resolves `externalBin` against, tauri.conf.json:34). Default arg (no `--triple`) = host triple; **never `--all`** (cross-OS bases are CI's job).
- pkg base-binary pre-seeding: fetched hash-verified into `~/.pkg-cache` on first run; present → fast, absent → ~10-min download (never from-source: script warns + falls back) [VERIFIED: scripts/build-sidecar.mjs:158-208].

### Pattern 3: Receipt schema (what the owner's audit needs, per row)

| Receipt field | Exact command |
|---|---|
| Image digest | `docker image inspect t3mp3st:ops01 --format '{{.Id}}'` (config digest `sha256:…`; locally built images have **empty RepoDigests** — never cite RepoDigests here) `[ASSUMED on emptiness; .Id is always populated]` |
| Base image pin | Dockerfile:3 digest `sha256:16e22a550f…30c3e2` [VERIFIED: Dockerfile:3] |
| Container ID | `docker inspect --format '{{.Id}}' <name>` (or `docker run -d` stdout) |
| Health transitions | timestamped poll: `docker inspect --format '{{.State.Health.Status}} streak={{.State.Health.FailingStreak}}' <name>` every 5s; final full state: `docker inspect --format '{{json .State.Health}}' <name>` (Log entries carry per-probe `ExitCode`/`Output`) |
| Exit code | foreground run: `$?`; or `docker inspect --format '{{.State.ExitCode}} {{.State.StartedAt}} {{.State.FinishedAt}}' <name>` |
| Logs | `docker logs <name> 2>&1` (tail in receipt; keep full transcript in phase dir) |
| Artifact bytes | `stat -c '%n %s bytes' <path>` |
| Artifact sha256 | `sha256sum <path>` |
| Tool versions | `docker --version && docker compose version && node --version && cargo --version && node_modules/.bin/tauri --version && npm ls @yao-pkg/pkg --depth=0 && patchelf --version` |
| Wall time | `date +%s` start/end per step (or `/usr/bin/time -v`); record per step: docker build / sidecar:build / tauri build |
| launched? | honest cell: `no (install-and-launch deferred to v2)`; optional cheap differentiator: `ar t *.deb`, `tar tf *.AppImage` (`ar`/`tar` present [VERIFIED: probe]) |

Artifact locations (glob-first — do NOT hard-code names in the plan):
```
src-tauri/target/release/bundle/deb/       ← *.deb
src-tauri/target/release/bundle/appimage/  ← *.AppImage
```
Prior research expected `t3mp3st_1.0.0_amd64.{deb,AppImage}` from productName/version (tauri.conf.json:3-4) `[ASSUMED — bundler casing not verified; glob and record what exists]`. msi/nsis/app/dmg rows: `CI-evidence-only`, evidence = link to a green `tauri-build.yml` run of the phase's commit SHA (matrix: windows-latest msi,nsis; macos-latest app,dmg [VERIFIED: tauri-build.yml:35-43]).

### Pattern 4: scaffold pins constrain any config fix (read before touching tauri.conf.json)

`src/__tests__/tauri-scaffold-static.test.ts:49-176` pins, verified verbatim this session:
- `conf.productName === 'T3MP3ST'`, `conf.identifier === 'com.t3mp3st.app'`, `conf.version === pkg.version`
- `conf.build.frontendDist === '../docs'`; `devUrl === 'http://127.0.0.1:3333/ui'`; beforeDevCommand contains `npm run server`
- bundle.targets must contain `deb, appimage, msi, app, dmg`; `externalBin` contains `'binaries/t3mp3st-server'`; `resources['../docs/'] === 'docs/'`
- main window: minWidth ≤ 360, width ≥ 1200; CSP contains `connect-src`, matches `127.0.0.1`, must NOT contain `https://*`
- capabilities = exactly `['core:default']`; no `"shell:` / `"fs:` / `"dialog:` / `"http:` grants
- `docs/TAURI.md` must contain `cargo 1.98.1`, `node_modules/.bin/tauri`, `ABSENT`; build.rs contains `tauri_build::build()`
- every bundle icon path and 14 docs assets (index/overview/mission/operators/evidence/defend/arsenal/terminal/range/engagements/settings/about.html + assets/shell.js + assets/tokens.css) must exist

Any first-run config fix must keep these true (or move conf + pin coherently in one commit, never weaker).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Health status observation | HTTP-polling shell scripts against the published port | `docker inspect --format '{{json .State.Health}}'` / `{{.State.Health.Status}}` | Docker itself is the system under test; its Health state incl. per-probe Log/ExitCode is the receipt |
| Failure induction | Second Dockerfile, mock server, firewall tricks | `docker run --health-cmd` override | Runtime override is documented, zero-build, keeps one image digest across receipts |
| Throwaway credential | Hand-made tokens, real secrets from .env | `openssl rand -hex 32` | Present on host [VERIFIED: probe]; nothing to leak |
| ELF patching for bundles | Manual ELF edits, LD_PRELOAD tricks | `patchelf` via apt | Exactly what CI installs for the same bundler [VERIFIED: tauri-build.yml:57] |
| Digest/size capture | Parsing `docker build` stdout | `docker image inspect --format '{{.Id}}'` / `{{.Size}}`, `stat -c %s`, `sha256sum` | Stable, scriptable, receipt-grade |
| Cross-target bundles | Attempted local msi/nsis/app/dmg | CI run link per tauri-build.yml matrix | Locked decision: cross-compiled artifacts never count as host-observed |

**Key insight:** this phase's evidence quality comes from letting the real systems (docker health machinery, tauri bundler, the guarded server) produce their own outputs, then recording those outputs verbatim — any shortcut that stages a green (or a red) is the failure mode OPS-01 exists to eliminate.

## Common Pitfalls

### Pitfall 1: Stale `src-tauri/binaries/` silently ships
**What goes wrong:** both sidecar names already exist on this host (Oct 10, 89,571,371 bytes each [VERIFIED: probe]); skipping `sidecar:build` still produces a green bundle — containing the old server.
**Why it happens:** `tauri build`'s `beforeBuildCommand` is only `npm run build` (tsc → dist/); it never repacks the sidecar.
**How to avoid:** chain order in Pattern 2 is mandatory; delete-or-regenerate `src-tauri/binaries/` before `tauri build`; record sidecar sha256 + mtime in the receipt.
**Warning signs:** artifact built faster than a pkg run could finish; bundle larger/smaller than ~90 MB sidecar.

### Pitfall 2: `restart: unless-stopped` turns the no-token receipt into a crash loop
**What goes wrong:** running the refusal via compose makes the container restart endlessly — exit evidence drowns in retries.
**How to avoid:** run (c) with plain foreground `docker run` (default restart policy `no`); capture `$?` and inline logs. Reserve compose for optional run (d).
**Warning signs:** repeated `[T3MP3ST] Refusing to bind…` lines in `docker logs -f`.

### Pitfall 3: `--rm` destroys inspect evidence
**What goes wrong:** `docker run --rm` removes the container before `docker inspect` can capture State/Health/ExitCode.
**How to avoid:** no `--rm` on any receipted run (foreground no-token is acceptable since logs print inline, but prefer keeping the container and inspecting after exit); clean up only after receipts are transcribed.

### Pitfall 4: start-period masking hides early failures
**What goes wrong:** failures during `--start-period` don't count toward retries (image defaults: 40s period, 30s interval, 3 retries → a failing probe can take ~2 min to surface); a run declared dead too early reads as "flaky" instead of unhealthy.
**How to avoid:** failure run compresses flags (`--health-start-period=5s --health-interval=5s --health-timeout=5s --health-retries=3` → unhealthy in ~20-25s `[ASSUMED timing]`); poll until status changes, don't sample once.

### Pitfall 5: Citing RepoDigests for a locally built image
**What goes wrong:** `RepoDigests` is only populated for pushed/pulled images; a locally built image shows it empty — a receipt citing it is vacuous.
**How to avoid:** pin `{{.Id}}` (config digest) + Dockerfile:3 base digest; note in the receipt that the image was never pushed.

### Pitfall 6: Hard-coded artifact names
**What goes wrong:** plan/executor assume `t3mp3st_1.0.0_amd64.deb`; bundler casing may differ → receipt step "fails" on a phantom file.
**How to avoid:** glob `src-tauri/target/release/bundle/{deb,appimage}/` and record actual filenames [ASSUMED name pattern, see log A2].

### Pitfall 7: Guard-widening "fix" temptation
**What goes wrong:** making the image probe green by exempting `/api/health` from the guard would invalidate the phase (out of scope explicitly) and silently weaken security.
**How to avoid:** the only sanctioned edit is Dockerfile:40 repointing to `/health` (open by design, remote-access.ts:86); negative probe in receipts: no-auth `curl /api/health` through the published port must still 401.

### Pitfall 8: Host port/context surprises
- Port 3333 is free now, but this host runs 17 containers — re-check `docker ps` before runs [VERIFIED: probe].
- `.dockerignore` excludes `.env` (secrets never baked [VERIFIED: .dockerignore:2-4]) but NOT `src-tauri/` → build context carries ~180 MB of sidecar binaries; harmless, just slower first build — do not "optimize" mid-phase.
- `.env` does not exist on the host yet [VERIFIED: probe]; compose fails without it.
- Disk: 30G free with `/` at 93% [VERIFIED: probe]; cargo target dir ~3-6 GB + ~800 MB image `[ASSUMED sizes]` fit, but record `df -h .` before/after in receipts.

## Code Examples

Verified commands (mechanisms from docs.docker.com `docker run`/`inspect` references `[CITED: docs.docker.com/engine/reference/commandline/run/]`, `--health-*` flags stable since 17.x):

### OPS-01 — reconcile, build, evidence
```bash
# 1. Reconcile (phase edit): Dockerfile:40 probe path → /health (keep params):
#    HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#      CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1
# 2. docs/DOCKER.md:22-23 curls gain the bearer header for /api/* (e.g.
#    curl -H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN" http://127.0.0.1:3333/api/health)
#    + a plain curl http://127.0.0.1:3333/health example.

# 3. Build (throwaway tag; --progress=plain transcript into phase dir)
docker build --progress=plain -t t3mp3st:ops01 .
docker image inspect t3mp3st:ops01 --format 'id={{.Id}} size={{.Size}}'

# 4a. Healthy run — observed starting → healthy
TOKEN=$(openssl rand -hex 32)   # throwaway, never a real secret
docker run -d --name t3mp3st-ops01-healthy -e T3MP3ST_BEARER_TOKEN="$TOKEN" t3mp3st:ops01
for i in $(seq 1 24); do printf '%s %s\n' "$(date +%T)" \
  "$(docker inspect --format '{{.State.Health.Status}} streak={{.State.Health.FailingStreak}}' t3mp3st-ops01-healthy)"; \
  sleep 5; done
docker inspect --format '{{json .State.Health}}' t3mp3st-ops01-healthy   # FailingStreak 0, Log ExitCode 0
docker logs t3mp3st-ops01-healthy 2>&1 | tail -20

# 4b. Failure path — pre-fix probe replayed verbatim via runtime override
docker run -d --name t3mp3st-ops01-fail -e T3MP3ST_BEARER_TOKEN="$TOKEN" \
  --health-cmd "wget --no-verbose --tries=1 --spider http://127.0.0.1:3333/api/health || exit 1" \
  --health-interval=5s --health-timeout=5s --health-start-period=5s --health-retries=3 \
  t3mp3st:ops01
# poll as above → streak 1,2,3 → "unhealthy"; Log Output shows wget 401 error
docker inspect --format '{{json .State.Health}}' t3mp3st-ops01-fail

# 4c. No-token fail-closed refusal (foreground, default restart policy)
docker run --name t3mp3st-ops01-notoken t3mp3st:ops01; echo "exit=$?"
# expect exit=1 and exactly (src/server.ts:8529-8530):
#   [T3MP3ST] Refusing to bind non-loopback host "0.0.0.0" without a bearer token. Set T3MP3ST_BEARER_TOKEN or T3MP3ST_BEARER_TOKEN_FILE and restart.
docker inspect --format '{{.State.ExitCode}}' t3mp3st-ops01-notoken   # 1

# 4d. (optional) compose parity — bearer probe on guarded endpoint goes healthy
cp .env.example .env && printf 'T3MP3ST_BEARER_TOKEN=%s\n' "$TOKEN" >> .env
mkdir -p reports evidence
docker compose up -d --build && docker compose ps   # (health: starting) → (healthy)
docker compose down

# cleanup after receipts transcribed
docker rm -f t3mp3st-ops01-healthy t3mp3st-ops01-fail t3mp3st-ops01-notoken
```

### OPS-02 — installer matrix with receipts
```bash
sudo apt-get update && sudo apt-get install -y patchelf && patchelf --version
command -v patchelf || echo "BLOCKED: receipt table records honest partial green"

npm run build   # wall-time from date +%s
npm run sidecar:build
sha256sum src-tauri/binaries/t3mp3st-server-*   # fresh-sidecar receipt (both names)
npx tauri build --bundles deb,appimage          # CI-exact args

ls -la src-tauri/target/release/bundle/deb/ src-tauri/target/release/bundle/appimage/
for f in src-tauri/target/release/bundle/deb/*.deb src-tauri/target/release/bundle/appimage/*.AppImage; do
  stat -c '%n %s bytes' "$f"; sha256sum "$f"
done
# receipt rows: target | built-on-host: yes | path | bytes | sha256 | launched: no (v2)
# msi/nsis/app/dmg rows: CI-evidence-only + tauri-build.yml green run URL @ phase commit SHA
# CI-evidence anchor for the linux pair: same workflow, ubuntu-22.04, args --bundles deb,appimage
```

## Must-Not-Touch Surfaces

1. **`src/**` production code** — server.ts, net/remote-access.ts frozen; guard semantics untouched; no endpoint that 200s regardless of server health; no new guard exemption (`/api/health` stays guarded).
2. **`docker-compose.yml`** — bearer wiring already correct (compose:16-18); zero-diff target; reconcile only Dockerfile + docs/DOCKER.md.
3. **`scripts/build-sidecar.mjs`, `scripts/sidecar.pkg.json`** — run as-is; touch only if a first-run failure demands (then scaffold pins kept true).
4. **`src/__tests__/tauri-scaffold-static.test.ts`** — pins are the contract for any config fix; never weakened to admit drift.
5. **Lint scope** — Dockerfile/DOCKER.md are outside `eslint src/**/*.ts`; expect warning count unchanged; record the running count + 0 errors in gate receipts (locked constraint).
6. **No new runtime dependencies; no `--all` sidecar builds; no local cross-target bundles; no mobile targets; loopback-only runs don't count** (evidence runs must be the `DOCKER=true` 0.0.0.0 mode, which the image ENV guarantees).
7. **Supersession:** none of the six v1.3 VALIDATION maps name Dockerfile/DOCKER.md/compose as validated surfaces [VERIFIED: grep over .planning/milestones this session] — no supersession row; note the check in the phase summary.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | busybox `wget` in node:22-alpine supports `--spider`/`--header` and fails nonzero on 401 | Three-run matrix, compose probe | Low — compose probe (compose:18) is built on the same assumption; fallback `curl -fsS` (curl apk-added, Dockerfile:8) |
| A2 | Bundle filenames like `t3mp3st_1.0.0_amd64.{deb,AppImage}` (bundler casing unverified) | Receipt schema | Low — procedure globs dirs and records actual names |
| A3 | Wall times: docker build 5-10 min first / 1-3 min cached; sidecar 1-3 min; tauri release 10-20 min first (8 cores/31 GB); CI desktop job capped at 40 min [VERIFIED: tauri-build.yml:30] | Time budgets | Plan buffers; only estimates slip |
| A4 | Exact 401 wording inside Health Log Output ("server returned error…") | Receipt expectations | None — receipts record Output verbatim, no paraphrase |
| A5 | AppImage bundling downloads linuxdeploy from GitHub (network needed at build time) | OPS-02 chain | Bundling fails offline → record blocker honestly per host-prep decision |
| A6 | tsx cold start inside container ~10-20 s → healthy within ~45-75 s of `docker run` | Run (a) timing | Poll loop tolerates; no risk to evidence |
| A7 | `~800 MB` image size (docs/DOCKER.md claim) + 3-6 GB cargo target fit in 30G free | Pitfall 8 | Disk pressure → record `df -h` in receipts; clean target only after sha256 receipts |
| A8 | `docker run --health-cmd` string form runs via `/bin/sh -c` (busybox sh present in alpine) | Failure run | Low; fallback exec-form CMD-SHELL equivalent |

## Open Questions

1. **Record the throwaway token value in receipts, or prefix-only?**
   - What we know: token is throwaway (`openssl rand -hex 32`), guards only an ephemeral 127.0.0.1-published container, torn down after receipts.
   - Recommendation: record full value + "throwaway" label for run reproducibility; planner may prefer prefix-only — either satisfies the never-a-real-secret constraint.
2. **AppImage `--appimage-extract-and-run` smoke inside this phase?**
   - What we know: STACK §5 marks it optional; CONTEXT defers install-and-launch to v2; `ar`/`tar` listing named as cheap differentiator.
   - Recommendation: default `launched? = no (v2)`; include `ar t`/`tar tf` listing only if it costs <2 min — it differentiates without scope creep.

## Environment Availability

Probed live on this host, 2026-10-13:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| docker daemon | OPS-01 all runs | ✓ | 29.6.2 (17 containers co-resident; port 3333 free) | — |
| docker compose | optional run (d) | ✓ | v5.3.1 | skip run (d) |
| node/npm | build chain | ✓ | v24.18.0 / 11.16.0 | — |
| cargo/rustc | tauri build | ✓ | 1.98.1 | — |
| tauri-cli (local) | tauri build | ✓ | 2.12.1 | — |
| patchelf | AppImage/deb bundling | ✗ (apt candidate 0.18.0-1.1build1) | — | step-0 install; if blocked → honest partial-green receipt (locked decision) |
| sudo/root | patchelf install | ✓ (uid 0, NOPASSWD) | — | — |
| openssl/sha256sum/stat/ar/tar | receipts | ✓ | system | — |
| `libwebkit2gtk-4.1-dev`, `librsvg2-dev`, `libayatana-appindicator3-dev` | tauri linux build | ✓ (STACK-probed 2026-10-12) | 2.52.6 / 2.58.0 / 0.5.93 | — [CITED: STACK §1] |
| disk headroom | builds | ~30G free (`/` 93%) | — | monitor; prune docker only with care |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `patchelf` (install-at-step-0; honest blocker receipt if apt fails).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Evidence receipts (docker CLI + sha256sum/stat) — no new test framework; existing vitest 4.1.9 suite guards regressions |
| Config file | `vitest.config.ts` (existing); receipts live in phase dir artifacts |
| Quick run command | `docker inspect --format '{{.State.Health.Status}}' <container>` / `sha256sum <artifact>` (per-run receipt check) |
| Full suite command | full receipt sweep (all runs + artifact table + tool versions + wall times) then `npm run test:pr` (lint 0 errors, warning count unchanged) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | with-token container reaches healthy | evidence run | `docker inspect --format '{{json .State.Health}}' t3mp3st-ops01-healthy` → Status healthy, FailingStreak 0 | n/a (receipt) |
| OPS-01 | failure path exhausts to unhealthy | evidence run | `docker inspect --format '{{.State.Health.Status}}' t3mp3st-ops01-fail` → unhealthy after streak 3 | n/a (receipt) |
| OPS-01 | no-token fail-closed refusal | evidence run | `docker run --name t3mp3st-ops01-notoken t3mp3st:ops01; echo $?` → 1 + verbatim refusal line in logs | n/a (receipt) |
| OPS-01 | guard not weakened (negative probe) | evidence run | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3333/api/health` (published port, no auth) → 401; `/health` → 200 | n/a (receipt) |
| OPS-02 | fresh sidecar both names | build receipt | `sha256sum src-tauri/binaries/t3mp3st-server-{linux-x64,x86_64-unknown-linux-gnu}` (mtimes ≥ build start) | n/a (receipt) |
| OPS-02 | deb + AppImage artifacts with sha256 | build receipt | `stat -c '%n %s' … && sha256sum src-tauri/target/release/bundle/{deb/*.deb,appimage/*.AppImage}` | n/a (receipt) |
| OPS-02 | CI-evidence-only rows | documentation | tauri-build.yml green run URL for msi/nsis/app/dmg at phase commit SHA | n/a (receipt) |
| both | no regression from config/docs edits | regression suite | `npm run test:pr` (includes `tauri-scaffold-static.test.ts` pins) | ✅ existing |

### Sampling Rate
- **Per task commit:** that task's receipt command(s) green + transcribed.
- **Per wave merge:** receipt sweep complete for all runs/artifacts.
- **Phase gate:** full receipt table + `npm run test:pr` green (0 errors, warning count recorded) before `/gsd:verify-work`.

### Wave 0 Gaps
None — no new test files or framework config needed; evidence infrastructure is the docker CLI + coreutils, all probed present. Existing `tauri-scaffold-static.test.ts` covers config-fix regressions.

## Security Domain

`security_enforcement` not disabled in config (config.json absent → treated enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (evidence-only) | Existing bearer guard verified, never modified; throwaway `openssl rand -hex 32` token |
| V3 Session Management | no | No sessions in scope |
| V4 Access Control | yes | Negative probe in receipts: `/api/health` 401 without bearer, `/health` 200 — proves no exemption landed |
| V5 Input Validation | no | No new inputs |
| V6 Cryptography | no | No crypto introduced |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command-executing API exposed beyond loopback | Elevation of Privilege | 127.0.0.1 port pin (compose:16) + mandatory bearer on non-loopback bind (server.ts:8526-8532); never `-p 3333:3333` or `network_mode: host` [CITED: docs/DOCKER.md:185-193] |
| Secrets baked into image | Information Disclosure | `.env*` excluded from build context (.dockerignore:2-4) [VERIFIED]; throwaway token only |
| Guard erosion to make probes pass | Tampering | Out-of-scope by locked decision; negative 401 probe is the receipt-level tripwire |

## Sources

### Primary (HIGH confidence — read this session, quotes verbatim)
- `Dockerfile:3,32-43` — ENV DOCKER=true, EXPOSE, HEALTHCHECK stanza, CMD
- `src/server.ts:179,187-193,196,345-349,357-379,4982-4987,8520-8532` — HOST/PORT, loopback test, bearerLoad, guard mount, initLLM warn-and-continue, health route duality, fail-closed refusal
- `src/net/remote-access.ts:86-103` — guard scope comment, `/api` path check, 401 body
- `docker-compose.yml:7-21` — env_file, port pin, bearer healthcheck with `$$` escape
- `package.json:20,35,120-122` — build/server/sidecar:build/tauri:build scripts
- `scripts/build-sidecar.mjs:4-14,120-124,158-208,214-247` — dual-name emission, node22 target, base-binary pre-seed, pkg invocation
- `src-tauri/tauri.conf.json:3-4,10,30-37` — productName/version, beforeBuildCommand, targets, externalBin, resources
- `src/__tests__/tauri-scaffold-static.test.ts:49-176` — all scaffold pins (quoted above)
- `.github/workflows/tauri-build.yml:30,35-43,56-66` — CI matrix, apt line, build order, 40-min cap
- `docs/DOCKER.md:18-23,185-193` — curls to fix, security notes
- `.dockerignore`, `.env.example:31-37`, `.planning/milestones/**` grep — supersession check

### Secondary (MEDIUM confidence)
- `[CITED: docs.docker.com/engine/reference/commandline/run/]` — `--health-cmd/--health-interval/--health-retries/--health-start-period` flags
- `[CITED: .planning/research/STACK.md §1,§3,§5]` — host toolchain probe 2026-10-12 (webkit/ayatana libs present, pkg-fetch fallback)

### Tertiary (LOW confidence — flagged [ASSUMED] in log)
- Wall-time estimates, bundle filename casing, busybox wget 401 wording, image size

## Metadata

**Confidence breakdown:**
- OPS-01 wiring: HIGH — every stanza read in-source this session with verbatim quotes
- OPS-02 chain: HIGH for code/config order; MEDIUM for runtime behavior (bundle names, network fetches) — receipt procedure is glob-first to absorb it
- Host readiness: HIGH — live probes today (patchelf missing, sudo OK, port free, stale binaries confirmed)

**Research date:** 2026-10-13
**Valid until:** ~2026-11-12 (stable infra; re-probe docker/tauri versions only if host changes)
