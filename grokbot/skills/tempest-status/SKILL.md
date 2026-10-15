---
name: tempest-status
description: >-
  Use when the operator types /tempest-status or /tempest-providers: reads
  mission status plus provider and subscription-session state.
---
# Purple Team status

## /tempest-status — mission state

Drive the `tempest_status` MCP tool, or directly:

```bash
curl -s http://127.0.0.1:3333/api/mission/status
```

Report: mission active or idle, mission id, phase, operators and their
states, finding counts by severity. Keep it to a few lines; the full detail
belongs to `/tempest-report`. When idle, list parked mission ids so the
operator can resume one by quoting it back.

## /tempest-providers — model and session state

Drive the `tempest_providers` MCP tool, or directly:

```bash
curl -s http://127.0.0.1:3333/api/llm/status
curl -s http://127.0.0.1:3333/api/oauth/status
```

Report which providers are connected and which subscription sessions are
live. Subscription sessions stay on the server — if a provider is missing,
name it and stop; never ask the operator to paste a credential into chat,
and never echo one back.

Degraded mode for both commands: if the backend is unreachable, reply

> Purple Team backend unreachable — start it with npm run server.

and nothing else shaped like status. The seat never opens a browser panel;
every step goes through the MCP tools or the loopback HTTP API.
