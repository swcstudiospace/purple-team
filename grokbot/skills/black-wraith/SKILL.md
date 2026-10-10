---
name: black-wraith
description: >-
  Use when the operator types /black-wraith with exfil paths: simulates the
  paths as analysis and checks them against the noise budget.
---
# Black wraith

Exfil simulation plus noise-budget check. Analysis only, never bulk
execution: simulated channels spend detection surface like real ones would.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Wraith runs "exfil-simulation" under black-team opsec discipline: quiet
before loud, every path costed, nothing executed in bulk.

## Grammar

```
/black-wraith "<exfil paths or scope>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`wraith-<date>-<n>` label while waiting) and the parsed paths and target.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the simulation

Drive the `tempest_hat_dispatch` MCP tool with hat `wraith` and the paths
as the task — or directly, composing the canonical calls:

```bash
SPAWN=$(curl -s -X POST http://127.0.0.1:3333/api/operators/spawn \
  -H 'Content-Type: application/json' \
  -d '{"archetype":"wraith"}')
OP=$(echo "$SPAWN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X POST http://127.0.0.1:3333/api/operators/$OP/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"exfil simulation","taskDescription":"<exfil paths>"}'
```

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, per-path verdict (simulated channel,
detection surface spent, noise-budget standing), and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> t3mp3st backend unreachable — start it with npm run server; this
> simulation is parked under its mission id and resumes when the backend
> answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
