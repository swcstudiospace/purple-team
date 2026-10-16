---
name: black-anti-forensics-refusal
description: Use when the operator types /black-anti-forensics-refusal with a request to wipe, clean, tamper with, or conceal logs or artifacts: refuses and reports the residue to blue.
---
# Black anti-forensics refusal

Refusal and redirect for anti-forensic requests. Black never wipes, tampers
with, or destroys logs, metadata, or evidence. This skill declines the request,
records what it would have left, and files that residue as a finding for the
blue team.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Anti-forensics is awareness only. The black module treats T1070.004 (file
deletion, shred, secure delete, wipe) and T1070.006 (timestomping) as doctrine
refusals, not stealth. In `src/teams/black/noise.ts`, `ANTI_FORENSICS_IDS`
lists both ids, and `structuredNoiseBudget()` charges each match
`ANTI_FORENSICS_PENALTY` (eight points) and raises a violation starting
"anti-forensics refused". The specter review in `src/teams/hats.ts`
(`specterCoverReview()`) raises a destructive-tradecraft flag for the same
class of command.

## Grammar

```
/black-anti-forensics-refusal "<requested action or command>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`refusal-<date>-<n>` label while waiting), the parsed request, and the target.
The operator must see the ack before any backend call resolves. Say at once
that the request is refused. Do not wait for the backend to confirm the refusal.

## 2. Dispatch the classification

Classify the request against the backend's view of it:

- Noise ledger: `tempest_black_noise`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/noise`. Find the entry whose
  `matches` include T1070.004 or T1070.006 and read its `rationale`.
- Cover review: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Read the `stealth`
  phase and its STL-01 item.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

The backend reads only the latest red plan draft. A request typed to this skill
is not in that draft unless the operator also added it there. If the backend
does not match the request, say so. Do not assume a clean result from a missing
match.

Then:

1. Refuse the action. Do not run it, do not draft a version of it, and do not
   suggest a cleanup that would hide the activity.
2. Name what the action would leave behind: the log classes, file metadata,
   and timestamps it would touch. Describe them as residue, not as steps.
3. File the residue as a finding for the blue team, phrased as something the
   blue team can detect or review.
4. State the approval path. Anti-forensics is not approved by any receipt in
   this harness. Say that, and point the operator to the mission owner and the
   contract amendment process, not to a workaround.

Never destroy, rename, or alter any evidence in the course of this skill. Quote
the violation text from the backend verbatim.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the refused request in one line, the backend's
violation text verbatim (or the statement that the backend did not match it),
the residue inventory as findings for blue, the approval-path statement, and
the report pointer (`/tempest-report <mission id>`). If the backend is
unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this refusal is
> recorded under its mission id and resumes when the backend answers.

The refusal stands whether or not the backend is reachable. Never present a
guess as a backend result. The seat never opens a browser panel; every step
goes through the MCP tools or the loopback HTTP API.
