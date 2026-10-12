# Roadmap: v1.4 — Hardening & Validation

Research: `.planning/research/SUMMARY.md` (+ `STACK.md`/`FEATURES.md`/`ARCHITECTURE.md`/`PITFALLS.md`, HIGH confidence, owner decisions resolved, 2026-10-12). Milestones v1.0–v1.3 archived in `.planning/milestones/`. Continuous phase numbering per GSD convention — v1.4 opens at Phase 21.

## Overview

v1.3 closed with six accepted audit debts: phases 15–20 were never validated, ROE verdicts had no text source, purple carried two divergent risk signals, the docker healthcheck and installer matrix were edited/CI-only, and lint drifted 176 → 177. This milestone is evidence quality, not capability: validate retroactively, give verdicts provenance, collapse the risk signal, run the ops claims for real, and re-measure the baseline on a measured number. No new capabilities, no new runtime dependencies, no `/api/*` contract breaks.

**Build order is dependency-driven (binding, from research):** VAL-01 first against the frozen v1.3 boundary (its evidence must describe code that existed); ROE-01 then UNIFY-01 (both edit `docs/API_REFERENCE.md` — sequential keeps the contract-doc pass one-directional); ops evidence after the code phases so artifacts reflect final code; LINT-01 strictly last (VAL-added tests move the count, so only a post-VAL, post-code re-measure is meaningful).

**Milestone-wide constraints (bind every phase):**
- VAL-01 (Phase 21) runs FIRST against the v1.3 boundary and opens a supersession log; every later phase that touches a phase-15–20 surface appends to it — VALIDATION.md never silently describes replaced code.
- Every phase's gate table reports the running lint count; zero net-new warnings mid-milestone (Phase 25 re-measures and holds ≤176).
- Static pins evolve same-commit and never weaken to vacuity.
- No new runtime dependencies; existing `/api/*` contracts stay stable (new routes mount under `/api/*` behind the existing bearer/origin guards).
- Every missing-signal path fails closed; ops evidence is receipt-grade (container IDs, sha256, measured counts) — output reads no greener than its receipts.

## Phases

- [x] **Phase 21: Retroactive Validation (Phases 15–20)** - VAL-01: template-shaped `NN-VALIDATION.md` per v1.3 phase against the frozen boundary, class-level negative probes, Nyquist promotion, supersession log (completed 2026-10-12)
- [ ] **Phase 22: ROE Text as Server State** - ROE-01: sanctioned ROE store + `/api/*` mutation route; `GET /api/teams/white/roe` emits provenance-stamped verdicts when and only when the parse is `ok:true`; fail-closed
- [ ] **Phase 23: One Risk Signal** - UNIFY-01: `residualRisk` prose becomes a pure derived rendering of the deterministic `riskTier`; every consumer updated same-commit; API shape unchanged
- [ ] **Phase 24: Ops Evidence on This Host** - OPS-01 + OPS-02: real-container healthcheck (healthy transition, failure path, no-token refusal) + host installer matrix with per-target sha256 receipts
- [ ] **Phase 25: Lint Re-baseline & Close-Out** - LINT-01: fix the net-new phase-20 warning, measure ≤176 in the close-out gate table, lint-hygiene pin, full gates green

## Phase Details

### Phase 21: Retroactive Validation (Phases 15–20)

**Goal**: Phases 15–20 are promoted from unvalidated to verified by evidence that describes the v1.3 boundary exactly as it existed — before any v1.4 code touches those surfaces.
**Depends on**: v1.3 close (boundary commit `4c37232` / HEAD at milestone start)
**Requirements**: VAL-01 — one template-shaped `NN-VALIDATION.md` per phase dir 15–20 (`status: validated`, honest `nyquist_compliant`); Per-Task Verification Map tying every phase requirement to a command actually run green during this pass; ≥1 class-level negative probe per phase (e.g. `roeAudit(actions, {})` never all-compliant) committed separately from the docs commit; honest Manual-Only table; State-B dating (no invented wave-zero history); re-justification (not blind re-run) of the twice-bent bench fixtures; re-audit empties the Nyquist `not_validated` block; supersession log opened with its update rule stated. Scope confirmed: VAL-01 covers the six v1.3 phases only — v1.4's own phases are validated forward by their own phase gates. Runs against the v1.3 boundary, before ROE-01/UNIFY-01 rewrite white routes and `src/teams/purple.ts`.
**Success Criteria** (what must be TRUE):
  1. Each of the six phase dirs carries an `NN-VALIDATION.md` whose Per-Task Verification Map ties every phase requirement to a command actually run green in this pass — no restated v1.3 gates, no invented history (State-B dating present)
  2. Each phase has ≥1 class-level negative probe committed separately from its docs commit; all Nyquist gap tests run green
  3. Re-audit flips the Nyquist `not_validated` block to validated
  4. Unautomatable requirements are escalated in an honest Manual-Only table, not papered over; bench-fixture oracle references are re-justified, not silently re-run
  5. Supersession log exists with its update rule (post-21 phases mutating phase-15–20 surfaces must append); phase gate table reports the running lint count with no net-new warnings vs the 176 baseline

