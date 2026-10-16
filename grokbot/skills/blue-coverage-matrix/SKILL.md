---
name: blue-coverage-matrix
description: >-
  Use when the operator types /blue-coverage-matrix with findings: builds a
  finding-by-countermeasure coverage matrix from the backend gap report.
---
# Blue coverage matrix

One row per finding, one cell per D3FEND countermeasure, each cell covered,
uncovered, or unresolved. Never a single verdict without the cells behind it.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

A verdict is only as honest as the cells that produced it. Every cell is copied
from the backend, never recomputed.

## Grammar

```
/blue-coverage-matrix "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on `coverageGaps()` in `src/teams/blue/coverage.ts`. The backend runs it
over the findings ledger against `registryTelemetry()` from
`src/teams/blue/telemetry.ts`, and resolves ids through `D3FEND_BY_ID` in
`src/teams/blue/d3fend.ts`.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`matrix-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or
`curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull
the gap report with `tempest_blue_gaps` or
`curl -s http://127.0.0.1:3333/api/teams/blue/gaps`. Off loopback, add
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Build the matrix

For each entry in the `gaps` array, copy the fields as returned:

- Row: `findingId` and `coverage`.
- Cover cell: each id in `coveredCountermeasures`.
- Gap cell: each id in `uncoveredCountermeasures`.
- Unresolved column: each id in `unresolvedCountermeasures`, raw spelling kept.
  Unresolved ids are never dropped and never remapped.

Interpretation, from `coverage.ts`:

- `covered`: every resolved countermeasure is credited by deployed telemetry.
- `partial`: telemetry is deployed but does not credit every countermeasure.
  This is the logged-but-not-alerted case.
- `none`: no telemetry is deployed at all, so every uncovered countermeasure is
  unseen.

A finding with no countermeasure keys has no cells. List it under a keyless
heading and quote its `recommendation`. Do not invent cells for it.

## 4. Totals

Count rows by coverage value. Report the unresolved id count and the keyless
count. Totals must match the matrix rows exactly.

## 5. Completion summary

Close with: scope and mission id; the matrix; the totals line; the unresolved
ids and keyless findings in full; the report pointer
(`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this matrix is
> parked under its mission id and resumes when the backend answers.

Never present a remembered matrix as current. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
