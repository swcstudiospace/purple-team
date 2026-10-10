# Summary 19-01: White suite

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE

## What changed

- **Catalog:** `ToolCategory` += `governance`; import_only data-pack adapters `nist-800-115`, `ptes`, `osstmm`; `WHITE_TOOLS` += all three (disjoint by construction). Count pins 117 → 120 (README, verify-claims, arsenal-count-honesty headline + 15-entry gated-set enumeration, ASCII-sorted by computation).
- **White v2 (`src/teams/white/`):** `roe-parser.ts` — line grammar (scope/allow-active directives, bullet continuation, closed yes/no token table); every line lands resolved or unresolved with a reason; conflicting allowActive and empty scope → `ok:false`, never guessed. `evidence-chain.ts` — platform ruling reused from v1 `adjudicateEvidence` plus a replay-hook layer (replayable-without-hook → broken with repair conditions; duplicate ids → broken). `report-auditor.ts` — bidirectional findings↔evidence coverage, dangling ids, unclaimed ledger entries, completeness math. `white.ts` byte-stable.
- **Engine bug caught by the bench:** `parseRoe` never assigned `roe.allowedTargets` — v1 `roeAudit` saw an empty scope and ruled every target in-scope (silently permissive). Fixed (specTargets collected + assigned post-walk), reconciled across two peers, pinned by the bench.
- **Playbook:** `src/resources/ai-adjudication-playbook.ts` — 18 techniques, 6 per framework (NIST 800-115 / PTES / OSSTMM), certain top-level anchors only; framework membership asserted against the catalog in the test.
- **Bench:** `scripts/roe-adjudication-bench.mjs` trio — 12 missions / 25 ground-truth groups / 2 decoys across parse/adjudication/chain/report axes (incl. the suffix-vs-lookalike class: subdomain-of-allowed must pass, `evil.io` lookalikes must violate, approval-does-not-expand-scope); 6 gates, deterministic report; `white:bench` alias + 6-test CI pin.
- **Routes + wiring:** `GET /api/teams/white/{roe,evidence,report-audit}` (read-only over ledgers; honest finding: no server state carries ROE text yet, so the roe route reports `no ROE text on record` and v1 roeAudit verdicts arrive when a real text source lands); MCP `tempest_white_roe` (gateway pins 13→14); white-arbiter/white-auditor skills on the real routes with honest relay rules (ok:false is not a clean bill; empty links is not clean evidence).

## Verification

- `npx tsc --noEmit` clean; targeted vitest 146 → 24/24 after one fixture fix (a test assumed command-embedded targets were scope-judged; v1 roeAudit reads `action.target` only — fixture now carries the target explicitly).
- All three color benches green: roe 6/6, opsec 6/6, detection 4/4. `verify-claims` CLAIM 4: 120 tools (84 + 36).

## Deferred with reasons

- ROE text source: server state has no ROE field — verdicts-on-record arrive with a real text source (documented in route + skills; not fabricated).
- `dark-purple/SKILL.md` rewiring + MCP_GUIDE tool-table sync → Phase 20 close-out.
