# 34 — Claude OAuth PKCE fix — CONTEXT / design

**Node:** n3 · **Linear:** https://linear.app/swcstudio/issue/SPE-15995/n3-design-claude-oauth-pkce-fix
**Date:** 2026-10-19 · **Input:** `.planning/v1.7-SURVEY.md` §W1 + locked decision q1 (borrow public clients)
**Defect being fixed:** "Claude login logs us into Claude Code, not the Claude Pro Max 20x plan via PKCE."

---

## 0. Executive summary

Today there is **no in-app Claude login at all**. The only "Claude" surface is the local `claude` CLI
connector (`src/agent/local-agents.ts`), detected by *file presence* and driven by spawning
`claude -p` — that is the "logs us into Claude Code" defect. The fix adds a third OAuth vendor
`claude` to `src/llm/oauth.ts`, mirroring the existing OpenAI PKCE pattern line-for-line (S256
verifier, CSRF `state`, 15-min pending-flow TTL, pasted-callback code exchange, 0600 token store,
refresh-on-demand), and wires the resulting subscription token into the existing `anthropic`
provider as an OAuth-Bearer path on `POST /v1/messages` — exactly the way SuperGrok OAuth rides the
`xai` provider today.

**Read §2 first.** Anthropic does not document this flow, has moved its endpoints once already, and
since Jan–Apr 2026 actively blocks + contractually bars third-party use of Pro/Max OAuth tokens.
This repo itself previously shipped and then **removed** Anthropic OAuth for precisely that reason
(`docs/CHANGELOG.md:13`). The locked q1 decision re-authorizes shipping it; the design below does
not spoof Claude Code identity, surfaces provider refusals honestly, and keeps every endpoint/
client value env-overridable so the path can be disabled or repointed without a code change.

---

## 1. Current-state audit (evidence)

### 1.1 `src/llm/oauth.ts` — the module the fix extends (564 lines)

| Seam | Evidence | Behavior |
|---|---|---|
| Vendor union | `src/llm/oauth.ts:19` | `export type OAuthVendor = 'xai' | 'openai';` — no `claude` |
| Module charter | `src/llm/oauth.ts:10-11` | Header comment: *"Claude Pro/Max is deliberately not handled here. Claude subscriptions run only through the user's own locally installed `claude` CLI"* — the comment this phase deletes/inverts |
| Token shape | `src/llm/oauth.ts:21-31` | `OAuthTokens { accessToken, refreshToken?, idToken?, expiresAt, tokenType?, obtainedAt }` |
| Status shape | `src/llm/oauth.ts:33-37` | `OAuthStatus { connected, expiresAt?, label }` |
| PKCE start shape | `src/llm/oauth.ts:48-52` | `OpenAiPkceStart { flowId, authorizeUrl, state }` |
| OpenAI constants | `src/llm/oauth.ts:76-81` | authorize `https://auth.openai.com/oauth/authorize`, token `…/oauth/token`, redirect `http://localhost:1455/auth/callback`, `OPENAI_DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'` (Codex CLI public client), scope `openid profile email offline_access`, allowlist `{auth.openai.com, chatgpt.com}` |
| TTLs | `src/llm/oauth.ts:83-87` | `REFRESH_SKEW_MS = 120_000`, `FLOW_TTL_MS = 15 * 60 * 1000` |
| Store | `src/llm/oauth.ts:89-92, 129-133, 177-199` | `StoreFile { xai?, openai? }` at `~/.t3mp3st/oauth.json` (env `T3MP3ST_OAUTH_STORE`), written `0600` (`saveStore` lines 193-199) |
| Pending flow | `src/llm/oauth.ts:100-107` | `PendingOpenAi { verifier, state, expiresAt }` in `pendingOpenAi` Map |
| Test seams | `src/llm/oauth.ts:113-127` | `setOAuthFetch` (injected fetch), `__setOAuthNow` (clock), `__resetOAuthState` |
| Env overrides | `src/llm/oauth.ts:135-149` | `T3MP3ST_XAI_OAUTH_CLIENT_ID`, `T3MP3ST_OPENAI_OAUTH_CLIENT_ID` / `_AUTHORIZE` / `_TOKEN` — note: **none of these appear in `.env.example`** (grep of `.env.example` for `OAUTH` returns nothing); overrides are code-only by convention |
| Host allowlist | `src/llm/oauth.ts:151-167` | `assertHttpsHost(url, allowed, label)` — https + host allowlist enforced on authorize/token URLs |
| PKCE derivation | `src/llm/oauth.ts:446-463` | verifier = `base64url(randomBytes(32))`, challenge = `base64url(sha256(verifier))`, `state`/`flowId` = `randomId()` (16 random bytes b64url, line 173-175), authorize params `client_id, response_type=code, redirect_uri, scope, code_challenge, code_challenge_method=S256, state` |
| Callback parsing | `src/llm/oauth.ts:429-444` | `parseOpenAiAuthCode(raw)` accepts raw code, `code#state`, or full callback URL |
| Code exchange | `src/llm/oauth.ts:465-508` | pending lookup → TTL check → optional state match (mismatch kills the flow, 479-482) → JSON-body POST to token URL → sanitized error surface → `persistTokens('openai', …)` |
| Refresh | `src/llm/oauth.ts:510-531` | `grant_type=refresh_token` JSON body with `client_id`; `parseTokenResponse(body, tokens.refreshToken)` keeps the old refresh token only when the response omits one (lines 251-253) |
| Refresh-on-demand | `src/llm/oauth.ts:537-558` | `ensureOAuthAccessToken(vendor)` — refresh when `expiresAt - now <= 120s`; preserves `idToken` across rotation (548-550); on transient failure keeps the unexpired access token (552-556) |
| Provider→vendor map | `src/llm/oauth.ts:560-564` | `oauthVendorForProvider`: `'xai'→'xai'`, `'chatgpt'→'openai'` |
| Status labels | `src/llm/oauth.ts:220-235` | `oauthStatus()` → per-vendor `{connected, expiresAt, label}`; labels `'Super Grok Heavy'` / `'ChatGPT Plan'` |

### 1.2 The wrong surface — `src/agent/local-agents.ts`

