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

Read the ROE verdict state the backend computes over the on-record
rules of engagement — the parsed spec, the operator lines that did not
parse (each with its reason), and verdicts for any actions on record:

- ROE review — the `tempest_white_roe` MCP tool, or
  `curl -s http://127.0.0.1:3333/api/teams/white/roe` (the parsed
  `roe` spec with `ok` and `summary`, the `resolved` directives with
  their source lines, and every `unresolved` line with its `reason`;
  when ROE text is on record the backend also returns per-action
  `verdicts` stamped with the stored revision, text hash, and source
  lines — relay the stamps; with nothing on record it returns the
  honest zeroed parse and derives no verdicts).

A supplied ROE text and action list is staged with `tempest_white_stage` or POST `http://127.0.0.1:3333/api/teams/white/stage`. An empty allow-list is out of scope. `approved: true` without an evidence id is not a receipt.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay the verdicts exactly as the backend returned them — never rule
on an action the backend did not judge, never soften an `unresolved`
line's `reason`, and never present a parse with `ok: false` as a clean
bill. If the response reports no ROE text on record, say so — that is
not an "everything allowed" verdict.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: action, mission id, the parsed ROE standing (`ok` with the
resolved targets/active rules), the verdict for the action under
review as the backend returned it (allowed, denied, or needs approval,
with the deciding ROE text) — or, with no ROE text on record, an
honest statement that the backend cannot derive one, never an
invented verdict — plus the `unresolved` lines with their
reasons, dispute rulings if any, what would overturn each ruling, and
the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> Purple Team backend unreachable — start it with npm run server; this verdict
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
