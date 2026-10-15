# Phase 26: Runtime Authority, Bound Inputs and Retained Execution - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 16
**Analogs found:** 16 / 16
**Tracked-source gate:** analogs are `git ls-files` tracked. `src/teams/contracts.ts` is absent. FH-EXEC-4 is not closed. Do not plan `orch_amend.py`.

Do not add routes research said are absent: `POST /api/mission/artifacts`, team analysis POSTs, a public receipt-mint route, a cancel route, a new scheduler, or a second store. `src/teams/white/evidence-chain.ts` has an optional `origin` label and is not a writer.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/index.ts` | model | transform | `src/types/index.ts` | exact (extend) |
| `src/teams/contracts.ts` | model | transform | `src/teams/index.ts` + `src/teams/hats.ts` | role-match (new) |
| `src/arsenal/index.ts` | service | request-response | `src/arsenal/index.ts` `execute` | exact (extend) |
| `src/agent/index.ts` | service | request-response | `src/agent/index.ts` `executeTool` | exact (extend) |
| `src/validation/index.ts` | utility | transform | `src/validation/index.ts` `validateToolArgs` | exact (reuse) |
| `src/index.ts` | service | event-driven | `src/index.ts` `start` / `ensureMission` | exact (extend) |
| `src/mission/index.ts` | service | CRUD | `src/mission/index.ts` `createMission` | exact |
| `src/operators/index.ts` | service | event-driven | `src/operators/index.ts` `spawnOperator` / `assignTask` | exact |
| `src/teams/index.ts` | model | transform | `src/teams/index.ts` `FAMILY_TEAM_MAPPING` | exact |
| `src/teams/hats.ts` | model | transform | `src/teams/hats.ts` `hatTeam` | exact |
| `src/server.ts` | controller | request-response | `src/server.ts` start, ROE PUT, evidence POST, snapshot | exact |
| `docs/API_REFERENCE.md` | config | request-response | `docs/API_REFERENCE.md` | exact |
| `src/__tests__/teams-archetypes.test.ts` | test | transform | same file | exact |
| `src/__tests__/teams-modules.test.ts` | test | transform | same file | exact |
| `src/__tests__/hats-archetypes.test.ts` | test | transform | same file | exact |
| `src/__tests__/hats-modules.test.ts` | test | transform | same file | exact |

## Pattern Assignments

### `src/types/index.ts` (model, transform)

**Analog:** `src/types/index.ts` lines 117-134. Keep this union. `purple` is absent. New DTOs are types only.

```typescript
export type OperatorArchetype =
  | 'recon' | 'scanner' | 'exploiter' | 'infiltrator'
  | 'exfiltrator' | 'ghost' | 'coordinator' | 'analyst'
  | 'black' | 'blue' | 'white'
  | 'specter' | 'wraith' | 'sentinel' | 'warden' | 'arbiter' | 'auditor';
```

### `src/teams/contracts.ts` (model, transform) — new

**Analog:** `src/teams/index.ts` lines 44-70 and `src/teams/hats.ts` lines 31-38. Copy readonly tuples, spread copies, and unknown-id throws. Do not invent a second parent map. Cite `hatTeam` from hats.

```typescript
import type { OperatorArchetype } from '../types/index.js';
import type { MissionFamily } from '../resources/index.js';

