---
phase: "19-white-suite"
slug: "white-suite"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false)
status: validated
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 19 — Validation Record (White Suite)

> State-B retroactive validation of archived v1.3 Phase 19 (white suite, 2026-10-10)
> against the frozen v1.3 boundary. Every map row cites a command run green during
> THIS pass (2026-10-12) with its measured output — never a restated v1.3 number.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts']` — probe auto-discovered, zero config change) |
| **Quick run command** | `npx vitest run src/__tests__/white-suite.test.ts src/__tests__/white-routes-static.test.ts src/__tests__/roe-adjudication-bench.test.ts` |
| **Bench command** | `npm run build && node scripts/roe-adjudication-bench.mjs` (deterministic self-test; `dist/`-backed, throws without build) |
| **Estimated runtime** | ~8 seconds (suites <1s; build + bench ~7s) |

---

## State-B Reconstruction Note

This file is a State-B reconstruction: Phase 19 completed 2026-10-10 and was never
seeded with wave-0 validation history, so `wave_0_complete` stays `false` and no
wave-0 history is invented here.

Boundary receipt: `git diff --stat 4c37232..HEAD -- src scripts package.json docs Dockerfile`
ran empty at pre-flight (HEAD `59c6f48`, 2026-10-12) — evidence gathered this pass
describes the v1.3 boundary exactly (`4c37232` = HEAD at milestone start). Post-flight
the same diff shows exactly one new path, `src/__tests__/v13-class-probes.test.ts`
(test-only addition, zero modified production files). `nyquist_compliant` is honestly
`false`: the live-ledger and live-HTTP cells below have no automatable command and
escalate to Manual-Only, so per audit-milestone §5.5 this phase re-audits as PARTIAL.

---

## Per-Task Verification Map

| Requirement (v1.3-ROADMAP §Phase 19) | This-pass command (2026-10-12) | Measured output |
|---|---|---|
| P19-C1: ROE parser produces structured `RoeSpec` from prose with honest parse-failure reporting | `npx vitest run src/__tests__/white-suite.test.ts src/__tests__/white-routes-static.test.ts src/__tests__/roe-adjudication-bench.test.ts` | 3 files passed, 30 tests passed, 0 failed (covers per-line accounting, conflict withholds-ok, every-unhonored-line-reported, empty/comment-only honesty) |
| P19-C2: Evidence-chain validator consumes the real receipt ledger, not mock data | same suite run as P19-C1 (chain semantics in `white-suite.test.ts`; read-only ledger-route pins in `white-routes-static.test.ts:52-58`) | 3 files passed, 30 tests passed, 0 failed (replay-hook, duplicate-id, provenance, empty-ledger-zeroed) |
| P19-C3a: ROE bench self-test passes | `npm run build && node scripts/roe-adjudication-bench.mjs` | build clean; `adjudication: 25/25 engine outputs match ground truth (100.0%)`; `discrimination: 2/2 benign decoys left all-green`; `✅ ALL PASS — 6/6` |
| P19-C3b: routes/skills/MCP live (static) + vitest + typecheck green | `npx vitest run src/__tests__/roe-adjudication-bench.test.ts src/__tests__/white-routes-static.test.ts` (subset of the P19-C1 run) + `npm run lint` | pin suites green within the 30/30 run; honesty pin "no ROE text on record" green; lint 0 errors, 177 warnings (cap, no net-new) |
| P19-C3c (class probe): empty-spec ROE audit never green-lights active work (T-21-01) | `npx vitest run src/__tests__/v13-class-probes.test.ts` | 1 file passed, 6 tests passed, 0 failed (flagship: mixed set yields `needs_approval`, `{allowActive:false}` binds approved work to `violation`, `parseRoe('')` refuses with `ok:false`) |

*Status: ✅ green (this pass) · ⬜ Manual-Only below*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `GET /api/teams/white/evidence` and `/report-audit` serve the live receipt ledger over HTTP | P19-C2 | No server harness exists by design (`server.ts` is deliberately excluded from vitest coverage and never imported in tests); static pins assert read-only ledger wiring only | Start the server on loopback, seed a mission ledger with replayable + dangling entries, `GET` both routes, confirm the JSON matches the ledger contents byte-for-byte |
| `GET /api/teams/white/roe` returns verdicts-on-record once a real ROE text source lands | P19-C2/C3 | No ROE text source exists in server state (deferred to the ROE-01 phase); the route honestly reports `no ROE text on record` | After ROE-01 lands, load ROE text, hit the route, confirm verdicts cite the loaded text |
| End-to-end white adjudication over live HTTP (routes + skills + MCP relay) | P19-C3 | Live e2e has no harness; building one is new test infrastructure (out of scope) | Exercise the white-arbiter/white-auditor skills against a running server and confirm `ok:false` is never presented as a clean bill |

---

## Fixture Re-Justification (record 2: target extraction)

- **Incident:** during Phase 19 verification a `white-suite` fixture assumed command-embedded targets were scope-judged; v1 `roeAudit` reads `action.target` only, so the fixture encoded behavior the engine never had.
- **Correction:** the fixture was corrected to carry the target explicitly (19-01-SUMMARY §Verification: "146 → 24/24 after one fixture fix").
- **Legitimacy:** oracle corrected toward engine reality, not away from it — contract-first, pin-guarded.
- **Guarding pins today:** `white-suite.test.ts` ("hands parseRoe output straight to roeAudit and rules per action") plus the ROE bench's suffix-vs-lookalike class cases (subdomain-of-allowed passes, `evil.io` lookalikes violate, approval-does-not-expand-scope).
- **Verdict:** legitimate oracle correction — pin-guarded. Bench corpus (`bench/**`) frozen this pass: re-run, never re-bent.

---

## Falsifier

This validation would have FAILED if `roeAudit` had returned any `compliant` verdict
for unapproved active work against an empty spec, if `{allowActive:false}` had not
bound approved active work to `violation`, or if `parseRoe('')` had parsed — i.e. if
the flagship class probe (`src/__tests__/v13-class-probes.test.ts`, phase-19 block)
had gone red. A red probe is a finding, never a cue to weaken the engine.

---

## Validation Sign-Off

- [x] Every Phase 19 criterion has a map row whose command, run date, and measured output were produced during this pass
- [x] Manual-Only table is non-empty for the live-ledger and live-HTTP cells
- [x] Fixture re-justification names the target-extraction incident and its guarding pins
- [x] `nyquist_compliant: false` set honestly (manual cells exist → §5.5 PARTIAL)
- [x] `wave_0_complete: false` — no invented wave-0 history

**Approval:** validated 2026-10-12 (probe commit `7a9bfb9` precedes this docs commit)

---

*Supersessions: see `.planning/milestones/v1.3-phases/SUPERSESSION.md` — this file describes the `4c37232` boundary.*
