---
phase: "26"
slug: "runtime-authority-bound-inputs-and-retained-execution"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-15"
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from 26-RESEARCH.md. Task IDs are filled when plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.9 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/teams-archetypes.test.ts src/__tests__/teams-modules.test.ts src/__tests__/hats-archetypes.test.ts src/__tests__/hats-modules.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick vitest command, plus any new Q1 case that task added
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | AC-FH-001 | — | Inventory rows cite real paths and label missing items | unit | `npx vitest run src/__tests__/teams-modules.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-003 | — | Purple rejected; hat parent map stable | unit | `npx vitest run src/__tests__/teams-archetypes.test.ts src/__tests__/hats-archetypes.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 0 | AC-FH-005 | T-26-01 | Unknown explicit role fails; legacy empty operators still start | integration | Q1 files | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-006 | — | Dispatch returns a run id; spawn-only is not success | integration | Q1 files | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-007 | T-26-02 | AI/agent families include blue and grant no offensive tool | unit | `npx vitest run src/__tests__/teams-archetypes.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 0 | AC-FH-008 | T-26-03 | Late result cannot retarget mission id | unit | Q1 files | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-009 | T-26-04 | Forbidden tool, batch, and seed: handler count 0 | unit | arsenal approval tests plus AgentLoop case | ✅ | ⬜ pending |
| TBD | TBD | 0 | AC-FH-010 | T-26-05 | Blue/White probe denied despite defaultTools | unit | Q1 files | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-011 | T-26-06 | Invalid args, scope, and missing approval still deny | unit | `npx vitest run src/__tests__/arsenal-validation.test.ts src/__tests__/arsenal-scope-gate.test.ts src/__tests__/arsenal-approval-gate.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 0 | AC-FH-012 | T-26-07 | Empty grant denies; parallel roles do not share grants | unit | Q1 files | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-019 | — | Denial does not decompose; retry stays within existing limit | unit | operator test | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-020 | — | Stop is not a cancel ACK; in-flight runs stay interrupted | unit | server snapshot test | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AC-FH-024 | T-26-08 | Poisoned text cannot change the frozen allowlist or set origin | unit | Q1 files | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | NFR-FH-SEC-01 | T-26-04 | Handler counter zero on denial fixtures | unit | same as AC-FH-009 | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | NFR-FH-DATA-01 | T-26-09 | Snapshot and error strings contain no raw secret | unit | `npx vitest run src/__tests__/redact.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 0 | NFR-FH-REL-01 | — | Existing timeout constants unchanged; no second scheduler | static | Q1 pin if added | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Behavioral cases for structured start, artifact bind, role allowlist, empty grant, and unavailable executor in the four Q1 files
- [ ] `src/teams/contracts.ts` created by C1 before tests import it
- [ ] Existing static pins stay true: `resolveGeneralLLMConfig(provider, model, apiKey)` in the mission-start block, and `teamToolGrants` / `hatToolGrants` in `laneToolGrants`

*No framework install.*

---

## Manual-Only Verifications

All phase behaviors have automated verification. Browser proof of the byte adapter is Phase 28, not this phase.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
