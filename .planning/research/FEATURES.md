# FEATURES Research — v1.4 Hardening & Validation

**Question:** for each v1.3 audit debt item, what is table-stakes "done" vs differentiator?
**Method:** repo evidence only (planning artifacts + source + config), one external pattern check (OPA). Every claim about current behavior cites a repo file. Semantics choices are **flagged for the owner, not decided**.

Downstream: REQUIREMENTS.md categories (table stakes / differentiators / anti-features) with dependencies on existing code.

---

## 1. ROE-01 — ROE text as server state; verdicts-on-record

### Current state (cited)

- `GET /api/teams/white/roe` is parse-only: it parses the empty string and answers `summary: 'no ROE text on record'` — `src/server.ts:6564-6567`. The route comment records the deliberate decision: no `MissionDraft` field carries ROE text (only title/objective/scope/constraints are free-text) and "no second store is invented here" — `src/server.ts:6555-6563`.
- `MissionDraft` fields confirm it: `id/title/objective/scope: string[]/constraints/urgency/opsecPreference/mode/source/status/createdAt/updatedAt` — `src/server.ts:661-675`; drafts live in the in-memory `missionDrafts` Map — `src/server.ts:896`.
- The verdict engine is ready and pure: `RoeSpec = { allowedTargets?, allowActive? }` (`src/teams/white.ts:19-22`), `roeAudit(actions, roe)` precedence out-of-scope→violation, active∧¬allowActive→violation, active∧¬approved→needs_approval, else compliant (`src/teams/white.ts:35-70`), `RoeVerdict = { actionIndex, verdict, rationale, conditions }` (`src/teams/white.ts:24-30`).
- The parser is ready and honest: `parseRoe` folds every line into `resolved` or `unresolved` with a reason; `ok:false` means "hold the engagement, never adjudicate a partial spec" — `src/teams/white/roe-parser.ts:14-17, 54-63`.
- Pins deliberately fence the current honesty: the roe route must invent no `roeLedger`, must not `missionDrafts.set`, and must keep the literal `no ROE text on record` — `src/__tests__/white-routes-static.test.ts` ("the roe route invents no ROE store…"). **These pins are part of the change**: landing a text source means rewriting them into equally sharp pins for the new contract, not deleting them.
- Purple takes `RoeVerdict`s from the request body today (`src/server.ts:6558-6559`; join at `src/teams/purple.ts:117-121`), so recorded verdicts have an immediate consumer.
- Skills relay the honest cannot-derive state (white-arbiter, dark-purple SKILL.md caveat) — `.planning/milestones/v1.3-phases/19-white-suite/19-01-SUMMARY.md` (Wiring) and `20-01-SUMMARY.md` (Wiring sweep).
- The motivating bug class: `parseRoe` never assigned `roe.allowedTargets`, so v1 `roeAudit` saw an empty scope and ruled everything in-scope — caught by the roe bench, fixed, pinned (`19-01-SUMMARY.md`, "Engine bug caught by the bench"; `.planning/v1.3-MILESTONE-AUDIT.md` phase-19 debt item).

### Comparable pattern (external, for design framing)

OPA decision logs are the industry shape for "verdicts-on-record": every decision records a `decision_id`, the `input`, the `result`, and the **bundle revision** (which version of policy+data decided), so any decision can be replayed and audited — https://www.openpolicyagent.org/docs/management-decision-logs. The transportable idea is not Rego; it is **(policy text as versioned state) + (verdict bound to the exact revision that produced it) + (a durable record with an id)**.

### Table stakes (done =)

1. Operator ROE text is loadable into server state through an explicit API and survives restart wherever the rest of state does (the snapshot machinery: `persistState`/`schedulePersist`/`flushPersist`, `src/server.ts:1194-1234`; slots pattern proven by `purpleSyntheses` keyed `'latest'`, `src/server.ts:6454-6457`).
2. `GET /api/teams/white/roe` returns the parse of the on-record text (`resolved`/`unresolved`/`ok`/`summary`) and, **only when `ok:true`**, `roeAudit` verdicts over a defined action source. No text on record → the same honest zeroed parse as today.
3. `ok:false` never yields verdicts (parser doctrine, `roe-parser.ts:14-17`).
4. Each emitted verdict carries the full `RoeVerdict` shape and identifies the ROE revision/text it was derived from (at minimum: timestamp + text hash or revision id — the OPA lesson, local scale).
5. All honesty surfaces updated in lockstep: `white-routes-static.test.ts` + `white-suite.test.ts` pins, roe bench (`scripts/roe-adjudication-bench.mjs`) extended with at least one text→parse→verdict case, `docs/API_REFERENCE.md` row, white-arbiter/dark-purple SKILL.md relay rules, MCP `tempest_white_roe` behavior note.

