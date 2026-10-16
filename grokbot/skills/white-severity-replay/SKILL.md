---
name: white-severity-replay
description: >-
  Use when the operator types /white-severity-replay with finding ids: checks that each high or critical finding rests on a replayable receipt a third party can re-run, and flags the hookless receipts the report audit would pass.
---
# White severity replay

Checks that every high or critical finding rests on evidence a third party can re-run,
and surfaces the cases where the two white audits disagree.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Two audits judge the same evidence on different terms.

- `auditReport` in `src/teams/white/report-auditor.ts` adds a condition to a high or
  critical finding when no carrying link has replayable strength. It judges strength
  only.
- `auditEvidenceChain` in `src/teams/white/evidence-chain.ts` marks a replayable entry
  with no `command` or `uri` as broken: "the receipt cannot be re-opened".

So a high finding carried only by a receipt with no hook is report-ready with no
condition, while the chain marks that receipt broken. That conflict is the thing this
skill reports. It does not resolve the conflict by choosing one audit over the other.

## Grammar

```
/white-severity-replay "<finding ids or scope>" [--mission <mission-id>]
```

## Modules and routes

- `auditReport`: the severity condition, `belowReplayable`, `carryingLinks`.
- `auditEvidenceChain`: the replayable-without-hook rule, `replayHook`, `status`.
- `resolveLedgerStrength` in `src/teams/white/evidence-chain.ts`.
- `GET /api/teams/white/report-audit` and `GET /api/teams/white/evidence` in `src/server.ts`.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `severity-replay-<date>-<n>` label
while waiting) and the finding ids. Send this before any backend call resolves.

## 2. Read the report audit

Call `tempest_white_report` or `GET /api/teams/white/report-audit`. For each high or
critical finding in scope, record `status`, `conditions`, `belowReplayable`, and
`carryingLinks` with each link's strength.

## 3. Read the chain

Call `tempest_white_evidence` or `GET /api/teams/white/evidence`. For each carrying link
id from step 2, record `status`, `strength`, `replayHook`, and `reason`.

## 4. Classify each finding

- **Replayable with hook**: a replayable carrying link is intact. No action.
- **Replayable without hook**: a replayable carrying link is broken. The report audit
  may show the finding as ready with no condition. Report this as a conflict and as
  blocked on the hook.
- **No replayable carrying link**: the report audit's condition applies verbatim:
  the claim rests below replayable grade. Report it with the finding's readiness.
- **Non-replayable accepted ids** in `belowReplayable`: list them. They carry the
  finding at tool grade and need a replayable receipt to lift the condition.

## 5. The hook that clears a conflict

For each conflict, name the artifact that clears it: a receipt whose `command` or `uri`
re-runs the claim. Describe what the hook must do. Do not write the command.

## 6. What a condition means

A condition does not block shipping. A finding can be report-ready and still carry the
condition, and the report must show both. Never describe a condition as satisfied
because the finding is ready.

## 7. Completion summary

Close with: scope, mission id, each high or critical finding with its readiness,
condition, carrying links, and classification, the conflicts with their clearing
artifacts, and the report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this replay check
> is parked under its mission id and resumes when the backend answers.

Never present a hookless receipt as replayable. Seats never open a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