- `SPECS[0]` is the claude spec: `{ id: 'claude', label: 'Claude Code', bin: 'claude', authArtifacts: ['~/.claude/.credentials.json', '~/.claude.json'], keychainService: 'Claude Code-credentials', oneShot: ['-p', prompt, '--output-format','text', …] }` — `src/agent/local-agents.ts:117-129`.
- Auth detection is **presence-only** (`src/agent/local-agents.ts:108-109`: *"any-of: presence ⇒ authed. PRESENCE ONLY — contents are never read"*), resolved in `authState` (line 363) / `detectOne` (line 410).
- The CLI is driven headlessly via `runLocalAgent` (452-489) and `localAgentChat` (511-596) — this is the *entire* current Claude backend, i.e. "logged into Claude Code".
- `T3MP3ST_TRUST_CLAUDE_SESSION` gates tool-trust for that path (`.env.example:47`, read at `src/llm/index.ts:1600`).
- **This file does not change in phase 34.** The local-CLI connector stays as a separate, legitimate path; the fix adds the missing *subscription OAuth* surface next to it.

### 1.3 Server route pattern — `src/server.ts`

- `GET /api/oauth/status` → `oauthStatus()` — `src/server.ts:6567-6569`.
- xAI device trio `POST /api/oauth/xai/start|poll|logout` — `src/server.ts:6571-6598`; on `authorized` / logout the server re-inits the LLM (`llm = await initLLM()`, lines 6587, 6596).
- OpenAI PKCE trio `POST /api/oauth/openai/start|complete|logout` — `src/server.ts:6600-6628`; `complete` validates `{flowId, code}` (6609-6614), then `completeOpenAiPkceFlow` + `initLLM()` re-init (6616-6617).
- `GET /api/llm/status` embeds `oauth: oauthStatus()` — `src/server.ts:6552-6564`.
- `initLLM()` builds the backbone from `selectServerLLMConfig()` and nulls out when a key-needing provider has no key — `src/server.ts:370-384`; `providerNeedsApiKey` excludes only `codex, mock, local, local-agent, cursor` (`src/server.ts:8097-8100`).

### 1.4 Config seams — `src/config/index.ts`

- Imports `hasOAuth, peekOAuthAccessToken` from oauth.ts — `src/config/index.ts:13`.
- `anthropic` provider config is `{ baseUrl, defaultModel }` — `src/config/index.ts:57-61`, defaults `{ baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-opus-4-8' }` — `src/config/index.ts:175-178`.
- `chatgpt` (the subscription-provider precedent) config — `src/config/index.ts:123-127`, defaults `baseUrl 'https://chatgpt.com/backend-api/codex'`, `defaultModel 'gpt-5.1'` — lines 243-247.
- `getConfiguredProviders()`: xai counts when `hasApiKey('xai') || hasOAuth('xai')` (516-517); `chatgpt` counts when `hasOAuth('openai')` (529-531).
- `getLLMConfig()` case `'anthropic'` today is API-key-only: `apiKey = this.getApiKey('anthropic')`, baseUrl/model from config — `src/config/index.ts:572-576`. The xai precedent for OAuth-wins-over-key is `apiKey = peekOAuthAccessToken('xai') || this.getApiKey('xai')` with the "subscription not silently billed as metered credits" rationale — lines 583-588. The chatgpt precedent (OAuth is the *only* auth) is lines 634-641 incl. `T3MP3ST_CHATGPT_BASE_URL` override.
- `authType: 'oauth'` is derived in `oauthHydrated` (676-683) and rehydrated per fallback-chain hop (718-724).

### 1.5 Provider/type seams

- `LLMProvider` union already contains `anthropic` (API-key) and `chatgpt` (subscription) but no subscription-Claude id — `src/types/index.ts:9`.
- `AnthropicAdapter` (`src/llm/index.ts:452-587`): `name = 'anthropic'` (453); `validateConfig` hard-requires an API key (460-468); `baseUrl` defaults to `https://api.anthropic.com`, endpoint `POST {baseUrl}/v1/messages` (500-501); headers are exactly `Content-Type`, `anthropic-version: 2023-06-01`, `x-api-key: this.config.apiKey` (526-530). **No Bearer path exists.**
- Factory: `case 'anthropic': return new AnthropicAdapter(config)` — `src/llm/index.ts:1813-1815`.
- Backbone ladder: anthropic sits before chatgpt — `src/llm/index.ts:2224-2231`; `createChatGPTBackbone` shows the OAuth-only backbone pattern (2173-2177).
- `STREAMABLE_PROVIDERS` (`src/chat/chat-route.ts:26-38`) lists 11 OpenAI-compatible vendors; **`anthropic` is absent — and so is `chatgpt`**. Chat/genui 409 non-streamable providers (`src/chat/chat-route.ts:115-118`, `src/genui/generate-route.ts:118-121`; 409 test `src/__tests__/chat-route.test.ts:130-141`). `defaultCreateModel` builds every stream via `createOpenAICompatible({ name, baseURL, apiKey })` — `src/chat/chat-route.ts:90-95`.
- Streaming config: `selectServerLLMConfig()` falls back xai-OAuth → chatgpt-OAuth (`src/chat/streaming-config.ts:24-33`); `resolveStreamingConfig()` refreshes the token via `oauthVendorForProvider` + `hasOAuth` + `ensureOAuthAccessToken` (40-61). So ChatGPT Plan today is mission/backbone-only (its streaming selection would 409) — relevant precedent, see §4.3.

### 1.6 UI surfaces