### Differentiators

- Verdicts **persisted as a record** (a verdict ledger slot through `buildStateSnapshot`), not recomputed ephemerally on GET — replayable, auditable, consumable by purple without the client re-posting verdicts.
- ROE revision history (amendments kept; route can parse a named revision), mirroring how engagement ROEs actually change mid-operation.
- Purple `synthesize` auto-consumes recorded verdicts for known findings instead of requiring `verdictsByFinding` in the request body.
- Provenance on the text itself: who loaded it, when, source (paste vs file).

### Anti-features

- Guessed extraction: inferring ROE text from `objective`/`constraints` free-text would violate the parser's never-guess doctrine and re-create the silently-permissive bug class the bench pins against.
- Verdicts derived while `ok:false`, or from an empty action list presented as "all compliant".
- Mutation from the GET route (existing pin), or overwriting ROE text with no revision record.

### Dependencies on existing files

`src/teams/white.ts` (pure engines — unchanged or additive), `src/teams/white/roe-parser.ts` (unchanged), `src/server.ts` (route + store + snapshot slot), `src/__tests__/white-routes-static.test.ts`, `src/__tests__/white-suite.test.ts`, `scripts/roe-adjudication-bench.mjs` + `bench/roe-adjudication/` corpus, `docs/API_REFERENCE.md`, `grokbot/skills/white-arbiter/SKILL.md`, `grokbot/skills/dark-purple/SKILL.md`, gateway pin count if MCP surface changes (`src/__tests__/grokbot-gateway.test.ts`), `src/teams/purple.ts` if auto-consumption lands.

### ⚑ Owner semantics choices (flagged, not decided)

- **Where the text lives:** a `MissionDraft` field vs an engagement-level "active ROE" store vs a keyed ROE ledger. The v1.3 route comment explicitly declined a second store — reversing that is a decision to own.
- **Transport:** extend `POST /api/mission-drafts` (`src/server.ts:5931`) vs a new POST route vs file-based load. Current pins forbid `app.post('/api/teams/white/roe')` — the pin text is part of whichever choice.
- **Single active ROE vs versioned history**; verdicts computed on-read vs recorded-at-write (OPA-style record).
- **Action source for `roeAudit`**: the engine consumes `AuditedAction[]` — mission plan steps, request-supplied actions, or ledger entries; the route must name its source honestly.
- Whether purple auto-switches to recorded verdicts now or stays request-body-fed this milestone.

---

## 2. VAL-01 — retroactive validation evidence for phases 15–20

### Current state (cited)

- None of the six phase dirs (`.planning/milestones/v1.3-phases/{15..20}-*/`) contains a VALIDATION.md — they hold CONTEXT/PLAN/SUMMARY only (directory listing). Audit Nyquist block: `not_validated_phases: ["15".."20"]`, `overall: not_validated` — `.planning/v1.3-MILESTONE-AUDIT.md` (frontmatter + Nyquist section).
- Existing evidence is real but unmapped: per-phase gate tables in SUMMARYs (e.g. `20-01-SUMMARY.md` Verification: lint 0 errors/177 warnings, tsc clean, 1103 tests, doctor), three deterministic benches that import the real `dist/` pipeline and are CI-pinned (audit Integration section; `19-01-SUMMARY.md`), and behavior pins (`src/__tests__/white-routes-static.test.ts`, `purple-v2.test.ts`, `teams-modules.test.ts`, `roe-adjudication-bench.test.ts`, …).
- The GSD contract this item names: validate-phase detects **State B** (no VALIDATION.md + SUMMARY exists → "reconstruct from artifacts"), classifies each requirement COVERED/PARTIAL/MISSING against existing tests, spawns gsd-nyquist-auditor to fill gaps, then writes `NN-VALIDATION.md` from the template (frontmatter `status: draft → validated`, `nyquist_compliant`, Test Infrastructure, Per-Task Verification Map, Manual-Only, Sign-Off, appended `## Validation Audit`) and commits generated tests separately — `~/.agents/gsd-core/workflows/validate-phase.md`, `~/.agents/gsd-core/templates/VALIDATION.md`. Milestone audit distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + `nyquist_compliant: false`) — template comment + `gsd-audit-milestone` reference in the workflow.
- The bug class validate-phase exists for is already on record: the `roe.allowedTargets` assignment bug was caught by a pinned bench, not by a validation pass (`19-01-SUMMARY.md`; audit phase-19 debt item).

