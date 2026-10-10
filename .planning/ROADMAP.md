# Roadmap: v1.3 — Color Team Suites at Red Parity

Research: `.planning/v1.3-RESEARCH-color-suites.md` (measured gap analysis +
tool verification, 2026-10-10). Milestones v1.0–v1.2 archived in
`.planning/milestones/`. Continuous phase numbering per GSD convention.

## Overview

The black/blue/white teams are doctrine, not suites: zero own adapters
(grant slices of red families), heuristic-only pipelines, no playbooks,
benches, or color routes — and `purple.synthesize()` matches verdicts to
findings positionally. This milestone gives each color the four things red
has — own catalog adapters, a techniques playbook, a corpus+judge bench,
real routes/skills/MCP — plus the purple correlation fix and a Defend UI
surface. Analysis-first posture: blue validates detections, black reviews
tradecraft, white adjudicates; nothing operates live estates.

## Phases

- [ ] **Phase 15: Blue Suite Core** - `detection` catalog category + adapters, `src/teams/blue/` v2 pipeline (telemetry registry, D3FEND-keyed coverage, Sigma rule packs), blue routes + grants
- [ ] **Phase 16: Blue Playbook & Bench** - `ai-defense-playbook.ts`, `detection-coverage-bench` corpus harness, blue-sentinel/warden skill backends + MCP `tempest_blue_gaps`
- [ ] **Phase 17: Black Suite Core** - `emulation` catalog category + adapters, black v2 modules (noise budget, exfil cost model, opsec engine), black routes + grants
- [ ] **Phase 18: Black Playbook & Bench** - black playbook (ATT&CK-keyed), `opsec-review-bench` corpus harness, black-specter/wraith skill backends + MCP `tempest_black_cover`
- [ ] **Phase 19: White Suite** - `governance` data packs, white v2 modules (ROE parser, evidence-chain validator, report auditor), ROE bench, white routes/skills/MCP
- [ ] **Phase 20: Purple v2 & Defend UI** - id-keyed synthesis + residual-risk model, persisted color artifacts, Defend UI page, full gates & close-out

## Phase Details

### Phase 15: Blue Suite Core
**Goal**: Blue owns detection-grade tooling: technique-keyed coverage scoring and Sigma rule-pack generation backed by a real catalog category, exposed over routes.
**Depends on**: v1.2 (grant invariant, server conventions, bearer guard covers new /api routes)
**Requirements**: `ToolCategory` += `detection`; adapters `sigma` (sigma-cli, receipt_required), `atomic-red-team` (import_only data pack), `osquery` (catalog_only), `velociraptor` (catalog_only), `suricata` (catalog_only), `d3fend` (import_only ontology pack); `BLUE_TOOLS` += new ids (read/inspect tiers only); `src/teams/blue/` submodules — telemetry source registry, coverage scorer keyed by D3FEND technique ids (replaces the severity→text table), Sigma YAML rule-pack generator per `DetectionGap`; routes `GET /api/teams/blue/{gaps,hardening,rules}`; tests
**Success Criteria** (what must be TRUE):
  1. `detection` adapters exist in `TOOL_ADAPTERS` with honest `execution`/`risk`; every granted id resolves (existing catalog invariant holds)
  2. `GET /api/teams/blue/rules` returns valid Sigma YAML per uncovered gap, keyed to D3FEND ids — not prose recommendations
  3. Loopback behavior of existing routes unchanged; new routes honor origin/bearer guards
  4. vitest + typecheck green; static pins updated where they reference teams/blue

### Phase 16: Blue Playbook & Bench
**Goal**: Blue gains red-parity knowledge and verification surfaces.
**Depends on**: Phase 15
**Requirements**: `src/resources/ai-defense-playbook.ts` (interface `{ id, category, telemetry, signal, validation }`, 15–20 techniques + briefing helper); `scripts/detection-coverage-bench.mjs` + `bench/detection-coverage/` (labeled finding/telemetry pairs, ground-truth gaps, decoys, `manifest.yaml`, deterministic `--self-test` default, JSON report, judge+gates mirroring `cloud-misconfig-bench`); grokbot `blue-sentinel`/`blue-warden` skills call the real routes (bearer note per v1.2); MCP `tempest_blue_gaps` + `skills/index.json` row
**Success Criteria** (what must be TRUE):
  1. Bench self-test passes with decoy penalties active; report JSON emitted
  2. Playbook techniques brief into operator context via the existing resources pattern
  3. Skills grammar files stay intact (GRAMMAR.md rules); index rows paired with SKILL.md
  4. MCP tool registers, proxies via the tempest loopback/bearer path, no child processes

