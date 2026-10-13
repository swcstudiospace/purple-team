# Phase 24: Ops Evidence Receipts (this host)

**Host:** linux x64, kernel 6.8.0-142-generic. All receipts observed live on this host 2026-10-13.
**Image tag:** `t3mp3st:ops01` (never pushed; local evidence tag).
**Token discipline (D-06):** throwaway `openssl rand -hex 32` per run session; committed receipts carry
PREFIX-ONLY (first 8 chars) + sha256. Full value never committed.

## Supersession check (locked constraint)

Grep over all six v1.3 `*-VALIDATION.md` maps plus 21/22/23/24-VALIDATION.md for
`Dockerfile`, `DOCKER.md`, `docker-compose`:
only hit is `21-VALIDATION.md:52` (a frozen-boundary `git diff --stat` listing
`Dockerfile` among boundary paths — not a validated-surface claim).
No v1.3 VALIDATION map names Dockerfile / DOCKER.md / docker-compose.yml as a
validated surface. **No supersession row required.**

## Task 1 — Reconciled image

**Edit:** `Dockerfile:40` probe path `/api/health` → `/health`; flags unchanged
(`--interval=30s --timeout=10s --start-period=40s --retries=3`), wget spider form kept.
Zero diff to `docker-compose.yml` (probe already bearer-correct) and zero diff to `src/`
(guard semantics frozen; `/api/health` stays guarded).
**Docs:** `docs/DOCKER.md:20-25` — `/api/health` example gains
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"`; plain open-probe
`curl http://127.0.0.1:3333/health` added beside it.

### Image receipt

| Field | Value |
|---|---|
| image .Id | `sha256:2109efd13d08a9d76ddb4fc2bc87e37825bfa242ef572c5fbf250709768529f4` |
| image Size | 575736609 bytes (~549 MB) |
| RepoDigests | `["t3mp3st@sha256:2109efd13d08a9d76ddb4fc2bc87e37825bfa242ef572c5fbf250709768529f4"]` (local manifest ref; image never pushed — first-build value observed at build time). Live re-check 2026-10-13 `docker image inspect t3mp3st:ops01 --format '{{json .RepoDigests}} {{.Id}}'` → `["t3mp3st@sha256:55d8c97978e4673f780577caba0679bc8b8b4aac55cf693e3c4fd9aed695f410"] sha256:55d8c97978e4673f780577caba0679bc8b8b4aac55cf693e3c4fd9aed695f410` (docker 29.6.2 containerd image store populates RepoDigests for local builds — 24-RESEARCH.md Pitfall-5 emptiness assumption superseded on this host). Canonical identity pin remains `.Id` + base digest, sufficient either way. |
| base image pin (Dockerfile:3) | `node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2` |
| image Env | `DOCKER=true` present; `ExposedPorts: 3333/tcp` |
| HEALTHCHECK (inspected source) | `wget --no-verbose --tries=1 --spider http://localhost:3333/health \|\| exit 1` |
| build wall time | 128 s (epoch 1791853584 → 1791853712) |
| `grep -c '/health' Dockerfile` | 1 (line 40 only; no `/api/health` remains) |
| `git check-ignore src-tauri/target` | exit 0 (ignored — build outputs never git-stored) |
| SUPERSEDED | First-build rows above describe the path-only image; the Rule-1 hostname fix (Task 2, D1) rebuilt the same tag — final `.Id sha256:55d8c97978e4673f780577caba0679bc8b8b4aac55cf693e3c4fd9aed695f410`, size 575743158, HEALTHCHECK `http://127.0.0.1:3333/health`. All run evidence is off the final digest. |

### Tool versions (this host)

| Tool | Version |
|---|---|
| docker | 29.6.2, build dfc4efb (daemon up) |
| docker compose | v5.3.1 |
| node / npm | v24.18.0 / 11.16.0 |
| cargo / rustc | 1.98.1 |
| tauri-cli (local) | 2.12.1 |
| @yao-pkg/pkg | 6.23.0 |
| patchelf | 0.18.0 (apt-installed this phase; see Task 3) |
| openssl / sha256sum / stat | system present |

