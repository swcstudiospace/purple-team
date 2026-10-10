# Summary 16-01: Blue playbook & bench

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE

## What changed

- **Playbook:** `src/resources/ai-defense-playbook.ts` — 20 real defense techniques across 7 categories (endpoint 5, network 4, identity 3, cloud 3, supply chain 2, deception 2, hunting 1); `DefenseTechnique` interface; `AI_DEFENSE_TECHNIQUE_IDS`; `aiDefenseBriefing()`; `defenseTechnique(id)` lookup; re-exported from `src/resources/index.ts`; 8-test mirror of the red playbook's invariants.
- **Bench:** `scripts/detection-coverage-bench.mjs` + `bench/detection-coverage/` — corpus of 10 cases / 24 ground-truth expectations / 2 decoys (invented ids must surface as unresolved; real-but-wrong-family ids must stay uncovered); manifest.yaml in the cve-hunt vocabulary (decoy_penalty=5); hunter = the REAL `dist/teams/blue` pipeline (clear build error when missing, never vendored logic); deterministic `--self-test` default; byte-identical `report.json` across runs; 5-invariant CI pin test + `.d.mts` shim + `blue:bench` alias (mirrors the cloud-bench trio). Self-test: 4/4 gates, 24/24 verdicts matched, 2/2 decoys refused.
- **Wiring:** MCP `tempest_blue_gaps` (tempestGet proxy, no child processes; gateway pins 11→12 with `/api/teams/blue/gaps` added); `blue-sentinel`/`blue-warden` skills rewired to the real routes with v1.2 bearer notes; doctrine quotes, grammar, and frontmatter preserved.

## Verification

- `npx tsc --noEmit` clean; targeted vitest 37/37 (playbook, bench pin, gateway, hats).
- `node scripts/detection-coverage-bench.mjs` exit 0, ALL PASS 4/4, tree stays clean on re-run.

## Deferred with reasons

- `dark-purple/SKILL.md` still dispatches hat operators — rewiring it needs all-color routes; lands with Phase 20 (purple surface).
- Live-server bench mode: unimplementable until blue routes accept case inputs; documented in the script header/manifest instead of a fake flag.
