# MCP Guide

T3MP3ST includes a Model Context Protocol stdio server in `src/mcp-server.ts`.

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

## Tempest Bot Proxy Tools (`tempest_*`)

Twelve tools proxy the local t3mp3st HTTP API over `T3MP3ST_URL` (default
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
| `tempest_purple_synthesize` | `POST /api/teams/purple/synthesize` (`findings`, `detections`) |
| `tempest_blue_gaps` | `GET /api/teams/blue/gaps` (detection-coverage gaps over the whole findings ledger) |
| `tempest_black_cover` | `GET /api/teams/black/cover` (phase-grouped opsec review of the active red plan) |
| `tempest_white_roe` | `GET /api/teams/white/roe` (on-record ROE parse plus provenance-stamped verdicts when ROE text is on record: `ok`, `resolved`, `unresolved`, `verdicts` with `roeRevision`/`roeTextHash`/`roeLines`; recording happens via the operator `PUT /api/teams/white/roe` — no MCP mutation tool) |

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
