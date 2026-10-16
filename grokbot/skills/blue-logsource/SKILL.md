---
name: blue-logsource
description: >-
  Use when the operator types /blue-logsource with findings: flags Sigma rules still on the placeholder logsource and states that the rule endpoint cannot retarget them.
---
# Blue logsource

Flags every Sigma rule still carrying the generator's placeholder logsource, and records the gap that stops this seat from retargeting it: the rule endpoint accepts no logsource option.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback, lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

A rule's logsource is its claim about which telemetry it reads. A placeholder is no claim, and a rule on a placeholder must not be deployed as if it read a real source.

## Grammar

```
/blue-logsource "<finding ids or scope>" [--mission <mission-id>]
```

## Module

Relies on `sigmaRuleForGap()` in `src/teams/blue/rulepacks.ts`. Its `options.logsource` replaces the default wholesale. Without it, the default is `category: process_creation` with a definition reading "Template default — retarget to the telemetry source implementing the cited countermeasures."

The backend route `/api/teams/blue/rules` in `src/server.ts` calls `sigmaRulepack(findings, coverageGaps(findings, registryTelemetry()))` with no options. So over HTTP every rule carries the default logsource. No current route accepts a logsource, and this skill does not invent one.

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local `logsource-<date>-<n>` label while waiting) and the parsed findings scope.

## 2. Dispatch the read

Pull the rule pack with `tempest_blue_rules` or `curl -s http://127.0.0.1:3333/api/teams/blue/rules`. Pull findings with `tempest_findings` when a finding's telemetry must be named. Off loopback, add `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or use `T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Relay short progress updates quoting the mission id.

## 3. Classify each logsource

Placeholder: `definition` contains the "Template default" text, so the rule is unretargeted. Retargeted: a source the operator named, with a non-template definition. That cannot come from the current HTTP route; if it appears, report it as an unexpected shape and quote it. Every rule the route produced today is unretargeted. Say that in one line rather than listing each row as a surprise.

## 4. Name the source to retarget to

For each placeholder rule, name the telemetry source the blue team should bind to. Take it from the finding's countermeasures and the registry entry in `src/teams/blue/telemetry.ts` that credits them. Use a slug only when the registry is readable or the operator supplies it. Otherwise write "source not named". Never write a logsource category the registry does not support.

## 5. Capability gap

Report once, plainly: over HTTP, `/api/teams/blue/rules` cannot receive a logsource option. Retargeting therefore happens outside the route, in rule-pack author review, or it is not yet implemented. Until then, no rule from this pack is deployable. Describe the retargeting path as not yet implemented in the backend, never as existing.

## 6. Completion summary

Close with: scope and mission id; the count of placeholder and retargeted rules; the source-named list for each placeholder rule, or "source not named"; the capability-gap line; the report pointer (`/tempest-report <mission id>`).

If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this logsource review is parked under its mission id and resumes when the backend answers.

Never present a placeholder rule as retargeted. The seat never opens a browser panel; every step goes through the MCP tools or the loopback HTTP API.
