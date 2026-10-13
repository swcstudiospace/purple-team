# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.4 — Hardening & Validation

**Shipped:** 2026-10-13
**Phases:** 5 (21–25) | **Plans:** 7 | **Tasks:** 20 | **Commits:** 62 (2026-10-12 → 2026-10-13)

### What Was Built
- Retroactive validation of v1.3 phases 15–20: six template-shaped `NN-VALIDATION.md` records, six class-level negative probes (pinned green), open `SUPERSESSION.md` log, v1.3 audit Nyquist block flipped to an honest all-PARTIAL split (VAL-01)
- ROE text as server state: sanctioned single-slot `roeRecords` store, PUT/GET pair with provenance-stamped verdicts gated on `parseRoe` `ok:true`, fail-closed corruption ladder, 64 KiB cap (ROE-01)
- One risk signal: `residualRisk` prose collapsed into a single tier-keyed derivation with whole-vocabulary parity pins; API response shape unchanged; consumers + docsite mirrored same-commit (UNIFY-01)
- Ops evidence on this host: docker healthcheck observed live (healthy / failure / fail-closed refusal) off one image digest, plus host-built deb + AppImage with sha256 receipts and explicit CI-evidence-only cells (OPS-01 + OPS-02)
- Lint re-baseline: measured 176 warnings / 0 errors, phase-20 warning fixed via guard-throw, doctor lint-hygiene pin (census ceiling + config anchors) enforced through `test:pr`, hold knob proven (LINT-01)

### What Worked
- Dependency-driven build order: VAL-01 ran first against the frozen v1.3 boundary, so its evidence describes code that actually existed; LINT-01 ran strictly last so the re-measure counted VAL-added tests
- Sequencing the two `docs/API_REFERENCE.md` phases (22 → 23) kept the contract-doc pass one-directional — no merge conflicts, no re-reads
- Receipts discipline (container IDs, inspect JSON, sha256, measured counts) made every ops claim re-verifiable; the close audit re-verified receipts live without re-running phases
- Running lint count in every phase gate table caught the 176 → 177 delta immediately and assigned it to Phase 25 by design
- Honest debt registration (F-20-01, F-25-01) instead of papering kept the audit at tech_debt, not gaps_found

### What Was Inefficient
- Verifications for phases 21, 22, 24 went stale when later phases touched covered files — at close, the readiness check flagged them and the audit had to cross-verify their passing runs by hand
- 23-VERIFICATION.md shipped with frontmatter `status: passed` while the body honestly reported `human_needed` — the verifier's two status fields were never reconciled
- The v1.3 audit's Nyquist prose was left byte-stale by the 21-03 block-only constraint — the machine-readable block and human prose now disagree until an owner prose pass

### Patterns Established
- `SUPERSESSION.md`: append-only log; any post-validation phase mutating a validated surface must append before merge
- Gate tables carry the running lint count milestone-wide; zero net-new warnings is a per-phase acceptance criterion
- "Output reads no greener than its receipts": ops/UI claims require recorded artifacts, not narration
- Supersession rows cite explicit plan-task tokens (P20-C1/C2b/C3a/C4) so acceptance is grep-proof
- Manual-Only tables for unautomatable truths — declared, never hidden

### Key Lessons
1. Validate against a frozen boundary before code changes touch those surfaces; validation-after-drift proves nothing.
2. Digest-based staleness means any later file touch invalidates an earlier verification — budget for close-out cross-verification or re-runs when phases share files.
3. A milestone audit's value is adversarial: it caught a 39/39 claim that was really 29/34 and forced the divergence into the record (F-20-01) instead of the changelog.

### Cost Observations
- Plan durations: Phase 21 P21-03 2min · Phase 22 P22-01 9min · Phase 23 P23-01 8min · Phase 24 P24-01 19min · Phase 25 P25-01 12min
- Sessions/model mix: not tracked this milestone
- Notable: the whole milestone (5 phases, 7 plans) landed in ~29 hours of wall time with zero scope escapes

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.3 | — | 6 (15–20) | Red-parity suites, benches CI-pinned, purple v2 |
| v1.4 | 62 | 5 (21–25) | Evidence-first: frozen-boundary validation, supersession log, receipts-grade ops, measured baselines |

### Cumulative Quality

| Milestone | Tests | Lint (errors/warnings) | Zero-Dep Additions |
|-----------|-------|------------------------|--------------------|
| v1.3 | 1103 | 0 / 176 | 0 |
| v1.4 | test:pr green (VAL probes + parity pins added; count not re-baselined) | 0 / 176 (measured this pass) | 0 |

### Top Lessons (Verified Across Milestones)

1. Fail closed beats fall open: ROE corruption ladder and no-token refusal both shipped as pinned behavior, matching the v1.2 bind-refusal precedent.
2. Pins are load-bearing: honesty pins were sharpened, never weakened, across v1.4 — the audit's anti-pattern roll-up stayed clean.
3. Debt named at close becomes next-milestone scope; debt hidden at close becomes incident. v1.4 itself is the existence proof (it was built from v1.3's named debt list).
