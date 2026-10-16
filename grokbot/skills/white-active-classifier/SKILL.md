---
name: white-active-classifier
description: >-
  Use when the operator types /white-active-classifier with a command or tool id: shows whether the keyword rule classifies it as active, and flags active-capable tools the rule misses.
---
# White active classifier

Reports what the active-technique keyword rule decides for a command, and where that
rule is blind. It does not change the ruling; it shows the operator the gap.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

`roeAudit` in `src/teams/white.ts` classifies an action as active only when its
`command` text matches `ACTIVE_PATTERN`: a case-insensitive, unanchored test for
scan, exploit, fuzz, brute, spray, inject, payload, nmap, masscan, sqlmap, nuclei,
ffuf, nikto, hydra, metasploit, naabu, katana, dalfox, feroxbuster, gobuster, whatweb,
or post exploit. A command that does not match is ruled passive, and passive actions
need no approval, whatever the tool actually does on the wire.

The keyword list covers the scanners, crawlers, fuzzers, and fingerprinters in the
black grant set. Tools in that set that send traffic but match no keyword (for example
`curl` and `httpx` single requests) are classified passive by the rule. The grant set
comes from `teamToolGrants('black')` in `src/teams/index.ts`.

## Grammar

```
/white-active-classifier "<command or tool id>" [--mission <mission-id>]
```

Never execute the command. A one-line regex test over the given string is allowed.

## Modules

- `ACTIVE_PATTERN` and `roeAudit` in `src/teams/white.ts`.
- `teamToolGrants('black')` in `src/teams/index.ts` for the black grant ids.

## 1. Acknowledge immediately

Reply with the mission id (quoted back, or a local `active-classify-<date>-<n>` label
while waiting) and the input string. Send this before any other step.

## 2. Classify each command

For each command, test `ACTIVE_PATTERN` against the command text exactly as given.
Record the first matching keyword, or "no match".

- Match: the rule says active. An active action without `approved: true` is
  needs_approval, and with `allowActive: false` it is a violation.
- No match: the rule says passive. The action is compliant if its target is in scope.

Keep the rule's answer separate from your own judgement.

## 3. Check the tool id

For a bare tool id, the pattern can match only if the id itself contains a keyword.
Report two facts: the pattern result and whether the id is in `teamToolGrants('black')`.

## 4. Known blind spots

Scanner, crawler, fuzzer, and fingerprinter ids in the black grant set (`naabu`,
`katana`, `dalfox`, `feroxbuster`, `gobuster`, `whatweb`) now match `ACTIVE_PATTERN`
and classify as active. Report a gap only when a black grant id sends traffic to a
target and matches no keyword.

These ids also reach the target, but the rule's verdict for them is a judgement
call for the referee, not a gap:

- `curl` and `httpx` (single requests). Report that the rule treats them as passive
  and that the referee decides whether a single request is active.

Do not add these to the rule yourself. Report the gap; the integration owner changes
the pattern.

## 5. Output table

| command or tool id | pattern match | black grant | rule decision | gap or judgement |
|---|---|---|---|---|

## 6. Completion summary

Close with: input, mission id, the classification table, the gaps that a passive
ruling would hide, and the report pointer `/tempest-report <mission id>`.

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this classification
> is parked under its mission id and resumes when the backend answers.

Never present the keyword decision as a complete safety judgement. Seats never open a
browser panel; every step goes through the MCP tool `tempest_white_roe` (GET returns the per-action `roeAudit` verdicts for the recorded actions) or the loopback HTTP API at http://127.0.0.1:3333/api/teams/white/roe.
