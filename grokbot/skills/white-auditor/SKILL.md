---
name: white-auditor
description: >-
  Use when the operator types /white-auditor with evidence: scores each
  entry by provenance and aggregates the evidence-strength verdict.
---
# White auditor

Evidence scoring: each entry labeled by provenance-derived confidence,
aggregated into one evidence-strength verdict.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Auditor ranks provenance "replayable > tool > context > weak": accepted
entries weigh toward the aggregate score, and weak entries never carry one.

## Grammar

```
/white-auditor "<evidence set or scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`auditor-<date>-<n>` label while waiting) and the parsed evidence scope.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the review

Drive the `tempest_hat_dispatch` MCP tool with hat `auditor` and the
evidence scope as the task — or directly, composing the canonical calls:

```bash
SPAWN=$(curl -s -X POST http://127.0.0.1:3333/api/operators/spawn \
  -H 'Content-Type: application/json' \
  -d '{"archetype":"auditor"}')
OP=$(echo "$SPAWN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X POST http://127.0.0.1:3333/api/operators/$OP/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"evidence scoring","taskDescription":"<evidence>"}'
```

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, per-entry confidence labels, aggregate
evidence-strength score, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> t3mp3st backend unreachable — start it with npm run server; this review
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
