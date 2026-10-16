---
name: blue-warden
description: >-
  Use when the operator types /blue-warden with findings: audits hardening
  and returns a verification checklist plus misconfiguration call-outs.
---
# Blue warden

Hardening audit of red findings: a per-item verification checklist and an
explicit misconfiguration call-out list.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Warden performs "control verification": each hardening item ships with
how to verify it, and misconfigurations are called out by name.

## Grammar

```
/blue-warden "<finding ids or scope>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`warden-<date>-<n>` label while waiting) and the parsed scope and target.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the audit

Pull the findings first with the `tempest_findings` MCP tool (or
`curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`),
then read the hardening plan the backend tiers from the same ledger:

- Hardening items —
  `curl -s http://127.0.0.1:3333/api/teams/blue/hardening`
  (severity-tiered work items: `priority`, `findingIds`, `control`,
  `effort`).
- Misconfiguration call-outs — the `tempest_blue_gaps` MCP tool, or
  `curl -s http://127.0.0.1:3333/api/teams/blue/gaps`: a finding with
  `coverage: "partial"` is logged but not alerted; name it.

A hardening retest is not proven by a recommendation. Item-linked baseline and retest evidence ids are required before a control is called retested. Relay `insufficient-evidence` when those ids are absent. When an observed artifact is supplied, score it with `tempest_blue_coverage` or `POST http://127.0.0.1:3333/api/teams/blue/coverage` (`runId`, `missionId`, `family`, `artifactIds`, string `artifactBytes`, `findings`, `telemetry`). Empty artifact bytes fail closed as `insufficient-evidence` and are not covered. No published retest POST exists; do not invent one.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Turn each hardening item's `control` into a verification-checklist
entry and never re-tier a finding the backend already placed.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, hardening items (priority, findingIds,
control, effort) each with a verification step, the partial-coverage
misconfiguration call-outs, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> Purple Team backend unreachable — start it with npm run server; this audit
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
