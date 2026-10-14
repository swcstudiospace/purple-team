# Requirements: T3MP3ST — v1.5 Four-Hat Runtime Parity

**Defined:** 2026-10-14
**Core Value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence.
**Source:** Actual signed A02 deliverable `T1b29-req`, correlation `1b299db3-62f2-4a31-a133-5bb01be01615`, attempt2. The requirements task was ingested to DONE; no product acceptance is implied.
**Approval basis:** Existing full-v1.5 approval in PROJECT.md and preserved controller brief; conditional role/parity questions resolved by those decisions and existing role templates.
**Implementation status:** All 64 criteria and eight NFRs pending. Parent baseline `npm run test:pr` passed:1125 tests/102files, typecheck clean, lint0errors/176warnings, doctorPASS30/35 (5warnings). No four-hat completion claim.

# T1b29-req — v1.5 Four-Hat Runtime Parity

## Artifact identity and status

- Artifact types: `requirements.spec`, `user.stories`, `acceptance.criteria`, and their traceability matrix, combined in this single owned artifact.
- Task: `T1b29-req`; correlation: `1b299db3-62f2-4a31-a133-5bb01be01615`; capability: `req.spec`; author: A02.
- Revision: 1, canonical full-brief refresh. Requirement identifiers below are stable for subsequent revisions of this artifact; they do not renumber historical milestone requirements.
- State: **IN_REVIEW**, not VALIDATED, APPROVED, DONE, or a product-acceptance verdict.
- Authority: the supplied signed A01 assignment (`msg_id` `01a13927-7f8d-7ebd-a5a9-3090534bbaf6`) and the complete persisted approved brief. The task-store record was read and reports the same task/correlation/capability, attempt 2, IN_PROGRESS. This specialist did not run cryptographic signature verification or write a task transition; no such verification is claimed.
- The envelope's empty `inputs` and `acceptance` arrays do not erase the explicit approved brief and objective supplied by the authenticated parent. Those complete sources define the requirements below.
- Publication destination was explicitly allocated by the parent: `local://T1b29-req-requirements.md`. No product files, `.planning` files, repository history, task store, or gate records are written by this task.
- **Checks performed: none.** All tests, builds, lint, formatters, smoke, requirements linters, and gates are intentionally skipped under the current assignment. Both Python and Bun `req_lint` twins are unexecuted, not passed or tool-missing. This is a requirements handoff for parent-owned validation.

## 1. Authoritative inputs and source evidence

### 1.1 Complete authority, in precedence order

1. `.swarm/plans/1b299db3-62f2-4a31-a133-5bb01be01615.json`, complete `.brief`, including mandatory deliverables, detailed gap list, GSD governance, execution ownership, and verification commands. Original tracking references remain graph `ut-mv693l8r-3e8d7703` and issues **SPE-10689 through SPE-10696**.
2. `/root/.omp/agent/ultrathink/sessions/01a1390e-850e-71fb-a6f7-440beb98f8bc.xml`, complete objective, constraints, capability model, UI, security, graceful degradation, acceptance, and completion sections. Its embedded generated graph also lists SPE-12329–SPE-12396; those are supporting source references, not replacements for the original issue lineage.
3. `.planning/PROJECT.md`, especially current v1.5 goal, settled decisions, constraints, and explicitly deferred v2 debt. This is read-only evidence here, not an A02-owned planning contract.
4. `grokbot/templates/RED.md`, `BLUE.md`, `BLACK.md`, `WHITE.md` for established role semantics, and the six existing specialist skill documents for established workflow intent.
5. Runtime role/authority sources read or searched: `src/operators/index.ts`, `src/index.ts`, `src/agent/index.ts`, `src/arsenal/index.ts`, `src/teams/index.ts`, `src/teams/hats.ts`, `src/teams/white.ts`, `src/teams/purple.ts`, `src/server.ts`, `src/mcp-server.ts`, `src/prompts/index.ts`, `src/resources/index.ts`, and `package.json`.
6. Agent role/manifest: `/root/src/repos/agent-swarm/03-agents/A02-requirements.md`, `/root/src/repos/agent-swarm/agents.json` A02 entry, and `skill://a02-requirements`.

The XML's conditional questions about undefined Black/White roles, numerical parity, and handoffs are resolved by the newer approved brief and settled project/template evidence. They must not reopen those decisions or substitute the XML's hypothetical independent-risk-assessment Black role for established tradecraft/OPSEC analysis.

### 1.2 Evidence classification

- **Read source evidence:** original eight role profiles and default toolkits; six specialist-to-team identities; team/catalog grant declarations; AgentLoop schema selection and execution call boundary; Arsenal scope/approval/argument/redaction guards; original-only mission start whitelist; Purple ID versus positional correlation and risk-tier derivation; White substring scope matching; Specter empty-plan scoring and Wraith string-only egress flag; six published specialist skill instructions and their global-read call patterns; package scripts.
- **Approved-brief-reported gaps:** missing dedicated workflow/domain prompt depth, missing corpus briefing fields, incomplete Sigma/YARA contracts, UI roster/Dispatch deficiencies, and remaining catalog/runtime availability gaps are requirements inputs. They have not all been independently traced end-to-end by this specialist.
- **Not observed here:** successful runtime execution, baseline test results, complete tool/skill/prompt totals, browser rendering, accessibility results, dependency availability, authenticated gate verdicts, or completed parity. None is claimed.

## 2. Product scope, definitions, and non-goals

### 2.1 Goal

Extend the existing T3MP3ST product into four selectable, operational disciplines with comparable **functional breadth, workflow and recovery depth, contract quality, evidence strength, role-specific prompts, configuration, UI completeness, and demonstrated behavior**. Preserve Red as the compatibility/regression reference. Tool, skill, prompt, or file counts are descriptive inventories only, never a parity score or completion substitute.

### 2.2 Settled roles and permitted boundaries

| Discipline | Existing role and required outcome | Existing specialists | Boundary |
|---|---|---|---|
| Red | Existing authorized recon, scanning, exploitation, infiltration, exfiltration, ghost, coordination, and analysis/reporting behavior; verified findings with evidence and remediation | Original eight archetypes: `recon`, `scanner`, `exploiter`, `infiltrator`, `exfiltrator`, `ghost`, `coordinator`, `analyst` | Preserve existing scope, approvals, tool constraints, contracts, and PLINIAN doctrine; no new destructive permission follows from a legacy capability label |
| Blue | Inspect supplied artifacts and telemetry, identify coverage gaps, validate detectors, evaluate hardening and retest evidence | `sentinel`, `warden`; parent `blue` | Analysis/read/inspection and permitted local validation only; no offensive probing, live EDR/SIEM operation, or applying remediation to targets |
| Black | Analyze proposed tradecraft, OPSEC/noise/cover, ATT&CK mapping and synthetic exfiltration/route feasibility with explicit assumptions | `specter`, `wraith`; parent `black` | Analysis-only tradecraft and modeled exfiltration; existing narrowly permitted, scoped route-verification probes only under their existing authority; no bulk exfiltration, stealth escalation, evidence concealment, or destructive anti-forensics |
| White | Neutral ROE/scope review, provenance/evidence sufficiency, opposed-claim adjudication, conditions and appeal/retest criteria | `arbiter`, `auditor`; parent `white` | Read/inspect/adjudicate; neither offensive execution nor remediation; neither team's narrative grants authority |

Purple remains the **existing orchestrator-level synthesis**, not a spawnable fifth hat. Existing explicit synthesis/handoffs retain identity and authorization; no new autonomous cross-hat execution or context-sharing platform is authorized.

### 2.3 Explicit exclusions and preservation

No fifth hat; count padding; renamed Red copies; unused registrations presented as capabilities; no-op or stub workflows; fake fallbacks; new collaboration/memory framework; product-wide redesign; unrelated pages; deployment/infrastructure; broad migration; external operations; approval bypass; replacement signing material; destructive repository commands; resets, rebases, force pushes, or loss of original history/untracked `coverage-pr/`. The approved brief's starting branch/history information is preservation input, not a freshly measured git state.