### What credible retroactive evidence contains (table stakes)

1. **One `NN-VALIDATION.md` per phase dir 15–20**, template-shaped: frontmatter `status: validated` + honest `nyquist_compliant`; **Per-Task Verification Map tying each PLAN task/requirement to an automated command that exists and was actually run green during the pass**; Manual-Only table for what cannot be automated; a `## Validation Audit` row with found/resolved/escalated counts.
2. **Retroactive honesty:** the file dates the pass and states it is a State-B reconstruction from artifacts; it does not fabricate wave-0 history or claim the tests ran during execution.
3. **No invented coverage:** every "automated" row points at a real test file/command in this repo (the pins and benches are the inventory); anything else is Manual-Only with instructions — e.g. if a requirement has no test, it is escalated, not papered over.
4. Generated gap-filling tests committed separately from the VALIDATION.md docs commit (workflow step 7).
5. Aftermath: a milestone re-audit flips the Nyquist block from `not_validated` to compliant/partial per phase.

### Differentiators

- The phase-19 VALIDATION.md records the `allowedTargets` incident as justification for what the pins sample — turning the audit's narrative into mapped evidence.
- Gap analysis that actually fills MISSING cells with new tests (nyquist-auditor) instead of defaulting everything to Manual-Only.
- The audit's Integration claims (purple consumes blue DetectionGaps + white RoeVerdict shapes; benches import `dist/`) mapped as explicit cross-phase requirements rather than prose.

### Anti-features

- VALIDATION.md that restates SUMMARY gate tables without a requirement→test map (that is precisely the gap the audit logged: "validate-phase was never run").
- Marking manual-only what already has a pinned test, or claiming automation that wasn't run.
- Editing phase PLAN/SUMMARY artifacts to look validated retroactively.

### Dependencies on existing files

Phase artifacts (CONTEXT/PLAN/SUMMARY × 6), the test inventory above, `vitest.config.ts` / `vitest.pr.config.ts`, gsd-core workflow + template + `gsd-nyquist-auditor` agent + `gsd-tools verification.append-audit`, and `.planning/v1.3-MILESTONE-AUDIT.md` (the Nyquist block being promoted).

### ⚑ Owner semantics choices

- **Sequencing vs ROE-01/UNIFY-01:** both items modify phase-15-20 surfaces (`src/teams/purple.ts`, white routes). Validate against the v1.3 commits (pin commit shas in the VALIDATION.md) and accept post-change drift, or run the retro pass after v1.4 changes land so the map matches HEAD. Either is defensible; picking silently is not.
- Whether "Nyquist promotion" requires zero Manual-Only rows (`nyquist_compliant: true`) or PARTIAL is an acceptable terminal state for retroactive phases.
- Whether v1.4's own new phases also get VALIDATION.md (the audit debt says "no phase VERIFICATION files" generally) or VAL-01 is strictly the six v1.3 phases as PROJECT.md scopes it.

---

## 3. UNIFY-01 — residualRisk prose vs riskTier

### Current state (cited)

