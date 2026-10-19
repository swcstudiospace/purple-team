# 35 · RESEARCH — GitHub Integration Section (connect, list, resolve, select)

**Node:** n4 · **Linear:** https://linear.app/swcstudio/issue/SPE-15994/n4-design-github-integration-section
**Date:** 2026-10-19 · **Branch:** `v1.7-github-claude-agentpanel`
**Scope of this doc:** the GitHub *section* only — OAuth connection (env-gated user-owned OAuth App), account status, repository listing, URL resolve, and the `selectedRepo` handoff seam. Remote-repo **ingest** into the Purple Team run (fetch → `src/recon/whitebox.ts`) is owned by the sibling node's section; this doc defines only the selection contract it consumes.

**Locked decisions feeding this design** (`.planning/v1.7-SURVEY.md:6`): q1 borrow-public-clients → env-gated registration, anonymous public-repo fallback until configured; q3 private repos ship NOW → `repo` scope when connected.

---

## 1. Current-state audit (evidence)

### 1.1 Zero GitHub code in the app

- The only GitHub-aware code in the repo is secret **redaction**: `src/redact.ts:13-14` defines `github_token` (`ghp_…`) and `github_oauth` (`gho_…`) patterns. These are duplicated client-side at `ui/src/components/AgentPanel.tsx:83` and `ui/src/genui/GenUiPanel.tsx:13` (`gh[pousr]_…` — note this wider client pattern already covers the `ghr_` refresh-token prefix; the server patterns at `src/redact.ts:13-14` do **not**, see §8 Risks).
- `.env.example:31` carries `GITHUB_TOKEN=` under the header "GitHub (xbow-bench challenge fetch / gh operations)" (`.env.example:30`) — used only by bench scripts, not the app server.
- No `api.github.com` calls anywhere in `src/` or `ui/src/` (grep confirms; the survey states the same at `.planning/v1.7-SURVEY.md:27`).
- **Consequence:** there is no existing GitHub client, store, or route to extend. Everything below is new code following the OAuth pattern that already exists.

### 1.2 The OAuth pattern to follow (server + module)

- Server routes: `src/server.ts:6566-6628` — `GET /api/oauth/status`, `POST /api/oauth/xai/start|poll|logout`, `POST /api/oauth/openai/start|complete|logout`. Convention: tokens never leave the server (`src/server.ts:6566` comment "Tokens never leave the server"), error bodies are `{ error: string }` only, success bodies return the *status projection* (`oauthStatus()`), not tokens. Logout clears then re-inits LLM (`src/server.ts:6594-6598`).
- Module: `src/llm/oauth.ts` (564 ln). Key conventions to mirror:
  - Pending-flow maps in memory, 15-min TTL (`FLOW_TTL_MS`, `src/llm/oauth.ts:87`, maps at `:106-107`).
  - JSON token store at `~/.t3mp3st/oauth.json`, env-overridable `T3MP3ST_OAUTH_STORE` (`oauthStorePath()`, `src/llm/oauth.ts:129-133`), written mode `0600` with best-effort chmod (`saveStore`, `src/llm/oauth.ts:193-199`).
  - PKCE S256 + base64url helpers already exist as a local pattern (`base64url`, `randomId`, `src/llm/oauth.ts:169-175`); pasted-callback parsing accepts raw code / `code#state` / full callback URL (`parseOpenAiAuthCode`, `src/llm/oauth.ts:429-444`).
  - Refresh-on-demand with 120 s skew (`REFRESH_SKEW_MS`, `src/llm/oauth.ts:86`; `ensureOAuthAccessToken`, `:537-558`).
  - HTTPS/allowlist pinning of OAuth endpoints (`assertHttpsHost`, `src/llm/oauth.ts:151-167`).
  - Test hooks: injected fetch + clock override + state reset (`setOAuthFetch`/`__setOAuthNow`/`__resetOAuthState`, `src/llm/oauth.ts:113-127`).
- Status shape precedent: `OAuthStatus = { connected, expiresAt?, label }` (`src/llm/oauth.ts:33-37`, `oauthStatus()` `:220-235`); SPA mirror type at `ui/src/api/client.ts:87-94`.
- Server bind config (redirect-URI derivation): `PORT = process.env.T3MP3ST_PORT || 3333` (`src/server.ts:191`), `HOST` defaults loopback / `DOCKER=true` → `0.0.0.0` (`src/server.ts:200`), `app.listen(Number(PORT), HOST, …)` (`src/server.ts:9364`). This resolves survey unknown #3 (`.planning/v1.7-SURVEY.md:55`) — see §4.3.
- Origin/CSRF guards (callback-route feasibility): the cross-origin CSRF guard applies **only to state-changing methods** (`if (!STATE_CHANGING_METHODS.has(req.method)) return next();`, `src/server.ts:303`), so a browser top-level GET redirect from `github.com` is not blocked; the anti-rebinding Host guard accepts loopback hosts on every method (`src/server.ts:321-325`, `isLoopbackHostname` `:224-226`); the CORS lock (`src/server.ts:280-287`) does not affect top-level navigations. A loopback `127.0.0.1:<port>` redirect callback is therefore reachable.

### 1.3 Mission start / whitebox seam (handoff target, not this section's build)

- `POST /api/mission/start` accepts `repoPath` — an absolute **local** path only, fed to `setWhiteboxSource` (`src/server.ts:7398-7403`), plus `inlineArtifacts` pasted snippets (`src/server.ts:7435-7441`). There is no remote-repo input today (survey `.planning/v1.7-SURVEY.md:28`).
- Whitebox ingest seam: `src/recon/whitebox.ts:1-63` — local-repo ingest + security-rank + pack (`RepoSourceContext`, `:61-70`). Remote fetch landing here is the sibling section's design.
- **Contract this section exposes:** `{ owner: string, repo: string, ref: string, visibility: 'public'|'private'|'internal' }` (§5.5).

### 1.4 UI current state

