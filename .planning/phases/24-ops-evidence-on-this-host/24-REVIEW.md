---
phase: 24-ops-evidence-on-this-host
status: issues_found
reviewed: 2026-10-13T02:00:00Z
depth: standard
scope:
  - ca35d87 (Dockerfile repoint + DOCKER.md + Task-1 receipts)
  - cbf29c4 (hostname fix + three-run receipts)
  - ecc3df2 (tauri.conf.json + bundle receipts)
files_reviewed: 4
files_reviewed_list:
  - Dockerfile
  - docs/DOCKER.md
  - src-tauri/tauri.conf.json
  - .planning/phases/24-ops-evidence-on-this-host/24-receipts.md
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
---

# Phase 24: Code Review Report

**Reviewed:** 2026-10-13T02:00:00Z
**Depth:** standard (per-file analysis + cross-file guard/compose/conf consistency checks; no docker/test execution per contract)
**Files Reviewed:** 4 (3 source + 1 artifact)
**Status:** issues_found (info-only; nothing blocks ship)

## Summary

Reviewed the full Phase 24 scope (`ca35d87~1..ecc3df2`: 4 files, +214/−5) against all six
review priorities. The reconciliation is minimal and correct: `Dockerfile:40` is the only
probe edit (path `/api/health` → `/health`, then hostname `localhost` → `127.0.0.1`;
HEALTHCHECK flags byte-identical), `docker-compose.yml` has zero diff (its probe was already
bearer-correct, verified at `HEAD:docker-compose.yml:18`), `src/` has zero diff (guard at
`src/net/remote-access.ts:86-97` still exempts only non-`/api` paths), and the single
`tauri.conf.json` line changes only the bundler `category` (targets, `externalBin`,
`resources`, CSP, capabilities file all untouched). Receipts show observed transitions with
container IDs, inspect JSON, exit codes, and verbatim log lines — not assertions. Token
discipline holds (prefix-only `dc6401a1` + sha256; grep confirms no full value, no
`TOKEN=<hex>` assignment anywhere in receipts). Anti-laundering holds: per-target rows with
bytes + sha256 for deb/AppImage, `CI-evidence-only` cells with workflow links for
msi/nsis/app/dmg, and a truthful `launched? = no` for AppImage (GTK panic on headless host
recorded, not hidden). Both Rule-1 deviations are recorded with root cause, mechanism, and
verification, and both are sound. Two info-level receipt-hygiene notes below; no blocker,
no warning.

## Priority verdicts

1. **Reconciliation minimalism — PASS.** Net source diff is two literals in one HEALTHCHECK
   line plus three DOCKER.md curl lines plus one conf line. `git diff --stat` confirms only
   the 4 in-scope files; `git diff -- docker-compose.yml src/` is 0 bytes. No new guard
   exemption; `/api/health` stays guarded (proven live: no-auth `GET /api/health` → 401 on
   the healthy container). The `/health` handler (`src/server.ts:4982`, untouched) serves a
   real payload via `healthPayload()` — the phase added no always-green endpoint, and run
   (b) proves the probe machinery can reach `unhealthy`, so the healthy receipt is
   non-vacuous.
2. **Receipt honesty — PASS.** Runs (a)/(b)/(c) each carry container ID (64-hex), timestamped
   transition transcript, health JSON / exit code, and verbatim server output. Failure
   mechanism is documented (`--health-cmd` replay of the pre-fix probe on the same digest),
   including the deliberate `127.0.0.1`-for-`localhost` substitution with the stated reason
   (verbatim replay would fail at TCP `::1`-refused and prove nothing about the guard).
   Explicit `No --rm on any receipted run`; grep confirms `--rm` appears only inside those
   `no --rm` sentences.
3. **Anti-laundering — PASS.** Six-row matrix (deb/AppImage with path/bytes/sha256;
   msi/nsis/app/dmg as `CI-evidence-only` with `tauri-build.yml` matrix links). No blanket
   checkmarks. AppImage `launched?` is honestly `no` with the GTK failure quoted.
   `deb` `launched? = no` matches the CONTEXT-deferred v2 item (install-and-launch
   verification deferred), not hidden.
