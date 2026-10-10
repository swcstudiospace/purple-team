# Phase 16: Blue Playbook & Bench - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (implementation phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

Blue gains red-parity knowledge and verification surfaces: a defense
playbook briefable into operator context, a corpus+judge bench that scores
the real blue pipeline, and the skill/MCP wiring that puts the Phase 15
routes in operators' hands.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence:

- Playbook mirrors `src/resources/ai-redteam-playbook.ts` structure and is
  re-exported through `src/resources/index.ts` the same way.
- Bench mirrors `scripts/cloud-misconfig-bench.mjs` harness discipline:
  deterministic `--self-test` default, corpus + ground truth + decoys with
  penalties, JSON report. Hunter = the REAL pipeline (`src/teams/blue/*`)
  via the built `dist/` output — never a vendored copy of the logic.
- MCP tool rides the existing `tempestGet`/bearer/loopback-guard path —
  no child processes (pinned by grokbot-gateway tests).
- Skill edits preserve `skills/GRAMMAR.md` rules and section order.

</decisions>

<code_context>
## Existing Code Insights

- Phase 15 landed `coverageGaps`, `sigmaRulepack`, `registryTelemetry`, and
  `GET /api/teams/blue/{gaps,hardening,rules}` (read-only, ledger-sourced).
- `grokbot/skills/{blue-sentinel,blue-warden}/SKILL.md` currently show generic
  curl examples; `skills/index.json` pairs rows with SKILL.md files.
- `src/__tests__/grokbot-gateway.test.ts` pins MCP proxy paths/behaviors —
  additive tools must satisfy the existing invariants.

</code_context>

<specifics>
## Specific Ideas

- Bench ground truth: per-case expected coverage verdicts + decoy findings
  with wrong countermeasure keys that must NOT score as covered.

</specifics>

<deferred>
## Deferred Ideas

- Live-server bench mode against a running instance — record as flag, self-test is the default and the gated path.

</deferred>