- SPA nav is a fixed list: `NAV_ITEMS` `overview | agent-panel | generative-ui | reports` (`ui/src/App.tsx:9-14`) plus static links to `/ui/hats.html`, `/ui/settings.html` (`ui/src/App.tsx:18-21`); sections render via `{active === 'x' && <X/>}` (`ui/src/App.tsx:79-82`); hash is the routing source of truth (`ui/src/App.tsx:23-43`).
- **No OAuth login UI exists in the SPA.** The live login flows live in the legacy static console (`docs/settings.html:240` posts `/api/oauth/openai/start`; same handlers duplicated in `docs/index.html:454`, `docs/overview.html:454`). The SPA's Overview only *reads* `/api/oauth/status` for the "Subscriptions" card (`ui/src/pages/Overview.tsx:213-236`, typed via `ui/src/api/client.ts:87-94`).
- SPA data-fetch convention: `getJson<T>()` + `ApiError` (`ui/src/api/client.ts:14-31`), per-card `useResource` loading/empty/error triad (`ui/src/pages/Overview.tsx:16-55`), card state chrome `.overview-card__empty` / `.overview-card__error` / `.overview-skeleton__*` / `.overview-badge--on|off` (`ui/src/pages/overview.css:59-127,181-199`). Overview is the approved reference and is **not to be modified** (survey `.planning/v1.7-SURVEY.md:38`) — the GitHub page reuses the *pattern*, with its own `github.css`.
- Design tokens: canonical `docs/assets/tokens.css` `:root` block (lines 65-134; comment at `:1-6` names it "the single source of truth"), mirrored in the SPA at `ui/src/styles.css:52-66` (`--brand`, `--surface`, `--border`, fonts). New UI consumes `var(--*)` only — no literal colors (per the token rule, `docs/assets/tokens.css:2-5`).
- `zustand ^4.5.7` is already a dependency of the SPA and currently unused (survey `.planning/v1.7-SURVEY.md:11`) — available for the shared `selectedRepo` store.
- No URL-target input exists anywhere in the SPA (survey `.planning/v1.7-SURVEY.md:31`; grep for `repoPath|inlineArtifacts|mission/start` in `ui/src` is empty).

---

## 2. Provider research (facts cited; OPEN items in §10)

### 2.1 OAuth App vs GitHub App → **OAuth App**

Chosen: **OAuth App** (env-gated, user-registered). Rationale:

- GitHub generally recommends GitHub Apps for fine-grained permissions and repo-scoped installation ([docs: differences](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)), but that model is built around **installation ceremony, webhooks, bot identity, and per-installation access**. Our use case is a single-operator local tool acting **as the signed-in user** over *whatever repos that user can see* — exactly the OAuth App shape ("Only on behalf of a user", "You don't install it or control which repositories it can access").
- A GitHub App's user-access-token sees only the intersection of app permissions × user access × **repos where the app is installed** — for an operator's ad-hoc personal/org repos that means constant install friction. OAuth App lists everything the user's token grants in one shot (`GET /user/repos`).
- q1 locked "borrow public clients / env-gated registration": GitHub has **no borrowable public OAuth client** the way Anthropic/ChatGPT ship CLI clients — an OAuth App registration is 30 seconds of user effort and has no approval gate. Env-gated user-owned OAuth App + anonymous fallback until registered is the locked shape (survey `.planning/v1.7-SURVEY.md:54`).
- Tradeoff accepted and documented in §2.2: OAuth App scopes are coarse (no read-only repo scope).

### 2.2 Scopes → `repo read:user` (with an explicit, surfaced tradeoff)