Unrelated historical v1.4 audit/lint/ops debt and deferred v2 items remain deferred. In particular, this milestone does not silently commit persisted verdict history, ROE revision-history expansion, automatic Purple verdict consumption, broad ROE provenance expansion, package install/launch work, or a new lint-budget system. Required current-run ROE stamps, explicit correlated synthesis, and evidence-bound workflows must work without claiming those unrelated projects are completed.

## 3. Red reference inventory and parity definition

### 3.1 Source-linked reference inventory

| Reference dimension | Existing source evidence | Required parity meaning |
|---|---|---|
| Role/tool breadth | `src/operators/index.ts:75-162` `ARCHETYPE_PROFILES`: recon discovery; scanner validation; exploiter impact; infiltrator expansion; exfiltrator collection; ghost persistence/evasion labels; coordinator orchestration; analyst reporting | Map the purpose and engineering depth of each supported Red capability to a justified Blue/Black/White equivalent, not the same offensive action |
| Runtime toolkits | `src/operators/index.ts` `defaultTools` and categories; `src/index.ts:1259-1271` constructs role-scoped `AgentLoop`; `src/teams/index.ts` `teamToolGrants`; `src/teams/hats.ts` `hatToolGrants` | Distinguish executable built-in tool names, external catalog IDs, profile exposure, specialist grants, and actual runtime authority; a displayed adapter is not an execution grant |
| Execution lifecycle | `src/index.ts` dispatch calls `OperatorAgent.assignTask`; `src/operators/index.ts` `OperatorAgent`; `src/agent/index.ts` `AgentLoop.run` / `executeTool` | Real assigned objective, mission/target binding, progress, terminal result, bounded execution and honest interruption/recovery, not just spawn |
| Authoritative checks | `src/arsenal/index.ts:370-444` `Arsenal.execute`, `scopeViolation`, approval gate, argument validation, secret redaction | Enforce equivalent boundaries plus actual role authorization before handler invocation, including a model-requested tool not in its offered schema |
| Prompts/resources | `src/prompts/index.ts` `PLINIAN_OPERATOR_DOCTRINE`, `OPERATOR_SYSTEM_PROMPTS`, `WORKFLOW_PROMPTS`, `SPECIALIZED_PROMPTS`, prompt rubric; `src/resources/index.ts` resource packs/runbooks/prompt packs | Dedicated role, workflow, and domain guidance loaded into real execution, with uncertainty/evidence and trust boundaries |
| Published workflows | `grokbot/templates/RED.md`; `grokbot/skills/*/SKILL.md`, `GRAMMAR.md` | Reachable staged workflows, parsed inputs actually consumed, prerequisite branches, receipts and retest/completion semantics |
| UI/mission/API | `src/server.ts:6848-6936` start flow, team routes; approved UI manifest under `docs/`; `src/mcp-server.ts` Purple interface | Selection/configuration/dispatch/results reachable through actual UI, API, MCP, and skill contracts with originating-hat attribution |
| Evidence and regression | Existing findings/evidence/retest ledgers described in approved brief/project; `src/teams/purple.ts` and `white.ts`; existing suite test files discovered below | Traceable source/input/tool/validation/result/closure evidence and genuine parent-run checks, not static-count or wording pins alone |

Representative **source trace, not an exercised runtime proof**: mission start validates scope/approval and builds the command (`src/server.ts:6848-6874`), adds targets and spawns allowed roles (`6876-6904`), then calls `cmd.start()` (`6919-6920`). Dispatch calls `operator.assignTask(task, target)` (`src/index.ts:1080`); role setup gives `AgentLoop` the profile's `defaultTools` (`1259-1271`). `AgentLoop.run` obtains filtered definitions and constructs role/task messages (`src/agent/index.ts:144-171`); `executeTool` calls shared `Arsenal.execute` (`424-437`), whose scope, approval, validation, and redaction checks run before/around the handler (`src/arsenal/index.ts:385-444`). The observed missing requested-tool role check must be closed without breaking existing Red dispatch semantics. Full UI-to-ledger trace and final baseline inventories remain required product evidence, not a claim this requirements task executed them.

### 3.2 Required parity matrix and representative equivalents

Every substantive Red baseline capability must have three target-hat mapping rows or a documented role-based asymmetry, with source and acceptance evidence. These representative mappings set coverage expectations without prescribing architecture or inventing tools:

| Red reference purpose | Blue equivalent | Black equivalent | White equivalent |
|---|---|---|---|
| Recon/assets and scope context | Telemetry and artifact inventory with declared coverage/prerequisites | Supplied-plan exposure/route assumptions and footprint inventory | Authorized target/action inventory and ROE interpretation |
| Scan and validate an observation | Detector/rule validation against supplied positive and negative evidence | Noise, cover, feasibility and route-evidence analysis of a supplied plan | Evidence chain, provenance and scope/approval validation |
| Prove impact with evidence | Show a detector's observed match/miss or a control's evidence-backed effectiveness; no target exploit | Explain modeled exposure and synthetic exfil path costs/limits; no real exfiltration | Determine whether the claim is supported, insufficient, disputed or ROE-violating |
| Multi-stage task orchestration | Sentinel and Warden staged assessment/validation/retest | Specter plan review and Wraith modeled route analysis | Arbiter opposed-claim review and Auditor evidence/retest review |
| Analysis/reporting and closure | Prioritized gaps, detector/hardening artifacts, replay/retest receipts | Per-action/path evidence ledger, assumptions and revised-plan reassessment | Reasoned ruling, unmet conditions, appeal evidence and reassessment |
| Domain-specific workflows | Supported domains including AI/agent telemetry and boundary defenses | Existing supported tradecraft domains and ATT&CK/plan import as data | Existing supported governance/adjudication domains and imported frameworks as data |
| Operational recovery/UI | Same honest lifecycle, mission identity, usable controls and preserved partial evidence | Same, without converting analysis into execution | Same, without converting a verdict into an execution approval |

For each row the delivery matrix must contain: stable baseline capability ID and exact source/symbol; target hat and specialist/equivalent; real tool names plus catalog IDs where relevant; separately counted executable tools, reachable skills, loaded prompts and unique implementations; registration/loading/call path; input/output/error/evidence contract; prerequisites and unavailable behavior; permissions/approval/side-effect boundary; workflow stages/branches/retest and completion; prompt specificity; configuration; UI/API/MCP/skill entry; partial/cancel/timeout/retry behavior; implementation evidence; exact test/check evidence and outcome; asymmetry or remaining gap and its explicit acceptance if material. Counts and source inventories must be measured by the implementation/verification owner, not fabricated here. A missing/unavailable item cannot silently count as a completed operational equivalent.

## 4. Requirements backlog and acceptance criteria

All sixteen stories below are **MUST** for approved v1.5 scope. Each is a distinct operator outcome, independently acceptance-checkable against its listed boundaries, valuable without numerical parity, estimable by its owning implementation slice, and bounded by the existing product rather than a new platform. A01 owns task sizing/dependency ordering; A03 owns solution design. The acceptance checks describe observable behavior, not an architectural prescription.

Unless noted otherwise, each criterion is `automated: true`: it has a deterministic contract, fixture, boundary, or browser oracle suitable for an automated check. That classification is **not a claim that a test exists or has run**. AC-FH-054 additionally requires parent-recorded visual observation. All criteria require real execution paths where they make runtime claims; mocks/static source assertions alone are insufficient.

### US-FH-01 — Evidence-based baseline and substantive parity

As an operator, I need an evidence-linked comparison to Red so I can distinguish usable role depth from cosmetic parity.

