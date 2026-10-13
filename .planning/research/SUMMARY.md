# Project Research Summary

**Project:** T3MP3ST v1.4 — "Hardening & Validation" (`swcstudiospace/purple-team`)
**Domain:** local-first purple-team security tooling (deterministic engines, honesty-first API contracts)
**Researched:** 2026-10-12
**Confidence:** HIGH — every claim across the four research docs cites a repo file/line or a host-verified probe; owner decisions for all previously-flagged semantics are resolved and carried below as decided direction.

## Executive Summary

v1.4 closes the six v1.3 audit debt items — retroactive validation (VAL-01), ROE text as server state (ROE-01), residualRisk/riskTier unification (UNIFY-01), first real docker + installer verification (OPS-01/02), and the lint baseline 177 → ≤176 (LINT-01). This is an evidence-quality milestone: no new capabilities, no new runtime dependencies (PROJECT.md constraint), no new test tooling. Everything needed already exists in the repo — pure engines (`parseRoe`, `roeAudit`, `residualRiskTier`), the snapshot/persist machinery, deterministic benches that import the real `dist/` pipeline, and a fully wired docker/compose/tauri chain.

The recommended approach is sequence-by-dependency, not sequence-by-preference: VAL-01 runs FIRST against the frozen v1.3 boundary with a supersession log; ROE-01 then UNIFY-01 (both edit `docs/API_REFERENCE.md`); OPS-01+OPS-02 produce ops evidence independent of code phases; LINT-01 closes the milestone because VAL-added tests move the lint count and only a final re-measure is meaningful. Owner decisions already taken: UNIFY-01 keeps the API contract (prose becomes a derived rendering of `riskTier` — option a; dropping prose rejected); OPS-01 repoints the Dockerfile HEALTHCHECK to the deliberately-open `/health` handler with no new guard exemption; ROE-01 treats ROE text as untrusted data with deterministic scope parsing and fail-closed behavior; OPS-02 records per-target sha256 receipts where cross-compiled targets never count as host-observed.

The key risk is the milestone's own unifying failure mode, seen once already in v1.3 (`roe.allowedTargets` silently empty → everything in scope): **silent permissiveness / evidence theater**. Every phase has a "fabricate the green" failure mode — verdicts without text, validation without a requirement→test map, a probe only ever seen healthy, a matrix claimed from CI, a count lowered by suppression instead of a fix. Mitigation is structural: pins evolve same-commit and never weaken, every missing-signal path fails closed, ops evidence is receipt-grade (container IDs, checksums, measured counts), and the milestone closes on a measured lint number, not a remembered one.

## Key Findings

