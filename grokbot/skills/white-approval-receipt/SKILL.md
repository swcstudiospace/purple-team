---
name: white-approval-receipt
description: >-
  Use when the operator types /white-approval-receipt with an action: checks that an approved flag is backed by a ledger receipt that names the same command and target, and reports the gap when it is not.
---
# White approval receipt

Checks whether an action's approval is backed by evidence, not just by a flag.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

`roeAudit` in `src/teams/white.ts` reads `approved` from the action and nothing else.
Only `approved === true` lifts an active action from needs_approval. That boolean is
set by whoever submits the action, so it proves nothing by itself. The receipt is
the ledger entry that proves the approval. An approval without a receipt is an
assertion. A receipt that names a different command or target approves nothing.

`roeAudit` does not read the ledger. The link between a receipt and the `approved`
flag is made by the submitter, so the referee must check that link by hand.

## Grammar

```
/white-approval-receipt "<action: command and target>" [--mission <mission-id>]
```

## Modules and routes

- `roeAudit` in `src/teams/white.ts`: reads `approved`, `command`, `target`.
- `auditEvidenceChain` and `resolveLedgerStrength` in
  `src/teams/white/evidence-chain.ts`: a receipt type resolves to replayable strength,
  and a replay hook is the entry's `command` or `uri`.
- `GET /api/teams/white/evidence` (`src/server.ts`): each link carries `type`,
  `title`, `command`, `uri`, `findingId`, `missionId`, `createdAt`, `status`, and
  `replayHook`.
- `GET /api/teams/white/roe` (`src/server.ts`): the verdict for the action.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `approval-<date>-<n>` label while
waiting) and the action as parsed. Send this before any backend call resolves.

## 2. Read the verdict

Read the stored verdicts through `tempest_white_roe` or `GET /api/teams/white/roe`.
Find the verdict for this action. Note whether it is needs_approval because
`approved` is not true, or compliant because it is passive. Verdicts appear only when
the ROE parse is `ok`.

## 3. Read the ledger

Call `tempest_white_evidence` or `GET /api/teams/white/evidence`. Keep every link
whose `type` is `receipt`, or whose `title` or `command` refers to an approval of
this action. Record each candidate's `evidenceId`, `status`, `replayHook`, and
`missionId`.

## 4. Test each candidate receipt

A receipt backs the approval only if all of these hold:

1. **Type**: `type` is `receipt`, or the link's strength is replayable.
2. **Hook**: `replayHook` is present. The chain audit marks a replayable entry with
   no hook as `broken`. A broken receipt backs nothing.
3. **Command**: the `command` field matches the action's command, or the `uri` names
   the same artifact.
4. **Target**: the `command`, `uri`, or `title` names the action's target. The ledger
   link view has no separate target field, so say when the target match is textual
   only.
5. **Mission**: `missionId` matches the mission being reviewed.

## 5. Outcomes

- **Matching receipt, flag set**: state the receipt id and that the verdict is backed.
  Note that `roeAudit` reads only the flag, so confirm the submitter set `approved`
  from this receipt.
- **Matching receipt, flag not set**: the verdict stays needs_approval. Name the
  receipt and say that the submitter must set the flag before the action is
  re-audited.
- **Flag set, no matching receipt**: report it as an unbacked approval. Do not treat
  it as clearance.
- **Candidate receipt is broken**: name the defect (no hook) and the condition that
  restores it: attach the exact command or uri the re-run uses.

## 6. Completion summary

Close with: action, mission id, the verdict as returned, each candidate receipt with
its tests passed or failed, the outcome from step 5, and the report pointer
`/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this approval check
> is parked under its mission id and resumes when the backend answers.

Never present an unbacked flag as an approval. Seats never open a browser panel;
every step goes through the MCP tools or the loopback HTTP API.