### Disk

| When | `df -h .` |
|---|---|
| pre-build | `/dev/sda1 387G 357G 30G 93% /` |
| post-image-build | `/dev/sda1 387G 363G 25G 94% /` |

## Task 2 — Three evidenced container runs

**Image:** `t3mp3st:ops01` rebuilt after the Rule-1 hostname fix —
`.Id sha256:55d8c97978e4673f780577caba0679bc8b8b4aac55cf693e3c4fd9aed695f410`,
size 575743158 bytes, rebuild wall 73 s (epoch 1791853925 → 1791853998).
First-build .Id `2109efdb…` (128 s) superseded; only the final image ran the evidence below.
**Token (throwaway, `openssl rand -hex 32`):** prefix `dc6401a1`,
sha256 `a41e38bbb842c4d76598fc2710e1957316910e83fe5b22ac3f6a43a0b61203c2`.
Full value held in `/tmp/ops01-token` (mode 600, never committed).
**No `--rm` on any receipted run.** `docker ps` pre-check: port 3333 free.

### Deviation D1 (Rule 1 — bug, found during Task 2)

First with-token run against the path-only fix went `starting → unhealthy`
(streak 0→1→2→3, 01:09:19 → 01:10:58) with Health Log
`wget: can't connect to remote host: Connection refused` resolving
`localhost:3333 ([::1]:3333)`. Root cause: busybox wget resolves `localhost`
IPv6-first (`::1`, see container `/etc/hosts`), while the server binds IPv4-only
`0.0.0.0:3333` (`ss -tlnp` inside container: `0.0.0.0:3333 LISTEN`, node pid 29) —
yet `wget http://127.0.0.1:3333/health` from inside the container returned
`remote file exists`, exit 0. So the image probe was doubly broken (guarded path
AND unroutable hostname). Fix: `Dockerfile:40` hostname `localhost` → `127.0.0.1`
(same literal compose and DOCKER.md already use; no guard/exemption/compose/src change).
The stale `t3mp3st-ops01-healthy` container was removed before rebuilding
(receipts above are from the superseded image and are NOT cited as evidence).

### Run (a) — healthy (image HEALTHCHECK as reconciled)

`docker run -d --name t3mp3st-ops01-healthy -e T3MP3ST_BEARER_TOKEN="$TOKEN" t3mp3st:ops01`

| Field | Value |
|---|---|
| container ID | `f06912521376649c4016c7e8c8d709eb55aabdb045b7445051b5cd7918fac22b` |
| transition transcript | `01:13:26 starting streak=0` → `01:13:31 healthy streak=0` |
| final Health JSON | `{"Status":"healthy","FailingStreak":0,"Log":[{"Start":"2026-10-13T01:13:31.230786663Z","End":"2026-10-13T01:13:31.294900221Z","ExitCode":0,"Output":"Connecting to 127.0.0.1:3333 (127.0.0.1:3333)\nremote file exists\n"}]}` |
| server log tail | `[2026-10-13T01:13:31.287Z] GET /health` (probe served, 200) |

### Run (b) — failure path (pre-fix probe replayed via runtime override)

Mechanism: `--health-cmd "wget --no-verbose --tries=1 --spider
http://127.0.0.1:3333/api/health || exit 1"` with
`--health-interval=5s --health-timeout=5s --health-start-period=5s --health-retries=3`
on the SAME image digest. The override replays the documented pre-fix defect (guarded
`/api/health`, no auth) against the real guard; the `127.0.0.1` literal isolates the
guard-401 mechanism (a verbatim `localhost` replay would fail at TCP `::1` refused
and prove nothing about the guard — recorded here as the honest-mechanism choice).

