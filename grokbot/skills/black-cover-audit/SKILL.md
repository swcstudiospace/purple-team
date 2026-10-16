---
name: black-cover-audit
description: Use when the operator types /black-cover-audit with a command or artifact: audits per-action cover residue (user agent, timestamps, DNS, temp files, credentials in argv) and reports it to blue.
---
# Black cover audit

Per-action residue audit. Each command or artifact is read the way a defender
reads a log line. The skill reports what the action leaves behind, and it
never erases any of it.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

The audit is `coverAudit()` in `src/teams/black.ts`. It returns `leaks`
(human-readable residue lines) and a `checklist` of five items, each clean or
not: user-agent hygiene, timestamp exposure, dns residue, temp-file residue, and
credential material in args. Residue is a finding for the blue team. Anti-forensic
cleanup is refused, as in `black-anti-forensics-refusal`.

## Grammar

```
/black-cover-audit "<command or artifact path>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`cover-<date>-<n>` label while waiting) and the parsed command or artifact
paths. The operator must see the ack before any backend call resolves. Quote
credential-shaped input back redacted, never in full.

## 2. Dispatch the audit

The per-action audit is not on any backend route. The black routes return
phase-grouped checklists (`/api/teams/black/cover`) and noise ledgers
(`/api/teams/black/noise`), and neither calls `coverAudit()`. The MCP tools
`tempest_black_cover` and `tempest_black_noise` reach the same routes.

So this skill cannot run the audit through the backend. Do this instead:

1. Read the cover phases that the backend returns for the latest red plan draft,
   with `tempest_black_cover` or
   `curl -s http://127.0.0.1:3333/api/teams/black/cover`. These are opsec
   checklist items, not per-action residue. Quote them as checklist items only.
2. Apply the five audit rules from `coverAudit()` by reading the command text
   yourself, and label every result as a manual reading, not as the engine's
   output:
   - User agent: a curl, wget, or httpx command with no deliberate user agent.
     A deliberate one is --user-agent, dash-a followed by whitespace, a
     user-agent header, or dash-a with an equals sign.
   - Timestamps: ISO-like date-times, ts= markers, --timestamp, or date -u in
     the command or artifact paths.
   - DNS: dig, nslookup, or host with no resolver named by an @ sign, --server,
     or --dnsserver.
   - Temp files: artifact paths under /tmp/, or named like temp, .tmp, .out,
     response.txt, or output.txt.
   - Credentials: password, passwd, token, api key, secret, a bearer
     authorization header, or a cookie header in the command text.
3. For each finding, give the honest sanitizing fix: a neutral user agent, a
   pinned resolver, a secret moved out of argv into a stream or file, output
   written to a declared location.

Never erase, rename, or delete any temp file, log, or artifact. Never recommend
a forged or falsified record. Never copy a credential value into the report;
report its position only. If the operator asks for a per-action engine result,
say the route does not provide one and that this is a manual reading.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the five checklist results per action (each
marked manual reading), the leak lines in the audit's own wording, the
correlation keys across actions (shared user agent, repeated timestamp, common
resolver, same temp path), the sanitizing fixes with their assumptions, the
statement that the per-action audit is not on a backend route, and the report
pointer (`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line:

> t3mp3st backend unreachable — start it with npm run server; this audit is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
