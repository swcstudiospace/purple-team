# v2 Requirements: Phases 39, 40, 41

Scope: milestone v2 phases 39 (ROE verdict ledger and revision history), 40 (ROE text provenance and purple auto-consumption) and 41 (install-and-launch verification of the built `.deb` and AppImage).

Source: the phase 39-41 acceptance list recorded at planning time. Every AC below is copied from that list with its ID; an AC changed after planning is marked `amended` in its text. Total: 33 ACs (Phase 39: 13, Phase 40: 10, Phase 41: 10).

Status: planning. Owner decisions below are binding and resolve the grey-area note in `.planning/ROADMAP.md`.

## Owner Decisions

> Phase 39 ledger storage: append-only JSONL per mission. No SQLite table, no schema migration framework.

> Phase 39 revision history: keep the full ROE revision history. Never prune.

> Phase 40 provenance: stamp who, when and source on NEW ROE records only. Existing records are explicitly marked provenance unknown. No backfill of synthetic values.

> Phase 40 purple consumption: purple auto-consumes recorded verdicts from the phase 39 ledger. Phase 40 depends on phase 39.

> Phase 41 install-and-launch: verify the built .deb and AppImage in a headless Linux container in CI. Linux only. Claim no GUI or desktop launch beyond what the container actually proves.

## Out of Scope

- `.claude/` is not touched by any phase 39-41 lane.
- The stray repo-root file named `Heads-up: while wiring GET '` is not touched.
- v1.5 deferred gaps stay deferred: Phase 29, FH-EXEC-4, and the 72 AC/NFR rows.
- Branches `feat/purple-team-platform` and `dep-bump-npm-audit-fix` are not touched.
- No Notion or Linear rows are created. Notion MCP is disconnected; tracker updates are pending.
- No commit or push to `main`. Work lands only on each lane's branch.

## Verification Categories

- unit: vitest unit test of the named module.
- route test: vitest route test against the Express app.
- smoke: scripted run against a started server, result recorded in the PR.
- CI container: run inside the headless Linux container job in CI.
- manual review: checked by a reviewer from the diff; no automated check exists for it.

## Phase 39: ROE verdict ledger and revision history

- AC-39-01 PUT /api/teams/white/roe appends exactly one JSON line to `<stateRoot>/roe-ledger/<missionId>.jsonl` when stateRoot is a directory (`T3MP3ST_STATE_DIR` set). Earlier lines are never rewritten, truncated or pruned. When `T3MP3ST_STATE_DIR` is unset (stateRoot `memory`), the ledger uses the in-memory backend: no file is written under a relative `memory` directory, and the ledger is per-process like the other ledgers in that mode. Required: one test without the environment variable proving no file is created. (amended: the memory-mode rule and its no-file test were added after planning.)
- AC-39-02 Revision numbers are contiguous per mission from the first line in the mission ledger file (amended by the orchestrator: a migrated ledger starts at the legacy revision N; revisions 1..N-1 are never fabricated). Each new revision = last revision + 1.
- AC-39-03 Each line holds: schemaVersion, revision, missionId, textHash, actionsHash, text (redacted), actions, parseOk, verdicts (roeAudit snapshot at record time; [] when parse not ok), createdAt, recordedAt.
- AC-39-04 PUT body may carry optional `missionId`; default `latest` (the existing single-slot scope). A supplied missionId must match `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`, otherwise 400. Never used unvalidated as a path segment.
- AC-39-05 GET /api/teams/white/roe?missionId=<id> (default `latest`) returns the same response shape as today, derived from the newest revision. A missing ledger yields the cannot-derive report. A corrupt JSONL line is never skipped silently: the GET fails closed to cannot-derive and names the corrupt line number.
- AC-39-06 New GET /api/teams/white/roe/revisions?missionId=<id> returns the full history summary per revision (revision, textHash, actionsHash, recordedAt, verdict counts). New GET /api/teams/white/roe/revisions/:revision returns one full record. Unknown revision → 404.
- AC-39-07 Migration: when the ledger for `latest` does not exist and the legacy state.json snapshot holds a `roeRecords` array (as `buildStateSnapshot()` writes it), the row whose `id` is `latest` is imported once as its existing revision number, preserving textHash, actionsHash and createdAt. Required: a migration fixture in that real array format. Re-running migration appends nothing. (amended: the row is selected by `id`, and the fixture uses the array format, after planning.)
- AC-39-08 The roeRecords slot is removed from the state.json snapshot; the ledger is the only ROE store (clean cutover, no dual write).
- AC-39-09 Persisted ledger text is redactSecrets-wrapped. textHash/actionsHash algorithm unchanged (sha256 hex, first 16 chars).
- AC-39-10 PUT response includes revision, textHash, missionId. 64 KiB cap and 413 behaviour are unchanged.
- AC-39-11 No new auth exemption. New routes stay under /api/ so the bearer and CSRF guards apply.
- AC-39-12 Tests: ledger module unit tests (append, monotonic revisions, corrupt-line fail-closed, mission id validation, migration idempotence, no pruning) and route tests (PUT/GET/history/one-revision/404/400). New code reaches the changed-line coverage floor of 50 %.
- AC-39-13 docs/API_REFERENCE.md documents every new or changed route and the ledger file layout.

