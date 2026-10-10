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

Read the evidence-chain audit the backend computes over the evidence
ledger — one chain-link verdict per entry:

- Evidence-chain audit —
  `curl -s http://127.0.0.1:3333/api/teams/white/evidence` (one
  chain-link verdict per ledger entry — `evidenceId`, `status`,
  `strength`, the platform `verdict`, and the `reason` behind every
  `broken` link — plus the `intact`/`broken` totals and the `summary`).

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay the `links` array as the backend returned it — status and
strength per entry with the `reason` and appeal `conditions` behind
every `broken` link. Never upgrade a `broken` link to `intact`, never
re-derive a strength the backend already resolved, and never score an
entry the backend did not audit. An empty `links` array means the
ledger holds no evidence — say so; that is not a clean bill.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the per-entry chain-link verdict
(`evidenceId`, `status`, `strength`, with the `reason` and appeal
`conditions` for each `broken` link), the `intact`/`broken` totals
with the backend `summary`, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> t3mp3st backend unreachable — start it with npm run server; this review
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
