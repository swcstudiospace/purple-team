# Phase 26: Runtime Authority, Bound Inputs and Retained Execution - Research

**Researched:** 2026-10-15
**Domain:** Existing T3MP3ST mission start, role grants, evidence ledger, and retained execution
**Confidence:** HIGH for current source behavior; MEDIUM for the adopted contract shape inside locked discretion

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Blue, Black, and White substantive tools, workflows, prompts, and corpus briefings — Phase 27.
- UI, MCP, and published-skill binding of the same contracts — Phase 28.
- Full parity matrix, browser proof, and milestone closure — Phase 29.
- Color tokens and visual identity — Phase 28, per the 2026-10-15 owner choice.
- v1.4 audit follow-ups and v2 ROE revision history — next milestone.
- Mounting `swarm_amend` in this host — controller prerequisite, not a Phase 26 product file.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AC-FH-001 | Source-linked inventory of the eight Red workflows and their tools, skills, prompts, contracts, config, lifecycle, UI entry points, and checks; unavailable items labeled | Inventory cites real paths below. Put the rows in new `src/teams/contracts.ts` and the operator-facing summary in `docs/API_REFERENCE.md`. Do not invent a ninth product file. |
| AC-FH-003 | Only Red, Blue, Black, White are disciplines; six specialists keep parents; Purple is not spawnable | `OperatorArchetype` is the 17-role union and excludes `purple`. `TEAM_ARCHETYPES` / `HAT_ARCHETYPES` / `hatTeam` are the parent tables. |
| AC-FH-005 | Selected supported roles instantiate with real profiles; unknown explicit roles fail actionably; no silent zero-worker success on the structured branch | Legacy start silently skips non-Red operators. Structured branch must reject before `createTempestCommandInstance`. |
| AC-FH-006 | Dispatch carries objective and target or artifact-only context and a traceable task/run id; spawn alone is not dispatch | Existing `POST /api/operators/:id/task` uses the first target and `missionId: 'manual'` when no active mission. Artifact-only must not use that fallback. |
| AC-FH-007 | Blue is selectable for `ai_red_team` and `agent_warfare`; original mappings stay; family label grants no offensive tool | `FAMILY_TEAM_MAPPING.blue` omits both families today. Add Blue there. Do not remove Black. Do not change grant tables from a family string. |
| AC-FH-008 | Progress, completion, failure, late output, and handoff keep original hat, specialist, task, mission, and input refs | HTTP dispatch builds a plain object and does not pin a server-issued origin. Retain that origin on the run record, not in the caller body. |
| AC-FH-009 | Forbidden tool requests from the model, a batch, or a backend seed are denied before the handler | `getToolDefinitions` hides names. `Arsenal.execute` does not re-check the role allowlist. The deny belongs in `execute` before `tool.handler`, fed by a per-run frozen set from `AgentLoop.executeTool`. |
| AC-FH-010 | Blue/White cannot probe or change a target; Black stays inside analysis plus its existing narrow route-verification authority | `ARCHETYPE_PROFILES.defaultTools` for those roles still lists probe tools. Those profiles are not the authority. |
| AC-FH-011 | Invalid args, out-of-scope targets, and missing approval still reject before the operation; approval does not widen role or scope | Scope, approval, and `validateToolArgs` already run before `tool.handler` inside `Arsenal.execute`. Keep them. Do not let an approval id bypass the new role check. |
| AC-FH-012 | Each run uses only its own grant; empty or unknown grants grant nothing; one run cannot widen another | One shared `Arsenal` instance serves every operator. A process-global allowlist is the wrong seam. |
| AC-FH-019 | Failure classes stay distinguishable; retries stay inside existing finite limits and cannot change hat or input | Use `maxRetries: 3`, `DEFAULT_AGENT_MAX_ITERATIONS = 15`, and the existing task timeout. Do not add a scheduler. Denied and invalid work must not enter LLM decomposition. |
| AC-FH-020 | Completed evidence stays attached; noncompletion is explicit; unsupported cancellation is not acknowledged; retry does not repeat a completed side effect | `stop` / `pause` / response `close` are not task-cancel ACKs. No cancel route exists. Snapshot has no `operatorTaskRuns` slot yet. |
| AC-FH-024 | Poisoned user text, findings, tool output, and imports cannot replace role instructions, change grants, authorize a target, or promote a hypothesis | Task text is concatenated into the user message. Grants are not read from that text today, but a complying model can still call a registered tool because execute does not enforce the allowlist. |
| NFR-FH-SEC-01 | Zero handler invocations and zero side effects for role-denied, out-of-scope, invalid, or unapproved cases | Same gate as AC-FH-009–012. Count handler calls in tests. |
| NFR-FH-DATA-01 | No configured-secret markers in surfaced or stored fixtures; no cross-role or cross-mission leakage | Hash before redaction. Do not persist raw artifact bytes through `redactSecrets`. Do not name hash fields with `secret` or `token`. |
| NFR-FH-REL-01 | Termination or timeout stays inside existing bounds; retry count stays inside existing policy; recovery fixtures do not repeat completed side effects | Existing timeout and `maxRetries` only. |
</phase_requirements>

## Summary

Phase 26 is a contract adoption on the current server, not a new platform. `POST /api/mission/start` still requires at least one target, spawns only the original eight Red archetypes, silently skips every other operator string, and does not read `roleInputs`, `family`, `targetContext`, or `inlineArtifacts`. `.planning/STATE.md` says those resolutions are already partial or adopted. That note is ahead of `src/server.ts`. Plan against the handler, not the note. FH-EXEC-4 is not closed: `ULTRATHINK_SWARM_ROOT` is unset, this session has no `swarm_amend` tool, and product plans must not invoke `/root/src/repos/agent-swarm-amend/scripts/orch_amend.py`.

The grant tables the UI projects are `teamToolGrants` and `hatToolGrants`. They are not what stops a handler. `laneToolGrants` writes them into advisory `allowed_tools` and says no runtime enforcement reads that field. The live model path offers `ARCHETYPE_PROFILES.defaultTools` as a schema filter, then `AgentLoop.executeTool` calls `Arsenal.execute` with no role check. Scope, approval, and argument validation already return or throw before `tool.handler`. A registered tool outside the offered schema still reaches the handler. That is the AC-FH-009 hole. The Arsenal instance is shared, so the allowlist has to travel on the call, not on the registry.

Bind the bounded inline artifact on the existing start route, because the hunt form already posts `inlineArtifacts` there and dispatch cannot create the mission. Stage the server-computed hash before `cmd.start()`, and consume it inside mission creation before the tick interval arms. Absent `roleInputs`, `family`, and `targetContext` must keep today's target requirement, empty-operator start, and duplicate-callsign skip. Presence of `inlineArtifacts` alone must not flip that branch: the UI already sends it on ordinary Red starts.

Observed origin does not exist on the live ledger. `EvidenceEntry` has no `origin` field. `POST /api/evidence` copies caller `source` and `provenanceStrength`. The team analysis routes are GET-only. A successful ROE parse stores a `RoeRecord`; it does not write an evidence receipt. C3 should add one private writer after real computation and refuse caller-supplied origin. Do not add `POST /api/mission/artifacts` or public receipt-minting routes that STATE and `docs/API_REFERENCE.md` describe but the server does not have.

**Primary recommendation:** One serialized owner, C1 then C2 then C3, on the existing Express process, snapshot file, and `node:crypto` hash. No new dependency, scheduler, or store.


## Project Constraints (from CLAUDE.md)

