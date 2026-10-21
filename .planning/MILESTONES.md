# Milestones

## v1.7 GitHub Integration, Repo-URL Purple Team, Claude PKCE & Full-screen Agent Panel (Archived: 2026-10-21)

**Phases completed:** 3 phases (34, 35, 36), 1 plan. Phases 35 and 36 have no PLAN files; their code shipped in 2c2feb5 and was gap-closed in 892d287.

**Closeout:** Owner accepted R1 as carried validation debt and archived on 2026-10-21. Verification status is `human_needed` for phases 34, 35 and 36. Not shipped: no PR, no Greptile review, no merge.

**Known gaps:** R1 live Claude Pro/Max login (34). D2 mission-level run before the legacy snippet inputs are removed (35). Live SSE drop and reconnect, private repo with a connected token, rate-limit window, repo above 64 MiB (35). Live streaming, regenerate on reload, keyboard pass, AgentPanel configure-dialog focus trap (36). Unplanned Chat Panel wave recorded in the audit.

**Audit:** `.planning/milestones/v1.7-MILESTONE-AUDIT.md`. **Phase archive:** `.planning/milestones/v1.7-phases/`.

**Key accomplishments:**
- 34 · **Refs:** SPE-15995 · **Completed:** 2026-10-19 · **Branch:** `v1.7-github-claude-agentpanel`
- 35 · **Refs:** SPE-15994, SPE-15992 · **Completed:** 2026-10-21 · **Branch:** v1.7-github-claude-agentpanel
- 36 · **Refs:** SPE-15993 · **Completed:** 2026-10-21 · **Branch:** v1.7-github-claude-agentpanel

---

## v1.6 Four-Hat Tooling, Composable Skills, UI & Desktop/Mobile Optimization (Completed: 2026-10-15; Archived: 2026-10-21)

**Phases completed:** 4 phases (30–33). Only phase 30 has artifacts (1 plan, 1 summary). Phases 31–33 have no PLAN, SUMMARY or VERIFICATION file on any branch in git history.

**Closeout:** Archived in the 2026-10-21 closeout run, after v1.7. The completion date is from ROADMAP.

**Known gaps:** Artifacts for phases 31–33 are absent. v1.6 was never run through `milestone complete` at the time.

**Archive:** `.planning/milestones/v1.6-ROADMAP.md`, `.planning/milestones/v1.6-phases/`.

---

## v1.5 Four-Hat Runtime Parity (Archived: 2026-10-15)

**Closeout:** `override_closeout`. Owner selected `Accept gaps and archive` on 2026-10-15. Phase 29 verification stays `human_needed`. Audit status `gaps_found`.

**Known gaps:** FH-EXEC-4 unmounted. All 72 AC-FH/NFR-FH rows remain Pending in the archived requirements. No hostile-input matrix. No TaskStore gate transition. Uncommitted rebrand WIP was not included.

**Observed, not acceptance:** `npx vitest run src` 107 files / 1239 tests, exit 0; `npx tsc --noEmit` exit 0. Staged routes fail closed on loopback. Record: `.planning/milestones/v1.5-phases/29-integrated-acceptance-and-governed-closure/29-EVIDENCE.md`.

**Phases archived:** 4 phase directories, 12 plans. Phase 26 and 27 verifications passed. Phase 28 verification passed for staged consumers. Phase 29 was not passed.

**What's next:** `/gsd:new-milestone`. Do not treat this archive as a clean ship of the 72 criteria.

---

## v1.4 Hardening & Validation (Shipped: 2026-10-13)

**Delivered:** Evidence quality, not capability — v1.3's phases retroactively validated against a frozen boundary, ROE verdicts given provenance, the purple risk signal collapsed to one, ops claims executed for real with receipts, and the lint baseline re-measured and pinned.

**Phases completed:** 5 phases, 7 plans, 20 tasks

**Key accomplishments:**
- Proved the Phase 21 evidence loop on archived phase 19: empty boundary receipt, six class-level probes green with zero net-new lint warnings, and a template-shaped 19-VALIDATION.md — test and docs in separate commits.
- Five template-shaped validation records for phases 15, 16, 17, 18, and 20 — every map row backed by a 2026-10-12 green run, Manual-Only tables honest, fixture re-justification in phase 15, and one pre-existing gate red recorded as open finding F-20-01.
- Phase 21 closes with governed evidence: an open append-only supersession log, a flipped v1.3 audit Nyquist block (empty not_validated, honest all-partial split), and measured gate receipts showing zero lint errors, no net-new warnings, and a still-frozen v1.3 boundary.
- Sanctioned single-slot ROE store with a validated PUT route and a fail-closed provenance-stamped GET, sharpened pins, bench evidence, and lockstep surface sync
- residualRisk prose collapsed into a single Record<PurpleRiskTier, renderer> derivation with whole-vocabulary string-equality parity pins, tier-rendering UI, and wholesale mirror regen
- Reconciled Docker healthcheck to the open /health, evidenced healthy/failure/refusal container runs off one image digest, and built host deb + AppImage with sha256 receipts — all transcribed in 24-receipts.md.
- Baseline restored to a measured 176 with 0 errors via guard-throw fix, pinned by two block-severity doctor checks, full test:pr green, scope gap honestly registered as F-25-01.

**Stats:**
- 107 files changed, +9,914 / −206 (milestone range); 61,896 lines of TypeScript in `src/`
- 5 phases, 7 plans, 20 tasks, 62 commits
- 2 days from milestone start to ship (2026-10-12 → 2026-10-13)

**Git range:** `8a2d261` (milestone start) → `828313f` (phase 25 complete); `feat(22-01)` → `feat(25-01)` with phase-21 probes as `test(21-01)`

**Closeout:** `override_closeout` — readiness reported phases 21/22/24 verification **stale** (later milestone phases touched covered files after their verifier runs passed); all five VERIFICATION.md runs passed at run time (21: 24/24, 22: 7/7, 23: 12/12, 24: 7/7, 25: 6/6) and the close audit cross-verified them. Owner accepted the override 2026-10-13. Requirements 6/6 checked; pre-close artifact audit all clear. Milestone audit status **tech_debt** (owner-accepted 2026-10-13): 5 recorded follow-ups (F-20-01, stale v1.3 audit Nyquist prose, operators.html Tier-cell browser render + 23-VERIFICATION status mismatch, F-25-01 lint-scope widening, stray repo-root artifact file) — carried into PROJECT.md and ROADMAP.md next-milestone candidates.

**What's next:** v2 unplanned — bootstrap with `/gsd:new-milestone` from the recorded candidates (deferred ROE ledger/consumption/provenance, install-and-launch verification, per-rule lint budgets, plus the five close-out follow-ups).

---
