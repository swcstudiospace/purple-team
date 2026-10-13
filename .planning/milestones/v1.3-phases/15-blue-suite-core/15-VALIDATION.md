---
phase: "15-blue-suite-core"
slug: "blue-suite-core"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false)
status: validated
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 15 — Validation Record (Blue Suite Core)

> State-B retroactive validation of archived v1.3 Phase 15 (blue suite core, 2026-10-10)
> against the frozen v1.3 boundary. Every map row cites a command run green during
> THIS pass (2026-10-12) with its measured output — never a restated v1.3 number.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts']` — probes auto-discovered, zero config change) |
| **Quick run command** | `npx vitest run src/__tests__/adapter-tools.test.ts src/__tests__/arsenal-count-honesty.test.ts src/__tests__/blue-suite.test.ts src/__tests__/blue-routes-static.test.ts` |
| **Estimated runtime** | ~2 seconds (suites <1s; typecheck ~6s) |

---

## State-B Reconstruction Note

This file is a State-B reconstruction: Phase 15 completed 2026-10-10 and was never
seeded with wave-0 validation history, so `wave_0_complete` stays `false` and no
wave-0 history is invented here.

Boundary receipt: `git diff --stat 4c37232..HEAD -- src scripts package.json docs Dockerfile`
ran against the unchanged v1.3 boundary logic this pass — the only `src/` addition since
`4c37232` is the test-only `src/__tests__/v13-class-probes.test.ts` (plan-01 commit
`7a9bfb9`, zero modified production files). `nyquist_compliant` is honestly `false`:
the live-HTTP cell below has no automatable command and escalates to Manual-Only, so
per audit-milestone §5.5 this phase re-audits as PARTIAL.

---

## Per-Task Verification Map

| Requirement (v1.3-ROADMAP §Phase 15) | This-pass command (2026-10-12) | Measured output |
|---|---|---|
| P15-C1: `detection` adapters honest; every granted id resolves | `npx vitest run src/__tests__/adapter-tools.test.ts src/__tests__/arsenal-count-honesty.test.ts` | 2 files passed, 51 tests passed (47 adapter-tools + 4 count-honesty), 0 failed (grant ⊆ catalog invariant, count pins honest) |
| P15-C2a: Blue coverage keyed to D3FEND ids; Sigma rule packs deterministic | `npx vitest run src/__tests__/blue-suite.test.ts` | 1 file passed, 9 tests passed, 0 failed (deterministic YAML + fields, no rule for keyless/covered, coverage-tier contract) |
| P15-C2b: Blue routes wired to `sigmaRulepack(` + `coverageGaps(` (static) | `npx vitest run src/__tests__/blue-routes-static.test.ts` | 1 file passed, 5 tests passed, 0 failed (route wiring pins green) |
| P15-C3: Loopback unchanged; new routes honor origin/bearer guards | `npx vitest run src/__tests__/local-api-hardening-static.test.ts src/__tests__/remote-access-guard.test.ts` | 2 files passed, 19 tests passed (12 hardening + 7 guard), 0 failed |
| P15-C4: vitest + typecheck green; static pins current | `npm run typecheck` + `npm run lint` | typecheck clean (exit 0); lint 0 errors, 177 warnings (at cap, no net-new) |
| P15-C5 (class probe): lookalike/id-prefix D3FEND keys never silently count as coverage (T-21-04) | `npx vitest run src/__tests__/v13-class-probes.test.ts` | 1 file passed, 6 tests passed, 0 failed (phase-15 block: `'D3-P'` lands in `unresolvedCountermeasures`, coverage math uses resolved ids only, "reported, not used" suffix appended) |

*Status: ✅ green (this pass) · ⬜ Manual-Only below*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `GET /api/teams/blue/rules` returns valid Sigma YAML per uncovered gap over live HTTP | P15-C2 | No server harness exists by design (`server.ts` is deliberately excluded from vitest coverage and never imported in tests); static pins assert wiring only | Start the server on loopback, seed a findings ledger with uncovered D3FEND gaps, `GET /api/teams/blue/rules`, confirm the response is valid Sigma YAML keyed to the gap ids |
| `GET /api/teams/blue/gaps` and `/hardening` serve live ledger data over HTTP with bearer/origin guards enforced | P15-C2/C3 | Live HTTP + guard behavior has no harness; building one is new test infrastructure (out of scope) | Start the server on loopback and once on a non-loopback bind, confirm loopback serves ledger data and non-loopback refuses without a bearer |

---

## Fixture Re-Justification (record 1: coverage tiers)

- **Incident:** during Phase 15 verification a `blue-suite` fixture assumed uncovered-with-telemetry ≠ partial; it was corrected during verification to the documented contract "uncovered-with-telemetry = partial; 'none' requires empty telemetry" (15-01-SUMMARY §Tests).
- **Correction:** the fixture was corrected toward the documented engine contract, not away from it.
- **Legitimacy:** oracle corrected toward engine reality — contract-first, pin-guarded.
- **Guarding pins today:** `blue-suite.test.ts:42-49` (empty telemetry → 'none'; deployed-but-uncovering → 'partial') and `:60-68` (keyless fallback says so). This pass re-ran `blue-suite.test.ts` green (9/9), confirming the pins still guard the contract.
- **Verdict:** legitimate oracle correction — pin-guarded. Bench corpus (`bench/**`) frozen this pass: re-run, never re-bent.

---

## Falsifier

This validation would have FAILED if any granted detection id had failed to resolve
in the catalog, if a lookalike D3FEND key had been silently counted as coverage, or
if `sigmaRulepack(` wiring pins had gone red — i.e. if the phase-15 suites or the
phase-15 class-probe block (`src/__tests__/v13-class-probes.test.ts`) had gone red.
A red probe is a finding, never a cue to weaken the engine.

---

## Validation Sign-Off

- [x] Every Phase 15 criterion has a map row whose command, run date, and measured output were produced during this pass
- [x] Manual-Only table is non-empty for the live-HTTP cells
- [x] Fixture re-justification names the coverage-tiers incident and its guarding pins
- [x] `nyquist_compliant: false` set honestly (manual cells exist → §5.5 PARTIAL)
- [x] `wave_0_complete: false` — no invented wave-0 history

**Approval:** validated 2026-10-12 (probe commit `7a9bfb9` precedes this docs commit)

---

*Supersessions: see `.planning/milestones/v1.3-phases/SUPERSESSION.md` — this file describes the `4c37232` boundary.*
