---
name: black-specter
description: >-
  Use when the operator types /black-specter with a red plan: critiques the
  plan's covert tradecraft, cover, and noise budget from the adversary's eyes.
---
# Black specter

Covert tradecraft critique of a red plan. Awareness-only: every flag is
something to report, never to erase or to execute.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Specter judges "covert tradecraft" "from the adversary's eyes": what each
planned action reveals, and whether the cover holds under defender scrutiny.

## Grammar

```
/black-specter "<red plan or finding scope>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`specter-<date>-<n>` label while waiting) and the parsed scope and target.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the review

Read the cover review the backend computes over the active red plan —
its actions matched through the disclosed noise vocabulary and grouped
into doctrine phases:

- Cover review — the `tempest_black_cover` MCP tool, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover` (each tripped
  phase with its matched technique ids and opsec checklist items:
  `id`, `check`, `why`).
- Noise budget —
  `curl -s http://127.0.0.1:3333/api/teams/black/noise` (per-action
  ledger entries — action, matched techniques, cost, rationale — plus
  `total`, `within`, `tier`).

A supplied plan is reviewed with `tempest_black_workflow` or POST `http://127.0.0.1:3333/api/teams/black/workflow`. An empty plan is insufficient, never a clean bill. Destructive concealment, unapproved probing, and live bulk exfiltration refuse with zero effects.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay the `phases` array as the backend returned it — the matched
technique ids per phase and the checklist items behind each flag — and
the ledger entries with their rationales. Never rewrite a technique id,
never soften a checklist `why`, and never score an action the backend
did not match. An empty `phases` array means the backend holds no
active red plan — say so; that is not a clean bill.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the doctrine phases the plan trips with
their matched technique ids, the checklist flags per phase (`id`,
`check`, `why`), the noise-budget ledger (action, cost, rationale) with
the `within`/`tier` standing, and the report pointer
(`/tempest-report <mission id>`). If the backend is
unreachable, say so in one line —

> Purple Team backend unreachable — start it with npm run server; this review
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
