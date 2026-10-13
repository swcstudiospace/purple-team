---
phase: "17-black-suite-core"
slug: "black-suite-core"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false)
status: validated
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 17 — Validation Record (Black Suite Core)

> State-B retroactive validation of archived v1.3 Phase 17 (black suite core, 2026-10-10)
> against the frozen v1.3 boundary. Every map row cites a command run green during
> THIS pass (2026-10-12) with its measured output — never a restated v1.3 number.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts']` — probes auto-discovered, zero config change) |
| **Quick run command** | `npx vitest run src/__tests__/black-suite.test.ts src/__tests__/black-routes-static.test.ts src/__tests__/local-api-hardening-static.test.ts src/__tests__/remote-access-guard.test.ts` |
| **Estimated runtime** | ~2 seconds (suites <1s; typecheck ~6s) |

---

## State-B Reconstruction Note

This file is a State-B reconstruction: Phase 17 completed 2026-10-10 and was never
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

| Requirement (v1.3-ROADMAP §Phase 17) | This-pass command (2026-10-12) | Measured output |
|---|---|---|
| P17-C1: Noise budget quantifies detection surface per planned action (numbers, not prose) | `npx vitest run src/__tests__/black-suite.test.ts` | 1 file passed, 12 tests passed, 0 failed (recon-low, rm-rf-high + anti-forensics refusal, determinism, exfil tiers, unknown-channel fallback, unknown-phase throw, empty-plan honesty) |
| P17-C2: Black grants disjoint from blue/white | `npx vitest run src/__tests__/adapter-tools.test.ts src/__tests__/arsenal-count-honesty.test.ts` | 2 files passed, 51 tests passed (47 + 4), 0 failed (disjointness invariant holds; `atomic-red-team` stays blue-only) |
| P17-C3a: Routes behind guards (static) | `npx vitest run src/__tests__/black-routes-static.test.ts` | 1 file passed, 5 tests passed, 0 failed (static route/guard pins green) |
| P17-C3b: vitest + typecheck green | `npm run typecheck` + `npm run lint` | typecheck clean (exit 0); lint 0 errors, 177 warnings (at cap, no net-new) |
| P17-C4 (class probe): unmatched input never scored safe/silent (T-21-04) | `npx vitest run src/__tests__/v13-class-probes.test.ts` | 1 file passed, 6 tests passed, 0 failed (phase-17 block: unmatched action costs 0 with the engine honesty string `unmatched is not safe`) |

*Status: ✅ green (this pass) · ⬜ Manual-Only below*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `GET /api/teams/black/{cover,exfil,noise}` serve live mission-draft data over HTTP behind guards | P17-C3 | No server harness exists by design (`server.ts` is deliberately excluded from vitest coverage and never imported in tests); static pins assert wiring only | Start the server on loopback, seed a mission draft, `GET` all three routes, confirm the JSON matches the draft contents and empty state returns honest zeroed 200s |

---

## Falsifier

This validation would have FAILED if the noise budget had scored an unmatched action
as safe (cost > 0 without the honesty string), if a black grant had collided with
blue/white, or if the static route/guard pins had gone red — i.e. if the phase-17
suites or the phase-17 class-probe block (`src/__tests__/v13-class-probes.test.ts`)
had gone red. A red probe is a finding, never a cue to weaken the engine.

---

## Validation Sign-Off

- [x] Every Phase 17 criterion has a map row whose command, run date, and measured output were produced during this pass
- [x] Manual-Only table is non-empty for the live-HTTP cell
- [x] `nyquist_compliant: false` set honestly (manual cell exists → §5.5 PARTIAL)
- [x] `wave_0_complete: false` — no invented wave-0 history

**Approval:** validated 2026-10-12 (probe commit `7a9bfb9` precedes this docs commit)

---

*Supersessions: see `.planning/milestones/v1.3-phases/SUPERSESSION.md` — this file describes the `4c37232` boundary.*
