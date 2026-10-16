---
name: white-retest-criteria
description: >-
  Use when the operator types /white-retest-criteria with a finding id: lists the finding's recommended fix and retest acceptance criteria, matches ledger retest entries to each criterion, and reports which criteria are proven or unproven.
---
# White retest criteria

Decides whether a finding's fix has been proven by a retest in the ledger, criterion by
criterion. A statement that a fix was made is not a retest.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

The report contract in `auditReport` (`src/teams/white/report-auditor.ts`) requires a
recommended fix and at least one acceptance criterion. Those criteria are the
operator's retest contract. A criterion is proven only by a ledger entry that carries
the finding at tool-grade or better, on the same resource as the original evidence,
and replayable where severity requires.

`auditorScore` in `src/teams/hats.ts` produces a generic `retestCriterion` string for
each evidence entry. Those strings describe a replay recipe. They are not proof.

The ledger has no retest type. Identify retest entries by `findingId` and a
`createdAt` later than the original evidence, and say that this is the method used.

## Grammar

```
/white-retest-criteria "<finding id>" [--mission <mission-id>]
```

## Modules and routes

- `auditReport` in `src/teams/white/report-auditor.ts`: `recommendedFix`,
  `acceptanceCriteria`, and the gaps "no recommended fix" and "no retest acceptance
  criteria".
- `auditEvidenceChain` in `src/teams/white/evidence-chain.ts`: each entry's `status`,
  `strength`, `replayHook`, and `resourceIds`.
- `auditorScore` in `src/teams/hats.ts`: the generic `retestCriterion` strings. These
  are context only.
- `GET /api/teams/white/report-audit`, `GET /api/teams/white/evidence`,
  `GET /api/findings` in `src/server.ts`.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `retest-<date>-<n>` label while
waiting) and the finding id. Send this before any backend call resolves.

## 2. Read the finding and its contract

Call `tempest_findings` for the finding, and `tempest_white_report` for its audit
entry. Quote `recommendedFix` and `acceptanceCriteria` exactly. If either is missing,
name the gap and stop. Verification cannot start until the contract is complete.

## 3. Find the original and the retest entries

Read `GET /api/teams/white/evidence`. The original is the carrying link the audit names.
Retest entries share the finding's `findingId` and have a `createdAt` later than the
original. State that this is the method used.

## 4. Coverage check

For each retest entry, compare `resourceIds`, `command`, and `uri` with the original's.
If they name a different resource, that retest does not cover the finding. Say so.

## 5. Criterion-by-criterion verdict

For each criterion, record the matching retest entry id, its `strength`, its `status`,
its `replayHook`, and one of three marks:

- **proven**: a covering retest entry is accepted, intact, and meets the severity rule
- **unproven**: no covering retest entry, or the entry is broken
- **not testable from the ledger**: the criterion needs something the ledger cannot
  hold; name it

Quote each criterion as written. Never reword one.

## 6. Severity rule

For high and critical findings, a tool-grade-only retest gets a condition: attach a
receipt a third party can re-run. Report the condition with the verdict. Confirm the
hook with `white-severity-replay` when it matters.

## 7. Overall verdict

- **verified**: every criterion proven, and any severity condition met
- **not verified**: name the first unproven criterion or the first named gap
- **regression**: a new failure on the same resource. Record it as a new finding linked
  to the original id. Do not record it as a retest result.

## 8. Defensive artifact

For each unproven criterion, name the retest receipt the operator should attach: its
exact re-run command or uri, and the criterion it proves. Do not run the command.

## 9. Completion summary

Close with: finding id, mission id, the fix and criteria as written, the criterion table
(criterion, retest entry id, strength, hook, mark), the overall verdict, the conditions
and gaps, and the report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this retest check
> is parked under its mission id and resumes when the backend answers.

Never call a fix verified without a ledger retest entry. Never rerun a retest command.
Seats never open a browser panel; every step goes through the MCP tools or the loopback
HTTP API.
