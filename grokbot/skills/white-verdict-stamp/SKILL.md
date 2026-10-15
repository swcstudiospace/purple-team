---
name: white-verdict-stamp
description: >-
  Use when the operator types /white-verdict-stamp with a verdict set or action index: checks the revision, text-hash, and source-line stamps on ROE verdicts against the current on-record text and flags stale or unbacked verdicts.
---
# White verdict stamp

Checks that a set of ROE verdicts is still current against the ROE text on record.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Each verdict that `GET /api/teams/white/roe` returns is stamped with `roeRevision`,
`roeTextHash`, and `roeLines` (the source line numbers of the parse). The response
also carries `provenance` (revision, textHash, recordedAt). A verdict is current only
when its stamps match that provenance. The server recomputes a 16-character SHA-256
prefix of the stored text and refuses to derive verdicts on a mismatch, so a stale
or altered record cannot produce fresh-looking verdicts.

A verdict set copied from an earlier response, or handed over by another seat, is
stale whenever its stamps differ from the current provenance. Relay only the current
response. Never carry old verdicts forward.

## Grammar

```
/white-verdict-stamp "<verdict set or action index>" [--mission <mission-id>]
```

## Modules and routes

- `GET /api/teams/white/roe` in `src/server.ts`: stamps each verdict, runs the hash
  check, and returns `provenance`.
- `parseRoe` in `src/teams/white/roe-parser.ts`: produces the `resolved` lines whose
  line numbers appear in `roeLines`.
- `roeAudit` in `src/teams/white.ts`: produces the verdicts.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `verdict-stamp-<date>-<n>` label
while waiting) and the verdict set or action index. Send this before any backend call
resolves.

## 2. Read the current state

Call `tempest_white_roe`, or `curl -s http://127.0.0.1:3333/api/teams/white/roe`
(add the bearer header off loopback). Record `provenance.revision`,
`provenance.textHash`, and `provenance.recordedAt`.

## 3. Check each verdict's stamps

For every verdict in the set:

1. `roeRevision` equals `provenance.revision`.
2. `roeTextHash` equals `provenance.textHash`.
3. `roeLines` is non-empty, and each line number appears in the current `resolved`
   list. A line number that no longer resolves means the text changed under the verdict.

Record each verdict as current, or stale with the failing check named.

## 4. Handle the empty and failed cases

- If the response says no ROE text is on record, there are no stamped verdicts. Say
  so. Do not carry verdicts forward.
- The hash check returns the same "no ROE text on record" summary whether no record
  exists or the stored text fails its hash. The response alone cannot tell the two
  apart. Report it as ambiguous and ask the operator whether a record should exist.
- If `ok` is false, the response carries no verdicts. Say that the parse is held.

## 5. Recovery from stale state

When the revision has changed since the operator's copy, re-read the state before
acting on anything. Never reconcile by editing stamps, revisions, or hashes in a
verdict set. The current response is the only source.

If the operator needs a verdict under the current text, say that the action must be
re-audited against the current revision. Do not produce that verdict from the stale set.

## 6. Output table

| verdict (action index) | roeRevision | roeTextHash | roeLines | status |
|---|---|---|---|---|

## 7. Completion summary

Close with: scope, mission id, the current provenance, the per-verdict status (current
or stale, with the failing check), the empty or failed-hash cases if any, and the
report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this stamp check
> is parked under its mission id and resumes when the backend answers.

Never present a stale verdict as current. Seats never open a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
