---
name: black-low-noise-recon
description: Use when the operator types /black-low-noise-recon with a recon scope: plans passive-first surface mapping and bounds every active probe.
---
# Black low-noise recon

Passive-first reconnaissance planning. Every third-party query is logged as a
correlation point, and every active probe is bounded before it is run.

Shared grammar (quoting, `<target>`/`<scope>`/`<mission-id>`, fallback,
lifecycle, parked/resume): see `../GRAMMAR.md`.

## Doctrine

Low-noise recon follows the reconnaissance checklist in `opsecReview()` and
`opsecChecklist()` in `src/teams/black/checklist.ts` (REC-01 to REC-04). The
reconnaissance tier is the cheapest in `structuredNoiseBudget()`, but
passive DNS and WHOIS are still residue. Unbounded scanner-shaped actions are
penalized by `noiseBudget()` in `src/teams/black.ts`.

## Grammar

```
/black-low-noise-recon "<recon scope or question>" [--target <host>] [--mission <mission-id>]
```

## 1. Acknowledge immediately

Reply at once with the mission id (quoted back, or a local
`recon-<date>-<n>` label while waiting), the parsed scope, and the target.
The operator must see the ack before any backend call resolves.

## 2. Dispatch the review

Read the reconnaissance-phase review and the noise ledger over the latest
red plan draft:

- Cover review: `tempest_black_cover`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/cover`. Read the
  `reconnaissance` phase: `matchedTechniques` and its checklist (REC-01 to
  REC-04).
- Noise ledger: `tempest_black_noise`, or
  `curl -s http://127.0.0.1:3333/api/teams/black/noise`. Read each entry's
  `matches`, `cost`, and `rationale`, and the `violations` array.

Off loopback, every curl needs
`-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"` (or
`T3MP3ST_BEARER_TOKEN_FILE`); loopback needs no token.

Classify each planned recon action as one of:

- Passive: subfinder, amass, waybackurls, or a WHOIS or passive DNS lookup.
  Record the third party it touches. Maps to T1596.* in `ATTACK_BY_ID`.
- Fingerprint: wafw00f, whatweb, or httpx for one request per host. Maps to
  T1592.
- Bounded active: nmap, naabu, or nuclei with a named port list, a rate, or a
  count. Maps to T1595.001 to T1595.003.
- Unbounded: a scanner with no bound. Refuse it and rewrite it with a bound.

Relay the backend's `matches`, `cost`, and `rationale` exactly. Never change a
technique id. Never score an action the backend did not match. An unmatched
action is reported as unmatched, not as safe. An empty `phases` array means no
active red plan; say so.

Relay short progress updates quoting the mission id.

## 3. Completion summary

Close with: scope, mission id, the passive sources queried (third parties
named), the fingerprint notes, each bounded active step with its bound and
cost, the total against budget with its `within` and `tier` standing, any
unbounded actions refused, and the report pointer (`/tempest-report <mission
id>`). If the backend is unreachable, say so in one line:

> t3mp3st backend unreachable — start it with npm run server; this recon plan
> is parked under its mission id and resumes when the backend answers.

Never present guesses as results. The seat never opens a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