- [ ] **AC-FH-001** — **Given** the current Red implementation and approved four-hat definitions, **when** the delivery baseline is recorded, **then** all supported original eight role workflows, their tools/skills/prompts, loading/permissions/dependencies, contracts, configuration/persistence, lifecycle/recovery, UI entry points and existing checks are inventoried with exact sources; unavailable and unverified items are labeled. **Check:** baseline-inventory coverage against supported Red entry points.
- [ ] **AC-FH-002** — **Given** that baseline, **when** parity is evaluated, **then** every substantive Red capability has a Blue, Black and White equivalent or a documented role-based asymmetry, and every row includes the fields in §3.2 with separate tool/skill/prompt counts; duplicate files, unused tools and renamed prompt text do not establish parity. **Check:** traceability/matrix completeness and real capability receipts.
- [ ] **AC-FH-003** — **Given** the settled project/template doctrine, **when** roles are presented or instantiated, **then** only Red, Blue, Black and White are product disciplines; all six specialists retain their parent discipline and stated boundaries; Purple is synthesis rather than a spawnable fifth hat. **Check:** role discovery, spawn rejection and specialist-parent contracts.
- [ ] **AC-FH-004** — **Given** any material parity gap or unsupported dependency, **when** completion is assessed, **then** it remains explicitly unavailable/unverified or has recorded user acceptance of the material asymmetry; no count score, stub, simulated success, no-op or relabeled follow-up can mark it complete. **Check:** parity evidence/status audit against acceptance records.

### US-FH-02 — Mission-bound role instantiation and task dispatch

As an operator, I need every supported team and specialist to perform my mission objective, not merely appear in a roster.

- [ ] **AC-FH-005** — **Given** a valid authorized mission selecting any existing parent team, specialist or original Red archetype, **when** it starts, **then** the selected supported roles are instantiated with their actual profiles and included in the start result; unknown/invalid role input produces an actionable rejection rather than silent omission or a successful zero-worker substitution. **Check:** mission-start role matrix including negative input.
- [ ] **AC-FH-006** — **Given** a specialist objective, mission and target or explicitly artifact-only target context, **when** Dispatch is invoked, **then** the actual role receives a task carrying that objective and context and produces a traceable task/run identity; spawning an idle operator alone does not satisfy dispatch. **Check:** UI/API dispatch-to-task trace.
- [ ] **AC-FH-007** — **Given** a Blue AI red-team or agent-warfare scenario, **when** supported mission-family discovery and scheduling run, **then** Blue defensive analysis is selectable and assigned with the corresponding artifacts/telemetry; original supported family mappings remain supported and no offensive grant follows from the family label. **Check:** family routing and permission-negative fixtures.
- [ ] **AC-FH-008** — **Given** a submitted run, **when** progress, completion, failure, late output or cross-hat handoff is processed, **then** its original hat, specialist, task/run, mission, target/input references and capability remain attributable; another selection or mission cannot retarget or relabel that work. **Check:** concurrent mission/late-response identity fixtures.

### US-FH-03 — Authoritative role permissions

As an operator, I need runtime permissions to match the active role even when a model or client requests a forbidden tool.

- [ ] **AC-FH-009** — **Given** an active role and a registered tool outside its allowed toolkit, **when** the model requests it directly, through a batch, or through a backend-seeded path, **then** execution is denied before the handler runs, with an actionable role-permission failure and no side effect; hiding the schema alone is insufficient. **Check:** malicious/model-generated invocation with handler-call count zero.
- [ ] **AC-FH-010** — **Given** Blue or White and a tool that probes or changes a target, or Black and an operation outside its analysis/narrow existing route-verification authority, **when** execution is attempted, **then** the authoritative boundary denies it regardless of permissive legacy profile/category declarations, catalog visibility, prompt overrides or another role's grant. **Check:** role-by-tool allow/deny matrix.
- [ ] **AC-FH-011** — **Given** a permitted role/tool operation with invalid arguments, out-of-scope target or missing required approval, **when** any real execution surface submits it, **then** existing argument/scope/approval checks still reject it before the operation and approval does not expand scope or role rights. **Check:** API/MCP/AgentLoop authority negatives and approved positive counterpart.
- [ ] **AC-FH-012** — **Given** role switching, parallel role runs, custom parameters or prompt overrides, **when** each run executes, **then** it uses only its own authorized toolkit and context; an empty/unknown role grant never becomes all-tools access and one run's grant/credential context cannot widen another's. **Check:** interleaved-role and empty-grant fixtures.

### US-FH-04 — Honest, loadable tool and adapter contracts

As an operator, I need supported operations to be genuinely callable and unavailable adapters to say why they cannot run.

- [ ] **AC-FH-013** — **Given** a tool claimed as operational for Blue, Black or White, **when** it is discovered and invoked through the actual runtime, **then** it resolves to a registered/loadable permitted implementation accepting its documented structured inputs and returning the documented output, failure and evidence form; domain analysis operations are not disconnected catalog entries. **Check:** discovery-to-execution receipt for each claimed operational tool.
- [ ] **AC-FH-014** — **Given** an import-only/catalog-only adapter or a missing binary, credential, service or unsupported operation, **when** it is shown or invoked, **then** its non-executable mode or unavailable prerequisite and next action are explicit; it is not advertised as live execution and no fabricated finding or fallback success is returned. **Check:** capability availability matrix and missing-dependency negatives.
- [ ] **AC-FH-015** — **Given** Sigma/YARA validation or another supported artifact operation, **when** required inputs are missing, malformed, wrong-typed or unsafe, **then** authoritative argument validation identifies the offending input without running the handler; valid documented arguments reach the genuine implementation and produce interpretable validation evidence rather than mere template presence. **Check:** positive/negative argument and validation-result contract fixtures.
- [ ] **AC-FH-016** — **Given** executable built-in names, profile defaults, specialist/team grants and external catalog IDs, **when** the product reports capability/permission configuration, **then** displayed operations and actual callable grants agree, unresolved mappings are unavailable, and every specialist grant is permitted by its parent discipline; no catalog addition alone expands runtime authority. **Check:** actual registry/profile/grant discovery comparison.

### US-FH-05 — Staged skills, input binding and recovery

As an operator, I need each role skill to consume my supplied scope, complete a real workflow, and recover without inventing success.

- [ ] **AC-FH-017** — **Given** any of the six specialist skills and a valid explicit plan, findings/evidence selection, action or path set plus optional mission/target, **when** the skill runs, **then** parsed inputs are consumed by the actual analysis and restrict all reads/results to that requested context; a global/latest projection cannot silently replace them. **Check:** two-mission fixtures with disjoint input IDs and unique submitted content.
- [ ] **AC-FH-018** — **Given** each Blue/Black/White parent or specialist workflow, **when** executed, **then** it has operational prerequisites, a role-specific staged analysis/composition path, evidence/validation decision points and completion/retest conditions comparable to the relevant Red workflow; completion includes actual input/output/evidence references, limitations and unresolved conditions. **Check:** stage/branch receipts and completion-contract fixtures.
- [ ] **AC-FH-019** — **Given** failed prerequisites, malformed input, denied permission, unavailable backend/dependency, transient failure or timeout, **when** a skill handles the result, **then** those failure classes remain distinguishable with a corrective next action; retries occur only for recoverable conditions within existing finite limits and cannot silently change hats or inputs. **Check:** failure-class and bounded-retry fixtures.
- [ ] **AC-FH-020** — **Given** partially completed, interrupted, timed-out or cancelled work, **when** it stops or resumes, **then** valid completed evidence remains attached to its originating context, noncompletion is explicit, and resumption/retry does not repeat completed side effects without existing idempotency/reconciliation or renewed approval where required; unsupported cancellation is reported rather than falsely acknowledged. **Check:** interruption/resume and side-effect-count fixtures.

### US-FH-06 — Role, workflow, domain and corpus prompt depth

As an operator, I need role-specific guidance connected to real capabilities and evidence standards, not longer generic prompts.

