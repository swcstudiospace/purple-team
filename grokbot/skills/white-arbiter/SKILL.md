---
name: white-arbiter
description: >-
  Use when the operator types /white-arbiter with an action: returns the ROE
  verdict on that action and resolves any red versus blue dispute about it.
---
# White arbiter

ROE verdict on an action, plus dispute resolution where red and blue
disagree. The ROE text decides; both positions stay on the record.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Arbiter performs "ROE adjudication": every ruling names the evidence or
receipt that would overturn it, and the ROE text is the only authority.

## Grammar

```
/white-arbiter "<action under review>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`arbiter-<date>-<n>` label while waiting) and the parsed action. The
operator must see the ack before any backend call resolves.

## 2. Dispatch the adjudication

Drive the `tempest_hat_dispatch` MCP tool with hat `arbiter` and the
action as the task — or directly, composing the canonical calls:

```bash
SPAWN=$(curl -s -X POST http://127.0.0.1:3333/api/operators/spawn \
  -H 'Content-Type: application/json' \
  -d '{"archetype":"arbiter"}')
OP=$(echo "$SPAWN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X POST http://127.0.0.1:3333/api/operators/$OP/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"ROE verdict","taskDescription":"<action>"}'
```

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: action, mission id, ROE verdict (allowed, denied, or needs
approval, with the deciding ROE text), dispute rulings if any, what would
overturn each ruling, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> t3mp3st backend unreachable — start it with npm run server; this verdict
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
