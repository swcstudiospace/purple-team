---
name: tempest-run
description: >-
  Use when the operator types /tempest-run with an objective: acknowledges at
  once with a run id, streams progress, and closes with a completion summary.
---
# Purple Team run

One command for a full run: intake, mission start, operator tasking, and the
closing summary. This file sets the order; the mission and operator details
live in the tempest-mission and tempest-operators skills.

## Grammar

```
/tempest-run <objective>
/tempest-run "<objective with spaces>" [--target <host>] [--seat <seat>]
```

- The text after `/tempest-run` is the objective. If it is empty, ask what to
  run and stop.
- Quoted-argument parsing: double quotes group words into one argument
  (`/tempest-run "api auth bypass" --seat red` parses as objective
  `api auth bypass`, seat `red`). Single quotes group the same way. An
  unterminated quote is an error: quote the objective back and ask for a
  retype instead of guessing.
- Unknown-command fallback: if the first word after `/tempest` matches no
  known slash, do not run anything. Reply with the three closest matches by
  name (for example, `/tempest-rnu` suggests `/tempest-run`,
  `/tempest-report`, `/tempest-status`) plus the full `/tempest-help` list.

## 1. Acknowledge immediately

Reply at once with a run id (the mission id the backend returns, or a local
`run-<date>-<n>` label while waiting) and the parsed objective, seat, and
target. The operator must see the ack before any backend call resolves.
Then start the mission through the `tempest_mission_start` MCP tool, or
directly:

```bash
curl -s -X POST http://127.0.0.1:3333/api/mission/start \
  -H 'Content-Type: application/json' \
  -d '{"name":"<objective>","targets":[{"host":"<host>"}],"operators":["recon"]}'
```

## 2. Progress updates

Poll with `tempest_status` (or `curl -s
http://127.0.0.1:3333/api/mission/status`) and relay short updates: phase,
active operators, finding count. Quote the mission id on every update so a
later message can resume or park this run.

## 3. Completion summary

Close with: objective, mission id, findings by severity, report pointer
(`/tempest-report <mission id>`), and anything parked for later. If the
backend is unreachable at any step, say so in one line —

> Purple Team backend unreachable — start it with npm run server; this run is
> parked under its run id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