- [ ] **AC-FH-021** — **Given** Blue, Black or White parent/specialist execution, **when** prompt context is assembled, **then** it includes the appropriate role objective, decision rights, allowed/forbidden operations, task decomposition, tool-use guidance, input prerequisites, uncertainty handling, evidence criteria and structured completion expectations, without weakening existing PLINIAN authority. **Check:** context-builder behavioral fixtures and source-linked prompt review.
- [ ] **AC-FH-022** — **Given** a supported Blue/Black/White workflow and domain, **when** its task is dispatched, **then** substantive dedicated workflow and domain guidance is actually loaded and guides the relevant stages, branches, validation and retest; dormant prompt files, renamed Red text or length alone do not establish coverage. **Check:** loader/call-path evidence plus representative output-contract behavior.
- [ ] **AC-FH-023** — **Given** the three existing Blue/Black/White corpus briefings, **when** a briefing is consumed, **then** its actual task context supplies evidence expectations, permitted tool requirements and validation/completion fields alongside domain inputs; the consumer can distinguish unverified material from validated results. **Check:** briefing producer/consumer contract fixtures.
- [ ] **AC-FH-024** — **Given** user text, findings, retrieved documents, tool output or imported rule/plan data containing instructions to switch roles, leak secrets, ignore scope or claim success, **when** context is assembled and executed, **then** that content remains untrusted data and cannot replace trusted role instructions, change grants, authorize a target or promote a hypothesis into verified evidence. **Check:** poisoned-context end-to-end authority negatives.

### US-FH-07 — Blue detection and hardening outcomes

As a defender, I need evidence-bound coverage, detector validation and hardening retest rather than recommendations presented as proof.

- [ ] **AC-FH-025** — **Given** selected findings and declared telemetry/control artifacts, **when** Sentinel or Blue coverage analysis runs, **then** each decision is keyed to the finding and names its observed telemetry/control evidence and limitations using the existing `none`/`partial`/`covered` meaning; missing telemetry or a recommendation alone cannot yield proven coverage. **Check:** absent, partial, observed-positive and cross-mission coverage fixtures.
- [ ] **AC-FH-026** — **Given** a candidate detector and supplied matching/nonmatching evidence, **when** supported local detector validation runs, **then** actual validation outcomes, inputs, tool/rule identity and evidence receipts are returned and distinguish validated, failed and unavailable; emitting Sigma/YARA text or recommending a SIEM rule alone never counts as validated detection. **Check:** genuine supported validation path with positive/negative cases and missing-prerequisite case.
- [ ] **AC-FH-027** — **Given** hardening items associated with selected findings and target/artifact context, **when** Warden reviews them, **then** each item retains priority/control/finding association, states the verification condition and baseline evidence, and reports a retest outcome only from supplied or permitted local re-evaluation evidence linked to that item; a checklist or proposed fix alone cannot mark it resolved. **Check:** open, failed-retest, successful-retest and insufficient-evidence fixtures.
- [ ] **AC-FH-028** — **Given** Blue requests spanning supported web/cloud/code/secret and AI/agent defensive scenarios, **when** a representative workflow completes, **then** real analysis/detection/telemetry/hardening outputs and evidence are available through parent and specialist paths without target probes, live EDR/SIEM operation or remediation; unavailable validation remains open and unaffected roles remain usable. **Check:** Blue domain/role execution and forbidden-operation negatives.

### US-FH-08 — Black tradecraft and modeled exfiltration outcomes

As a tradecraft reviewer, I need analysis of the actual plan and paths, with no unsupported claim of live stealth or verified egress.

- [ ] **AC-FH-029** — **Given** a supplied or explicitly selected mission plan, **when** Specter reviews it, **then** its actual actions drive cover, footprint/noise costs, assumptions, realism flags and reassessment conditions; an empty plan is explicitly empty/insufficient and is neither a fabricated `blown` failure nor a clean bill. **Check:** contrasting real plans, empty input and mission-isolation fixtures.
- [ ] **AC-FH-030** — **Given** nonempty submitted synthetic exfil paths with their IDs, channels, volumes, declared routes and budget inputs, **when** Wraith or the Black HTTP/MCP/skill path analyzes them, **then** every supplied path is actually costed and correlated with its feasibility/pressure notes and totals; the handler cannot discard them and analyze an unconditional empty array. **Check:** distinct path sets and totals across actual request surfaces.
- [ ] **AC-FH-031** — **Given** a route expressed only as text, or absent/contradictory route evidence, **when** egress status is reported, **then** it remains declared/modeled/unverified rather than `egressVerified: true`; any verified status requires relevant real authorized route evidence attributable to the same context, not merely a nonempty string array or model assurance. **Check:** string-only, mismatched, absent and valid scoped-evidence fixtures.
- [ ] **AC-FH-032** — **Given** destructive concealment, unapproved probing, live bulk exfiltration or an unsupported route-verification request, **when** Black analysis encounters it, **then** it reports the boundary and required authorized alternative without executing it; normal outcomes remain modeled/analysis-only, with ATT&CK/imported plan data and revised-plan retest evidence distinguished from observed execution. **Check:** Black boundary negatives and permitted analysis/reassessment positives.

### US-FH-09 — White scope, disputes and evidence sufficiency

As a neutral referee, I need rulings based on correct scope and evidence, including contested and incomplete records.

- [ ] **AC-FH-033** — **Given** an allowed target and adversarial lookalikes such as `allowed.example.attacker.test`, `notallowed.example`, URL userinfo or path/query text containing the allowed hostname, **when** White evaluates scope, **then** only the established normalized host/IP/domain policy can establish membership; substring/accidental suffix matches and approval cannot authorize the attacker host. Explicitly permitted subdomains, ports, URLs and IP forms retain their existing documented semantics. **Check:** normalized scope positive/negative table shared with authoritative policy.
- [ ] **AC-FH-034** — **Given** an action and sanctioned ROE/approval evidence, **when** Arbiter audits it, **then** the actual submitted action is judged against that ROE with the existing `compliant`/`violation`/`needs_approval` semantics, rationale, conditions and overturning evidence; missing/corrupt/unresolved ROE produces inability to derive or qualified nonapproval, never permissive success, and existing stored revision/hash/source-line stamps remain attributable. **Check:** action-bound ROE, corruption, unresolved-directive and approval fixtures.
- [ ] **AC-FH-035** — **Given** opposed Red and Blue claims about the same finding/action, **when** a dispute is submitted, **then** one correlated review considers both positions and their cited evidence, retains both claims, records a neutral ruling or insufficiency, and states rationale, conditions and appeal/reassessment evidence; separate one-sided records or arrival order cannot masquerade as adjudication. **Check:** opposed-claim ID pairing, order permutation and missing-side fixtures.
- [ ] **AC-FH-036** — **Given** a selected evidence set including weak/context-only entries, missing/broken provenance or contradictory items, **when** Auditor scores and aggregates it, **then** each item retains its evidence ID, provenance rank and accepted/insufficient or chain verdict with reasons; aggregate standing cannot claim complete/sufficient evidence or score 100 when required evidence is insufficient, and corroboration/retest can change standing only with linked new evidence. **Check:** insufficient-only, mixed, empty, broken-chain and corroborated fixtures.

### US-FH-10 — Explicit, attributed Purple synthesis

As an operator, I need the combined posture to reflect the actual four-hat evidence and missing work without inventing approvals or handoffs.

