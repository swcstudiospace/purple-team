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
arbiter rulings ("ROE adjudication") stay attributed to their hats. The
per-color projections the loop reads are the backend's own color routes
(`/api/teams/black/*`, `/api/teams/blue/*`, `/api/teams/white/*`) — never
a seat's improvisation.

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

## 3. Black pressure

Dispatch the tradecraft critique and the exfil check with
`tempest_hat_dispatch` (hats `specter`, then `wraith`), then read the
cover review the backend computes over the active red plan — the
`tempest_black_cover` MCP tool, or:

```bash
curl -s http://127.0.0.1:3333/api/teams/black/cover
```

Relay the `phases` array as the backend returned it — each tripped
doctrine phase with its matched technique ids and checklist items
(`id`, `check`, `why`).

## 4. Blue detection

Dispatch the coverage work with `tempest_hat_dispatch` (hats `sentinel`,
then `warden`), then read the detection-coverage report over the whole
findings ledger — the `tempest_blue_gaps` MCP tool, or:

```bash
curl -s http://127.0.0.1:3333/api/teams/blue/gaps
```

Relay the `gaps` array as the backend returned it — per finding
`findingId`, `coverage` (`none`/`partial`/`covered`), and
`recommendation`.

## 5. White verdict

Dispatch hats `arbiter`, then `auditor`, with `tempest_hat_dispatch`,
then read the ROE state on record — the `tempest_white_roe` MCP tool, or:

```bash
curl -s http://127.0.0.1:3333/api/teams/white/roe
```

Relay the parsed `roe` spec (`ok`, `summary`), the `resolved` directives,
every `unresolved` line with its `reason`, and — when ROE text is on
record — the per-action `verdicts` with their provenance stamps
(`roeRevision`, `roeTextHash`, `roeLines`). With nothing on record the
backend derives no per-action verdicts — say so, never "everything allowed".

## 6. Synthesize

Close the loop with the `tempest_purple_synthesize` MCP tool for the
plain findings + detections call — or directly:

```bash
curl -s -X POST http://127.0.0.1:3333/api/teams/purple/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"findings":[],"detections":[],"verdicts":[],"verdictsByFinding":{"<finding-id>":{"verdict":"compliant|violation|needs_approval","rationale":"<why>"}}}'
```

`verdictsByFinding` keys each verdict to its finding id, so the backend
correlates by id no matter how the arrays are ordered; omit it and the
backend pairs `verdicts` positionally. Quote the response's
`correlation` field (`id` or `positional-fallback`) and relay each
`coverageMatrix` row — `findingId`, `detection`, `verdict`, `riskTier`,
`residualRisk` — plus `unresolved` and `nextMissions`, exactly as
returned.

## 7. Completion summary

Close with: scope, mission id, findings by severity, hat verdicts in
loop order (red, black, blue, white), the synthesis correlation mode and
per-finding residual-risk tiers with their residual risks, the synthesis
pointer, and the report pointer (`/tempest-report <mission id>`).

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

If the backend is unreachable at any step, say so in one line —

> t3mp3st backend unreachable — start it with npm run server; this loop is
> parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
