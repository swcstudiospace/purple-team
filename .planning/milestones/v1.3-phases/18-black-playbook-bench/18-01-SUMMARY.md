# Summary 18-01: Black playbook & bench

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE

## What changed

- **Playbook:** `src/resources/ai-tradecraft-playbook.ts` — 20 techniques across all 6 black-doctrine tactics (stealth 6, C2 5, recon 3, discovery 3, exfiltration 3, collection 1); `TradecraftTechnique` + named `OpsecRiskLevel` union; `AI_TRADECRAFT_TECHNIQUE_IDS`, `aiTradecraftBriefing()`, `tradecraftTechnique()`. Zero teams imports (circularity avoided); the mirrored test asserts every `attckId` ∈ vendored `ATTACK_BY_ID` (ATT&CK v19.2).
- **Bench:** `scripts/opsec-review-bench.mjs` + `.d.mts` + `bench/opsec-review/` — 10 plan cases / 25 ground-truth groups / 2 benign-admin decoys (backup/renewal/log-rotation text MUST score quiet — the honesty axis against over-flagging); anti-forensics cases MUST flag T1070.*; ground truth authored by probing the real engines (caught three hand-computation traps, now pinned); hunter = real `dist/teams/black` engines; 6 gates, deterministic `report.json`; 5-invariant CI pin test + `black:bench` alias (added by corrective after the bench unit skipped both spec items).
- **Wiring:** MCP `tempest_black_cover` (gateway pins 12→13, `/api/teams/black/cover` in the proxy-path pin); black-specter → cover + noise routes; black-wraith → exfil route with the honest note that exfil paths come from the operator; doctrine quotes, grammar, frontmatter preserved.

## Verification

- `npx tsc --noEmit` clean; targeted vitest 52/52 (playbook, bench pin, gateway, hats, package).
- `node scripts/opsec-review-bench.mjs` exit 0 (6/6, decoys refused); detection-coverage bench still 4/4 — no regression.

## Deferred with reasons

- `docs/MCP_GUIDE.md` tool-table rows for tempest_blue_gaps/tempest_black_cover — doc sync lands with Phase 20 close-out (blue tool was already absent there; parity kept deliberately).
- `dark-purple/SKILL.md` rewiring → Phase 20.
