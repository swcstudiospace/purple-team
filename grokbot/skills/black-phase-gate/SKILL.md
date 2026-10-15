---
name: black-phase-gate
description: Use when the operator types /black-phase-gate with a plan: issues a per-phase go or no-go from the opsec checklist before each phase starts.
---
# Black phase gate

Per-phase go or no-go. Before a doctrine phase begins, its checklist must be
read, and each item must be marked as satisfied, not satisfied, or not
applicable with a reason. A phase with an unsatisfied item does not start.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

The six phases are the vendored tactics in `OPSEC_PHASES` from
`src/teams/black/checklist.ts`, in doctrine order: reconnaissance, discovery,
stealth, collection, command-and-control, exfiltration. `opsecChecklist(phase)`
returns one phase's items and throws on an unknown phase key. A typo is a bug,
not an empty checklist. `opsecReview()` returns only the phases the plan
touches, with their checklists. A phase the plan does not touch needs no gate.

## Grammar

```
/black-phase-gate "<phase name or plan scope>" [--mission <mission-id>]
```

Accepted phase names are the doctrine keys: `reconnaissance`, `discovery`,
`stealth`, `collection`, `command-and-control`, `exfiltration`. Any other name is
refused with the list of valid keys.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`gate-<date>-<n>` label while waiting), the parsed phase or scope, and the
target. The operator must see the ack before any backend call resolves.

## 2. Dispatch the gate

Read the phases the backend computes over the latest red plan draft:

- Phase review: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Each phase carries
  its `phase` key, `matchedTechniques`, and its full `checklist` of items
  (`id`, `check`, `why`).

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

For each requested phase:

1. If the backend's `phases` array contains the phase, list its checklist items
   by id. For each one, state whether the plan satisfies it and what evidence
   shows that. The operator supplies the evidence, and the item is marked
   satisfied only when the evidence is named.
2. If the backend's `phases` array does not contain the phase, the plan touches
   no action in that tactic. Say so. The gate is open for that phase with no
   checklist to satisfy. This is not a clean bill of health for the phase.
3. Issue the gate: GO when every item is satisfied or not applicable with a
   reason; NO-GO when any item is open. A NO-GO names the item ids that block it.

Never mark an item satisfied without named evidence. Never change an item's
`check` or `why` text. Never issue GO for a phase the backend did not return,
unless the operator confirms the phase is not in the plan.

The backend reads only the latest red plan draft. State that the gate applies to
that draft, and say so if the operator's plan differs.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, one line per requested phase (GO or NO-GO),
the blocking item ids for each NO-GO with their `check` text, the evidence the
operator supplied for each satisfied item, the note on draft scope, and the
report pointer (`/tempest-report <mission id>`). If the backend is unreachable,
say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this gate is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
