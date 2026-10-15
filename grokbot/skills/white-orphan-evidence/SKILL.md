---
name: white-orphan-evidence
description: >-
  Use when the operator types /white-orphan-evidence: lists ledger entries that no finding claims, with the reason each is unclaimed, and counts them by origin and platform ruling.
---
# White orphan evidence

Lists collected evidence that no finding in the report uses. A report that drops
collected evidence without saying so is a defect, and this skill makes the drop visible.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

`auditReport` in `src/teams/white/report-auditor.ts` checks coverage in both
directions. Every ledger entry that no audited finding references is reported as
unclaimed, with the reason. An entry whose `findingId` names a finding absent from the
audited report gets that exact reason. Collected evidence is never dropped silently.

Unclaimed evidence is not a finding. It is a question: a finding may be missing, or the
evidence may be unrelated. Report the question. Do not create the finding.

## Grammar

```
/white-orphan-evidence [--mission <mission-id>]
```

## Modules and routes

- `auditReport` in `src/teams/white/report-auditor.ts`: `unclaimedEvidence`,
  `unclaimedObserved`, `unclaimedClaimed`, `unclaimedAccepted`.
- `resolveLedgerStrength` in `src/teams/white/evidence-chain.ts`: strength resolves as
  the explicit override, then the persisted `provenanceStrength`, then the entry type.
- `GET /api/teams/white/report-audit` in `src/server.ts`.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `orphan-<date>-<n>` label while
waiting). Send this before any backend call resolves.

## 2. Read the unclaimed set

Call `tempest_white_report` or `GET /api/teams/white/report-audit`. The unclaimed set is
computed against every finding in the findings ledger, not one mission. If the
operator asked for a mission, say the set is ledger-wide and filter only in the report.

## 3. Group by reason

Two reasons appear in the audit:

- "references finding X, which is not in the audited report"
- "not referenced by any finding in the report"

Group the entries by reason and list each with `evidenceId`, `findingId` when present,
`strength`, `verdict`, `origin`, `source`, `tool`, `title`, and `createdAt`.

## 4. Counts

Quote `unclaimedEvidence` length, `unclaimedObserved`, `unclaimedClaimed`, and
`unclaimedAccepted` as derived by the audit. Do not recount by hand.

## 5. Interpret each group

- **Accepted unclaimed** (tool-grade or better): collected evidence no finding uses.
  If the reason names a missing finding, that finding is the question. If it names no
  finding, say the evidence may be unrelated to any finding in the report.
- **Insufficient unclaimed** (context or weak): state what it lacks to carry a finding,
  which is tool-grade or better provenance, and a replay hook where the chain needs one.
- **Observed unclaimed**: report the observation tool and run as recorded.
- **Claimed unclaimed**: report it as a claim with no finding behind it.

## 6. Completion summary

Close with: scope, mission id, the counts, each unclaimed group with its entries and
the question it raises, and the report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this orphan sweep
> is parked under its mission id and resumes when the backend answers.

Never present an unclaimed entry as dismissed. Seats never open a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
