---
name: blue-sentinel
description: >-
  Use when the operator types /blue-sentinel with findings: maps each
  finding to telemetry and writes one detector recommendation per gap.
---
# Blue sentinel

Detection-gap mapping: findings to telemetry, then one detector
recommendation per uncovered or partial finding, ordered by severity.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Sentinel practices "detection-engineering": every finding lands as
covered, partial, or uncovered against named telemetry, never as a guess.

## Grammar

```
/blue-sentinel "<finding ids or scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`sentinel-<date>-<n>` label while waiting) and the parsed findings scope.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the mapping

Pull the findings first with the `tempest_findings` MCP tool (or
`curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`),
then drive `tempest_hat_dispatch` with hat `sentinel` — or directly,
composing the canonical calls:

```bash
SPAWN=$(curl -s -X POST http://127.0.0.1:3333/api/operators/spawn \
  -H 'Content-Type: application/json' \
  -d '{"archetype":"sentinel"}')
OP=$(echo "$SPAWN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X POST http://127.0.0.1:3333/api/operators/$OP/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"detection mapping","taskDescription":"<findings>"}'
```

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, gaps ordered by severity (finding,
telemetry, covered/partial/uncovered, detector recommendation), and the
report pointer (`/tempest-report <mission id>`). If the backend is
unreachable, say so in one line —

> t3mp3st backend unreachable — start it with npm run server; this mapping
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
