# Roadmap: T3MP3ST — Red Team AI

## Milestones

- ✅ **v1.0 Plan-Based Inference, Dark Purple Core, White/Red UI & Grok Bot** — Phases 1-5 (shipped 2026-10-09)
- ✅ **v1.1 Specialist Hats, Grok Abstractions, UI Redesign, Tauri Wrapper** — Phases 6-10 (shipped 2026-10-09)
- ✅ **v1.2 Re-home Completion: Tauri Bundling & Remote Hardening** — Phases 11-14 (shipped 2026-10-10)
- ✅ **v1.3 Color Team Suites at Red Parity** — Phases 15-20 (shipped 2026-10-10)
- ✅ **v1.4 Hardening & Validation** — Phases 21-25 (shipped 2026-10-13)
- **v1.5 Four-Hat Runtime Parity** — Phases 26-29 (owner-approved; prerequisite repair and contract corrections in progress)

Archives: `.planning/milestones/` (per-milestone `v*-ROADMAP.md` / `v*-REQUIREMENTS.md` / `v*-STATE.md`, phase dirs in `v*-phases/`).

## Current Milestone: v1.5 Four-Hat Runtime Parity

Owner explicitly approved the complete four-phase roadmap and scoped controller repair on 2026-10-14. All 64 AC-FH criteria/eight NFR-FH requirements are mapped exactly once; all remain Pending. No new product phase, capability, gate or parity acceptance is complete. The approved order is 26 → 27 → 28 → 29, with controller and reviewed contract prerequisites closed before product code. Roadmap acceptance does not waive actual signed authority or verification.

**Configuration:** `.planning/config.json` is absent. Sequential phase IDs follow the existing history; standard granularity is the default compression guidance, with the four phase boundaries explicitly selected by the parent. No config file is created. `.planning/research/SUMMARY.md` is historical v1.4 research, not a new v1.5 architecture mandate.

**Source/adoption basis:** `.planning/PROJECT.md`, the full signed A02 source preserved in `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`, `.planning/v1.5-BASELINE.md`, A03 `.planning/v1.5-RUNTIME-CONTRACTS.md` (digest `69cefa9626dc0b1b111de671234c35fd0d82432bc5157e41e79de619974b07c1`), A04 `.planning/v1.5-UI-CONTRACT.md` (digest `9750d3c9a574a6dd2bc7101a2de4dc00d707888f03d79df98f97a801d203249b`), and parent independent read-only review `artifact://57`. Digests are supplied parent pins, not recomputed here. A03/A04 describe proposals, not implemented behavior; their “no unresolved decisions” statements and sequential fallback do not override the verified blockers below.