| Field | Value |
|---|---|
| container ID | `7103122780fa51f2f39488bb92eb9f86e9a7ad00070f68b11e5e280091208656` |
| transition transcript | `01:13:42 starting streak=0` → `01:13:47 starting streak=1` → `01:13:53 starting streak=2` → `01:13:58 unhealthy streak=3` |
| verbatim Log Output (every probe) | `Connecting to 127.0.0.1:3333 (127.0.0.1:3333)\nwget: server returned error: HTTP/1.1 401 Unauthorized` (ExitCode 1; 5-entry ring 01:14:07 → 01:14:28, streak kept climbing to 9 — probes keep failing while unhealthy, as designed) |
| final status | `unhealthy streak=9` (observed transition into unhealthy at streak 3) |

### Run (c) — no-token fail-closed refusal

`docker run --name t3mp3st-ops01-notoken t3mp3st:ops01` (foreground, default restart policy `no`).

| Field | Value |
|---|---|
| container ID | `a86e06055f7d4f2125d36206bdfe6ec9fd8b04612334ffbb410c01e91706cabc` |
| exit code | `exit=1` (StartedAt 2026-10-13T01:14:04Z, FinishedAt 2026-10-13T01:14:06Z) |
| verbatim refusal | `[T3MP3ST] Refusing to bind non-loopback host "0.0.0.0" without a bearer token. Set T3MP3ST_BEARER_TOKEN or T3MP3ST_BEARER_TOKEN_FILE and restart.` |

### Guard-intact negative probes (live healthy container, via `docker exec` + image `curl`)

| Probe | Result |
|---|---|
| `GET /api/health` no auth | `401` (guard holds — no exemption landed) |
| `GET /health` no auth | `200` (open by design) |
| `GET /api/health` with bearer | `200` |

Containers kept (no `--rm`) until transcription; torn down after Task-2 commit.

## Task 3 — Host installer matrix (CI-verbatim chain)

### Step 0 — host prep (D-05)

`sudo apt-get update && sudo apt-get install -y patchelf` → `patchelf 0.18.0`
(Ubuntu noble distro package; same package CI installs at tauri-build.yml:57).
apt printed one unrelated warning (hashicorp repo GPG `NO_PUBKEY FC9CA96ACA026560`;
index fallback, install unaffected).

### Stale-byte check (pre-build)

| File | Bytes | mtime | sha256 |
|---|---|---|---|
| `src-tauri/binaries/t3mp3st-server-linux-x64` | 89571371 | 2026-10-10 01:20:12 | `202c228c7a7839f21ef1782680cebab124cddd32a312015ff3316b1f3c2ff378` |
| `src-tauri/binaries/t3mp3st-server-x86_64-unknown-linux-gnu` | 89571371 | 2026-10-10 01:20:12 | `202c228c7a7839f21ef1782680cebab124cddd32a312015ff3316b1f3c2ff378` |

Oct-10 vintage confirmed stale → mandatory fresh `sidecar:build` before bundling.

### Chain (exactly CI order: tauri-build.yml:59-66)

| Step | Wall time |
|---|---|
| `npm run build` (tsc) | 7 s (epoch 1791854150 → 1791854157) |
| `npm run sidecar:build` | 9 s (epoch 1791854162 → 1791854171; pkg base cached) |
| `npx tauri build --bundles deb,appimage` attempt 1 | 138 s (epoch 1791854182 → 1791854320) — FAILED at bundler settings (see D2) |
| `npx tauri build --bundles deb,appimage` attempt 2 | 128 s (epoch 1791854350 → 1791854478) — 2 bundles |
| `df -h .` before → after | `387G 364G 23G 95%` → `387G 366G 21G 95%` |

### Deviation D2 (Rule 1 — bug / Rule 3 — blocker, found during Task 3)

