---
name: white-scope-match
description: >-
  Use when the operator types /white-scope-match with a target: shows which allowed ROE entry matches it, by which rule, and flags lookalike hosts that the substring rule would admit.
---
# White scope match

Shows exactly how `roeAudit` decides whether a target is in scope, entry by entry,
and flags matches the operator did not intend.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

`roeAudit` in `src/teams/white.ts` lowercases the action's target, reduces it to a host
(`hostOf` strips scheme, path, query, fragment, and port), and checks each allowed entry
with `hostInScope`:

1. equality (`host === allowed`)
2. label-bounded subdomain (`host.endsWith("." + allowed)`)
3. wildcard (`allowed` starts with `*.`): the host must end with the suffix after the
   `*` and be longer than it, so the bare apex is not covered

`notexample.com` does not match `example.com`, and `example.com.evil.net` does not
match `example.com`. An action with no target or an empty `allowedTargets` list fails
closed as a `violation` in `roeAudit`.

## Grammar

```
/white-scope-match "<target>" [--mission <mission-id>]
```

`<target>` is a hostname or IP literal only. Reject shell metacharacters before any
tool sees the value.

## Modules and routes

- `roeAudit(actions, roe)` in `src/teams/white.ts`: the `inScope` expression.
- `roe.allowedTargets` from `GET /api/teams/white/roe` (`src/server.ts`), or the
  `tempest_white_roe` MCP tool.
- Parsed targets are kept verbatim by `parseRoe` in `src/teams/white/roe-parser.ts`,
  with case-insensitive duplicates removed.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `scope-match-<date>-<n>` label
while waiting) and the target. Send this before any backend call resolves.

## 2. Read the allowed list

Call `tempest_white_roe`, or `curl -s http://127.0.0.1:3333/api/teams/white/roe`
(add the bearer header off loopback). Read `roe.allowedTargets`.

If `allowedTargets` is absent or empty, `roeAudit` fails closed and rules every action
as a `violation`. Report that first as a blocking gap, not as a match, and stop. No
further matching is meaningful until a scope directive exists.

## 3. Evaluate each entry

Normalize the target `t` with `hostOf` (lowercase, strip scheme, userinfo, path, query,
fragment, port, and IPv6 brackets) and each allowed entry `a` the way `roeAudit` does.
Build a table:

| allowed entry (a) | equal | labelSubdomain | wildcardSubdomain | result |
|---|---|---|---|---|

## 4. Label each match

- **exact**: `t` equals `a`. The intended form.
- **label-bounded subdomain**: `t` ends with `.` + `a`. Intended subdomain coverage.
  Report it as a match with its label.
- **wildcard subdomain**: `a` starts with `*.` and `t` ends with the suffix after `*`
  (longer than the suffix, so the bare apex is not covered).
- **rejected lookalike**: `t` ends with `a` without a leading dot (`notexample.com`
  against `example.com`) or contains `a` only as a non-suffix substring
  (`example.com.evil.net` against `example.com`). `hostInScope` rejects these.

## 5. Note what the rule enforces

- `hostOf` strips scheme, `userinfo@`, port, path, query, fragment, and IPv6 brackets
  before comparing against `allowedTargets`, while preserving bare IPv6 literals.
- A `*.example.com` wildcard entry matches subdomains (`sub.example.com`) and excludes
  the bare apex (`example.com`).
- An action with no target fails closed as a `violation` in `roeAudit`.

## 6. Recommendation

Exact entries are the clean form. For each flagged match, recommend the exact host
the operator means to allow, as a labeled suggestion. Do not edit the ROE text.

The compliance ruling on the action itself comes from the verdicts that
`GET /api/teams/white/roe` returns for the stored actions. Quote those verdicts; do
not derive a new one here.

## 7. Completion summary

Close with: target, mission id, allowed entries evaluated, each match with its label
(exact, label-bounded, unbounded, substring), the flagged lookalikes, the blocking gap
if the scope is absent, and the report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this scope match
> is parked under its mission id and resumes when the backend answers.

Never present a guessed match as a result. Seats never open a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
