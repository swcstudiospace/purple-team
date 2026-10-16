---
name: blue-harden-map
description: >-
  Use when the operator types /blue-harden-map with findings: maps uncovered
  preventive countermeasures (Harden and Isolate) to each finding's controls.
---
# Blue harden map

The preventive view of the gap report: which uncovered countermeasures sit in
the Harden and Isolate tactics, grouped per finding, so a hardening control is
chosen against a named D3FEND technique rather than a generic severity label.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Prevention maps to Harden and Isolate. Detection maps to Detect. A finding can be
prevented without being detected, and this map keeps the two apart.

## Grammar

```
/blue-harden-map "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on `coverageGaps()` in `src/teams/blue/coverage.ts` for the uncovered
ids, and on `d3fendLabel()` and `D3FEND_BY_ID` in `src/teams/blue/d3fend.ts` for
labels. `D3FEND_TACTICS` lists the tactics in file order: Model, Harden, Detect,
Isolate, Deceive, Evict, Restore. The gap response does not carry a tactic per
id, so confirm each id's tactic against the parsed term in `d3fend.ts`.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`harden-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or
`curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull
the gap report with `tempest_blue_gaps` or
`curl -s http://127.0.0.1:3333/api/teams/blue/gaps`. Off loopback, add
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Select preventive ids

From each gap, take the `uncoveredCountermeasures` whose tactic is Harden or
Isolate. If you cannot confirm an id's tactic, list it under "tactic unconfirmed"
and do not place it. Do not select Detect ids here; those belong to
`/blue-sigma-pack` and `/blue-coverage-matrix`.

## 4. Build the map

For each finding with preventive ids, write the finding id, the backend
`coverage`, and each preventive id with its label and tactic. Propose one control
per id, phrased as a configuration or isolation change the blue team can make.
Controls must be specific. "Harden the service" is not a control. "Enforce
multi-factor authentication on the affected account class" is one, when the id
is the matching multi-factor countermeasure.

## 5. Ordering

Order findings by the severity recorded on the finding, critical first, and keep
the backend `coverage` beside it. Do not re-tier. Hardening priority belongs to
`hardeningPlan()` in `src/teams/blue.ts`; reference it, do not reproduce it.

## 6. Completion summary

Close with: scope and mission id; the preventive map, one block per finding; the
tactic-unconfirmed list, if any; a line pairing this map with the warden's
hardening items for the same findings; the report pointer
(`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this map is parked
> under its mission id and resumes when the backend answers.

Never present a remembered control as current. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
