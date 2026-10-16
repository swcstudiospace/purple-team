---
name: blue-telemetry-deploy
description: >-
  Use when the operator types /blue-telemetry-deploy with findings: names the telemetry source that would close each uncovered countermeasure gap.
---
# Blue telemetry deploy

For each uncovered countermeasure, name the curated telemetry source that would credit it, so the blue team knows what to deploy. A source is named only when the registry credits it. Otherwise the gap stays "source missing".

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback, lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Telemetry is deployed to close a named countermeasure, never to close a vague "more logging" request. A source that does not credit the countermeasure does not close the gap, however relevant it sounds.

## Grammar

```
/blue-telemetry-deploy "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on `TELEMETRY_REGISTRY` and `TELEMETRY_BY_SOURCE` in `src/teams/blue/telemetry.ts`. Each entry has a `source` slug, a `description`, and `coveredIds`, which the module validates against the ontology at load. `registryTelemetry()` is the form the backend feeds into `coverageGaps()` in `src/teams/blue/coverage.ts`. The gap response does not list registry entries, so read the registry file only when the seat can, or when the operator pastes an entry. Otherwise write "closing source not named".

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local `deploy-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or `curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull the gap report with `tempest_blue_gaps` or `curl -s http://127.0.0.1:3333/api/teams/blue/gaps`. Off loopback, add `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use `T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Collect open countermeasures

For each gap whose `coverage` is `none` or `partial`, take the `uncoveredCountermeasures`. Skip covered gaps and skip unresolved ids; unresolved ids belong to `/blue-ontology-drift`.

## 4. Match sources

For each uncovered id, find registry entries whose `coveredIds` contain it. One or more matches: list each slug with its description, so the operator sees what the source collects. No match: write "source missing: no registry source credits <id>" and stop. Never assign a plausible source. Registry unreadable: write "closing source not named" for that id.

If a source already deployed for the finding is the only candidate, note that the countermeasure stays partial in the backend's terms, because the deployed source does not credit it.

## 5. Deployment list

Group by source slug. For each slug, list the finding ids it would close, the countermeasure ids it credits, and the proof criterion: one observed event from that source on a test host. Do not claim a source is deployed. The backend learns of a deployment only when the operator declares it.

## 6. Completion summary

Close with: scope and mission id; the deployment list grouped by slug; the "source missing" list with countermeasure ids; the note that coverage moves only after the operator declares the source; the report pointer (`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this deployment list is parked under its mission id and resumes when the backend answers.

Never present a source as deployed because it is in the registry. The seat never opens a browser panel; every step goes through the MCP tools or the loopback HTTP API.
