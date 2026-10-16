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

Read the egress cost report the backend computes for the run — every
planned path costed per channel against the noise budget:

- Exfil cost report —
  `curl -s http://127.0.0.1:3333/api/teams/black/exfil` (per-path
  `pathId`, `channel`, `tier`, `totalCost`, `feasible`, and pressure
  `notes`; envelope `totalVolumeMb`, `totalCost`, `budget`, `within`).

A nonempty egress string is not verified egress. POST the paths to `tempest_black_workflow` or `http://127.0.0.1:3333/api/teams/black/workflow` and relay `declared`, `modeled`, or `unverified` unless the result cites an observed route-evidence id for that path.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay the `paths` array as the backend returned it — channel, tier, and
cost per path with the pressure notes — and read `within` as the
noise-budget standing. Never re-tier a path the backend already placed,
never call an infeasible path feasible, and never simulate a channel
the backend did not cost.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the per-path verdict (`pathId`, channel,
tier, cost, feasibility notes), total volume and cost against the
budget with the `within` standing, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> Purple Team backend unreachable — start it with npm run server; this
> simulation is parked under its mission id and resumes when the backend
> answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
