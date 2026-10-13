# Phase 22: ROE Text as Server State - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

An operator can put ROE text on record in server state, and `GET /api/teams/white/roe` emits deterministic, provenance-stamped verdicts derived only from that text — failing closed when it is absent or corrupt. Deliverables: sanctioned ROE store slot in `src/server.ts` (+ snapshot/restore), one new `/api/*` mutation route (early-mounted bearer guard covers it; 64 KiB body cap), GET returning parse + verdicts when and only when `parseRoe` is `ok:true`, provenance on every verdict (ROE revision/text hash, `parseRoe` line refs), `redactSecrets` on every emission, honesty pins rewritten same-commit, bench text→parse→verdict case, docs/skills/MCP sync, supersession entry for phase 19.

</domain>

<decisions>
## Implementation Decisions

### Grey areas resolved (owner-accepted, 2026-10-12)
- **Action source**: actions to adjudicate are stored WITH the ROE record — the mutation stores `{ text, actions, revision }` as one record; verdicts are computed on read over the stored actions. White stays self-contained; NO mission-module coupling (mission-drafts-as-actions was unproven research inference).
- **Verdict persistence**: computed on read. No verdict ledger slot in this milestone (deferred to v2 with revision history).
- **Mutation route**: `PUT /api/teams/white/roe` — replace-latest semantics mirroring the `purpleSyntheses` `'latest'` slot. The static pin is REWRITTEN sharper: forbids POST on the path AND requires revision identity in the stored record.
- **Body cap**: 64 KiB on the mutation route body.

### Locked doctrine (from REQUIREMENTS + research, binding)
- ROE text is untrusted DATA: deterministic `parseRoe` is the ONLY scope-setter; if ROE text is ever surfaced to referee LLMs it is delimited, labeled data-only — never instructions.
- Missing or corrupt stored ROE fails closed to cannot-derive — never empty-spec-continue (the allowedTargets bug class). Class pin `roeAudit(actions, {})` never all-compliant stays green or sharper.
- `ok:false` never yields verdicts; every verdict carries full `RoeVerdict` shape + provenance (ROE revision/text hash, `parseRoe` line refs).
- `redactSecrets` on every emission (route responses, logs); text stored as-given, redacted at read — divergence from write-time ledger redaction documented.
- New route mounts under `/api/*` so the early-mounted bearer guard + rate limit cover it on non-loopback (explicit non-loopback test).
- Pins evolve same-commit, never weaken: `white-routes-static.test.ts` honesty pins ("no ROE store" / "no ROE text on record") are inverted to equally sharp positive pins.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Pure engines (unchanged): `parseRoe` (`src/teams/white/roe-parser.ts:215`, `ok = resolved>0 && unresolved===0`), `roeAudit` (`src/teams/white.ts:40`, `ACTIVE_PATTERN`, needs_approval/violation semantics)
- Server-state slot pattern: `src/server.ts` state block (Maps ~`:898-904`), `purpleSyntheses` single-slot precedent, snapshot slot (~`:1181-1187`), `replaceMapContents` restore (~`:1252-1258`), debounced `persistState` (redactSecrets-wrapped `state.json`), `flushPersist` on shutdown
- Guard: `src/net/remote-access.ts` bearer guard mounts early over `/api/*`; zero new security code expected
- Evidence spine: white suite + static pins (`src/__tests__/white-suite.test.ts`, `white-routes-static.test.ts`), roe-adjudication bench (`scripts/roe-adjudication-bench.mjs` + its pin test), local-api-hardening/remote-access suites

### Established Patterns
- Single-slot latest-record stores with snapshot/restore (purpleSyntheses)
- Static-pin tests asserting route surface + honesty claims
- Deterministic benches importing real `dist/`

### Integration Points
- `src/server.ts` (state + routes) — the only production module this phase modifies
- `docs/API_REFERENCE.md` — white roe row rewritten (Phase 23 edits the purple section AFTER this phase — sequence, no overlap)
- `docs/operators.html` + white-arbiter / dark-purple SKILL.md + MCP proxy tool descriptions — honesty surfaces updated in lockstep
- Supersession log: append phase-19 entry (this phase mutates a validated surface)
- Phase-23 forward-dependency: none (white ↔ purple independent; shared docs file sequenced)

</code_context>

<specifics>
## Specific Ideas

- Body cap 64 KiB via the existing express json limit pattern
- Revision identity: monotonic integer or content hash stored per record; GET surfaces it; provenance stamps bind verdicts to it
- Research inputs: `.planning/research/SUMMARY.md` §Phase 2, `ARCHITECTURE.md` §1 (verified integration points), `PITFALLS.md` §3 (ROE attack surface), `FEATURES.md` §ROE-01 (OPA decision-log shape at local scale)

</specifics>

<deferred>
## Deferred Ideas

- Persisted verdict ledger slot (v2 differentiator)
- ROE revision history/listing endpoint (v2)
- Purple auto-consumption of recorded verdicts (v2)
- Text provenance fields (who/when/source) beyond revision identity (v2)

</deferred>
