# Phase 27: Blue, Black and White Substantive Capability Parity - Research

**Researched:** 2026-10-15
**Domain:** In-repo Blue/Black/White engines, grants, prompts, and corpus briefings (no new runtime dependency)
**Confidence:** HIGH for gaps read in source this session; MEDIUM for the integration sequencing inferred from the locked path table

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- UI, MCP, and published-skill population — Phase 28
- Full parity matrix and milestone closure — Phase 29
- Mounting `swarm_amend` — still a host gap, not a Phase 27 file
- Color tokens — Phase 28
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AC-FH-013 | Claimed Blue/Black/White operations resolve to registered permitted implementations | Grants already exist. Domain engines are pure functions, not registered tools. I1 registers real exports; do not mint catalog stubs. |
| AC-FH-014 | Import-only/catalog-only/missing binary stays explicit | Catalog modes and missing `yara`/`sigma` binaries are already honest if not spawned. Workflows must return unavailable + next action, never a pass. |
| AC-FH-015 | Bad detector arguments fail before the handler; valid args reach a real check | No pre-handler validator. `sigmaRulepack` emits a template. Offline compare of supplied evidence is the only genuine check on this host. |
| AC-FH-016 | Profile defaults, grants, and catalog ids agree | `resolveRunAllowlist` already freezes catalog grants for these hats. Profile `defaultTools` still advertise probe names. That fix is C2 (`operators/index.ts`), not a hat slice. Do not add probe ids to grants. |
| AC-FH-018 | Staged parent/specialist workflows with evidence decisions and completion refs | `workflow.ts` files do not exist. Add them in B1/K1/W1. Do not copy Red tools. |
| AC-FH-021 | Loaded role guidance names decision rights, tools, limits, evidence, completion | Parent/specialist strings already sit in `OPERATOR_SYSTEM_PROMPTS`. Dedicated `prompts/{blue,black,white}.ts` do not exist and are not loaded. |
| AC-FH-022 | Workflow and domain guidance is actually loaded | Creating a prompt file is not coverage. I1 must import it. Dormant archetype files do not count. |
| AC-FH-023 | Corpus briefings carry evidence, tool, validation, and completion fields and are consumed | Briefing strings omit those fields and have no runtime consumer. P1 extends the producer; I1/prompt modules load it. |
| AC-FH-025 | Coverage is finding-keyed and cannot be proven by a recommendation or id list alone | `coverageGaps` / `detectionGaps` mark `covered` from id membership. Require an observed artifact id before `covered`. |
| AC-FH-026 | Local detector validation distinguishes validated, failed, unavailable | Template YAML is the current "rule". Binaries are absent. Do not shell out. Do not stub a pass. |
| AC-FH-027 | Hardening retest comes from item-linked evidence, not a checklist sentence | `hardeningPlan` emits severity prose. No before/after outcome field. |
| AC-FH-028 | Blue parent and specialist paths cover the mapped families offline | `FAMILY_TEAM_MAPPING.blue` already names the families. No workflow consumes selected artifacts. |
| AC-FH-029 | Empty plan is insufficient, not `blown` and not a clean bill | `specterCoverReview` returns `blown` on zero actions because `0 >= 0`. Fix belongs in K1 workflow plus a later `hats.ts` retarget, not a new scanner. |
| AC-FH-030 | Every supplied path is costed; the engine must not substitute `[]` | `exfilCostModel` already costs the array it is given. The mounted GET passes `paths: []`. Do not edit `server.ts` in this phase. |
| AC-FH-031 | Nonempty route strings are not `egressVerified: true` | The lie is `hats.ts` line 172. K1 must not copy it. Integration retargets the specialist. |
| AC-FH-032 | Destructive concealment, unapproved probing, live bulk exfil, and unsupported route verification return a no-effect boundary | Flags exist; they still score the action. Workflow refuses before scoring. |
| AC-FH-033 | Only a normalized host/IP/domain establishes scope | Named suffix and path/query lookalikes are already rejected. Empty allow-list and missing target are fail-open. Userinfo is not parsed. |
| AC-FH-034 | Submitted action judged against ROE; missing/corrupt ROE is not permissive | `approved: true` is treated as the receipt. Empty `allowedTargets` is in-scope. Parser file is not in W1; workflow must refuse. |
| AC-FH-035 | One paired ruling retains both opposed claims | `arbiterDispute` emits one one-sided record per claim. Pair in W1 workflow; retarget in integration. |
| AC-FH-036 | Insufficient required evidence cannot score sufficient or 100 | `auditorScore` uses `Math.min(100, accepted * 25)`. Do not copy that formula. |
| NFR-FH-AVAIL-01 | One missing optional dependency leaves Red and other hats usable | Do not import or spawn missing binaries at module load. Return unavailable for that operation only. |
</phase_requirements>

## Summary

Phase 27 does not need new libraries, scanners, EDR, SIEM, or a scheduler mount. The three hats already have pure engines, catalog grants, parent prompts, and corpus arrays. Those engines compute the wrong success condition: id overlap counts as detection coverage, a Sigma template counts as a rule, a nonempty string counts as verified egress, an empty plan counts as `blown`, a boolean counts as approval, and four accepted evidence rows score 100 while siblings stay insufficient.

