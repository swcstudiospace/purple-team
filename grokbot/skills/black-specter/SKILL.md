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

Drive the `tempest_hat_dispatch` MCP tool with hat `specter` and the plan
as the task — or directly, composing the canonical calls:

```bash
SPAWN=$(curl -s -X POST http://127.0.0.1:3333/api/operators/spawn \
  -H 'Content-Type: application/json' \
  -d '{"archetype":"specter"}')
OP=$(echo "$SPAWN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X POST http://127.0.0.1:3333/api/operators/$OP/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"tradecraft critique","taskDescription":"<red plan>"}'
```

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, tradecraft verdict (which parts read as
real and which do not, with reasons), cover assessment, noise-budget
ledger (action, noise cost, evidence yield, assumptions), and the report
pointer (`/tempest-report <mission id>`). If the backend is unreachable,
say so in one line —

> t3mp3st backend unreachable — start it with npm run server; this review
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