- [ ] **AC-FH-037** — **Given** populated findings, detections, White verdicts and relevant Black analysis, **when** explicit Purple synthesis is invoked through a supported surface, **then** the real contract accepts/forwards the required inputs, correlates the current results by stable finding/action/path/evidence identifiers as applicable, and retains their hat attribution; the public skill, MCP and UI agree with the actual backend contract. **Check:** populated four-hat request-to-result trace.
- [ ] **AC-FH-038** — **Given** reordered inputs, missing or partial role evidence and unrelated mission records, **when** synthesis runs in ID-correlated mode, **then** output associations are order-independent and mission-correct; missing evidence is explicit and not promoted to covered/compliant/verified, and any retained legacy positional compatibility is disclosed as such rather than described as ID correlation. **Check:** permutation, missing-evidence and mission-isolation fixtures.
- [ ] **AC-FH-039** — **Given** a synthesis row with risk and unresolved conditions, **when** it is presented, **then** `riskTier` and existing derived `residualRisk` remain consistent, unresolved evidence/approval/retest conditions stay visible, and proposed next missions remain proposals until the existing authorized dispatch path is used. **Check:** tier/prose invariant and no-implicit-dispatch fixtures.
- [ ] **AC-FH-040** — **Given** explicit synthesis or an existing handoff, **when** role outputs are combined or passed onward, **then** only authorized relevant context and provenance cross the boundary; no new automatic cross-hat run, verdict auto-consumption project, permission delegation or fifth-hat operator is introduced. **Check:** handoff/context/dispatch-boundary assertions and product scope review.

### US-FH-11 — Consistent API, MCP and published skill contracts

As an API or Grok operator, I need the same real behavior and failures that the UI provides.

- [ ] **AC-FH-041** — **Given** the supported Blue/Black/White/Purple contracts, **when** the corresponding API, MCP and published skill path runs, **then** required fields, accepted structured inputs, output/error/evidence semantics and identity correlation agree; in particular Purple forwards White verdict input and supported ID mapping instead of sending findings/detections alone to a backend requiring verdicts. **Check:** consumer/provider populated-contract matrix.
- [ ] **AC-FH-042** — **Given** grammar inputs to `blue-sentinel`, `blue-warden`, `black-specter`, `black-wraith`, `white-arbiter` or `white-auditor`, **when** each skill acknowledges and invokes its backend, **then** its parsed mission/scope/target/action/plan/path/evidence input is actually bound, any temporary local label is distinguished from a real mission ID, and field names/results relayed match the real response without invented schema fields or findings. **Check:** all six grammar-to-call-to-result fixtures.
- [ ] **AC-FH-043** — **Given** an API or MCP failure, empty result or absent prerequisite, **when** a skill responds, **then** it distinguishes those states, preserves valid user inputs, cites actual evidence/report references when present, and claims parked/resumable work only when the existing runtime actually retains it; it never describes a backend outage as a measured clean report. **Check:** backend/transport/permission/empty/retention fixtures.
- [ ] **AC-FH-044** — **Given** corrected runtime contracts, **when** published manifests, grammar, six specialist skills, Dark Purple instructions, four templates and relevant existing docs are consumed, **then** advertised capabilities, permissions, callable paths, validation/retest/completion rules and unavailable cases match implementation while existing Red-supported public usage remains compatible. **Check:** documentation-to-real-call contract examples, not prose-count pins.

### US-FH-12 — Runtime-connected selection, configuration and results UI

As an operator, I need hat selection and controls to change actual execution rather than only labels.

- [ ] **AC-FH-045** — **Given** the existing overview/mission/operators/defend/arsenal surfaces, **when** the operator discovers roles, **then** Red, Blue, Black and White have explicit discoverable grouping/descriptions, specialists appear under their true parent rather than core, and the selected runtime hat and its actual tools/skills/workflows/permissions are identifiable without color alone. **Check:** browser discovery/selection assertions against runtime roles.
- [ ] **AC-FH-046** — **Given** a selected hat/capability, **when** configuration and execution controls load, **then** they expose its actual supported inputs/prerequisites/permissions and submit them to the genuine role-bound implementation; displayed availability agrees with runtime and Dispatch produces the objective-bound task from AC-FH-006. **Check:** browser configuration-to-request-to-attributed-result trace for every discipline and six specialists.
- [ ] **AC-FH-047** — **Given** existing persisted Red settings/sessions and a supported hat selection change, **when** state is restored or selection changes, **then** existing persistence conventions and Red defaults remain compatible, execution uses the selected authorized role, and stale capability-loading responses cannot overwrite the current hat's controls. **Check:** legacy settings round-trip and out-of-order loading fixtures.
- [ ] **AC-FH-048** — **Given** generated/external output or a historical result displayed after switching hats, **when** the UI renders it, **then** content is escaped/safely rendered and remains labeled with originating hat/capability/mission/task/evidence identity; it cannot execute script, leak another role's restricted context or be relabeled as the current selection. **Check:** unsafe-content and late/historical-result browser fixtures.

### US-FH-13 — Complete UI lifecycle and safe switching

As an operator, I need understandable execution states and safe control over pending work.

- [ ] **AC-FH-049** — **Given** capability loading or an in-progress submission, **when** the UI updates, **then** it shows loading/progress where available, retains the active run identity and prevents accidental duplicate submission; completion status is drawn from actual run results rather than a timer or spawn acknowledgement. **Check:** controlled pending-request browser fixture with submission count.
- [ ] **AC-FH-050** — **Given** a valid empty result, unconfigured capability, missing dependency or runtime failure, **when** the UI presents it, **then** empty, unavailable and error states have different truthful explanations, valid inputs are retained and a retry is offered only when appropriate; one failed dependency does not disable unaffected hats. **Check:** empty/configuration/dependency/error browser state table.
- [ ] **AC-FH-051** — **Given** usable partial output followed by failure, timeout, interruption or cancellation, **when** the run ends, **then** partial evidence is preserved under the original role and a distinct partial/interrupted/cancelled state is shown; cancellation requested is not treated as acknowledged termination or full success. **Check:** partial-output and cancellation-acknowledgement browser fixtures.
- [ ] **AC-FH-052** — **Given** a pending run whose execution context would change with the selected hat, **when** the user attempts switching, **then** the unsafe change is blocked or goes through the existing explicit confirmation/cancellation pattern, without silently retargeting work; late responses retain their original attribution and cannot overwrite the new run. **Check:** switch-during-pending/cancel race and late-result browser fixtures.

### US-FH-14 — Accessible and responsive four-hat use

As a keyboard or assistive-technology user, I need all new role interactions to be usable and status-comprehensible.

- [ ] **AC-FH-053** — **Given** keyboard-only use of hat selection, configuration, Dispatch and supported cancellation/retry controls, **when** focus moves and controls activate, **then** semantic controls have accessible names and state, visible focus, keyboard activation and no new keyboard trap; dialog/navigation focus follows existing patterns. **Check:** browser keyboard/focus/name/state assertions.
- [ ] **AC-FH-054** — **Given** each discipline and lifecycle state, **when** rendered at the existing supported responsive layouts with and without reduced-motion preference, **then** hat identity/status are conveyed by text/labels rather than color alone, controls/results remain readable and reachable, contrast meets WCAG AA for text/controls, and motion respects reduced-motion. **Check:** browser responsive/reduced-motion/contrast assertions plus recorded visual inspection; `automated: false` for the combined visual acceptance record.
- [ ] **AC-FH-055** — **Given** asynchronous progress, validation errors, run errors and terminal results, **when** the UI changes, **then** appropriate status/error feedback is programmatically exposed and associated with the relevant control/run without repeatedly announcing unchanged progress or unexpectedly stealing focus. **Check:** accessibility-tree/live-region and focus event assertions.
- [ ] **AC-FH-056** — **Given** delayed success or failure after a hat switch or dialog closure, **when** feedback arrives, **then** accessible labels, announcements and focus identify the originating context and do not misrepresent the selected hat or return focus to an unrelated control. **Check:** delayed-response keyboard/assistive-status fixture.

### US-FH-15 — Security, failure isolation and compatibility

As an existing operator, I need the expansion not to weaken safeguards, leak credentials or break working Red behavior.

