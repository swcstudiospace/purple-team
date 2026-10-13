# Phase 21: Retroactive Validation (Phases 15–20) - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phases 15–20 are promoted from unvalidated to verified by evidence that describes the v1.3 boundary exactly as it existed (boundary commit `4c37232` = HEAD at milestone start) — before any v1.4 code touches those surfaces. Deliverables: one template-shaped `NN-VALIDATION.md` per archived v1.3 phase dir (`.planning/milestones/v1.3-phases/{15-blue-suite-core,16-blue-playbook-bench,17-black-suite-core,18-black-playbook-bench,19-white-suite,20-purple-v2-defend-ui}/NN-VALIDATION.md`), ≥1 class-level negative probe per phase, Nyquist gap tests, the audit's `not_validated` block emptied on re-audit, and the milestone supersession log opened. Scope confirmed at roadmap time: the six v1.3 phases only — v1.4's own phases validate forward via their own phase gates.

</domain>

<decisions>
## Implementation Decisions

### Sequencing and boundary (locked — research SUMMARY + roadmap)
- VAL-01 runs FIRST in the milestone, against the frozen v1.3 boundary; no v1.4 code change may land before its evidence exists
- Evidence must describe code that existed at `4c37232`/milestone start — State-B reconstruction, no invented wave-0 history
- Later v1.4 phases (22, 23, …) that mutate phase-15–20 surfaces append to the supersession log with the update rule stated in Phase 21's own VALIDATION/log artifact

### Evidence quality (locked — anti evidence-theater)
- Per-Task Verification Map ties every phase requirement to a command ACTUALLY RUN GREEN during this pass — never a restatement of v1.3 gate tables
- ≥1 class-level negative probe per phase probing the BUG CLASS, not the fixed instance (e.g. `roeAudit(actions, {})` must never be all-compliant — the allowedTargets silent-permissiveness class); probes committed separately from docs commits
- Nyquist gap tests committed separately from the VALIDATION.md docs commit
- Bench-fixture oracles (bent twice in v1.3) are RE-JUSTIFIED (cite original incident + pin rationale), not silently re-run
- Unautomatable requirements escalate to an honest Manual-Only table, never papered over

### Fixture re-justification protocol (Claude's discretion — conservative default)
- An oracle change is legitimate only with a written rationale citing the incident that bent it plus a pin that would catch a future silent bend; otherwise the oracle is treated as frozen ground truth
- Nyquist gap-filling scope: new tests only where a requirement cell has NO automated command; everything else lands in Manual-Only

### Claude's Discretion
- Exact probe selection per phase and gap-test placement, within the class-level rule above

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Template: `$HOME/.agents/gsd-core/templates/VALIDATION.md` (frontmatter: `status: draft → validated`, `nyquist_compliant`, Per-Task Verification Map, Manual-Only, Sign-Off)
- Gate spine (all existing): `npm run test:pr` (CI-parity), `npm run test:release` (tag-grade), three deterministic benches (`blue:`/`black:`/`white:` bench — require `npm run build` first; never `:live` variants)
- Evidence sources: per-phase `NN-01-SUMMARY.md` "Verification (full gates)" tables; `.planning/v1.3-MILESTONE-AUDIT.md` criteria table (commits `f654ea1`→`4c37232`)
- GSD tooling: `gsd-tools` query handlers; `gsd-validate-phase` workflow; `gsd-nyquist-auditor` agent for gap tests

### Established Patterns
- v1.3 phase dirs live under `.planning/milestones/v1.3-phases/` (archived); VALIDATION.md lands inside each dir as `NN-VALIDATION.md`
- Pins are the proof language of this repo: `test:pr` + benches + CI pin tests fail on drift

### Integration Points
- Audit: re-running `gsd-audit-milestone` §5.5 distinguishes NOT-VALIDATED (draft) vs PARTIAL vs validated (`nyquist_compliant: true`)
- Downstream: Phase 22 criterion 5 and Phase 23 criterion 4 each append a supersession entry

</code_context>

<specifics>
## Specific Ideas

- Boundary commit pinned: `4c37232` ("feat(teams): phase 20 — purple v2, Defend UI, wiring sweep; v1.3 gates green")
- Running lint count (≤176 baseline, 0 errors) reported in this phase's gate table; no net-new warnings
- Research inputs: `.planning/research/SUMMARY.md` §Phase 1, `PITFALLS.md` §1–2, `STACK.md` §2 (command inventory)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (ROE-01 action-source and route-shape choices belong to Phase 22 planning.)

</deferred>
