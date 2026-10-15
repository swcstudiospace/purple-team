---
name: black-channel-costing
description: Use when the operator types /black-channel-costing with exfil paths: prices each channel with the disclosed exfil cost table and states feasibility, without moving data.
---
# Black channel costing

Cost arithmetic for planned exfil channels. Each path is priced from the
disclosed channel table. The skill reports tier, feasibility, and pressure
notes, and never moves a byte.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Costing is `exfilCostModel()` in `src/teams/black/exfil.ts`. A path costs its
channel base, plus `ceil(volumeMb / 100)`, plus two points if the path is
cleartext. Tiers are high at eight or more points, medium at four or more, and
low below four. A path is feasible only when egress is declared and its tier
is not high. The run budget defaults to `EXFIL_BUDGET_DEFAULT` (ten points).
Channel keys come from `EXFIL_CHANNELS`. Unknown channels resolve to
`unspecified` and use the default T1041 profile with base 2. This is analysis,
never execution.

## Grammar

```
/black-channel-costing "<exfil paths or scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`channel-<date>-<n>` label while waiting), the parsed paths, and the scope. The
operator must see the ack before any backend call resolves.

## 2. Dispatch the costing

Read the cost report the backend computes:

- Exfil cost: `tempest_black_exfil`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/exfil`. The envelope carries
  `paths`, `totalVolumeMb`, `totalCost`, `budget`, and `within`. Each path
  carries `pathId`, `channel`, `techniqueId`, `baseCost`, `volumeCost`,
  `penalty`, `totalCost`, `tier`, `feasible`, and `notes`.

Important limit: the backend stores no exfil paths today. Its mission drafts
carry no channel or volume fields, so the GET route costs zero paths and
reports a zero total with `within` true. That is an empty report, not a clean
result. State it in every costing.

Show the arithmetic for each path: base, volume blocks, penalty, total, tier,
and feasibility, with the notes verbatim. Never re-tier a path the arithmetic
placed. Never call a high-tier path feasible. A zero-megabyte path is costed at
base only; flag it as needing a real volume.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the path table (`pathId`, channel, technique id,
volume, encryption, total, tier, feasibility), the run total against the budget
with the `within` call, the notes verbatim, the statement that no stored paths
exist on the backend (or the paths costed through the MCP argument), and the
report pointer (`/tempest-report <mission id>`). If the backend is unreachable,
say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this costing is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
