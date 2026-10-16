---
name: white-report-coverage
description: >-
  Use when the operator types /white-report-coverage with finding ids or scope: states, per finding, whether it is report-ready, names the exact gap that blocks it, and lists any condition that ships with it.
---
# White report coverage

Per-finding ship decision: report-ready, blocked by a named gap, or ready with a
named condition.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

`auditReport` in `src/teams/white/report-auditor.ts` is the ship gate. A finding is
report-ready only when every referenced evidence id resolves, at least one accepted
link (tool-grade or better) carries it, a recommended fix is present, and at least
one retest acceptance criterion is present. A missing piece is a gap, and a gap
blocks shipping. A condition does not block shipping. The report still has to show it.

## Grammar

```
/white-report-coverage "<finding ids or scope>" [--mission <mission-id>]
```

## Modules and routes

- `auditReport(findings, evidence)` in `src/teams/white/report-auditor.ts`: the
  per-finding gate and the unclaimed-evidence sweep.
- `FindingShape` in the same module: `id`, `title`, `severity` (info, low, medium,
  high, critical), `evidenceIds`, `recommendedFix`, `acceptanceCriteria`.
- `GET /api/teams/white/report-audit` in `src/server.ts`: audits the whole findings
  ledger, latest first, against the whole evidence ledger.
- `GET /api/findings` (MCP: `tempest_findings`): the findings themselves.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `report-coverage-<date>-<n>` label
while waiting) and the finding ids as given. Send this before any backend call resolves.

## 2. Read the findings

Call `tempest_findings`, with `missionId` when the operator gave one. If a finding id
the operator named is absent, report it as not found. Never report an absent finding
as ready.

## 3. Read the audit

Call `tempest_white_report` or `GET /api/teams/white/report-audit`. The route audits
every finding in the ledger, so filter to the requested ids in the report. Say so when
the mission scope differs from the audit scope.

## 4. Per-finding record

For each requested finding, record:

- `status`, and `gaps` verbatim
- `linkCounts` (referenced, absent, insufficient, accepted)
- `absentIds` and `insufficientLinks`
- `carryingLinks`, with origin and strength
- `recommendedFix` and `acceptanceCriteria`, as present or missing
- `conditions`, verbatim

## 5. Name the first gap and the artifact that clears it

- absent evidence: the ledger entry that is missing, by id
- no tool-grade carrying link: a tool-grade command entry or a replayable receipt
- no recommended fix: a fix statement
- no acceptance criteria: at least one retest criterion
- no evidence referenced: at least one ledger id

Name one artifact per gap. Do not write the artifact yourself.

## 6. Conditions

For high and critical findings with no replayable carrying link, the audit adds a
condition: the claim rests below replayable grade. A finding with only that condition
is report-ready, and the condition ships with it. Report both facts together.

## 7. Replay-hook check

For high and critical findings, confirm that the replayable carrying link has a replay
hook. `auditReport` judges replayable by strength alone and does not check the hook.
Run `white-severity-replay` for any such finding.

## 8. Counts

Quote `reportReady`, `withGaps`, and the audit `summary` as derived from the
per-finding audits. Do not recompute them by hand.

## 9. Completion summary

Close with: scope, mission id, the summary counts, each finding's decision (ready,
blocked with the named gap, or ready with the named condition), and the report pointer
`/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this coverage audit
> is parked under its mission id and resumes when the backend answers.

Never mark a finding ready that the audit reports with gaps. Seats never open a
browser panel; every step goes through the MCP tools or the loopback HTTP API.
