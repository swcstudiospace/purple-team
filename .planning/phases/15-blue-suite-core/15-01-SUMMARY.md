# Summary 15-01: Blue suite core

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE

## What changed

- **Catalog:** `ToolCategory` += `detection`; six adapters — `sigma` (sigma-cli, receipt_required), `atomic-red-team` + `d3fend` (import_only data packs), `osquery`/`velociraptor`/`suricata` (catalog_only). `BLUE_TOOLS` += sigma, atomic-red-team, osquery, suricata, d3fend (velociraptor cataloged, not granted). Grant-header rationale updated; disjointness from black/white intact. Count pins moved 109 → 115 (README capability row, verify-claims CLAIM 4 label, arsenal-count-honesty headline).
- **Pipeline (`src/teams/blue/`):** full D3FEND ontology v1.6.0 vendored (271 terms, verbatim CSV, TOU attribution in file header + `THIRD-PARTY.md`); `telemetry.ts` registry (12 sources, coveredIds = D3FEND ids, module-load validation against the ontology); `coverage.ts` `coverageGaps()` — D3FEND-keyed covered/partial/none with unresolved-id surfacing and v1 finding-id fallback; `rulepacks.ts` `sigmaRulepack()` — deterministic uuidv5 ids, experimental status, d3fend.* tags, pyyaml-validated required fields. `blue.ts` export surface byte-stable.
- **Routes:** `GET /api/teams/blue/{gaps,hardening,rules}` read-only over the findings ledger; `redactSecrets()` at read time; empty ledger → honest zeroed 200s. Documented in `docs/API_REFERENCE.md`.
- **Tests:** `blue-suite.test.ts` (9) + `blue-routes-static.test.ts` (5). One fixture corrected during verification to match the documented contract (uncovered-with-telemetry = partial; none requires empty telemetry).

## Verification

- `npx tsc --noEmit` clean.
- Targeted vitest: 115 + 14 passed across blue-suite, blue-routes-static, arsenal-count-honesty, adapter-tools, teams/hats, local-api-hardening.
- `node scripts/verify-claims.mjs` CLAIM 4: 115 tools (79 adapters + 36 built-in) — re-derived, not hardcoded.

## Not in this phase

- Playbook, detection-coverage bench, skill/MCP wiring → Phase 16.
- sigma `ARG_TEMPLATE` in `adapter-tools.ts` deferred — sigma is classified OPERATOR_DRIVEN in the invocation-honesty guard, which keeps that invariant green.
