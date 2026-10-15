---
name: white-roe-parse
description: >-
  Use when the operator types /white-roe-parse with ROE text or a scope question: accounts for every line of the on-record ROE text and reports whether the spec is safe to adjudicate against.
---
# White ROE parse

Line-by-line accounting of the on-record Rules of Engagement text. Every line lands
in the spec or is reported unresolved with its reason, then a standing verdict says
whether the spec can be adjudicated against.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

The parser in `src/teams/white/roe-parser.ts` never guesses. A spec is safe to
adjudicate only when `ok` is true, a scope directive has produced `allowedTargets`,
and no allow-active conflict remains. Both `parseRoe` and `roeAudit` in
`src/teams/white.ts` fail closed when `allowedTargets` is absent or empty (`ok: false`
and `violation`).

## Grammar

```
/white-roe-parse "<roe text or question>" [--mission <mission-id>]
```

Read-only by default. Recording new text is a separate step that needs operator
confirmation (procedure 3).

## Modules and routes

- `parseRoe(text)` in `src/teams/white/roe-parser.ts`: returns `roe`, `resolved`,
  `unresolved`, `commentLines`, `ok`, `summary`.
- `GET /api/teams/white/roe` in `src/server.ts`: parses the on-record text and returns
  the parse with `provenance` (revision, textHash, recordedAt). Verdicts from
  `roeAudit` appear only when `ok` is true.
- `PUT /api/teams/white/roe`: records text and actions. Empty text answers 400;
  text over the 64 KiB cap answers 413.
- MCP: `tempest_white_roe` (GET when no text is supplied, PUT when both text and
  actions are supplied).

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`roe-parse-<date>-<n>` label while waiting) and the question. The operator must see
the acknowledgement before any backend call resolves.

## 2. Read the stored parse

Call `tempest_white_roe`, or `curl -s http://127.0.0.1:3333/api/teams/white/roe`.
Off loopback, add `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use
`T3MP3ST_BEARER_TOKEN_FILE`). Keep the full response.

If the response says no ROE text is on record, report that and stop. There is no
spec to parse, and an empty record is not permission.

## 3. Parse new text only on request

`parseRoe` runs on the server only through the PUT route, and the PUT stores the
text. Ask the operator to confirm the recording before sending it. Then send `text`
and `actions` (an empty array is allowed). A successful parse writes an observed
receipt; a failed parse stores the text without one. Read the `ok` field of the PUT
response and report which case happened.

## 4. Account for every line

- Count resolved lines, unresolved lines, and comment lines. Every content line must
  appear in the resolved or unresolved list.
- Quote every unresolved line with its reason exactly as returned. Do not paraphrase.
- Check each resolved line against the vocabulary: scope aliases (`scope:`,
  `allowed targets:`, `targets:`, `in scope:`), bullets that continue a scope list,
  allow-active aliases (`allow active:`, `active testing:`, `active techniques:`), and
  the yes/no tokens (yes, true, permitted, allowed, no, false, forbidden, denied,
  disallowed, prohibited).

## 5. Check the standing

- `allowedTargets` present and non-empty? If not, the standing is "no scope defined",
  whatever `ok` says. Report it as a blocking gap.
- `allowActive` present? If absent, `roeAudit` applies no active-technique rule. Say
  so; do not describe the spec as permitting or forbidding active work.
- Conflicting allow-active lines: report both source line numbers. The later value
  wins, but the spec is not clean until one line is removed.
- Targets: list them verbatim. Entries beginning with a `*.` wildcard prefix match
  label-bounded subdomains (`sub.example.com`) under `hostInScope` in `roeAudit`,
  while excluding the bare apex (`example.com`). Note whether apex coverage was also
  intended. Run `white-scope-match` on any target the operator asks about.

## 6. Repair list

For each defect, give one repair line: add a scope directive with explicit targets,
delete one of two conflicting allow-active lines, or replace an unrecognized directive
with an accepted one. Do not rewrite the operator's text. Label any suggested wording
as a suggestion.

## 7. Completion summary

Close with: scope, mission id, standing (`ok`, `summary`, revision, text hash,
resolved targets, allowActive), line counts, the unresolved lines with reasons, the
blocking gaps with their repairs, and the report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this parse
> is parked under its mission id and resumes when the backend answers.

Never present a parse with `ok: false` as a clean bill. Never present a guess as a result.
Seats never open a browser panel; every step goes through the MCP tools or the loopback HTTP API.
