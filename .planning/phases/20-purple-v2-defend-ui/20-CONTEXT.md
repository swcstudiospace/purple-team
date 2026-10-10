# Phase 20: Purple v2 & Defend UI - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (implementation phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

The synthesis loop becomes id-keyed with a residual-risk model, color
artifacts persist, the color suites get a Defend UI surface, the dark-purple
skill rewires onto the real routes, and the milestone closes with full gates.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence:

- `purple.ts` keeps the `synthesize` export and `DarkPurpleSynthesis` type
  (server + tests import them). The v2 sin to kill: verdict *i* ↔ finding *i*
  positional matching. v2 accepts an optional `verdictsByFinding` id-keyed map;
  legacy positional input still works but the output declares
  `correlation: 'positional-fallback'` honestly. Residual risk =
  documented deterministic f(severity, detection coverage, verdict).
- Synthesis results persist through the existing state-snapshot machinery
  (the same replaceMapContents/persistState path the ledgers use).
- Defend page follows the white/red token system (docs/IA.md conventions,
  shared shell.js nav, mobile viewport, reduced-motion) and surfaces the GET
  color routes; static asset pins (tauri-scaffold it.each list) must be
  extended, never weakened.
- dark-purple SKILL.md keeps the loop composition but walks the real color
  routes (blue gaps, black cover, white roe) with bearer notes; MCP_GUIDE
  gains rows for the three new tempest tools.

</decisions>

<code_context>
## Existing Code Insights

- Nine color/synthesis routes now live: blue gaps/hardening/rules, black
  cover/exfil/noise, white roe/evidence/report-audit, purple synthesize (v1).
- Static pins that move with a new docs page: tauri-scaffold bundled-asset
  list; any IA/nav pins found by grep.
- Gateway pins count 14 tempest tools (no new tools this phase).

</code_context>

<specifics>
## Specific Ideas

- The Defend page renders the gap matrix from live routes with honest empty
  states — same discipline as the routes themselves.

</specifics>

<deferred>
## Deferred Ideas

- Live verdicts-on-record for white (needs a ROE text source in state) — documented, not fabricated.

</deferred>
