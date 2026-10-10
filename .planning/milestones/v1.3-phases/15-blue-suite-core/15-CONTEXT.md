# Phase 15: Blue Suite Core - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (implementation phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

Blue owns detection-grade tooling: a `detection` catalog category with honest
adapters, a D3FEND-keyed coverage pipeline, Sigma rule-pack generation, and
blue routes. Black/white surfaces are untouched.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence:

- Catalog/grant invariant: `teamToolGrants` ids must exist in `TOOL_ADAPTERS`;
  catalog entries and grant rows land in the same commit. `BLUE_TOOLS` gains
  read/inspect-tier ids only (sigma, osquery, suricata, d3fend,
  atomic-red-team); black/white grants untouched (disjointness pinned).
- `src/teams/blue.ts` export names/signatures stay stable — purple.ts,
  hats.ts, server.ts, and tests import them. New pipeline lives in
  `src/teams/blue/` submodules.
- D3FEND mapping vendors the real ontology (d3fend.mitre.org CSV) — no
  invented technique ids; fetch failure blocks that file, never fabricates.
- Routes follow the existing guard chain (origin/Host/bearer already cover
  `/api/*` from v1.2); read-only GETs.

</decisions>

<code_context>
## Existing Code Insights

- `src/arsenal/catalog.ts`: `ToolCategory` union (line 3), `ToolAdapter`
  interface (line 29), derived `SAFE_COMMANDS`/`NETWORK_COMMANDS` (1227/1235)
  update automatically from `execution`/`networked` fields.
- `src/teams/index.ts`: grant tables + documented rationale header to extend.
- Existing tests pin grant contents/disjointness and the blue module surface —
  update pins to include new ids without weakening invariants.

</code_context>

<specifics>
## Specific Ideas

- Rule packs: deterministic Sigma UUID (uuidv5 from findingId), experimental
  status, honest template selections from finding fields.

</specifics>

<deferred>
## Deferred Ideas

- Bench + playbook + skill/MCP wiring → Phase 16 (this phase is pipeline + routes only).

</deferred>