`.planning/config.json` is absent. `CLAUDE.md` is absent at the project root. Roadmap text is the project constraint: no config file is created, and `.planning/research/SUMMARY.md` is historical v1.4 research, not a v1.5 architecture mandate. [VERIFIED: ROADMAP.md:18-20]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Red workflow inventory | API / Backend contract module | Docs projection | Operators need cited paths, not a new database. `src/teams/contracts.ts` holds the rows; `docs/API_REFERENCE.md` summarizes them. |
| Four-discipline identity and family routing | API / Backend | — | `TEAM_ARCHETYPES`, `HAT_ARCHETYPES`, `hatTeam`, and `FAMILY_TEAM_MAPPING` already own this. The browser must not decide grants. |
| Legacy versus structured start | API / Backend | — | The discriminator is the HTTP body. Mission creation stays in `TempestCommand.ensureMission`. |
| Bounded inline artifact binding | API / Backend | — | Hash and bind on the server in the same synchronous turn as `createMission`, before the tick loop. |
| Role denial before handler | API / Backend | — | `AgentLoop.executeTool` is the model, batch, and backend-seeded path. `Arsenal.execute` is the last line before `tool.handler`. |
| Claimed versus observed receipts | API / Backend | Existing evidence ledger | Private writer in `src/server.ts` only. Public POST stays unable to set origin. |
| Retained run attribution | API / Backend | Existing `t3mp3st_state/v1` snapshot | Add an absent-tolerant slot. Do not add a second queue or scheduler. |
| UI, MCP, and skill consumers | — | — | Phase 28. Phase 26 must not require those files to close. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript ESM on Node | `node` v24.18.0; `engines.node` `>=22.19.0` | Existing server and command | Already the product runtime. [VERIFIED: package.json engines; `node --version`] |
| express | existing dependency; `express.json({ limit: '10mb' })` at `src/server.ts:335` | HTTP entry | Do not add a second server. |
| `node:crypto` `createHash` | Node built-in, already used at `src/server.ts:6608` and `:1150` | Server-computed artifact and receipt hashes | Do not hand-roll a digest. |
| vitest | `^4.1.9` in package.json; config `include: ['src/**/*.test.ts']` | Phase checks | Existing suite. No new test runner. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `redactSecrets` / `redactLedgerText` | in-repo `src/redact.ts` | Snapshot, HTTP, and log emission | Every new string that can leave the process |
| Existing `TaskQueue` / `MissionControl` | `src/mission/index.ts` | Mission and task identity | Do not add a scheduler |
| Existing `guardAction` / `scopeViolation` / `ApprovalController` / `validateToolArgs` | `src/server.ts`, `src/arsenal/index.ts`, `src/validation/index.ts` | Scope, approval, and argument gates | Keep them in front of handlers |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bind on `POST /api/mission/start` | Bind only on `POST /api/operators/:id/task` | Dispatch cannot create the mission, so binding there is not atomic with mission creation. Use dispatch only for a later task-scoped copy of an already bound artifact id. |
| New artifact store or `POST /api/mission/artifacts` | Existing command memory plus one snapshot slot | STATE names that POST route. It is not in `src/server.ts`. Adding it would be a new public ingest, which the locked decision forbids as a fetch/mint path. |
| Full 64-char hex sha256 in JSON | 16-char stamp only, or hyphenated full digest | A 64-char hex string matches `redactSecrets` and becomes `[redacted]`. A 16-char slice survives but is only a stamp. See Pitfall 1. |

**Installation:** none. This phase installs no package.

**Version verification:** no new package names. Existing `vitest` spec is `^4.1.9` in `package.json`. Node on this host is v24.18.0.

## Package Legitimacy Audit

No external package is recommended. Nothing to install, so no registry verdict is required.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
legacy body (no roleInputs, no family, no targetContext)
        |
        v
POST /api/mission/start
        |
        +-- targets.length === 0 --> 400 "At least one target required"
        |
        +-- optional inlineArtifacts present?
        |         validate + hash BEFORE createTempestCommandInstance
        |         invalid --> 400, no mission
        |
        +-- eight-role whitelist, unknown operators skipped, duplicate callsign skipped
        |
        v
TempestCommand.start()
        |
        +-- ensureMission(): createMission(randomUUID) then startMission
        |         consume staged artifact hash in that same turn, before setInterval
        |
        +-- tick seeds Red tasks (generateTasksForTarget)
        |
        v
success JSON (today: no missionId field)

structured body (any of roleInputs, family, targetContext)
        |
        +-- missing objective, empty roles, unknown role, duplicate role
        |         --> 400 before createTempestCommandInstance
        |
        +-- targetContext.kind === 'artifacts' and no network targets
        |         do not insert "local-lab" or "pending targets"
        |         do not call generateTasksForTarget
        |
        v
spawn selected roles only
        |
        +-- Red archetype --> existing AgentLoop
        +-- hat/parent with no registered executor --> retained run state unavailable
                  never a model completion presented as the hat result

model / batch / backend-seeded tool call
        |
        v
AgentLoop.executeTool
        |
        +-- pass this run's frozen allowed names (empty set denies all)
        v
Arsenal.execute
        |
        +-- unknown name --> ToolNotFound, handler not called
        +-- name not in this run's allowlist --> deny, handler not called
        +-- scopeViolation --> SCOPE DENIED, handler not called
        +-- approval gate --> APPROVAL REQUIRED, handler not called
        +-- validateToolArgs --> ValidationError, handler not called
        v
tool.handler   (only after every gate above)
        |
        v
private recordReceipt after a real computation return
        |
        +-- POST /api/evidence cannot set origin
        +-- GET team routes stay read-only
        +-- historical EvidenceEntry rows without origin stay unlabeled
```

### Recommended Project Structure

Stay inside the roadmap path table. Do not add files outside it for this phase.

```text
src/types/index.ts                 # C1: DTO unions only; OperatorArchetype already has the 17 roles
src/teams/contracts.ts             # C1: new. Inventory rows, inline artifact contract, receipt shape, role allowlist helper
src/arsenal/index.ts               # C1: per-call allowlist check before handler
src/agent/index.ts                 # C1: executeTool always passes the frozen run allowlist
src/validation/index.ts            # C1: reuse validateToolArgs; add bounded artifact field checks only if they do not fit contracts.ts
src/index.ts                       # C2: stage artifact bind inside ensureMission before the tick interval
src/mission/index.ts               # C2: mission id is already randomUUID(); do not accept a caller mission id
src/operators/index.ts             # C2: do not treat defaultTools as Blue/Black/White authority
src/teams/index.ts                 # C2: add ai_red_team and agent_warfare to blue families; do not edit grant id lists to paper over probes
src/teams/hats.ts                  # C2: parent map stays; no new hat
src/server.ts                      # C3: branch the start handler; private receipt writer; snapshot slot
docs/API_REFERENCE.md              # C3: document the adopted contract; delete claims of routes that do not exist
src/__tests__/teams-archetypes.test.ts
src/__tests__/teams-modules.test.ts
src/__tests__/hats-archetypes.test.ts
src/__tests__/hats-modules.test.ts  # Q1, separate from the five-path C slices
```

`src/teams/contracts.ts` does not exist. [VERIFIED: filesystem check this session, `contracts=absent`]


### Pattern 1: Legacy versus structured start

**What:** The locked discriminator is the presence of `roleInputs`, `family`, or `targetContext`. `inlineArtifacts` is not a discriminator.

**When to use:** Every edit to `app.post('/api/mission/start')`.

**Current handler, verbatim:** [VERIFIED: src/server.ts:6800-6904]

```typescript
 * Body: { name, targets: [{ host, scope?, ports? }], operators: string[],
 *         apiKey, provider?, model?, opsecLevel? }
...
    targets = [],
    operators = [],
    apiKey,
    provider,
    model,
    baseUrl,
    repoPath,
  } = req.body;
...
  if (targets.length === 0) {
    res.status(400).json({ error: 'At least one target required' });
    return;
  }