export function teamToolGrants(archetype: OperatorArchetype): string[] {
  switch (archetype) {
    case 'black': return [...BLACK_TOOLS];
    case 'blue': return [...BLUE_TOOLS];
    case 'white': return [...WHITE_TOOLS];
    default:
      throw new Error(`teamToolGrants: "${archetype}" is not a team archetype`);
  }
}
```

```typescript
export const hatTeam: Record<HatArchetype, 'black' | 'blue' | 'white'> = {
  specter: 'black', wraith: 'black',
  sentinel: 'blue', warden: 'blue',
  arbiter: 'white', auditor: 'white',
};
```

Inventory cites real paths only: operator `defaultTools` at `src/operators/index.ts` lines 81, 92, 103, 114, 125, 136, 147, 158; workflow prompts only `reconWorkflow`, `vulnScanWorkflow`, `exploitWorkflow` in `src/prompts/index.ts` (other five Red workflow prompts unavailable); API at `src/server.ts:6806`, `:7148`, `:7220`; lifecycle in `src/index.ts`; UI paths `docs/index.html`, `docs/overview.html`, `docs/operators.html`, `docs/mission.html` (behavior read only at `docs/index.html:441-448`); template/skill paths `grokbot/templates/RED.md` and `grokbot/skills/tempest-mission/SKILL.md`, `grokbot/skills/tempest-operators/SKILL.md`, `grokbot/skills/tempest-run/SKILL.md` without quoting unread bodies.

Artifact discretion from RESEARCH: `text/plain`, `utf8`, one element, `64 * 1024` bytes, server-issued id, caller `id` is a label. Hash with `createHash('sha256')`. Persist four 16-hex groups joined by `-`. Do not name fields `secret`, `token`, `apiKey`, or `credential`.

### `src/arsenal/index.ts` (service, request-response)

**Analog:** `execute` lines 370-442. Insert per-run allowlist after lookup and before `scopeViolation`. Return a denial. Do not throw. Do not call `tool.handler`. Omitted allowlist stays library/test mode. Empty set denies all. Do not store the set on the shared Arsenal. Approval does not add names.

```typescript
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolError(ToolErrorCategory.ToolNotFound, `Tool "${toolName}" not found`, toolName);
    }
    const blockedHost = scopeViolation(this.scope, context);
    if (blockedHost) {
      return { success: false, error: `SCOPE DENIED: target '${blockedHost}' ...` };
    }
    // approval returns APPROVAL REQUIRED; validateToolArgs throws ValidationError
    const result = redactConfiguredSecrets(await tool.handler(context));
```

Schema filter is not a denial (`getToolDefinitions` lines 495-503). Empty `names` is treated as unset:

```typescript
    if (names?.length) {
      tools = tools.filter(t => names.includes(t.name));
    } else if (categories?.length) {
      tools = tools.filter(t => categories.includes(t.category));
    }
```

### `src/agent/index.ts` (service, request-response)

**Analog:** lines 8-22 imports; lines 162-164 empty-array fallthrough; lines 175, 259, and 424-437 `executeTool` funnel.

```typescript
    const toolDefs = this.arsenal.getToolDefinitions(
      this.options.toolCategories.length > 0 ? this.options.toolCategories : undefined,
      this.options.tools.length > 0 ? this.options.tools : undefined
    );
```

```typescript
      toolResult = await this.arsenal.execute(toolCall.name, {
        target,
        parameters: toolCall.arguments,
      });
