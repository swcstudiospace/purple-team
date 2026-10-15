# Phase 28: Runtime-connected Four-Hat UI, MCP, Skills and Explicit Synthesis - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning
**Mode:** Auto-resolved from the approved brief

<domain>
## Phase Boundary

Existing static UI, API, MCP, and published skills must call the same Phase 26 and 27 contracts. No new page. No redesign. No public receipt mint.

</domain>

<decisions>
## Implementation Decisions

- Add POST consumers on the existing `/api/teams/*` surface for the staged Blue, Black, and White workflows. GET projections stay read-only.
- A missing artifact, empty Black plan, or empty White allow-list returns the workflow's fail-closed result. It does not become covered, blown, or compliant.
- Do not edit the uncommitted rebrand hunks in `docs/*.html`, `docs/assets/shell.js`, `docs/API_REFERENCE.md`, `docs/MCP_GUIDE.md`, `src/mcp-server.ts`, or `grokbot/skills/**` into a phase commit. Those files are the user's WIP. A phase 28 change there stays unstaged unless it can be committed without the rebrand hunks.
- Color tokens stay deferred.
- FH-EXEC-4 stays unmounted.

### Claude's Discretion
- Route names, as long as they sit under `/api/teams/blue|black|white` and do not replace the existing GET routes.

</decisions>

<code_context>
## Existing Code Insights

- `src/server.ts` already has GET `/api/teams/blue/gaps`, `/api/teams/black/cover`, and `/api/teams/white/roe`. It does not call `runBlueCoverageStage`, `runBlackWorkflow`, or `stageRoeAudit`.
- Those functions are exported from the phase 27 workflow modules and re-exported in part from `src/teams/hats.ts`.

</code_context>

<deferred>
## Deferred Ideas

- Full browser, keyboard, and reduced-motion proof — Phase 29, and blocked here where the HTML files hold uncommitted rebrand edits.
- Publishing skill text that advertises the new exports — same dirty-tree constraint.

</deferred>