**Plans**: TBD
- [x] 21-01-PLAN.md
- [x] 21-02-PLAN.md
- [x] 21-03-PLAN.md

### Phase 22: ROE Text as Server State

**Goal**: An operator can put ROE text on record in server state, and `/api/teams/white/roe` emits deterministic, provenance-stamped verdicts derived only from that text — failing closed when it is absent or corrupt.
**Depends on**: Phase 21 (validation boundary frozen; supersession log active)
**Requirements**: ROE-01 — sanctioned ROE store in `src/server.ts` mirroring the `purpleSyntheses` `'latest'` slot + snapshot/restore; one new `/api/*` mutation route (early-mounted bearer guard + rate limit cover it on non-loopback; body-size cap); `GET /api/teams/white/roe` returns the deterministic parse of the on-record text and, only when `parseRoe` is `ok:true`, `roeAudit` verdicts over a named action source (named explicitly during planning — research flags this as open); every verdict carries the full `RoeVerdict` shape plus provenance (ROE revision/text hash, `parseRoe` line refs); `redactSecrets` on every emission (text stored as-given, redacted at read — divergence from write-time ledger redaction documented); ROE text is untrusted data: deterministic scope only, delimited data-only delimiting if ever surfaced to referee LLMs; missing or corrupt stored ROE fails closed to cannot-derive (never empty-spec-continue); honesty pins rewritten equally sharp in the same commit (the transport-shape pin ruling out `app.post('/api/teams/white/roe')` is part of the route-shape choice); bench text→parse→verdict case; `docs/API_REFERENCE.md`, white-arbiter/dark-purple SKILL.md, MCP honesty surfaces synced; supersession entry for touched phase-19 white surfaces. Constraints honored: no `/api` contract breaks beyond the sanctioned ROE-01 behavior, no new runtime dependencies.
**Success Criteria** (what must be TRUE):
  1. Operator loads ROE text via the mutation route; `GET /api/teams/white/roe` returns the parse plus verdicts when and only when `parseRoe` is `ok:true` — `ok:false` never yields verdicts (pinned by test)
  2. Every emitted verdict carries provenance: ROE revision/text hash and `parseRoe` line refs — a verdict without text provenance is never emitted
  3. Missing or corrupt stored ROE fails closed to cannot-derive, never empty-spec-continue; the silent-permissiveness class pin (`roeAudit(actions, {})` never all-compliant) stays green or sharper
  4. Non-loopback load without a bearer is refused (guard covers the new route, body-size cap active); all emissions are `redactSecrets`-wrapped; honesty pins rewritten same-commit, equally sharp — none weakened
  5. Supersession log carries the phase-19 entry; docs/skills/MCP surfaces agree with the route behavior; gate table reports the running lint count with no net-new warnings

**Plans**: TBD

### Phase 23: One Risk Signal

**Goal**: `residualRisk` prose and `riskTier` collapse into one deterministic signal — prose becomes a derived rendering of the tier, making tier/prose contradiction structurally impossible without changing the API response shape.
**Depends on**: Phase 22 (both edit `docs/API_REFERENCE.md`; sequencing keeps the contract-doc pass one-directional)
**Requirements**: UNIFY-01 — single pure tier→prose derivation in `src/teams/purple.ts` (single writer; touches only `PurpleRiskTier`, never the unrelated arsenal `RiskTier` vocabulary); API response shape unchanged — dropping the prose field was considered and rejected per the PROJECT.md API-stability constraint; every consumer updated in the same commit: `docs/operators.html` renders the tier, `docs/API_REFERENCE.md` documents the tier and marks prose derived (already drifted today), dark-purple SKILL.md relays both; `teams-modules.test.ts` pins strengthened to assert prose↔tier agreement (not re-snapshotted); `purple-v2.test.ts` tier pins untouched; `dist/` rebuilt / docsite regenerated in the same commit; supersession entry for the phase-20 purple surface. Constraints honored: pins same-commit and never weakened, no new dependencies.
**Success Criteria** (what must be TRUE):
  1. Exactly one prose writer exists — a pure function of the deterministic `riskTier` — and a strengthened `teams-modules.test.ts` pin asserts prose↔tier agreement across the whole tier table
  2. `/api` response shape is unchanged: existing consumers keep parsing without edits (contract preserved)
  3. `docs/operators.html` renders the tier, `docs/API_REFERENCE.md` documents the tier and marks prose derived, dark-purple SKILL.md relays both — all updated in the same commit as the derivation, with `dist/`/docsite rebuilt
  4. Supersession log carries the phase-20 entry; gate table reports the running lint count with no net-new warnings

