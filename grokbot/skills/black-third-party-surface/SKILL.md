---
name: black-third-party-surface
description: Use when the operator types /black-third-party-surface with a plan that touches cloud storage, web services, code repos, or cloud accounts: reviews the external logs each surface burns.
---
# Black third-party surface

Review of exfil and staging paths that run through a third-party service. Cloud
storage, web services, code-repository pushes, and cloud-account sharing all
leave logs the operator does not control. This skill names those logs before
any such path is planned.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Third-party review follows checklist item EXF-02 in `src/teams/black/checklist.ts`:
declare third-party surfaces, because cloud storage, web services, and repo
pushes burn external logs. The vocabulary in `src/teams/black/noise.ts` maps
cloud-account sharing and rclone to T1537; web-service upload to T1567; code
repository push to T1567.001; cloud-storage put (s3 cp, gsutil, Azure blob or
storage, cloud-storage upload) to T1567.002. The cost table in
`src/teams/black/exfil.ts` prices the channels: `web-service-upload` (base 2),
`cloud-storage-put` (base 3), `code-repo-push` (base 3), and
`cloud-account-sync` (base 4).

## Grammar

```
/black-third-party-surface "<plan touching external services or scope>" [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`surface-<date>-<n>` label while waiting) and the parsed scope. The operator
must see the ack before any backend call resolves.

## 2. Dispatch the review

Read the exfiltration phase and the noise ledger over the latest red plan draft:

- Phase review: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Read the
  `exfiltration` phase: `matchedTechniques` and checklist item EXF-02.
- Noise ledger: `tempest_black_noise`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/noise`. Read the entries whose
  `matches` include T1537, T1567, T1567.001, or T1567.002, with their `rationale`.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

The cost route stores no paths today, so the channel costs for these services
are not computed by the backend. Say so. If the operator wants a channel priced,
the cost table values above are the only figures the report may quote, and they
are base costs, not totals.

For each third-party surface the plan names:

1. Name the provider and the log it produces: an upload or access record at the
   provider, a repository push event, a share or link-creation event, or an
   account activity record.
2. Name what the operator cannot control: retention, the provider's own alerting,
   and the provider's audit access.
3. Mark whether the surface is on the declared route, using the same route
   language as the stealth router. The backend cannot confirm this.
4. Flag it for approval if the mission contract does not name the provider.
   Name the receipt that would authorize it.

Relay the backend's matches and checklist text verbatim. Never add a provider
the plan did not name. Never call a third-party path quiet because the provider
is popular.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, each third-party surface with its provider, the
external log it produces, what the operator cannot control, the route status,
the EXF-02 item and any T1537 or T1567 matches verbatim, the zero-path note from
the cost route, and the report pointer (`/tempest-report <mission id>`). If the
backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this surface
> review is parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
