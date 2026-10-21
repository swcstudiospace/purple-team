# 35-01 Summary: GitHub Integration and Repo-URL Purple Team

**Phase:** 35 · **Refs:** SPE-15994, SPE-15992 · **Completed:** 2026-10-21 · **Branch:** v1.7-github-claude-agentpanel

## Shipped (commits 2c2feb5, d689796, c7b9ae4, plus the working tree)

- Shared validator `src/recon/repo-url.ts`: 12 faults, canonical `owner/repo@ref[/subpath]`.
- Fetch adapter `src/recon/github-ingest.ts`: codeload tarball when anonymous, api.github.com tarball when authed, redirect allowlist, tar-stream extraction, skip engine, caps, cancel, and the `RepoIngestError` taxonomy.
- Whitebox seam: `ingestFiles` and `ingestFetchedFilesToSourceContext`. Repo URL on both mission start branches. `/api/mission/stop` cancels in-flight ingests. `purple-run` on `/api/events`. `/hunt` takes a `repoUrl` argument. Run card shows errorCode guidance.

## Closed in this pass (from the phase audit)

1. **One URL parser.** `parseGitHubRepoUrl` in `src/github/api.ts` now delegates to `parseRepoTarget`. The resolve route shows the exact fault message; it previously returned a generic 400.
2. **Percent-decoding** of owner, repo, ref and subpath. Malformed escapes fail with `bad-path-shape`. An encoded `..%2F` can no longer hide traversal. Control characters are rejected in a decoded subpath.
3. **One overall ingest timeout** across branch-candidate fallbacks, instead of one per attempt, in `github-ingest.ts`. Covered by a deterministic fake-timer test.
4. **errorCode guidance** on the run card for all eight codes, plus additive client types for `whitebox`, `cancelledIngest` and `RepoIngestErrorCode`.

## Live ingest evidence (anonymous, public repos, 2026-10-21)

| Case | Result |
|---|---|
| `expressjs/express`, whole repo | ok: 50 selected, 164 skipped (dir-fragment 112, ext-not-analyzable 52) |
| `expressjs/express/tree/HEAD/lib` | ok: 6 files, all inside `lib/` |
| Repo that does not exist | `not_connected` (HTTP 402), token-free message |
| 20000-byte download cap | `oversized` (HTTP 413), naming the cap, the observed size and the first file |
| Cancel at 150 ms | `cancelled` (HTTP 499) after 0 files |

## Deliberate deviations (decided, not silent)

- **Skip order keeps lockfile before extension.** The spec order would make the lockfile reason nearly unreachable, because lockfiles are non-analyzable extensions that the extension rule catches first.
- **`purple-run` payload is the flat event** (`fetching`, `analyzing`, `completed`, `failed`, `cancelled`), projected in the UI, not a one-to-one `PurpleRunData` object. Run-card states are ingesting, done, error and cancelled.
- **`redirect-blocked` is reported as `network`** with a message naming the refused host. There is no separate code.
- **Route tests** in `mission-repo-url-routes.test.ts` are source-text pins. They are weak and should be replaced with HTTP-level tests.
- **No automated test** covers the `purple-run` UI subscription. This repo's policy keeps source-text tests out of the suite.
- **Snippet input remains** in the legacy `docs/index.html` (hero textarea and coverage-stage form). The SPA has none.

## Open

- **D2 gate, mission level:** a public URL run through to a mission and report, with saved artifacts. Not run here; it needs a model provider.
- **Live checks not run:** SSE drop and reconnect fallback, private repo with a connected token, rate-limit window, and a real repo above 64 MiB.
- **Decision (user):** remove the legacy snippet inputs now, or after the mission-level run.