- SPA Overview "Subscriptions" card reads `GET /api/oauth/status` (`ui/src/pages/Overview.tsx:140-141`, card at 213-236) and renders per-vendor `status.label` + Connected badge + `Expires {formatTime(expiresAt)}`. Client types: `OAuthVendor = 'xai' | 'openai'` — `ui/src/api/client.ts:57`, `OAuthStatus { connected, expiresAt?, label }` — `ui/src/api/client.ts:86-92` — this union is a **manual mirror** of the server union and must be updated in lockstep.
- Legacy console settings page: "Subscription sign-in" card — `docs/settings.html:26-61`, with a **"Claude Code (local CLI)"** card at `docs/settings.html:36-41` ("Drive the Claude Code CLI already signed in on this machine — no API key needed", Connect/Disconnect buttons) and the copy "Claude Code runs through your local CLI." at `docs/settings.html:28`. The ChatGPT card (`docs/settings.html:42-47`) is the PKCE UX to mirror: Sign in → open authorizeUrl → "paste the callback code". Its inline script drives `/api/oauth/openai/start|complete|logout` (inline `<script>` in `docs/settings.html:132-538`).
- Landing page shows the per-vendor status row (`docs/index.html:39-47`).
- API docs table for the OAuth routes — `docs/API_REFERENCE.md:241-248`; stale copy "Claude/Grok plans: sign in through Settings (Anthropic PKCE / X DEVICE…)" — `docs/GETTING_STARTED.md:159-163`.
- **Prior removal:** `docs/CHANGELOG.md:13` — *"Anthropic Pro/Max direct OAuth is removed, because Anthropic's Consumer Terms bar third-party apps from offering Claude.ai login or routing requests through Pro/Max credentials. Use an Anthropic API key, or connect the local `claude` CLI as a local agent. `/api/oauth/anthropic/*` now returns 404."* Phase 34 deliberately reverses this per locked q1 — see Risks R1.

### 1.7 Tests to mirror

- `src/__tests__/oauth-openai.test.ts` — the PKCE suite to clone for claude: authorize-URL build with public client (line 68), env overrides honored (70-86), allowlist rejection (88-93), `parseOpenAiAuthCode` shapes (95-100), exchange persists tokens + id_token with no secret leakage via status (101-144), state-mismatch/unknown-flow rejection (146-152), refresh preserves id_token (154-192), refresh-failure-past-expiry surfacing (194-210), provider→vendor mapping + `getLLMConfig` hydration (212-232). Uses `fakeFetch` + `T3MP3ST_OAUTH_STORE` temp store + `__setOAuthNow`.
- `src/__tests__/oauth.test.ts` — xAI vendor suite, store mode-0600 assertion (line 92ff).
- `src/__tests__/oauth-adapters.test.ts` — header-level truth via `global.fetch` injection: API-key Anthropic keeps `x-api-key` with **no** `Authorization` (12-35); SuperGrok OAuth goes out as `Bearer` (37-60). The claude case slots in here.
- `src/__tests__/chatgpt-provider.test.ts` — full vendor→backbone E2E with `setOAuthFetch` + `signIn()` helper (33-52).
- Static guards: `src/__tests__/oauth-ui-static.test.ts` (settings.html must contain card labels + route strings), `src/__tests__/oauth-openai-routes-static.test.ts` (server must contain the route literals).

---

## 2. Provider research — Anthropic consumer OAuth (Claude Code's flow)

**Provenance warning:** nothing below is official Anthropic documentation. Every value comes from
reverse-engineering write-ups, GitHub issues on `anthropics/claude-code`, and third-party
implementations. Anthropic has already moved hosts once (console.anthropic.com → platform.claude.com).
Everything is env-overridable in the design precisely so a host move is a config change, not a code
change. Facts not covered by a source URL are marked **OPEN**.

### 2.1 Endpoints and client (community-sourced)

| Value | Value detail | Source |
|---|---|---|
| Authorize endpoint | `https://claude.ai/oauth/authorize` (older builds: `https://console.anthropic.com/oauth/authorize`) | https://gist.github.com/shubcodes/3c9c7ff813715aa47018bf22e7cf8cb5 ; https://lalatenduswain.medium.com/claude-code-on-claude-max-plan-understanding-oauth-token-vs-api-key-authentication-in-2026-96a6213d2cde |
| Token endpoint | `https://platform.claude.com/v1/oauth/token` (Claude Code ≥2.1); older `https://console.anthropic.com/v1/oauth/token` | https://github.com/anthropics/claude-code/issues/102265 (live traffic to platform.claude.com:443); https://gist.github.com/shubcodes/3c9c7ff813715aa47018bf22e7cf8cb5 |
| Public client_id | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` (shared by every Claude Code install; Cowork uses `a473d7bb-17ac-43a7-abc0-a1343d7c2805`; a staging id `22422756-60c9-4084-8eb7-27705fd5cf9a` also reported) | https://github.com/anthropics/claude-code/issues/39445 ; https://dev.to/johnson998877/i-downloaded-the-claude-code-source-before-anthropic-dmcad-it-fll ; https://github.com/anthropics/claude-code/issues/33216 |
| Redirect URI | `https://platform.claude.com/oauth/code/callback` (older `https://console.anthropic.com/oauth/code/callback`) with `code=true` so the callback page renders a copyable authorization code | https://deepwiki.com/sst/opencode-anthropic-auth/4.1-claude-promax-oauth (param table incl. `code: "true"`) ; https://gist.github.com/shubcodes/3c9c7ff813715aa47018bf22e7cf8cb5 |
| PKCE | `code_challenge_method=S256` + `code_challenge` + `state` on every authorization request | https://deepwiki.com/sst/opencode-anthropic-auth/4.1-claude-promax-oauth ; https://claude.com/docs/connectors/building/authentication (S256 requirement statement) |
| Scopes (full CLI login) | `user:inference user:profile user:sessions:claude_code user:mcp_servers` (plus `user:file_upload`, `user:plugins` observed in stored credentials) | https://lalatenduswain.medium.com/claude-code-on-claude-max-plan-understanding-oauth-token-vs-api-key-authentication-in-2026-96a6213d2cde ; https://github.com/anthropics/claude-code/issues/22450 |
| Minimal inference scope | `user:inference` alone suffices for model calls (`claude setup-token` uses only it) | https://github.com/anthropics/claude-code/issues/22450 |
| Token response | `{ token_type: "Bearer", access_token: "sk-ant-oat01-…", expires_in: 28800, refresh_token: "sk-ant-ort01-…", scope, organization{…}, account{…} }` (8 h access TTL; `refreshTokenExpiresAt` ~4 weeks stored by the CLI) | https://github.com/anthropics/claude-code/issues/102265 ; community-reported shape via search (mark exact JSON keys **OPEN** until E2E) |
| Refresh grant | `POST {token endpoint}` JSON body `{ grant_type: "refresh_token", refresh_token, client_id, scope }`; **refresh tokens are single-use and rotate** — persist BOTH new tokens or the next refresh is `invalid_grant` | https://github.com/anthropics/claude-code/issues/102265 ; https://gist.github.com/shubcodes/3c9c7ff813715aa47018bf22e7cf8cb5 |
| Token-endpoint quirks | Headless POSTs without `anthropic-beta: oauth-2025-04-20` get HTTP 429; form-encoded bodies or missing `scope` also 429; JSON + scope returns 200 | https://github.com/onllm-dev/onWatch/issues/145 ; https://github.com/s3ntin3l8/runway-ai-usage-tracker/issues/577 |
| UA blocking | Token exchange 404s when the request spoofs the `claude-cli/…` User-Agent — Anthropic blocks impersonated clients | https://github.com/NousResearch/hermes-agent/issues/48534 |
| Device flow | **None.** RFC 8628 is an open feature request; Claude Code only does authorization_code (+MCP ignores device endpoints) | https://github.com/anthropics/claude-code/issues/22992 ; https://github.com/anthropics/claude-code/issues/20215 ; https://zylos.ai/research/2026-07-21-device-flow-headless-agent-subscription-auth/ |

