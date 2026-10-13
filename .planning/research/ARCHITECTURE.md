# v1.4 Architecture Research — Integration Points & Build Order

Research type: ARCHITECTURE · Milestone: v1.4 Hardening & Validation · Date: 2026-10-12
Every path below was verified on this checkout. [INFERENCE] marks recommendations, not observed facts.

---

## 1. ROE-01 — ROE text source → verdicts-on-record

### Where the state must live
`src/server.ts` is the single stateful module; everything under `src/teams/` is pure, no-I/O ("Dependency direction stays server → teams", server.ts blue/black/white route banners). The server-state block is module-level Maps at **src/server.ts:898-904** (`approvalRequests`, `evidenceLedger`, `findingsLedger`, `retestLedger`, `hypothesisLedger`, `workOrderLedger`, `watchCycleLedger`) plus `purpleSyntheses` — the v1.3 precedent for a single-slot store keyed `'latest'` (server.ts:6454-6460).

The exact pattern ROE-01 extends:
- **Snapshot slot**: `buildStateSnapshot()` enumerates each store (server.ts:1181-1187; `purpleSyntheses` already has a slot).
- **Restore**: `replaceMapContents(store, state.<slot>)` (server.ts:1252-1258), loaded in `startServer()` → `loadPersistedState()`.
- **Persistence**: `persistState` debounced writer flushes the whole snapshot to `${T3MP3ST_STATE_DIR}/state.json` via `writeFile(redactSecrets(...))` (server.ts:1002-1012, 1198-1205); `emitContractEvent` schedules the flush. Graceful-shutdown `flushPersist` closes the debounce gap (server.ts:1225-1227, 8461).

