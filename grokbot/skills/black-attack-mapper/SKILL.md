---
name: black-attack-mapper
description: Use when the operator types /black-attack-mapper with planned actions: maps each action to vendored ATT&CK technique ids, tactic phases, and detection strategies.
---
# Black attack mapper

ATT&CK mapping of planned actions. Each mapping traces to a vocabulary cue and
to a technique id that exists in the vendored subset. Nothing is invented.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

The mapper uses only the vendored subset in `src/teams/black/attack-data.ts`
(ATT&CK Enterprise v19.2, six doctrine tactics). `ATTACK_BY_ID` resolves an id,
`ATTACK_BY_TACTIC` lists ids per tactic, and `attackLabel()` returns the name
for a known id. Matching runs only through `matchVocabulary()` in
`src/teams/black/noise.ts`. The match is keyword-based, so it is a cue, not
proof that the action runs.

## Grammar

```
/black-attack-mapper "<actions or plan scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`attack-<date>-<n>` label while waiting) and the parsed scope. The operator
must see the ack before any backend call resolves.

## 2. Dispatch the mapping

Read the phase view the backend computes over the latest red plan draft:

- Phase map: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Each phase carries
  `phase`, `matchedTechniques` (sorted ids), and a `checklist`. The
  `phase` value is the tactic key, not the ATT&CK tactic id.
- Per-action matches: `tempest_black_noise`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/noise`. Each entry's
  `matches` carries `id`, `name`, and `tactic` for every matched technique, in
  vocabulary order.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Build the map from the backend's output:

- Each mapping row is action, technique id, technique name, tactic phase, and
  the action wording that matched.
- An action with an empty `matches` array is unmapped. Report it as unmapped.
- For each matched id, quote the detection strategy from the vendored data
  (the DET id, the strategy name, and the first analytic verbatim). Note the
  count of further analytics. Only quote ids and text the vendored data
  carries.
- Platforms come from the vendored technique. Report them so the defender can
  scope the detection.

Never emit a technique id that the backend did not return. Never map to a
revoked technique. Never present a keyword match as proof of execution. An
empty `phases` array means no active red plan; say so.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the mapping table (action, technique id and name,
tactic phase, matched wording), the unmapped actions, the detection pairing
for each matched technique (DET id and verbatim analytic), the keyword-cue
caveat, and the report pointer (`/tempest-report <mission id>`). If the backend
is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this mapping is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