- **No read-only private-repo scope exists for OAuth Apps.** `repo` "Grants full access to public, internal, and private repositories including read and write access to code…" and additionally grants manage-level access to some org resources ([docs: scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)); GitHub community staff confirm read-only private access is deliberately unavailable for OAuth scopes ([community #7891](https://github.com/orgs/community/discussions/7891); still true Sept 2025, [community #174347](https://github.com/orgs/community/discussions/174347)). The read-only alternative is a GitHub App or fine-grained PAT — both rejected in §2.1 / not OAuth.
- q3 locked **private repos ship NOW**, so when connected we request **`repo`**. The UI must state the honest cost ("grants read **and write** to all repositories you can access") next to the Connect button; mitigations in §8.
- **`read:user`** — read-only profile scope ([docs: scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)). `GET /user` returns `login`/`avatar_url` even without it, but the private profile response needs `read:user` ([docs: users](https://docs.github.com/en/enterprise-server@3.21/rest/users/users)); cheap and non-sensitive — include it.
- Not requested: `workflow`, `read:org`, `user:email` (not needed; `repo` already covers org repo listing through membership — see §6 of [docs: scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)).
- Anonymous (unconnected) mode needs **no scope at all**: no-scope requests get read-only public info ([docs: scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)).

### 2.3 PKCE → **supported today; spec it (S256) alongside client_secret**

- GitHub shipped PKCE for the OAuth/GitHub App **authorization-code (web application) flow on 2025-07-14**; recommended but not required; **only `S256`** is supported (`code_challenge_method` must be `S256`, plain is rejected; `code_challenge` must be the 43-char SHA-256 hash; `code_verifier` sent at token exchange) ([GitHub changelog 2025-07-14](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/), [docs: authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)).
- GitHub "does not distinguish between public and confidential clients" ([changelog](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/)) — our app has a secret, so the token exchange sends **both** `client_secret` and `code_verifier`. Confidential-client + PKCE is belt-and-braces and costs nothing.
- Keep **`state`** regardless (CSRF) — still "strongly recommended" by the docs ([authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)).
- GHES caveat: GHES did not have PKCE yet as of 3.21 ([GHES 3.21 docs](https://docs.github.com/en/enterprise-server@3.21/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)); out of scope — we target github.com only.

### 2.4 Endpoints

| Purpose | Call |
|---|---|
| Authorize | `GET https://github.com/login/oauth/authorize?client_id&redirect_uri&scope=repo%20read:user&state&code_challenge&code_challenge_method=S256` ([docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)) |
| Token exchange | `POST https://github.com/login/oauth/access_token` with `Accept: application/json`, body `client_id, client_secret, code, redirect_uri, code_verifier` ([docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)) |
| Refresh | same URL with `grant_type=refresh_token&refresh_token…` — returns a **new pair, both rotate** ([docs: refreshing user access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)) |
| Identity | `GET https://api.github.com/user` → `login`, `avatar_url` top-level; `read:user` for the private response ([docs: users](https://docs.github.com/en/enterprise-server@3.21/rest/users/users)) |
| List repos | `GET https://api.github.com/user/repos` — **requires authentication**; params `visibility=all|public|private`, `affiliation=owner,collaborator,organization_member` (default = all three), `sort=created|updated|pushed|full_name`, `direction`, `per_page` (max 100, default 30), `page`; `type` is mutually exclusive with `visibility`/`affiliation` (422 if combined); paginate via `Link: rel="next"` ([docs: repos](https://docs.github.com/en/rest/repos/repos)) |
| Resolve | `GET https://api.github.com/repos/{owner}/{repo}` → top-level `full_name`, `private` (bool), `visibility` (`public|private|internal`), `default_branch`, `clone_url`; works unauthenticated for public repos; **a private repo you can't access returns 404** (not 403) ([docs: repos](https://docs.github.com/en/enterprise-server@3.20/rest/repos/repos)); renamed/transferred repos 301-redirect — follow redirects |
| Revoke one token | `DELETE https://api.github.com/applications/{client_id}/token`, Basic auth `client_id:client_secret`, JSON body `{ "access_token" }` ([docs: OAuth authorizations](https://docs.github.com/en/enterprise-server@3.5/rest/apps/oauth-applications)) |
| Revoke whole grant | `DELETE https://api.github.com/applications/{client_id}/grant`, same auth — deletes **all** the app's tokens for that user and removes the app from their authorized-applications settings; 204 success, 422 on spam/validation ([docs: OAuth authorizations](https://docs.github.com/en/enterprise-server@3.5/rest/apps/oauth-applications)) |
| Token reset (rotate) | `PATCH https://api.github.com/applications/{client_id}/token` — **resets**, returns a new token; invalid token → 404 ([docs: OAuth authorizations](https://docs.github.com/en/enterprise-server@3.5/rest/apps/oauth-applications)) |

> **Correction to the task brief:** `PATCH /applications/{id}/token` does **not** revoke — it *resets* the token and returns a new one. Revocation is `DELETE …/token` (one token) or `DELETE …/grant` (whole authorization). We use **DELETE grant** for disconnect (it also unpins the app from the user's GitHub settings page), with local store cleared unconditionally (§4.6). All three endpoints require Basic auth with the app's client_id/client_secret — a Bearer user token is not accepted ([docs](https://docs.github.com/en/enterprise-server@3.5/rest/apps/oauth-applications)).

### 2.5 Token lifetime → **short-lived by default since 2026-08-14: refresh is mandatory**

This is the biggest recent change and it directly shapes the design:

- Since **2026-08-14**, OAuth apps support **expiring user tokens**: access token **8 h** (`expires_in` 28800) + refresh token **6 mo** (`ghr_…`, `refresh_token_expires_in` 15897600). **On by default for apps created after that date**; existing apps opt in per-app or per-request via the `offline_access` scope ([GitHub changelog, Aug 2026](https://github.blog/changelog/) — opt-in/defaults per the refreshed docs and community issue below; [refreshing user access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)). Requesting `offline_access` forces the expiring pattern even when the app setting is off ([docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)).
- Refresh tokens **rotate on every use** — the old access token *and* old refresh token both stop working; integrations that store only the access token die after 8 h (real-world breakage documented in [cloudflare-os #641](https://github.com/cloudflare/cloudflare-os/issues/641), filed ~Oct 2026).
- Consequences for us: (a) persist `accessToken + refreshToken + expiresAt + refreshTokenExpiresAt` **atomically**; (b) serialize concurrent refreshes (single-flight, like `ensureOAuthAccessToken` `src/llm/oauth.ts:537-558`); (c) status surfaces expiry; (d) **`ghr_` must be redacted server-side** — see §8.

### 2.6 Rate limits

- Primary: **5,000 req/h authenticated** (user token), **60 req/h unauthenticated** per IP. Headers on every response: `x-ratelimit-limit/remaining/used/reset/resource`; `x-ratelimit-reset` is a **UTC epoch timestamp** (not a delta) ([docs: rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).
- Exceeding either limit returns **403 or 429** — the status code alone doesn't say which. Retry order per the docs: (1) honor `Retry-After` if present (secondary/abuse limit); (2) if `x-ratelimit-remaining: 0`, wait until `x-ratelimit-reset`; (3) otherwise wait ≥ 60 s; (4) exponential backoff, bounded retries ([docs: rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).
- Secondary limits are undocumented-but-real (≤100 concurrent, ≤900 REST points/min, CPU-time rule); no status endpoint for them; `GET /rate_limit` is free against the primary limit ([docs: rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).
- A **403 without** `Retry-After`, without `x-ratelimit-remaining: 0`, and without a rate-limit message is a **permission** problem, not a rate limit (e.g. org OAuth-App restrictions) — classify separately ([docs: rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).

---

## 3. Design overview

```
Browser SPA (GitHub section)                Express server (src/server.ts)        GitHub
 ┌──────────────────────────┐               ┌──────────────────────────────┐
 │ Account card ────────────┼─GET status───▶│ /api/oauth/github/status      │◀─ GET /user (cached at connect)
 │ Connect btn ─────────────┼─GET start ───▶│ /api/oauth/github/start       │   (only at connect + refresh)
 │   window.open(authorizeUrl)              │  state+PKCE pending (15 min) │
 │  ◀── browser redirect ───────────────────│ /api/oauth/github/callback   │◀─ authorize redirect ?code&state
 │ paste fallback ──────────┼─POST complete▶│  (or /complete {code,state}) │── token+verifier exchange ─▶ access_token
 │ Disconnect ──────────────┼─POST logout ─▶│ /api/oauth/github/logout     │── DELETE /applications/:id/grant
 │ Repo list ───────────────┼─GET repos ───▶│ /api/github/repositories      │◀─ GET /user/repos (tokened)
 │ URL resolve ─────────────┼─GET resolve ─▶│ /api/github/resolve?url=      │◀─ GET /repos/{owner}/{repo}
 │ selectedRepo (zustand) ◀─┼───────────────│  {owner,repo,ref,visibility} │   (tokened | anonymous)
 └──────────────────────────┘               └──────────────────────────────┘
```

New module `src/github/` (peer of `src/recon/`, `src/teams/` — GitHub is not an LLM, so it does **not** live in `src/llm/`):
- `src/github/oauth.ts` — flow lifecycle, token store, status, refresh, disconnect. Mirrors `src/llm/oauth.ts` structure (in-memory pending map + TTL, JSON store 0600, `setGitHubFetch`/`__setGitHubNow`/`__resetGitHubState` test hooks, allowlist `github.com` / `api.github.com` via an `assertHttpsHost` copy).
- `src/github/api.ts` — typed REST client (`getUser`, `listRepos`, `getRepo`) + **error classifier** (§4.8) shared by routes and the ingest section later.
- Routes mounted in `src/server.ts` directly after the existing OAuth block (`src/server.ts:6566-6628`), same style.

Tokens: separate store file `~/.t3mp3st/github-oauth.json` (env override `T3MP3ST_GITHUB_OAUTH_STORE`), same `0600` write as `src/llm/oauth.ts:193-199`. Kept out of `oauth.json` because its schema is keyed by the `OAuthVendor` union (`src/llm/oauth.ts:19`) which belongs to the LLM layer; GitHub has a different lifecycle (no `initLLM()` re-init on change).

---

## 4. Backend design

### 4.1 Environment keys (`.env.example` additions)

```bash
# ── GitHub OAuth App (optional; env-gated user-owned app) ──
# Register at github.com/settings/developers → OAuth Apps. Callback URL must
# EXACTLY match the redirectUri reported by GET /api/oauth/github/status.
# T3MP3ST_GITHUB_OAUTH_CLIENT_ID=
# T3MP3ST_GITHUB_OAUTH_CLIENT_SECRET=
# Override only when the server is bound non-loopback (T3MP3ST_HOST) or proxied:
# T3MP3ST_GITHUB_OAUTH_REDIRECT_URI=https://your-host/api/oauth/github/callback
```

`configured === client_id && client_secret both non-empty`. All three follow the existing `T3MP3ST_*` naming (`src/llm/oauth.ts:135-141` precedent). When not configured: **start/logout** answer `503 { error }`; **status/repositories/resolve** stay live in anonymous mode (§4.7).

### 4.2 `GET /api/oauth/github/start`

- 503 when not configured. Otherwise creates a pending flow `{ state, verifier, createdAt }` (in-memory map, 15-min TTL — `FLOW_TTL_MS` precedent `src/llm/oauth.ts:87`) and returns `{ authorizeUrl, state }`:
  - `authorizeUrl = https://github.com/login/oauth/authorize` + `client_id`, `redirect_uri` (§4.3), `scope=repo read:user` (space-encoded, [docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)), `state`, `code_challenge` (S256 of `verifier`, [changelog](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/)), `code_challenge_method=S256`.
- GET (not POST) matches the task contract; it is side-effect-light (pending-map insert) and the CSRF guard doesn't cover GETs anyway (`src/server.ts:303`) — the flow is protected by single-use `state` + PKCE, which is the correct defense for an authorize redirect.

### 4.3 Redirect URI — resolves survey unknown #3

Default: `` `http://127.0.0.1:${PORT}/api/oauth/github/callback` `` where `PORT` is the server's own resolved port (`src/server.ts:191`). When `T3MP3ST_HOST` is set non-loopback (opt-in network bind, `src/server.ts:200`), the loopback default is wrong — `T3MP3ST_GITHUB_OAUTH_REDIRECT_URI` overrides it verbatim (GitHub requires an **exact** string match against a registered callback URL, [authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)). `GET /api/oauth/github/status` returns the derived `redirectUri` so the UI can show "register exactly this URL". Recommend the operator register **both** `http://127.0.0.1:<port>/…` and `http://localhost:<port>/…` (GitHub allows multiple callback URLs) — see §10.

### 4.4 `GET /api/oauth/github/callback?code&state` (+ `error`)

**Primary completion path** — a real browser redirect, one click, no copy-paste.

- `error=access_denied` (user clicked Deny) → consume state, serve minimal HTML "Connection cancelled" page (consent-denied, §5.6).
- Validate `state`: must exist in the pending map and be unexpired → **delete it immediately (single-use)**; unknown/expired/missing → `400` HTML page "Sign-in link expired — try again".
- Exchange: `POST https://github.com/login/oauth/access_token` (`Accept: application/json`; `client_id`, `client_secret`, `code`, `redirect_uri`, `code_verifier`). On success also `GET /user` once → persist `{ accessToken, refreshToken?, expiresAt, refreshTokenExpiresAt?, tokenType, scopes, obtainedAt, profile: { login, avatarUrl } }` atomically.
- Serve a **tiny static HTML result page** (success: "✓ Connected as @handle — return to Purple Team", link `/#/github`; failure: classified message + retry link). No tokens, no JSON, in the page. Reaching this route via navigation is safe: GETs bypass the CSRF guard (`src/server.ts:303`) and `127.0.0.1` passes the Host guard (`src/server.ts:224-226,321-325`).
- The code exchange itself is the CSRF-proof step (state single-use + PKCE verifier bound to the same pending entry).

### 4.5 `POST /api/oauth/github/complete` — paste fallback (repo convention)

Same completion logic as §4.4 minus HTML: body `{ code, state? }`, accepting a raw code, `code#state`, or the whole pasted callback URL — exactly `parseOpenAiAuthCode`'s contract (`src/llm/oauth.ts:429-444`) for muscle-memory parity with the ChatGPT flow. POST = state-changing → covered by the origin guard (`src/server.ts:303-317`). Returns `{ ok: true, github: <status> }` (never tokens). **Justification for shipping both paths:** GitHub *requires* a registered exact-match callback URL anyway (unlike the OpenAI loopback trick, where nothing needs to listen), so the redirect lands for free; the paste path covers the operator whose browser blocks the loopback redirect (e.g. custom host misconfig) and preserves the repo's existing UX convention at ~30 lines.

### 4.6 `POST /api/oauth/github/logout`

Best-effort `DELETE https://api.github.com/applications/{client_id}/grant` (Basic `client_id:client_secret`, body `{ access_token }`) → then **unconditionally** clear the local store. Network failure / 401 / 404 from GitHub still returns `{ ok: true, github: status }` — local disconnection is the guarantee; remote revocation is opportunistic (same "clear first" spirit as `clearOAuth` `src/llm/oauth.ts:237-241`). No `initLLM()` re-init (GitHub is not an LLM backbone).

### 4.7 `GET /api/oauth/github/status`

```ts
{
  configured: boolean;          // env keys present
  connected: boolean;           // stored token exists
  redirectUri: string;          // derived (§4.3) — for registration copy-paste
  handle?: string;              // profile.login cached at connect
  avatarUrl?: string;           // profile.avatar_url (public URL; no token needed to render)
  scopes?: string[];            // scopes granted, from the token response
  expiresAt?: number;           // ms epoch (8 h default lifetime, §2.5)
  refreshTokenExpiresAt?: number; // ms epoch — session dies here if unused (6 mo)
  mode: 'connected' | 'anonymous'; // explicit fallback state for §4.9
}
```

No token fields — mirrors the "status has no secrets" invariant tested at `src/__tests__/oauth.test.ts:92` ("status has no secrets"). Connected-status computation is **pure local** (store read) — zero GitHub API calls, so the Overview-style card is free.

### 4.8 `GET /api/github/repositories` + `GET /api/github/resolve?url=` (the GitHub API proxy)

Both go through `src/github/api.ts`, which owns the shared **error classifier**:

| GitHub response | Classification | Our HTTP |
|---|---|---|
| ok | — | 200 |
| 401/403 with no `Retry-After`, `x-ratelimit-remaining ≠ 0`, non-rate-limit message (org OAuth restrictions, token revoked) | `auth-failed` → auto-refresh once, then `token-expired` | 401 `{ error, code: 'token-expired' }` |
| 403/429 **with** `Retry-After` | `rate-limited` (secondary) | 429 `{ error, code:'rate-limited', retryAt }` |
| 403/429 with `x-ratelimit-remaining: 0` | `rate-limited` (primary; wait `x-ratelimit-reset` epoch → `retryAt`) | 429 same |
| 404 | `repo-not-found` (connected) / `repo-not-found-or-private` (anonymous) — GitHub deliberately returns 404 for invisible private repos ([docs](https://docs.github.com/en/enterprise-server@3.20/rest/repos/repos)) | 404 `{ error, code }` |
| network / 5xx | `network-error` | 502 `{ error }` |

Classifier rules follow GitHub's documented retry precedence ([rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)). The proxy does **not** auto-retry; every user action = one upstream call (plus one refresh if 401), so we can't trip secondary limits ourselves. All proxied calls send `X-GitHub-Api-Version` (pin choice → §10) and `Accept: application/vnd.github+json`.

**`GET /api/github/repositories?page=1&per_page=30&visibility=all`** (query pass-through, `per_page` clamped 1-100):

- **Connected only.** `GET /user/repos` requires authentication ([docs: repos](https://docs.github.com/en/rest/repos/repos)); anonymous listing of "my repos" has no meaning. When `mode === 'anonymous'` → `401 { error: 'Connect a GitHub account to list repositories', code: 'auth-required' }`.
- Upstream call: `visibility` pass-through, `affiliation=owner,collaborator,organization_member` (default all three, [docs](https://docs.github.com/en/rest/repos/repos)), `sort=updated&direction=desc`, `per_page`, `page`. **Never** send `type` (422 when combined with `visibility`/`affiliation`, [docs](https://docs.github.com/en/rest/repos/repos)).
- Response `{ repositories: [{ owner, repo, fullName, description?, visibility, private, defaultBranch, pushedAt, htmlUrl }], page, perPage, hasNext }` — `hasNext` from the `Link: rel="next"` header ([docs](https://docs.github.com/en/rest/repos/repos)). Owner/repo/defaultBranch pre-split so the UI never re-parses `full_name`.
- 60-second in-memory cache keyed `(tokenFingerprint, page, perPage, visibility)` — bounded (≤10 entries, LRU) to protect the anonymous 60 req/h budget and avoid pointless re-listing (search is client-side over loaded pages).

**`GET /api/github/resolve?url=<raw>`**

- Parse and normalize input client-safely: accept `https://github.com/owner/repo`, `github.com/owner/repo`, `owner/repo`, and `…/tree/<ref>` / `…/blob/<ref>/…` suffixes (ref extracted, URL-decoded). Anything else → `400 { error, code: 'invalid-url' }`. Reject `.git`-suffixed web URLs only after stripping (clone URLs accepted, normalized to owner/repo).
- Upstream `GET /repos/{owner}/{repo}` **with the connected token when present, else anonymous**. Follow redirects (301 for renamed/transferred repos, [docs](https://docs.github.com/en/enterprise-server@3.20/rest/repos/repos)).
- Success → `{ owner, repo, ref, defaultBranch, fullName, visibility, private, cloneUrl, htmlUrl, pushedAt, accessible: 'token' | 'anonymous' }` where `ref = explicitRef ?? defaultBranch`. Fields map 1:1 from the documented top-level response (`full_name`, `private`, `visibility`, `default_branch`, `clone_url` — [docs](https://docs.github.com/en/enterprise-server@3.20/rest/repos/repos)).
- 404 handling by mode: **anonymous** → `404 code: 'repo-not-found-or-private'` (message: "Not found. If this repository is private, connect a GitHub account." — the UI renders this as the `private-inaccessible` state with a Connect CTA); **connected** → `404 code: 'repo-not-found'` (definitive: with `repo` scope your account sees every repo you can access, so this is genuinely absent). GitHub gives no stronger signal by design ([docs](https://docs.github.com/en/enterprise-server@3.20/rest/repos/repos)) — this is the honest maximum.
- Resolve results cached 60 s per normalized `(owner, repo, ref, mode)` — repeated resolve clicks and the subsequent ingest handoff must not double-spend the anonymous budget.

### 4.9 Unauthenticated fallback mode — explicit states, never silent

`mode: 'anonymous'` (from §4.7) is a first-class state surfaced everywhere:

- `status` reports it; the repositories route answers `auth-required`; resolve proceeds anonymous (public repos only, 60 req/h — [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).
- When anonymous resolve hits the 60/h wall: classified `rate-limited` with `retryAt` from `x-ratelimit-reset`; the UI's remedy message is "Connect a GitHub account for 5,000 requests/hour".
- `start` in anonymous mode with missing env → `503 { error: 'GitHub OAuth is not configured — set T3MP3ST_GITHUB_OAUTH_CLIENT_ID/SECRET', code: 'not-configured' }`; the UI renders a registration hint (link to github.com/settings/developers + the exact `redirectUri` to register).

### 4.10 Token refresh (mandatory, §2.5)

`ensureGitHubAccessToken()` mirrors `ensureOAuthAccessToken` (`src/llm/oauth.ts:537-558`): refresh when `expiresAt - now < 120 s` (skew precedent `:86`), `grant_type=refresh_token` at the token URL, **single-flight** the refresh (in-flight promise shared; concurrent callers await the same exchange — the rotate-on-use rule makes double-refresh fatal, [cloudflare-os #641](https://github.com/cloudflare/cloudflare-os/issues/641)), persist the new pair atomically, and on `400 invalid_grant` clear the store → status flips to `token-expired` → UI prompts reconnect. Called by both proxy routes before their upstream call.

---

## 5. UI design (SPA)

### 5.1 Navigation

- `SectionId` gains `'github'`; `NAV_ITEMS` inserts `{ id: 'github', label: 'GitHub' }` **immediately after `overview`** (locked default; `ui/src/App.tsx:9-14`), render line added alongside the others (`ui/src/App.tsx:79-82`). Hash routing gives deep-link `#/github` for the callback result page's return link (§4.4).

### 5.2 Page structure — `ui/src/pages/GitHub.tsx` + `github.css`

Three blocks top-to-bottom, styled with existing tokens only (`var(--brand)`, `var(--surface)`, `var(--border)`, `var(--font-mono)` — `ui/src/styles.css:52-66`), BEM-ish `github-*` class names mirroring the overview-card pattern (`ui/src/pages/overview.css:59-127`):

1. **Account card** (`GET /api/oauth/github/status` via `getJson`): avatar (`<img src={avatarUrl}>`, public URL), `@handle`, connection badge (`overview-badge--on/off` styling duplicated as `github-badge--on/off`), expiry line (`Expires <time>` when `expiresAt` present — `formatTime` pattern `ui/src/pages/Overview.tsx:60`), scopes line (`repo · read:user`), and **Disconnect** button (`btn--danger` styling per token rule "red ONLY for … danger", `docs/assets/tokens.css:284-307`). When not configured: setup sub-card with the exact `redirectUri` in `--font-mono` + copy button + developer-settings link. The `repo`-scope warning ("read **and write** access to all repositories you can access") sits directly under the Connect button, per §2.2.
2. **Connect-by-URL card**: `form-input` text field (`https://github.com/owner/repo…` placeholder) + **Resolve** primary button; result area renders the resolve state machine (§5.6) and on success a repo summary card (owner/repo mono, ref selector defaulting to `defaultBranch`, visibility badge public/private/internal) + **Use in Purple Team run** primary action → writes `selectedRepo` (§5.5).
3. **Repositories card** (connected only): search box (client-side substring filter over loaded pages — no upstream search endpoint, so no `search`-bucket rate limits), list rows (fullName, visibility badge, `pushedAt`), **Load more** button while `hasNext`, empty/loading/error via the `useResource` triad pattern (`ui/src/pages/Overview.tsx:16-55`). Each row has **Select** → same `selectedRepo` write + per-row selected state.

### 5.3 Connect flow UX

- Connect button → `GET /api/oauth/github/start` → `window.open(authorizeUrl)` (new tab; exactly how the static console opens the ChatGPT `authorizeUrl`, `docs/settings.html:240-243`) → card flips to **consent-pending**: "Complete the sign-in in the GitHub tab", a paste-fallback input (the repo's existing convention, §4.5), and a 15-min expiry countdown. Status polling is unnecessary: the callback success page links back to `#/github` and the page refetches status on hash-activation (`useEffect` on `active`), while the paste path resolves inline.
- The opened tab returning via the server-served HTML page (§4.4) is the happy path — no paste needed.

### 5.4 Component/state plumbing

- All fetches through `getJson<T>`/`ApiError` (`ui/src/api/client.ts:14-31`); new response types appended there (`GitHubStatusResponse`, `GitHubRepositoriesResponse`, `GitHubResolveResponse`, plus `code`/`retryAt` fields on error bodies — extend `ApiError` to carry the optional `code`/`retryAt` parsed from the JSON body).
- One `useResource`-style hook per card (copy of the Overview pattern; Overview.tsx is module-local and not to be modified — `.planning/v1.7-SURVEY.md:38`).

### 5.5 `selectedRepo` shared store (the handoff contract)

`ui/src/state/selectedRepo.ts` — zustand store (dependency already present, unused — `.planning/v1.7-SURVEY.md:11`):

```ts
interface SelectedRepo { owner: string; repo: string; ref: string; visibility: 'public'|'private'|'internal'; fullName: string; }
useSelectedRepo = { selected: SelectedRepo | null; select(r: SelectedRepo): void; clear(): void }
```

Single global selection (one repo per run). Consumers: this page (write + highlight), and the run-config surface designed by the sibling nodes (read — `POST /api/mission/start` extension is the ingest section's scope; this store is the agreed seam, values already validated server-side by resolve). If the account disconnects while a private repo is selected, the store keeps the selection but the run config must re-resolve (ingest section's contract note).

### 5.6 Full state matrix

**Account card** (`configured` × flow × token health):

| State | Trigger / evidence | UI |
|---|---|---|
| `not-configured` | `status.configured === false` (`503`-capable env missing) | Setup card: register an OAuth App, exact `redirectUri` to copy, link to GitHub developer settings; resolve-by-URL still usable anonymously |
| `signed-out` | `configured && !connected` | Connect button + `repo`-scope warning |
| `consent-pending` | after `start` OK (or `error=access_denied` seen on return) | "Finish in the GitHub tab" + paste fallback + 15-min countdown |
| `consent-denied` | callback `error=access_denied`, or complete with denied code | "Connection cancelled" + retry Connect |
| `connected` | `status.connected === true` | avatar/@handle/scopes/expiry + Disconnect |
| `token-expired` | `401 token-expired` from repositories/resolve after failed refresh, or `expiresAt < now` on load with refresh already dead | "Session expired — reconnect" (Connect button re-armed) |
| `network-error` | `502` from any GitHub route | Error card + retry (Overview `.overview-card__error` pattern) |
| `disconnected` | logout response (transient) | Same render as `signed-out` (the store is cleared; no zombie state) |

**Repository / resolve area**:

| State | Trigger | UI |
|---|---|---|
| `empty` | no URL entered / no repos loaded | Hint text ("Paste a GitHub URL or connect to browse") |
| `loading` | resolve/list in flight | skeleton (`overview-skeleton__*` pattern, `ui/src/pages/overview.css:106-127`) |
| `populated` | resolve/list 200 | repo card(s), ref, visibility badge, Select action |
| `invalid-url` | `400 invalid-url` | inline field error, input re-focused |
| `repo-not-found` | `404` while **connected** | "Repository not found (or your account has no access)" + retry |
| `private-inaccessible` | `404 repo-not-found-or-private` while **anonymous** | "Not found — private? Connect a GitHub account" + Connect CTA |
| `rate-limited` | `429` + `retryAt` | "Rate limited — retry at HH:MM:SS" countdown, disabled actions until `retryAt` |
| `auth-required` | `401` on repositories while anonymous | Connect prompt inside the list card |

Both matrices are exhaustive over the classifier outputs of §4.8 — every classified error reaches exactly one UI state.

---

## 6. Changed files

New:

- `src/github/oauth.ts` — flow, store, status, refresh, disconnect (§4.1-4.7, 4.10)
- `src/github/api.ts` — tokened/anonymous REST client + error classifier (§4.8)
- `ui/src/pages/GitHub.tsx` — the section page (§5.2-5.4)
- `ui/src/pages/github.css` — token-only styles, `github-*` classes (§5.2)
- `ui/src/state/selectedRepo.ts` — zustand shared selection store (§5.5)
- `src/__tests__/github-oauth.test.ts` — module tests (§7)
- `src/__tests__/github-routes-static.test.ts` — route-registration + status-surface static tests, mirroring `src/__tests__/oauth-ui-static.test.ts:73-77` and `src/__tests__/oauth-openai-routes-static.test.ts:23-27`

Modified:

- `src/server.ts` — six routes mounted after `src/server.ts:6628` (§4)
- `.env.example` — `T3MP3ST_GITHUB_OAUTH_*` block (§4.1)
- `src/redact.ts` — add `ghr_` refresh-token pattern beside `src/redact.ts:13-14` (§8; the UI-side dupes `ui/src/components/AgentPanel.tsx:83`, `ui/src/genui/GenUiPanel.tsx:13` already cover `ghr_` via `gh[pousr]_` — no change)
- `ui/src/api/client.ts` — new response types + `ApiError.code/retryAt` (§5.4)
- `ui/src/App.tsx` — nav item + section render (§5.1)
- `docs/API_REFERENCE.md` — the six routes (it already documents the OAuth block at `docs/API_REFERENCE.md:243-246`)

Not changed (explicitly): `ui/src/pages/Overview.tsx` (approved reference — `.planning/v1.7-SURVEY.md:38`), `src/llm/oauth.ts`, `src/teams/purple.ts`, `docs/assets/tokens.css`.

---

## 7. Test plan (mirror `src/__tests__/oauth.test.ts`)

Conventions copied from `src/__tests__/oauth.test.ts:20-46`: `fakeFetch` wrapper, temp store via `T3MP3ST_GITHUB_OAUTH_STORE` + `mkdtempSync`, `afterEach` env/state reset, clock override.

1. **State single-use:** start → callback with `state`+`code` succeeds; a *second* callback/complete with the same `state` (replay) → 400/expired; callback with unknown `state` → 400; expired flow (advance clock past TTL) → 400.
2. **PKCE correctness:** authorize URL contains `code_challenge_method=S256` and a 43-char challenge; token exchange body contains the original verifier and `client_secret`; exchange **without** verifier when a challenge was sent is treated as upstream error (assert we always send it).
3. **Token absence from client payloads:** JSON.stringify of `status()`, callback success page HTML, `complete` response, `repositories` and `resolve` responses contains none of `accessToken`, `gho_`, `ghr_`, `refreshToken` (direct analogue of `oauth.test.ts:92` "status has no secrets").
4. **Store hygiene:** file written under temp path, mode `0600`, survives module re-load (cache), logout clears it.
5. **Refresh lifecycle:** token with `expiresAt` inside skew → API call triggers one refresh; two concurrent `ensureGitHubAccessToken` calls → **exactly one** upstream token request (single-flight); refresh response rotates both tokens atomically; `400 invalid_grant` → store cleared, status `token-expired`.
6. **Error classification (fakeFetch per row of §4.8):** 401 → token-expired; 403+`Retry-After` → rate-limited secondary with `retryAt`; 403+`x-ratelimit-remaining: 0`+`x-ratelimit-reset` → rate-limited primary (`retryAt` = reset epoch); 404 anonymous vs connected → distinct codes; network throw → network-error/502.
7. **Resolve URL parser:** all forms of §4.8 parse/ref-extraction; invalid → `invalid-url`; `.git` suffix normalized.
8. **Logout:** DELETE-grant fetch attempted with Basic auth + token body; upstream 401/network failure still `ok: true` with cleared store.
9. **Routes static:** `src/__tests__/github-routes-static.test.ts` asserts the six `app.get/post('/api/oauth/github/…'` + `/api/github/…` registrations exist in server.ts and that no route returns token fields by construction (string-level, mirroring `oauth-ui-static.test.ts:73-77`).
10. **UI typecheck/build** covered by the existing gate bundle (`npm run test:pr` = lint + typecheck + test + doctor + ui:typecheck + ui:build — `.planning/v1.7-SURVEY.md:14`); no new gate scripts.

---

## 8. Risks

1. **`repo` scope over-grant (write access to all accessible repos).** Inherent to OAuth Apps ([docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps), [community #7891](https://github.com/orgs/community/discussions/7891)); q3 locks it in. Mitigations: token lives only in a `0600` server-side store and is never sent to the client (§4.7 invariant + test 3); Disconnect = `DELETE …/grant` (revokes everything + unpins the app); honest scope copy in the UI; single-operator loopback tool with origin guards (`src/server.ts:280-325`).
2. **8 h expiring tokens are now the default** for new OAuth apps ([cloudflare-os #641](https://github.com/cloudflare/cloudflare-os/issues/641), [refresh docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)). Refresh single-flight + atomic rotation is load-bearing (tests 5); a missed rotation bricks the connection with only "reconnect" as remedy.
3. **`ghr_` refresh tokens leak surface.** Server redaction covers `ghp_`/`gho_` only (`src/redact.ts:13-14`) while refresh tokens now ship by default — one-line pattern addition (in scope, §6) closes the gap the feature itself opens.
4. **Anonymous 60 req/h budget** ([rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)) — mitigated by the bounded 60 s caches and no proxy-side retries (§4.8); worst case is the `rate-limited` UI state with a countdown, never a hard failure.
5. **Redirect-URI exact-match coupling** to `PORT`/host (§4.3): changing the port or moving to a non-loopback bind breaks the happy path. Mitigated by status surfacing the exact derived `redirectUri` and by the paste fallback which never depends on the server being reachable at the registered URL.
6. **Org OAuth-App restrictions / SAML** can hide org repos from `/user/repos` even with `repo` scope ([docs: repos discussion](https://docs.github.com/en/rest/repos/repos)); shows up as a silently shorter list — surfaced via the 403-no-headers classification as `token-expired`/auth-failed with the upstream message, and §10 keeps the messaging question open.
7. **In-memory pending flows die on server restart** mid-consent — identical to the existing xAI/OpenAI behavior (`src/llm/oauth.ts:106-107`); the 15-min TTL plus "try again" page bounds the annoyance. Accepted.

---

## 9. Handoff notes for sibling sections

- **Repo ingest (n5):** consume `selectedRepo` (`ui/src/state/selectedRepo.ts`) + `GET /api/github/resolve` as the canonical validator; the tokened `src/github/api.ts` client (with `ensureGitHubAccessToken`) is the single place remote fetches should get credentials from; content fetching (tarball vs clone vs API tree) is that section's call.
- **Agent Panel / run config (n6):** read `selectedRepo`; display it wherever the run target is composed; clear-on-run policy is yours.
- **This section does not touch** `POST /api/mission/start`, `src/recon/whitebox.ts`, or `src/teams/purple.ts`.

## 10. Open questions

1. **API version pin:** docs examples show both `X-GitHub-Api-Version: 2022-11-28` and `2026-03-10` ([repos docs](https://docs.github.com/en/rest/repos/repos)). Default to the newer pinned version behind `T3MP3ST_GITHUB_API_VERSION` override? (Recommendation: pin `2026-03-10` + env override; flag for plan review.)
2. **Callback registration variants:** recommend registering both `http://127.0.0.1:<port>/…` and `http://localhost:<port>/…`; should `start` also accept a query param to pick the loopback name (GitHub exact-match treats them as different strings)? Low priority given paste fallback.
3. **Exact current default for expiring tokens on newly registered apps** (changelog wording vs. `offline_access`-per-request): implementation treats both shapes via `expires_in`/`refresh_token` presence, so behavior is safe either way, but the UI copy ("session lasts 8 h") should be verified against the registration at first dogfood.
4. **Org-restricted repos messaging** (risk 6): what user-facing copy when a 403-with-no-limits appears on the repositories list?
5. **Avatar rendering** loads `avatars.githubusercontent.com` directly in the SPA (public URL, no token) — confirm no CSP/CORS constraint in the SPA shell blocks remote images (none observed in `ui/src/styles.css` / index template, but not exhaustively verified).
