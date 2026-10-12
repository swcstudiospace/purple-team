---
phase: "18-black-playbook-bench"
slug: "black-playbook-bench"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false)
status: validated
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 18 — Validation Record (Black Playbook & Bench)

> State-B retroactive validation of archived v1.3 Phase 18 (black playbook & bench, 2026-10-10)
> against the frozen v1.3 boundary. Every map row cites a command run green during
> THIS pass (2026-10-12) with its measured output — never a restated v1.3 number.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts']` — probes auto-discovered, zero config change) |
| **Bench command** | `npm run build && node scripts/opsec-review-bench.mjs` (deterministic self-test; `dist/`-backed, throws without build) |
| **Estimated runtime** | ~12 seconds (build ~7s; suites ~3s; bench <1s) |

---

## State-B Reconstruction Note

This file is a State-B reconstruction: Phase 18 completed 2026-10-10 and was never
seeded with wave-0 validation history, so `wave_0_complete` stays `false` and no
wave-0 history is invented here.

Boundary receipt: `npm run build` was executed fresh during this pass (2026-10-12)
before the bench invocation, so the bench measured the freshly built `dist/` pipeline —
never a vendored or stale copy. The only `src/` addition since `4c37232` is the
test-only `src/__tests__/v13-class-probes.test.ts` (plan-01 commit `7a9bfb9`, zero
modified production files). `nyquist_compliant` is honestly `false`: the external
relay end-to-end cell below has no automatable command and escalates to Manual-Only,
so per audit-milestone §5.5 this phase re-audits as PARTIAL.

---

## Per-Task Verification Map

| Requirement (v1.3-ROADMAP §Phase 18) | This-pass command (2026-10-12) | Measured output |
|---|---|---|
| P18-C1a: Bench self-test passes; decoy plans penalized | `npm run build && node scripts/opsec-review-bench.mjs` | build clean; all plan cases match ground truth across engines; 2/2 benign-admin decoys refused (quiet); `✅ ALL PASS — 6/6`; deterministic `report.json` emitted |
| P18-C1b: Bench harness pinned (incl. fail-closed without dist) | `npx vitest run src/__tests__/opsec-review-bench.test.ts` | 1 file passed, 5 tests passed, 0 failed (benign decoys never flagged, real pipeline matches ground truth, deterministic) |
| P18-C1c: Tradecraft playbook techniques ATT&CK-keyed | `npx vitest run src/__tests__/ai-tradecraft-playbook.test.ts` | 1 file passed, 11 tests passed, 0 failed (every `attckId` ∈ vendored `ATTACK_BY_ID`) |
| P18-C2: Skills wired without breaking grammar | `npx vitest run src/__tests__/grokbot-hats.test.ts src/__tests__/hats-integration-static.test.ts` | 2 files passed, 20 tests passed (15 + 5), 0 failed |
| P18-C3: MCP registers through loopback/bearer path | `npx vitest run src/__tests__/grokbot-gateway.test.ts` | 1 file passed, 9 tests passed, 0 failed (gateway pins green) |
| P18-C4 (class probe): bench harness fails closed — never measures a vendored/stale copy (T-21-06) | `npx vitest run src/__tests__/v13-class-probes.test.ts` | 1 file passed, 6 tests passed, 0 failed (phase-18 block: dist-guard + `dist/teams/black` import pins green) |

*Status: ✅ green (this pass) · ⬜ Manual-Only below*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end relay: black-specter/black-wraith skills against a live server through the real MCP relay | P18-C3 | External service + live server; no harness exists and building one is new test infrastructure (out of scope) | With relay credentials, exercise both skills against a running server and confirm cover/exfil briefs match the loopback route output |

---

## Falsifier

This validation would have FAILED if the bench had flagged any benign-admin decoy,
if any plan case had mismatched ground truth, if the dist-guard pin had found a
vendored pipeline import, or if any playbook/skill/gateway pin had gone red — i.e.
if the bench, the phase-18 suites, or the phase-18 class-probe block
(`src/__tests__/v13-class-probes.test.ts`) had gone red. A red probe is a finding,
never a cue to weaken the engine. Bench corpus (`bench/opsec-review/**`) shows zero
modifications in this pass: re-run, never re-bent.

---

## Validation Sign-Off

- [x] Bench ran green against a fresh `dist/` built during this pass, with the pass summary recorded above
- [x] Every Phase 18 criterion has a map row whose command, run date, and measured output were produced during this pass
- [x] The external-relay end-to-end cell is a Manual-Only row, never absent
- [x] Bench corpus paths show zero modifications in the commit diffs
- [x] `nyquist_compliant: false` set honestly (manual cell exists → §5.5 PARTIAL)
- [x] `wave_0_complete: false` — no invented wave-0 history

**Approval:** validated 2026-10-12 (probe commit `7a9bfb9` precedes this docs commit)

---

*Supersessions: see `.planning/milestones/v1.3-phases/SUPERSESSION.md` — this file describes the `4c37232` boundary.*
