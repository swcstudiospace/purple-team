---
title: "API Reference"
summary: "Local HTTP API endpoints grouped by workflow."
description: "Local HTTP API endpoints grouped by workflow."
audience: ["developer", "integrator"]
category: "developer"
status: "current"
source: "T3MP3ST repository"
sourcePath: "docs/API_REFERENCE.md"
updated: "2026-07-20"
---
# T3MP3ST API Reference

The API server is implemented in `src/server.ts`.

Default base URL:

```text
http://127.0.0.1:3333
```

Start it with:

```bash
npm run server
```

The War Room UI is served from `/ui/`; `/` redirects there.

## Security Model

The API is a local operator surface, not a multi-user internet service.

- Default host: `127.0.0.1`
- Default port: `3333`
- Override port with `T3MP3ST_PORT`
- Override bind host with `T3MP3ST_HOST`
- Non-loopback binds (including Docker's `0.0.0.0`) refuse to start unless
  `T3MP3ST_BEARER_TOKEN` or `T3MP3ST_BEARER_TOKEN_FILE` is set. `/api/*` then
  requires `Authorization: Bearer <token>` and is rate-limited (60/minute,
  burst 120, `429` + `Retry-After`). `/`, `/ui`, and `/health` stay open.
- Loopback binds do not ask for a token and do not rate-limit.
- State-changing requests are guarded against foreign browser origins
- Loopback binds reject non-loopback Host headers to reduce DNS-rebinding risk
- Active or networked tool use should have a scope/authorization receipt

Do not publish a non-loopback bind beyond the operators who hold the token.

## Health And Runtime

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Basic server health |
| `GET` | `/api/health` | API health alias |
| `GET` | `/api/preflight` | Local preflight and readiness summary |
| `GET` | `/api/events` | Server-sent event stream |
| `GET` | `/api/mission-context/latest` | Latest mission context snapshot |
| `GET` | `/api/net/proxy` | Current outbound SOCKS5 proxy configuration, with credentials redacted |
| `POST` | `/api/net/proxy` | Set or clear outbound SOCKS5 proxy URL |
| `GET` | `/api/net/ip` | Check observed outbound IP path |

Example:

```bash
curl http://127.0.0.1:3333/api/health
```

## Arsenal And Approvals

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/arsenal/catalog` | Tool catalog and adapter metadata |
| `GET` | `/api/arsenal/status` | Installed/readiness status for arsenal tools |
| `POST` | `/api/arsenal/plan` | Plan tool activation for a mission family |
| `GET` | `/api/arsenal/activation` | Activation guidance |
| `GET` | `/api/arsenal/approvals` | Arsenal approval state |
| `GET` | `/api/approvals` | Approval requests |
| `POST` | `/api/approvals/request` | Create an approval request |
| `POST` | `/api/approvals/:id/approve` | Approve a request |
| `POST` | `/api/approvals/:id/reject` | Reject a request |
| `POST` | `/api/approvals/authorize-target` | Record target authorization |
| `GET` | `/api/tools` | Built-in tool metadata |
| `POST` | `/api/tools/execute` | Execute a named tool |
| `POST` | `/api/tools/recon` | Run recon helper flow |

Tool requests should be scoped to authorized targets. External binary availability comes from the local workstation, not from package installation alone.

## Mission Planning And Execution

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/mission/start` | Start a mission |
| `POST` | `/api/mission/stop` | Stop the current mission |
| `POST` | `/api/mission/pause` | Pause the current mission |
| `POST` | `/api/mission/resume` | Resume the current mission |
| `GET` | `/api/mission/status` | Current mission status |
| `GET` | `/api/mission/report` | Current mission report |
| `GET` | `/api/mission/:id/report` | Report for a mission ID |
| `GET` | `/api/mission/findings` | Findings for the active mission |
| `POST` | `/api/mission-drafts` | Create a mission draft |
| `GET` | `/api/mission-drafts` | List mission drafts |
| `GET` | `/api/mission-drafts/:id` | Read a mission draft |
| `PATCH` | `/api/mission-drafts/:id` | Update a mission draft |
| `DELETE` | `/api/mission-drafts/:id` | Delete a mission draft |
| `POST` | `/api/mission-bundles` | Create a mission bundle |
| `GET` | `/api/mission-bundles/:missionId` | Read mission bundle |
| `POST` | `/api/mission-gate` | Evaluate mission readiness gate |

## General Planner And Admiral

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/general/plan` | Generate an Op General plan |
| `GET` | `/api/general/plan` | Read current plan |
| `POST` | `/api/general/execute` | Execute plan steps |
| `POST` | `/api/general/auto` | Plan and execute automatically |
| `GET` | `/api/general/sitreps` | Read sitrep history |
| `POST` | `/api/general/sitrep` | Create a sitrep |
| `POST` | `/api/general/assess` | Run strategic assessment |
| `POST` | `/api/admiral/converse` | Converse with Op Admiral |
| `POST` | `/api/admiral/suggest` | Request mission suggestions |
| `POST` | `/api/admiral/launch` | Launch from Admiral flow |

## Evidence, Findings, And Retests

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/evidence` | List evidence |
| `POST` | `/api/evidence` | Add evidence |
| `GET` | `/api/evidence-graph` | Evidence graph |
| `GET` | `/api/findings` | List findings |
| `POST` | `/api/findings` | Create finding |
| `PATCH` | `/api/findings/:id` | Update finding |
| `POST` | `/api/findings/:id/retest` | Queue or run retest |
| `GET` | `/api/retests` | List retests |
| `PATCH` | `/api/retests/:id` | Update retest |
| `GET` | `/api/repro-packs` | List reproduction packs |
| `POST` | `/api/repro-packs` | Create reproduction pack |

Evidence and finding payloads must avoid raw secrets. Use redaction helpers in `src/redact.ts` and `src/evidence/` when adding new paths.

## Hypotheses And Work Orders

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/hypotheses` | List hypotheses |
| `POST` | `/api/hypotheses` | Create hypothesis |
| `PATCH` | `/api/hypotheses/:id` | Update hypothesis |
| `POST` | `/api/hypotheses/:id/promote` | Promote hypothesis |
| `POST` | `/api/hypotheses/:id/decompose` | Decompose into work orders |
| `POST` | `/api/hypotheses/:id/work-orders` | Work-order decomposition alias |
| `GET` | `/api/work-orders` | List work orders |
| `POST` | `/api/work-orders` | Create work order |
| `PATCH` | `/api/work-orders/:id` | Update work order |
| `POST` | `/api/work-orders/:id/complete` | Complete work order |

## Resources And Operator Context

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/workflow-presets` | Workflow presets |
| `GET` | `/api/resource-packs` | Resource packs |
| `GET` | `/api/resource-packs/:id` | Resource pack details |
| `POST` | `/api/resource-packs/search` | Search resource packs |
| `GET` | `/api/agent-prompt-packs` | Agent prompt packs |
| `GET` | `/api/agent-prompt-packs/:id` | Prompt pack details |
| `GET` | `/api/operator-runbooks` | Operator runbooks |
| `GET` | `/api/operator-runbooks/:family` | Runbook for a family |
| `GET` | `/api/forefront-radar` | Forefront pressure lanes |
| `GET` | `/api/forefront-radar/:id` | Forefront lane details |
| `GET` | `/api/agent-context/:family` | Combined agent context |
| `GET` | `/api/operator-doctrine` | Operator doctrine |
| `GET` | `/api/ai-redteam/playbook` | AI red-team playbook |

## LLMs, Local Agents, And Operators

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/llm/status` | LLM status |
| `POST` | `/api/llm/chat` | Send a chat request |
| `POST` | `/api/llm/local` | Test or use a local OpenAI-compatible model endpoint |
| `POST` | `/api/models` | Resolve model list |
| `GET` | `/api/codex/status` | Codex local status |
| `POST` | `/api/codex/probe` | Probe Codex integration |
| `GET` | `/api/agents/local/detect` | Detect local coding agents |
| `POST` | `/api/agents/local/connect` | Connect local agent |
| `POST` | `/api/agents/local/ping` | Ping local agent |
| `POST` | `/api/agents/local/dispatch` | Dispatch to local agent |
| `POST` | `/api/agents/local/disconnect` | Disconnect local agent |
| `GET` | `/api/agents/local/status` | Local agent status |
| `GET` | `/api/operators/prompts` | Operator prompt overrides |
| `POST` | `/api/operators/prompt` | Set operator prompt override |
| `POST` | `/api/operators/prompt/reset` | Reset operator prompt override |
| `POST` | `/api/operators/spawn` | Spawn operator |
| `POST` | `/api/operators/terminate` | Terminate operator |
| `GET` | `/api/operators/list` | List operators |
| `POST` | `/api/operators/:id/task` | Assign operator task |

## White-Box And Attack Graph

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/whitebox/analyze` | Analyze a local repository path |
| `POST` | `/api/attack-graph` | Build or update attack graph |
| `POST` | `/api/attack-graph/ingest` | Ingest graph material |

Repository paths are contained by resolver logic before analysis. Keep that containment intact when extending white-box features.

## Learning And Improvement

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/watch-loop/status` | Watch Loop status |
| `POST` | `/api/watch-loop/run` | Run Watch Loop pulse |
| `POST` | `/api/self-heal/run` | Run self-heal flow |
| `GET` | `/api/pressure-paths` | Pressure path list |
| `POST` | `/api/pressure-paths` | Create pressure path |
| `POST` | `/api/pressure-paths/canary` | Canary pressure path |
| `POST` | `/api/pressure-paths/duel` | Duel pressure path |
| `POST` | `/api/pressure-paths/mutate` | Mutate pressure path |
| `POST` | `/api/pressure-paths/chains` | Chain pressure paths |
| `POST` | `/api/route-preview` | Preview route |
| `GET` | `/api/routes/:routeId/scorecards` | Route scorecards |
| `POST` | `/api/improvement/proposals` | Create improvement proposal |
| `GET` | `/api/improvement/proposals` | List improvement proposals |
| `POST` | `/api/promotion/evaluate` | Evaluate promotion |
| `GET` | `/api/learning/status` | Learning status |
| `POST` | `/api/learning/run-review` | Run learning review |
| `GET` | `/api/memory/capsule` | Memory capsule |
| `GET` | `/api/memory/proposals` | List memory proposals |
| `POST` | `/api/memory/proposals` | Create memory proposal |
| `POST` | `/api/memory/proposals/:id/accept` | Accept memory proposal |
| `POST` | `/api/memory/proposals/:id/reject` | Reject memory proposal |
| `GET` | `/api/selfimprove/ledger` | Self-improvement ledger |

## Bounty Helpers

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/bounty/platforms` | Supported bounty platforms |
| `GET` | `/api/bounty/programs/:platform` | Programs for a platform |
| `GET` | `/api/bounty/credentials` | Credential readiness |
| `POST` | `/api/bounty/format` | Format a report |
| `POST` | `/api/bounty/submit` | Submit through configured platform integration |

## Subscription OAuth (ChatGPT Plan, Claude/Grok Plans)

Plan sign-ins use OAuth on the server; tokens never leave the server. Check
session state with `GET /api/oauth/status` (per-provider `connected` flags)
or `GET /api/llm/status` (includes an `oauth` summary).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/oauth/openai/start` | Start ChatGPT Plan PKCE flow; returns `{ flowId, authorizeUrl, state }` |
| `POST` | `/api/oauth/openai/complete` | Complete ChatGPT Plan sign-in; body `{ flowId, code }`, returns `{ ok: true, oauth }` |
| `POST` | `/api/oauth/openai/logout` | Clear the ChatGPT Plan session |
| `POST` | `/api/oauth/anthropic/start` | Start Claude Plan PKCE flow; returns `{ flowId, authorizeUrl, state }` |
| `POST` | `/api/oauth/anthropic/complete` | Complete Claude Plan sign-in; body `{ flowId, code }` |
| `POST` | `/api/oauth/anthropic/logout` | Clear the Claude Plan session |
| `POST` | `/api/oauth/xai/start` | Start Grok plan device flow; returns `{ flowId, userCode, verificationUri, expiresIn, interval }` |
| `POST` | `/api/oauth/xai/poll` | Poll Grok plan authorization; body `{ flowId }` |
| `POST` | `/api/oauth/xai/logout` | Clear the Grok plan session |

`complete` returns `400` when `flowId`/`code` are missing or invalid, `502`
from `start` when the provider is unreachable. OAuth runs inside the same
loopback trust as every other route (see Security Model above).

## Dark Purple Teams

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/teams/tool-grants` | Per-team arsenal grant table (`{ grants: { black, blue, white } }`) |
| `POST` | `/api/teams/purple/synthesize` | Correlate findings + detection gaps + ROE verdicts into a posture ledger |
| `GET` | `/api/teams/blue/gaps` | Read-only v2 D3FEND coverage report over the findings ledger (`{ gaps }`, per-gap `unresolvedCountermeasures` surfaced) |
| `GET` | `/api/teams/blue/hardening` | Read-only severity-tiered hardening plan over the findings ledger (`{ items }`) |
| `GET` | `/api/teams/blue/rules` | Read-only Sigma rule pack from ledger coverage gaps (`{ rules, yaml }`, experimental rules) |
| `GET` | `/api/teams/black/cover` | Read-only phase-grouped OPSEC review of the active RED plan, the most recently updated mission draft (`{ phases, egressDeclared, egressNotes, itemCount }`; no draft → empty phases) |
| `GET` | `/api/teams/black/exfil` | Read-only ATT&CK-keyed egress cost report over planned exfil paths (`{ paths, totalVolumeMb, totalCost, budget, within }`; zeroed until a path store exists — drafts carry no channel/volume fields) |
| `GET` | `/api/teams/black/noise` | Read-only tactic-tier noise budget over the active plan's actions (`{ entries, total, budget, within, tier, violations }`; no draft → total 0, tier `quiet`) |
| `GET` | `/api/teams/white/roe` | Structured parse of the on-record ROE text plus provenance-stamped verdicts (`{ roe, resolved, unresolved, commentLines, ok, summary, provenance, verdicts }`; `verdicts` appear only when `ok` is `true`, each carrying `roeRevision`, `roeTextHash`, and `roeLines`; no record, corrupt record, hash mismatch, or `ok: false` → honest `200` report with no `verdicts` member) |
| `PUT` | `/api/teams/white/roe` | Record sanctioned ROE text plus the actions to adjudicate (`{ text, actions }`; `text` capped at 64 KiB utf8 bytes via `Buffer.byteLength`; missing/empty/non-string `text` or non-array `actions` → `400`, oversize text → `413`; stamps monotonic `revision` plus 16-char sha256 `textHash`, answers `200` with `{ revision, textHash, ok, summary }`; replace-latest single slot) |
| `GET` | `/api/teams/white/evidence` | Read-only replay-chain audit over the receipt ledger (`{ links, intact, broken, summary }`; replayable entries must carry a command/uri hook, duplicate ids break the chain) |
| `GET` | `/api/teams/white/report-audit` | Read-only findings ↔ evidence coverage audit (`{ findings, reportReady, withGaps, unclaimedEvidence, summary }`; gaps named exactly, unclaimed ledger entries surfaced) |

`POST /api/teams/purple/synthesize` body:

```json
{
  "findings": [{ "id": "F-1", "title": "Open admin panel", "severity": "high" }],
  "detections": [{ "findingId": "F-1", "coverage": "partial" }],
  "verdicts": [{ "verdict": "allow" }]
}
```

All three fields must be arrays (`400` otherwise). Findings whose `id` exists
in the findings ledger get their stored title/severity merged in read-only.
Responds `201` with the `DarkPurpleSynthesis` (`coverageMatrix` with
`findingId`/`detection`/`verdict`/`riskTier`/`residualRisk`, plus `unresolved`
and `nextMissions`). `riskTier` is the authoritative residual-risk signal: a
deterministic `f(severity, detection, verdict)` per coverage-matrix row.
`residualRisk` is a pure derived rendering of `riskTier` — never an
independent assessment. Vocabulary note: the purple synthesis tier
(`PurpleRiskTier` in `src/teams/purple.ts`: `critical` `high` `medium` `low`
`info`) is unrelated to the arsenal approval-gate tier (`RiskTier` in
`src/types/index.ts`: `local_read` `passive` `active` `intrusive` `credential`
`dangerous`, gating tool execution); the shared name is coincidence and
renaming either requires contract sanction. Purple is an orchestrator
capability, not a spawnable operator archetype — the spawnable teams are
`black`, `blue`, and `white`.

## Provider IDs And Keyless Semantics

`POST /api/models` takes an optional body `{ provider, apiKey, baseUrl }`
(body values override server config; missing values fall back to server
config) and always answers, failing open to the static model list. The
`provider` field on `/api/models`, `/api/mission/start`, `/api/general/*`,
and `/api/admiral/*` accepts the `chatgpt` and `cursor` provider ids:

- `chatgpt` — ChatGPT Plan via the Codex backend. Subscription OAuth is the
  only auth (no API-key path); without a sign-in the route answers with a
  sign-in-required error, never a silent provider swap.
- `cursor` — Cursor Plan via the local `cursor-agent` CLI's own login.
  Keyless like `codex`: no API key or base URL; the selected model rides the
  `::` separator (e.g. `cursor::composer-1`), with `auto` as the CLI's
  pick-a-model sentinel.

Other keyless providers: `codex` (local CLI login), `local` (self-hosted
endpoint, keyless unless the server requires one), `local-agent` (connected
CLI agent), `mock`. A per-request `baseUrl` is honored only for `local`;
cloud provider URLs cannot be redirected by a request.