### 2.2 Using the token against the Anthropic API (community-sourced)

- Requests go to `POST https://api.anthropic.com/v1/messages` with `Authorization: Bearer <sk-ant-oat01-…>`, `anthropic-version: 2023-06-01`, and **`anthropic-beta: oauth-2025-04-20`**; the `x-api-key` header must be dropped. Without the beta header the API answers a misleading `401 authentication_error: "OAuth authentication is currently not supported."` Sources: https://github.com/stealth-factory/opscope/pull/301 ; community write-ups via search (winbuzzer/paddo.dev below). If other beta flags are ever sent, append to the comma-separated `anthropic-beta` list rather than replacing it (LiteLLM regression documented in the same threads).
- **OPEN:** whether `https://api.anthropic.com/v1/chat/completions` (Anthropic's OpenAI-compat surface) accepts the OAuth Bearer at all — unverified; gates the streaming option in §4.3.
- Token prefix family: access `sk-ant-oat01-…`, refresh `sk-ant-ort01-…` (same sources as §2.1 token response).

### 2.3 Plan / entitlement signal (tier for Max 20x)

- `GET https://api.anthropic.com/api/oauth/profile` with the Bearer + beta header (needs `user:profile` scope) returns `account { email, has_claude_max, has_claude_pro }` and `organization { organization_type, rate_limit_tier }`; Max 20x shows `rate_limit_tier: "default_claude_max_20x"` (5x: `default_claude_max_5x`). Community-sourced (Moltis FAQ + opscope PR); **exact response keys OPEN until E2E**. Sources: https://docs.moltis.org/anthropic-oauth.html ; https://github.com/stealth-factory/opscope/pull/301 .
- `GET /api/oauth/usage` exists for plan-limit readouts but is documented as flaky for Max users (persistent 429, `retry-after: 0`) — https://github.com/anthropics/claude-code/issues/30930 . **Do not build on it.**
- Why `user:profile` must be in the requested scope: tokens minted with only `user:inference` cannot read profile — https://github.com/anthropics/claude-code/issues/22450 .

### 2.4 Policy reality (must-read before implementation)

- Jan 9, 2026 — server-side block: subscription OAuth tokens work only from Claude.ai and the Claude Code CLI; third-party calls fail with *"This credential is only authorized for use with Claude Code and cannot be used for other API requests."* https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/ ; https://paddo.dev/blog/anthropic-walled-garden-crackdown/
- Feb 17–19, 2026 — ToS "Authentication and credential use" usage policy: OAuth tokens from Free/Pro/Max may not be used in any other product/tool/service; OpenCode removed its Claude OAuth citing Anthropic legal requests. https://docs.moltis.org/anthropic-oauth.html ; https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/
- Apr 4, 2026 — subscription OAuth blocked "inside any third-party harness" (OpenClaw et al.). https://medium.com/@SyedAbbasT/anthropic-cuts-off-openclaw-and-third-party-tools-from-claude-subscriptions-a15cf1518fda ; https://rogs.me/2026/02/use-your-claude-max-subscription-as-an-api-with-cliproxyapi/
- This repo's own prior removal for exactly this reason: `docs/CHANGELOG.md:13`.
- The login/token/refresh endpoints themselves are still reported working for personal usage monitors (Sept–Oct 2026 refresh successes — https://github.com/anthropics/claude-code/issues/102265 ); the *inference* leg is what enforcement targets. **OPEN (blocking unknown):** whether an honest, non-spoofed third-party client can complete `Bearer`+beta inference at E2E time. The design treats this as the primary acceptance risk (§7 R1) and never works around it by impersonating Claude Code.

### 2.5 Model defaults for Max 20x

- Max plans expose the flagship Opus line: `claude-opus-4-8` is a real API id (https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8) and is already this repo's `anthropic.defaultModel` (`src/config/index.ts:177`, also used in `src/__tests__/oauth-adapters.test.ts:16`).
- Newer: Claude Opus 5 (Jul 24, 2026) and Opus 5.5 (Sep 22, 2026, id `claude-opus-5-5`) per release notes — https://support.claude.com/en/articles/12138966-release-notes ; catalog aliases map `opus` → claude-opus-5 — https://github.com/anthropics/skills/blob/main/skills/claude-api/shared/models.md
- **Decision:** no new default is invented in code. Reuse `anthropic.defaultModel` (config-settable per provider at `src/config/index.ts:804-806`). During E2E, verify which ids the OAuth session actually serves (probe `/v1/messages` or list via the existing live-models path) and set the config default accordingly; whether aliases (`opus`, `opusplan`) resolve over OAuth is **OPEN**.

---

## 3. Flow spec — the `claude` OAuthVendor in `src/llm/oauth.ts`

Mirror the OpenAI PKCE implementation section (`src/llm/oauth.ts:425-531`) as a sibling section.

### 3.1 Constants + env overrides (openaiClientId precedent, lines 135-149)

```ts
export type OAuthVendor = 'xai' | 'openai' | 'claude';            // extends :19
const CLAUDE_AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const CLAUDE_TOKEN_URL     = 'https://platform.claude.com/v1/oauth/token';
const CLAUDE_REDIRECT_URI  = 'https://platform.claude.com/oauth/code/callback';
const CLAUDE_DEFAULT_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CLAUDE_SCOPE = 'user:inference user:profile';
const CLAUDE_ALLOWED_HOSTS = new Set(['claude.ai', 'platform.claude.com', 'console.anthropic.com']);
const CLAUDE_OAUTH_BETA = 'oauth-2025-04-20';
// helpers claudeClientId() / claudeAuthorizeUrl() / claudeTokenUrl() reading
// T3MP3ST_CLAUDE_OAUTH_CLIENT_ID / T3MP3ST_CLAUDE_OAUTH_AUTHORIZE / T3MP3ST_CLAUDE_OAUTH_TOKEN
```

- Scope = minimal `user:inference user:profile`: inference plus the tier readout (§2.3); deliberately not the full CLI set (`user:sessions:claude_code`, `user:mcp_servers`, …) — least privilege.
- `console.anthropic.com` stays in the allowlist so operators can repoint to the legacy token host via env if Anthropic migrates again (§2.1).
- Following repo convention, the env overrides live in code only — `.env.example` carries no `T3MP3ST_*_OAUTH_*` keys today (§1.1), so none are added.

### 3.2 Start — `startClaudePkceFlow(): Promise<ClaudePkceStart>`

Clone `startOpenAiPkceFlow` (`src/llm/oauth.ts:446-463`) exactly: S256 verifier from 32 random bytes, `state`/`flowId` via `randomId()`, `pendingClaude` map entry `{ verifier, state, expiresAt: now + FLOW_TTL_MS }` (15 min, line 87). Authorize params: `client_id`, `response_type=code`, `redirect_uri=CLAUDE_REDIRECT_URI`, `scope`, `code_challenge`, `code_challenge_method=S256`, `state`, **plus `code=true`** — the param that makes the hosted callback page render a pasteable code (§2.1). `assertHttpsHost` guards authorize/token hosts (line 151-167).

### 3.3 Complete — pasted callback, JSON exchange with the beta header

- `parseClaudeAuthCode(raw)` = byte-for-byte the `parseOpenAiAuthCode` logic (lines 429-444): accept raw code, `code#state`, or full callback URL. Claude's callback delivers the code in the page body/URL, so the same three input shapes cover it. (If E2E shows the code arrives solely as page text, the raw-code branch already handles it; **OPEN**: exact callback URL query shape.)
- `completeClaudePkceFlow(flowId, rawCode)` clones `completeOpenAiPkceFlow` (465-508): pending lookup → TTL expiry → optional state match (mismatch destroys the flow) → token exchange.
- **Exchange request (differs from OpenAI in three ways, all §2.1-sourced):**
  1. Send `anthropic-beta: oauth-2025-04-20` (else 429).
  2. JSON body `{ grant_type: 'authorization_code', client_id, code, redirect_uri, code_verifier, state }` incl. `scope: CLAUDE_SCOPE` (form-encoded/no-scope gets 429).
  3. **No `claude-cli/…` User-Agent** — default undici UA; spoofing gets 404 and is off-limits anyway (§2.4).
- Persist via existing `persistTokens('claude', parseTokenResponse(body))` — `expires_in: 28800` flows through the generic parser (258: fallback 6 h is harmless); `organization`/`account` objects in the response are **ignored** (no PII like email persisted; §2.1).
- Optional `scope?: string` on `OAuthTokens` (persisted from the response) so refresh can echo back exactly what was granted.

### 3.4 Refresh — rotating tokens, single-flight

- `refreshClaude(tokens)` mirrors `refreshOpenAi` (510-531): JSON POST `{ grant_type: 'refresh_token', refresh_token, client_id, scope: tokens.scope ?? CLAUDE_SCOPE }` + the beta header. `parseTokenResponse(body, tokens.refreshToken)` already prefers the **new** refresh token and only falls back to the old one when the response omits it (251-253) — correct for rotation (§2.1).
- **New guarantee (claude-only):** one-time refresh tokens + concurrent mission/chat callers can burn a rotation and leave the store stale (`invalid_grant` race documented at https://github.com/anthropics/claude-code/issues/102265 ). Add an in-memory per-vendor single-flight promise inside `ensureOAuthAccessToken` so concurrent `ensureOAuthAccessToken('claude')` calls share one refresh round-trip. xai/openai keep their current behavior (no behavior change to existing vendors).
- `ensureOAuthAccessToken` grows a `claude` branch beside xai/openai (545-547); keep-old-token-on-transient-failure semantics (552-556) unchanged.

### 3.5 Store, status, tier, logout

- `StoreFile` gains `claude?: OAuthTokens` (89-92); `oauthStorePath`/0600 semantics unchanged.
- `oauthStatus()` gains the claude entry: `{ connected, expiresAt, label: 'Claude Pro/Max', tier?, needsReauth? }` (220-235). Optional fields:
  - `tier?: string` — short rate-limit-tier string (`default_claude_max_20x` → display `Max 20x`; map `default_claude_max_5x`→`Max 5x`, `claude_pro` family → `Pro`; unknown strings pass through verbatim, never guess).
  - `needsReauth?: boolean` — set when a refresh failed with `invalid_grant`-class errors (module flag, cleared on sign-in/logout). This is the "refresh-expired" UI state.
- Tier fetch: after a successful exchange (and on manual re-check), `GET https://api.anthropic.com/api/oauth/profile` with Bearer + beta header; persist **only** the derived tier string + `checkedAt` beside the vendor entry (`claudeTier?` on StoreFile) — never the email/account payload (§2.3). Failure is non-fatal: status degrades to label-only. Refresh the tier opportunistically at most once per sign-in/session (no polling — the usage endpoint is 429-prone, §2.3).
- Logout: `clearOAuth('claude')` (237-241) — local delete only. **No remote revocation endpoint is documented** for consumer tokens (**OPEN**); same posture as the existing xai/openai logouts (`src/server.ts:6594-6598, 6624-6628`).

### 3.6 Completion UX — recommendation

**Pasted-callback code** (the ChatGPT card UX, `docs/settings.html:42-47`), not a loopback listener:
- The redirect is a **hosted** page (`platform.claude.com/oauth/code/callback`) with `code=true` rendering a copyable code (§2.1) — there is no loopback redirect to catch, unlike Codex's `localhost:1455` (`src/llm/oauth.ts:78`).
- Headless-safe (SSH/containers) with zero new server surface — no listener port, no origin-guard exceptions (the server is loopback-bound with origin checks per survey "Cross-cutting seams").
- One source reports newer CLI builds using a `localhost:54545` loopback (https://zylos.ai/research/2026-07-21-device-flow-headless-agent-subscription-auth/) — single-sourced, **OPEN**; the pasted-code flow works regardless of which redirect the server favors, which is exactly why it's chosen.
- No device flow exists to offer instead (§2.1).

### 3.7 Server routes — `src/server.ts`

Mirror the OpenAI trio verbatim (6600-6628): `POST /api/oauth/claude/start` → `startClaudePkceFlow()`; `POST /api/oauth/claude/complete` → validate `{flowId, code}`, `completeClaudePkceFlow`, `llm = await initLLM()`, return `{ ok: true, oauth: oauthStatus() }`; `POST /api/oauth/claude/logout` → `clearOAuth('claude')` + async re-init. `/api/oauth/status` and `/api/llm/status` need **no change** — they spread `oauthStatus()` (6562, 6568).

---

## 4. Provider seam — subscription Claude as a chat/mission backend

### 4.1 Decision: extend `anthropic`, do not add a new provider id

- **Chosen:** one provider id `anthropic` with two auth modes, exactly the `xai` precedent (one id; `peekOAuthAccessToken('xai') || getApiKey('xai')`, OAuth-wins rationale at `src/config/index.ts:583-588`; OAuth-aware validation at `src/llm/index.ts:603-609`).
- **Why not the `chatgpt` precedent (separate id):** that split exists because ChatGPT Plan rides a *different backend and wire* (`chatgpt.com/backend-api/codex`, Responses — `src/config/index.ts:243-247`). Subscription Claude hits the **same** `api.anthropic.com/v1/messages` Messages wire as API-key Claude (§2.2), so a second adapter/id would duplicate `AnthropicAdapter` (`src/llm/index.ts:452-587`) for zero benefit and churn the `LLMProvider` union (`src/types/index.ts:9`), UI provider lists, and the backbone ladder (`src/llm/index.ts:2224-2231`). No `src/types/index.ts` change needed.
- Consequences that follow the xai pattern exactly: `getConfiguredProviders()` counts anthropic when `hasApiKey('anthropic') || hasOAuth('claude')` (`src/config/index.ts:516-517` precedent); `getLLMConfig()` case `'anthropic'` becomes `apiKey = peekOAuthAccessToken('claude') || this.getApiKey('anthropic')` (mirrors 583-588 — subscription usage is not silently billed as metered API credits); `oauthHydrated` adds `actualProvider === 'anthropic' && hasOAuth('claude')` (676-683); fallback-chain hops hydrate the same way (718-724).

### 4.2 `AnthropicAdapter` OAuth-Bearer path — `src/llm/index.ts`

- Header build (526-530) branches on `this.config.authType === 'oauth'`:
  - API-key mode (default): unchanged — `x-api-key` + `anthropic-version` (asserted by `src/__tests__/oauth-adapters.test.ts:12-35`).
  - OAuth mode: `Authorization: Bearer <token>`, **no `x-api-key`**, `anthropic-version: 2023-06-01`, plus `anthropic-beta: oauth-2025-04-20` (§2.2). If a future beta list exists, append rather than replace.
- `validateConfig` (460-468) mirrors the xai OAuth messaging (603-609): when `authType === 'oauth'` and no token, error becomes "Claude sign-in required. Sign in from Settings → Subscription sign-in." (honest missing-sign-in error, never a silent provider swap — chatgpt precedent at `src/config/index.ts:634-638`).
- Missions/backbones get the subscription automatically: `initLLM` → `selectServerLLMConfig` → `getLLMConfig('anthropic')` hydrates the OAuth token; the backbone ladder's anthropic rung (`src/llm/index.ts:2224-2226`) now fires when only a Claude sign-in exists (no `ANTHROPIC_API_KEY`, `.env.example:8`).
- The provider-401 body from Anthropic's third-party block ("This credential is only authorized for use with Claude Code…", §2.4) must surface verbatim-sanitized in the mission/chat error path — it already flows through `AnthropicAdapter`'s error handling (539-557); no special-casing, no suppression.

### 4.3 Streaming eligibility — `STREAMABLE_PROVIDERS`

- **Decision for phase 34: `anthropic` stays out of `STREAMABLE_PROVIDERS`** (`src/chat/chat-route.ts:26-38`). Rationale: (a) `/v1/messages` is not OpenAI-compatible and `defaultCreateModel` builds every stream from `createOpenAICompatible` (`src/chat/chat-route.ts:90-95`); (b) the exact precedent — `chatgpt` is *also* absent from the map, making ChatGPT Plan mission/backbone-only today (§1.5); (c) the only OpenAI-compatible candidate endpoint (`api.anthropic.com/v1/chat/completions`) is unverified for OAuth bearers (**OPEN**, §2.2).
- **Follow-up hook (out of scope, documented):** if verified, add `anthropic: true` to `STREAMABLE_PROVIDERS` and extend `defaultCreateModel` to pass `headers: { 'anthropic-version', 'anthropic-beta' }` — `createOpenAICompatible` already supports a `headers` option (`node_modules/@ai-sdk/openai-compatible/dist/index.d.ts:340-359`) and `apiKey` supplies the Bearer. Until then Claude serves `/api/llm/chat`, missions, and operators — not `/api/chat`/`/api/genui` streaming.
- Token freshness on the mission path: `resolveStreamingConfig`'s refresh pattern (`src/chat/streaming-config.ts:40-61`) is the model; the backbone path re-hydrates per `initLLM()` re-init on login/logout (§3.7). `oauthVendorForProvider` gains `if (provider === 'anthropic') return 'claude'` (560-564) — guarded by `hasOAuth` at every call site (streaming-config.ts:45), so API-key anthropic is untouched.

### 4.4 Model defaults for Max 20x

No code change: `anthropic.defaultModel` already exists and is user-settable (`src/config/index.ts:175-178, 804-806`), currently `claude-opus-4-8` (§2.5). Implementation note: at E2E, confirm the served id for a Max 20x account and update the config default once (candidate: `claude-opus-5-5`, https://support.claude.com/en/articles/12138966-release-notes); alias resolution over OAuth is **OPEN** (§2.5).

---

## 5. Session UI

### 5.1 Login card states (both surfaces render the same state machine)

| State | Trigger | Render |
|---|---|---|
| Signed out | `!connected` | "Sign in with Claude" primary button; body: "Browser PKCE against your Claude Pro/Max plan. Bills against your subscription." |
| Authorizing | after `/api/oauth/claude/start` returns `{ flowId, authorizeUrl, state }` | clickable `authorizeUrl` (opens browser), paste box for the callback code, Complete button, 15-min expiry hint; error toast on non-2xx (`502` from start, `400` from complete — mirrors `src/server.ts:6600-6622`) |
| Signed in + tier | `connected && !needsReauth` | "Connected" badge, `tier` when present (`Max 20x`), `Expires {formatTime(expiresAt)}` (Overview already renders this — `ui/src/pages/Overview.tsx:228-230`), Sign out button |
| Refresh-expired | `needsReauth === true` | warning badge "Sign-in expired — sign in again"; Sign-in button re-armed; the pasted-code flow restarts cleanly (pending map is per-flow, TTL-bounded) |

Confidentiality: card shows only `connected/expiresAt/label/tier` from `oauthStatus()` — tokens never leave the server (`src/llm/oauth.ts:1-4` charter; `/api/llm/status` never echoes keys, `src/server.ts:6552-6564`).

### 5.2 Where they render

- **Settings surface (primary):** `docs/settings.html` Subscription sign-in card (26-61) — add a "Claude Pro/Max" provider card beside ChatGPT (42-47) with the states above, driven from the inline script's `settingsApi('/api/oauth/…')` helpers; `/api/oauth/claude/*` literals must appear in the file (static guard, §6).
- **SPA Overview:** the Subscriptions card (`ui/src/pages/Overview.tsx:213-236`) picks the claude row up automatically once `OAuthVendor`/`OAuthStatus` client types are extended (`ui/src/api/client.ts:57, 86-94`) — add tier/needsReauth badges there. Verified shape: the card maps over `Object.entries<OAuthStatus>(d)` rendering `status.label`, Connected badge, and `Expires` — a superset render for tier needs one conditional span, nothing structural.

### 5.3 One-time old-surface notice

Users who previously relied on the "Claude Code (local CLI)" card (`docs/settings.html:36-41`) must learn the login moved in-app. Design: the Claude card in settings shows a dismissible notice strip — "Claude now signs in directly with your Anthropic account (Pro/Max). The local Claude Code CLI still works — connect it under Local agents." — dismissed via `localStorage['pt.claude-oauth-notice'] = '1'` (per-browser, static-page-friendly; SPA Overview needs no notice — it never had a Claude login). The local-CLI card itself is **not removed** (it remains the ToS-clean path and the fallback for §7 R1); its description text is updated to point OAuth-less users at it. `docs/index.html` status row (39-47) gains the Claude badge + count.

---

## 6. Changed files, test plan, risks, open questions

### Changed files (real paths only)

| File | Change |
|---|---|
| `src/llm/oauth.ts` | `claude` vendor: constants + env overrides, `pendingClaude`, `startClaudePkceFlow`, `parseClaudeAuthCode`, `completeClaudePkceFlow`, `refreshClaude`, `oauthStatus` entry (+`tier`/`needsReauth`), `StoreFile.claude`/`claudeTier`, single-flight refresh, `oauthVendorForProvider('anthropic')`; delete the "Claude … deliberately not handled" header note (10-11) |
| `src/config/index.ts` | `getLLMConfig` case `'anthropic'` OAuth-wins hydration (572-576 → xai pattern 583-588); `getConfiguredProviders` `hasOAuth('claude')` (516-517 area); `oauthHydrated` (676-683) |
| `src/llm/index.ts` | `AnthropicAdapter` Bearer+beta header branch + OAuth validation message (452-587) |
| `src/server.ts` | `/api/oauth/claude/start\|complete\|logout` beside the OpenAI trio (6600-6628) |
| `docs/settings.html` | Claude Pro/Max login card + one-time notice + local-CLI card copy (26-61, inline script 132-538) |
| `docs/index.html` | Claude status badge in the subscriptions row (39-47) |
| `docs/API_REFERENCE.md` | `/api/oauth/claude/*` rows in the OAuth table (241-248) |
| `docs/GETTING_STARTED.md` | Fix the stale "Anthropic PKCE" claim to describe the real surface (159-163) |
| `ui/src/api/client.ts` | `OAuthVendor` += `'claude'` (57); `OAuthStatus` += `tier?`/`needsReauth?` (86-92) |
| `ui/src/pages/Overview.tsx` | tier / re-auth badges in the Subscriptions card (219-235) |
| `src/__tests__/oauth-claude.test.ts` | new — full vendor suite (below) |
| `src/__tests__/oauth-adapters.test.ts` | claude OAuth-Bearer + beta-header test beside the xai one (37-60) |
| `src/__tests__/oauth-ui-static.test.ts` | settings.html card/label/route-literal assertions |
| `src/__tests__/oauth-openai-routes-static.test.ts` | (or sibling) server route-literal assertions for `/api/oauth/claude/*` |

Unchanged on purpose: `src/types/index.ts` (no new provider id, §4.1), `src/agent/local-agents.ts` (§1.2), `.env.example` (code-only env precedent, §3.1), `src/chat/chat-route.ts` / `src/chat/streaming-config.ts` (vendor map change in oauth.ts suffices; streaming stays out, §4.3).

### Test plan (mirrors `oauth-openai.test.ts` mechanics: `fakeFetch`, `T3MP3ST_OAUTH_STORE` temp store, `__setOAuthNow`, `__resetOAuthState`)

1. **Authorize URL build:** `startClaudePkceFlow()` returns `flowId`/`state`; URL host `claude.ai`, params include `client_id=9d1c250a-…`, `redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback`, `code_challenge_method=S256`, `state`, `code=true`, `scope=user%3Ainference+user%3Aprofile`; challenge = base64url(sha256(verifier)) recomputed from the exchanged verifier.
2. **Env overrides:** `T3MP3ST_CLAUDE_OAUTH_CLIENT_ID/_AUTHORIZE/_TOKEN` honored (clone of lines 70-86).
3. **Allowlist:** non-https / off-host authorize+token URLs rejected (clone 88-93).
4. **Callback parse:** raw code, `code#state`, full URL (clone 95-100).
5. **Exchange:** token POST body is JSON with `grant_type=authorization_code`, `code_verifier`, `scope`; headers include `anthropic-beta: oauth-2025-04-20` and **no** `claude-cli` UA; store file 0600; `oauthStatus()` carries no secrets; `expires_in: 28800` → `expiresAt` 8 h out via clock override.
6. **CSRF/state:** mismatched state and unknown/expired `flowId` reject and clear the flow (clone 146-152).
7. **Tier:** profile fetch populates `tier: 'Max 20x'` from `rate_limit_tier: 'default_claude_max_20x'`; profile failure degrades to no-tier; account/email fields never persisted.
8. **Refresh:** expiring token (clock override past `REFRESH_SKEW_MS`) refreshes with `grant_type=refresh_token` + scope + beta header; **new refresh token replaces old**; rotation race: two concurrent `ensureOAuthAccessToken('claude')` produce exactly one token-endpoint round-trip (single-flight).
9. **Refresh-expired:** `invalid_grant` past expiry throws sanitized error and sets `needsReauth` in status; transient failure before expiry keeps the old token (clone 194-210 + `src/llm/oauth.ts:552-556`).
10. **Adapter headers (`oauth-adapters.test.ts`):** `authType:'oauth'` anthropic backbone POSTs `/v1/messages` with `Authorization: Bearer …`, no `x-api-key`, `anthropic-beta: oauth-2025-04-20`, `anthropic-version: 2023-06-01`; API-key mode stays byte-identical to the existing test (12-35).
11. **Config hydration:** `getLLMConfig('anthropic')` with signed-in claude returns OAuth token + `authType:'oauth'`, OAuth-wins-over-API-key; `getConfiguredProviders()` includes anthropic on sign-in alone.
12. **Static guards:** settings.html/API_REFERENCE contain the card + `/api/oauth/claude/*` literals; server contains the route literals (clone `oauth-ui-static.test.ts` / `oauth-openai-routes-static.test.ts`).
13. **Manual E2E gate (not CI):** real sign-in on a Max 20x account — login, tier display, one refresh, one `/v1/messages` call, logout. This is the §7 R1 probe.

### Risks

- **R1 — Provider enforcement (dominant).** Anthropic blocks subscription-OAuth inference from third-party clients (Jan/Apr 2026 server blocks; Feb 2026 ToS — §2.4) and this repo already removed this feature once for those exact terms (`docs/CHANGELOG.md:13`). E2E inference may 401/403 regardless of correct flow mechanics. Mitigations: no Claude-Code identity spoofing (also technically counterproductive — UA blocking 404s, §2.1); provider error text surfaced verbatim-sanitized (§4.2); every constant env-overridable (§3.1); local-CLI path retained and re-pointed as the fallback (§5.3); test plan separates flow mechanics (CI, injected fetch) from inference reality (manual gate 13). If the gate fails, the honest outcomes are (a) keep login/refresh/tier as a session surface only and document that inference is provider-blocked, or (b) revert — decision belongs to the orchestrator/user, not this doc.
- **R2 — Undocumented, moving endpoints.** Hosts already migrated once (§2.1); response shapes are community-sourced. Mitigation: allowlist + env overrides; defensive parsing (`parseTokenResponse` already tolerates missing fields); tier/profile failures non-fatal.
- **R3 — Rotating refresh tokens.** Single-use tokens + concurrent callers = `invalid_grant` lockout (§3.4). Mitigation: single-flight refresh; `needsReauth` state makes recovery obvious.
- **R4 — Token-endpoint 429 traps.** Missing beta header / form-encoding / missing scope each trigger 429 (§2.1). Mitigation: exact request shape pinned by tests 5/8.
- **R5 — Scope/tier mismatch.** Tier display needs `user:profile` (§2.3); requesting it is in the default scope; a token minted elsewhere without it degrades gracefully (no tier, inference unaffected).
- **R6 — Secret hygiene.** Same posture as existing vendors: 0600 store, tokens never echoed/logged; tier persists only non-secret strings; account email in the token/profile responses is deliberately dropped (§3.3/§3.5).

### Open questions

1. **E2E inference (blocks R1 verdict):** does `Bearer`+`oauth-2025-04-20` on `api.anthropic.com/v1/messages` succeed from this app for a Max 20x account today? Only a live probe answers it (test 13). [INFERENCE] Current evidence says it may not (§2.4).
2. **OpenAI-compat endpoint + OAuth (gates §4.3 follow-up):** unverified whether `/v1/chat/completions` accepts the OAuth bearer — no source found either way.
3. **Exact callback URL shape** (`code` as query param vs page-rendered text only) — the parser handles all three input forms, but the E2E should confirm which one users actually see.
4. **Remote revocation:** no documented consumer-token revocation endpoint; logout stays local (§3.5).
5. **Profile response keys** (`has_claude_max`, `rate_limit_tier`, …) are community-sourced; confirm at E2E and adjust the tier map once.
6. **Model id served to Max 20x over OAuth** (and whether aliases like `opus` resolve) — set the config default after the live check (§4.4).
7. **`localhost:54545` loopback report** is single-sourced (§3.6); irrelevant to the pasted-code design but worth re-checking if Anthropic deprecates `code=true`.