```

Always pass the frozen set, including `[]`. Red freezes `defaultTools`. Blue, white, and their hats must not freeze `defaultTools` (`http_request` / `curl_request` are on those profiles). Black and hats freeze catalog grants. Do not alias catalog `curl` to `curl_request`. Unknown or empty grant is `[]`. Catch grant throws as deny-all. Role denial returns a result; it must not throw into decompose.

### `src/validation/index.ts` (utility, transform)

**Analog:** lines 7-8 and 265-275. Reuse AJV `validateToolArgs`. Artifact bounds live in `contracts.ts` unless they cannot. Do not add per-tool condition chains.

```typescript
export function validateToolArgs(
  _toolName: string,
  args: Record<string, unknown>,
  schema: ToolParameter[],
): ToolValidationError[] {
  if (!schema || schema.length === 0) return [];
  coerceModelScalars(args, schema);
```

### `src/index.ts` (service, event-driven)

**Analog:** `start` / `ensureMission` lines 802-839. Stage artifacts before `start()`. Consume them inside `ensureMission` after `createMission` and before `startMission` and `setInterval`. Do not bind after `res.json`. `pending targets` is not an artifact-only target. Do not insert `local-lab`. Do not call `generateTasksForTarget` on artifact-only starts.

```typescript
  public start(): void {
    if (this.running) return;
    this.ensureMission();
    this.tickInterval = setInterval(() => {
      this.tick().catch(err => console.error('[purple-team] tick error (mission continues):', err instanceof Error ? err.message : err));
    }, 1000);
  }
  private ensureMission(): void {
    if (this.mission.getActiveMission()) return;
    const targetNames = this.targetEnv.getAllTargets().map(t => t.address).join(', ') || 'pending targets';
    const mission = this.mission.createMission({
      name: `${this.name} — Auto Mission`,
      description: `Automated mission for ${targetNames}`,
      objectives: ['Enumerate attack surface', 'Identify vulnerabilities', 'Validate findings'],
    });
    this.mission.startMission(mission.id);
  }
```

Keep limits at lines 276-277 and 912-914: `DEFAULT_AGENT_MAX_ITERATIONS = 15`, `T3MP3ST_LOCAL_AGENT_MAX_ITERATIONS`, `DEFAULT_TASK_TIMEOUT_MS = 300000`, `LOCAL_AGENT_TASK_TIMEOUT_MS = 1800000`, `T3MP3ST_TASK_TIMEOUT_MS`. `stop` / `pause` / `resume` are not cancel ACKs. No new scheduler.

### `src/mission/index.ts` (service, CRUD)

**Analog:** lines 6-14 and 241-263. `id: randomUUID()`. Do not accept a caller mission id.

```typescript
    const mission: Mission = {
      id: randomUUID(),
      name: params.name,
      status: 'planning',
    };
    this.missions.set(mission.id, mission);
    this.emit('mission:created', mission);
```

### `src/operators/index.ts` (service, event-driven)

**Analog:** duplicate callsign throw lines 962-966; `maxRetries: 3` lines 354-357; decompose lines 474-484.

```typescript
        throw new Error(`Operator with callsign "${callsign}" already exists`);
```

```typescript
      if (this.llm && attempt < this.config.maxRetries) {
        const subtasks = await this.decomposeTask(task, errorMessage);
        if (subtasks.length > 0) {
          this.emit('task:decomposed', { parent: task, subtasks, reason: errorMessage });
```

Structured duplicate roles fail before spawn. Permission, validation, scope, approval, and unavailable results must not enter decompose. `defaultTools` is not Blue/Black/White authority. Unregistered hat executor returns `unavailable` with a retained run id. Do not return `AgentLoop` prose as the hat result. No executor registry exists under `src/teams`.

### `src/teams/index.ts` (model, transform)

**Analog:** `FAMILY_TEAM_MAPPING` lines 75-79. Add `ai_red_team` and `agent_warfare` to `blue` only. Do not change grant id lists from a family string. Hats follow via `familyOperators` at `src/server.ts:1461-1468`.

```typescript
export const FAMILY_TEAM_MAPPING: Record<TeamArchetype, MissionFamily[]> = {
  black: ['web_api', 'cloud_infra', 'ai_red_team', 'agent_warfare'],
  blue: ['web_api', 'cloud_infra', 'code_supply_chain', 'crypto_secrets', 'reporting_remediation'],
  white: ['web_api', 'ai_red_team', 'cloud_infra', 'smart_contract', 'code_supply_chain', 'crypto_secrets', 'reverse_binary', 'agent_warfare', 'social_osint', 'reporting_remediation'],
};
```

### `src/teams/hats.ts` (model, transform)

**Analog:** `hatToolGrants` lines 63-70. No new hat. Unknown hat throws. Pure helpers are not dispatch executors. Keep static-test case labels `teamToolGrants(operator)` and `hatToolGrants(operator`.

```typescript
    default:
      throw new Error(`hatToolGrants: "${hat}" is not a hat archetype (expected one of ${HAT_ARCHETYPES.join(', ')})`);
```

### `src/server.ts` (controller, request-response)

**Analog:** this file. Imports already include `createHash` / `randomUUID` from `crypto` (line 17) and `redactLedgerText` / `redactSecrets` (line 40).

Legacy start keeps `res.status(400).json({ error: 'At least one target required' })` (RESEARCH-verified `src/server.ts:6843-6846`) when `roleInputs`, `family`, and `targetContext` are all absent. `inlineArtifacts` is not a discriminator. Structured branch 400s before `createTempestCommandInstance`. Do not globally reject empty operators. Keep `resolveGeneralLLMConfig(provider, model, apiKey)` because `local-api-hardening-static.test.ts` pins it and is outside the C path list.

Byte cap to copy, lines 6583-6598:

```typescript
const ROE_BODY_CAP_BYTES = 64 * 1024;
  if (Buffer.byteLength(text, 'utf8') > ROE_BODY_CAP_BYTES) {
    res.status(413).json({ error: 'ROE text exceeds the 64 KiB cap' });
    return;
  }
```

Hash precedent, lines 1149-1153. Do not persist unsliced 64-char hex.

```typescript
function memoryFingerprint(type: MemoryType, content: string): string {
  return createHash('sha256').update(`${type}\0${canonicalMemoryContent(content)}`).digest('hex').slice(0, 16);
}
```

Public `POST /api/evidence` lines 5774-5789 copies caller `source` and `provenanceStrength` and must stay unable to set `origin`. Private `recordReceipt` is new in this file, not an HTTP route. First honest hook is successful `parseRoe` on the existing PUT. Do not write on parse failure or from GET handlers. Do not add the missing POSTs. Do not backfill history.

Snapshot: add absent-tolerant `operatorTaskRuns` beside ledger arrays at lines 1186-1204. `schema_version` stays `'t3mp3st_state/v1'`. `replaceMapContents` (lines 1176-1183) stores any object with a string `id`. Restore drops `origin: 'observed'` that lacks `observation.tool`, `stage`, `inputSha256`, `runId`, and `missionId`. Pending/running rows at process loss become interrupted, `executionSettled: true`, not resumed.

`VALID_ARCHETYPES` line 7111 already spreads team and hat tables. Spawn at 7148-7166 casts without consulting it. Structured launch validates the 17-role union first. Do not route role work through `POST /api/tools/execute` or `/api/tools/recon`.

Dispatch lines 7238-7296 uses `missionId: mission?.id || 'manual'` and `targets[0]`, then truncates SSE output to 2000 chars. Structured and artifact-only dispatch must not use those fallbacks. Dispatch cannot create the mission.

`laneToolGrants` lines 1472-1503 is advisory. Keep `teamToolGrants(operator)` and `hatToolGrants(operator as HatArchetype)` case labels. Do not treat a change there as AC-FH-009.

### `docs/API_REFERENCE.md` (config, request-response)

**Analog:** lines 12-29 security model. Document the discriminator and inventory. Delete claims of routes the server lacks. State cancellation unsupported. Do not claim FH-EXEC-4 closed. Do not widen the loopback trust boundary.

### Q1 tests

Vitest `describe` / `it` / `expect` from the four files. `teams-archetypes.test.ts` lines 1-16 pins `TEAM_ARCHETYPES` and excludes `purple`. `hats-archetypes.test.ts` lines 1-18 pins the six hats and the unchanged team set. `hats-modules.test.ts` lines 18-26 pins hat subset of parent. Denial tests must count handler calls at 0, not snapshot `getToolDefinitions`.

## Shared Patterns

### Redaction

**Source:** `src/redact.ts` lines 9-11 and 63-66. A 40+ char hex run and keys matching `secret|token|apiKey|credential` become `[redacted]`. Emit hyphenated digests. Hash bytes before `redactLedgerText`. Do not store raw artifact bytes in `buildStateSnapshot`.

### Fail closed

**Source:** `src/arsenal/index.ts` 385-442 and mission-start 400 JSON. Return denial or `400`/`413` before handler or `start()`. Approval does not widen the frozen set. Hiding a schema is not a denial.

### Unknown role

**Source:** `teamToolGrants` / `hatToolGrants` default throw. Catch as deny-all. Do not fall through to `laneToolGrants` `ranked`.

### Claimed versus observed

**Source:** `src/teams/white/evidence-chain.ts` lines 31-34 (`origin?: 'claimed' | 'observed'`) and evidence POST. Public POST cannot mint `observed`. Historical rows stay unlabeled. Writer is private in `src/server.ts`.

## No Analog Found

No planned file lacks a tracked analog. Absent HTTP routes named in STATE or API_REFERENCE are not analogs and must not be created.

## Metadata

**Analog search scope:** `src/types`, `src/teams`, `src/arsenal`, `src/agent`, `src/validation`, `src/index.ts`, `src/mission`, `src/operators`, `src/server.ts`, `src/redact.ts`, `src/teams/white/evidence-chain.ts`, `docs/API_REFERENCE.md`, the four Q1 tests.
**Pattern extraction date:** 2026-10-15

## PATTERN MAPPING COMPLETE
