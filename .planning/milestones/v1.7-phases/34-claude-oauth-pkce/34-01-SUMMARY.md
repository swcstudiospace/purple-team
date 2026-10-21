# 34-01 Summary — Claude Subscription OAuth (PKCE)

**Phase:** 34 · **Refs:** SPE-15995 · **Completed:** 2026-10-19 · **Branch:** `v1.7-github-claude-agentpanel`

## Shipped

- **`claude` OAuth vendor** (`src/llm/oauth.ts`): PKCE S256 + single-use state, pasted-callback completion (`parseClaudeAuthCode`), JSON-body token exchange with `anthropic-beta: oauth-2025-04-20` and no CLI-UA spoofing, single-use rotating refresh tokens persisted atomically with module-level single-flight (`claudeRefreshFlight`), 0600 store, env overrides (`T3MP3ST_CLAUDE_OAUTH_CLIENT_ID/_AUTHORIZE/_TOKEN`), tier signal from `/api/oauth/profile` (`rate_limit_tier` → "Max 20x") with graceful no-tier degradation, `needsReauth` state, `oauthVendorForProvider('anthropic') → 'claude'`.
- **Provider seam** (`src/llm/index.ts`): `AnthropicAdapter` OAuth-Bearer branch (drops `x-api-key`, adds beta header); explicit-token precedence fix at both backbone override sites (a pinned OAuth token that differs from the stored one now wins; store refresh is refresh-in-place only) — this was a latent main bug exposed by a live store.
- **Config** (`src/config/index.ts`): anthropic OAuth-wins hydration (xai pattern); `getConfiguredProviders` includes OAuth-connected claude.
- **Routes** (`src/server.ts`): `/api/oauth/claude/start | complete | logout` beside the OpenAI trio; status via existing `/api/oauth/status`.
- **Session UI**: settings.html Claude Pro/Max card (signed-out → authorizing w/ paste box → signed-in + tier + expiry → needsReauth warn + one-time old-surface notice, dismissible), local-CLI card copy re-pointed; index.html + overview.html keyless badge row; SPA `client.ts` types + Overview Subscriptions tier/re-auth badges.
- **Docs**: API_REFERENCE OAuth table rows; GETTING_STARTED stale "Anthropic PKCE" claim corrected.

## Verification (evidence)

- `npx vitest run` oauth-claude + oauth-adapters + oauth-ui-static + oauth-openai-routes-static + oauth.test.ts → **46/46 passed**.
- `npm run test:pr` (lint → typecheck → 1317-test suite → doctor → ui:typecheck → ui:build) → **full chain green** (31.8 s final run; only pre-existing advisory chunk-size warning).
- Corrective loop: 2 failures found on first verify (xai adapter store-leak, single-flight miscount) → FixClaudeOAuthWave → green; `phase28-staged-consumers` mirror restored.

## Known state / open items

- **R1 (manual E2E gate, user validation):** live login → refresh → inference with a real Max 20x account is not exercised here — requires the operator's Anthropic credentials. Mechanics are unit-proven with injected fetch; endpoints are community-sourced and env-overridable. If Anthropic's third-party blocks bite, D6 applies (login/tier stand; local-CLI stays the runnable path; errors surfaced verbatim-sanitized).
- Anthropic stays out of `STREAMABLE_PROVIDERS` (D7) — missions only, chatgpt precedent.
- No remote revocation endpoint exists for consumer tokens; logout is local (documented in 34-CONTEXT §3.5).