Attempt 1 compiled the release binary (`Finished release profile in 2m 09s`) then
failed: `failed to build bundler settings: invalid category`. Root cause:
`src-tauri/tauri.conf.json:32` `"category": "Security"` — not a valid Tauri
`AppCategory` (no desktop taxonomy ships a Security category). Fix:
`"category": "Utility"` (closest honest category for a console app).
Grep confirms no scaffold pin constrains `category`
(`tauri-scaffold-static.test.ts` and `docs/TAURI.md` have zero `categor` hits);
post-fix pins re-verified 26/26 green. Attempt 2 (release compile cached, 25 s)
bundled both targets.

### Fresh-sidecar receipt (post-build)

| File | Bytes | mtime | sha256 |
|---|---|---|---|
| `src-tauri/binaries/t3mp3st-server-linux-x64` | 89934154 | 2026-10-13 01:16:10 | `ac05547ecf39241d94c7e6c13552454b5abcad2f9cf65e1ccaf0a5ab4e55c842` |
| `src-tauri/binaries/t3mp3st-server-x86_64-unknown-linux-gnu` | 89934154 | 2026-10-13 01:16:10 | `ac05547ecf39241d94c7e6c13552454b5abcad2f9cf65e1ccaf0a5ab4e55c842` |

Both names fresh (size changed 89571371 → 89934154, mtime at/after chain start).
`git check-ignore src-tauri/target` exit 0 (Task 1); bundle paths never git-stored.

### Bundle receipt table (glob-first: `src-tauri/target/release/bundle/{deb,appimage}/`)

| Target | Built-on-host? | Artifact path | Bytes | sha256 | Launched? |
|---|---|---|---|---|---|
| deb | yes | `src-tauri/target/release/bundle/deb/T3MP3ST_1.0.0_amd64.deb` | 36376766 | `9bcfa006aedbbcc188bd31a3440ace516d30a83e772d788f6fe5c058365cd595` | no (install-and-launch deferred to v2) |
| AppImage | yes | `src-tauri/target/release/bundle/appimage/T3MP3ST_1.0.0_amd64.AppImage` | 112257528 | `87e3222d7aa5a259a9e0a860b4801c7c8060b47e03b9c467e7c267c768b42154` | no — `--appimage-extract-and-run` attempted: binary executes, then panics `Failed to initialize gtk backend … Failed to initialize GTK` (headless host, no display). Extraction/bundling proven; GUI launch needs a display (v2). |
| msi | CI-evidence-only | — | — | — | CI: `tauri-build.yml` windows-latest `--bundles msi,nsis` (https://github.com/swcstudiospace/purple-team/blob/main/.github/workflows/tauri-build.yml#L35-L43); green run at phase commit SHA |
| nsis | CI-evidence-only | — | — | — | CI: same windows-latest row as msi |
| app | CI-evidence-only | — | — | — | CI: `tauri-build.yml` macos-latest `--bundles app,dmg` (same URL); green run at phase commit SHA |
| dmg | CI-evidence-only | — | — | — | CI: same macos-latest row as app |

Cross-compiled artifacts never counted as host-observed (locked constraint).

### Gate receipts

| Gate | Result |
|---|---|
| `npm run test:pr` | exit 0 |
| eslint | `177 problems (0 errors, 177 warnings)` — warnings are pre-existing `no-explicit-any` / `no-non-null-assertion` in `src/**`; this phase touches no lint-scoped file (Dockerfile, DOCKER.md, tauri.conf.json, receipts), so the count is unchanged by the phase |
| vitest | `Test Files 102 passed (102)`, `Tests 1125 passed (1125)` |
| scaffold pins | `tauri-scaffold-static.test.ts` 26/26 pass (re-run after category fix) |
| doctor | `28/33 checks passed, 5 warning(s), 0 blocker(s)` (warnings: optional nmap/nuclei/semgrep/promptfoo missing; API-health offline — pre-existing) |
| `git status` (phase scope) | only `Dockerfile`, `docs/DOCKER.md`, `src-tauri/tauri.conf.json`, phase-dir receipts modified; `dist/` and `src-tauri/target/` untouched by git |
