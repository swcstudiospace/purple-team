---
name: blue-warden
description: >-
  Use when the operator types /blue-warden with findings: audits hardening
  and returns a verification checklist plus misconfiguration call-outs.
---
# Blue warden

Hardening audit of red findings: a per-item verification checklist and an
explicit misconfiguration call-out list.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Warden performs "control verification": each hardening item ships with
how to verify it, and misconfigurations are called out by name.

## Grammar

```
/blue-warden "<finding ids or scope>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`warden-<date>-<n>` label while waiting) and the parsed scope and target.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the audit

Pull the findings first with the `tempest_findings` MCP tool (or
`curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`),
then drive `tempest_hat_dispatch` with hat `warden` — or directly,
composing the canonical calls:

```bash
SPAWN=$(curl -s -X POST http://127.0.0.1:3333/api/operators/spawn \
  -H 'Content-Type: application/json' \
  -d '{"archetype":"warden"}')
OP=$(echo "$SPAWN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X POST http://127.0.0.1:3333/api/operators/$OP/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"hardening audit","taskDescription":"<findings>"}'
```

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, hardening items with verification steps,
misconfiguration call-outs, and the report pointer
(`/tempest-report <mission id>`). If the backend is unreachable, say so
in one line —

> t3mp3st backend unreachable — start it with npm run server; this audit
> is parked under its mission id and resumes when the backend answers.

— and never present guesses as results. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
