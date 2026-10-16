---
name: blue-deception-plan
description: >-
  Use when the operator types /blue-deception-plan with findings: designs inert decoy placements for uncovered Deceive countermeasures, each with a test-touch proof.
---
# Blue deception plan

Designs of inert decoys for findings whose uncovered countermeasures sit in the Deceive tactic. Each design names the decoy, its inertness check, its trigger, and the test touch that proves the alert fires. This skill designs. It does not place.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback, lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

A decoy is worth deploying only when its touch is unambiguous and its own exposure is nil. A decoy with a live credential or a route to production is a new finding, not a defense.

## Grammar

```
/blue-deception-plan "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on the `deception-grid` entry in `TELEMETRY_REGISTRY` in `src/teams/blue/telemetry.ts`, whose `coveredIds` are D3-IHN, D3-DUC, D3-DF, D3-DNR, and D3-DST. Labels and the Deceive tactic come from `D3FEND_BY_ID` in `src/teams/blue/d3fend.ts`. The backend credits a finding only once a deployed source covers its countermeasure. Scope for any placement comes from the ROE verdict of `roeAudit()` in `src/teams/white.ts`, reached through `/white-arbiter`.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local `decoy-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or `curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull the gap report with `tempest_blue_gaps` or `curl -s http://127.0.0.1:3333/api/teams/blue/gaps`. Off loopback, add `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use `T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Select Deceive countermeasures

From each gap with `coverage` `none` or `partial`, take the Deceive ids in `uncoveredCountermeasures`. Only the five ids the deception-grid entry credits can be designed for. Any other Deceive id is reported as "no registry source credits it" and is not designed for.

Choose the decoy class: D3-DUC (decoy credential) for credential use; D3-DF (decoy file) for document or file access; D3-DNR (decoy network resource) for network reach; D3-DST (decoy session token) for session hijack; D3-IHN (integrated honeynet) when more than one applies. Record why each other class does not fit.

## 4. Write the decoy card

- Finding id, countermeasure id, and label.
- Placement, described by system class, never by a live address.
- Inertness check: no live credential, no real data, no route to production, and outbound traffic blocked.
- Trigger: the exact access that raises the alert.
- Test touch: a controlled access in a non-production window, and the alert it must produce on the deployed deception source.
- Retirement: the condition under which the decoy is removed and its record closed.

## 5. Placement gate

No decoy is placed without an ROE verdict covering the system class. Without one, the card stops at placement and reports the blocker. This seat never deploys a decoy.

## 6. Completion summary

Close with: scope and mission id; the decoy cards grouped by finding; countermeasures outside the registry with reasons; the placement gate status per card; the note that coverage changes only after deployment and declaration; the report pointer (`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this decoy design is parked under its mission id and resumes when the backend answers.

Never present a designed decoy as working until its test touch has alerted. The seat never opens a browser panel; every step goes through the MCP tools or the loopback HTTP API.
