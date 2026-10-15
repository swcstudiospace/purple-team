---
name: black-noise-ledger
description: Use when the operator types /black-noise-ledger with a plan: prices each action in budget points and reports the total, tier, and doctrine violations.
---
# Black noise ledger

Structured noise ledger for a plan. Each action has a cost and a rationale
string that shows the arithmetic. The total is checked against the budget.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

The ledger is `structuredNoiseBudget()` in `src/teams/black/noise.ts`. Its
default budget is `NOISE_BUDGET_DEFAULT` (20 points). Tier weights are
reconnaissance 2, discovery 5, stealth 3, collection 3, command and control 4,
and exfiltration 6, taken from `TACTIC_NOISE_WEIGHT`. An action costs its
loudest tier weight, plus one point per extra distinct match, plus eight points
per anti-forensics match, plus three points with no declared egress. An
unmatched action costs zero, which means unmatched, not safe. The older 0-to-100
score in `noiseBudget()` in `src/teams/black.ts` is separate and is not blended
into this ledger.

## Grammar

```
/black-noise-ledger "<plan actions or scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`ledger-<date>-<n>` label while waiting) and the parsed scope. The operator
must see the ack before any backend call resolves.

## 2. Dispatch the ledger

Read the structured report the backend computes over the latest red plan draft:

- Noise ledger: `tempest_black_noise`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/noise`. The envelope carries
  `entries`, `total`, `budget`, `within`, `tier`, and `violations`. Each entry
  carries `action`, `matches`, `cost`, and `rationale`.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Known limits, stated in every ledger:

- The draft carries no egress field, so the route passes an empty egress list.
  Every entry therefore carries the three-point undeclared-egress surcharge, and
  `violations` includes the undeclared-egress text. Report this as a route
  limitation.
- The route accepts no budget or action body today. Totals always use the
  default budget.

Relay each entry's `rationale` string verbatim. Never hand-edit a cost. Never
read an unmatched entry as quiet. Never re-tier a plan total the backend
computed. An empty `entries` array means no active red plan; say so and report
total zero.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the ledger rows (action, matched ids, cost,
rationale verbatim), the total against the budget with `within` and `tier`,
every violation text verbatim, the surcharge limitation, and the report pointer
(`/tempest-report <mission id>`). If the plan is over budget, name the entries
with the most points and state which cut or re-sequencing the operator would
need to re-run the ledger on. If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this ledger is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
