---
name: black-beacon-cadence
description: Use when the operator types /black-beacon-cadence with callback or scheduled-transfer plans: reviews beacon timing, jitter, and fallback channels for correlation risk.
---
# Black beacon cadence

Timing review for callbacks and scheduled or automated transfers. Regular
beacons correlate over time, and fallback channels inherit the same pattern.
This skill reviews what the plan states about cadence, and it reports the
correlation risk the backend can see.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Beacon review follows checklist items C2C-04 (model beacon timing honestly:
jitter, schedule, and fallback channels in the ledger), C2C-05 (every pull is an
egress event on the same route), and EXF-03 (if you chunk, say so, because
size-limit splitting is a detectable pattern) in `src/teams/black/checklist.ts`.
The channel profiles `automated-beacon` (base 5) and `scheduled-transfer`
(base 1) in `src/teams/black/exfil.ts` price these channels. The vocabulary in
`src/teams/black/noise.ts` maps beacon wording to T1020, scheduled transfer to
T1029, and chunking or size-limit wording to T1030.

## Grammar

```
/black-beacon-cadence "<callback or transfer plan or scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`beacon-<date>-<n>` label while waiting) and the parsed scope. The operator
must see the ack before any backend call resolves.

## 2. Dispatch the review

Read the command-and-control and exfiltration phases the backend computes over
the latest red plan draft:

- Phase review: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Read the
  `command-and-control` and `exfiltration` phases, with their checklist items
  C2C-04, C2C-05, EXF-03.
- Cost report: `tempest_black_exfil`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/exfil`. This route stores no
  paths today, so it costs zero paths. State that, and do not present it as
  evidence about cadence.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Limits to state in the report:

- The draft carries no schedule, interval, jitter, or chunk-size field. This
  skill cannot measure a real beacon interval or a real chunk size.
- The review covers only what the plan states in its text. A plan that says
  nothing about cadence is reported as undeclared cadence, which is itself a
  checklist gap.

For each callback or transfer the plan describes, check:

1. Is the cadence stated (interval, jitter, schedule)? If not, C2C-04 is open.
2. Does a fallback channel exist? If so, does it declare its own cadence?
3. Is the transfer chunked? If so, EXF-03 applies: name the chunk size and say
   it is a detectable pattern, not invisibility.
4. Does every pull or push use the declared route? If not, C2C-05 is open.

Relay the backend's matches and checklist text verbatim. Never add a cadence
the plan did not state. Never call a beacon quiet because it is slow.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, each callback or transfer with its cadence
status, the C2C-04, C2C-05, and EXF-03 items the plan trips, the zero-path
note from the cost route, the limits above, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so in one
line:

> t3mp3st backend unreachable — start it with npm run server; this beacon
> review is parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
