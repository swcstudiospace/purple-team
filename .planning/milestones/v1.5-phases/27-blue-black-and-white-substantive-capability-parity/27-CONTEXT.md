# Phase 27: Blue, Black and White Substantive Capability Parity - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning
**Mode:** Auto-resolved from the approved brief and existing doctrine

<domain>
## Phase Boundary

Operators obtain substantive, genuinely computed Blue, Black, and White outcomes from registered permitted tools, staged workflows, and loaded role, domain, and corpus guidance. Cosmetic prompt length and unused registrations do not count.

This phase does not bind HTTP, MCP, or published-skill consumers (Phase 28) and does not close the parity matrix (Phase 29). It consumes the Phase 26 authority, artifact, and receipt contracts. It does not mount `swarm_amend`.

</domain>

<decisions>
## Implementation Decisions

### Already decided
- Functional depth, not equal tool counts. Do not copy Red tools into the other hats.
- Black stays analysis-only. No destructive concealment, unapproved probing, or live bulk exfiltration. The 2026-10-15 grant revert stands: do not hand Black active scanners to match Red's count.
- White stays a neutral referee. Fail closed on missing ROE or approval. Do not score incomplete evidence as sufficient or 100.
- Blue validates detections and controls offline. It does not operate EDR, SIEM, or live remediation.
- Purple is not a fifth hat.
- Missing Sigma replay, YARA, or another validator stays explicit with a next action. Do not stub a passing result.
- One optional dependency failure must leave Red and the other hats usable.
- Imported plans, frameworks, and dangerous corpus examples stay untrusted data.
- Q1 White remit and Q2 Black remit, left open in the earlier rebrand note, are closed by this doctrine: do not widen either hat into active offense. Record that as the decision, not as a new question.

### Delivery shape
- B1, K1, W1, and P1 are file-disjoint and may be planned as parallel waves after the Phase 26 interfaces.
- One integration plan then registers and loads the real exports. Hat plans must not edit `src/server.ts`, `src/mcp-server.ts`, `src/prompts/index.ts`, or `src/teams/purple.ts`.
- Q2 tests live in the existing blue, black, white, and purple suite files. Extend them. Do not delete wording pins by emptying a behavior check.

### Claude's Discretion
- Internal stage names and receipt field order, provided each stage cites the bound artifact or plan item and writes an observed receipt only after real computation.
- How much prompt text is added, provided each parent and specialist loads dedicated role, workflow, and domain guidance that names its real tools and limits. Length alone is not the acceptance test.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/teams/blue.ts`, `src/teams/blue/coverage.ts`, `src/teams/blue/rulepacks.ts`
- `src/teams/black/exfil.ts`, `noise.ts`, `checklist.ts`
- `src/teams/white.ts`, `evidence-chain.ts`, `report-auditor.ts`, `roe-parser.ts`
- `src/resources/ai-defense-playbook.ts`, `ai-tradecraft-playbook.ts`, `ai-adjudication-playbook.ts`
- Phase 26 contracts and the private receipt writer. Use them. Do not add a public mint route.

### Established Patterns
- Grants come from `teamToolGrants` and `hatToolGrants`. A new tool id must exist in the catalog and stay inside the parent grant.
- Suites already exist: `src/__tests__/blue-suite.test.ts`, `black-suite.test.ts`, `white-suite.test.ts`.

### Integration Points
- B1: `src/teams/blue/workflow.ts` (new), `src/teams/blue.ts`, `src/teams/blue/coverage.ts`, `src/teams/blue/rulepacks.ts`, `src/prompts/blue.ts` (new)
- K1: `src/teams/black/workflow.ts` (new), `src/teams/black/exfil.ts`, `src/teams/black/noise.ts`, `src/teams/black/checklist.ts`, `src/prompts/black.ts` (new)
- W1: `src/teams/white/workflow.ts` (new), `src/teams/white.ts`, `src/teams/white/evidence-chain.ts`, `src/teams/white/report-auditor.ts`, `src/prompts/white.ts` (new)
- P1: the three playbook files
- I1, after the hat exports: `src/arsenal/adapter-tools.ts`, `src/prompts/index.ts`, `src/teams/purple.ts`, `src/mcp-server.ts`

</code_context>

<specifics>
## Specific Ideas

Cover AC-FH-013 through AC-FH-016, AC-FH-018, AC-FH-021 through AC-FH-036, and NFR-FH-AVAIL-01. HTTP and MCP forwarding of those results is Phase 28 even if a function is exported now.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 27 success criteria and the B1/K1/W1/P1/I1 table
- `.planning/REQUIREMENTS.md` US-FH-04 through US-FH-09
- `.planning/phases/26-runtime-authority-bound-inputs-and-retained-execution/26-CONTEXT.md` — authority and receipt boundary
- `.planning/PROJECT.md` — analysis-first doctrine and exclusions

</canonical_refs>

<deferred>
## Deferred Ideas

- UI, MCP, and published-skill population — Phase 28
- Full parity matrix and milestone closure — Phase 29
- Mounting `swarm_amend` — still a host gap, not a Phase 27 file
- Color tokens — Phase 28

</deferred>
