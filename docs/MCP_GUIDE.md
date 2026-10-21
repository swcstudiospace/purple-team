# MCP Guide

Purple Team includes a Model Context Protocol stdio server in `src/mcp-server.ts`.

## Start The Server

From a development checkout:

```bash
npm run mcp
```

From a built package:

```bash
npm run build
npm run mcp:prod
```

## Exposed Tool

| Tool | Purpose |
|---|---|
| `security_recon` | Runs quick DNS and nmap reconnaissance against a hostname or IP |

Input schema:

```json
{
  "target": "example.com",
  "scan_type": "quick"
}
```

`scan_type` may be `quick`, `standard`, `full`, or `stealth`.

## Safety And Validation

The MCP server validates the target before it reaches a subprocess:

- Target must be a hostname or IP-like value matching `[A-Za-z0-9._:-]`
- Shell metacharacters, spaces, pipes, and command separators are rejected
- Subprocesses use `execFile`, not a shell
- Executable names are restricted to an allowlist

The current `security_recon` implementation calls:

- `dig +short <target> ANY`
- `nmap` with scan arguments selected by `scan_type`

Only use this tool against systems inside your authorized scope.

## Example MCP Tool Call

```json
{
  "name": "security_recon",
  "arguments": {
    "target": "scanme.nmap.org",
    "scan_type": "quick"
  }
}
```

The response is JSON text containing DNS records, nmap output, command summaries, and suggested next steps.

## Purple Team Bot Proxy Tools (`tempest_*`)

Twelve tools proxy the local Purple Team HTTP API over `T3MP3ST_URL` (default
`http://127.0.0.1:3333`). Reads use GET, state changes use POST; no shells,
no child processes. Every failure degrades to `{ ok: false, error }` instead
of throwing — an unreachable backend answers with a "start it with
`npm run server`" message.

| Tool | Calls |
|---|---|
| `tempest_status` | `GET /api/mission/status` + `GET /api/llm/status` |
| `tempest_mission_start` | `POST /api/mission/start` (`name`, `targets`, `operators`) |
| `tempest_mission_stop` | `POST /api/mission/stop` |
| `tempest_report` | `GET /api/mission/report` (or `/api/mission/:id/report` with `missionId`) |
| `tempest_operators_list` | `GET /api/operators/list` |
| `tempest_operator_task` | `POST /api/operators/:id/task` (`operatorId`, `taskName`, `taskDescription`) |
| `tempest_findings` | `GET /api/findings` (optional `missionId` filter) |
| `tempest_providers` | `GET /api/llm/status` + `GET /api/oauth/status` |
| `tempest_purple_synthesize` | `GET /api/teams/purple/synthesize` when no inputs are supplied; otherwise `POST` with `findings`, `detections`, optional `verdicts`, and optional `verdictsByFinding`. When `verdicts` is omitted, the latest ROE ledger revision of the `latest` mission (this tool does not pass a `missionId`) is consumed. With `verdictsByFinding` it joins findings by id; without it the verdicts join no finding and are reported in `verdictSource.unjoinedVerdicts`. Responses carry `verdictSource` |
| `tempest_blue_gaps` | `GET /api/teams/blue/gaps` (read-only over the stored findings ledger) |
| `tempest_blue_rules` | `GET /api/teams/blue/rules` (read-only over the stored findings ledger) |
| `tempest_blue_hardening` | `GET /api/teams/blue/hardening` (read-only over the stored findings ledger) |
| `tempest_black_cover` | `GET /api/teams/black/cover` (read-only over the active RED plan draft) |
| `tempest_black_noise` | `GET /api/teams/black/noise` (read-only over the active RED plan draft) |
| `tempest_black_exfil` | `GET /api/teams/black/exfil` (read-only over the stored exfil report) |
| `tempest_white_evidence` | `GET /api/teams/white/evidence` (read-only over the stored evidence ledger) |
| `tempest_white_report` | `GET /api/teams/white/report-audit` (read-only over the stored findings and evidence ledgers) |
| `tempest_white_roe` | `GET /api/teams/white/roe`, or `PUT` when both `text` and `actions` are supplied. A successful parse writes an observed receipt; a failed parse stores the text and does not |
| `tempest_blue_coverage` | `POST /api/teams/blue/coverage`. Missing artifact bytes fail closed as insufficient-evidence. Not a mission-start step. |
| `tempest_black_workflow` | `POST /api/teams/black/workflow`. An empty plan is insufficient, not a clean bill. Not a mission-start step. |
| `tempest_white_stage` | `POST /api/teams/white/stage`. An empty allow-list is out of scope (`roe-scope-empty`). An approved flag alone is not a receipt. Not a mission-start step. |

Loopback guard: with no bearer set, the proxy refuses any `T3MP3ST_URL`
whose host is not exactly `localhost`, `::1`, or a full dotted quad in
`127.0.0.0/8`. Set `T3MP3ST_BEARER_TOKEN` (or `T3MP3ST_BEARER_TOKEN_FILE`) to
call a non-loopback server; the proxy sends `Authorization: Bearer`. The
server refuses to bind off loopback without that token and rate-limits
`/api` (60/minute, burst 120). Provider keys stay on the server.

## Driving Missions Headlessly

Point the MCP client at this server (`npm run mcp`), then chain the tools:
`tempest_status` to confirm the backend answers, `tempest_mission_start`
with an objective plus targets and operators, `tempest_operator_task` to work
the seats, and `tempest_report` / `tempest_findings` /
`tempest_purple_synthesize` to close out with the engagement report and the
combined posture view. See [API Reference](API_REFERENCE.md) for the
underlying route shapes.
