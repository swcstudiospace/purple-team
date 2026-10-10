# Phase 13: Remote-Access Hardening - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/security phase — smart-discuss skip per autonomous workflow)

<domain>
## Phase Boundary

Non-loopback bot hosting (T3MP3ST_HOST set to a non-loopback address) is
guarded by bearer auth and bot rate limits. Loopback operation — the default
and the Tauri sidecar path — stays byte-for-byte unchanged.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Constraints from repository evidence (src/server.ts ~lines 161-300):

- Existing posture to build ON, not replace: `HOST = T3MP3ST_HOST ||
  (DOCKER==='true' ? '0.0.0.0' : '127.0.0.1')`; `HOST_IS_LOOPBACK` already
  gates the Host-header allow-list, the loopback-only origin gate, and the
  same-origin trust added for non-loopback binds (#84). The bearer middleware
  composes with these — it adds auth, it does not relax anything.
- **Bearer middleware:** active only when `!HOST_IS_LOOPBACK`. Requires
  `Authorization: Bearer <token>` on `/api/*`; static `/ui` + `/` stay open
  (the UI is how the operator authenticates into the API — the pages call
  /api with the token once configured; keep the 401 JSON shape consistent
  with existing error responses).
- **Token delivery:** `T3MP3ST_BEARER_TOKEN` env only; never logged, never
  committed. Fail-closed: a non-loopback bind WITHOUT a token refuses to
  start with a clear error naming the env var (this intentionally breaks
  unauthenticated DOCKER=0.0.0.0 exposure — that is the vulnerability being
  closed; record in CHANGELOG).
- **Rate limits:** per-IP token bucket on `/api/*` when `!HOST_IS_LOOPBACK`
  (e.g., sustained 60/min, burst 120; 429 with Retry-After). In-memory,
  deterministic, no new dependencies. Loopback bind: no bucket at all.
- **grokbot/README.md** + `rosters/redteam.json` note updated: non-loopback
  gateway hosting requires the bearer token (curl examples gain
  `-H "Authorization: Bearer $T3MP3ST_BEARER_TOKEN"`; MCP connector note).

</decisions>

<code_context>
## Existing Code Insights

- Middleware chain order in src/server.ts: CORS → origin gate → Host guard →
  routes. The bearer + rate-limit middleware slots after the origin gate,
  before routes, self-gated on `!HOST_IS_LOOPBACK`.
- Existing server tests (src/__tests__/*server*/oauth routes) show the test
  conventions — follow them; pin: 401 without/with-wrong token on a
  non-loopback-bound app instance, 200 with token, loopback app unchanged
  (no auth, no 429 under the same burst), deterministic 429 at the limit.

</code_context>

<specifics>
## Specific Ideas

- Implement + test + grokbot docs in one unit; CHANGELOG entry for the
  fail-closed behavior change.

</specifics>

<deferred>
## Deferred Ideas

- Persistent/rotating tokens, per-seat tokens: follow-up if ever needed.

</deferred>