- `DarkPurpleSynthesis.coverageMatrix` rows carry **both**: deterministic `riskTier: PurpleRiskTier` (`src/teams/purple.ts:30-44`) and prose `residualRisk: string`. The tier is computed first (`residualRiskTier`, constants + documented table at `purple.ts:59-92`), then the prose is composed around the same inputs (`purple.ts:124-138`).
- **The two signals already contradict each other in one branch:** `verdict === 'violation'` with full coverage → prose says "low residual risk — … pending ROE remediation" (`purple.ts:132-133`) while the tier floors at `high` (`RISK_TIER_VIOLATION_FLOOR = 3`, `purple.ts:78`; pinned in `src/__tests__/purple-v2.test.ts`). The violation floor's own comment says "a ROE violation never carries low residual risk" — the prose says exactly that.
- The prose vocabulary (`severe/moderate/informational` via `RISK_BY_SEVERITY`, `purple.ts:47-56`) is not the tier vocabulary (`critical/high/medium/low/info`, `purple.ts:30`) — two scales for the same concept in one row.
- Consumers of the prose: `docs/operators.html:265-266` (renders `row.residualRisk`, blank-safe `|| ''`), `docs/API_REFERENCE.md:285-287` (documents `residualRisk`, **not** `riskTier` — already drifted), `grokbot/skills/dark-purple/SKILL.md:108-110` (lists `residualRisk` only, "exactly as returned"), `src/__tests__/teams-modules.test.ts:251-257` (pins prose substrings `'no detection'`, `'low residual risk'`).
- Consumers of the tier: `src/__tests__/purple-v2.test.ts:133-151` (pins the full deterministic table: severity base, none-detection bump, default medium, violation floor). `docs/defend.html` renders neither (it shows the four color-audit panels — no `coverageMatrix` reference in the file).
- Naming collision: `RiskTier` already exists as the **tool-execution gating** vocabulary `'local_read'|'passive'|'active'|'intrusive'|'credential'|'dangerous'` (`src/types/index.ts:420`; drives the approval gate `src/arsenal/index.ts:400-407`, `src/arsenal/approval.ts:44-47`). Two different five/six-value scales share the word "riskTier" across API payloads.

### Is one derived signal the right end-state?

Computationally the unification already happened in v1.3: both fields derive from the same inputs, tier first. What remains is **presentation authority** — the prose is a second, hand-maintained encoding of the tier's inputs that has already drifted (contradiction + vocabulary). So yes: one authority is the right end-state, and the realistic shapes are (a) tier is the signal, prose becomes a deterministic template **of** the tier, or (b) tier is the signal, prose is dropped. Pure "prose as the signal" would discard the deterministic property the audit explicitly credits.

### What breaks if prose disappears

- `operators.html` purple table renders an empty column (no crash — `|| ''` guard), so UI work must land with the change.
- `teams-modules.test.ts:253-255` prose pins fail → rewrite as tier pins (or template-pins under option (a)).
- `API_REFERENCE.md` and dark-purple `SKILL.md` go stale unless updated (they are already stale re: `riskTier` — fixing them is in scope either way).
- LLM/skill consumers instructed to relay fields "exactly as returned" lose a human-readable phrase; under option (a) they keep one.
- Response-shape change: PROJECT.md Constraints say existing `/api/*` routes keep their contracts — dropping a response field is a contract change that needs explicit sanction either way.

### Table stakes

Exactly **one authority** for residual risk per row; the other field gone or provably derived by a single writer; the violation-branch contradiction impossible; every consumer above updated in the same change; derivation table documented (it already is, `purple.ts:59-78` — keep it true).

### Differentiators

- Prose regenerated from the tier via one pure `proseForTier(tier, finding)` template with its own parity table test (mirrors `purple-v2.test.ts` style) — human readability without a second brain.
- Disambiguation of the `riskTier` naming collision (e.g. rename the purple field or document the two vocabularies side by side in API_REFERENCE) — owner call.

### Anti-features

- Keeping two independently maintained prose branches "until later" (the exact debt being closed).
- Weakening `purple-v2.test.ts` tier pins or `teams-modules.test.ts` prose pins to vacuity to make the migration pass.
- Silent field removal from the API response without the contract sanction + doc/changelog update.

### Dependencies on existing files

`src/teams/purple.ts` (single writer), `src/__tests__/purple-v2.test.ts`, `src/__tests__/teams-modules.test.ts`, `docs/operators.html`, `docs/API_REFERENCE.md`, `grokbot/skills/dark-purple/SKILL.md`, `docs/defend.html` (only if the posture surface gains the tier display — optional), server synthesize route (`src/server.ts:6396-6457`, shape pass-through).

### ⚑ Owner semantics choices