Detailed docs: [STACK.md](./STACK.md) · [FEATURES.md](./FEATURES.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [PITFALLS.md](./PITFALLS.md)

### Recommended Stack

Nothing to add — the milestone runs entirely on the existing, host-verified toolchain (STACK.md §1, probed 2026-10-12): node v24.18.0 (engines ≥22.19, CI pins 22; pkg sidecar bundles its own node22), npm 11, docker 29.6.2 + compose v5.3.1 (daemon up), rustc/cargo 1.98.1 stable (Tauri 2, no MSRV), @tauri-apps/cli 2.12.1, eslint 9.39.2 flat config, typescript 5.9.3, vitest 4.1.9 + `@vitest/coverage-v8`, @yao-pkg/pkg 6.23.0 (node22 base, sha-verified with v3.5 fallback).

**Core technologies (all existing):**
- `npm run test:pr` / `test:release` — the validation spine (lint, tsc, vitest, doctor; release adds coverage/verify-claims/benches/gate/smoke/build/pack) — exactly what CI runs (`ci.yml:46,104`).
- Three deterministic benches (`blue:`/`black:`/`white:`) — import the real `dist/` pipeline; the audit's 4/4, 6/6, 6/6 evidence for phases 16/18/19; never the `:live` network variants.
- Docker + compose — OPS-01 evidence (image pinned by digest; wget/curl from the alpine base, no new packages).
- Tauri bundling chain (`sidecar:build` → `tauri build --bundles deb,appimage`) — OPS-02; CI's exact Linux args keep the log unambiguous.

**Host gaps (installer matrix only, one-time):** `patchelf` must be installed (CI installs it explicitly; noble substitutes `libayatana-appindicator3-dev` for `libappindicator3-dev` — not compile-critical since `tauri` features are empty, no tray). No other gaps.

**Constraints honored:** no new runtime dependencies; no new test runner/coverage tool; no lint-config changes to move counts; no `--all` sidecar cross-builds or mobile targets on this host.

### Expected Features

**VAL-01 — retroactive VALIDATION.md for phases 15–20** *(decided direction: runs FIRST against the v1.3 boundary, with a supersession log)*
- Table stakes: one template-shaped `NN-VALIDATION.md` per phase dir 15–20 (`status: validated`, honest `nyquist_compliant`); a Per-Task Verification Map tying each requirement to a real, actually-run-green command; Manual-Only table for what cannot be automated; the file dates itself as a State-B reconstruction and never fabricates wave-0 history; no invented coverage — untested requirements are escalated, not papered over; nyquist gap tests committed separately from the docs commit; ≥1 negative/decoy probe per phase probing the bug *class* (e.g. `roeAudit(actions, {})` must not be all-compliant), plus the existing bench gates re-run as evidence, not restated; re-audit flips the Nyquist `not_validated` block.
- Differentiators: phase-19 VALIDATION.md records the `allowedTargets` incident as justification for what pins sample; integration claims (purple consumes blue gaps + white verdicts; benches import `dist/`) mapped as explicit cross-phase requirements.
- Decided: phases landing after VAL-01 (ROE-01, UNIFY-01) that touch phase-15–20 surfaces carry validation forward and update VAL-01's supersession log — VALIDATION.md must never silently describe replaced code.

**ROE-01 — ROE text as server state; verdicts-on-record** *(decided direction: ROE text is untrusted DATA)*
- Table stakes: operator ROE text loadable into server state via an explicit API (recommended shape: dedicated store mirroring the `purpleSyntheses` `'latest'` slot + snapshot/restore; NOT a `MissionDraft` field — the v1.3 route comment and static pin rule that out); `GET /api/teams/white/roe` returns the parse of the on-record text and, only when `ok:true`, `roeAudit` verdicts over a named action source; `ok:false` never yields verdicts; each verdict carries full `RoeVerdict` shape plus provenance (ROE revision/text hash, `parseRoe` line refs — the OPA decision-log lesson at local scale); honesty surfaces updated in lockstep (pins rewritten equally sharp in the same commit, bench case added, `docs/API_REFERENCE.md`, white-arbiter/dark-purple SKILL.md, MCP `tempest_white_roe` note).
- Decided (owner-conservative): deterministic `parseRoe` is the ONLY thing that sets scope — an LLM may summarize, never adjudicate; if ROE text is ever shown to referee LLMs it is delimited, labeled data-only (never instructions); `redactSecrets` on every emission (route, relay, logs; text stored as-given, redaction at read — divergence from ledger write-time redaction documented); missing/corrupt ROE at restart fails closed to cannot-derive — never empty-spec-continue; new mutation route lives under `/api/*` so the early-mounted bearer guard + rate limit cover it (explicit non-loopback test, body-size cap).
- Differentiators (defer unless planning pulls them in): persisted verdict ledger slot, ROE revision history, purple auto-consuming recorded verdicts, text provenance (who/when/source).
- Anti-features: guessed extraction from objective/constraints free-text; verdicts while `ok:false`; GET-route mutation; overwriting text with no revision record.

**UNIFY-01 — residualRisk prose ↔ riskTier** *(decided direction: option (a) — prose becomes a DERIVED rendering of the deterministic `riskTier`; API contract preserved; option (b) dropping prose is REJECTED per PROJECT.md constraint "existing `/api/*` routes keep their contracts")*
- Table stakes: exactly one authority — `riskTier` (deterministic f(severity, detection, verdict), `purple.ts:59-92`); prose produced by one pure tier→template function so the violation-branch contradiction (tier floors `high` while prose says "low residual risk") is structurally impossible; every consumer updated in the same commit: `docs/operators.html` (also render the tier), `docs/API_REFERENCE.md` (document tier, mark prose derived — already drifted), dark-purple SKILL.md (relay both), `teams-modules.test.ts` pins strengthened to assert prose↔tier agreement (not re-snapshotted), `purple-v2.test.ts` tier pins untouched, `dist/` rebuilt/docsite regenerated.
- Anti-features: prose→tier regex parsing (two signals again, worse); a second prose writer; silent field removal without documented contract sanction + migration note; weakening either pin file to vacuity.
- Watch the name collision: `riskTier` also names the arsenal approval-gate vocabulary (`RiskTier`, `types/index.ts`) — UNIFY-01 touches **only** `PurpleRiskTier`.

**OPS-01 — docker healthcheck in a real container** *(decided direction: Dockerfile HEALTHCHECK repointed to the open `/health` handler; NO new guard exemption — exempting `/api/health` would widen the unauthenticated surface the v1.2 guard deliberately closed; both runs evidenced)*
- The verified defect: Dockerfile probe hits guarded `/api/health` with no bearer → 401 forever → permanently `unhealthy` in the only sanctioned Docker mode; compose probe (bearer header) is already correct — the two probes diverge today.
- Table stakes: reconcile Dockerfile/compose/docs curl examples inside the phase; real `docker build` (record digest) + two evidenced runs — (a) with `T3MP3ST_BEARER_TOKEN`: observed `starting → healthy` transition plus inspect log entries, AND the failure path observed (retries exhaust into `unhealthy` — a probe only ever seen healthy proves nothing); (b) without token: fail-closed startup refusal; receipts (container IDs, `docker inspect` output, exit codes) in phase artifacts; guard-watching pins evolve if code changes.
- Anti-features: counting a successful build as verification; loopback-only runs; weakening the bearer guard to make the probe pass; probing an endpoint that 200s regardless of server health.

**OPS-02 — installer matrix on this host** *(decided direction: per-target receipts with sha256; cross-compiled targets NEVER count as host-observed)*
- Table stakes: `sidecar:build` (fresh — stale `src-tauri/binaries/` fails the bundle) → `tauri build --bundles deb,appimage` (CI's exact args); per-target matrix table: target / built-on-host? / artifact path / byte size / **sha256** / launched-and-booted?; explicit `not-buildable-on-linux — CI evidence only` cells for msi/nsis/app/dmg (mobile stays manual-dispatch CI); tool versions + wall time recorded; `tauri-scaffold-static.test.ts` pins kept true if first-run config fixes land.
- Differentiators: install the `.deb` in a throwaway container and boot the sidecar; `ar`/`tar`-list to verify externalBin + docs resources shipped; execute the AppImage once.
- Anti-features: blanket ✓ across six targets from a Linux host; counting the CI workflow's existence as host verification; artifacts without checksums.

**LINT-01 — warning baseline 177 → ≤176** *(decided direction: closes the milestone; every phase reports the running lint count in its gate table; no net-new warnings allowed mid-milestone)*
- Table stakes: locate the one net-new phase-20 warning (lint diff vs the 176 baseline); fix in code or narrow line-scoped suppression with recorded reason; 0-error gate intact; no config loosening, no file-level disables, no `.mjs` scope dodge, no deletion of real logic; final gate table records the **measured** ≤176.
- Differentiators: mechanical pin so drift cannot recur silently (doctor check or CI step; per-rule breakdown); drive-by fixes of pre-existing warnings only in files v1.4 already touches.

### Architecture Approach

The repo is already shaped for all six items — research requires no new code infrastructure. `src/server.ts` is the single stateful module (state block ~`:898-904`; snapshot via `buildStateSnapshot`, restore via `replaceMapContents`, debounced `persistState` writing a `redactSecrets`-wrapped `state.json`, `flushPersist` on shutdown); everything under `src/teams/` is pure and I/O-free (dependency direction server → teams). The bearer guard mounts early and covers every `/api/*` path on non-loopback binds (loopback keeps the anti-rebinding + CSRF guards, unauthenticated); bare `/health` is deliberately outside the guard and serves both `/health` and `/api/health` from one handler — exactly the path OPS-01's repointed probe will use.

**Major components:**
1. **Server state block + snapshot/persist** (`src/server.ts`) — ROE-01 adds one sanctioned ROE store slot here; nothing else moves.
2. **Pure white engines** (`src/teams/white.ts`, `src/teams/white/roe-parser.ts`) — unchanged; `parseRoe` honesty (`ok:false` → no verdicts) is consumed as-is.
3. **Purple single-writer derivation** (`src/teams/purple.ts`) — UNIFY-01 collapses prose to a pure function of `riskTier` (+ verdict/detection inputs).
4. **Remote-access guard** (`src/net/remote-access.ts`) — semantics untouched by decision; OPS-01 routes around it via open `/health`, not through it.
5. **Ops evidence surfaces** (`Dockerfile`, `docker-compose.yml`, `docs/DOCKER.md`, `src-tauri/*` chain) — modified by OPS-01 reconciliation; OPS-02 is execution+receipts only.
6. **Gate spine** (`test:pr`, `test:release`, three benches, eslint) — the evidence every VALIDATION.md and gate table cites; `npm run build` is the shared prerequisite for benches, test:gate, sidecar, and the docker image.

### Critical Pitfalls

1. **Silent permissiveness (the unifying failure mode)** — an absent/empty signal defaulting to "allowed" (the fixed `allowedTargets` bug's class). Review lens for every phase PR: *what does this do when the signal is missing?* Only acceptable answer: fail-closed / cannot-derive. Pin the class forever: `roeAudit(actions, {})` must never be all-compliant.
2. **Evidence theater in VAL-01** — rubber-stamping (restating green gates), vacuous green (sampling zero adversarial cases), validating the wrong build (after surfaces were rewritten). Fixed by the decided sequencing (v1.3 boundary + supersession log), requirement→test maps, falsifier statements, and re-justifying (not re-running) the twice-bent bench fixtures.
3. **Pin erosion** — deleting the honesty pin (`no ROE text on record`), weakening prose/tier pins to vacuity, batching pin updates into later commits. House rule: pins evolve with the surface, same commit, equally sharp.
4. **Ops false greens** — shallow green (build ≠ healthcheck), wrong-environment green (loopback run, CI substituted for host), installer matrix laundering (blanket ✓, unchecksummed artifacts), the never-run healthcheck hiding a permanent `unhealthy`. Fixed by the two evidenced OPS-01 runs and per-target sha256 receipts.
5. **Lint budget games** — inline-disable stuffing, rule downgrades, `.mjs` relocation, code deletion-as-cleanup, gate-check erosion. Fixed by fix-or-justified-disable only, a lint-hygiene static pin, running counts per phase, and a measured re-baseline at close.

## Implications for Roadmap

**Resolved build order (owner decision, superseding ARCHITECTURE.md §7's tentative placement of LINT-01 as phase 2):**

```
Phase 1  VAL-01           retroactive VALIDATION.md 15–20 (+nyquist gap tests, supersession log)
Phase 2  ROE-01           ROE store + mutation route + GET verdicts-on-record
Phase 3  UNIFY-01         residualRisk ← riskTier single-writer derivation + all consumers
Phase 4  OPS-01 + OPS-02  real-container healthcheck + host installer matrix (one ops phase or paired)
Phase 5  LINT-01          re-measure and hold ≤176; hygiene pin; milestone close
```

### Phase 1: VAL-01 — Retroactive Validation (Phases 15–20)
**Rationale:** Decided direction — runs FIRST against the v1.3 boundary (commit `4c37232`/current HEAD before v1.4 work touches those files). UNIFY-01 and ROE-01 rewrite exactly the surfaces (white routes, `src/teams/purple.ts`) the retro maps reference; validating first means evidence describes code that existed, and later phases carry validation forward via the supersession log instead of silently invalidating it.
**Delivers:** 6× `NN-VALIDATION.md` (template-shaped, State-B-honest), nyquist gap tests committed separately, ≥1 class-level negative probe per phase, emptied `not_validated` audit block, supersession log.
**Addresses:** audit debt "validate-phase was never run" (phases 15–20).
**Avoids:** validation-vs-mutation race; rubber-stamping; vacuous green.

### Phase 2: ROE-01 — ROE Text as Server State
**Rationale:** Pure engines already exist; work is additive server surface. Must land before UNIFY-01 because both edit `docs/API_REFERENCE.md` (white roe row vs purple section) — sequential avoids churn. From here on, every phase touching a phase-15–20 surface updates VAL-01's supersession log.
**Delivers:** sanctioned ROE store (+ snapshot slot), one new `/api/*` mutation route, GET returning parse + provenance-stamped verdicts when `ok:true`, honesty pins rewritten same-commit, bench text→parse→verdict case, docs/skills/MCP sync.
**Uses:** existing `parseRoe`/`roeAudit`, `purpleSyntheses` slot pattern, snapshot/persist machinery, early-mounted bearer guard.
**Avoids:** prompt injection via ROE text (data-only delimiting if ever shown to referee LLMs); silent-permissive load failure (fail closed); secret leakage (`redactSecrets` on every emission).

### Phase 3: UNIFY-01 — One Risk Signal
**Rationale:** Immediately after ROE-01 (shared `docs/API_REFERENCE.md`); decided direction (a) keeps the `/api/*` contract — prose becomes a deterministic rendering of `riskTier`, so divergence is structurally impossible without a response-shape change.
**Delivers:** single pure derivation function + parity pins, updated operators.html (tier rendered), API_REFERENCE (tier documented, prose marked derived), dark-purple SKILL.md, strengthened `teams-modules` pins, `dist/` rebuild, VAL-01 supersession entry for phase 20.
**Uses:** existing deterministic tier table (`purple.ts:59-92`) as the documented derivation.
**Avoids:** divergent re-derivation; prose→tier regex parsing; stale mirrors; conflation with the unrelated arsenal `RiskTier`.

### Phase 4: OPS-01 + OPS-02 — Real-Container & Installer Evidence
**Rationale:** No code dependencies on phases 2–3 — they produce evidence, not features — but they belong after VAL-01 so ops evidence is validation-grade, and OPS-02 benefits from building against the final code state (needs a green `npm run build`; fresh sidecar). Grouped as one ops phase or a tight pair: shared receipt discipline, shared host prep (patchelf).
**Delivers:** reconciled Dockerfile/compose healthcheck (repointed to open `/health`, no guard exemption); evidenced with-token healthy transition AND failure path AND no-token fail-closed refusal; deb/appimage artifacts with path/size/sha256 + per-target matrix table (CI-evidence cells for msi/nsis/app/dmg); DOCKER.md curl examples fixed.
**Uses:** docker 29 + compose, tauri CLI + pkg sidecar chain, CI's exact bundle args.
**Avoids:** healthcheck theater; installer matrix laundering; environment-specific passes.

### Phase 5: LINT-01 — Baseline Re-measure & Close-Out
**Rationale:** Decided direction — LINT-01 closes the milestone because VAL-01's nyquist gap tests move the lint (and test) counts; only a post-VAL, post-code re-measure is meaningful. Mid-milestone rule holds throughout phases 1–4: every phase's gate table reports the running lint count; no net-new warnings allowed anywhere in v1.4.
**Delivers:** the one net-new phase-20 warning fixed or narrowly justified; measured ≤176 in the final gate table; lint-hygiene static pin (inline-disable count ceiling, config-diff watch); full gates re-run as close-out evidence.
**Avoids:** suppression games; scope dodges; drift averaging; closing on a remembered number.

### Phase Ordering Rationale

- **VAL-01 first** is a dependency, not a preference: retro-validation must describe the v1.3 boundary; every later phase that mutates those surfaces carries validation forward via the supersession log (decided).
- **ROE-01 → UNIFY-01 sequential**: logically independent subsystems but both edit `docs/API_REFERENCE.md`; sequencing avoids merge churn on the contract doc. Either order works mechanically; ROE first keeps the docs pass one-directional.
- **OPS-01/OPS-02 float after VAL-01**, before close-out: zero code coupling, pure evidence; OPS-02 last-of-the-pair so artifacts reflect final code.
- **LINT-01 strictly last**: VAL-added tests shift the count the baseline is measured on; a mid-milestone re-baseline would be immediately invalidated. Hence: every phase reports the running count (attribution, not averaging), and only phase 5 re-measures and holds ≤176.
- Every phase inherits the fail-closed review lens and the same-commit pin rule; every phase's output must read no greener than its receipts.

### Research Flags

Phases needing care during planning (not deeper external research — the domain is fully internal):
- **VAL-01:** nyquist gap-filling scope (how many MISSING cells get new tests vs Manual-Only escalation); whether v1.4's own new phases also receive VALIDATION.md (PROJECT.md scopes VAL-01 to the six v1.3 phases — confirm at roadmap time); bench-fixture re-justification protocol (fixtures were bent twice in v1.3).
- **ROE-01:** name the `roeAudit` action source explicitly (mission drafts as actions is research [INFERENCE]); decide verdict persistence (ledger slot) vs computed-on-read — differentiator vs table-stakes call for this milestone; body-size cap value; transport shape for the mutation route (current pins forbid `app.post('/api/teams/white/roe')` — the pin text is part of the choice).
- **UNIFY-01:** whether the prose template keys strictly on the tier or on tier+inputs (owner-conservative default: strictly tier, guaranteeing agreement by construction); `PurpleRiskTier` vs `RiskTier` naming — document side-by-side at minimum, rename only with contract sanction.
- **OPS-01:** confirm `.env.example` token placeholders (`:36-37`) during the run; record whether `$$` compose expansion under `T3MP3ST_BEARER_TOKEN_FILE` is exercised.
- **OPS-02:** first real `tauri build` on this host — classic first-run failures (externalBin target-triple naming, bundle quirks) are expected and are findings, not blockers.

Standard-pattern phases (skip further research):
- **LINT-01:** measurement and enforcement knobs are fully pinned by STACK.md §4; execution-only.
- **OPS-01 mechanics** post-decision: the wiring, commands, and expected outputs are fully scripted in STACK.md §3 / ARCHITECTURE.md §4.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every tool host-probed 2026-10-12; repo requirements line-cited; gaps (patchelf) identified with exact remedy |
| Features | HIGH | All current behavior repo-cited; all previously-flagged owner semantics now resolved as decided direction |
| Architecture | HIGH | Integration points verified to file:line; no new infrastructure required by any item |
| Pitfalls | HIGH | Each failure mode has observed repo precedent or verified wiring; preventations mapped to phases |

**Overall confidence:** HIGH.

### Gaps to Address

- **`roeAudit` action source for ROE-01** — research marks "mission drafts as actions" [INFERENCE]; must be named explicitly in ROE-01 planning.
- **Verdict persistence vs on-read** — differentiator; milestone-scope call at planning (owner-conservative default: table stakes only, ledger slot deferred).
- **VALIDATION.md for v1.4's own phases** — PROJECT.md scopes VAL-01 to the six v1.3 phases; roadmap should confirm the boundary.
- **Fixture-oracle re-justification protocol** — v1.3 bent bench fixtures twice; VAL-01 planning should define how an oracle change is re-justified rather than re-run.
- **Host one-time prep** — `patchelf` install requires sudo; OPS-02 planning should sequence it as step 0.
- **Expected, not gaps:** lint/test count movement from VAL-added tests (handled by LINT-01 last); `dist/` committed-copy staleness after UNIFY-01 (handled by rebuild-in-same-commit).

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — host toolchain probe (2026-10-12), gate/bench command inventory, OPS-01/02 evidence scripts, lint measurement (every claim file:line-cited)
- `.planning/research/FEATURES.md` — per-item current state, table stakes/differentiators/anti-features, consumer enumerations (repo-evidence only; one external pattern check)
- `.planning/research/ARCHITECTURE.md` — verified integration points, complete consumer table, file inventory (modified vs new), draft build order
- `.planning/research/PITFALLS.md` — failure modes, warning signs, preventations per item; unifying silent-permissiveness analysis
- `https://www.openpolicyagent.org/docs/management-decision-logs` — decision-log pattern framing for verdicts-on-record (transportable idea only: versioned policy text + verdict bound to revision + durable record)

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md` — constraints (no new runtime deps, `/api/*` contracts stable, loopback posture), Core Value ("power without provenance is failure")
- `.planning/v1.3-MILESTONE-AUDIT.md` — the six debt items, Nyquist `not_validated` block, per-phase criteria-evidence table, lint drift record
- `.planning/v1.2-MILESTONE-AUDIT.md` — healthcheck "edited, not executed" and installer "CI-only" debt provenance
- Phase summaries (`.planning/milestones/v1.3-phases/{12,13,14,19,20}-01-SUMMARY.md` et al.) — gate tables, healthcheck bearer addition, sidecar contract, bench incident
- gsd-core `validate-phase` workflow + `VALIDATION.md` template — the State-B reconstruction contract VAL-01 executes

### Tertiary (LOW confidence — use with validation)
- Committed `dist/` copy and build-time-generated docsite mirrors — stale-mirror risk surfaced by PITFALLS §2; never a source of truth, always regenerated
- `~/.agents/gsd-core` tooling behavior (nyquist-auditor, `verification.append-audit`) — cited from workflow docs; behavior to confirm at VAL-01 execution

---
*Research completed: 2026-10-12*
*Ready for roadmap: yes*