- [ ] **AC-FH-057** — **Given** malformed command/file/path/URL/target inputs, path traversal/symlink escapes, shell metacharacters or scope-changing redirects on supported operations, **when** authoritative executors process them, **then** existing relevant command/file/destination protections reject unsafe execution, and no prompt, UI state, claimed evidence or imported framework can authorize the escape. **Check:** operation-relevant input-boundary negative suite with no external effects.
- [ ] **AC-FH-058** — **Given** local, off-loopback, UI, API and MCP requests, **when** new workflows are invoked, **then** existing scope/approval, origin/Host/CSRF, bearer/rate-limit and redaction behavior remains effective; configured secrets and restricted role context do not appear in prompts, UI payloads, logs, stored results or errors outside existing authorization. **Check:** existing security regression plus four-hat secret-marker and cross-role isolation fixtures.
- [ ] **AC-FH-059** — **Given** missing/broken new-hat optional dependencies or a hung supported operation, **when** one workflow loads or runs, **then** unaffected Red and other hats remain usable, execution respects the existing configured finite iteration/timeout/retry limits, and failures remain explicit without silent role fallback, fabricated success or an unbounded retry cycle. **Check:** dependency-isolation and configured-bound termination fixtures.
- [ ] **AC-FH-060** — **Given** previously supported Red workflows, settings, providers, mission/evidence/retest ledgers and public contracts, **when** used after the extension, **then** supported authorized behavior and persistence remain intact except required security corrections; any such correction is documented, all affected callers are updated, and unavailable old/new prerequisites are reported rather than concealed. **Check:** original Red regression inventory exercised with legacy fixtures and real local representative flow.

### US-FH-16 — Truthful verification and governed closure

As the product owner, I need implementation and acceptance evidence to control phase and milestone completion.

- [ ] **AC-FH-061** — **Given** the final implementation and parity matrix, **when** the parent validates it, **then** every criterion and parity row traces to an owned implementation task, exact implementation sources, behavioral/boundary/security check or justified visual check, actual outcome/evidence and v1.5 release scope; unexecuted/blocked checks remain labeled and incidental wording/wiring/default pins are not re-pinned as behavioral proof. **Check:** requirements → task → implementation → check → release evidence audit.
- [ ] **AC-FH-062** — **Given** isolated loopback development state and no permission for external/model operations, **when** end-to-end acceptance is recorded, **then** actual localhost API and real browser flows demonstrate selection/configuration/dispatch/attributed output for all four disciplines and representative six-specialist workflows, plus negative/recovery states; screenshots, request/result/evidence references and limitations distinguish real execution from mocks/static checks. **Check:** parent-owned local API/browser proof with no external target operations.
- [ ] **AC-FH-063** — **Given** approved v1.5 and archived v1.4, **when** the planning owner advances work, **then** actual GSD discuss → plan → execute and gate evidence precede each applicable phase advance, numbering follows 25, historical milestones/deferred debt are preserved, exact disjoint implementation slices and one shared integration owner are recorded, and authentic gate results come only from trusted canonical operations, not hand-written/advisory verdicts. **Check:** parent-owned planning/assignment/gate evidence audit; this A02 artifact does not create phases or execute gates.
- [ ] **AC-FH-064** — **Given** all requirements and actual check outcomes, **when** milestone closure is proposed, **then** full Red regression, four-hat substantive parity, UI/security/accessibility/recovery acceptance and material-gap resolution are evidenced; only then do audit → complete → prescribed cleanup and truthful existing docs/changelog updates proceed under the parent's workflow, preserving history and original issue references, with no deployment, merge, premature ship or unrelated milestone completion. **Check:** closure audit against this entire artifact and recorded parent verification.

## 5. Cross-cutting non-functional requirements

| ID | Kind | Measurable target / acceptance oracle | Verified by / linked criteria |
|---|---|---|---|
| NFR-FH-SEC-01 | Security, non-negotiable | Zero handler invocations and zero side effects for role-denied, out-of-scope, invalid or unapproved test cases; no guard is waived for a new hat | Parent/A10/A08 boundary evidence; AC-FH-009–012, 033–034, 057–058 |
| NFR-FH-DATA-01 | Privacy/isolation, non-negotiable | Zero configured-secret markers in surfaced/stored prompt/result/error/UI/log fixtures; zero unauthorized cross-role/mission records in selected outputs | Parent security/isolation evidence; AC-FH-008, 012, 017, 024, 038, 048, 058 |
| NFR-FH-REL-01 | Reliability/recovery | Every supported workflow terminates or reports timeout within its existing configured bounds; retry count never exceeds its existing finite policy; no repeated completed side effects in recovery fixtures | Parent lifecycle tests; AC-FH-019–020, 049–052, 059 |
| NFR-FH-COMP-01 | Compatibility | All enumerated supported Red workflows/settings/public-contract regression cases remain supported; required security corrections have documented expectations and migrated callers | Parent regression evidence; AC-FH-001, 044, 047, 060 |
| NFR-FH-A11Y-01 | Accessibility | All new controls have accessible names/state, keyboard reachability/activation and visible focus; no color-only hat/status signal, new focus trap or reduced-motion violation; WCAG AA contrast on changed surfaces | Parent browser/a11y plus visual evidence; AC-FH-053–056 |
| NFR-FH-EVID-01 | Evidence integrity | 100% of claimed completed parity rows link real implementation and actual check evidence; 100% of verified findings/coverage/routes/verdicts/retest closures cite applicable evidence; empty/insufficient evidence cannot produce proof of completion | Parent acceptance audit; AC-FH-002–004, 018, 025–039, 061–064 |
| NFR-FH-AVAIL-01 | Failure isolation | In each missing optional-dependency case, unaffected supported Red/other-hat workflows still load/run; no fabricated success or implicit fallback role | Parent dependency matrix; AC-FH-014, 028, 043, 050, 059 |
| NFR-FH-MAINT-01 | Maintainability/scope | Zero new collaboration/memory platforms, fifth hats, deployed infrastructure, no-op parity entries or unnecessary runtime dependencies; shared existing conventions used; exact integration ownership recorded | Parent review and scope/ownership audit; AC-FH-003–004, 016, 040, 063–064 |

No invented p95/load/latency SLA, new localization mandate, or regulatory certification is imposed: the approved objective supplies no such target. Responsiveness and bounded execution are judged against existing configured limits and the UI lifecycle requirements, not an arbitrary benchmark. Applicable existing legal/privacy controls remain authoritative; this artifact grants no regulatory waiver.

## 6. Required contract content, without prescribing a new API or schema

For every operational capability, the implementation's existing contract mechanisms must express enough information to verify:

1. **Input:** objective; active discipline/specialist; mission/target or artifact-only context; selected findings/evidence/actions/plan/paths and their IDs; required artifact parameters; allowed configuration and prerequisite state.
2. **Output:** actual outcome and lifecycle standing; originating role/capability and run/task/mission association; results keyed to the submitted IDs; limitations and missing evidence; proposed next steps distinguished from executed work.
3. **Evidence:** source/tool/rule/control/ROE identity where applicable, actual input/artifact/receipt references, validation observations, provenance strength and approval context under existing rules; explicit distinction among hypotheses, observations, verified findings and recommendations.
4. **Error:** distinguish invalid input, permission/scope/approval denial, missing prerequisite/unsupported operation, unavailable backend/dependency, transient execution failure and timeout; retain valid inputs and give a valid next action without secrets.
5. **Recovery/closure:** partial output and remaining work; cancellation requested versus acknowledged; existing retry/reconciliation policy; actual detector/hardening/route/claim reassessment evidence and conditions for completion.

These are semantic acceptance requirements. They do not invent endpoint names, force a parallel result framework, expand persistence projects, or require a new universal schema. A03/integration owners must map them to the real interfaces and update every affected caller.

## 7. Traceability and parent-owned verification handoff

### 7.1 Coverage of complete source objective

