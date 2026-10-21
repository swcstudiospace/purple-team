---
status: passed_with_open_validation
phase: 34-claude-oauth-pkce
verified: 2026-10-21
score: 5 of 5 claimed deliverable groups confirmed in code; 1 manual gate open (R1)
suite_observed: npx vitest run on oauth-claude, oauth-adapters, oauth-ui-static, oauth, oauth-openai-routes-static: 5 files, 47 tests passed
---

# Phase 34 Verification: Claude Subscription OAuth (PKCE)

## Verified against code

| Claim (34-01-SUMMARY) | Evidence |
|---|---|
| PKCE S256, single-use state, pasted-callback completion | `src/llm/oauth.ts` `parseClaudeAuthCode` (line 567) and the pending-flow store |
| Single-flight rotating refresh | `src/llm/oauth.ts:157` `claudeRefreshFlight`, `:869-873` |
| `anthropic-beta: oauth-2025-04-20` on OAuth requests | `src/llm/oauth.ts:115` `CLAUDE_OAUTH_BETA`, used at `:725`, `:767`, `:813`; provider adapter `src/llm/index.ts:543` |
| Tier from profile, graceful when absent | `src/llm/oauth.ts:790-823` (`rate_limit_tier` to label; unknown tiers pass through) |
| `needsReauth` surfaced without secrets | `src/llm/oauth.ts:343` |
| Env overrides for client id, authorize URL and token URL | `src/llm/oauth.ts:208`, `:212`, `:216` |
| Provider seam maps `anthropic` to the `claude` vendor under OAuth | `src/llm/oauth.ts:877` `oauthVendorForProvider`; `src/llm/index.ts:1904`, `:1932` |
| Routes: start, complete, logout | `src/server.ts:6716`, `:6724`, `:6740` |
| Anthropic stays out of streamable providers (D7) | `src/chat/chat-route.ts:32` and guard at `:310` |
| 0600 token store, atomic write | `src/llm/oauth.ts:300-301` |

Test run this pass: 47 of 47 passed across the five OAuth suites.

## Open

- **R1, manual gate (user):** live login, refresh and inference with a real Claude Pro/Max account. Not exercised here. Per decision D6, if Anthropic blocks inference, login and tier stay and the local CLI remains the runnable path.
