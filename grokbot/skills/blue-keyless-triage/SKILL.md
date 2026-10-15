---
name: blue-keyless-triage
description: >-
  Use when the operator types /blue-keyless-triage with findings: lists findings
  that carry no D3FEND countermeasure keys and names the keys each one needs.
---
# Blue keyless triage

Keyless findings are scored by the v1 finding-id fallback. That cannot key a
Sigma rule or a D3FEND cell. This skill lists them and states which
countermeasure keys each needs before its coverage can be trusted.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

A finding with no countermeasure keys can be called covered only by finding-id
match. That is not a countermeasure verdict. Say so every time.

## Grammar

```
/blue-keyless-triage "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on the keyless branch of `coverageGaps()` in
`src/teams/blue/coverage.ts`. When `countermeasures` is empty, `buildGap()`
either reports `covered` by a direct finding-id match ("directly covers ... by
finding id"), or `partial` or `none` with a recommendation saying the finding
"carries no D3FEND countermeasure keys". Keyless gaps never produce a Sigma rule
in `src/teams/blue/rulepacks.ts`, because `sigmaRuleForGap()` returns null when
no uncovered id exists.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`keyless-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or
`curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull
the gap report with `tempest_blue_gaps` or
`curl -s http://127.0.0.1:3333/api/teams/blue/gaps`. Off loopback, add
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Identify keyless findings

A gap is keyless when its `countermeasures` array is empty. Also check the
ledger: a finding with no `countermeasures` field is keyless even when the gap
text is ambiguous. For each, record the `findingId`, the backend `coverage`, the
verdict basis (direct finding-id match, or absence of telemetry), and the
recorded title and severity.

## 4. Name the keys it needs

Propose countermeasure ids the red team should tag. Rules:

- Every proposed id must be a real D3FEND id, checked against the vendored
  ontology in `src/teams/blue/d3fend-ontology.ts` through the same lookup
  `D3FEND_BY_ID` uses. If you cannot check it, say so and do not propose it.
- Propose only ids that match the finding's described weakness or detection
  surface. A guess is not a key.
- Never write a key into the ledger from this seat. Output the proposal for the
  red team to apply.

## 5. Completion summary

Close with: scope and mission id; the keyless list with coverage and verdict
basis; the proposed keys, each marked checked or unchecked against the ontology;
the note that keyless findings have no Sigma rule until tagged; the report
pointer (`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this triage is
> parked under its mission id and resumes when the backend answers.

Never present a keyless verdict as a countermeasure verdict. The seat never
opens a browser panel; every step goes through the MCP tools or the loopback
HTTP API.
