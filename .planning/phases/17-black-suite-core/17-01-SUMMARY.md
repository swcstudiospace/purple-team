# Summary 17-01: Black suite core

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE

## What changed

- **Catalog:** `ToolCategory` += `emulation`; adapters `attack-navigator` (import_only layer/STIX data) and `caldera` (catalog_only, plan parsing — platform never operated). `BLACK_TOOLS` += both (new ids; disjointness by construction). Count pins 115 → 117 (README, verify-claims label, arsenal-count-honesty headline + gated-set enumeration). `atomic-red-team` stays blue-only: the disjointness pin wins over dual-use temptation.
- **Engines (`src/teams/black/`):** ATT&CK Enterprise **v19.2** subset vendored (61 techniques across the 6 black-doctrine tactics — upstream renamed Defense Evasion → Stealth and moved detection prose into detection-strategy/analytic STIX objects; vendor follows upstream shape with disclosed trim rules, ToU in header + `THIRD-PARTY.md`). `structuredNoiseBudget()` — tactic-tier weighting over a 43-entry vocabulary, anti-forensics (T1070.*) refusal violations, per-action ledger; `exfilCostModel()` — 13 channel profiles mapped to vendored exfil/C2 techniques, volume/cleartext factors, feasibility tiers; `opsecChecklist()`/`opsecReview()` — 23 stable-id items keyed to vendored tactics, unknown phases throw.
- **Routes:** `GET /api/teams/black/{cover,exfil,noise}` — read-only over the most recent mission draft (accessor mirrors the blue pattern; no second plan store invented); exfil route costs zero paths honestly (drafts carry no channel/volume data); redacted envelopes; empty state → zeroed 200s. Documented in `docs/API_REFERENCE.md`.
- **Tests:** `black-suite.test.ts` (12: vendor integrity — every engine-emitted id resolves in ATTACK_BY_ID; noise determinism + anti-forensics refusal; exfil tier math; checklist stability/throws) + `black-routes-static.test.ts` (5).

## Verification

- `npx tsc --noEmit` clean; targeted vitest 132/132 across black/catalog/teams/hats/local-api suites.
- `verify-claims` CLAIM 4: 117 tools (81 adapters + 36 built-in), re-derived.
- One pin literal corrected during verification: the gated-set expectation mis-sorted `atomic-red-team`/`attack-navigator` by eye (ASCII sort is atomic- first).

## Deferred with reasons

- Playbook, opsec-review bench, skill/MCP wiring → Phase 18. Cross-check: `wraithExfilSim`/`specterCoverReview` in hats.ts remain the operator-facing v1 functions (byte-stable); engines complement, not replace.
