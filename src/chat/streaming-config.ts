/**
 * Resolves the model config for the streaming routes (/api/chat, /api/genui/generate).
 *
 * The provider choice mirrors initLLM() and /api/llm/status in src/server.ts: the
 * configured default provider wins when it has a key; otherwise a signed-in
 * subscription (SuperGrok, then ChatGPT Plan) is used. OAuth tokens are refreshed
 * before use, because config.getLLMConfig() only peeks the stored access token.
 *
 * Keys never appear in error messages or logs.
 */

import { config } from '../config/index.js';
import { ensureOAuthAccessToken, hasOAuth, oauthVendorForProvider } from '../llm/oauth.js';
import type { LLMConfig } from '../types/index.js';

export interface StreamingModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/** Same provider choice as initLLM() in src/server.ts. The token may be stale until refreshed. */
export function selectServerLLMConfig(): LLMConfig {
  let llmConfig = config.getLLMConfig();
  // Mirrors providerNeedsApiKey() in src/server.ts; keyless providers never fall back to OAuth.
  const needsKey = !['codex', 'mock', 'local', 'local-agent', 'cursor'].includes(llmConfig.provider);
  if (needsKey && !llmConfig.apiKey) {
    if (hasOAuth('xai')) llmConfig = config.getLLMConfig('xai');
    else if (hasOAuth('openai')) llmConfig = config.getLLMConfig('chatgpt');
  }
  return llmConfig;
}

/**
 * Returns the provider, model, key and base URL that the streaming routes should use.
 * When the selected provider runs on a subscription token, that token is refreshed first.
 * Throws a sanitized error if the refresh fails; the caller turns it into a 503.
 */
export async function resolveStreamingConfig(): Promise<StreamingModelConfig> {
  const selected = selectServerLLMConfig();
  let apiKey = selected.apiKey;

  const vendor = oauthVendorForProvider(selected.provider);
  if (vendor && hasOAuth(vendor)) {
    try {
      apiKey = (await ensureOAuthAccessToken(vendor)) ?? apiKey;
    } catch {
      // Provider error details can echo credentials, so only the vendor is logged.
      console.warn(`[llm] ${vendor} OAuth token refresh failed; sign in again`);
      throw new Error(`${vendor} OAuth session expired`);
    }
  }

  return {
    provider: selected.provider,
    model: selected.model,
    apiKey,
    baseUrl: selected.baseUrl,
  };
}
