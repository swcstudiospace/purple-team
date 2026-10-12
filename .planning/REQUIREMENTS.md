# Requirements: T3MP3ST v1.4 — Hardening & Validation

**Defined:** 2026-10-12
**Core Value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence — power without provenance is failure.
**Milestone goal:** Close the six v1.3 audit tech-debt items and promote phases 15–20 from unvalidated to verified, without new capabilities, new runtime dependencies, or contract breaks.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (traceability below).

### Validation

- [x] **VAL-01**: Each v1.3 phase directory 15–20 carries a `NN-VALIDATION.md` whose Per-Task Verification Map ties every phase requirement to a command actually run green during the pass, with ≥1 class-level negative probe per phase (e.g. `roeAudit(actions, {})` never all-compliant), an honest Manual-Only table, State-B dating (no invented wave-0 history), and a supersession log that later v1.4 phases update when they mutate validated surfaces.

### White ROE

- [ ] **ROE-01**: An operator can load ROE text into server state via a `/api/*` mutation route, and `GET /api/teams/white/roe` returns the deterministic parse plus provenance-stamped `RoeVerdict`s (ROE revision/text hash, line refs) when and only when `parseRoe` is `ok:true`; missing or corrupt stored ROE fails closed to cannot-derive; emissions are `redactSecrets`-wrapped; ROE text is treated as untrusted data (deterministic scope only, data-only delimiting if ever surfaced to referee LLMs).

### Purple risk signal

- [ ] **UNIFY-01**: `residualRisk` prose becomes a pure derived rendering of the deterministic `riskTier` (single writer in `src/teams/purple.ts`), the API response shape is unchanged, and every consumer is updated in the same commit with prose↔tier parity pins: `docs/operators.html` (tier rendered), `docs/API_REFERENCE.md` (tier documented, prose marked derived), dark-purple SKILL.md relay, `teams-modules.test.ts` pins strengthened to assert agreement.

### Operations evidence

- [ ] **OPS-01**: The Docker healthcheck is evidenced in a real container: Dockerfile/compose probes reconciled (repointed to the deliberately-open `/health`; no new guard exemption), a with-token run showing the observed `starting → healthy` transition, the failure path observed (retries exhausting into `unhealthy`), and a no-token fail-closed startup refusal — with container IDs and inspect receipts recorded.
- [ ] **OPS-02**: The desktop installer matrix is built on this host: fresh `sidecar:build` → `tauri build --bundles deb,appimage` with a per-target receipt table (target / built-on-host / artifact path / byte size / sha256 / launched?) and explicit `CI-evidence-only` cells for msi/nsis/app/dmg; cross-compiled artifacts never count as host-observed.

### Lint hygiene

- [ ] **LINT-01**: The eslint warning baseline returns to ≤176 (0 errors intact) by fixing the one net-new phase-20 warning in code (or a narrow line-scoped suppression with recorded reason), the measured count lands in the close-out gate table, and a lint-hygiene pin (inline-disable ceiling + config-diff watch) prevents silent drift; every v1.4 phase reports the running count and allows no net-new warnings.

## v2 Requirements

Deferred to a future milestone (differentiators surfaced by research, not in scope here).

### White ROE

- Persisted verdict ledger slot and ROE revision history
- Purple auto-consumption of recorded verdicts
- Text provenance (who/when/source) on ROE records

### Operations

- Install-and-launch verification of the built `.deb`/AppImage
- Per-rule lint budgets and doctor-integrated lint gate

## Out of Scope

- Dropping the `residualRisk` prose field entirely (option b) — sanctioned API contract change; rejected per PROJECT.md API-stability constraint
- Any bearer-guard exemption or widened unauthenticated surface (e.g. exempting `/api/health`) to make probes pass
- Weakening existing pins to vacuity to admit new behavior; bench fixture changes without re-justification
- msi/nsis/app/dmg host builds (not buildable on linux-x64; CI remains their evidence venue) and mobile targets on this host
- New runtime dependencies, new test/coverage frameworks, eslint config loosening, `.mjs` lint-scope dodges
- Unrelated repo cruft (e.g. the stray `./Heads-up: while wiring GET '` artifact file) — logged as follow-up, not milestone work

## Traceability

Requirement-to-phase mapping. Filled by the roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAL-01 | Phase 21 | Complete |
| ROE-01 | Phase 22 | Pending |
| UNIFY-01 | Phase 23 | Pending |
| OPS-01 | Phase 24 | Pending |
| OPS-02 | Phase 24 | Pending |
| LINT-01 | Phase 25 | Pending |
