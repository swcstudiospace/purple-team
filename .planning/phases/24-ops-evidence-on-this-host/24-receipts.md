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
| RepoDigests | `["t3mp3st@sha256:2109efd13d08a9d76ddb4fc2bc87e37825bfa242ef572c5fbf250709768529f4"]` (local manifest ref; image never pushed) |
| base image pin (Dockerfile:3) | `node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2` |
| image Env | `DOCKER=true` present; `ExposedPorts: 3333/tcp` |
| HEALTHCHECK (inspected source) | `wget --no-verbose --tries=1 --spider http://localhost:3333/health \|\| exit 1` |
| build wall time | 128 s (epoch 1791853584 → 1791853712) |
| `grep -c '/health' Dockerfile` | 1 (line 40 only; no `/api/health` remains) |
| `git check-ignore src-tauri/target` | exit 0 (ignored — build outputs never git-stored) |

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
