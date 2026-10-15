---
name: white-custody-trail
description: >-
  Use when the operator types /white-custody-trail with an evidence or finding id: traces each entry's origin, source, observation tool, stage, input hash, run, and mission as recorded, and flags duplicate ids that break the record.
---
# White custody trail

Traces the recorded custody of ledger entries behind an evidence id or finding id.
It reports what the ledger says and where the record is broken. It does not verify
claims the ledger cannot verify.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

The ledger entry is the custody record. The chain audit copies its named fields into
each link as recorded: `origin`, `source`, `tool`, `stage`, `inputSha256`, `type`,
`runId`, `missionId`, `operationId`, `title`, `createdAt`, `resourceIds`. It does not
verify any of them. `inputSha256` is reported, never recomputed by the audit. `origin`
is a label the writer chose. Absent `origin` means the writer did not claim an
authentic observation.

Duplicate ledger ids break custody. The first occurrence is judged normally, and each
later occurrence is broken. Records that share an id cannot be told apart.

## Grammar

```
/white-custody-trail "<evidence id or finding id>" [--mission <mission-id>]
```

## Modules and routes

- `LedgerEvidenceShape` and `auditEvidenceChain` in `src/teams/white/evidence-chain.ts`:
  the named-field copy into each link and the duplicate-id rule.
- `GET /api/teams/white/evidence` in `src/server.ts`: the live ledger, in ledger order.
- MCP: `tempest_white_evidence`.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `custody-<date>-<n>` label while
waiting) and the id as given. Send this before any backend call resolves.

## 2. Locate the entries

Read `GET /api/teams/white/evidence`. If the input is an evidence id, select links
whose `evidenceId` matches. If it is a finding id, select links whose `findingId`
matches. If nothing matches, report "not in the ledger". Never report an absent
entry as clean.

## 3. Record the custody fields

For each selected link, list what the link carries: `evidenceId`, `status`, `origin`,
`source`, `tool`, `stage`, `inputSha256`, `runId`, `missionId`, `operationId`,
`createdAt`, `resourceIds`, `replayHook`. Omit fields the link does not carry, and do
not infer them.

## 4. Duplicate check

Count each `evidenceId` across the whole link list. If one occurs more than once,
name each occurrence by its ledger position. The later occurrence is `broken`. Say
that none of the records sharing that id can be cited until one is renamed or
removed.

## 5. Origin and gap check

- `origin` observed: the writer recorded an observation. Report its `tool`, `stage`,
  and `runId`.
- `origin` claimed: the entry is a claim. Report it as a claim.
- `origin` absent: the writer did not claim an authentic observation. Report it as
  absent, not as observed.
- A finding-bearing entry missing `runId` or `missionId` is a custody gap. Report it.
  Do not fill it in.

## 6. Hash check

Report `inputSha256` as recorded and unverified. If the operator supplies the input
bytes, you may compute the SHA-256 locally and report a match or a mismatch. Without
the input, the hash stays unverified.

## 7. Output table

| evidenceId | status | origin | source | tool | stage | runId | missionId | inputSha256 | gaps |
|---|---|---|---|---|---|---|---|---|---|

## 8. Completion summary

Close with: input, mission id, the custody table, duplicate-id breaks, custody gaps,
the unverified hashes, and the report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this custody trace
> is parked under its mission id and resumes when the backend answers.

Never present a recorded claim as a verified observation. Seats never open a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