The smallest plan is four file-disjoint slices that add a workflow module and correct the engines they already own, plus one serialized integration plan that loads the new prompt/corpus exports and retargets the specialist wrappers in `src/teams/hats.ts`. Hat slices must not edit `src/server.ts`, `src/mcp-server.ts`, `src/prompts/index.ts`, `src/teams/purple.ts`, or `src/teams/hats.ts`. HTTP and MCP forwarding of the new results stays Phase 28. `FH-EXEC-4` is unmounted: do not plan `orch_amend.py`, `swarm_amend`, or any host-lifecycle repair.

`recordReceipt` is a private function in `src/server.ts`. Hat workflows cannot call it and must not grow a second writer or a public mint route. They return a stage result only after the computation, citing the bound artifact or plan item. Persistence of `origin: 'observed'` stays behind that private writer and is not a Phase 27 hat-file edit.

**Primary recommendation:** Implement staged offline workflows in the allocated files; treat missing validators as unavailable; leave grants, scanners, and `server.ts` alone; load prompts only in the integration plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coverage, detector replay, hardening retest | API / Backend pure modules (`src/teams/blue/`) | — | Offline computation over supplied artifacts. No browser, no SIEM, no live remediation. |
| Plan noise, path costing, refusal boundary | API / Backend pure modules (`src/teams/black/`) | — | Analysis of supplied plans and paths. No probe, no egress execution. |
| Scope, ROE, paired dispute, evidence aggregate | API / Backend pure modules (`src/teams/white/`) | — | Referee over supplied text and evidence ids. Parser stays as-is. |
| Corpus briefing fields | API / Backend data (`src/resources/ai-*-playbook.ts`) | Prompt loader (integration only) | P1 owns the producer. Loading is `prompts/index.ts`, which hat plans must not edit. |
| Grant/catalog availability | Existing catalog + `resolveRunAllowlist` | Integration (`adapter-tools.ts`) | Do not add tools. Report `catalog_only` / `import_only` / missing binary as unavailable. |
| Observed-receipt mint | Existing private `recordReceipt` in `server.ts` | — | Not a hat file. Do not duplicate it. |
| HTTP/MCP/skill forwarding | Phase 28 | — | Out of B1/K1/W1/P1. The empty-array GET is a known consumer defect, not a K1 edit. |

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` is absent. `.planning/config.json` is absent (roadmap states this; no file was found). Treat nyquist validation and security enforcement as enabled.

From `.planning/PROJECT.md` (read this session):

- Analysis-first. Blue validates detections; it does not operate EDR/SIEM.
- No new runtime dependencies unless unavoidable. This phase needs none.
- Prompts extend the PLINIAN authority model. No refusal-evasion. No destructive anti-forensics.
- Existing `/api/*` contracts stay. Do not retarget routes in hat slices.
- Never weaken test pins to vacuity.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Existing TypeScript engines | repo | Coverage, costing, ROE, evidence | Already the product. Do not replace them. |
| `node:crypto` `createHash` | Node 24.18.0 | Stage input hashes, already used by `artifactHash` and Sigma uuidv5 | In-repo. Do not add a hash package. |
| vitest | 4.1.9 | Extend existing suite files | Already the runner. |

### Supporting

None. Do not add Sigma CLI, YARA, osquery, Suricata, or an ATT&CK library as a dependency. Catalog notes already name them. On this host `yara`, `sigma`, `sigma-cli`, `osqueryi`, and `suricata` are not on `PATH`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Offline compare of supplied evidence | Spawn `sigma check` / `yara` | Binaries are missing. Spawning them is a live-tool plan this phase forbids. Missing tool stays `unavailable` plus the catalog `installHint`. |
| Correct `exfilCostModel` / new workflow | Edit `GET /api/teams/black/exfil` | Route is `server.ts`. Hat plans must not edit it. Phase 28 forwards inputs. |
| New prompt modules loaded by I1 | Longer text inside `prompts/index.ts` | Hat plans must not edit `prompts/index.ts`. Length is not the test. |
| Explicit unavailable for `osquery`/`suricata`/`caldera` | Grant active scanners | Forbidden. 2026-10-15 grant revert stands. |

**Installation:** none.

**Version verification:** `node --version` returned `v24.18.0`. `npx vitest --version` returned `vitest/4.1.9`. No package install.

## Package Legitimacy Audit

No external package is installed or recommended. Verdict table is empty.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Do not `npm install` `sigma-cli`, `yara`, or any detector-replay package. Those names are not a Phase 27 dependency.

## File-Disjoint Split

Use these paths and no others in the four parallel slices. The five-path cap is already full for B1, K1, and W1. Do not add a test file to those assignments.

| Slice | Owns | Must not touch |
|-------|------|----------------|
| B1 | `src/teams/blue/workflow.ts` (new), `src/teams/blue.ts`, `src/teams/blue/coverage.ts`, `src/teams/blue/rulepacks.ts`, `src/prompts/blue.ts` (new) | `hats.ts`, `telemetry.ts`, `d3fend.ts`, `server.ts`, `prompts/index.ts`, suite files |
| K1 | `src/teams/black/workflow.ts` (new), `src/teams/black/exfil.ts`, `src/teams/black/noise.ts`, `src/teams/black/checklist.ts`, `src/prompts/black.ts` (new) | `hats.ts`, `black.ts` (parent noise/cover, not in the slice), `attack-data.ts`, `server.ts` |
| W1 | `src/teams/white/workflow.ts` (new), `src/teams/white.ts`, `src/teams/white/evidence-chain.ts`, `src/teams/white/report-auditor.ts`, `src/prompts/white.ts` (new) | `roe-parser.ts` (reuse it), `hats.ts`, `server.ts` |
| P1 | `src/resources/ai-defense-playbook.ts`, `src/resources/ai-tradecraft-playbook.ts`, `src/resources/ai-adjudication-playbook.ts` | Prompt index, server, suite files |
| Integration, after exports | `src/teams/hats.ts` (C2), `src/prompts/index.ts`, `src/arsenal/adapter-tools.ts`, `src/teams/purple.ts`, `src/mcp-server.ts` | Do not start until workflow exports exist. Do not edit the four slices' files in parallel with them. |
| Q2, after the slice it tests | `src/__tests__/blue-suite.test.ts`, `black-suite.test.ts`, `white-suite.test.ts`. Playbook pins live in `ai-*-playbook.test.ts`. | Do not empty a behavior check. Do not put these files inside the five-path hat assignments. |

`src/teams/hats.ts` is where `specterCoverReview`, `wraithExfilSim`, `sentinelDetectorMap`, `wardenHardeningReview`, `arbiterDispute`, and `auditorScore` live. The success criteria name those specialists. The four slices cannot edit that file without overlapping C2. They export the corrected computation. The integration plan retargets the six wrappers to those exports and updates `src/__tests__/hats-modules.test.ts` in that same serialized window (the pin `egressVerified: true` must change with the wrapper, not be deleted).

Do not plan `orch_amend.py`. File-disjoint planning does not require the unmounted amend host.

## Smallest Gap per Success Criterion

### Roadmap criterion 1 — discovery, grants, receipts, isolation

**Gap:** Domain operations are not registered tools, and profile `defaultTools` still name probe builtins the allowlist does not grant. Catalog grants themselves already agree with the catalog and with parent/specialist subset tests.

Do not add tools. I1 registers only functions the hat slices export. C2 (`src/operators/index.ts`, not a hat slice) marks unresolved profile ids unavailable. It must not copy `http_request` / `curl_request` into Blue, Black, or White grants.

`resolveRunAllowlist` already says Blue, White, and their hats freeze catalog grants, never operator `defaultTools` `[VERIFIED: src/teams/contracts.ts:235-257]`.

Receipts: workflows return binding fields after computation. They do not call `recordReceipt` and do not set `origin: 'observed'`. Quoted writer contract `[VERIFIED: src/server.ts:977-984]`:

```
function recordReceipt(binding: {
  runId: string;
  missionId: string;
  stage: string;
  tool: string;
  inputSha256: string;
  itemId: string;
}): ObservedReceipt
```

One missing optional binary must not throw at import. Follow the existing adapter degrade: a missing binary returns `success: false` and `installHint`, inside the call, not at load `[VERIFIED: src/arsenal/adapter-tools.ts:491-497]`.

### Roadmap criterion 2 — Blue artifacts, replay, retest

**Gap:** Coverage and hardening never read a selected artifact. Id membership yields `covered`. A generated Sigma document is the only detector artifact. Hardening items have no retest outcome.

`detectionGaps` marks covered when `coveredIds.has(finding.id)` `[VERIFIED: src/teams/blue.ts:59-64]`. `coverageGaps` does the same for countermeasure-id overlap or `coveredIds` `[VERIFIED: src/teams/blue/coverage.ts:132-136]`. `sigmaRulepack` emits experimental YAML and does not compare evidence `[VERIFIED: src/teams/blue/rulepacks.ts:126-163]`. `HardeningItem` is only `priority`, `findingIds`, `control`, `effort` `[VERIFIED: src/teams/blue.ts:82-87]`.

B1 workflow accepts selected artifact ids plus supplied matching and non-matching evidence text. `covered` requires an observed artifact id on that finding. Id-only overlap stays `partial` with a limitation. A recommendation string never upgrades coverage.

Detector standing is exactly `validated`, `failed`, or `unavailable`. Compare supplied evidence offline in process. Do not spawn `sigma` or `yara` (both missing). Syntax-only Sigma YAML, missing evidence, or a missing binary is `unavailable` with the catalog next action (`sigma` installHint: `pipx install sigma-cli  # plus the pySigma conversion-pipeline extras`; `yara` installHint: `brew install yara`) `[VERIFIED: src/arsenal/catalog.ts:1127-1128, 1239-1240]`. Do not stub `validated`.

`sigma` and `yara` have no `ARG_TEMPLATES` entry, so a minted call would be `DEFAULT_TEMPLATE`: the binary plus a positional target `[VERIFIED: src/arsenal/adapter-tools.ts:431-442]`. I1 must not add that spawn. Argument checks for detector inputs belong in B1 as a pure reject-before-compute, not as a subprocess.

Hardening workflow takes item id, baseline evidence id, and retest evidence id. Outcomes: `open`, `failed-retest`, `successful-retest`, `insufficient-evidence`. A checklist sentence cannot be `successful-retest`.

Families already mapped `[VERIFIED: src/teams/index.ts:77]`:

```
blue: ['web_api', 'cloud_infra', 'code_supply_chain', 'crypto_secrets', 'reporting_remediation', 'ai_red_team', 'agent_warfare']
```

Branch on those strings. Do not probe the target. Unavailable validation stays open and does not fail the other families or Red.

Existing pin to extend, not delete: `blue-suite.test.ts` expects `coveredIds: ['F-DIRECT']` to be covered. Q2 changes that assertion to the new limitation. Do not empty the test.

### Roadmap criterion 3 — Black plan, paths, refusal

**Gap:** Empty Specter input is a fabricated `blown`. Wraith sets verified from a nonempty string. The mounted exfil route discards paths. Refusal is a flag inside a scored review, not a no-effect boundary.

`specterCoverReview` verdict line `[VERIFIED: src/teams/hats.ts:105-109]`:

```
const verdict = realismFlags.some(f => f.includes('destructive')) || noise.score < 40 || leakCount >= actions.length * 2
  ? 'blown'
  : noise.violations.length > 0 || leakCount > 0 || realismFlags.length > 0
    ? 'fragile'
    : 'holds';
```

Zero actions means `leakCount === 0` and `actions.length * 2 === 0`, so `0 >= 0`, so `blown`. That is the forbidden fabricated failure. With that comparison removed, zero actions and a declared egress string would fall through to `holds` (clean bill), which is also forbidden. K1 `workflow.ts` returns an explicit empty/insufficient result before any verdict. Do not copy the `0 >= 0` comparison.

`wraithExfilSim` `[VERIFIED: src/teams/hats.ts:169-172]`:

```
feasible: egress.length > 0 && noiseCost !== 'high',
egressVerified: egress.length > 0,
```

`exfilCostModel` does not have `egressVerified`. It sets `feasible: egressDeclared && tier !== 'high'` where `egressDeclared = egress.length > 0` `[VERIFIED: src/teams/black/exfil.ts:129, 176]`. K1 changes that standing to `declared`, `modeled`, or `unverified`. Verified only if the caller passes an observed route-evidence id for the same path. A string never verifies. K1 does not edit `hats.ts`. Integration stops the wrapper from returning `egressVerified: true`. The pin in `hats-modules.test.ts` (`egressVerified: true` on `egress: ['proxy-egress-1']`) is updated there, not deleted.

`GET /api/teams/black/exfil` calls `exfilCostModel({ paths: [], egress: [] })` `[VERIFIED: src/server.ts:6659-6660]`. K1's engine already costs every element of the array it receives. The slice must not substitute `[]` inside the new workflow. It also must not edit `server.ts`. Phase 28 replaces that route. Do not mark the public route done in a Phase 27 plan.

Destructive concealment, unapproved probing, live bulk exfil, and a request to verify a route with no observed evidence return a boundary: refused, zero effects, authorized alternative named. ATT&CK vocabulary hits stay labeled modeled/imported, not observed. `opsecReview` already returns empty phases for an empty plan `[VERIFIED: src/teams/black/checklist.ts:214-217]`. Keep that. Do not turn it into `blown`.

### Roadmap criterion 4 — White scope, ROE, disputes, aggregates

**Gap:** Missing target and empty allow-list are in-scope. `approved: true` is treated as a receipt. Disputes are one-sided. The specialist score can be 100 with insufficient rows.

Scope short-circuit `[VERIFIED: src/teams/white.ts:68]`:

```
const inScope = !target || !allowedTargets.length || allowedTargets.some(allowed => hostInScope(host, allowed));
```

A replica of `hostOf` / `hostInScope` (same expressions as `white.ts:35-50`, not an export) against allow-list `['allowed.example']` produced:

| Target | inScope |
|--------|---------|
| `allowed.example.attacker.test` | false |
| `notallowed.example` | false |
| `https://attacker.test/allowed.example` | false |
| `https://attacker.test?x=allowed.example` | false |
| `https://allowed.example@attacker.test/path` | false |
| `https://user:pass@allowed.example/path` | false |
| `http://allowed.example:8443/admin` | true |
| empty allow-list, any host | true |
| empty target | true |

Named suffix and path/query lookalikes are already rejected. Do not rewrite the label-boundary rule. The smallest fix in `white.ts`: parse userinfo and bracketed IPv6 before the existing match so a permitted URL keeps its host, and do not treat missing target or empty `allowedTargets` as membership. Fail closed. Approval must not flip an out-of-scope host.

`roeAudit` treats `action.approved !== true` as the approval gate `[VERIFIED: src/teams/white.ts:87-93]`. A boolean is not a stamp. W1 workflow requires a supplied approval evidence id before `compliant` on an active action, and refuses to call `roeAudit` when `parseRoe` is not `ok` or `allowedTargets` is empty. Do not edit `roe-parser.ts`. Echo stored revision, text hash, and source line if the caller passes them; do not mint stamps (those are already written on the PUT path in `server.ts`, which this phase does not edit).

`arbiterDispute` sets only the claiming side `[VERIFIED: src/teams/hats.ts:282-283]`. Two claims on one action become two records; arrival order picks which side is filled. W1 workflow groups by action index into one ruling that keeps both positions, or records insufficiency when a side is missing. Integration retargets `arbiterDispute`.

`auditorScore` `[VERIFIED: src/teams/hats.ts:351]`:

```
score: Math.min(100, accepted * 25)
```

Four accepted rows score 100 even if other rows are insufficient. Do not copy this formula into W1. Aggregate standing cannot be sufficient or 100 while a required item is insufficient, missing, broken, or contradictory. `auditEvidenceChain` and `auditReport` already keep per-item status; reuse them. Corroboration changes standing only when a new evidence id is linked.

### Roadmap criterion 5 — loaded guidance and corpus

**Gap:** `src/prompts/blue.ts`, `src/prompts/black.ts`, and `src/prompts/white.ts` do not exist (confirmed by directory listing). `src/prompts/index.ts` does not import `BLUE_ARCHETYPE_PROMPTS`, `BLACK_ARCHETYPE_PROMPTS`, or `WHITE_ARCHETYPE_PROMPTS`. Those archetype files are dormant. Parent and six specialist strings in `OPERATOR_SYSTEM_PROMPTS` are already loaded via `src/operators/index.ts`, and tests pin length greater than 1500. More length does not satisfy AC-FH-022.

Hat slices write the new prompt modules. Each parent and specialist block names the real workflow export, the grant ids it may use, and the limits (no EDR/SIEM, no active scan, no verified egress from a string, no score 100, missing validator stays unavailable). I1 imports them into the prompt assembly. Until that import, the files are dormant and AC-FH-022 is not met. Do not edit `prompts/index.ts` inside B1, K1, or W1.

Corpus producers omit the consumer contract:

- `aiDefenseBriefing` emits `category`, `id`, `signal` only `[VERIFIED: src/resources/ai-defense-playbook.ts:170-171]`.
- `aiTradecraftBriefing` emits `attckId`, `id`, `opsecRisk`, `tradecraftUse` only `[VERIFIED: src/resources/ai-tradecraft-playbook.ts:174-175]`.
- `aiAdjudicationBriefing` emits `framework`, `id`, `adjudicationRule` only `[VERIFIED: src/resources/ai-adjudication-playbook.ts:168-169]`.

No server or agent module imports those three briefings (only the playbook tests do). `server.ts` imports `aiRedTeamBriefing` only.

P1 adds permitted-tool ids (existing grant ids only), evidence expectation, validation/completion fields, and an untrusted-data mark. Keep one briefing line per technique so the existing pin `brief.split('\n').length === PLAYBOOK.length` and the `[id]` pin still hold. Do not rename ids. Dangerous examples (Atomic Red Team prose, staged-drop wording) stay data. Do not execute them.

Imported plans and framework text are untrusted data in every workflow. They cannot change grants, authorize a target, or promote a hypothesis to observed.

## Architecture Patterns

### System Architecture Diagram

```
selected artifact / plan / path / ROE text / evidence ids
        |
        v
workflow.ts (B1 | K1 | W1)  -- rejects missing/malformed before compute
        |
        +-- cites artifactId or plan item id
        +-- calls existing pure engine (coverage, exfil, roe, chain)
        +-- unavailable + next action if validator binary or evidence is missing
        +-- returns stage result (not origin:observed)
                |
                v
        integration (after exports)
        hats.ts wrappers delegate
        prompts/index.ts loads prompts/blue|black|white.ts
        adapter-tools registers exports; does not spawn sigma/yara
                |
                v
        Phase 28 HTTP/MCP/skills forward the same functions
        server.ts recordReceipt remains the only observed mint
```

### Recommended Project Structure

```
src/teams/blue/workflow.ts      # B1 staged coverage, replay standing, retest
src/teams/black/workflow.ts     # K1 empty-plan, path costing, refusal
src/teams/white/workflow.ts     # W1 scope, ROE fail-closed, paired dispute, aggregate
src/prompts/blue.ts             # B1 guidance; loaded only by integration
src/prompts/black.ts            # K1
src/prompts/white.ts            # W1
src/resources/ai-*-playbook.ts  # P1 briefing fields
```

### Pattern 1: Unavailable is a result, not a throw

**What:** A missing binary, missing artifact, or syntax-only rule returns `{ standing: 'unavailable', nextAction }` from the workflow. It does not throw at import and does not return `validated`.
**When:** Sigma replay, YARA, osquery, suricata, caldera, or any optional catalog id.
**Example:**

```typescript
// Standing values used by this phase. Do not invent a pass.
type DetectorStanding = 'validated' | 'failed' | 'unavailable'
```

`validated` only after supplied matching evidence hits and supplied non-matching evidence does not, using in-process comparison. No subprocess.

### Pattern 2: Stage result cites an item, then returns

**What:** Each stage names `itemId` (finding, path, action, or evidence id) and an input hash over the bytes or canonical JSON it actually read. Return that object. Do not write `observedReceipts`.
**When:** Every workflow stage.
**Example:** Mirror the private binding fields already required by `recordReceipt` (`runId`, `missionId`, `stage`, `tool`, `inputSha256`, `itemId`) as a return value. `tool` is the real function name (`coverageGaps`, `exfilCostModel`, `roeAudit`, `auditEvidenceChain`), not a scanner binary.

### Anti-Patterns to Avoid

- **Copying Red `defaultTools` into hat grants.** Profile names and catalog ids already disagree. Adding probes makes it worse and violates the grant revert.
- **Editing `server.ts` to stop the empty exfil GET.** That is Phase 28. K1 only refuses to substitute `[]` in its own function.
- **Treating a new prompt file as loaded.** AC-FH-022 fails until `prompts/index.ts` imports it.
- **Retargeting `hats.ts` inside B1, K1, or W1.** Overlaps C2.
- **Deleting `egressVerified: true` or `coveredIds` tests.** Update the assertion in the plan that owns that file. Do not empty the check.
- **Spawning `sigma` or `yara`, or planning `orch_amend.py`.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Observed receipt mint | Second map or public POST | Private `recordReceipt` later; return binding fields now | Writer is private. A public mint is forbidden. |
| Host parsing from scratch with new rules | A second scope dialect | Existing `hostInScope` after userinfo/bracket normalization | Suffix lookalikes already fail. A new matcher can re-open them. |
| Detector engine | Sigma/YARA subprocess wrapper | In-process compare, else `unavailable` | Binaries are absent. A wrapper that succeeds without a compare is a stub pass. |
| ATT&CK/D3FEND data | New taxonomy | `attack-data.ts`, `d3fend.ts` | Already vendored. Do not edit them in these slices. |
| Grant expansion | New catalog ids | `teamToolGrants` / `hatToolGrants` as they are | Subset tests already pass. New ids are a shared-file edit. |
| Scheduler fan-in | `orch_amend.py` / `swarm_amend` | File-disjoint plans | FH-EXEC-4 is unmounted. Same-task fan-in stays unsupported. |

**Key insight:** The failing behavior is a wrong predicate on data the engines already accept, not a missing platform.

## Common Pitfalls

### Pitfall 1: Empty Specter plan becomes `blown`

**What goes wrong:** `leakCount >= actions.length * 2` is true when both sides are 0.
**Why it happens:** The comparison was written for nonempty plans.
**How to avoid:** K1 workflow returns insufficient before verdict selection. Integration must not leave `specterCoverReview` on that comparison.
**Warning signs:** A test with `actions: []` expects `blown` or `holds`.

### Pitfall 2: String egress verifies the route

**What goes wrong:** `egressVerified: egress.length > 0` and `feasible: egressDeclared && tier !== 'high'`.
**Why it happens:** Declared and verified were collapsed.
**How to avoid:** Three-way standing. Verified requires an observed evidence id.
**Warning signs:** `hats-modules.test.ts` still expects `egressVerified: true` after a string-only input. That pin stays true until the integration plan changes the wrapper.

### Pitfall 3: Id list proves coverage

**What goes wrong:** `coveredIds` or countermeasure overlap returns `covered` with no artifact.
**Why it happens:** v1 compatibility path.
**How to avoid:** `covered` requires an observed artifact id. Q2 updates the v1 pin; it does not delete it.
**Warning signs:** A recommendation string or registry source name alone yields `covered`.

### Pitfall 4: Score 100 with insufficient siblings

**What goes wrong:** `accepted * 25` capped at 100 ignores `insufficient`.
**Why it happens:** Count was used as strength.
**How to avoid:** W1 aggregate refuses sufficient or 100 when any required item is insufficient. Do not copy the formula into `report-auditor.ts`.
**Warning signs:** A fixture with one weak row and four receipts scores 100.

### Pitfall 5: Fail-open scope

**What goes wrong:** No target, or `allowedTargets: []`, is in-scope. `parseRoe` can be `ok` with only an allow-active line and still produce an empty allow-list.
**Why it happens:** `!target || !allowedTargets.length` short-circuits before `hostInScope`.
**How to avoid:** Workflow refuses before `roeAudit` unless a normalized host is in a nonempty allow-list. Do not edit the parser.
**Warning signs:** An action with no target returns `compliant`.

### Pitfall 6: Dormant prompt counted as coverage

**What goes wrong:** `prompts/blue.ts` exists but nothing imports it.
**Why it happens:** The hat slice cannot edit `prompts/index.ts`.
**How to avoid:** The I1 import is a required plan, not a follow-up. AC-FH-022 stays open until that import is in the loaded prompt path.
**Warning signs:** A test only asserts the file exists or the string length.

### Pitfall 7: Optional binary throws and takes Red down

**What goes wrong:** A top-level import or spawn of `yara` or `sigma` fails module load.
**Why it happens:** Treating a catalog id as a required binary.
**How to avoid:** No top-level spawn. Unavailable is a return value.
**Warning signs:** Importing the new workflow throws because a binary is missing.

## Code Examples

### Coverage predicate (do not keep id-only covered)

```typescript
// Source: src/teams/blue/coverage.ts:132-136 (current, do not keep as covered)
// const covered = directlyCovered.has(finding.id)
//   ? [...resolved]
//   : resolved.filter(id => telemetryCountermeasures.has(id))
//
// Phase 27: id overlap without an observed artifact id is partial, never covered.
```

### Route standing (do not copy)

```typescript
// Source: src/teams/hats.ts:172 (current lie)
// egressVerified: egress.length > 0
//
// K1 workflow returns routeStanding: 'declared' | 'modeled' | 'unverified'
// 'verified' only when an observed route evidence id is supplied for that path id.
```

### Evidence aggregate (do not copy)

```typescript
// Source: src/teams/hats.ts:351 (current lie)
// score: Math.min(100, accepted * 25)
//
// If any required item is insufficient, missing, or contradictory,
// standing is insufficient. Do not emit 100.
```

### Bound artifact the workflows may consume

```typescript
// Source: src/teams/contracts.ts:147-157
export interface BoundInlineArtifact {
  artifactId: string;
  label?: string;
  mediaType: 'text/plain';
  encoding: 'utf8';
  byteLength: number;
  hash: string;
}
```

Workflows take already-bound ids and hashes. They do not reimplement `bindInlineArtifact`. Caller-supplied ids stay labels.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cosmetic prompt length and grant counts | Functional depth, file-disjoint engines | Phase 27 context, 2026-10-15 | Do not add tools to match Red |
| Black active scanners to match Red's count | Grant revert stands | 2026-10-15 | Do not add scanners |
| Public receipt mint | Private `recordReceipt` after real computation | Phase 26 | Hat code returns bindings only |

**Deprecated/outdated:**

- Counting `OPERATOR_SYSTEM_PROMPTS[hat].length > 1500` as parity. The pin stays; it is not the Phase 27 test.
- Treating `sigmaRulepack` YAML as a validated detection.
- Treating `egress.length > 0` as verification.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Integration may retarget `hats.ts` in a serialized plan after the four slices, even though CONTEXT names only I1 files for registration | File-Disjoint Split | If `hats.ts` is frozen, specialist wrappers keep the lies and AC-FH-029, 031, 035, and 036 fail at the specialist entry. The planner must either include that retarget or record the wrappers as still lying. |
| A2 | Phase 28, not Phase 27, replaces `exfilCostModel({ paths: [], egress: [] })` | AC-FH-030 | If a reviewer treats the GET as in Phase 27 scope, K1 cannot close it without editing `server.ts`, which is forbidden. |
| A3 | In-process evidence compare is accepted as local detector validation when binaries are absent | AC-FH-026 | If the owner requires a real `sigma` or `yara` process, the only honest Phase 27 result is `unavailable`, not a new dependency. |

**If A1 is rejected:** still ship the workflow exports. Do not edit `hats.ts` inside B1, K1, or W1.

## Open Questions

1. **Who owns the `hats.ts` retarget?**
   - What we know: specialists live there; the four slices must not share that file; C2's path list includes it.
   - What's unclear: whether the parent will issue that serialized plan inside Phase 27 or leave the wrappers until Phase 28.
   - Recommendation: plan it as the integration wave after exports. Do not block B1, K1, W1, or P1 on it. Do not pretend the wrappers are fixed if that wave is cut.

2. **Does AC-FH-030's public route block Phase 27?**
   - What we know: CONTEXT defers HTTP/MCP forwarding to Phase 28. The route hardcodes `paths: []`.
   - What's unclear: whether a reviewer will reject Phase 27 until the GET forwards.
   - Recommendation: K1 exports a function that costs every supplied path and returns insufficient on an empty supplied set. State in the plan that the GET remains Phase 28. Do not edit `server.ts`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | workflows, vitest | yes | v24.18.0 | — |
| vitest | Q2 suites | yes | 4.1.9 | — |
| yara | AC-FH-026 binary replay | no | — | `unavailable` plus catalog installHint. No spawn. |
| sigma / sigma-cli | AC-FH-026 syntax check | no | — | `unavailable` plus installHint. No spawn. |
| osqueryi | catalog id `osquery` | no | — | Already `catalog_only`. Report unavailable. |
| suricata | catalog id `suricata` | no | — | Already `catalog_only`. Report unavailable. |
| FH-EXEC-4 / `swarm_amend` | parallel scheduler | unmounted | — | Do not plan `orch_amend.py`. File-disjoint plans only. |

**Missing dependencies with no fallback:** none, if unavailable is an explicit result.

**Missing dependencies with fallback:** yara, sigma, osqueryi, suricata. Fallback is an unavailable result, not a stub pass and not an install during the phase.

## Validation Architecture

`workflow.nyquist_validation` is absent (no `.planning/config.json`), so this section is in scope.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 |
| Config file | `vitest.config.ts` (include `src/**/*.test.ts`) |
| Quick run command | per-slice commands below |
| Full suite command | do not run `npm test` in this phase's plans |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AC-FH-025, 026, 027, 028 | coverage, replay standing, retest, families | unit | `npx vitest run src/__tests__/blue-suite.test.ts` | yes, extend, do not empty |
| AC-FH-029, 030, 031, 032 | empty plan, path costing, route standing, refusal | unit | `npx vitest run src/__tests__/black-suite.test.ts` | yes, extend |
| AC-FH-033, 034, 035, 036 | scope, ROE fail-closed, paired dispute, aggregate | unit | `npx vitest run src/__tests__/white-suite.test.ts` | yes, extend |
| AC-FH-023 | briefing fields, untrusted mark, line-count pin held | unit | `npx vitest run src/__tests__/ai-defense-playbook.test.ts src/__tests__/ai-tradecraft-playbook.test.ts src/__tests__/ai-adjudication-playbook.test.ts` | yes; extend only if a pin must change; prefer keeping line-count and `[id]` pins green |
| AC-FH-013, 014, 016 | grant subset, no new probe ids | unit | `npx vitest run src/__tests__/teams-archetypes.test.ts src/__tests__/hats-archetypes.test.ts` | yes; do not edit in hat slices |
| Specialist wrapper retarget | `egressVerified` pin moves with `hats.ts` | unit | `npx vitest run src/__tests__/hats-modules.test.ts` | yes; integration plan only |

### Sampling Rate

- **Per task commit:** the one vitest command for that slice's suite file
- **Per wave merge:** the four commands above, still not `npm test`
- **Phase gate:** those commands green before `/gsd:verify-work`. Full `npm test` is not a Phase 27 hat-plan step.

### Wave 0 Gaps

- [ ] `src/__tests__/blue-suite.test.ts` — add artifact-required coverage, `validated` / `failed` / `unavailable`, and retest outcomes. Update the `F-DIRECT` pin; do not delete it.
- [ ] `src/__tests__/black-suite.test.ts` — add empty-plan insufficient, every-path totals, string egress unverified, and refusal with zero effects.
- [ ] `src/__tests__/white-suite.test.ts` — add empty allow-list fail-closed, userinfo host, paired dispute, and aggregate not 100.
- [ ] `src/__tests__/hats-modules.test.ts` — only the integration plan updates `egressVerified: true`. Not a B1, K1, or W1 file.
- No new framework install.

## Security Domain

`security_enforcement` is not set to false.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 26 already. Do not add a login path. |
| V3 Session Management | no | No new session. |
| V4 Access Control | yes | Existing `teamToolGrants` / `hatToolGrants` / `resolveRunAllowlist`. Do not widen. |
| V5 Input Validation | yes | Reject missing, wrong-typed, and unsafe detector, plan, and ROE inputs before compute. Untrusted corpus and imported plans stay data. |
| V6 Cryptography | no new crypto | Use existing `createHash('sha256')` via `artifactHash` or the same call. Do not hand-roll. |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Id list or recommendation treated as proof | Repudiation | `covered` and `validated` require observed artifact ids |
| String egress treated as verified route | Spoofing | `declared` / `modeled` / `unverified` unless observed evidence id |
| Empty allow-list or missing target treated as in-scope | Elevation of privilege | Fail closed before `roeAudit` |
| `approved: true` treated as a receipt | Elevation of privilege | Require an approval evidence id |
| Corpus or imported plan instructions followed | Tampering | Untrusted data. Cannot change grants or promote to observed |
| Missing binary swapped for a pass | Repudiation | `unavailable` plus next action. No stub. |
| Optional import throws and disables Red | Denial of service | No top-level spawn. Isolate the unavailable result. |
| Public receipt mint | Spoofing | Do not add one. Do not set `origin: 'observed'` in team modules. |

## Sources

### Primary (HIGH confidence)

- `src/teams/blue.ts`, `src/teams/blue/coverage.ts`, `src/teams/blue/rulepacks.ts` — coverage and template rules, read this session
- `src/teams/black/exfil.ts`, `noise.ts`, `checklist.ts`, `src/teams/hats.ts` — path costing, empty-plan verdict, `egressVerified`
- `src/teams/white.ts`, `evidence-chain.ts`, `report-auditor.ts` — scope short-circuit, chain, report aggregate
- `src/teams/index.ts`, `src/teams/contracts.ts`, `src/arsenal/catalog.ts`, `src/arsenal/adapter-tools.ts` — grants, allowlist, execution modes, missing-binary degrade
- `src/server.ts:977-984` and `:6659-6660` — private writer and empty exfil GET
- `src/prompts/` directory listing — `blue.ts`, `black.ts`, and `white.ts` absent; archetype modules not imported by `prompts/index.ts`
- `src/resources/ai-defense-playbook.ts`, `ai-tradecraft-playbook.ts`, `ai-adjudication-playbook.ts` — briefing field lists
- Local replica of `hostOf` / `hostInScope` — lookalike table above
- `command -v` — yara, sigma, sigma-cli, osqueryi, and suricata missing; node v24.18.0; vitest 4.1.9

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` Phase 27 path table and success criteria
- `.planning/REQUIREMENTS.md` AC-FH-013 through 016, 018, 021 through 023, 025 through 036, NFR-FH-AVAIL-01
- `.planning/PROJECT.md` analysis-first doctrine

### Tertiary (LOW confidence)

- None used as a recommendation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new package; versions read from the host
- Architecture: HIGH — gaps are in files read this session; integration ownership of `hats.ts` is MEDIUM (A1)
- Pitfalls: HIGH — predicates quoted from source

**Research date:** 2026-10-15
**Valid until:** 2026-11-14 (stable in-repo engines; re-check if `hats.ts` or `server.ts` routes change)

## RESEARCH COMPLETE
