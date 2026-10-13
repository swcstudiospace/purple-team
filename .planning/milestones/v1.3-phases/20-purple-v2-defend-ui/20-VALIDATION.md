---
phase: "20-purple-v2-defend-ui"
slug: "purple-v2-defend-ui"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false)
status: validated
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 20 — Validation Record (Purple v2 & Defend UI)

> State-B retroactive validation of archived v1.3 Phase 20 (purple v2 & Defend UI, 2026-10-10)
> against the frozen v1.3 boundary. Every map row cites a command run during THIS pass
> (2026-10-12) with its measured output — never a restated v1.3 number. One gate
> segment (`prompt:audit`) is RED this pass and is recorded as an explicit FINDING
> below, not absorbed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts']` — probes auto-discovered, zero config change) |
| **Quick run command** | `npx vitest run src/__tests__/purple-v2.test.ts src/__tests__/ui-inline-scripts-parse.test.ts src/__tests__/tauri-scaffold-static.test.ts src/__tests__/teams-modules.test.ts` |
| **Full gate spine** | `npm run test:pr` (= lint + typecheck + `npm test` + doctor), `npm run prompt:audit` |
| **Estimated runtime** | ~30 seconds (full `test:pr` ~25s; suites <1s; audit <1s) |

---

## State-B Reconstruction Note

This file is a State-B reconstruction: Phase 20 completed 2026-10-10 and was never
seeded with wave-0 validation history, so `wave_0_complete` stays `false` and no
wave-0 history is invented here.

Boundary receipt: `git diff 4c37232..HEAD -- docs/index.html src/prompts/ src/resources/ src/server.ts scripts/prompt-audit.mjs`
is EMPTY this pass — the only `src/` addition since `4c37232` is the test-only
`src/__tests__/v13-class-probes.test.ts` (plan-01 commit `7a9bfb9`, zero modified
production files). `nyquist_compliant` is honestly `false`: the browser-render and
archival-inspection cells below have no automatable command and escalate to
Manual-Only, so per audit-milestone §5.5 this phase re-audits as PARTIAL — before
even counting the prompt:audit finding.

---

## Per-Task Verification Map

| Requirement (v1.3-ROADMAP §Phase 20) | This-pass command (2026-10-12) | Measured output |
|---|---|---|
| P20-C1: id-keyed correlation pinned (shuffled order joins) | `npx vitest run src/__tests__/purple-v2.test.ts` | 1 file passed, 11 tests passed, 0 failed (shuffled-map id join vs positional decoy, 16-row risk table, fallback modes) |
| P20-C2a: Defend page renders gap matrix from live routes (static pins) | `npx vitest run src/__tests__/ui-inline-scripts-parse.test.ts src/__tests__/tauri-scaffold-static.test.ts` | 2 files passed, 30 tests passed (4 + 26), 0 failed (asset pins + parse gates green) |
| P20-C2b: prose/tier pins current | `npx vitest run src/__tests__/teams-modules.test.ts` | 1 file passed, 26 tests passed, 0 failed |
| P20-C3a: full PR gate spine green | `npm run test:pr` (exit 0) | 101 files / 1109 tests passed, 0 failed (v1.3 close was 100/1103 — the +6 delta is the plan-01 probe file, a distinct this-pass number, not a restatement); lint 0 errors, 177 warnings (at cap, no net-new); typecheck clean; doctor 28/33 checks passed, 5 warnings (all optional-tool-absent: nmap, nuclei, semgrep, promptfoo, API-offline), 0 blockers |
| P20-C3b: prompt doctrine audit | `npm run prompt:audit` → **exit 1 — FINDING F-20-01 (see below)** | 29/34 checks pass; 5 UI-default-prompt checks RED: `ui default prompts inherit Plinian doctrine`, `...hacker mindset`, `...creative agency`, `ui self-heal is named the fixer`, `ui optimizer is receipt-aware` (`docs/index.html` contains none of the asserted strings) |
| P20-C4 (class probe): orphan-verdict isolation (T-21-04) | `npx vitest run src/__tests__/v13-class-probes.test.ts` | 1 file passed, 6 tests passed, 0 failed (phase-20 block: verdict keys matching no finding leave every coverage row byte-identical) |

*Status: ✅ green except P20-C3b (this pass) · ⬜ Manual-Only below*

---

## Finding F-20-01: `prompt:audit` red at the frozen boundary (pre-existing)

- **Observation:** `npm run prompt:audit` exits 1 this pass (2026-10-12): 5 UI-default-prompt checks fail because `docs/index.html` lacks the asserted doctrine strings.
- **Boundary proof:** `git diff 4c37232..HEAD` over every audit input (`docs/index.html`, `src/prompts/`, `src/resources/`, `src/server.ts`, `scripts/prompt-audit.mjs`) is empty, and the working tree is clean — the failure existed at the v1.3 boundary close. It is not caused by, and cannot be caused by, any Phase 21 change (planning paths + one test file only).
- **Discrepancy:** 20-01-SUMMARY's gate table records "`npm run prompt:audit` exit 0 — 39/39 directive-preservation baseline" at v1.3 close. The deterministic re-run this pass contradicts it (29/34). Unresolved — logged as follow-up for the milestone owner, NOT silently absorbed, NOT counted as a fresh green.
- **Scope stance:** debugging the audit tool or re-doctrining the UI defaults is production/docs-surface work, out of scope for this docs-only validation phase. The finding stays open; the supersession log will record whatever future phase re-evidences it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Defend page renders the gap matrix from live routes in a real browser | P20-C2 | Browser render against a live server has no harness; building one is new test infrastructure (out of scope) | Serve the app, open `docs/defend.html`, confirm all four panels (coverage matrix, noise budget, evidence chain, report audit) render live route data across all four states per panel |
| ROADMAP/STATE reflect completion (archival-accuracy inspection) | P20-C3 | No automated check asserts planning-artifact accuracy; human inspection only | Read `.planning/milestones/v1.3-ROADMAP.md` progress table and `STATE.md` against the six phase SUMMARYs, confirm dates, counts, and statuses match |

---

## Falsifier

This validation would have FAILED if shuffled verdict maps had joined positionally,
if any Defend-UI asset/parse pin had gone red, if the full `test:pr` spine had exited
non-zero, or if the orphan-verdict probe had shifted any coverage row — i.e. if the
phase-20 suites or the phase-20 class-probe block
(`src/__tests__/v13-class-probes.test.ts`, phase-20 block at `:80-81`) had gone red.
The `prompt:audit` red is recorded as Finding F-20-01 above: it deepens the honest
PARTIAL, it does not overturn the green evidence beside it. A red probe is a finding,
never a cue to weaken the engine.

---

## Validation Sign-Off

- [x] Every Phase 20 criterion has a map row with a this-pass command, date, and measured output distinct from the v1.3 close figures (1109 vs 1103 tests; lint 177 confirmed, not copied)
- [x] The map records the measured lint warning count (177) with zero errors from this pass
- [x] The Manual-Only table covers browser render against a live server and archival-accuracy inspection
- [x] The `prompt:audit` red is an explicit finding (F-20-01) with boundary proof and a discrepancy note — never a silent pass
- [x] `nyquist_compliant: false` set honestly (manual cells + open finding → §5.5 PARTIAL)
- [x] `wave_0_complete: false` — no invented wave-0 history

**Approval:** validated 2026-10-12 with open finding F-20-01 (probe commit `7a9bfb9` precedes this docs commit)

---

*Supersessions: see `.planning/milestones/v1.3-phases/SUPERSESSION.md` — this file describes the `4c37232` boundary.*