| Full objective / persisted brief requirement | Stories / criteria |
|---|---|
| Red inventory, definitions, substantive depth, separate counts and asymmetries | US-FH-01; AC-FH-001–004; §3 |
| Real registered tools, separate catalogs/profiles/grants, Sigma/YARA contract gaps | US-FH-03–04; AC-FH-009–016 |
| Mission whitelist, Blue AI/agent family coverage, spawn-only Dispatch | US-FH-02; AC-FH-005–008; AC-FH-045–046 |
| Staged skills, actual input/mission binding, error distinctions, receipts and retest closure | US-FH-05, 11; AC-FH-017–020, 041–044 |
| Dedicated role/workflow/domain prompts and three corpus evidence/tool/validation omissions | US-FH-06; AC-FH-021–024 |
| Blue detector proof, telemetry decisions, hardening/retest | US-FH-07; AC-FH-025–028 |
| Black empty-path HTTP, Specter empty plan, string-only Wraith verification | US-FH-08; AC-FH-029–032 |
| White scope confusion, paired disputes, evidence score despite insufficiency | US-FH-09; AC-FH-033–036 |
| Populated ID-correlated Purple contract, MCP verdict mismatch, all-hat attribution and incomplete evidence | US-FH-10–11; AC-FH-037–044 |
| Actual selected runtime hat, capabilities/configuration/permissions, mission-bound controls/results | US-FH-12; AC-FH-045–048 |
| Loading/empty/success/error/unavailable/partial/interrupted/cancelled; safe switching/persistence | US-FH-13; AC-FH-047–052 |
| Keyboard/focus/labels/status feedback/contrast/responsive/reduced motion | US-FH-14; AC-FH-053–056 |
| Actual role allowlists, approvals/scope, poisoned context, commands/files/URLs, origin/Host/bearer/redaction, no credential leakage | US-FH-03, 06, 15; AC-FH-009–012, 024, 057–059 |
| Dependency isolation, preserved Red workflows/settings/contracts, no fake fallback | US-FH-04–05, 15; AC-FH-013–020, 060 |
| Real API/browser proof, honest test outcomes, full acceptance, existing docs/changelog | US-FH-16; AC-FH-061–064 |
| GSD ownership/history/phase lifecycle/gates/audit/complete/cleanup and disjoint specialist slices | AC-FH-063–064; §2.3; parent-owned governance only |
| Exclusions: deployment, destructive operations, new platform/fifth hat/count padding; preserve history and `coverage-pr/` | §2.3; AC-FH-003–004, 032, 040, 057–064 |

### 7.2 Implementation traceability responsibility

This task is `T1b29-req` for all sixteen stories. The persisted plan shows downstream architecture task `T1b29-arch` depends on it; A02 does not assign implementation task identities or phases. A01 must bind each criterion to the actual authenticated implementation task(s), exact test file/check and v1.5 phase/release before claiming traceability completeness. That binding is an explicit product acceptance criterion (AC-FH-061/063), not a fabricated already-complete matrix. Existing original issue lineage is retained above.

### 7.3 Existing source/test surfaces available to the parent

The following test paths were discovered, **not run or asserted sufficient**: `src/__tests__/teams-modules.test.ts`, `teams-archetypes.test.ts`, `teams-integration-static.test.ts`, `hats-modules.test.ts`, `hats-archetypes.test.ts`, `hats-integration-static.test.ts`, `grokbot-hats.test.ts`, `blue-suite.test.ts`, `blue-routes-static.test.ts`, `black-suite.test.ts`, `black-routes-static.test.ts`, `white-suite.test.ts`, `white-routes-static.test.ts`, and `purple-v2.test.ts` (all under `src/__tests__/`). Existing static tests do not establish runtime permission enforcement or browser behavior; the parent must select/add behavioral checks at actual relevant existing suites rather than rely on file names.

