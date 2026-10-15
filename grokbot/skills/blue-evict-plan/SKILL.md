---
name: blue-evict-plan
description: >-
  Use when the operator types /blue-evict-plan with findings: writes incident-response eviction recommendations for findings that show an active foothold.
---
# Blue evict plan

Eviction recommendations for findings that show an active foothold: which Evict countermeasures apply, in what order, and what proof shows the foothold is gone. This seat recommends eviction to incident response. It never performs one.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback, lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Eviction removes a live foothold, and the proof is that the foothold no longer responds, not that a removal command returned. Blue tooling here is read-and-inspect only, so every eviction is a recommendation with an operator owner.

## Grammar

```
/blue-evict-plan "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on the Evict tactic in `src/teams/blue/d3fend.ts`. Its terms (D3-PE process eviction, D3-PT process termination, D3-PS process suspension, D3-ST session termination, D3-HS host shutdown, D3-HR host reboot, D3-FEV file eviction, D3-ER email removal, D3-DRT domain registration takedown, and others) resolve through `D3FEND_BY_ID`. Uncovered ids come from `coverageGaps()` in `src/teams/blue/coverage.ts`. `BLUE_TOOLS` in `src/teams/index.ts` grants no eviction capability.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local `evict-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull findings with `tempest_findings` (or `curl -s http://127.0.0.1:3333/api/findings?missionId=<mission-id>`). Then pull the gap report with `tempest_blue_gaps` or `curl -s http://127.0.0.1:3333/api/teams/blue/gaps`. Off loopback, add `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use `T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Identify active footholds

A finding is in scope only when its title or evidence shows a foothold that may still be live: a running process, an open session, a persistent file, a mailbox rule, or a registered domain. Do not infer a foothold from severity. Mark each finding "foothold evidenced" or "foothold not evidenced", quoting the evidence line that decides it.

## 4. Choose Evict countermeasures

For each evidenced finding, match the Evict ids to the form of the foothold: process, D3-PE or D3-PT, with D3-PS when the process must be held for analysis; session, D3-ST; host, D3-HS or D3-HR, only with operator approval; file, D3-FEV; mail, D3-ER; domain, D3-DRT. Prefer the narrowest eviction that removes the foothold. A host reboot is the broadest option and is a last resort.

## 5. Verify the eviction

For each recommendation, write the proof: the state after eviction, such as the process absent from a fresh listing, the session refused on reconnect, or the file absent on a re-scan. "Command returned OK" is not proof. If the gap's `coveredCountermeasures` holds no detection for the foothold, an evicted foothold may return unseen. Record that as a finding.

## 6. Completion summary

Close with: scope and mission id; the foothold table (finding, evidenced or not, quoted line); the eviction recommendations, each with Evict id, label, owner, and proof; the note that this seat performs no eviction; the report pointer (`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this eviction plan is parked under its mission id and resumes when the backend answers.

Never present a recommended eviction as performed. The seat never opens a browser panel; every step goes through the MCP tools or the loopback HTTP API.
