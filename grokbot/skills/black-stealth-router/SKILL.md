---
name: black-stealth-router
description: Use when the operator types /black-stealth-router with a plan or route: reviews declared egress, proxies, and resolvers against the command-and-control checklist.
---
# Black stealth router

Egress-route review for a black-team plan. Route discipline only: it reports
whether every callback has a declared path, and it never opens one.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Stealth router judges route discipline. Undeclared egress is the loudest
failure a plan can have, so every callback must name its exit before the
first byte moves. The checks come from `opsecReview()` in
`src/teams/black/checklist.ts` (command-and-control items C2C-01 to C2C-05)
and the undeclared-egress surcharge in `structuredNoiseBudget()` in
`src/teams/black/noise.ts`.

## Grammar

```
/black-stealth-router "<route or plan scope>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`router-<date>-<n>` label while waiting), the parsed scope, and the target.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the review

Read the phase review the backend computes over the latest red plan draft:

- Cover review: the `tempest_black_cover` MCP tool, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. The command-and-control
  phase, when present, carries its checklist items (`id`, `check`, `why`).
  The top-level `egressDeclared` and `egressNotes` fields carry the route finding.
- Noise ledger: `curl -s http://127.0.0.1:3333/api/teams/black/noise`. The
  `violations` array carries the undeclared-egress text. Each entry's
  `rationale` shows the three-point undeclared-egress surcharge.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

State these route limits in every report:

- The draft carries no egress field, so both routes pass an empty egress list
  and report egress as undeclared. That is a limitation of the route, not a
  verdict on the plan.
- A route the operator names in scope is recorded as operator-declared. The
  backend does not score it, and the GET routes accept no route body.

Route status for each callback is one of: verified, declared-but-unverified,
or undeclared. Only the backend's own output sets a status. Never call a route
verified because the backend did not test it. Never score a callback the
backend did not match. An empty `phases` array means no active red plan; say so.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, `egressDeclared` and `egressNotes` verbatim,
the command-and-control checklist items the plan trips (`id`, `check`, `why`),
the egress-related violations from the noise ledger, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so in one
line:

> t3mp3st backend unreachable — start it with npm run server; this review is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