Preserve controller correlation `1b299db3-62f2-4a31-a133-5bb01be01615`, original graph `ut-mv693l8r-3e8d7703` / SPE-10689–SPE-10696, current graph `ut-mv7q7vem-1516b11f`, and current planning references [SPE-12330](https://linear.app/swcstudio/issue/SPE-12330/n7-align-scoped-phases-and-planning-records) / [SPE-12336](https://linear.app/swcstudio/issue/SPE-12336/n8-synthesize-parallel-execution-waves). All three prerequisite tasks `T1b29-req`, `T1b29-arch`, `T1b29-ux` are parent-reported DONE; their task completion is not product acceptance, and DONE is terminal. Earlier records of A03/A04 being dispatched are historical, not a current lease. Contract corrections require a supported authorized path, not re-leasing completed tasks by assumption.

## Adoption Prerequisites — All Four Unresolved

These are source-backed contract/transport defects, not unanswered hat semantics or permission to reduce scope. Owner approved the roadmap and focused prerequisite repair; implementation must still close the four defects through supported operations, not silently bypass them.

| Blocker | Required closure and phase ownership |
|---|---|
| **FH-INPUT-1 — Byte-bearing input and pre-mission binding absent** | **Phase 26, before code:** A03/A04 close the already-proposed INLINE artifact contract in existing mission-start and task-dispatch requests; A07 supplies bounded byte/data/media/encoding representations, selected IDs, retention/redaction and ledger linkage. Existing evidence POST stores metadata, not bytes or registered artifact content; detector/control artifact IDs alone cannot supply data. Specify server-computed hashes, full submission validation, real mission creation followed by atomic binding, and usable UI byte-bearing drafts (consumed in Phase 28). No summary-as-bytes, arbitrary URI/command fetch, unsupported ingestion or fake target. C1/C2/C3 consume the adopted data/IO contract; U1/U2 consume its UI adapter. |
| **FH-EVID-2 — Ledger labels do not authenticate observations** | **Phase 26:** A03/A07 specify the trust contract and C3 alone implements private server-issued receipt origin after real computation, associating run/mission/stage/tool/input hashes and applicable item IDs. Public/legacy/imported source/tool/system/type/strength labels remain claimed/context-only unless authentic internal origin is demonstrated; resolving a real ledger ID does not establish observation. Preserve historical labels without upgrading them, validate restored associations, and create no public receipt-minting endpoint. Phase 27 engines consume this boundary; Phase 28 displays standing; A10 verifies spoofing/isolation in Phase 29. |
| **FH-COMP-3 — Universal role rejection would break legacy Red** | **Phase 26:** A03/A04 distinguish legacy target-based Red omission/empty operators and duplicate handling from the new structured/explicit role-selected branch. C2/C3 preserve real legacy Red start/seeding and existing duplicate behavior; new structured requests require known nonempty unique selected roles and bound inputs. Unknown explicit roles fail actionably rather than silently substituting. Parent proves legacy fixtures and actual seeding, with full regression in Phase 29. Global nonempty/duplicate rejection in the unamended A03 proposal is not an adopted compatibility rule. |
| **FH-EXEC-4 — Original input/dependency amendment missing** | **Phase 26 adoption prerequisite; binding on Phases 27-29:** native distinct-task parallel lanes, including A03/A04, can be added under the same correlation/new prefix with original rows/gates preserved; same-task fan-in remains unsupported. Owner authorized the focused fixed `swarm_amend` prerequisite. Private runtime workspace `/root/src/repos/agent-swarm-amend` holds its genuine separate repair plan `e4d3e0ce-137b-5ee6-bbc5-43df220677ba`; the original redteam13-task state remains untouched. Verify atomic typed pins/dependency/acceptance appends, load the operation through the supported host lifecycle, then perform actual signed corrective allocations and original bindings. Preserve DONE history, signing/approvals/gates and original product correlation; no raw TaskStore mutation, forged state/signature or unsigned fallback. Routing evidence: `.planning/v1.5-CONTROLLER-ROUTING.md`. |

## Phases

<details>
<summary>✅ v1.4 Hardening & Validation (Phases 21-25) — SHIPPED 2026-10-13</summary>

- [x] Phase 21: Retroactive Validation (Phases 15–20) (3/3 plans) — completed 2026-10-12
- [x] Phase 22: ROE Text as Server State (1/1 plans) — completed 2026-10-12
- [x] Phase 23: One Risk Signal (1/1 plans) — completed 2026-10-13
- [x] Phase 24: Ops Evidence on This Host (1/1 plans) — completed 2026-10-13
- [x] Phase 25: Lint Re-baseline & Close-Out (1/1 plans) — completed 2026-10-13

</details>

- [x] **Phase 26: Runtime Authority, Bound Inputs and Retained Execution** — Operators can submit authorized, identity-bound work and retrieve truthful retained outcomes without changing legacy Red behavior. (completed 2026-10-15)
- [x] **Phase 27: Blue, Black and White Substantive Capability Parity** — Real role-specific tools, engines, prompts and corpus guidance deliver evidence-bound defensive, tradecraft and governance outcomes. (completed 2026-10-15)
- [ ] **Phase 28: Runtime-connected Four-Hat UI, MCP, Skills and Explicit Synthesis** — Existing product surfaces consume the same real role-bound contracts, lifecycle and explicit correlated synthesis.
- [ ] **Phase 29: Integrated Acceptance and Governed Closure** — The owner can assess all requirements against actual integrated evidence before authentic gates and milestone closure.

## Phase Details

### Phase 26: Runtime Authority, Bound Inputs and Retained Execution

**Goal**: Operators can submit scoped, role-authorized mission/task inputs, receive immutable origin-bound identities and retrieve retained real outcomes while existing Red starts and execution remain usable.
**Depends on**: Phase 25 historical completion; owner-approved roadmap and closure of all four adoption prerequisites above. Complete and adopt data/ingestion/trust/compatibility contracts before product code.
**Requirements**: AC-FH-001, AC-FH-003, AC-FH-005, AC-FH-006, AC-FH-007, AC-FH-008, AC-FH-009, AC-FH-010, AC-FH-011, AC-FH-012, AC-FH-019, AC-FH-020, AC-FH-024, NFR-FH-SEC-01, NFR-FH-DATA-01, NFR-FH-REL-01
**Success Criteria** (what must be TRUE):
  1. Operators can inspect a source-linked inventory of the original eight Red workflows and their real tools/skills/prompts, contracts, configuration, lifecycle and entry points; all 17 roles map to exactly four disciplines with correct specialist parents and Purple only as synthesis.
  2. A genuine authorized Red tracer creates a mission/task, binds the supplied objective and selected target or permitted input references, executes and retrieves its complete redacted result; legacy target-based omission/empty/duplicate role behavior and actual Red seeding remain compatible. New explicit roles are validated, Blue AI/agent families route defensively, and not-yet-registered hat executors report unavailable rather than fake completion.
  3. Direct, model-requested, batched and backend-seeded forbidden/invalid/out-of-scope/unapproved operations fail before handler invocation with zero effects; per-run grants stay isolated, empty/unknown grants grant nothing, poisoned inputs cannot change authority, and secrets/restricted context do not leak.
  4. Operators can submit bounded selected inline artifacts through the adopted mission-start/dispatch contract, obtain server-computed hashes and real atomic mission binding, and distinguish claimed imported metadata from internally observed item-bound receipts after actual computation; IDs, summaries and caller labels alone cannot create evidence.
  5. Progress, failure, partial output, deadline expiry, late results and restart-retained results keep original hat/specialist/task/mission/input attribution within existing finite execution/retry policies; valid evidence survives, unsupported cancellation is stated honestly, and scheduler stop or transport abort never masquerades as acknowledged termination/resume.

**Plans**: TBD
**Scope/ownership**: Adopt A03/A04 amendments and A07 data/IO/trust/retention detail first, then C1 → serialized C2/C3 windows with one shared integration owner. Preserve existing TaskQueue, Arsenal, snapshots, ledgers, providers and Red contracts; no new persistence/execution platform. Q1 is phase-local authority coverage, not a claim any checks ran here.
**Cross-phase checks**: Domain-specific registered tools and loaded guidance complete in Phase 27; all six published skill input paths and UI byte adapters complete in Phase 28. Phases 27-29 recheck authority, privacy, finite lifecycle and Red compatibility without duplicating primary requirement ownership.

### Phase 27: Blue, Black and White Substantive Capability Parity

**Goal**: Operators obtain substantive, genuinely computed Blue, Black and White outcomes from registered permitted tools, staged workflows and loaded role/domain/corpus guidance rather than cosmetic parity.
**Depends on**: Phase 26 stable adopted DTO/authority/data/receipt interfaces, real retained execution and FH-EXEC-4 scheduling closure before independent parallel work.
**Requirements**: AC-FH-013, AC-FH-014, AC-FH-015, AC-FH-016, AC-FH-018, AC-FH-021, AC-FH-022, AC-FH-023, AC-FH-025, AC-FH-026, AC-FH-027, AC-FH-028, AC-FH-029, AC-FH-030, AC-FH-031, AC-FH-032, AC-FH-033, AC-FH-034, AC-FH-035, AC-FH-036, NFR-FH-AVAIL-01
**Success Criteria** (what must be TRUE):
  1. Each claimed Blue/Black/White parent and specialist operation resolves from discovery to a registered role-permitted implementation with documented structured input/output/errors and real stage/evidence/reassessment receipts; profile/grant/catalog names agree, every specialist is within its parent, and one optional dependency failure leaves unaffected hats and Red usable.
  2. Blue/Sentinel/Warden consume actual selected artifacts across supported web/cloud/code/secrets/AI/agent scenarios, compute finding-linked coverage, replay matching and benign detector cases offline and evaluate item-linked before/after controls. Recommendations/templates are not validated detections or resolved fixes; Sigma syntax-only/unsupported replay, missing YARA and other unavailable prerequisites remain explicit with next actions, without live probes/EDR/SIEM/remediation.
  3. Black/Specter/Wraith analyze the supplied action plan and every submitted finite-cost path with stable IDs and aggregate budgets, distinguish empty/insufficient plans and modeled/declared routes from authentic relevant observations, retain assumptions/reassessment evidence and refuse destructive concealment, unapproved probing and live bulk exfiltration without effects.
  4. White/Arbiter/Auditor apply established normalized host/IP/domain scope and fail-closed actual ROE/approval stamps to submitted actions, consider paired opposed claims in one neutral ruling, and retain item provenance, missing required evidence, appeal conditions and insufficient aggregates rather than count-based sufficient/100 scores.
  5. Runtime context actually loads dedicated parent/specialist role, workflow and supported-domain guidance plus all three evidence/tool/validation/completion-aware corpus briefings; imported plans/frameworks and dangerous corpus examples stay untrusted data, and dormant prompts or tool counts cannot establish parity.

**Plans**: TBD
**Scope/ownership**: B1, K1, W1 and P1 are genuinely independent, file-disjoint packages after Phase 26 interface freeze. One shared integration owner then registers/loads every real exported tool and guidance through C2/C3 and the relevant I1 adapter/loader window. Hat workers request shared-file changes rather than edit those files. Q2 supplies real behavioral coverage for these outcomes.
**Cross-phase checks**: HTTP/MCP/published skill populated contracts, nonempty Black request forwarding and six-skill receipts are completed across Phase 28 consumer integration; no narrowed core-only receipt substitutes for required public paths. Final full parity matrix, actual all-surface evidence and any material asymmetry acceptance belong to Phase 29. Missing validator support remains open unless genuinely supplied/evidenced or explicitly accepted by the owner, not silently deferred.

### Phase 28: Runtime-connected Four-Hat UI, MCP, Skills and Explicit Synthesis

**Goal**: Operators use the existing static UI, API/MCP and published skills to configure and run the same real four-hat capabilities with accessible, attributed lifecycle feedback and explicit evidence-correlated synthesis.
**Depends on**: Phases 26 and 27 real contracts, registered implementations and retained results; serialized C3/I1 consumer boundaries and U1 shell interface before dependent UI workspace work.
**Requirements**: AC-FH-017, AC-FH-037, AC-FH-038, AC-FH-039, AC-FH-040, AC-FH-041, AC-FH-042, AC-FH-043, AC-FH-044, AC-FH-045, AC-FH-046, AC-FH-047, AC-FH-048, AC-FH-049, AC-FH-050, AC-FH-051, AC-FH-052, AC-FH-053, AC-FH-054, AC-FH-055, AC-FH-056, NFR-FH-A11Y-01
**Success Criteria** (what must be TRUE):
  1. Operators discover all four disciplines and six correctly grouped specialists on existing overview/index, operators, mission, defend and arsenal surfaces; actual capability/prerequisite/permission forms accept usable bounded byte-bearing artifacts and submit objective-bound tasks with retrievable origin/evidence results. Existing themes/tokens, providers/settings, Red defaults and supported persistence remain compatible; no new page or redesign is introduced.
  2. All six specialist skill grammars bind their actual mission/scope/target/plan/action/path/evidence inputs through the same populated API/MCP contracts; six published skills, four templates, Dark Purple, grammar and manifests advertise only real tools, loaded prompts, validation/retest rules and truthful failure/retention behavior. Global/latest reports never replace selected input and local labels never become invented mission IDs.
  3. Operators see distinct loading, pending, completed, empty, unavailable, error, partial, timed-out/interrupted and retained-result states, retain valid drafts/evidence, submit once, reconcile lost ACKs and switch safely. Stale reads/late output cannot overwrite or relabel newer work; unsupported cancellation is explicit and no true cancel is advertised without authoritative acknowledgement.
  4. Explicit Purple synthesis forwards findings/detections/verdicts, ID mappings and relevant Black/Blue/White retained run references consistently through UI/MCP/skills; associations are order-independent and mission-correct, missing/claimed evidence and unresolved approval/retest conditions remain visible, riskTier/residualRisk agree, legacy positional mode is disclosed and proposals never auto-dispatch or delegate authority.
  5. Keyboard and assistive-technology users can operate all changed selection/configuration/dispatch/retry controls with meaningful labels/state, visible focus, associated errors and origin-correct live feedback without traps or focus theft; supported responsive layouts, text-based identity, WCAG AA contrast and reduced-motion behavior remain usable, including delayed responses after switches/closure and required recorded visual observation.

**Plans**: TBD
**UI hint**: yes
**Scope/ownership**: Serialized C3/I1 integrations; U1, U2, U3; S1, S2, S3, S4; D1 consumer contract documentation. U2/U3 may be independent only after their shared boundary is fixed and authenticated assignments support it. D1 API_REFERENCE ownership is serialized with C3. Existing settings/evidence pages need no unrelated redesign; use existing evidence links and provider conventions.
**Cross-phase checks**: Core permission/input/receipt guards remain authoritative and are rechecked against all clients; Phase 29 records the integrated real localhost/API/browser/keyboard/responsive/reduced-motion/security/Red acceptance and full requirement-to-evidence audit. Phase-level evidence is not milestone acceptance.

### Phase 29: Integrated Acceptance and Governed Closure

**Goal**: The owner can judge every requirement and substantive parity row against actual integrated behavior and authentic governance evidence before any milestone completion.
**Depends on**: Phases 26-28 completed under approved discuss → plan → execute flow; adoption blockers closed through supported authority; no unresolved unaccepted material scope gaps.
**Requirements**: AC-FH-002, AC-FH-004, AC-FH-057, AC-FH-058, AC-FH-059, AC-FH-060, AC-FH-061, AC-FH-062, AC-FH-063, AC-FH-064, NFR-FH-COMP-01, NFR-FH-EVID-01, NFR-FH-MAINT-01
**Success Criteria** (what must be TRUE):
  1. The owner can inspect all 64 AC/eight NFR outcomes and every substantive Red-baseline parity row with exact authenticated implementation ownership, source/call paths, separate real tool/skill/prompt inventories, actual check/visual evidence and release scope; material gaps remain unavailable/unverified or have explicit owner acceptance, never a cosmetic score, stub or follow-up relabeled complete.
  2. Actual credential-isolated localhost API and real browser flows demonstrate all four disciplines and representative six-specialist selection/configuration/dispatch/attributed output plus useful positive, negative, partial/recovery/switch cases. Request/result/evidence/screenshot, keyboard, responsive, reduced-motion and visual records distinguish real execution from mocks, static pins and no-model roster reads, without unauthorized model/external target operations.
  3. Integrated security and failure-isolation evidence demonstrates zero forbidden effects for relevant malformed command/file/path/URL/symlink/redirect/scope/prompt attacks, preserved origin/Host/CSRF/bearer/rate/redaction controls and finite termination, with no secret/restricted-context leakage, fake fallback or disabling unaffected hats.
  4. All enumerated supported Red workflows, settings/providers, ledgers, legacy start/seeding and public contracts remain usable through regression fixtures and a genuine local representative flow; required security corrections are documented with all affected consumers migrated and unavailable prerequisites disclosed.
  5. The owner can follow authentic TaskStore gate evidence and actual GSD phase/ownership records through the full-scope audit → complete → prescribed cleanup only after acceptance and truthful existing docs/changelog updates after smoke; original history/issue lineage and deferred debt survive, with no premature ship, deployment, merge or unrelated milestone completion.

**Plans**: TBD
**UI hint**: yes
**Scope/ownership**: Parent owns union verification after dependent edits land, with Q1/Q2 evidence carried forward, Q3 integrated API/browser/security evidence and A08/A09/A10/trusted canonical gates under genuine assignments. D1 publishes truthful observed examples/docs/changelog after smoke and before closure. Exact Q3 evidence/check paths and plan counts are selected only in approved planning; none are invented here.
**Cross-phase checks**: Revalidate every phase's authority/data/lifecycle/availability/accessibility NFR and full parity matrix, even where its primary completion mapping is earlier. Existing observed failing-before boundaries and historical baseline results are inputs, not checks to rerun solely for confirmation and not post-change acceptance. This metadata assignment runs no checks or gates and performs no TaskStore transitions.

## File-disjoint Delivery Boundaries

A03 §12 identifiers below are proposed work-package labels, not issued task IDs, leases, new tracker rows or signed assignments. Every real implementation assignment remains path-bounded (at most five paths), under supported authenticated scheduling resolved by FH-EXEC-4. C1/C2/C3/I1 share one integration owner and serialized editing windows across phases; no shared-file editor fan-out. Parent verifies the union after all dependent edits land, never parallel sibling checks on half-finished work.

| Slice | Exact allocated product paths from A03 §12 (planning proposal only) | Phase/dependency |
|---|---|---|
| C1 | `src/types/index.ts`; `src/teams/contracts.ts` (new); `src/arsenal/index.ts`; `src/agent/index.ts`; `src/validation/index.ts` | 26; adopted data/IO/trust contracts first; freeze DTO/authority interfaces |
| C2 | `src/index.ts`; `src/mission/index.ts`; `src/operators/index.ts`; `src/teams/index.ts`; `src/teams/hats.ts` | 26 then serialized registration/correctness integration in 27; same shared owner |
| C3 | `src/server.ts`; `docs/API_REFERENCE.md` | 26 retained API/data/receipt/snapshot integration with A07 input; serialized 28 client integration |
| B1 | `src/teams/blue/workflow.ts` (new); `src/teams/blue.ts`; `src/teams/blue/coverage.ts`; `src/teams/blue/rulepacks.ts`; `src/prompts/blue.ts` (new) | 27; after stable 26 interfaces |
| K1 | `src/teams/black/workflow.ts` (new); `src/teams/black/exfil.ts`; `src/teams/black/noise.ts`; `src/teams/black/checklist.ts`; `src/prompts/black.ts` (new) | 27; independent of B1/W1 |
| W1 | `src/teams/white/workflow.ts` (new); `src/teams/white.ts`; `src/teams/white/evidence-chain.ts`; `src/teams/white/report-auditor.ts`; `src/prompts/white.ts` (new) | 27; independent of B1/K1; reuse existing ROE parser |
| P1 | `src/resources/ai-defense-playbook.ts`; `src/resources/ai-tradecraft-playbook.ts`; `src/resources/ai-adjudication-playbook.ts` | 27; after schemas; independent corpus work with actual TS code authority |
| I1 | `src/arsenal/adapter-tools.ts`; `src/prompts/index.ts`; `src/teams/purple.ts`; `src/mcp-server.ts` | 27 adapter/loader then 28 MCP/synthesis; sole shared integration writer after hat exports |
| U1 | `docs/assets/shell.js`; `docs/assets/tokens.css`; `docs/overview.html`; `docs/index.html` | 28 foundation/landing; adopted shared/UX contracts |
| U2 | `docs/operators.html`; `docs/defend.html`; `docs/mission.html` | 28 workspace after U1 and real C3/I1 boundaries |
| U3 | `docs/arsenal.html`; `docs/IA.md` | 28 toolkit/IA after discovery contract; no concurrent shell edits |
| S1 | `grokbot/skills/blue-sentinel/SKILL.md`; `grokbot/skills/blue-warden/SKILL.md`; `grokbot/templates/BLUE.md` | 28; actual Blue/C3/I1 contracts |
| S2 | `grokbot/skills/black-specter/SKILL.md`; `grokbot/skills/black-wraith/SKILL.md`; `grokbot/templates/BLACK.md` | 28; actual Black/C3/I1 contracts |
| S3 | `grokbot/skills/white-arbiter/SKILL.md`; `grokbot/skills/white-auditor/SKILL.md`; `grokbot/templates/WHITE.md` | 28; actual White/C3/I1 contracts |
| S4 | `grokbot/skills/GRAMMAR.md`; `grokbot/skills/index.json`; `grokbot/skills/dark-purple/SKILL.md`; `grokbot/templates/RED.md`; `grokbot/README.md` | 28; shared published integration after APIs and six specialist consumers |
| D1 | `docs/API_REFERENCE.md`; `docs/MCP_GUIDE.md`; `docs/CHANGELOG.md`; `docs/TEAM_PREVIEW.md`; `docs/SCOPE_AND_AUTHORIZATION.md` | 28 consumer docs then 29 truthful post-smoke closure docs; serialize API_REFERENCE with C3 |
| Q1 | `src/__tests__/teams-archetypes.test.ts`; `src/__tests__/teams-modules.test.ts`; `src/__tests__/hats-archetypes.test.ts`; `src/__tests__/hats-modules.test.ts` | 26-27 behavioral authority coverage; 29 union evidence |
| Q2 | `src/__tests__/blue-suite.test.ts`; `src/__tests__/black-suite.test.ts`; `src/__tests__/white-suite.test.ts`; `src/__tests__/purple-v2.test.ts`; `src/__tests__/grokbot-hats.test.ts` | 27-28 substantive domain/consumer coverage; 29 union evidence |
| Q3 | Parent selects exact existing check/evidence paths in approved Phase 29 plans, at most five per real assignment; no fabricated browser suite or output | 29 local API/browser/keyboard/responsive/reduced-motion/security/Red proof |

No new dependencies, platforms, hats, deployment, broad migration, unrelated debt or product edits are authorized by these planning paths. Preserve original Red/toolkit contracts, existing security posture and the user's untracked `coverage-pr/`; no branch reset, archival or deletion occurs here.

## Progress

Execution order after mandatory adoption/prerequisites: 26 → 27 → 28 → 29. Within phases, real parallel independent slices require authenticated path ownership, one aggregate lease/budget/fan-in policy and serialized shared integration. Approved `gsd-autonomous` intent retains discuss → plan → execute and all authentic gates; it does not waive roadmap acceptance or blockers.

| Phase | Plans Complete | Status | Completed |
|---|---|---|---|
| 26. Runtime Authority, Bound Inputs and Retained Execution | 2/2 | Complete    | 2026-10-15 |
| 27. Blue, Black and White Substantive Capability Parity | 5/5 | Complete    | 2026-10-15 |
| 28. Runtime-connected Four-Hat UI, MCP, Skills and Explicit Synthesis | 0/TBD | Not started | - |
| 29. Integrated Acceptance and Governed Closure | 0/TBD | Not started | - |

**Primary traceability:** Phase 26: 13 AC + 3 NFR = 16; Phase 27: 20 AC + 1 NFR = 21; Phase 28: 21 AC + 1 NFR = 22; Phase 29: 10 AC + 3 NFR = 13. Total: 64 AC + 8 NFR = **72/72 mapped exactly once**, zero orphans/duplicate primary assignments; all Pending. Cross-phase integration/check notes are dependencies, not duplicate requirement completion. Canonical row mapping is the GSD Traceability section of REQUIREMENTS.md; the signed A02 source above it is unchanged. Coverage is proposal coverage, not acceptance or an exercised validation result.

## Deferred milestone candidates

Deferred outside the approved v1.5 parity scope. Candidate scope is recorded in `.planning/PROJECT.md` (Next Milestone section):
the five v1.4 audit tech-debt follow-ups (F-20-01 prompt-audit divergence; stale v1.3 audit
Nyquist prose; operators.html Tier-cell browser render + 23-VERIFICATION status-field
reconciliation; F-25-01 lint-scope widening; stray repo-root artifact file) plus the deferred
v2 requirements (persisted ROE verdict ledger and revision history, purple auto-consumption of
recorded verdicts, ROE text provenance, install-and-launch verification of the built
`.deb`/AppImage, per-rule lint budgets + doctor-integrated lint gate). Bootstrap the next
milestone with `/gsd:new-milestone`.
