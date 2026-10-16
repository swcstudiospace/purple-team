---
name: blue-sigma-pack
description: >-
  Use when the operator types /blue-sigma-pack with findings: reviews the experimental Sigma rule pack derived from uncovered gaps and checks each rule's fields.
---
# Blue Sigma pack

Review of the Sigma rule pack the backend derives from uncovered gaps: one experimental rule per uncovered, keyed gap. This skill checks each rule's fields against the generator's contract and states what each rule is.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback, lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

A rule from this pipeline is an experimental template. Its identity, tags, and references are checked here. Its deployability is a separate question, answered only by a replay.

## Grammar

```
/blue-sigma-pack "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on `sigmaRulepack()` and `sigmaRuleForGap()` in `src/teams/blue/rulepacks.ts`, fed by `coverageGaps()` in `src/teams/blue/coverage.ts`. The backend returns both the structured `rules` array and the multi-document `yaml` string. Rule ids are uuidv5 values derived from the finding id.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local `sigma-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or `curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull the rule pack with `tempest_blue_rules` or `curl -s http://127.0.0.1:3333/api/teams/blue/rules`. Off loopback, add `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use `T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Check each rule

For every entry in `rules`, check against the generator contract:

- `status` is `experimental`. Anything else is a defect.
- `id` is a uuid derived from the finding id. For the same finding id, the id must match the prior pack. A different id for the same finding is a defect.
- `title` is no longer than 100 characters, or ends in three dots.
- `tags` are `d3fend.` plus a lowercased countermeasure id, one per uncovered id.
- `references` has one technique link per tag, in the form `https://d3fend.mitre.org/technique/d3f:<id>`.
- `level` maps from the finding severity. An unknown severity shows as medium.
- `falsepositives` is still the placeholder text. That is expected.

Then check `yaml`: rules are separated by a line of three dashes, and the document count equals the length of `rules`.

## 4. Rule table

One row per rule: finding id, rule id, level, tag count, and the check result (pass, or the named defect).

## 5. Deployability

State for every rule that it is a template. The default logsource is category `process_creation` with a definition saying it is a placeholder. Do not call any rule deployable from this skill. Retargeting is covered by `/blue-logsource`; replay belongs to the rule-pack author review.

## 6. Completion summary

Close with: scope and mission id; the rule table; the count of passing and defective rules, with defects named; the line "all rules are templates until retargeted and replayed"; the report pointer (`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this pack review is parked under its mission id and resumes when the backend answers.

Never present a rule as working because it exists in the pack. The seat never opens a browser panel; every step goes through the MCP tools or the loopback HTTP API.
