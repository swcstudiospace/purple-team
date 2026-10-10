# Phase 19: White Suite - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (implementation phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

White owns governance and evidence-chain tooling end to end: governance
catalog packs, ROE parser, evidence-chain validator, report auditor,
adjudication playbook, ROE bench, and white routes/skills/MCP.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence:

- Governance packs follow the import_only data-pack precedent (atomic-red-team,
  d3fend): `nist-800-115`, `ptes`, `osstmm` adapters carry framework identity +
  install hints, never executed. WHITE_TOOLS += the three (new ids; disjoint
  from black/blue by construction). Count pins 117 → 120.
- `src/teams/white.ts` export surface stays byte-stable (`roeAudit`,
  `adjudicateEvidence`, `RoeSpec`, `RoeVerdict`, `EvidenceVerdict`,
  `ProvenanceStrength`); v2 modules land in `src/teams/white/`.
- Playbook mirrors the red/defense/tradecraft trio. Framework references use
  only well-known top-level structure (NIST SP 800-115 sections, PTES phases,
  OSSTMM 3.0 modules) — never fabricated subsection numbers.
- Bench mirrors the detection/opsec trio; ground truth derives ONLY from the
  documented v1 roeAudit precedence + the decoy classes: in-scope-suffix
  actions that must PASS, lookalike foreign targets that must FAIL, active-
  with-receipt → needs_approval not violation.
- Wiring mirrors Phases 16/18: tempest_white_roe (gateway pins 13→14),
  white-arbiter → roe route, white-auditor → evidence route, bearer notes.

</decisions>

<code_context>
## Existing Code Insights

- `src/teams/white.ts` v1: `roeAudit(actions, roe)` precedence (out-of-scope
  target → violation; active ∧ ¬allowActive → violation; active ∧ ¬approved →
  needs_approval), suffix/substring scope matching; `adjudicateEvidence`
  strength inference from type.
- Server evidence/finding ledgers exist (evidenceLedger, findingsLedger) —
  routes read them like blue/black do; empty state → zeroed 200s.
- Gateway pins count 13 tempest tools after Phase 18.

</code_context>

<specifics>
## Specific Ideas

- ROE parser reports unresolved lines with reasons instead of guessing —
  adjudication never silently drops operator text.

</specifics>

<deferred>
## Deferred Ideas

- Persistent/rotating tokens, per-seat rate limits — unchanged from v1.2 deferrals.

</deferred>