Read-source `package.json` provides these parent verification commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run doctor`, `npm run test:pr`, `npm run prompt:audit`, `npm run smoke`, `npm run build`, and `npm run test:pr-coverage` with the brief's `PR_CHANGED_LINE_COVERAGE=50`. `test:pr` already composes lint/typecheck/tests/doctor; the parent should avoid redundant concurrent runs. Existing `blue:bench`, `black:bench`, and `white:bench` scripts can supply domain corpus evidence where appropriate, but are not substitutes for complete acceptance. This artifact runs none of them.

Real UI/API proof uses the existing `npm run server` loopback `/ui` surface with isolated configuration/state and no external/model actions unless separately authorized. Parent evidence must include positive useful workflows plus role-denial, input/scope/prompt-injection negatives, missing dependencies, partial/timeout/cancel/switch races, safe rendering, accessibility and unchanged Red operation. Any unavailable prerequisite or red pre-existing check is recorded with its actual status and scoped impact; no historical observation is rerun solely to reconfirm it and no unrelated debt is silently absorbed.

Only parent/trusted gate operations may create authentic gate verdicts or advance tasks. No tool call, copied test list, requirement-linter absence, source inspection or this requirements result is a signed gate approval.

## 8. Assumptions, ambiguity and acceptance status

- **Open product clarifications:** none. The approved persisted brief and settled project/templates answer the conditional role/parity/handoff questions in the older objective.
- **Assumptions:** no new product-scope assumptions. Actual executable inventory totals, dependency availability, implementation details and verification outcomes are deliberately not assumed; they require recorded evidence under the criteria above.
- **Ambiguity score:** 0.08, A02 qualitative estimate (not a linter or computed telemetry result). Remaining uncertainty concerns implementation evidence and existing interface mapping, not approved role semantics or acceptance scope.
- **Manual-only share:** 1 of 64 criteria (AC-FH-054), approximately 1.56%, classified by this authored specification, not measured by a linter. Other criteria are automated-checkable but unexecuted. Visual acceptance has both machine-checkable assertions and a required human/agent recorded visual observation.
- **Provisional:** false as to approved scope/role decisions. **Validation status:** NOT_VALIDATED; all checks were expressly skipped. IN_REVIEW is the deliverable state, not permission to mark the product or requirements validated.
- **Closure standard:** all 64 criteria and eight NFRs, complete parity matrix and source-to-evidence trace, parent-owned real regression/API/browser/security/accessibility/recovery proof, and truthful governed closure. Missing evidence remains missing; it is not a follow-up relabeled as completion.

## GSD Traceability

**Roadmap status:** Owner approved the complete four-phase roadmap26–29 and scoped trusted-controller prerequisite repair on 2026-10-14. All72 primary requirement mappings remain Pending; controller implementation/mounting and the three reviewed contract corrections must precede product execution. The full signed A02 source above this section is unchanged. Approval does not imply implemented behavior, signed gate passage or product completion.

| Requirement | Phase | Status |
|---|---|---|
| AC-FH-001 | Phase 26 | Pending |
| AC-FH-002 | Phase 29 | Pending |
| AC-FH-003 | Phase 26 | Pending |
| AC-FH-004 | Phase 29 | Pending |
| AC-FH-005 | Phase 26 | Pending |
| AC-FH-006 | Phase 26 | Pending |
| AC-FH-007 | Phase 26 | Pending |
| AC-FH-008 | Phase 26 | Pending |
| AC-FH-009 | Phase 26 | Pending |
| AC-FH-010 | Phase 26 | Pending |
| AC-FH-011 | Phase 26 | Pending |
| AC-FH-012 | Phase 26 | Pending |
| AC-FH-013 | Phase 27 | Pending |
| AC-FH-014 | Phase 27 | Pending |
| AC-FH-015 | Phase 27 | Pending |
| AC-FH-016 | Phase 27 | Pending |
| AC-FH-017 | Phase 28 | Pending |
| AC-FH-018 | Phase 27 | Pending |
| AC-FH-019 | Phase 26 | Pending |
| AC-FH-020 | Phase 26 | Pending |
| AC-FH-021 | Phase 27 | Pending |
| AC-FH-022 | Phase 27 | Pending |
| AC-FH-023 | Phase 27 | Pending |
| AC-FH-024 | Phase 26 | Pending |
| AC-FH-025 | Phase 27 | Pending |
| AC-FH-026 | Phase 27 | Pending |
| AC-FH-027 | Phase 27 | Pending |
| AC-FH-028 | Phase 27 | Pending |
| AC-FH-029 | Phase 27 | Pending |
| AC-FH-030 | Phase 27 | Pending |
| AC-FH-031 | Phase 27 | Pending |
| AC-FH-032 | Phase 27 | Pending |
| AC-FH-033 | Phase 27 | Pending |
| AC-FH-034 | Phase 27 | Pending |
| AC-FH-035 | Phase 27 | Pending |
| AC-FH-036 | Phase 27 | Pending |
| AC-FH-037 | Phase 28 | Pending |
| AC-FH-038 | Phase 28 | Pending |
| AC-FH-039 | Phase 28 | Pending |
| AC-FH-040 | Phase 28 | Pending |
| AC-FH-041 | Phase 28 | Pending |
| AC-FH-042 | Phase 28 | Pending |
| AC-FH-043 | Phase 28 | Pending |
| AC-FH-044 | Phase 28 | Pending |
| AC-FH-045 | Phase 28 | Pending |
| AC-FH-046 | Phase 28 | Pending |
| AC-FH-047 | Phase 28 | Pending |
| AC-FH-048 | Phase 28 | Pending |
| AC-FH-049 | Phase 28 | Pending |
| AC-FH-050 | Phase 28 | Pending |
| AC-FH-051 | Phase 28 | Pending |
| AC-FH-052 | Phase 28 | Pending |
| AC-FH-053 | Phase 28 | Pending |
| AC-FH-054 | Phase 28 | Pending |
| AC-FH-055 | Phase 28 | Pending |
| AC-FH-056 | Phase 28 | Pending |
| AC-FH-057 | Phase 29 | Pending |
| AC-FH-058 | Phase 29 | Pending |
| AC-FH-059 | Phase 29 | Pending |
| AC-FH-060 | Phase 29 | Pending |
| AC-FH-061 | Phase 29 | Pending |
| AC-FH-062 | Phase 29 | Pending |
| AC-FH-063 | Phase 29 | Pending |
| AC-FH-064 | Phase 29 | Pending |
| NFR-FH-SEC-01 | Phase 26 | Pending |
| NFR-FH-DATA-01 | Phase 26 | Pending |
| NFR-FH-REL-01 | Phase 26 | Pending |
| NFR-FH-COMP-01 | Phase 29 | Pending |
| NFR-FH-A11Y-01 | Phase 28 | Pending |
| NFR-FH-EVID-01 | Phase 29 | Pending |
| NFR-FH-AVAIL-01 | Phase 27 | Pending |
| NFR-FH-MAINT-01 | Phase 29 | Pending |

**Coverage:** 72/72 requirements mapped exactly once: all 64 AC-FH criteria and eight NFR-FH requirements; zero orphans or duplicate primary assignments. Phase 26: 13 AC + 3 NFR = 16; Phase 27: 20 AC + 1 NFR = 21; Phase 28: 21 AC + 1 NFR = 22; Phase 29: 10 AC + 3 NFR = 13. All remain Pending; no requirement is verified or checked by this metadata assignment. Plan counts remain TBD.

### Cross-phase completion dependencies (not duplicate primary assignments)

- Phase 26 owns the real Red inventory/tracer, exact role identity, bound request/queue/origin/retention and authoritative security/privacy/finite-lifecycle boundary. Phase 27 registers and loads real per-hat exports; an absent new-hat executor is unavailable, not stubbed successful execution. Domain and consumer integration must recheck the Phase 26 security/data/reliability invariants.
- Phase 27 owns genuine Blue/Black/White tools, workflow engines, dedicated prompts/domain/corpus guidance, structured adapter validation and independent failure isolation. Required HTTP/MCP/skill request forwarding and six-skill context binding finish through Phase 28; core-only examples do not excuse public-surface gaps in AC-FH-013–018 or AC-FH-025–036.
- Phase 28 owns the six published specialist skills, four templates, Dark Purple/grammar/manifests, runtime-connected accessible static UI and explicit ID-correlated four-hat synthesis. Actual byte-bearing input adapters depend on the adopted Phase 26 data/IO contract; UI labels and selected artifact IDs do not supply missing bytes. No implicit cross-hat dispatch, fake cancellation, global/latest substitution or claimed-observation upgrade is permitted.
- Phase 29 owns the complete parity/evidence matrix, security/failure/Red regression, authentic task/gate/GSD lifecycle audit and governed closure. It rechecks every one of the 72 requirements, including NFRs whose primary completion phase is earlier, with actual local API/browser/keyboard/responsive/reduced-motion/security/visual evidence, not duplicate primary mapping. Truthful existing docs/changelog updates follow actual smoke before audit → complete → prescribed cleanup. No scope reduction, premature ship, deployment, merge or unrelated milestone completion.

### Unresolved adoption prerequisites

- **FH-INPUT-1 — Phase 26 before code, A03/A04/A07 → C1/C2/C3; U1/U2 in Phase 28:** evidence POST stores metadata only, not bytes/media/registered artifact content. Close the already-proposed INLINE artifact ingress in existing mission-start/task-dispatch with bounded byte/data representations, media/encoding, selected IDs, server-computed hashes, real mission creation then atomic binding, retention/redaction and usable UI byte input. No summary-as-bytes, arbitrary URI/command fetch or fake target. Adopt the complete data/IO contract before implementation.
- **FH-EVID-2 — Phase 26 A03/A07/C3 trust contract; A10 Phase 29:** caller-controlled source/tool/system/type/strength labels and ledger-ID resolution are not authentic observations. New workflows keep public/legacy/imported entries claimed/context-only absent demonstrated private server-issued run/mission/stage/tool/input-hash/item associations after real computation. Preserve historical labels without silent upgrades, validate restored origin, and provide no public receipt-minting endpoint.
- **FH-COMP-3 — Phase 26 A03/A04 clarify, C2/C3 implement; parent proves legacy fixtures/seeding and Phase 29 regression:** retain legacy target-based Red omitted/empty-operators start, duplicates and actual seeding separately from the new structured/explicit role-selected branch; reject unknown explicit roles rather than substitute. Universal nonempty/duplicate rejection is not behavior-preserving.
- **FH-EXEC-4 — Phase26 adoption prerequisite, A01/runtime authority, binding on subsequent waves:** native distinct-task append supports authenticated path-bounded A03/A04 and implementation lanes while preserving original tasks. Same-task concurrent fan-in is unsupported; original typed input/dependency/acceptance amendment still needs the owner-authorized fixed runtime operation. Separate legitimate runtime workspace repair plan exists, but has not yet delivered or verified code. Product correction/extension must retain correlation `1b299db3-62f2-4a31-a133-5bb01be01615` and the three DONE prerequisites; DONE is terminal. No copied/mutated signatures, raw state writes, product replacement correlation or unsigned delegates. Roadmap/repair authorization is explicit; actual amendment, mounting and signed corrective contracts remain pending.

The complete phase success criteria, exact A03 §12 C1/C2/C3/B1/K1/W1/P1/I1/U1/U2/U3/S1/S2/S3/S4/D1/Q1/Q2/Q3 path boundaries, serialized shared integration owner and supplied A03/A04 digest pins are recorded in ROADMAP.md. Slice labels are proposed work packages, not issued task IDs or concurrency authority. Owner approved all four phases and the scoped prerequisite repair; this metadata pass changes no product/TaskStore/tracker state and runs no tests/build/lint/formatters/gates. Parent validated roadmap projection and exact72-row traceability; real contract correction/implementation/smoke/gates remain prerequisites.