**Plans**: TBD

### Phase 24: Ops Evidence on This Host

**Goal**: The two "edited but never executed" ops claims become receipt-grade evidence: the docker healthcheck observed live in a real container — healthy path, failure path, and fail-closed refusal — and the desktop installer matrix built on this host with checksums.
**Depends on**: Phase 21 (validation-grade receipt discipline active); runs after Phase 23 so artifacts reflect the final code state (fresh sidecar needs a green `npm run build`)
**Requirements**: OPS-01 + OPS-02 — carried as ONE phase. OPS-01: reconcile Dockerfile/compose/docs probes inside the phase — repoint the Dockerfile HEALTHCHECK to the deliberately-open `/health` handler (no new bearer-guard exemption; `/api/health` stays guarded; compose probe already correct); real `docker build` with the image digest recorded; three evidenced runs: (a) with `T3MP3ST_BEARER_TOKEN` — observed `starting → healthy` transition with inspect receipts, (b) the failure path observed — retries exhausting into `unhealthy` (a probe only ever seen healthy proves nothing), (c) no-token fail-closed startup refusal; DOCKER.md curl examples fixed; container IDs, `docker inspect` output, and exit codes recorded in phase artifacts. OPS-02: fresh `sidecar:build` → `tauri build --bundles deb,appimage` (CI's exact Linux args); per-target receipt matrix (target / built-on-host / artifact path / byte size / sha256 / launched?); explicit `CI-evidence-only` cells for msi/nsis/app/dmg (not buildable on linux-x64; mobile stays manual-dispatch CI); tool versions + wall time recorded; `tauri-scaffold-static.test.ts` pins kept true if first-run config fixes land; host prep (`patchelf` install) sequenced as step 0. **Single-phase justification:** shared receipt discipline (container IDs / sha256 / inspect output), shared one-time host prep, same failure-mode family (ops false greens — environment laundering, unchecksummed artifacts, shallow green), and zero code coupling to Phases 22–23; keeps the milestone at five phases within standard granularity. Constraints honored: no guard exemptions to make probes pass; cross-compiled artifacts never count as host-observed.
**Success Criteria** (what must be TRUE):
  1. Dockerfile and compose probes agree — HEALTHCHECK hits the deliberately-open `/health`; the diff shows no new bearer-guard exemption; DOCKER.md examples match the probes
  2. A with-token container run shows the observed `starting → healthy` transition, AND the failure path is observed (retries exhausting into `unhealthy`)
  3. A no-token container run shows the fail-closed startup refusal; container IDs, `docker inspect` output, image digest, and exit codes are recorded in phase artifacts
  4. `.deb` and AppImage are built on this host with a receipt table (path / byte size / sha256 / launched?) and msi/nsis/app/dmg carry explicit `CI-evidence-only` cells — no cross-compiled artifact appears as host-observed
  5. Gate table reports the running lint count with no net-new warnings (ops reconciliation touches no lint-scoped code; if it does, the count is explained)

**Plans**: TBD

### Phase 25: Lint Re-baseline & Close-Out

**Goal**: The milestone closes on a measured lint number: the baseline is back to ≤176 with 0 errors intact, a mechanical pin prevents silent drift, and full gates are green.
**Depends on**: Phases 21–24 (VAL-added tests move the count; only a post-VAL, post-code re-measure is meaningful)
**Requirements**: LINT-01 — lint-diff locate the one net-new phase-20 warning vs the 176 baseline; fix it in code, or narrow line-scoped suppression with a recorded reason; 0-error gate intact; the measured count lands in the close-out gate table; a lint-hygiene pin (inline-disable ceiling + config-diff watch, enforced via doctor check or CI step) prevents silent drift; no config loosening, no file-level disables, no `.mjs` lint-scope dodges, no deletion of real logic; full gates re-run as close-out evidence. The mid-milestone rule holds throughout Phases 21–24: every gate table reported the running count, no net-new warnings anywhere in v1.4.
**Success Criteria** (what must be TRUE):
  1. The phase-20 net-new warning is gone — fixed in code, or suppressed with a narrow line-scoped disable carrying a recorded reason (no file-level disables)
  2. The close-out gate table records the measured warning count ≤176 with 0 errors — measured during this phase, not remembered or averaged
  3. The lint-hygiene pin (inline-disable ceiling + config-diff watch) exists and is enforced by doctor or CI
  4. Full gates re-run green as close-out evidence (lint, typecheck, vitest, doctor); ROADMAP/STATE reflect completion

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 21. Retroactive Validation (Phases 15–20) | 3/3 | Complete    | 2026-10-12 |
| 22. ROE Text as Server State | 0/TBD | Not started | - |
| 23. One Risk Signal | 0/TBD | Not started | - |
| 24. Ops Evidence on This Host | 0/TBD | Not started | - |
| 25. Lint Re-baseline & Close-Out | 0/TBD | Not started | - |