## Phase 40: ROE text provenance and purple auto-consumption

- AC-40-01 Revisions recorded after this phase carry `provenance: {status: "recorded", recordedAt, source, recordedBy}`. recordedAt = server ISO timestamp. source = fixed route channel string `api`. recordedBy = trimmed caller-asserted `author` (1-128 chars) when supplied, else null. recordedBy is caller-asserted and must be documented as such.
- AC-40-02 Revisions recorded before this phase, including migrated ones, carry `provenance: {status: "unknown"}` with no recordedAt/source/recordedBy values. No backfill of synthetic values.
- AC-40-03 GET /api/teams/white/roe and the revisions routes expose each revision's provenance block.
- AC-40-04 POST /api/teams/purple/synthesize: when body.verdicts is absent, the route consumes the verdicts of the latest revision in the ledger for body.missionId (default `latest`), stamping each with roeRevision and roeTextHash. Verdicts are ordered by action index, while synthesize() joins by finding position. Therefore auto-consumed verdicts join findings ONLY through body.verdictsByFinding (id-keyed). If verdictsByFinding is absent, auto-consumed verdicts are reported in verdictSource.unjoinedVerdicts (see AC-40-06) but are NOT joined to findings (the join input is []), so no verdict can be assigned to the wrong finding. When body.verdicts is present, the existing explicit path is used unchanged. Required tests: subset of findings and reordered findings under verdictsByFinding, and the no-verdictsByFinding case. (amended: names the response field that carries unjoined verdicts.)
- AC-40-05 When the ledger has no revision, or the latest revision has parseOk false, consumed verdicts are []. The synthesis declares verdictSource.kind `none` with a reason. No verdicts are fabricated.
- AC-40-06 Every synthesis response carries `verdictSource` = {kind: "ledger" | "request" | "none", missionId?, revision?, textHash?, reason?, unjoinedVerdicts?}. `unjoinedVerdicts` is an array of the auto-consumed ledger verdicts, each stamped with roeRevision and roeTextHash. It is present only when kind is `ledger` and body.verdictsByFinding is absent; it is the only response field that carries those verdicts, and the join input stays [], so no finding receives one. (amended: `unjoinedVerdicts` added after planning.)
- AC-40-07 Correlation logic (positional and verdictsByFinding id-keyed) is unchanged.
- AC-40-08 Smoke: PUT ROE (with an action) → POST synthesize with neither a verdicts field nor a verdictsByFinding field → verdictSource.kind == "ledger", verdictSource.revision equals the PUT revision, verdictSource.unjoinedVerdicts non-empty. (amended: names the field the check reads.)
- AC-40-09 Tests cover AC-40-01..08 and reach the 50 % changed-line floor. docs/API_REFERENCE.md updated (verdicts becomes optional, verdictSource added).
- AC-40-10 Phase 40 starts from origin/main AFTER phase 39 is merged, and builds on the phase 39 ledger module.

## Phase 41: install-and-launch verification of the built .deb and AppImage (Linux, headless container, CI)