[INFERENCE] Recommended shape: a dedicated ROE store in the same block — e.g. `roeTexts = new Map<string, { text, updatedAt }>()` keyed `'on-record'` (mirrors `purpleSyntheses`), + snapshot slot + restore line. Do **not** put ROE text on `MissionDraft` (drafts carry only objective/scope/constraints; the v1.3 route comment at server.ts:6555-6563 rules this out and the static pin enforces the store's location).

### Pure machinery already in place (no changes needed)
- `parseRoe(text: string): RoeParseResult` — src/teams/white/roe-parser.ts (grammar: `scope:`/`allow active:` directives, bullets, comments; `ok` only when every line accounted for).
- `roeAudit(actions: AuditedAction[], roe: RoeSpec): RoeVerdict[]` — src/teams/white.ts:40. `AuditedAction = { command?, target?, approved?, scope? }` (white.ts:12-17); `RoeVerdict = { actionIndex, verdict: 'compliant'|'violation'|'needs_approval', rationale, conditions }`.
- `PurpleVerdictByFinding` input shape on `POST /api/teams/purple/synthesize` (server.ts:6383-6433) already accepts verdicts-on-record once a source exists.

### Routes
- **Modify** `GET /api/teams/white/roe` (server.ts:6564-6567): today it returns `{ ...parseRoe(''), summary: 'no ROE text on record' }`. After ROE-01: parse the stored text; when `parse.ok`, feed `roeAudit` over on-record actions (mission drafts are the only action-ish server state — same accessor the black routes use at server.ts:6575/6596: latest-updated `missionDrafts` row, `objective`+`scope` lines as actions [INFERENCE]) and append verdicts to the response. Envelope grows additively; `redactSecrets` wrapper stays.
- **New** mutation route (`POST`/`PUT /api/teams/white/roe`) accepting `{ text }` (validate: string; store; return the fresh parse). This is the only genuinely new server surface.

### Loopback vs bearer implications (all automatic — zero new security code)
- Loopback (default + Tauri sidecar): anti-rebinding Host guard (server.ts:326-334) + cross-origin CSRF/Origin guard (server.ts:290-300, trusts no-Origin curl/CLI and same-origin UI). UI fetch and curl work unauthenticated.
- Non-loopback (Docker `DOCKER=true` → 0.0.0.0): `createRemoteGuard` (server.ts:346-351, src/net/remote-access.ts:88-116) demands `Authorization: Bearer` + 60/min burst-120 on **every** `/api/*` path. The ROE write is a mutation → bearer-gated like approval grants; the MCP proxy already sends the bearer. Loopback behavior unchanged — preserves the v1.2 Phase 13 contract.
- Redaction decision: store operator text as-given (redacting at write could mangle directive grammar lines); redaction stays read-time (`redactSecrets` on GET + snapshot persist). Divergence from findings/evidence ledgers (which `redactLedgerText` at write) is deliberate — document it in the route comment.

### Pins/tests that must move with the change
- **src/__tests__/white-routes-static.test.ts:63-65** — currently pins "the roe route invents no ROE store" (`routeBlock` must NOT contain `roeLedger`, must contain `parseRoe(`). ROE-01 legitimately introduces the sanctioned store: this pin is rewritten (still assert `parseRoe(`; assert the single sanctioned store name, no second store). Route list at line 7 grows with the mutation route.
- **src/__tests__/white-suite.test.ts** — parseRoe/roeAudit semantics pins: unchanged (pure modules untouched).
- **Bench**: scripts/roe-adjudication-bench.mjs imports the built `dist/` engines directly (line 41-42 comment: "the real pipeline, never a vendored copy"); bench/roe-adjudication/report.json stays byte-identical because server state is invisible to it.
- **Docs**: docs/API_REFERENCE.md:269 (white roe row — shape + "no server state carries ROE text today" wording), grokbot/skills/white-arbiter/SKILL.md + white-auditor/SKILL.md (honest no-ROE caveats), src/mcp-server.ts:240-246 (`tempest_roe` description promises "the verdict on record for an action" — becomes true; description may need a sync pass).

### Incidental
- Stray artifact file in repo root: `./Heads-up: while wiring GET ` (note trailing space; references parseRoe wiring). Delete during this phase.

---

## 2. UNIFY-01 — residualRisk prose vs riskTier

### The divergence (observed in src/teams/purple.ts)
Both fields are produced per coverageMatrix row by one function (purple.ts:125-138):
- `riskTier: PurpleRiskTier` (`'critical'|'high'|'medium'|'low'|'info'`, purple.ts:36-38) = deterministic f(severity, detection, verdict): severity base index → +1 bump when detection `'none'` → floor at `high` for `'violation'` verdicts (constants purple.ts:60-78, documented table).
- `residualRisk: string` prose whose leading word comes from a **different** table: `riskWord(severity)` via `RISK_BY_SEVERITY` (purple.ts:40-50: critical→"severe", medium→"moderate", info→"informational") — severity-only, ignores the detection bump and violation floor.

Concrete divergence: medium finding + detection `none` → `riskTier: 'high'` but prose "moderate residual risk — no detection covers…". Violation case: tier floored at `high` while prose says "low residual risk … pending ROE remediation" (purple.ts:132-133). Two vocabularies, two signals.

### Complete consumer enumeration (grep across src/, docs/, grokbot/, mcp)
| Consumer | File:line | Uses | Change |
|---|---|---|---|
| Producer | src/teams/purple.ts:125-138 | both | Modify: derive prose from riskTier |
| API route | src/server.ts:6398-6464 (`POST /api/teams/purple/synthesize`) | passes rows through, persists whole synthesis | None (shape-agnostic) — comment update only |
| Operators UI | docs/operators.html:262-266 | `row.residualRisk` only (tier not rendered) | Modify: render tier cell/badge |
| Defend UI | docs/defend.html | **no synthesis rows** (four panels: blue gaps, black noise, white evidence, report audit) | None |
| API reference | docs/API_REFERENCE.md:285-286 | documents `residualRisk`; `riskTier` absent | Modify: document tier, mark prose derived |
| Grok skill | grokbot/skills/dark-purple/SKILL.md:104-111 | relays `residualRisk` per row | Modify: relay tier too |
| MCP proxy | src/mcp-server.ts:217-218, 432-434 (`tempest_purple_synthesize`) | proxies route verbatim, no field coupling | None |
| Test pins (prose) | src/__tests__/teams-modules.test.ts:252-255 | pins "no detection" / "low residual risk" strings | Modify with new derivation |
| Test pins (tier) | src/__tests__/purple-v2.test.ts:138-151 | 16-row tier table + severity-fallback cases | Unchanged expectations if tier math untouched |

### Direction of truth
`riskTier` is the computed superset (all three inputs) and its vocabulary matches finding severity by design ("same vocabulary as finding severity, not free prose", purple.ts:36). **riskTier = source of truth; residualRisk = derived rendering.** [INFERENCE] Under the milestone constraint "existing `/api/*` routes keep their contracts", keep both fields but derive prose from `riskTier` via a single tier→template map (one pure function in purple.ts), so divergence is structurally impossible. Dropping prose outright breaks the documented contract and UI — rejected. Update both test files in the same commit so the pins describe one signal twice.

### Name-collision warning
`riskTier` also names the **arsenal approval-gate** field (`CustomTool.riskTier: RiskTier` — 'dangerous'/'credential'/…, types/index.ts:451; gate at src/arsenal/index.ts:400-407 via `isGatedRisk`, src/arsenal/approval.ts:44-48; opt-in stamping `stampSpicyBuiltin`, src/index.ts:394/585). Disjoint type and domain — UNIFY-01 touches **only** `PurpleRiskTier`. Call this out in the phase plan to prevent a conflation bug.

---

## 3. VAL-01 — retroactive VALIDATION.md for phases 15-20

### Where the files go (GSD convention, verified from gsd-validate-phase workflow)
Phase dirs: **`.planning/milestones/v1.3-phases/{15-blue-suite-core, 16-blue-playbook-bench, 17-black-suite-core, 18-black-playbook-bench, 19-white-suite, 20-purple-v2-defend-ui}/`** (each holds `{N}-01-PLAN.md`, `{N}-01-SUMMARY.md`, `{N}-CONTEXT.md`). The workflow writes `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md` → new files **`15-VALIDATION.md` … `20-VALIDATION.md`** in those six dirs. Template exists at `$HOME/.agents/gsd-core/templates/VALIDATION.md` (frontmatter `status: validated`; sections: Test Infrastructure, Per-Task Map, Manual-Only, Sign-Off); gap-filling subagent `gsd-nyquist-auditor`; audit trail appended via `gsd-tools verification.append-audit`. Note the sibling dir `.planning/milestones/archived-20261012-phases/` is an archive marker, not the parent.

### What evidence links back to the gate tables
- **Gate tables live in the phase SUMMARYs** — e.g. 20-purple-v2-defend-ui/20-01-SUMMARY.md "## Verification (full gates, repo root)": lint 0 errors/177 warnings, `tsc --noEmit` clean, 1103 tests/100 files, doctor, prompt:audit 39/39, plus unit-level bench counts (purple-v2 11 tests). Phases 15-19 SUMMARies carry the same gate-run table shape.
- **.planning/v1.3-MILESTONE-AUDIT.md** — per-phase criteria-evidence table (commits `f654ea1`→`4c37232`) and the `nyquist.not_validated_phases: ["15"…"20"]` block that VAL-01 empties.
- **Pinning suites** the Per-Task Map should cite: src/__tests__/{blue,black,white}-suite.test.ts, {blue,black,white}-routes-static.test.ts, {detection-coverage,opsec-review,roe-adjudication}-bench.test.ts, purple-v2.test.ts, tauri-scaffold-static.test.ts.
- **Deterministic bench reports**: bench/{detection-coverage,opsec-review,roe-adjudication}/{report.json, corpus.json, manifest.yaml}.
- Test infrastructure: vitest at repo root (vitest.config.ts). Timing: run VAL-01 **before code phases** so evidence is frozen against v1.3 HEAD, not a moving tree; note VAL-added tests move the lint/test counts (feeds LINT-01 ordering below).

---

## 4. OPS-01 — docker healthcheck in a real container

### The bug OPS-01 will trip over (verified, not hypothetical)
- Dockerfile HEALTHCHECK (Dockerfile:37-39): `wget --spider http://localhost:3333/api/health` — **no auth header**.
- `createRemoteGuard` exempts nothing under `/api/*` (src/net/remote-access.ts:88-91); its comment ("/`/ui`, and `/health` stay open", remote-access.ts:86) refers to the **root** `/health`, and the route serves both paths (server.ts:4968: `app.get(['/health', '/api/health'], …)`).
- Docker sets `DOCKER=true` → 0.0.0.0 bind → non-loopback → startup refuses without `T3MP3ST_BEARER_TOKEN` (server.ts:8424-8433), and with a token `/api/health` 401s without the header.
- Net: the Dockerfile healthcheck **cannot go healthy** in the only sanctioned Docker mode. docker-compose.yml:17-22 already does it right: `wget --spider --header="Authorization: Bearer $$T3MP3ST_BEARER_TOKEN" http://127.0.0.1:3333/api/health` (`$$` = runtime env escape; requires the token in container env via `env_file: .env`).

[INFERENCE] Fix choice for the phase: point the **Dockerfile** HEALTHCHECK at the deliberately-unguarded `/health` (the shell-load path), or replicate compose's tokenized form; align docker-compose.yml and the curl examples in docs/DOCKER.md:22 (host curl to the published 127.0.0.1:3333 port also needs the bearer header). Evidence = real run: `docker build` → `docker run -e T3MP3ST_BEARER_TOKEN=…` → `docker inspect --format '{{.State.Health.Status}}'` reaching `healthy`; record transcript in the phase SUMMARY.

### Tauri touch points
None for OPS-01 — the sidecar (src-tauri) has no container healthcheck.

## 5. OPS-02 — installer matrix on this host

Touch points (all verified):
- **package.json:120-122** — `sidecar:build` (node scripts/build-sidecar.mjs, config scripts/sidecar.pkg.json → `binaries/t3mp3st-server`) and `tauri:build` = `npm run build && npm run sidecar:build && tauri build`.
- **src-tauri/tauri.conf.json** `bundle` block: `targets: ["deb","appimage","msi","nsis","app","dmg"]`, `externalBin: ["binaries/t3mp3st-server"]`, resources `../docs/` → `docs/`.
- **.github/workflows/tauri-build.yml** — the CI matrix being reproduced on-host; Linux job installs webkit/ayatari deps (lines 53-55) — the same host prerequisites needed here.
- Host scoping [INFERENCE]: linux host → `deb` + `appimage` buildable and observable; `msi`/`nsis` (Windows) and `app`/`dmg` (macOS) are cross-targets that stay CI-only — record the honest matrix rather than forcing cross-builds. Mobile `gen/` remains blocked on JDK/Android-SDK (v1.2 known debt, out of scope). docs/RELEASE_CHECKLIST.md has no matrix section — evidence lands in the phase SUMMARY. No code changes required; this is an execution+evidence phase that needs a green `npm run build` first.

---

## 6. LINT-01 — warning baseline ≤176

- **Config**: `eslint.config.js` (flat config, repo root). Warning-producing rules: `@typescript-eslint/no-unused-vars`, `no-explicit-any`, `no-non-null-assertion`, `curly` (multi-line). Ignores dist/node_modules/*.js/*.mjs.
- **Measurement**: `npm run lint` = `eslint src/**/*.ts` (package.json) — the count is the eslint summary line "N problems (0 errors, N warnings)". No dedicated counter script; `test:pr` and `test:release` gates both run it.
- **Baseline record**: 20-purple-v2-defend-ui/20-01-SUMMARY.md gate table — "177 warnings (176 pre-existing baseline + 1 net-new)". Target: fix the one net-new warning in phase-20 code; zero new warnings elsewhere; no rule weakening (0-error gate intact).
- Ordering constraint: VAL-01 may add tests → they can add warnings → measure/restore the baseline **after** VAL-01 and after the code phases, then hold it through milestone close.

---

## 7. Suggested build order (dependencies)

```
Phase 1  VAL-01        retroactive VALIDATION.md for 15-20 (+nyquist gap tests)
                       ├─ evidence frozen against v1.3 HEAD — run FIRST
                       └─ moves lint/test counts → feeds Phase 2 baseline
Phase 2  LINT-01       restore ≤176 baseline (now measured on the post-VAL tree)
Phase 3  ROE-01        server ROE store + mutation route + GET verdicts
                       ├─ touches: server.ts, white-routes-static pin, API_REFERENCE,
                       │           white skills, mcp-server description, DOCKER.md(no)
                       └─ independent of Phase 4 except shared docs files
Phase 4  UNIFY-01      purple prose ← riskTier derivation + all consumers
                       └─ after Phase 3: both edit docs/API_REFERENCE.md
                          (roe row vs purple section) — sequential avoids churn
Phase 5  OPS-01        Dockerfile/compose healthcheck + real container run
         OPS-02        host installer matrix (deb/appimage) — needs green build
                       └─ either order; OPS-02 last benefits from final code
Phase 6  close-out     full gates re-run (lint ≤176 re-assert, tests, benches),
                       STATE.md/ROADMAP.md transitions
```

Parallelization notes: OPS-01/OPS-02 have no code dependencies and can run as their own phase any time after Phase 2 (they produce evidence, not code). ROE-01 and UNIFY-01 are logically independent (different subsystems) but share docs/API_REFERENCE.md — run sequentially. VAL-01 strictly first; LINT-01 second.

---

## Key file inventory (new vs modified)

| Item | Modified | New |
|---|---|---|
| ROE-01 | src/server.ts (state block ~898-904, snapshot ~1181-1258, GET route 6564), src/__tests__/white-routes-static.test.ts, docs/API_REFERENCE.md, grokbot/skills/white-{arbiter,auditor}/SKILL.md, src/mcp-server.ts (description) | none (mutation route lives in server.ts) |
| UNIFY-01 | src/teams/purple.ts, src/__tests__/teams-modules.test.ts, docs/operators.html, docs/API_REFERENCE.md, grokbot/skills/dark-purple/SKILL.md | none |
| VAL-01 | .planning/v1.3-MILESTONE-AUDIT.md (nyquist block, via tooling) | 6× `.planning/milestones/v1.3-phases/{15..20}-*/{N}-VALIDATION.md`, nyquist gap tests under src/__tests__/ |
| OPS-01 | Dockerfile, docker-compose.yml, docs/DOCKER.md | evidence transcript in phase SUMMARY |
| OPS-02 | (none — execution) | build artifacts (binaries/, bundle output), evidence in phase SUMMARY |
| LINT-01 | the one net-new warning site in phase-20 code | none |
