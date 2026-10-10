# Phase 17: Black Suite Core - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (implementation phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

Black owns tradecraft-analysis tooling: an `emulation` catalog category,
ATT&CK-keyed black v2 engines (structured noise budget, egress cost model,
phase-keyed OPSEC checklists), and black routes. Blue/white untouched.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence:

- Grants: `BLACK_TOOLS` += `attack-navigator`, `caldera` (new ids — disjoint
  from blue/white by construction). `atomic-red-team` stays blue-only: the
  blue∩black disjointness pin wins over dual-use temptation; black consumes
  ATT&CK/ART knowledge as vendored data, not grants.
- ATT&CK vendor mirrors the D3FEND precedent: fetch the real MITRE CTI data,
  vendor a disclosed trimmed subset (techniques for the tactics black's
  doctrine covers, with detection notes), attribution in file header +
  `THIRD-PARTY.md`. No invented technique ids.
- `hats.ts` black functions (`specterCoverReview`, `wraithExfilSim`) stay
  byte-stable (server/operators import them); v2 engines land in
  `src/teams/black/` submodules.
- Count pins (README, verify-claims CLAIM 4, arsenal-count-honesty) move
  115 → 117 with the adapter wave.

</decisions>

<code_context>
## Existing Code Insights

- Phase 15/16 pattern is proven: catalog+grants unit ∥ pipeline unit, then
  routes+tests unit; benches and CI pins mirror the cloud-bench trio.
- Black routes read server state (planned routes / mission drafts) — the
  routes unit discovers the accessor from the existing pressure-paths/plan
  routes; empty state → honest zeroed 200s.
- Analysis-first: caldera/attack-navigator are data/parsing surfaces, never
  operators of the emulator.

</code_context>

<specifics>
## Specific Ideas

- Noise budget scores are heuristic but deterministic and documented —
  tactic-tier weighting over ATT&CK-matched actions, never prose.

</specifics>

<deferred>
## Deferred Ideas

- Black playbook + opsec-review bench + skill/MCP wiring → Phase 18.

</deferred>
