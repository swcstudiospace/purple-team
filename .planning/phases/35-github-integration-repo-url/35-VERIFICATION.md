---
status: passed_with_open_validation
phase: 35-github-integration-repo-url
verified: 2026-10-21
suite_observed: vitest src/__tests__ 127 files and 1553 tests passed; ui:typecheck clean; ui:build clean; doctor exit 0; verify-claims 27 of 27; live ingest checks (5 cases) as recorded in 35-01-SUMMARY
---

# Phase 35 Verification: GitHub Integration and Repo-URL Purple Team

## Requirement audit (35-CONTEXT sections 2 to 9, against the current tree)

| ID | Requirement | Status | Note |
|---|---|---|---|
| R1 | Validator: 12 faults, canonical form | PRESENT | `src/recon/repo-url.ts` |
| R2 | Validator rules | PRESENT | Length is checked before credentials; that follows the spec's rule numbering and does not echo the credential. Percent-decoding added this pass. |
| R3 | One validator for UI and server | PRESENT | Second parser removed this pass; `parseGitHubRepoUrl` delegates |
| R4 | `ingestFiles` seam and shared constants | PRESENT | `src/recon/code-ingest.ts` |
| R5 | `ingestFetchedFilesToSourceContext` | PRESENT | Local clone path kept for legacy `/api/whitebox` routes |
| R6 | Anonymous codeload vs authed tarball; token order | PRESENT | `src/recon/github-ingest.ts` |
| R7 | Redirect allowlist, 5 hops, Bearer only to api.github.com | PRESENT | Blocked hosts surface as `network` |
| R8 | Four caps with env knobs and `.env.example` entries | PRESENT | |
| R9 | Ordered skip engine with visible summary | PRESENT with deviation | Lockfile-before-extension, kept deliberately (see SUMMARY) |
| R10 | Eight error codes with HTTP mapping | PRESENT | Anonymous 404 gives `not_connected`, per the test plan |
| R11 | One controller and timer per ingest | PRESENT (fixed this pass) | Was one per attempt |
| R12 | `purple-run` on /api/events, throttled | PRESENT with deviation | Flat payload projected in the UI |
| R13 | repoUrl on both start branches; 400 on conflict | PRESENT | |
| R14 | Stop cancels an in-flight ingest; `cancelledIngest` | PRESENT | |
| R15 | `whitebox` in mission status | PRESENT | Client types added this pass |
| R16 | `/hunt` `repoUrl` argument | PRESENT | |
| R17 | UI subscription and errorCode guidance | PRESENT (fixed this pass) | |
| R18 | Snippet removal (D2) | PARTIAL | SPA has none; legacy `docs/index.html` still has it |
| R19 | Tests | PARTIAL | Validator, ingest, parity and route tests exist. Route tests are source pins; no purple-run UI test. |
| R20 | Live E2E evidence | PARTIAL | Ingest level evidenced; mission level not |

## Open

- D2 snippet removal waits on the mission-level run (user decision).
- Live checks: SSE drop and reconnect, private repo with a connected token, rate-limit window, repo above 64 MiB.