4. **tauri.conf.json change — PASS.** One-line `Security` → `Utility`; `targets` still lists
   all six bundles; `externalBin`, `resources`, icons, CSP untouched;
   `src-tauri/capabilities/` untouched (zero diff). D2 rationale is sound (`Security` is not
   a valid Tauri `AppCategory`; `Utility` is the honest desktop-taxonomy fit) and the
   no-pin-constrains-`category` claim is structurally plausible (pins target productName,
   identifier, frontendDist, targets, externalBin, window geometry, CSP, capabilities).
5. **DOCKER.md — PASS.** `/api/*` examples carry `-H "Authorization: Bearer
   $T3MP3ST_BEARER_TOKEN"`; open `curl http://127.0.0.1:3333/health` sits beside them with
   the guard semantics stated in prose. Matches the reconciled probes (image → open
   `/health`; compose → bearer `/api/health`).
6. **Deviation legitimacy — PASS.** D1 (localhost → 127.0.0.1): root cause evidenced
   (`ss` shows IPv4-only `0.0.0.0:3333 LISTEN`, busybox wget resolves `localhost` to `::1`,
   `wget 127.0.0.1` exits 0), fix uses the same literal compose/DOCKER.md already use, no
   guard/compose/src change, stale container removed before rebuild, superseded first-build
   digest explicitly disclaimed. D2 (category): build log quoted
   (`failed to build bundler settings: invalid category`), minimal fix, pins re-verified.

Supersession check in receipts verified by spot-check: the only `Dockerfile` hit across
v1.3 validation maps is `21-VALIDATION.md:52`, a frozen-boundary `git diff --stat` listing —
not a validated-surface claim. No supersession row required. Correct.

## Info

### IN-01: Receipt cites RepoDigests for a never-pushed image, contradicting the phase's own Pitfall 5

**File:** `.planning/phases/24-ops-evidence-on-this-host/24-receipts.md:32`
**Issue:** The Task-1 table records
`RepoDigests: ["t3mp3st@sha256:2109efdb…"]` (annotated "local manifest ref; image never
pushed"), while 24-RESEARCH.md Pitfall 5 states locally built images show empty RepoDigests
and receipts must never cite it (the note even carries `[ASSUMED on emptiness]`). On modern
Docker with the containerd image store, locally built images *can* carry a RepoDigests
entry, so the receipt may be perfectly accurate — but the tension with the research note is
unresolved in the artifact, and a reader cross-checking research against receipts will flag
it.
**Fix:** Main agent re-runs `docker image inspect t3mp3st:ops01 --format '{{.RepoDigests}}'`
on the host: if populated, add one clause to the receipts row ("containerd image store
populates RepoDigests for local builds on docker 29.x — Pitfall-5 assumption superseded");
if empty, correct the row to `[]` and keep the `.Id` pin as the sole identity receipt
(which is sufficient either way).

### IN-02: DOCKER.md prose URL and curl literals use different loopback spellings

**File:** `docs/DOCKER.md:17-24`
**Issue:** Prose still says the server is available at `http://localhost:3333` while every
curl example (and both probes) now uses `http://127.0.0.1:3333`. Functionally equivalent
for host-side clients (client-resolver, not busybox-in-container), and the D1 lesson
arguably motivates converging on the literal — but the mixed spelling invites a future
"fix" that re-introduces `localhost` into the HEALTHCHECK.
**Fix:** Either change the prose line to `http://127.0.0.1:3333` for one-literal consistency,
or add a one-line note (`Examples use 127.0.0.1 deliberately: busybox wget in the image
resolves localhost to ::1 while the server binds IPv4 — see Phase 24 receipts`). Optional;
not correctness.

---

_Reviewed: 2026-10-13T02:00:00Z_
_Reviewer: Claude (gsd-code-reviewer, Review24)_
_Depth: standard_