...
    const validArchetypes: OperatorArchetype[] = ['recon', 'scanner', 'exploiter', 'infiltrator', 'exfiltrator', 'ghost', 'coordinator', 'analyst'];
    for (const opId of operators) {
      const archetype = opId as OperatorArchetype;
      if (validArchetypes.includes(archetype)) {
        const callsign = archetype.charAt(0).toUpperCase() + archetype.slice(1) + '-1';
        try {
          const op = cmd.spawnOperator(callsign, archetype);
```

Unknown operators, including `blue`, `black`, `white`, and the six hats, are skipped with no error. A duplicate callsign throws `Operator with callsign "${callsign}" already exists` from `OperatorCell.spawnOperator` and the handler logs and continues. [VERIFIED: src/operators/index.ts:962-966; src/server.ts:6899-6902]

`VALID_ARCHETYPES` at `src/server.ts:7111` already spreads `TEAM_ARCHETYPES` and `HAT_ARCHETYPES`, but mission start does not use it. `POST /api/operators/spawn` casts `archetype as OperatorArchetype` and does not consult `VALID_ARCHETYPES` either. [VERIFIED: src/server.ts:7111, 7148-7166]

**Plan:** If `roleInputs`, `family`, and `targetContext` are all absent, keep the block above, including the 400 text `At least one target required`. If any of those three is present, validate before `createTempestCommandInstance`: nonempty string `objective`, nonempty `operators`, every entry in the 17-role union, no duplicate archetype (the callsign is `${archetype}-1`). Return 400 with the offending role. Do not spawn and then skip. Do not require nonempty operators on the legacy branch.

### Pattern 2: Atomic inline artifact bind

**What:** Hash submitted bytes on the server and attach that record to the mission id before the mission is observable as started.

**When to use:** Optional `inlineArtifacts` on start. Also accept the same object on `POST /api/operators/:id/task` only as a reference to an id already bound on that mission, or as a task-scoped copy hashed before `assignTask`. Do not create the mission from dispatch.

**Why this route:** `docs/index.html` and `docs/overview.html` already post the field when the textarea is nonempty. [VERIFIED: docs/index.html:441-448]

```javascript
    var body = { name: missionName, targets: targets, operators: operators, missionKey: missionKey, provider: provider, model: model, approvalId: approvalId };
    var draft = document.getElementById('heroArtifactDraft');
    var artifactText = draft && draft.value ? draft.value : '';
    if (artifactText.trim()) {
      body.inlineArtifacts = [{ id: 'draft-1', mediaType: 'text/plain', encoding: 'utf8', data: artifactText }];
    }
    return T3MP3ST_API.post('/api/mission/start', body);
```

The server ignores that field today. An empty textarea omits it, which is the legacy fixture. Phase 26 does not edit those HTML files (Phase 28). The server must accept this shape so the existing client is not broken, and must not treat `id: 'draft-1'` as evidence.

**Atomic seam:** `start()` calls `ensureMission()` and then `setInterval`. [VERIFIED: src/index.ts:802-822] `ensureMission` calls `createMission` then `startMission`. [VERIFIED: src/index.ts:828-839] `createMission` assigns `id: randomUUID()` and does not take a caller id. [VERIFIED: src/mission/index.ts:241-263] The description fallback uses the target names, and those names become the string `pending targets` when no target exists. [VERIFIED: src/index.ts:831-837] That string must not become a structured artifact-only target.

Bind by staging validated artifacts on the command object before `start()`, and writing the mission-linked record inside `ensureMission` before `startMission` and before `setInterval`. If staging fails, return 400 or 413 and do not call `start()`. If the in-memory attach throws, do not respond `success: true`. Do not bind after `res.json`.

**Discretion adopted here:**

- Cap: `64 * 1024` utf8 bytes, same constant style as `ROE_BODY_CAP_BYTES` at `src/server.ts:6583`. Check with `Buffer.byteLength` before mission creation. Over cap returns 413, matching the ROE route. The global parser limit is `'10mb'` and is not a sufficient cap. [VERIFIED: src/server.ts:335, 6583-6598]
- Media enum: `text/plain` only. Encoding enum: `utf8` only. Anything else is 400. Phase 28 can widen the UI adapter later; Phase 26 must not accept arbitrary media or base64-as-command.
- One artifact per start is enough for the client that already sends a one-element array. A second element is 400, not a silent drop.
- Server issues the artifact id. Caller `id` may be echoed as a label only. Evidence identity is the server hash plus the mission id.
- Hash the exact submitted utf8 bytes before redaction. Public and snapshot fields use the hyphenated full digest in Pitfall 1, not the raw 64-char hex.
- Do not store raw bytes in `buildStateSnapshot`. Store hash, media, encoding, byte length, and a `redactLedgerText` preview. Live process memory may hold the raw string until stop. After restart, `bytesRetained: false` unless the redacted preview equals the original. Say that honestly. Do not refetch.

**Artifact-only branch:** Only when `targetContext` is `{ kind: 'artifacts', artifactIds }` (proposal shape) and the body has no network targets. Require the inline artifact to be present and hashed in that same request, because no pre-mission artifact store exists. Selected roles must be `blue`, `black`, `white`, or a hat. Do not spawn Red kill-chain seeding. A legacy body with zero targets still returns `At least one target required`.

### Pattern 3: Private observed receipt

**What:** One function in `src/server.ts`, not exported over HTTP, writes a ledger row only after a computation function has returned.

**When to use:** After real computation already in this process. The first honest hook is a successful `parseRoe` on `PUT /api/teams/white/roe`, which already runs and does not write an evidence row. [VERIFIED: src/server.ts:6605-6621] Do not write a receipt on parse failure. Do not write receipts from GET handlers. These routes are GET and must stay read-only: `/api/teams/blue/gaps`, `/api/teams/black/cover`, `/api/teams/black/noise`, `/api/teams/white/evidence`, `/api/teams/white/report-audit`.

**Do not implement these routes. They are not in `src/server.ts`:**

- `POST /api/mission/artifacts`
- `POST /api/teams/blue/gaps`
- `POST /api/teams/blue/rules`
- `POST /api/teams/blue/hardening`
- `POST /api/teams/black/cover`
- `POST /api/teams/black/noise`
- `POST /api/teams/white/evidence`
- `POST /api/teams/white/report-audit`

STATE and `docs/API_REFERENCE.md` describe them. Grep of `src/server.ts` found only the GET forms plus `PUT /api/teams/white/roe` and `POST /api/teams/purple/synthesize`. C3 should correct the API reference so it stops claiming those POSTs write observed receipts. Do not add the POSTs in order to make the stale doc true. Phase 27 engines call the private writer; they do not gain a public mint route.

**Live ledger shape, verbatim:** [VERIFIED: src/server.ts:720-734]

```typescript
interface EvidenceEntry {
  id: string;
  missionId?: string;
  operationId?: string;
  findingId?: string;
  type: EvidenceType;
  title: string;
  summary: string;
  source: 'human' | 'agent' | 'tool' | 'system';
  provenanceStrength: EvidenceProvenanceStrength;
  uri?: string;
  command?: string;
  resourceIds: string[];
  createdAt: string;
}
```

`POST /api/evidence` copies caller `source` and `provenanceStrength` and does not read an origin field. [VERIFIED: src/server.ts:5774-5789] Leave that POST unable to set `origin`. Public, legacy, and imported rows stay without `origin`, or with server-forced `origin: 'claimed'` only on rows this phase newly accepts as imports. Do not backfill historical rows to `claimed` or `observed`. `auditEvidenceChain` already treats absent origin as not an authentic observation. [VERIFIED: src/teams/white/evidence-chain.ts:31-34]

```typescript
  /** Public label. Absent means the entry did not claim an authentic observation. */
  origin?: 'claimed' | 'observed';
```

**Internal shape to add, optional fields only, ignored on public POST:** `origin`, `observation` with `tool`, `stage`, `inputSha256`, `runId`, and `missionId`, plus `itemId`. `recordReceipt` sets `origin: 'observed'` itself. Restore must reject a snapshotted `origin: 'observed'` row that lacks `observation.tool`, `observation.stage`, `observation.inputSha256`, `observation.runId`, and `observation.missionId`: drop the origin label back to absent rather than trusting a hand-edited `state.json`. Do not upgrade the other fields. `replaceMapContents` currently stores any object with a string `id` with no origin check. [VERIFIED: src/server.ts:1176-1183, 1266]

Proposal `recordReceipt` in `.planning/v1.5-RUNTIME-CONTRACTS.md` section 9 is a proposal, not a function in the tree. Implement the private writer in C3. Do not import a module that does not exist.

### Pattern 4: Deny before the handler, per run

**What:** Freeze the run's callable built-in names at spawn. Pass that set into every `arsenal.execute` from `AgentLoop`. Check it before `tool.handler`.

**When to use:** Model tool calls, the concurrent batch in `AgentLoop.run`, and `getLocalReconBootstrap` (the backend-seeded path). All three already funnel through `executeTool`. [VERIFIED: src/agent/index.ts:173-175, 237-259, 424-437]

`getToolDefinitions` filters the schema only. [VERIFIED: src/arsenal/index.ts:495-503]

```typescript
    if (names?.length) {
      tools = tools.filter(t => names.includes(t.name));
    } else if (categories?.length) {
      tools = tools.filter(t => categories.includes(t.category));
    }
```

An empty `names` array is treated as "no name allowlist", then categories, then every tool. `AgentLoop` passes `this.options.tools` only when `length > 0`. [VERIFIED: src/agent/index.ts:162-164] That is the empty-grant hole. An empty set must be passed through and must deny every name.

`Arsenal.execute` looks up the full registry and calls the handler after scope, approval, and validation. [VERIFIED: src/arsenal/index.ts:370-442] There is no role check. Production callers of arsenal `execute` are `AgentLoop.executeTool` only. Tests call `execute` without an allowlist. Follow the existing scope pattern: omitted allowlist means library/test mode, not live mode. `AgentLoop.executeTool` must always pass the set, including an empty set.

**Authority source, not the profile list:**

- Red archetypes (`recon`, `scanner`, `exploiter`, `infiltrator`, `exfiltrator`, `ghost`, `coordinator`, `analyst`): frozen allowlist is that profile's `defaultTools`. Preserve Red.
- `blue`, `white`, `sentinel`, `warden`, `arbiter`, `auditor`: do not freeze `defaultTools`. Those lists include `http_request` and `curl_request`. [VERIFIED: src/operators/index.ts:180-181, 191, 224-225, 235-236, 246, 257] Deny any built-in whose effect is a network probe or a target mutation. Catalog grants stay the catalog authority:

```typescript
const BLUE_TOOLS = ['file', 'yara', 'exiftool', 'strings', 'checksec', 'openssl', 'gitleaks', 'trufflehog', 'trivy', 'syft', 'grype', 'osv-scanner', 'checkov', 'semgrep', 'dig', 'whois', 'sigma', 'osquery', 'suricata', 'd3fend'] as const;
const WHITE_TOOLS = ['file', 'yara', 'exiftool', 'strings', 'binwalk', 'openssl', 'gitleaks', 'dig', 'whois', 'nist-800-115', 'ptes', 'osstmm', 'checksec', 'semgrep', 'trivy'] as const;
```

[VERIFIED: src/teams/index.ts:51-53]

- `black`, `specter`, `wraith`: catalog authority is the existing grant lists, not `defaultTools`. Specter profile tools include `subdomain_takeover_check`; `http_request` and `curl_request` are on the black and hat profiles. [VERIFIED: src/teams/index.ts:51; src/teams/hats.ts:44-45; src/operators/index.ts:169, 202, 213] Catalog id `curl` mints as `` `${adapter.id}_tool` `` via `toolNameFor`, not as `curl_request`. [VERIFIED: src/arsenal/adapter-tools.ts:623-624] Do not alias `curl` to `curl_request`. If the narrow route-verification executor is not registered, return unavailable. Do not run `curl_request` as a stand-in. Phase 27 owns `black_route_verify`.

- Unknown role or empty grant: allowlist is `[]`. `teamToolGrants` and `hatToolGrants` already throw for unknown ids. [VERIFIED: src/teams/index.ts:64-65; src/teams/hats.ts:63-64] Catch that as deny-all. Do not fall through to `ranked` the way `laneToolGrants` does at `src/server.ts:1502`.

`laneToolGrants` is advisory. [VERIFIED: src/server.ts:1472-1503]

```typescript
// allowed_tools is advisory route-preview metadata (no
// runtime enforcement reads it), so this is a fidelity/intent upgrade with zero exec-path risk.
function laneToolGrants(family: MissionFamily, operator: string): string[] {
...
    case 'black':
    case 'blue':
    case 'white':   return teamToolGrants(operator);
...
    case 'auditor': return hatToolGrants(operator as HatArchetype);
```

Do not pretend a change to that function closes AC-FH-009. Keep the case labels: `teams-integration-static.test.ts` and `hats-integration-static.test.ts` pin `teamToolGrants(operator)` and `hatToolGrants(operator`.

Approval stays where it is. A granted approval must not add names to the frozen set. `guardAction` on mission start is a target-approval gate, not a tool-role gate. [VERIFIED: src/server.ts:1414-1419, 6848-6851]

`POST /api/tools/execute` and `POST /api/tools/recon` are operator command surfaces with `guardAction`, not hat executors. Do not route role work through them. Do not add a role parameter that a caller can set to widen those routes.


### Pattern 5: Unavailable hat executor

**What:** A known hat or parent team can be spawned for identity, but a task whose capability has no registered executor ends as `unavailable` with a retained run id.

**When to use:** Structured dispatch of `black`, `blue`, `white`, and the six hats. No executor registry exists under `src/teams`. [VERIFIED: grep of `src/teams` for `executor` returned no matches] The pure helpers (`specterCoverReview`, `coverageGaps`, `roeAudit`, and the rest) are not a dispatch executor. Calling `AgentLoop` and returning its prose is a fake completion. Do not do that.

Red archetypes keep `AgentLoop`. Deterministic hat engines are Phase 27. Phase 26 reports unavailable and keeps the objective, role, mission, and input hash on the run.

### Pattern 6: Family routing without a grant change

**Current map, verbatim:** [VERIFIED: src/teams/index.ts:75-78]

```typescript
export const FAMILY_TEAM_MAPPING: Record<TeamArchetype, MissionFamily[]> = {
  black: ['web_api', 'cloud_infra', 'ai_red_team', 'agent_warfare'],
  blue: ['web_api', 'cloud_infra', 'code_supply_chain', 'crypto_secrets', 'reporting_remediation'],
  white: ['web_api', 'ai_red_team', 'cloud_infra', 'smart_contract', 'code_supply_chain', 'crypto_secrets', 'reverse_binary', 'agent_warfare', 'social_osint', 'reporting_remediation'],
};
```

`familyOperators` pushes teams from that map, then pushes each hat onto the parent's families. [VERIFIED: src/server.ts:1461-1468] Add `'ai_red_team'` and `'agent_warfare'` to `blue` only. Leave `black` and `white` lists unchanged. That also places `sentinel` and `warden` on those families through `hatTeam`. Do not push offensive Red archetypes onto Blue because of the family string. `laneToolGrants` for `blue` already returns `teamToolGrants('blue')`, which has no offensive catalog id. The family label must not be concatenated into a tool name.

`routeFamilyForDraft` infers family from draft prose. [VERIFIED: src/server.ts:1430-1441] That inference is not an authorization input. A poisoned objective must not change grants. Explicit structured `family` is a label validated against the known `MissionFamily` set. Unknown explicit family is 400 on the structured branch. Legacy omission keeps today's inference.

### Pattern 7: Retained attribution without a new scheduler

Existing limits, verbatim:

```typescript
const DEFAULT_OPERATOR_CONFIG: OperatorConfig = {
  maxDetectionRisk: 0.8,
  cooldownMs: 5000,
  maxRetries: 3,
```

[VERIFIED: src/operators/index.ts:354-357]

```typescript
const DEFAULT_AGENT_MAX_ITERATIONS = 15;
const LOCAL_AGENT_MAX_ITERATIONS = Number(process.env.T3MP3ST_LOCAL_AGENT_MAX_ITERATIONS || 30);
```

[VERIFIED: src/index.ts:276-277]

```typescript
    const DEFAULT_TASK_TIMEOUT_MS = 300000; // 5 minutes — generous backstop, not a deadline
    const LOCAL_AGENT_TASK_TIMEOUT_MS = 1800000; // local CLI agents can need multiple slow turns
```

[VERIFIED: src/index.ts:912-914] Override remains `T3MP3ST_TASK_TIMEOUT_MS`. Do not add another timeout.

`assignTask` decomposes and retries only when `this.llm && attempt < this.config.maxRetries`. [VERIFIED: src/operators/index.ts:474-484] Structured deterministic failures, permission denials, and unavailable executors must not enter that LLM decompose path. A retry is a new task that cites the prior run id. It must not reuse a completed side effect.

HTTP dispatch today: [VERIFIED: src/server.ts:7238-7296]

```typescript
    taskName = 'Manual Task',
    taskDescription = '',
    phase = 'reconnaissance',
    priority = 5,
...
    missionId: mission?.id || 'manual',
...
  const target = targets[0];
  operator.assignTask(task, target).then((result) => {
...
    output: (result.output || '').substring(0, 2000),
```

Structured dispatch must not use `missionId: 'manual'`, must not pick `targets[0]` when the context is artifact-only, and must not treat the truncated SSE string as the retained result. Add `operatorTaskRuns` to `buildStateSnapshot` and `loadPersistedState`. [VERIFIED: src/server.ts:1186-1204, 1257-1275] Absent slot on old snapshots loads as no runs. A row that was `pending` or `running` at process loss becomes interrupted, `executionSettled: true` for the old process, with the text that restart does not resume. Do not invent a live mission on restore. `schema_version` stays `'t3mp3st_state/v1'`.

No cancel route exists. `POST /api/mission/stop` calls `cmd.stop()` and returns `Mission stopped`. That is a scheduler stop. `pause` and `resume` are the same class. LLM `AbortSignal` aborts a transport, not a task ACK. The contract proposal says cancellation is `unsupported` and forbids inventing a cancelled state. Adopt that. Do not add a cancel endpoint that returns success.

### Anti-Patterns to Avoid

- **Planning from STATE.md or API_REFERENCE.md when they name routes the server lacks.** Those files are ahead of source.
- **Global nonempty-operator rejection.** It breaks the legacy empty-operator start.
- **Binding after `res.json` or after `setInterval`.** The tick can seed work against an unbound mission.
- **Using `pending targets` or `local-lab` as an artifact-only authority target.** Both strings already exist as fallbacks. [VERIFIED: src/index.ts:832; src/server.ts:1515]
- **Treating `defaultTools` or hidden schemas as the denial.** AC-FH-009 forbids that.
- **A process-global tool allowlist on the shared Arsenal.** Parallel runs would widen each other.
- **Aliasing catalog `curl` or `httpx` to `curl_request` or `http_request`.** Different names, different authority.
- **Writing `origin: 'observed'` from POST body, GET handlers, or a new public mint route.**
- **Backfilling historical ledger rows.**
- **Spawning a hat into `AgentLoop` and returning the model text as the specialist result.**
- **Invoking `orch_amend.py` or claiming FH-EXEC-4 closed.** The script exists at `/root/src/repos/agent-swarm-amend/scripts/orch_amend.py`. It is not a mounted tool. `ULTRATHINK_SWARM_ROOT` is unset. [VERIFIED: glob of that repo; env probe this session]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact digest | A custom hash or a caller-supplied hash | `createHash('sha256')` already imported in `src/server.ts` | Collision and spoofing are the evidence bug this phase exists to close |
| Secret scrubbing | A new redaction filter | `redactSecrets` / `redactLedgerText` | Snapshot and HTTP already pass through it; a second filter will drift |
| Scope and approval | A hat-specific scope parser | `scopeViolation`, `guardAction`, `ApprovalController` | They already fail closed before handlers |
| Argument checks | Ad hoc condition chains per tool | `validateToolArgs` | Already the pre-handler gate |
| Persistence | A new database, queue, or file format | `evidenceLedger` Map plus `t3mp3st_state/v1` | Locked: no new persistence platform |
| Scheduling | A new retry or cancel worker | `TaskQueue`, tick timeout, `maxRetries` | Locked: no new scheduler |
| Role lists | A fifth table of role strings | `OperatorArchetype`, `TEAM_ARCHETYPES`, `HAT_ARCHETYPES`, `hatTeam` | A second list will drift from spawn |

**Key insight:** The missing pieces are a branch in the existing start handler, a per-call allowlist, and a private ledger writer. New infrastructure would violate the locked decisions and still not close the handler hole.

## Common Pitfalls

### Pitfall 1: A full sha256 hex digest is self-redacted

**What goes wrong:** A 64-character hex digest stored in any string that passes through `redactSecrets` is replaced with `[redacted]`. The mission/artifact identity disappears from API responses and `state.json`.
**Why it happens:** [VERIFIED: src/redact.ts:9-11]

```typescript
  aws_secret_key: { pattern: /[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g, severity: 'critical', provider: 'AWS' },
```

Keys matching `/(api[_-]?key|authorization|cookie|credential|password|secret|token)/i` are replaced wholesale. [VERIFIED: src/redact.ts:63-66] Do not name a field `secret`, `token`, `apiKey`, or `credential`.
**How to avoid:** Compute the real sha256. Persist and emit it as four 16-hex groups joined by `-` (64 hex digits, hyphens break the 40-character run). Also keep the existing 16-character stamp pattern where a short integrity label is enough (`memoryFingerprint` and ROE `textHash` use `.digest('hex').slice(0, 16)`). [VERIFIED: src/server.ts:1149-1153, 6608] The hyphenated form is the content id. The 16-character slice is not sufficient as the only artifact identity. This hyphenation is a discretion choice, not an existing constant.
**Warning signs:** GET or `state.json` shows `[redacted]` where a hash should be.

### Pitfall 2: STATE and API_REFERENCE describe code that is not there

**What goes wrong:** A plan implements `roleInputs` as a bugfix, or adds public POSTs because the docs say they write receipts.
**Why it happens:** `.planning/STATE.md` says FH-COMP-3 is adopted in mission start and FH-INPUT-1 and FH-EVID-2 are partial. The handler destructure has no `roleInputs` and no artifact field. Team analysis routes are GET. `EvidenceEntry` has no `origin`.
**How to avoid:** Treat STATE, API_REFERENCE, MCP descriptions, and `v1.5-RUNTIME-CONTRACTS.md` as proposals until a read of `src/server.ts` shows the behavior. This research did that read.
**Warning signs:** A task says "preserve the existing inline artifact field" or "extend the existing gaps POST".

### Pitfall 3: Shared Arsenal plus empty-array fallthrough

**What goes wrong:** One operator's grant becomes every operator's grant, or an empty grant becomes all tools.
**Why it happens:** One `this.arsenal` is attached to every operator. `getToolDefinitions` treats an empty name list as unset.
**How to avoid:** Freeze names on the operator at spawn. Pass them on the execute context. Empty set denies. Never set an allowlist on the Arsenal singleton.
**Warning signs:** A test that runs two roles in one process and sees the second role call the first role's tool.

### Pitfall 4: Schema filter mistaken for denial

**What goes wrong:** Tests only assert the model was not offered the tool. A direct `executeTool` still runs the handler.
**Why it happens:** The comment in the batch loop says scope and approval are checked inside `execute` before the handler. That sentence is true and incomplete: role is not checked there.
**How to avoid:** Tests call `executeTool` or `arsenal.execute` with a forbidden registered name and assert the handler counter stays 0.
**Warning signs:** A unit test that only snapshots `getToolDefinitions` output.

### Pitfall 5: Structured validation applied to legacy bodies

**What goes wrong:** Existing Red starts with `operators: []` or a duplicate archetype start failing, or a hunt-form start with `inlineArtifacts` is forced through the new role rules.
**Why it happens:** The UI field is already on some legacy posts. The locked discriminator is `roleInputs`, `family`, or `targetContext`, not the artifact field and not a nonempty operator list.
**How to avoid:** Branch before the existing target check only for the structured discriminator. Artifact validation is an additional early return, not a mode switch.
**Warning signs:** A fixture with targets and an empty operators array stops returning success.

### Pitfall 6: Hash of the summary, or hash after redaction

**What goes wrong:** Caller `summary` or a redacted preview becomes the evidence bytes.
**Why it happens:** `POST /api/evidence` stores `summary` and never stored bytes. It is easy to reuse that field.
**How to avoid:** Hash `Buffer.from(data, 'utf8')` from the inline object only. Reject missing `data`. Do not accept `uri` or `command` as a substitute for bytes.
**Warning signs:** Two different texts with the same summary share a hash.

### Pitfall 7: Static pins outside the path table

**What goes wrong:** C3 edits `server.ts` and `local-api-hardening-static.test.ts` fails because the mission-start block no longer contains `resolveGeneralLLMConfig(provider, model, apiKey)`.
**Why it happens:** That pin reads the start handler through `app.get('/api/mission/report')`. [VERIFIED: src/__tests__/local-api-hardening-static.test.ts:22-28] Hat and team static tests pin `laneToolGrants` case labels. Those test files are not in the C1/C2/C3 five-path lists.
**How to avoid:** Keep `resolveGeneralLLMConfig(provider, model, apiKey)` and the grant case labels. Put new behavioral tests in the Q1 files. If a pin file must change, that is a planner exception to name, not a silent extra path.
**Warning signs:** A task that rewrites the start comment block and drops the resolver call.

### Pitfall 8: Decomposition retries a denied tool

**What goes wrong:** A role denial throws, `assignTask` decomposes, and a subtask calls another tool or repeats a side effect.
**Why it happens:** `maxRetries` is 3 and the decompose path is the default failure handler whenever an LLM exists.
**How to avoid:** Permission, validation, scope, and approval failures return a structured denial result. They must not throw into decompose. Unavailable executors return unavailable. They must not call the model.
**Warning signs:** A denial fixture shows `task:decomposed` or more than one handler invocation.


## Code Examples

Verified from this repo, not from an external framework.

### Legacy target rejection

```typescript
// Source: src/server.ts:6843-6846
  if (targets.length === 0) {
    res.status(400).json({ error: 'At least one target required' });
    return;
  }
```

Keep this exact error on the legacy branch.

### Role union the structured branch must accept, and no others

```typescript
// Source: src/types/index.ts:117-134
export type OperatorArchetype =
  | 'recon'
  | 'scanner'
  | 'exploiter'
  | 'infiltrator'
  | 'exfiltrator'
  | 'ghost'
  | 'coordinator'
  | 'analyst'
  | 'black'
  | 'blue'
  | 'white'
  | 'specter'
  | 'wraith'
  | 'sentinel'
  | 'warden'
  | 'arbiter'
  | 'auditor';
```

`purple` is not in this union. `TEAM_ARCHETYPES` is `['black', 'blue', 'white']`. `HAT_ARCHETYPES` is `['specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor']`. [VERIFIED: src/teams/index.ts:46; src/teams/hats.ts:21-28] Seventeen spawnable roles, four disciplines, Purple excluded.

### Handler gate order to extend, not replace

```typescript
// Source: src/arsenal/index.ts:385-442
    const blockedHost = scopeViolation(this.scope, context);
    if (blockedHost) {
      const denied: ToolResult = {
        success: false,
        error: `SCOPE DENIED: target '${blockedHost}' is not in the authorized scope — ${toolName} refused before execution. Only authorized / loopback / lab targets are permitted.`,
      };
      ...
      return denied;
    }
    ...
        const denied: ToolResult = { success: false, error: `APPROVAL REQUIRED: ${decision.reason}` };
        ...
        return denied;
    ...
      const validationErrors = validateToolArgs(toolName, context.parameters, tool.parameters);
      ...
        throw err;
    ...
      const result = redactConfiguredSecrets(await tool.handler(context));
```

Insert the per-run name allowlist after the tool lookup and before `scopeViolation`, so a forbidden name does not even get a scope side effect. Return a denial. Do not throw into decompose. Do not call `tool.handler`.

### Hash precedent that survives redaction

```typescript
// Source: src/server.ts:1149-1153
function memoryFingerprint(type: MemoryType, content: string): string {
  return createHash('sha256')
    .update(`${type}\0${canonicalMemoryContent(content)}`)
    .digest('hex')
    .slice(0, 16);
}
```

Use the same `createHash('sha256')` call. Do not store the unsliced hex in a redacted string. See Pitfall 1 for the hyphenated full digest.

### Red inventory rows the new contract file must cite

These paths exist. Workflow prompt keys that do not exist must be labeled unavailable, not invented.

| Role | Profile tools | Dedicated workflow prompt | Notes |
|------|---------------|---------------------------|-------|
| `recon` | `src/operators/index.ts:81` `defaultTools` | `src/prompts/index.ts:1337` `reconWorkflow` | Also `OPERATOR_SYSTEM_PROMPTS.recon` at `src/prompts/index.ts:192` |
| `scanner` | `src/operators/index.ts:92` | `src/prompts/index.ts:1365` `vulnScanWorkflow` | |
| `exploiter` | `src/operators/index.ts:103` | `src/prompts/index.ts:1393` `exploitWorkflow` | |
| `infiltrator` | `src/operators/index.ts:114` | none in `WORKFLOW_PROMPTS` | Label the staged workflow prompt unavailable. Profile and system prompt exist. |
| `exfiltrator` | `src/operators/index.ts:125` | none | Same |
| `ghost` | `src/operators/index.ts:136` | none | Same |
| `coordinator` | `src/operators/index.ts:147` | none | Same |
| `analyst` | `src/operators/index.ts:158` | none | Same |

`WORKFLOW_PROMPTS` has exactly three keys: `reconWorkflow`, `vulnScanWorkflow`, `exploitWorkflow`. [VERIFIED: src/prompts/index.ts:1336-1421]

Other real entry points to cite, without claiming unread contents:

- API: `POST /api/mission/start` `src/server.ts:6806`, `POST /api/operators/spawn` `src/server.ts:7148`, `POST /api/operators/:id/task` `src/server.ts:7220`
- Lifecycle: `TempestCommand.start`, `stop`, `pause`, and `resume` in `src/index.ts`; timeout constants at `src/index.ts:912-914`
- UI files that exist: `docs/index.html`, `docs/overview.html`, `docs/operators.html`, `docs/mission.html`. Only the hunt-form start body was read (`docs/index.html:441-448`). Do not invent selectors in the unread pages.
- Published Red template file exists: `grokbot/templates/RED.md`. Skill files that exist include `grokbot/skills/tempest-mission/SKILL.md`, `grokbot/skills/tempest-operators/SKILL.md`, and `grokbot/skills/tempest-run/SKILL.md`. Their bodies were not read this session. Inventory rows may cite the paths. They must not quote unread skill text as behavior.
- Checks that exist: `src/__tests__/teams-archetypes.test.ts`, `src/__tests__/hats-archetypes.test.ts`, `src/__tests__/local-api-hardening-static.test.ts`. They do not yet prove the new branch.

Parent map, verbatim: [VERIFIED: src/teams/hats.ts:31-38]

```typescript
export const hatTeam: Record<HatArchetype, 'black' | 'blue' | 'white'> = {
  specter: 'black',
  wraith: 'black',
  sentinel: 'blue',
  warden: 'blue',
  arbiter: 'white',
  auditor: 'white',
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| This product's mission start | Still the eight-role silent skip plus required targets | Unchanged as of this read | Phase 26 adds a branch; it does not replace the old body |
| Proposal in `v1.5-RUNTIME-CONTRACTS.md` | Not implemented | Proposal only | Adopt the parts that match CONTEXT.md. Do not treat "no unresolved decisions" in that file as code |
| STATE.md FH-COMP-3 "adopted" | Not in the handler | Note is ahead of source | Plan against `src/server.ts` |

**Deprecated/outdated:**

- Any plan text that says `roleInputs` already exists on `POST /api/mission/start`.
- Any plan text that says observed receipts are already written by team POSTs or by a successful ROE parse.
- FH-EXEC-4 is not closed. Do not describe it as closed, mounted, or a substitute for these criteria.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hyphenated full sha256 (16-hex groups joined by `-`) is the right persisted content id, with the existing 16-char slice kept only as a short stamp | Pitfall 1 / Pattern 2 | A different safe encoding could be chosen. The unsafe part is not assumed: raw 64-char hex is redacted. [VERIFIED: src/redact.ts:11] |
| A2 | Phase 26 accepts only `text/plain` and `utf8`, one artifact, 64 KiB | Pattern 2 | Discretion allows a wider bounded enum. A wider enum is still valid if server-validated. The UI currently sends only this triple. [VERIFIED: docs/index.html:446] |
| A3 | The first private receipt hook is successful `parseRoe` on the existing ROE PUT, not new team POSTs | Pattern 3 | If the planner wants zero receipt writers until Phase 27, the private function can land uncalled except for tests. It must still be impossible for public POST to mint `observed`. |
| A4 | `docs/operators.html` and `docs/mission.html` are UI entry points worth citing by path only | Code Examples | Contents were not read. Citing unread behavior would be wrong. Path citation is enough for the inventory. |

**If this table is empty:** not empty. A1 and A2 are discretion choices. A3 and A4 are scope choices the planner can narrow, not widen.

## Open Questions

1. **Should the private receipt writer be called from the ROE PUT in this phase, or only defined for Phase 27?**
   - What we know: The PUT already computes a parse and does not write an evidence receipt. Team POSTs that STATE names do not exist.
   - What's unclear: Whether one existing computation is enough to satisfy "after real computation" without looking like a new White engine.
   - Recommendation: Call it from the successful ROE parse only. That is existing computation, not a Phase 27 engine. Do not add team POSTs.

2. **FH-EXEC-4 remains unresolved.**
   - What we know: The amendment script is on disk in another repo. It is not mounted here. CONTEXT says product work proceeds anyway and must not pretend the amendment is mounted.
   - What's unclear: Nothing for this phase's product files.
   - Recommendation: Do not block Phase 26 product plans on controller amendment. Do not claim the blocker closed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Existing server | yes | v24.18.0 | — |
| Python 3 | Not required for this phase | yes | 3.12.3 | Do not use it to run `orch_amend.py` |
| vitest | Q1 tests | yes (declared) | `^4.1.9` | — |
| `swarm_amend` tool | FH-EXEC-4, not a product file | not mounted | — | Do not invoke. Product criteria do not depend on it |
| `ULTRATHINK_SWARM_ROOT` | Controller host routing | unset | — | Leave unset |
| `.planning/config.json` | Nyquist flag | absent | — | Treat Nyquist as enabled |
| `.planning/graphs/graph.json` | Graph context | absent | — | No graph queries |

**Missing dependencies with no fallback:** none for product code.

**Missing dependencies with fallback:** `swarm_amend` is missing as a tool. The fallback is to plan only purple-team files and leave FH-EXEC-4 unclosed.

## Validation Architecture

`.planning/config.json` is absent, so Nyquist validation is treated as enabled. This research did not run tests.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest `^4.1.9` |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts']`) |
| Quick run command | `npx vitest run src/__tests__/teams-archetypes.test.ts src/__tests__/teams-modules.test.ts src/__tests__/hats-archetypes.test.ts src/__tests__/hats-modules.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AC-FH-001 | Inventory rows cite real paths and label missing workflow prompts | unit | `npx vitest run src/__tests__/teams-modules.test.ts` | Wave 0 — add a contracts inventory assertion; do not invent a new test file outside Q1 unless the planner assigns it |
| AC-FH-003 | Purple rejected; hat parent map stable | unit | `npx vitest run src/__tests__/teams-archetypes.test.ts src/__tests__/hats-archetypes.test.ts` | files exist; extend them |
| AC-FH-005 | Structured unknown role 400; legacy empty operators still start | integration | new cases beside Q1 | Wave 0 behavior |
| AC-FH-006 | Dispatch returns a run id; spawn-only is not success; artifact-only does not use `manual` | integration | same | Wave 0 |
| AC-FH-007 | `ai_red_team` and `agent_warfare` include blue; black remains; no offensive grant from the label | unit | `npx vitest run src/__tests__/teams-archetypes.test.ts` | file exists; assertion must change because it currently expects the old blue list |
| AC-FH-008 | Late result cannot retarget mission id | unit | Q1 or command test | Wave 0 |
| AC-FH-009 | Forbidden registered tool, batch, and backend seed: handler count 0 | unit | existing arsenal approval test pattern, plus an AgentLoop case | role case missing; approval file exists and must keep passing with omitted allowlist |
| AC-FH-010 | Blue/White probe tool denied despite `defaultTools` | unit | Q1 | Wave 0 |
| AC-FH-011 | Invalid args, scope, missing approval still deny; approval does not add tools | unit | `src/__tests__/arsenal-validation.test.ts`, `arsenal-scope-gate.test.ts`, `arsenal-approval-gate.test.ts` | files exist; extend, do not require allowlist when omitted |
| AC-FH-012 | Empty grant denies; parallel roles do not share grants | unit | Q1 | Wave 0 |
| AC-FH-019 | Denial does not decompose; retry count stays at most 3 | unit | operator test | Wave 0 |
| AC-FH-020 | Stop is not a cancel ACK; restore marks in-flight runs interrupted | unit | server snapshot test | Wave 0 |
| AC-FH-024 | Poisoned task text cannot change the frozen allowlist or set `origin` | unit | Q1 | Wave 0 |
| NFR-FH-SEC-01 | Handler counter zero on the denial fixtures | unit | same as AC-FH-009 | Wave 0 |
| NFR-FH-DATA-01 | Snapshot and error strings contain no raw secret from the artifact | unit | `src/__tests__/redact.test.ts` plus a new hash fixture | redact file exists |
| NFR-FH-REL-01 | Timeout constants unchanged; no second scheduler | static | pin `DEFAULT_TASK_TIMEOUT_MS = 300000` if a static test is added in Q1 | Wave 0 |

### Sampling Rate

- **Per task commit:** the quick vitest command above, plus any new Q1 case the task added
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Behavioral cases for the structured start branch, artifact bind, role allowlist, empty grant, and unavailable executor — put them in the four Q1 files if they fit; do not create a new test path without naming it as a planner exception
- [ ] `src/teams/contracts.ts` does not exist yet — C1 creates it; tests import it after that
- [ ] No framework install

Existing static pins must remain true: `resolveGeneralLLMConfig(provider, model, apiKey)` inside the mission-start block, and `teamToolGrants(operator)` / `hatToolGrants(operator` inside `laneToolGrants`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes, unchanged | Loopback bind does not mount the bearer guard. Non-loopback already mounts `createRemoteGuard`. Do not widen that. [VERIFIED: src/server.ts:343-350] |
| V3 Session Management | no new session | Existing in-memory command. No new cookie. |
| V4 Access Control | yes | Per-run tool allowlist before `tool.handler`. Family label and prompt text are not grants. Approval is not a role expansion. |
| V5 Input Validation | yes | Bounded artifact fields; structured role list; existing `validateToolArgs`; reject `uri` or `command` as bytes |
| V6 Cryptography | yes, hashing only | `node:crypto` `createHash('sha256')`. Never hand-roll. Persist in the redaction-safe form in Pitfall 1 |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model names a registered tool outside the role set | Elevation of Privilege | Deny in `Arsenal.execute` before `tool.handler`; empty allowlist denies all |
| Caller posts `origin: observed` or a replayable strength | Spoofing | Public POST ignores origin. Private writer sets `observed` only after a computation return |
| Caller posts an artifact `uri` or a shell command instead of `data` | Tampering | Reject. No fetch, no `executeCommand` |
| Poisoned task description says to switch role or mark verified | Tampering | Keep it in the user message. Do not parse it as grants, scope, or evidence standing |
| Shared Arsenal allowlist mutated by a parallel run | Elevation of Privilege | Allowlist on the call context, frozen at spawn |
| Full sha256 stored, then redacted, then restored as a different id | Tampering | Hyphenated digest; restore checks observation fields before trusting `observed` |
| `state.json` hand-edited to `origin: observed` | Spoofing | Restore drops `observed` unless tool, stage, input hash, run id, and mission id are all present |
| Artifact text contains a configured secret and is snapshotted raw | Information Disclosure | Hash first, snapshot only redacted preview, never raw bytes |
| DNS rebinding or cross-origin start | Spoofing | Existing Host and Origin guards stay in front of the handler. [VERIFIED: src/server.ts:289-332] |
| Approval id used to unlock another role's tool | Elevation of Privilege | Approval gate stays; it does not add names to the frozen set |
| Scheduler stop described as cancel | Repudiation | Response text stays `Mission stopped`. Contract says cancellation unsupported |

## Sources

### Primary (HIGH confidence)

- `src/server.ts:6800-6943` mission start handler, read this session
- `src/server.ts:1472-1503` `laneToolGrants` advisory comment and grant delegation
- `src/server.ts:7111` `VALID_ARCHETYPES`
- `src/server.ts:720-734` `EvidenceEntry`
- `src/server.ts:5771-5791` public evidence POST
- `src/server.ts:6502-6693` team routes are GET except purple synthesize and ROE PUT
- `src/server.ts:1186-1275` snapshot slots
- `src/server.ts:7220-7297` task dispatch
- `src/teams/index.ts:46-79` team grants and family map
- `src/teams/hats.ts:21-65` hat grants and parents
- `src/types/index.ts:117-134` `OperatorArchetype`
- `src/arsenal/index.ts:370-516` execute gates and schema filter
- `src/arsenal/adapter-tools.ts:622-624` `toolNameFor`
- `src/agent/index.ts:160-175, 237-259, 424-437` model, batch, and backend-seeded execute path
- `src/index.ts:802-839, 912-920, 1247-1270` mission create and AgentLoop tools
- `src/mission/index.ts:241-263` `randomUUID` mission id
- `src/operators/index.ts:75-260, 354-357, 442-484, 948-966` profiles, retries, spawn errors
- `src/redact.ts:9-11, 63-66` redaction patterns
- `src/prompts/index.ts:1336-1421` three workflow prompts
- `docs/index.html:441-448` existing `inlineArtifacts` client field
- Env probe: `ULTRATHINK_SWARM_ROOT` unset; Node v24.18.0; `.planning/config.json` absent; `src/teams/contracts.ts` absent

### Secondary (MEDIUM confidence)

- `.planning/v1.5-RUNTIME-CONTRACTS.md` sections 5, 9, and 10 — proposal only. Adopted where it matches CONTEXT.md: no `missionId` of `manual` on the new path, no synthetic `local-lab` or `pending targets` authority target, `operatorTaskRuns` absent-tolerant snapshot slot, cancellation unsupported, private receipt write after real computation. Not treated as implemented behavior.
- `.planning/ROADMAP.md` Phase 26 success criteria and the C1/C2/C3 path table
- `.planning/REQUIREMENTS.md` AC-FH-001, 003, 005-012, 019, 020, 024 and the three NFR rows

### Tertiary (LOW confidence)

- None used as authority. STATE.md and API_REFERENCE.md were compared to source and not followed where they disagreed.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new libraries; versions read from package.json and the host
- Architecture: HIGH — handler, grants, execute path, and ledger shape were read
- Pitfalls: HIGH for the redaction and allowlist holes; MEDIUM for the hyphenated digest encoding, which is a discretion recommendation

**Research date:** 2026-10-15
**Valid until:** 2026-11-14, or sooner if `src/server.ts` mission start changes

## Smallest C1/C2/C3 file set

Roadmap allocation, confirmed against the tree. Do not add paths to close this phase.

| Slice | Paths | Exists now | Phase 26 job |
|-------|-------|------------|--------------|
| C1 | `src/types/index.ts` | yes | Add only the DTO fields the other slices must share: structured start discriminator, inline artifact, run origin. Do not add a fifth discipline. |
| C1 | `src/teams/contracts.ts` | no — create | Red inventory rows, bounded artifact contract, receipt field names, role-to-allowlist helper. Every inventory row cites a path in the table above. |
| C1 | `src/arsenal/index.ts` | yes | Per-call allowlist check before `tool.handler`. Omitted field keeps current test behavior. |
| C1 | `src/agent/index.ts` | yes | `executeTool` always passes the frozen set, including empty. Backend seed and batch use that path only. |
| C1 | `src/validation/index.ts` | yes | Reuse `validateToolArgs`. Add artifact field validation here only if it should sit with the other validators; otherwise keep it in `contracts.ts` and do not touch this file. |
| C2 | `src/index.ts` | yes | Stage bind consumed inside `ensureMission` before `setInterval`. Structured starts do not seed Red tasks. Unavailable executor does not call the model. |
| C2 | `src/mission/index.ts` | yes | Keep `randomUUID()`. Do not accept a caller mission id. |
| C2 | `src/operators/index.ts` | yes | Denial results must not enter decompose. Do not replace Red `defaultTools`. |
| C2 | `src/teams/index.ts` | yes | Add `ai_red_team` and `agent_warfare` to `FAMILY_TEAM_MAPPING.blue` only. Do not edit `BLACK_TOOLS`, `BLUE_TOOLS`, or `WHITE_TOOLS` to paper over probes. |
| C2 | `src/teams/hats.ts` | yes | Keep `hatTeam` and grant subsets. No new hat. |
| C3 | `src/server.ts` | yes | Branch start. Private receipt writer. Snapshot slot. No new public mint route. |
| C3 | `docs/API_REFERENCE.md` | yes | Document the branch and the private-versus-public receipt rule. Remove or mark unimplemented the POST receipt claims that the server does not implement. |
| Q1 | the four existing archetype and module test files | yes | Behavioral authority coverage. Not a claim any check has run. |

Files this research looked for and did not find, so plans must not import them: `src/teams/contracts.ts`, `POST /api/mission/artifacts`, the team analysis POST routes named in STATE, a hat executor registry, `.planning/config.json`, project-root `CLAUDE.md`, `.planning/graphs/graph.json`.

FH-EXEC-4 is not closed.

## RESEARCH COMPLETE
