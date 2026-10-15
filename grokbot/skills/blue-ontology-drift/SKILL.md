---
name: blue-ontology-drift
description: >-
  Use when the operator types /blue-ontology-drift with findings: reports countermeasure ids the vendored D3FEND ontology does not recognize, per finding.
---
# Blue ontology drift

Unresolved countermeasure ids: ids a finding carries that the vendored D3FEND ontology does not contain. This skill reports them per finding and never maps them to a near match.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback, lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Drift is a defect to report, not a value to repair. An unresolved id is kept, labeled, and sent back to the red team to re-tag.

## Grammar

```
/blue-ontology-drift "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on `coverageGaps()` in `src/teams/blue/coverage.ts`, which splits each finding's ids into resolved and unresolved against `D3FEND_BY_ID` in `src/teams/blue/d3fend.ts`. The ontology is the vendored CSV in `src/teams/blue/d3fend-ontology.ts` (version 1.6.0, fetched 2026-10-10). The gap's `recommendation` appends "Unresolvable ids reported, not used" when any id fails.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local `drift-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or `curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull the gap report with `tempest_blue_gaps` or `curl -s http://127.0.0.1:3333/api/teams/blue/gaps`. Off loopback, add `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use `T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Collect the unresolved ids

For each gap with a non-empty `unresolvedCountermeasures`, record the `findingId`, each raw id exactly as spelled, and the gap's `coverage`. Do not correct spelling. `D3-PSA` and `D3-psa` are different records, and the red team must see the raw form.

## 4. Classify each unresolved id

Put each id in one bucket, without changing its text: a D3FEND-looking id with a typo or wrong case (report the raw id, and state a closest vendored id only as a question for the red team); a non-D3FEND label such as a technique name or vendor control; or no recognizable shape. Never upgrade a bucket-one id to a resolved id. The backend already excluded it from every cell.

## 5. Consequence check

For each finding with unresolved ids, state the effect on the verdict. If the finding's only ids are unresolved, its resolved set is empty. The verdict is then covered only by a direct finding-id match, partial when any telemetry is deployed, or none when none is. No Sigma rule can be generated, because a rule needs a resolved uncovered countermeasure. Say that plainly.

## 6. Completion summary

Close with: scope and mission id; the drift table (finding, raw id, bucket, effect on verdict); one re-tag request per finding for the red team; the vendored ontology version the check used; the report pointer (`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this drift check is parked under its mission id and resumes when the backend answers.

Never present a guessed remap as a resolved id. The seat never opens a browser panel; every step goes through the MCP tools or the loopback HTTP API.