- AC-41-01 A new CI job runs on pull_request to main (and push to main), after the existing Linux desktop bundle build in .github/workflows/tauri-build.yml produces the .deb and AppImage. It downloads those artifacts.
- AC-41-02 The check runs inside a headless Linux container image (ubuntu 22.04). No DISPLAY, no X server, no window system in the container.
- AC-41-03 Install: in a fresh container, `apt-get install -y ./<pkg>.deb` exits 0 and `dpkg -s <package>` reports `install ok installed`.
- AC-41-04 Linkage: `ldd` on each installed executable shipped by the package reports no `not found`.
- AC-41-05 Sidecar launch: the installed server sidecar starts headless with a bearer token configured, and `GET http://127.0.0.1:<port>/health` returns HTTP 200 before a deadline. The process is stopped afterwards and its exit is recorded.
- AC-41-06 AppImage: the AppImage runs without FUSE (`--appimage-extract-and-run` or an equivalent documented route), and its bundled sidecar answers /health 200 as in AC-41-05. If the AppImage does not bundle the sidecar, that is recorded as an explicit not-applicable check, not a pass.
- AC-41-07 A JSON receipt is uploaded as a CI artifact: artifact name, sha256 and byte size of each .deb/AppImage, container image reference, and one status per check. The job fails if any required check fails.
- AC-41-08 The receipt and job summary state the claim boundary verbatim: "headless install + ldd + sidecar /health only; no GUI window or desktop session was launched."
- AC-41-09 Existing bundle build targets (`--bundles deb,appimage` on linux, msi/nsis on windows, app/dmg on macos) are unchanged.
- AC-41-10 The changed-line coverage gate (`npm run test:pr-coverage`, `scripts/check-changed-line-coverage.mjs`) measures only changed lines in non-test `src/**/*.ts` files. It does not measure `.mjs`, `.ts`, or shell files under `scripts/`, so a script there earns no coverage credit and no coverage percentage may be claimed for it. A new script under `scripts/` is `.mjs` or `.ts` only if a test that runs in CI checks its behaviour; otherwise keep the logic in the workflow YAML plus a small shell script, which the gate does not measure. (amended: the gate's file scope stated after planning.)

## Traceability

Every AC maps to one phase and to the verification that proves it. Phase 40 depends on phase 39; phase 41 is independent of 39 and 40.

| AC-ID | Phase | Verification |
|-------|-------|--------------|
| AC-39-01 | 39 | unit; route test |
| AC-39-02 | 39 | unit |
| AC-39-03 | 39 | unit |
| AC-39-04 | 39 | unit; route test |
| AC-39-05 | 39 | unit; route test |
| AC-39-06 | 39 | route test |
| AC-39-07 | 39 | unit |
| AC-39-08 | 39 | unit |
| AC-39-09 | 39 | unit |
| AC-39-10 | 39 | route test |
| AC-39-11 | 39 | route test |
| AC-39-12 | 39 | unit; route test (plus changed-line coverage gate, `test:pr-coverage`) |
| AC-39-13 | 39 | manual review (docs diff) |
| AC-40-01 | 40 | unit; route test |
| AC-40-02 | 40 | unit; route test |
| AC-40-03 | 40 | route test |
| AC-40-04 | 40 | route test |
| AC-40-05 | 40 | route test |
| AC-40-06 | 40 | route test |
| AC-40-07 | 40 | unit (existing `purple-v2.test.ts` pins) |
| AC-40-08 | 40 | smoke |
| AC-40-09 | 40 | unit; route test (plus changed-line coverage gate); manual review (docs diff) |
| AC-40-10 | 40 | manual review (git ancestry of phase 40 branch vs merged phase 39) |
| AC-41-01 | 41 | CI container |
| AC-41-02 | 41 | CI container |
| AC-41-03 | 41 | CI container |
| AC-41-04 | 41 | CI container |
| AC-41-05 | 41 | CI container |
| AC-41-06 | 41 | CI container |
| AC-41-07 | 41 | CI container |
| AC-41-08 | 41 | CI container |
| AC-41-09 | 41 | CI container (existing bundle build job) |
| AC-41-10 | 41 | unit (if a script is added); manual review (if logic stays in YAML and shell) |
