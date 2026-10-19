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
import type { LLMConfig, LLMProvider } from '../types/index.js';

export interface StreamingModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  /** How `apiKey` is presented. OAuth uses Bearer; API-key uses the provider header. */
  authType?: 'api-key' | 'oauth';
}

export interface StreamingConfigOverride {
  provider?: string;
  model?: string;
}

export interface LlmOption {
  id: string;
  label: string;
  streamable: boolean;
  connected: boolean;
  models: string[];
  note?: string;
}

export interface LlmOptions {
  active: { provider: string; model: string };
  providers: LlmOption[];
}

const STATIC_MODELS: Record<string, readonly string[]> = {
  openrouter: ['anthropic/claude-opus-4.8', 'openai/gpt-4.1'],
  xai: ['grok-build-0.1', 'grok-4'],
  chatgpt: ['gpt-5.1'],
  openai: ['gpt-4-turbo-preview', 'gpt-4o'],
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-5'],
  venice: ['llama-3.3-70b'],
};

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
export async function resolveStreamingConfig(
  override?: StreamingConfigOverride,
): Promise<StreamingModelConfig> {
  const provider = override?.provider?.trim();
  const model = override?.model?.trim();
  const selected = provider || model
    ? config.getLLMConfig(provider ? provider as LLMProvider : undefined, model || undefined)
    : selectServerLLMConfig();
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
    authType: selected.authType,
  };
}

function configuredDefaultModel(id: string): string {
  if (id === 'openrouter' || id === 'xai' || id === 'chatgpt' || id === 'openai' || id === 'anthropic' || id === 'venice') {
    return config.get(id).defaultModel;
  }
  return '';
}

function optionConnected(id: string): boolean {
  if (id === 'openrouter') return config.hasApiKey('openrouter');
  if (id === 'venice') return config.hasApiKey('venice');
  if (id === 'openai') return config.hasApiKey('openai') || hasOAuth('openai');
  if (id === 'xai') return config.hasApiKey('xai') || hasOAuth('xai');
  if (id === 'chatgpt') return hasOAuth('openai');
  if (id === 'anthropic') return config.hasApiKey('anthropic') || hasOAuth('claude');
  return false;
}

/** Server LLM picker. No network calls; keys are never included. */
export async function listLlmOptions(): Promise<LlmOptions> {
  const active = selectServerLLMConfig();
  const providers: LlmOption[] = [
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'xai', label: 'xAI', note: 'SuperGrok sign-in or an xAI API key.' },
    { id: 'chatgpt', label: 'ChatGPT', note: 'ChatGPT Plan sign-in. No API key.' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Claude', note: 'Claude Pro/Max sign-in or an Anthropic API key.' },
    { id: 'venice', label: 'Venice' },
  ].map((entry) => {
    const configured = configuredDefaultModel(entry.id);
    const models: string[] = [];
    for (const model of [configured, ...(STATIC_MODELS[entry.id] ?? [])]) {
      if (model && !models.includes(model)) models.push(model);
    }
    return {
      id: entry.id,
      label: entry.label,
      streamable: true,
      connected: optionConnected(entry.id),
      models,
      ...(entry.note ? { note: entry.note } : {}),
    };
  });
  return {
    active: { provider: active.provider, model: active.model },
    providers,
  };
}
