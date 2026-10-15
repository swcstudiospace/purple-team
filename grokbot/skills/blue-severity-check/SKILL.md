---
name: blue-severity-check
description: >-
  Use when the operator types /blue-severity-check with findings: flags findings whose
  severity label is unrecognized and so folds silently into the medium tier.
---
# Blue severity check

Severity hygiene for the hardening and detection tiers. A finding whose severity
word is unrecognized is folded into the medium tier by the backend. This skill
lists those findings so the red team can correct the label. It never re-tiers a
finding itself.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

A silent fold is a wrong tier. Keeping such findings, rather than dropping them,
is correct. The label itself must be fixed at the source.

## Grammar

```
/blue-severity-check "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on `severityWord()` and `hardeningPlan()` in `src/teams/blue.ts`. The
recognized words are critical, high, medium, low, and info. Any other value,
including an absent one, maps to medium. `hardeningPlan()` groups findings by that
word, with priorities 1 (critical) through 5 (info). `sentinelDetectorMap()` in
`src/teams/hats.ts` uses the same medium fallback for detector ordering, so the
fold reaches both views.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`severity-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Read the ledger with `tempest_findings` (or
`curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). The raw
severity field is needed here, so do not rely on the tier view alone. Then read
the tiers with `tempest_blue_hardening` or
`curl -s http://127.0.0.1:3333/api/teams/blue/hardening`. Off loopback, add
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Find folded findings

For each ledger finding: if its severity is one of the five recognized words, it is
correct and is not listed. If its severity is missing, empty, or any other value,
list it as folded.

Confirm the fold in the tier view. A folded finding appears under priority 3
(medium) in `items`. A finding whose recorded severity is recognized but appears
under a different priority is a backend defect. Report it, and do not hide it.

## 4. Describe the effect

For each folded finding, state the raw severity exactly as recorded, the tier it
landed in (medium, priority 3), and what that changes: its effort and control come
from the medium row, and its sentinel detector order is medium too. The correction
for the red team is to set one of the five recognized words. Do not suggest a word
from the title alone. The red team sets severity from the evidence.

## 5. Count the effect

Report folded findings against the total. If the count is zero, say so once and
stop. Do not pad the report.

## 6. Completion summary

Close with: scope and mission id; the folded-findings table (finding, raw
severity, effect, requested correction); the count, folded out of total; any
priority mismatch, reported as a backend defect; the report pointer
(`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this severity check
> is parked under its mission id and resumes when the backend answers.

Never re-tier a finding in the report. The seat never opens a browser panel;
every step goes through the MCP tools or the loopback HTTP API.
