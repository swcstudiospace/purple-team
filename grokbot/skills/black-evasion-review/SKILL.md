---
name: black-evasion-review
description: Use when the operator types /black-evasion-review with concealment steps: checks obfuscation, masquerading, and sandbox-awareness against the stealth checklist.
---
# Black evasion review

Stealth-tradecraft review of concealment steps. Every step must have a
declared purpose and an explained artifact. Anti-forensic requests are
refused and handed to the blue team as residue.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Evasion review applies the stealth checklist from `opsecChecklist("stealth")`
in `src/teams/black/checklist.ts`: STL-01 awareness only, STL-02 every
obfuscation step must be explainable, STL-03 no masquerading inside victim
namespaces, STL-04 declare sandbox assumptions instead of probing for them.
Vocabulary anchors live in `src/teams/black/noise.ts`: obfuscation maps to
T1027, masquerading to T1036, sandbox probing to T1497. Anti-forensics maps to
T1070.004 and T1070.006 and pays the fixed eight-point penalty in
`structuredNoiseBudget()`.

## Grammar

```
/black-evasion-review "<concealment steps or plan scope>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`evasion-<date>-<n>` label while waiting), the parsed scope, and the target.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the review

Read the stealth phase and the noise violations over the latest red plan
draft:

- Cover review: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Read the `stealth`
  phase: `matchedTechniques` and checklist items STL-01 to STL-04.
- Noise ledger: `tempest_black_noise`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/noise`. Read each entry's
  `matches` and `rationale`, and every violation that begins with
  "anti-forensics refused".

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Sort each concealment step into one class:

- Explained: has a purpose and an artifact the analyst can reproduce.
- Declared: a sandbox or VM assumption stated, not tested live (STL-04).
- Refused: matches T1070.004 or T1070.006, or masquerades inside a victim
  namespace (STL-03). Record the violation text exactly.
- Unexplained: an obfuscation step with no explanation. It blocks until one is
  written.

Relay the backend's `matches` and violation text verbatim. Never reclassify a
refused step as stealth. Never claim a sandbox check passed, because this
skill never runs one. An empty `phases` array means no active red plan; say so.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, each concealment step with its class, the
artifact each explained step leaves, each refused step with its violation
text and the approval path that would change the answer, the stealth-tier
cost from the ledger, and the report pointer (`/tempest-report <mission id>`).
If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this review is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
