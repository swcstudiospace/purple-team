# Phase 26: Runtime Authority, Bound Inputs and Retained Execution - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning
**Mode:** Auto-resolved (approved brief closed open clarifications; grey areas already decided)

<domain>
## Phase Boundary

Operators can submit scoped, role-authorized mission and task inputs, receive immutable origin-bound identities, and retrieve retained real outcomes while existing Red starts and execution remain usable.

This phase owns the Red inventory, exact four-discipline identity, bound request and queue identity, authoritative permission failures, bounded inline artifact binding, claimed-versus-observed receipts, and finite attributed lifecycle. It does not deliver Blue, Black, or White substantive engines (Phase 27), UI/MCP/skill consumers (Phase 28), or milestone acceptance (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Already decided — do not re-open
- REQUIREMENTS.md §8: no open product clarifications. The approved brief and settled templates answer role, parity, and handoff questions.
- Owner approved the full 26→29 roadmap and the scoped controller repair. Approval is not product acceptance.
- No fifth hat. Purple is synthesis only. Specialists stay inside their parent: specter/wraith black, sentinel/warden blue, arbiter/auditor white.
- Preserve Red contracts, providers, settings, themes, tokens, history, and untracked `coverage-pr/`. No new persistence platform, dependency, or deployment.
- Complexity is functional depth, not equal component counts. Black stays analysis-only. No destructive concealment, unapproved probes, or live bulk exfiltration.
- v1.4 audit debt and v2 ROE-ledger items stay deferred. Do not add them to this phase.

### Role identity and legacy Red
- Only Red, Blue, Black, and White are product disciplines. All 17 roles map to those four, with Purple excluded from spawnable operators.
- Omitted `roleInputs` / `family` / `targetContext` on `POST /api/mission/start` keeps the existing target-based Red start, including empty-operator and duplicate-skip behavior. A start with no targets still fails as it does today.
- A structured launch requires an objective and nonempty known unique roles. Unknown or duplicate explicit roles fail actionably before start. Do not globally reject empty operators.
- Blue AI/agent families route to defensive analysis. A family label never grants an offensive tool.
- A hat executor that is not registered yet reports unavailable. It must not return a fake completion.

### Authority
- Direct, model-requested, batched, and backend-seeded forbidden, invalid, out-of-scope, or unapproved operations fail before the handler, with zero effects.
- Per-run grants stay isolated. Empty or unknown grants grant nothing. Poisoned input cannot change authority, switch roles, leak secrets, or promote a hypothesis to verified evidence.
- Approval does not expand scope or role rights. Hiding a schema is not a denial.

### Bound inputs and receipts
- Extend the existing mission-start and task-dispatch contract with a bounded selected inline artifact. Do not add a fetch-any-URI or command-ingest path. Do not treat a summary as bytes.
- The server computes the hash. Mission creation and artifact binding are atomic. Caller-supplied IDs, summaries, and labels alone are not evidence.
- Public, legacy, and imported source/tool/system/type/strength labels stay claimed unless a private server path writes an observed receipt after real computation, tied to run, mission, stage, tool, input hash, and item id.
- Do not upgrade historical labels. Do not add a public receipt-minting endpoint.
- Current code does not yet implement this contract: `POST /api/mission/start` still requires at least one target and has no inline artifact field. `roleInputs` is absent. Plan against that fact, not against the aspirational STATE note.

### Lifecycle
- Progress, failure, partial output, deadline expiry, late results, and restart-retained results keep the original hat, specialist, task, mission, and input attribution.
- Use existing finite execution and retry policies. Do not add a new scheduler.
- Unsupported cancellation is stated honestly. A scheduler stop or transport abort is not an acknowledged cancel or resume.
- Valid completed evidence survives interruption. Retry must not repeat a completed side effect without existing idempotency or renewed approval.

### Controller prerequisite
- FH-EXEC-4 is not mounted in this host. `swarm_amend` exists in `/root/src/repos/agent-swarm-amend` and is not a tool in this session. `ULTRATHINK_SWARM_ROOT` is unset.
- Do not run `orch_amend.py`, invent a signature, re-lease DONE tasks, or claim the controller amendment closed.
- Phase 26 product work proceeds on the purple-team repo. Controller DAG amendment is not a substitute for the product acceptance criteria, and product code must not pretend the amendment is mounted.

### Claude's Discretion
- Exact byte cap, media/encoding enum, and redaction fields, as long as they are bounded, server-validated, and documented in the adopted contract.
- Whether the inline artifact rides on `POST /api/mission/start` or a paired existing dispatch call, provided binding is atomic and the legacy target-only body still works.
- Internal receipt record shape, provided public labels cannot mint observed origin and historical rows are not upgraded.
- Inventory file location for the eight Red workflows, provided every row cites a real source path.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/teams/index.ts` `TEAM_ARCHETYPES` and `teamToolGrants`: black, blue, white. Purple is not spawnable.
- `src/teams/hats.ts` `HAT_ARCHETYPES` and `hatToolGrants`: six specialists, subset of the parent grant.
- `src/server.ts` `VALID_ARCHETYPES` spreads both tables. `GET /api/teams/tool-grants` projects both.
- `src/server.ts` `POST /api/mission/start` is the legacy Red start. It requires targets, accepts operators, and guards each target through `guardAction`.
- Mission drafts already exist at `/api/mission-drafts`. Evidence and findings ledgers already exist. ROE text is a single fail-closed slot from Phase 22.

### Established Patterns
- TypeScript ESM, Express, vitest. Static pins in `src/__tests__/*-integration-static.test.ts` assert source shape. Behavioral tests live beside them.
- Grants must be catalog ids. Hats cannot exceed the parent grant. Black stays disjoint from blue and white active-risk tools.
- Loopback is the trust boundary. Non-loopback binds already require a bearer. Do not widen that surface.

### Integration Points
- C1: `src/types/index.ts`, new `src/teams/contracts.ts`, `src/arsenal/index.ts`, `src/agent/index.ts`, `src/validation/index.ts`.
- C2: `src/index.ts`, `src/mission/index.ts`, `src/operators/index.ts`, `src/teams/index.ts`, `src/teams/hats.ts`.
- C3: `src/server.ts` and `docs/API_REFERENCE.md`, serialized with one integration owner.
- Q1 tests: `src/__tests__/teams-archetypes.test.ts`, `teams-modules.test.ts`, `hats-archetypes.test.ts`, `hats-modules.test.ts`.

</code_context>

<specifics>
## Specific Ideas

No new product questions. Implement the ROADMAP Phase 26 success criteria and AC-FH-001, 003, 005–012, 019, 020, 024 plus NFR-FH-SEC-01, NFR-FH-DATA-01, and NFR-FH-REL-01. The current mission-start body is the compatibility fixture, not the target contract.

</specifics>

<canonical_refs>
## Canonical References

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — signed A02 source and GSD traceability. Phase 26 rows are Pending.
- `.planning/ROADMAP.md` — Phase 26 goal, success criteria, and C1/C2/C3 path boundaries.
- `.planning/PROJECT.md` — core value, exclusions, and locked decisions through v1.4.
- `.planning/STATE.md` — blocker status. FH-INPUT-1 and FH-EVID-2 are partial. FH-COMP-3 is not present in current `POST /api/mission/start`. FH-EXEC-4 is unmounted.

### Proposed contracts, not implementations
- `.planning/v1.5-RUNTIME-CONTRACTS.md` — A03 proposal. Adopt only the parts that match the decisions above. Do not treat “no unresolved decisions” as implemented behavior.
- `.planning/v1.5-UI-CONTRACT.md` — A04 proposal. Phase 26 does not build the UI byte adapter; Phase 28 consumes it.
- `.planning/v1.5-BASELINE.md` — pre-change evidence. Do not rerun it solely to confirm, and do not cite it as post-change acceptance.

</canonical_refs>

<deferred>
## Deferred Ideas

- Blue, Black, and White substantive tools, workflows, prompts, and corpus briefings — Phase 27.
- UI, MCP, and published-skill binding of the same contracts — Phase 28.
- Full parity matrix, browser proof, and milestone closure — Phase 29.
- Color tokens and visual identity — Phase 28, per the 2026-10-15 owner choice.
- v1.4 audit follow-ups and v2 ROE revision history — next milestone.
- Mounting `swarm_amend` in this host — controller prerequisite, not a Phase 26 product file.

</deferred>
