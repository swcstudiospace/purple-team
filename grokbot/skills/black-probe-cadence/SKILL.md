---
name: black-probe-cadence
description: Use when the operator types /black-probe-cadence with a plan: flags repeated identical probes and burst timing that burn budget and correlate across runs.
---
# Black probe cadence

Cadence review for repeated probes and bursts. Identical probes fired again
and again burn budget for no evidence, and regular timing correlates across
runs. This skill reports both patterns and asks for jitter or a cut.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Cadence review applies two deterministic rules. First, the repeated-probe
rule: `structuredNoiseBudget()` in `src/teams/black/noise.ts` raises a
violation for any action whose trimmed, lowercased text appears more than
twice. Second, the older rule in `noiseBudget()` in `src/teams/black.ts` takes
ten points off for each action repeated more than twice. Timing guidance comes
from the discovery and command-and-control checklists in
`src/teams/black/checklist.ts`: DSP-01 (jitter and bound discovery sweeps,
never identical probes back to back) and C2C-04 (model beacon timing honestly).

## Grammar

```
/black-probe-cadence "<plan actions or scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`cadence-<date>-<n>` label while waiting) and the parsed scope. The operator
must see the ack before any backend call resolves.

## 2. Dispatch the review

Read the backend's repeated-probe violations and the discovery and
command-and-control phases:

- Noise ledger: `tempest_black_noise`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/noise`. Read every violation
  that begins with "repeated probe", with its count and action text.
- Cover review: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Read the `discovery`
  and `command-and-control` phases and their checklist items DSP-01 to DSP-03
  and C2C-04.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Limits to state in the report:

- The backend route does not expose the zero-to-100 score or its per-action
  ledger. Only the repeated-probe violations are available here.
- The backend reads the latest red plan draft. Timing between runs is not in
  that draft, so this skill cannot measure real beacon intervals. It reviews
  the plan's stated cadence only.

Then, for each repeated action:

1. Quote the violation text verbatim, with its count.
2. Propose one of three fixes: cut the repeats to two, replace them with a
   single bounded probe that covers the same ground, or add an explicit jitter
   note in the plan so the cadence is declared.
3. Name the assumption each fix depends on. Do not claim a fix reduces noise
   until the operator re-runs the ledger.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, each repeated-probe violation (count and action
text verbatim), the discovery and command-and-control checklist items the plan
trips, the proposed fixes with their assumptions, the limits above, and the
report pointer (`/tempest-report <mission id>`). If the backend is unreachable,
say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this cadence
> review is parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
