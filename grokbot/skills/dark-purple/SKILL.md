---
name: dark-purple
description: >-
  Use when the operator types /dark-purple with a mission scope: runs the
  full loop of red findings to black pressure to blue detection to white
  verdict to report.
---
# Dark purple

The full loop in one command: red findings, black pressure, blue
detection, white verdict, report. This file sets the order; the hat
details live in the black, blue, and white hat skills.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Dark purple composes the hats without replacing them: specter pressure
("covert tradecraft"), sentinel coverage ("detection-engineering"), and
arbiter rulings ("ROE adjudication") stay attributed to their hats.

## Grammar

```
/dark-purple "<mission scope>" [--target <host>] [--mission <mission-id>]
```

If the scope is empty, ask what to loop over and stop.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`purple-<date>-<n>` label while waiting) and the parsed scope and target.
The operator must see the ack before any backend call resolves.

## 2. Red findings

Pull the ledger first with the `tempest_findings` MCP tool — or directly:

```bash
curl -s 'http://127.0.0.1:3333/api/findings?missionId=<mission-id>'
```

Relay the finding count before moving on, quoting the mission id.

## 3. Black pressure, then blue detection

Dispatch the tradecraft critique and the exfil check with
`tempest_hat_dispatch` (hats `specter`, then `wraith`), then the coverage
work (hats `sentinel`, then `warden`). One hat per call; the reply says
which task went where. Direct form composes the canonical calls:

```bash
curl -s -X POST http://127.0.0.1:3333/api/operators/spawn \
  -H 'Content-Type: application/json' \
  -d '{"archetype":"<specter|wraith|sentinel|warden>"}'
curl -s -X POST http://127.0.0.1:3333/api/operators/<operator-id>/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"<name>","taskDescription":"<what to do>"}'
```

## 4. White verdict, then synthesize

Dispatch hats `arbiter` and `auditor` the same way, then close the loop
with the `tempest_purple_synthesize` MCP tool — or directly:

```bash
curl -s -X POST http://127.0.0.1:3333/api/teams/purple/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"findings":[],"detections":[],"verdicts":[]}'
```

## 5. Completion summary

Close with: scope, mission id, findings by severity, hat verdicts in
loop order (red, black, blue, white), the synthesis pointer, and the
report pointer (`/tempest-report <mission id>`). If the backend is
unreachable at any step, say so in one line —

> t3mp3st backend unreachable — start it with npm run server; this loop is
> parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
