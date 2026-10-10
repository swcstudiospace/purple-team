# Phase 18: Black Playbook & Bench - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (implementation phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

Black gains playbook + verification parity: an ATT&CK-keyed tradecraft
playbook, an opsec-review bench scoring the real black engines, and the
skill/MCP wiring that puts the Phase 17 routes in operators' hands.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence:

- Playbook mirrors the red/defense playbook structure (interface, id list,
  briefing helper, mirrored test). `attckId` values must resolve against the
  vendored `ATTACK_BY_ID` — asserted in the TEST, never via a cross-module
  import (teams already imports resources; a resources→teams import would be
  circular).
- Bench mirrors the detection-coverage trio exactly: harness + `.d.mts` shim
  + corpus with ground truth and decoys + CI-pin test + `package.json`
  alias. Hunter = real `dist/teams/black` engines. Decoys = plans that LOOK
  aggressive but are benign admin work (must not flag) plus anti-forensics
  cases that MUST flag with T1070.* violations.
- Wiring mirrors Phase 16: MCP tool rides tempestGet; skills keep grammar,
  frontmatter, and doctrine quotes; gateway pins extended (12 → 13).

</decisions>

<code_context>
## Existing Code Insights

- Phase 17 landed `structuredNoiseBudget`, `exfilCostModel`,
  `opsecChecklist`/`opsecReview`, `GET /api/teams/black/{cover,exfil,noise}`.
- `src/teams/black/attack-data.ts` vendors ATT&CK v19.2 (61 techniques,
  Stealth-tactic shape) — the playbook's attckId universe.
- Gateway pins currently count 12 tempest tools including tempest_blue_gaps.

</code_context>

<specifics>
## Specific Ideas

- Benign-admin decoys double as an honesty guard: a bench that flags
  routine ops work is over-noting, and the decoy axis catches exactly that.

</specifics>

<deferred>
## Deferred Ideas

- `dark-purple/SKILL.md` rewiring → Phase 20 (needs white routes too).

</deferred>