- **(a) derive prose from tier vs (b) drop prose.** (a) preserves the rendered human phrase everywhere; (b) is simpler but touches more surfaces. Not decidable from the repo alone.
- If (a): does the template stay keyed on inputs (today's branches) or strictly on the tier (guarantees agreement by construction)?
- The `PurpleRiskTier` vs `RiskTier` (tool gating) name collision: rename, prefix, or document. Affects API field naming → contract decision.
- Prose vocabulary: adopt the tier words (`high residual risk`) or keep `severe/moderate/informational` — today the prose words are a third scale.

---

## 4. OPS-01 — docker healthcheck verified in a real container

### Current state (cited)

- `Dockerfile:38-40`: `HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3333/api/health || exit 1`. The image sets `DOCKER=true` (`Dockerfile:33`) → server binds `0.0.0.0` (`src/server.ts:188`).
- `docker-compose.yml:17-20`: a **different** healthcheck — CMD-SHELL wget with `Authorization: Bearer $$T3MP3ST_BEARER_TOKEN` (added in v1.2 Phase 13: `13-01-SUMMARY.md` "Docker healthcheck sends the bearer"). The two probes diverge.
- The guard covers **every** `/api/*` path with no health exemption: only non-`/api` paths skip; wrong *and missing* bearer → 401 (`src/net/remote-access.ts:86-114`). Both `/health` and `/api/health` are registered (`src/server.ts:4968`), but only the bare `/health` sits outside the guard.
- Fail-closed rule: non-loopback binds (Docker included) refuse to start without `T3MP3ST_BEARER_TOKEN[_FILE]` (PROJECT.md Validated: v1.2 Phase 13) — so a running container **always** has a token.
- Debt record: "Docker healthcheck was edited, not executed (no docker run this session)" — `.planning/v1.2-MILESTONE-AUDIT.md`; carried into v1.3 audit ("edited but unrun in a real container").
- **Inference to verify in-container [INFERENCE from code]:** with a token enforced, the Dockerfile probe (no auth header) hits `/api/health` → 401 → wget spider nonzero → container permanently `unhealthy`; the compose probe passes only when the token arrived as env (`$$T3MP3ST_BEARER_TOKEN` expands empty under `T3MP3ST_BEARER_TOKEN_FILE`). This contradiction is precisely what a real run will confirm or refute — do not pre-fix it in docs as fact.

### What an honest "verified on host" record contains (table stakes)

1. Real `docker build` on this host (record base-image digest — it is pinned, `Dockerfile:3`) and a real `docker run` **with `T3MP3ST_BEARER_TOKEN` set** (the fail-closed rule makes tokenless runs impossible anyway).
2. Observed health **transition**: `docker inspect --format '{{.State.Health.Status}}'` going `starting → healthy` within the start period, plus at least one `docker inspect .State.Health` log entry (exit code + output) pasted into the record.
3. The **failure path observed too**: kill the server process inside the container (or otherwise make the probe fail) and watch retries exhaust into `unhealthy`. A probe only ever seen healthy is also consistent with a probe that can never fail — the failure run is what proves the check has teeth.
4. The Dockerfile probe vs compose probe divergence **resolved or explicitly recorded** as a finding (which probe is canonical; whether `/api/health` should be guard-exempt like bare `/health` is an owner call — see flags).
5. The whole record (commands, outputs, image id, host docker version, deviations) lands in the phase planning artifacts. If code changes fall out, the static pins that watch these files (`src/__tests__/remote-access-guard.test.ts`, `local-api-hardening-static.test.ts`) evolve with them.

### Differentiators

- Both variants exercised: Dockerfile probe and compose probe (env token **and** `_FILE` token, exposing the `$$` expansion caveat).
- `docker events`/`docker ps` capture of the unhealthy episode.
- Documenting the busybox-wget-on-alpine nuance (wget is busybox-built-in; curl is also installed, `Dockerfile:7`).

### Anti-features

- Counting a successful `docker build` (or `npm run server` smoke) as healthcheck verification.
- Making the probe pass by running loopback-only inside the container or weakening the bearer guard — both mask the real interaction the check exists to exercise.
- Editing the healthcheck to target an endpoint that always 200s regardless of server health.

### Dependencies on existing files

`Dockerfile`, `docker-compose.yml`, `src/net/remote-access.ts` (guard semantics), `src/server.ts:188,4968` (bind + health routes), `src/__tests__/remote-access-guard.test.ts` / `local-api-hardening-static.test.ts` pins, PROJECT.md v1.2 Phase 13 fail-closed rule.

### ⚑ Owner semantics choices

- Probe target: keep `/api/health` + attach the bearer (compose-style) vs exempt health probes from the guard vs point the Dockerfile probe at unguarded `/health`. Security-relevant — exempting `/api/health` widens the unauthenticated surface the v1.2 guard deliberately closed.
- Canonical definition: one healthcheck (Dockerfile) with compose inheriting, or the reverse.
- Whether a failing-probe finding (if confirmed) is fixed in this milestone or recorded as verified-behavior.

---

## 5. OPS-02 — installer matrix built on this host

### Current state (cited)

- CI matrix: linux → `--bundles deb,appimage`; windows → `msi,nsis`; macos → `app,dmg` (`.github/workflows/tauri-build.yml:30-43`); mobile init checks are manual-only jobs (81-103).
- Local bundle config targets all six at once (`src-tauri/tauri.conf.json:28-37`: `targets: ["deb","appimage","msi","nsis","app","dmg"]`, `externalBin: ["binaries/t3mp3st-server"]`, docs resources).
- Sidecar prerequisite: `npm run sidecar:build` (`package.json:120`, `scripts/build-sidecar.mjs`); prebuilt linux-x64 sidecars exist (`src-tauri/binaries/t3mp3st-server-linux-x64` + target-triple suffixed).
- Debt record: "A full `tauri build` installer was not produced on this host. CI is the first place the deb/appimage/msi/dmg matrix runs" (`12-01-SUMMARY.md`); v1.2 audit: "installer matrix … CI-only and has not been observed here"; carried into v1.3 audit.

### What an honest "verified on host" record contains (table stakes)

1. On this linux-x64 host: `npm run sidecar:build` → `npx tauri build` producing the **host-buildable** bundles (deb, appimage), with each artifact recorded — path, byte size, sha256 — plus tool versions (tauri CLI, rustc/cargo, node) and wall time.
2. An explicit statement of which matrix cells **cannot** be observed on this host (msi/nsis need Windows; app/dmg need macOS) with CI named as their evidence venue — honest scoping in the record, not silent shrinkage. Whether the milestone accepts "host-buildable subset + CI pointer" vs demands cross-compilation attempts is an owner call (flagged below).
3. Any config the first real run forces (externalBin target-triple naming and bundle quirks are the classic first-run failures; both naming variants already sit in `src-tauri/binaries/`) is fixed with `tauri-scaffold-static.test.ts` pins kept true.
4. The record (commands + outputs + checksums) lands in the phase planning artifacts.

### Differentiators

- Smoke beyond "it built": install the produced `.deb` into a throwaway container/chroot and launch the binary (or `ar`/`tar`-list the deb to verify the sidecar `externalBin` and `docs/` resources actually shipped inside the artifact); execute the AppImage once.
- Reproducing one CI matrix cell locally to diff behavior (e.g. the linux job's exact args from `tauri-build.yml`).

### Anti-features

- Counting the CI workflow file's existence as host verification (the exact debt being closed).
- Claiming the six-target matrix from a linux host.
- Artifacts without checksums/sizes ("it produced something").

### Dependencies on existing files

`src-tauri/tauri.conf.json` (bundle targets, externalBin, resources), `scripts/build-sidecar.mjs` + `package.json:120`, `src-tauri/binaries/*`, `.github/workflows/tauri-build.yml`, `src/__tests__/tauri-scaffold-static.test.ts`, v1.2 Phase 12 sidecar contract (`std::process::Command` spawn — PROJECT.md Key Decisions).

### ⚑ Owner semantics choices

- Scope of "matrix built on this host": host-buildable subset (deb/appimage) + CI for the rest, vs attempting cross-compilation/toolchain setup for msi/nsis/dmg. Affects effort and honesty wording.
- Whether an installed-and-launched smoke is required or build-with-artifacts suffices for "done".

---

## 6. LINT-01 — warning baseline 177 → ≤176

### Current state (cited)

- `npm run lint` = `eslint src/**/*.ts` (`package.json:88`). Flat config (`eslint.config.js`): warn-level rules are `@typescript-eslint/no-unused-vars`, `no-explicit-any`, `no-non-null-assertion`, `curly` (multi-line); `prefer-const`/`no-var`/`eqeqeq` are errors; ignores `dist/`, `node_modules/`, `*.js`, `*.mjs` (so `scripts/*.mjs` are outside the count).
- Gate convention: exit 0 with **0 errors**, warnings tolerated but counted in gate tables: 176 pre-existing at v1.2 close (`14-01-SUMMARY.md` gate table), drifted to 177 in v1.3 ("176 pre-existing baseline + 1 net-new", `20-01-SUMMARY.md`; `.planning/v1.3-MILESTONE-AUDIT.md` phase-20 debt item, "one net-new warning in new code").
- There is **no mechanical baseline** in the repo (no baseline manifest or count-pinning test) — the number is enforced socially via gate tables; that is how it drifted.

### Table stakes

1. Run lint on the working tree; identify the net-new warning (audit attributes it to phase-20 new code — a lint run diffed against the 176 baseline locates it; only `src/**/*.ts` can be the source).
2. Eliminate it by fixing the code, or by a **narrow, reasoned suppression** (rule-specific inline disable with a comment stating why) — never a config loosening.
3. Gate table records the number: `0 errors, ≤176 warnings`, with zero new warnings introduced by v1.4 work itself.
4. No weakening of `eslint.config.js` rules to move the count (that trades an honest number for a blind one).

### Differentiators

- A mechanical pin so drift cannot recur silently: a doctor check or CI step asserting the warning count ≤ baseline (scripts/doctor.mjs is the natural home; per-rule breakdown recorded so the *class* of the new warning is visible, not just the total).
- Fixing a handful of the pre-existing `no-explicit-any` warnings in touched files (drive-by, only where v1.4 already edits).

### Anti-features

- Deleting or `any`-ing code solely to drop the count without a correctness rationale.
- File-level `eslint-disable` blankets.
- Changing `warn` → `off` in config (hides the class; the gate table number becomes fiction).

### Dependencies on existing files

`eslint.config.js`, `package.json:88` (lint script), `scripts/doctor.mjs` (if the mechanical pin lands there), the phase-20 source files (`src/teams/purple.ts`, `src/server.ts` purple additions are the plausible candidates — identification is a lint-run job for the executor, not a docs claim).

### ⚑ Owner semantics choices

- Is ≤176 a **hard gate** (mechanically enforced, fails CI/doctor) or a **reported number** (gate-table convention only)?
- Total-count baseline vs per-rule baseline (per-rule catches substitution, e.g. fixing `any` by adding a non-null assertion).
- Whether the one net-new warning is fixed or suppressed-with-reason (both acceptable; the reason must be recorded either way).

---

## Cross-cutting notes for REQUIREMENTS.md

- **Sequencing interplay (owner flag):** ROE-01 and UNIFY-01 both change surfaces that VAL-01's retroactive maps would reference (white routes; `src/teams/purple.ts`). VAL-01 either pins the v1.3 commits it validated or runs after the code items land — the three items should be scheduled with that decision made, not discovered.
- **Contract stability governs both API items:** PROJECT.md Constraints ("existing `/api/*` routes keep their contracts") means ROE text loading and any `residualRisk` field removal are sanctioned contract changes requiring doc + changelog updates, not additive-only refactors.
- **Honesty doctrine is the shared anti-feature test:** every item has a "fabricate the evidence" failure mode (verdicts without text, validation without mapping, healthy without a failure run, matrix from CI, count without a fix). The repo's Core Value ("power without provenance is failure", PROJECT.md) makes these anti-features, not shortcuts.
- **Pins are load-bearing everywhere:** `white-routes-static.test.ts` (ROE-01), `purple-v2.test.ts`/`teams-modules.test.ts` (UNIFY-01), `remote-access-guard.test.ts`/`tauri-scaffold-static.test.ts` (OPS-01/02) — each item's definition of done includes evolving its pins to be equally sharp, never deleting them.
- **No new runtime deps** (PROJECT.md Constraints): ROE-01 needs none (pure engines exist); OPS-01/02 use host docker/tauri toolchain; LINT-01 needs none.
