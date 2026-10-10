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
then read the coverage report the backend computes over the whole
findings ledger:

- Coverage gaps — the `tempest_blue_gaps` MCP tool, or
  `curl -s http://127.0.0.1:3333/api/teams/blue/gaps`.
- Detector build list —
  `curl -s http://127.0.0.1:3333/api/teams/blue/rules` (one
  experimental Sigma rule per uncovered gap, keyed to its unresolved
  D3FEND countermeasures).

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay the `gaps` array as the backend returned it — `findingId`,
`coverage` (`none`/`partial`/`covered`), and `recommendation` — and
cite the Sigma rule from the rule pack for every gap whose
`uncoveredCountermeasures` is non-empty. Never rewrite D3FEND ids,
never present a covered finding as a gap, and never guess a detector
the backend did not emit.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the coverage gaps (finding id,
`none`/`partial`/`covered`, the backend's detector recommendation,
Sigma rule for uncovered ones), and the report pointer
(`/tempest-report <mission id>`). If the backend is
unreachable, say so in one line —

> t3mp3st backend unreachable — start it with npm run server; this mapping
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