### Phase 17: Black Suite Core
**Goal**: Black owns tradecraft-analysis tooling: emulation catalog data, structured noise budget, egress path cost model.
**Depends on**: Phase 15 (catalog/grant pattern proven)
**Requirements**: `ToolCategory` += `emulation`; adapters `attack-navigator` (import_only layer data), `caldera` (catalog_only, emulation-plan parsing); `BLACK_TOOLS` += new ids keeping strict disjointness from blue/white; `src/teams/black/` — `specterCoverReview` v2 with structured per-action noise budget, `wraithExfilSim` v2 with egress path cost model, phase-keyed OPSEC checklist engine; routes `GET /api/teams/black/{cover,exfil,noise}`; tests
**Success Criteria** (what must be TRUE):
  1. Noise budget quantifies detection surface per planned action (numbers, not prose)
  2. Black grants remain disjoint from blue/white (existing invariant test stays green)
  3. Routes live behind the existing guards; vitest + typecheck green

### Phase 18: Black Playbook & Bench
**Goal**: Black gains playbook + verification parity.
**Depends on**: Phase 17
**Requirements**: black playbook (`{ id, attckId, opsecRisk, detectionSurface, tradecraftUse }`); `scripts/opsec-review-bench.mjs` + `bench/opsec-review/` (red plans with ground-truth opsec flags + decoy plans, same harness pattern); grokbot `black-specter`/`black-wraith` skill backends; MCP `tempest_black_cover` + index row
**Success Criteria** (what must be TRUE):
  1. Bench self-test passes; decoy plans penalized
  2. Skills wired to real routes without breaking the shared grammar
  3. MCP tool registers through the loopback/bearer path

### Phase 19: White Suite
**Goal**: White owns governance and evidence-chain tooling end to end.
**Depends on**: Phase 15 (pattern), v1.2 receipt ledger
**Requirements**: `ToolCategory` += `governance`; data packs as `import_only`/`catalog_only` entries — NIST SP 800-115, PTES, OSSTMM section catalogs; `src/teams/white/` — ROE parser (operator text → structured `RoeSpec`), evidence-chain validator over the existing receipt ledger, report auditor (findings↔evidence coverage); white playbook (`{ id, framework, control, adjudicationRule, evidenceStandard }`); `scripts/roe-adjudication-bench.mjs` + corpus (action/ROE pairs with ground-truth verdicts); routes `GET /api/teams/white/{roe,evidence,report-audit}`; `WHITE_TOOLS` += ids; wire `white-arbiter`/`white-auditor`; MCP `tempest_white_roe`
**Success Criteria** (what must be TRUE):
  1. ROE parser produces structured `RoeSpec` from prose with honest parse-failure reporting
  2. Evidence-chain validator consumes the real receipt ledger, not mock data
  3. ROE bench self-test passes; routes/skills/MCP live; vitest + typecheck green

### Phase 20: Purple v2 & Defend UI
**Goal**: The synthesis loop becomes id-keyed and the color suites get a surface.
**Depends on**: Phases 15–19
**Requirements**: `purple.synthesize()` correlates by `findingId` (remove positional verdict matching); residual risk = f(severity, detection coverage, ROE verdict); color artifacts persist through the existing ledger/persistence machinery; `docs/defend.html` — white/red token page surfacing the blue/black/white route data (shell.js nav entry, mobile viewport, reduced-motion rules); full gates (lint, typecheck, `npm test`, doctor, `prompt:audit`); planning final
**Success Criteria** (what must be TRUE):
  1. A test pins id-keyed correlation — shuffled verdict order still joins correctly
  2. Defend page renders the gap matrix from live routes; pins/tests updated
  3. All gates green; ROADMAP/STATE reflect completion

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Blue Suite Core | 0/0 | Not Started | — |
| 16. Blue Playbook & Bench | 0/0 | Not Started | — |
| 17. Black Suite Core | 0/0 | Not Started | — |
| 18. Black Playbook & Bench | 0/0 | Not Started | — |
| 19. White Suite | 0/0 | Not Started | — |
| 20. Purple v2 & Defend UI | 0/0 | Not Started | — |
