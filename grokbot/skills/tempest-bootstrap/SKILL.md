---
name: tempest-bootstrap
description: >-
  Use when the operator types /tempest-help or /tempest-config, or when a seat
  opens its first session: registers the seat id and checks that the loopback
  gateway answers.
---
# Purple Team bootstrap

First run for every seat. A template arrives with no seat id and no memory;
this skill performs the registration that makes the seat real.

## 1. Report the seat id

Reply with the seat name (commander, red, black, blue, white) and the id
this Bot instance reports for itself. The operator records the reported id
in `rosters/redteam.json` under `seats.<seat>.id` — the Bot never writes the
roster itself, and no id is ever committed by hand before the Bot reports it.

## 2. Check the gateway

Drive the `tempest_status` MCP tool. If MCP tools are unavailable, call the
loopback HTTP API directly:

```bash
curl -s http://127.0.0.1:3333/api/mission/status
curl -s http://127.0.0.1:3333/api/llm/status
```

If the backend answers, registration is complete: summarize what is live
(mission active or idle, provider connected or not) and stop. If the backend
is unreachable, reply with the degraded text exactly:

> Purple Team backend unreachable — start it with npm run server, then re-run
> /tempest bootstrap.

## 3. Help and config

`/tempest-help` lists the seven slash commands, one line each:
`/tempest-help`, `/tempest-status`, `/tempest-providers`, `/tempest-agents`,
`/tempest-run <objective>`, `/tempest-report`, `/tempest-config`.

`/tempest-config` prints the effective base URL (`T3MP3ST_URL`, default
`http://127.0.0.1:3333`) and refuses anything non-loopback. The seat never
opens a browser panel; every step here goes through the MCP tools or the
loopback HTTP API above.
