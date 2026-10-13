# Phase 23: One Risk Signal - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

`residualRisk` prose and `riskTier` collapse into one deterministic signal — prose becomes a pure derived rendering of the tier, making tier/prose contradiction structurally impossible without changing the API response shape. Deliverables: single pure tier→prose derivation in `src/teams/purple.ts`; every consumer updated in the same commit (`docs/operators.html` renders the tier, `docs/API_REFERENCE.md` documents tier + marks prose derived, dark-purple SKILL.md relays both, `teams-modules.test.ts` pins strengthened to prose↔tier agreement); `dist/` rebuilt/docsite regenerated same-commit; supersession entry for the phase-20 purple surface; API response shape unchanged.

</domain>

<decisions>
## Implementation Decisions

### Owner-decided direction (locked at research/roadmap time)
- **Option (a) — prose DERIVED from riskTier.** Dropping the prose field (option b) rejected: sanctioned API contract change, violates PROJECT.md "existing `/api/*` routes keep their contracts". The violation-branch contradiction (tier floors `high` while prose reads "low residual risk") becomes structurally impossible.
- **Template keys STRICTLY on the tier** (owner-conservative default, recorded in research SUMMARY) — guarantees prose↔tier agreement by construction; no hidden inputs.
- **Exactly one prose writer** — a pure function in `src/teams/purple.ts`; the old severity-word composition (RISK_BY_SEVERITY path) is removed, not parallel-kept.
- **Touches only `PurpleRiskTier`** (`src/teams/purple.ts`); the unrelated arsenal approval-gate `RiskTier` vocabulary (`types/index.ts`) is NOT touched; the two names are documented side-by-side in API_REFERENCE (rename only with contract sanction — not this milestone).

### Locked constraints (binding)
- API response shape unchanged: existing consumers keep parsing without edits (pinned).
- Pins evolve same-commit, never weaken: `teams-modules.test.ts` pins strengthened to assert prose↔tier agreement across the whole tier table (not re-snapshotted verbatim prose); `purple-v2.test.ts` tier pins untouched.
- `dist/` rebuilt + docsite regenerated in the same commit as the derivation (committed-copy staleness is the PITFALLS §2 class).
- Supersession entry for the phase-20 purple surface, same commit.
- Running lint count in gate receipts, no net-new warnings vs 177; 0 errors.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Deterministic tier table: `src/teams/purple.ts:59-92` — `riskTier = f(severity, detection, verdict)` already computed first; prose currently composed from `riskWord(severity)` only (RISK_BY_SEVERITY) — the divergence root cause (ARCHITECTURE §2)
- Consumer map (exhaustive, from research): `docs/operators.html:266`, `docs/API_REFERENCE.md:285-286`, dark-purple SKILL.md:109, `teams-modules.test.ts` pins (:252-255), `purple-v2.test.ts` tier pins; defend.html + MCP proxy have NO field coupling
- Committed `dist/` + build-time docsite mirror — regenerated, never hand-edited

### Established Patterns
- Pure single-writer derivation functions in teams modules; parity pins across a full value table (white-suite pin style)

### Integration Points
- `src/teams/purple.ts` — the only production source change
- `docs/API_REFERENCE.md` — sequenced AFTER Phase 22's white row edit (no overlap; one-directional docs pass)
- Supersession log — phase-20 entry
- `dist/` rebuild + docsite regeneration (build pipeline, same commit)

</code_context>

<specifics>
## Specific Ideas

- Parity pin: iterate the ENTIRE tier vocabulary, assert prose(tier) is the exact template string for that tier — a divergence can no longer compile-and-pass
- Research inputs: `.planning/research/SUMMARY.md` §Phase 3, `ARCHITECTURE.md` §2 (divergence + consumer table), `PITFALLS.md` §2 (stale mirrors)

</specifics>

<deferred>
## Deferred Ideas

- Renaming `PurpleRiskTier` (contract sanction required — documented side-by-side instead)
- Tier+inputs-keyed prose templates (rejected: strictly-tier guarantees agreement by construction)

</deferred>
