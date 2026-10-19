/**
 * T3MP3ST Configuration Management
 *
 * Handles API keys, settings, and persistent configuration.
 * Supports multiple LLM providers with easy key management.
 */

import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { LLMProvider, LLMConfig, FallbackEntry, OpsecLevel } from '../types/index.js';
import { hasOAuth, peekOAuthAccessToken } from '../llm/oauth.js';

type ApiKeyProvider = 'openrouter' | 'venice' | 'anthropic' | 'openai' | 'xai' | 'gemini' | 'litellm' | 'deepseek' | 'zai' | 'huggingface' | 'nanogpt' | 'novita' | 'local';

// =============================================================================
// CONFIGURATION SCHEMA
// =============================================================================

export interface TempestSettings {
  // API Keys
  apiKeys: {
    openrouter?: string;
    venice?: string;
    anthropic?: string;
    openai?: string;
    xai?: string;
    gemini?: string;
    deepseek?: string;
    zai?: string;
    huggingface?: string;
    nanogpt?: string;
    litellm?: string;
    novita?: string;
    local?: string;
  };

  // Default LLM settings
  defaultProvider: LLMProvider;
  defaultModel: string;

  // OpenRouter specific
  openrouter: {
    baseUrl: string;
    defaultModel: string;
    siteUrl?: string;
    siteName?: string;
  };

  // Venice AI — OpenAI-compatible, privacy-focused (same wire shape as OpenRouter)
  venice: {
    baseUrl: string;
    defaultModel: string;
  };

  // Anthropic specific
  anthropic: {
    baseUrl: string;
    defaultModel: string;
  };

  // OpenAI specific
  openai: {
    baseUrl: string;
    defaultModel: string;
  };

  // xAI — Grok Build / Grok models (OpenAI-compatible API)
  xai: {
    baseUrl: string;
    defaultModel: string;
  };

  // LiteLLM AI gateway proxy — routes to 100+ LLM providers via unified API
  litellm: {
    baseUrl: string;
    defaultModel: string;
  };

  // Google Gemini — native Gemini API via its OpenAI-compatible endpoint
  gemini: {
    baseUrl: string;
    defaultModel: string;
  };

  // DeepSeek — OpenAI-compatible API
  deepseek: {
    baseUrl: string;
    defaultModel: string;
  };

  // Z.ai — general API only (not the GLM Coding Plan endpoint)
  zai: {
    baseUrl: string;
    defaultModel: string;
  };

  // Hugging Face — open models via the OpenAI-compatible Inference Providers router
  huggingface: {
    baseUrl: string;
    defaultModel: string;
  };

  // NanoGPT — OpenAI-compatible text API
  nanogpt: {
    baseUrl: string;
    defaultModel: string;
  };

  // Novita AI — OpenAI-compatible API serving open-source and frontier models
  novita: {
    baseUrl: string;
    defaultModel: string;
  };

  // Codex CLI/account subscription backend
  codex: {
    command: string;
    defaultModel: string;
  };

  // ChatGPT Plan — Codex backend over the ChatGPT subscription (OAuth sign-in, no API key).
  chatgpt: {
    baseUrl: string;
    defaultModel: string;
  };

  // General settings
  maxTokens: number;
  temperature: number;
  timeout: number;

  // OPSEC defaults
  opsec: {
    level: OpsecLevel;
    maxDetectionEvents: number;
    cleanupOnComplete: boolean;
  };

  // UI preferences
  ui: {
    showBanner: boolean;
    colorOutput: boolean;
    verboseLogging: boolean;
  };

  // Outbound SOCKS5 proxy for test/attack traffic (socks5://[user:pass@]host:port).
  // Empty/unset = egress from the operator's own IP. See src/net/proxy.ts.
  proxyUrl?: string;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_SETTINGS: TempestSettings = {
  apiKeys: {},

  defaultProvider: 'openrouter',
  defaultModel: 'anthropic/claude-opus-4.8',

  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-opus-4.8',
    siteUrl: 'https://github.com/tempest',
    siteName: 'Purple Team',
  },

  venice: {
    baseUrl: 'https://api.venice.ai/api/v1',
    defaultModel: 'llama-3.3-70b',
  },

  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-opus-4-8',
  },

  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-turbo-preview',
  },

  xai: {
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-build-0.1',
  },

  litellm: {
    baseUrl: 'http://localhost:4000/v1',
    defaultModel: 'gpt-4o',
  },

  // Gemini's OpenAI-compatible surface lives under /v1beta/openai. The OpenAIAdapter posts to
  // `${baseUrl}/chat/completions`, so the /openai path segment is REQUIRED here — without it,
  // requests hit /v1beta/chat/completions, which is not a valid Gemini endpoint.
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
  },

  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-pro',
  },

  // Z.ai — general API only (not the GLM Coding Plan endpoint)
  zai: {
    baseUrl: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-5.3',
  },

  // Hugging Face Inference Providers expose a unified OpenAI-compatible router at
  // /v1. The OpenAIAdapter posts to `${baseUrl}/chat/completions`, so the base URL
  // ends at /v1 → https://router.huggingface.co/v1/chat/completions. Model ids are
  // the full HF repo id (e.g. meta-llama/Llama-3.3-70B-Instruct), optionally with a
  // `:provider` suffix to pin a specific inference backend.
  huggingface: {
    baseUrl: 'https://router.huggingface.co/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
  },

  // NanoGPT's canonical OpenAI-compatible base. The OpenAIAdapter appends
  // /chat/completions and provider-models appends /models.
  nanogpt: {
    baseUrl: 'https://nano-gpt.com/api/v1',
    defaultModel: 'minimax/minimax-m2.7',
  },

  // Novita AI's OpenAI-compatible surface. The OpenAIAdapter appends
  // /chat/completions and provider-models appends /models.
  novita: {
    baseUrl: 'https://api.novita.ai/openai/v1',
    defaultModel: 'zai-org/glm-5.2',
  },

  codex: {
    command: 'codex',
    defaultModel: 'codex-default',
  },

  // ChatGPT Plan rides the Codex backend (Responses wire) with ChatGPT-subscription
  // OAuth — the same public-client flow the Codex CLI uses (see src/llm/oauth.ts).
  chatgpt: {
    baseUrl: 'https://chatgpt.com/backend-api/codex',
    defaultModel: 'gpt-5.1',
  },

  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000,

  opsec: {
    level: 'covert',
    maxDetectionEvents: 3,
    cleanupOnComplete: true,
  },

  ui: {
    showBanner: true,
    colorOutput: true,
    verboseLogging: false,
  },

  proxyUrl: '',
};

export function migrateLegacyDeepSeekSettings(
  settings: TempestSettings['deepseek'],
): TempestSettings['deepseek'] {
  const migrated = { ...settings };

  // DeepSeek retires these compatibility aliases on 2026-07-24. Only migrate
  // the exact historical defaults; operator-selected model IDs and endpoints
  // remain untouched.
  if (migrated.defaultModel === 'deepseek-chat') {
    migrated.defaultModel = 'deepseek-v4-flash';
  } else if (migrated.defaultModel === 'deepseek-reasoner') {
    migrated.defaultModel = 'deepseek-v4-pro';
  }
  if (migrated.baseUrl === 'https://api.deepseek.com/v1') {
    migrated.baseUrl = 'https://api.deepseek.com';
  }

  return migrated;
}

// =============================================================================
// MODEL REGISTRY
// =============================================================================

export const KNOWN_LLM_PROVIDERS: Record<LLMProvider, true> = {
  openrouter: true, venice: true, anthropic: true, openai: true, xai: true,
  gemini: true, litellm: true, deepseek: true, zai: true, huggingface: true,
  nanogpt: true, novita: true, codex: true, chatgpt: true, cursor: true,
  mock: true, local: true, "local-agent": true,
};

// Provider ids only. Model lists come from each provider live catalog via /api/models.
export const LLM_PROVIDER_IDS: readonly LLMProvider[] = Object.keys(KNOWN_LLM_PROVIDERS) as LLMProvider[];
// =============================================================================
// CONFIGURATION MANAGER
// =============================================================================

class ConfigManager {
  private config: Conf<TempestSettings>;
  private envLoaded: boolean = false;

  constructor() {
    this.config = new Conf<TempestSettings>({
      projectName: 't3mp3st',
      defaults: DEFAULT_SETTINGS,
    });

    const deepseek = this.config.get('deepseek');
    const migratedDeepSeek = migrateLegacyDeepSeekSettings(deepseek);
    if (
      migratedDeepSeek.baseUrl !== deepseek.baseUrl ||
      migratedDeepSeek.defaultModel !== deepseek.defaultModel
    ) {
      this.config.set('deepseek', migratedDeepSeek);
    }

    this.loadEnvVariables();
  }

  /**
   * Load API keys from environment variables
   */
  private loadEnvVariables(): void {
    if (this.envLoaded) return;

    // Load only T3MP3ST-owned/home env files. Do NOT read process.cwd()/.env:
    // operators often run T3MP3ST inside target repos, and importing that repo's
    // secrets would contaminate this process with unrelated credentials.
    const envPaths = [
      join(homedir(), '.t3mp3st', '.env'),
      join(homedir(), '.env'),
    ];

    let envProvider: string | undefined;

    for (const envPath of envPaths) {
      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');
        // Validation variables added
        const VALID_PROVIDERS = ['openrouter', 'venice', 'anthropic', 'openai', 'xai', 'gemini', 'litellm', 'deepseek', 'zai', 'huggingface', 'nanogpt', 'local'];

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            // Real env vars take precedence over the .env file (standard dotenv
            // semantics): only fill a key that is not already set. This also lets a
            // caller force an UNCONFIGURED server (e.g. arsenal:smoke) by exporting an
            // empty OPENROUTER_API_KEY= — the .env file no longer clobbers it.
            if (key && value && process.env[key] === undefined) {
              process.env[key] = value;

              // Track LLM_PROVIDER for default provider
              if (key === 'LLM_PROVIDER' && VALID_PROVIDERS.includes(value.toLowerCase())) {
                envProvider = value.toLowerCase();
              }
            }
          }
        }
        // Set TEMPEST_DEFAULT_PROVIDER if LLM_PROVIDER found
        if (envProvider && !process.env.TEMPEST_DEFAULT_PROVIDER) {
          process.env.TEMPEST_DEFAULT_PROVIDER = envProvider;
        }
        break;
      }
    }

    // Environment variables (including values loaded from ~/.t3mp3st/.env above)
    // are intentionally process-local. getApiKey() already gives env vars highest
    // priority, so do not persist them into Conf's apiKeys store as a side effect.
    // (XAI_API_KEY / Grok Build follows the same safe path — see the envVarMap in getApiKey.)
    this.envLoaded = true;
  }

  /**
   * Get all settings
   */
  getAll(): TempestSettings {
    return this.config.store;
  }

  /**
   * Get a specific setting
   */
  get<K extends keyof TempestSettings>(key: K): TempestSettings[K] {
    return this.config.get(key);
  }

  /**
   * Set a specific setting
   */
  set<K extends keyof TempestSettings>(key: K, value: TempestSettings[K]): void {
    this.config.set(key, value);
  }

  /**
   * Set an API key for a provider
   */
  setApiKey(provider: ApiKeyProvider, key: string): void {
    const apiKeys = this.config.get('apiKeys');
    apiKeys[provider] = key;
    this.config.set('apiKeys', apiKeys);
  }

  /**
   * Outbound SOCKS5 proxy URL for test/attack traffic. Env TEMPEST_PROXY_URL wins over
   * the saved value; returns '' when egress should leave from the operator's own IP.
   */
  getProxyUrl(): string {
    const env = process.env.TEMPEST_PROXY_URL?.trim();
    if (env) return env;
    return (this.config.get('proxyUrl') || '').trim();
  }

  /** Persist the proxy URL (pass '' to clear). Does NOT install it — see net/proxy. */
  setProxyUrl(url: string): void {
    this.config.set('proxyUrl', (url || '').trim());
  }

  /**
   * Get an API key for a provider
   */
  getApiKey(provider: ApiKeyProvider): string | undefined {
    // First check environment variables (highest priority)
    // local provider: a self-hosted/OpenAI-compatible server MAY require a bearer
    // (Together, etc.) — accept TEMPEST_LOCAL_API_KEY only. Provider keys are never reused for a custom endpoint.
    if (provider === 'local') {
      const localKey = process.env.TEMPEST_LOCAL_API_KEY?.trim();
      if (localKey) return localKey;
      return this.config.get('apiKeys')[provider];
    }
    const envVarMap = {
      openrouter: 'OPENROUTER_API_KEY',
      venice: 'VENICE_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      xai: 'XAI_API_KEY',
      gemini: 'GEMINI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      zai: 'ZAI_API_KEY',
      huggingface: 'HF_TOKEN',
      nanogpt: 'NANOGPT_API_KEY',
      novita: 'NOVITA_API_KEY',
      litellm: 'LITELLM_API_KEY',
    };

    // Force a fully UNCONFIGURED server (no key from env OR the saved store) — used by
    // arsenal:smoke so the key-required / fail-closed paths are exercisable. Gated behind
    // an explicit flag so a normal operator's STORED key is NEVER silently disabled by an
    // empty exported env var (round-2 code-sweep regression fix).
    if (/^(1|true|yes|on)$/i.test((process.env.T3MP3ST_FORCE_UNCONFIGURED || '').trim())) return undefined;

    // Hugging Face publishes its token under several well-known names; accept the
    // canonical HF_TOKEN plus the common aliases so an operator's existing env works.
    if (provider === 'huggingface') {
      const hf = process.env.HF_TOKEN?.trim()
        || process.env.HUGGINGFACE_API_KEY?.trim()
        || process.env.HUGGINGFACE_TOKEN?.trim()
        || process.env.HUGGINGFACEHUB_API_TOKEN?.trim();
      if (hf) return hf;
    }

    const envKey = process.env[envVarMap[provider]];
    if (envKey) return envKey;   // a non-empty env var wins; empty/unset falls through

    // Otherwise fall back to the stored config
    return this.config.get('apiKeys')[provider];
  }

  /**
   * Check if a provider has a valid API key configured
   */
  hasApiKey(provider: ApiKeyProvider): boolean {
    const key = this.getApiKey(provider);
    return !!key && key.length > 10;
  }

  /**
   * Remove an API key
   */
  removeApiKey(provider: ApiKeyProvider): void {
    const apiKeys = this.config.get('apiKeys');
    delete apiKeys[provider];
    this.config.set('apiKeys', apiKeys);
  }

  /**
   * Check if a LiteLLM proxy is configured (base URL set via env or config)
   */
  hasLiteLLMProxy(): boolean {
    const envUrl = process.env.LITELLM_BASE_URL?.trim();
    if (envUrl) return true;
    const storedUrl = this.config.get('litellm')?.baseUrl;
    return !!storedUrl && storedUrl !== 'http://localhost:4000/v1';
  }

  /**
   * Get configured providers (those with API keys)
   */
  getConfiguredProviders(): LLMProvider[] {
    const providers: LLMProvider[] = [];

    if (this.hasApiKey('openrouter')) providers.push('openrouter');
    if (this.hasApiKey('venice')) providers.push('venice');
    if (this.hasApiKey('anthropic') || hasOAuth('claude')) providers.push('anthropic');
    if (this.hasApiKey('openai')) providers.push('openai');
    if (this.hasApiKey('xai') || hasOAuth('xai')) providers.push('xai');
    if (this.hasLiteLLMProxy()) providers.push('litellm');
    if (this.hasApiKey('gemini')) providers.push('gemini');
    if (this.hasApiKey('deepseek')) providers.push('deepseek');
    if (this.hasApiKey('zai')) providers.push('zai');
    if (this.hasApiKey('huggingface')) providers.push('huggingface');
    if (this.hasApiKey('nanogpt')) providers.push('nanogpt');
    if (this.hasApiKey('novita')) providers.push('novita');

    // Codex uses the local Codex CLI/account auth instead of API-key storage.
    providers.push('codex');

    // ChatGPT Plan is configured exactly when the 'openai' OAuth vendor has tokens —
    // same hasOAuth(...) semantics as xai (no API key in the mix).
    if (hasOAuth('openai')) providers.push('chatgpt');

    // Cursor uses the local cursor-agent CLI's own login (keyless), like codex.
    providers.push('cursor');

    // Mock and local are always available
    providers.push('mock', 'local');

    return providers;
  }

  /**
   * Get the LLM configuration for the default or specified provider
   */
  getLLMConfig(provider?: LLMProvider, model?: string): LLMConfig {
    let actualProvider = provider;

    if (!actualProvider) {
      const envProvider = process.env.TEMPEST_DEFAULT_PROVIDER?.trim();
      if (envProvider) {
        actualProvider = envProvider as LLMProvider;
      } else {
        actualProvider = this.config.get('defaultProvider');
      }
    }

    let apiKey: string | undefined;
    let baseUrl: string | undefined;
    let actualModel: string;

    switch (actualProvider) {
      case 'openrouter':
        apiKey = this.getApiKey('openrouter');
        baseUrl = this.config.get('openrouter').baseUrl;
        actualModel = model || this.config.get('openrouter').defaultModel;
        break;
      case 'venice':
        apiKey = this.getApiKey('venice');
        baseUrl = this.config.get('venice').baseUrl;
        actualModel = model || this.config.get('venice').defaultModel;
        break;
      case 'anthropic':
        // Claude Pro/Max subscription OAuth wins over ANTHROPIC_API_KEY so subscription
        // usage is not silently billed as metered API credits (same rationale as xai).
        apiKey = peekOAuthAccessToken('claude') || this.getApiKey('anthropic');
        baseUrl = this.config.get('anthropic').baseUrl;
        actualModel = model || this.config.get('anthropic').defaultModel;
        break;
      case 'openai':
        apiKey = this.getApiKey('openai');
        baseUrl = this.config.get('openai').baseUrl;
        actualModel = model || this.config.get('openai').defaultModel;
        break;
      case 'xai':
        // Grok Build / Grok — xAI's OpenAI-compatible API (native tool-calling).
        // SuperGrok / Super Grok Heavy OAuth wins over XAI_API_KEY so subscription
        // usage is not silently billed as metered API credits.
        apiKey = peekOAuthAccessToken('xai') || this.getApiKey('xai');
        baseUrl = this.config.get('xai').baseUrl;
        actualModel = model || this.config.get('xai').defaultModel;
        break;
      case 'litellm':
        apiKey = this.getApiKey('litellm');
        baseUrl = process.env.LITELLM_BASE_URL?.trim() || this.config.get('litellm').baseUrl;
        actualModel = model || process.env.LITELLM_MODEL?.trim() || this.config.get('litellm').defaultModel;
        break;
      case 'gemini':
        // Google Gemini via its OpenAI-compatible endpoint (native tool-calling).
        apiKey = this.getApiKey('gemini');
        baseUrl = this.config.get('gemini').baseUrl;
        actualModel = model || this.config.get('gemini').defaultModel;
        break;
      case 'zai':
        // Z.ai general API (OpenAI-compatible). The GLM Coding Plan endpoint is intentionally not used.
        apiKey = this.getApiKey('zai');
        baseUrl = this.config.get('zai').baseUrl;
        actualModel = model || this.config.get('zai').defaultModel;
        break;
      case 'deepseek':
        // DeepSeek native API is OpenAI-compatible.
        apiKey = this.getApiKey('deepseek');
        baseUrl = this.config.get('deepseek').baseUrl;
        actualModel = model || this.config.get('deepseek').defaultModel;
        break;
      case 'huggingface':
        // Hugging Face Inference Providers router is OpenAI-compatible.
        apiKey = this.getApiKey('huggingface');
        baseUrl = this.config.get('huggingface').baseUrl;
        actualModel = model || this.config.get('huggingface').defaultModel;
        break;
      case 'nanogpt':
        // NanoGPT's canonical /api/v1 surface is OpenAI-compatible.
        apiKey = this.getApiKey('nanogpt');
        baseUrl = this.config.get('nanogpt').baseUrl;
        actualModel = model || this.config.get('nanogpt').defaultModel;
        break;
      case 'novita':
        // Novita AI's OpenAI-compatible surface.
        apiKey = this.getApiKey('novita');
        baseUrl = this.config.get('novita').baseUrl;
        actualModel = model || this.config.get('novita').defaultModel;
        break;
      case 'codex':
        actualModel = model || this.config.get('codex').defaultModel;
        break;
      case 'chatgpt':
        // ChatGPT Plan (Codex backend) — ChatGPT-subscription OAuth is the ONLY auth
        // (no API key falls back here); missing sign-in must surface the honest
        // "ChatGPT Plan sign-in required" error, never a silent provider swap.
        apiKey = peekOAuthAccessToken('openai');
        baseUrl = process.env.T3MP3ST_CHATGPT_BASE_URL?.trim() || this.config.get('chatgpt').baseUrl;
        actualModel = model || this.config.get('chatgpt').defaultModel;
        break;
      case 'cursor':
        // Keyless local-agent backbone with a FIXED agent id ('cursor'): rides the
        // cursor-agent CLI using its own login — no API key or base URL. An
        // operator-selected model rides the `::` separator exactly like 'claude::opus'
        // (LocalAgentAdapter.parseAgentSpec), e.g. 'cursor::composer-1'.
        actualModel = model ? `cursor::${model}` : 'cursor';
        break;
      case 'local-agent':
        // Keyless backbone: the mission is routed through a connected local CLI agent
        // (Claude Code / Codex / Hermes / OpenCode / Oh My Pi), each using its own login — no API key or base
        // URL. The chosen agent id travels in `model`, optionally with the selected
        // underlying model after "::" (for example "claude::opus").
        actualModel = model || 'claude';
        break;
      case 'mock':
        actualModel = 'mock-model';
        break;
      case 'local':
        // Self-hosted, usually keyless. Defaults to Ollama; point TEMPEST_LOCAL_BASE_URL at
        // any OpenAI-compatible server (LM Studio :1234/v1, vLLM :8000/v1, llama.cpp, Zhipu/z.ai
        // /api/paas/v4) and TEMPEST_LOCAL_MODEL at the model tag you're serving.
        // Some OpenAI-compatible servers require a real bearer (Zhipu, Together, etc.) —
        // TEMPEST_LOCAL_API_KEY provides it. Provider keys (e.g. ZAI_API_KEY) are never sent to this endpoint.
        baseUrl = process.env.TEMPEST_LOCAL_BASE_URL?.trim() || 'http://localhost:11434/api';
        // Placeholder ids from the static UI are not real served model tags.
        // Treat them as unset so TEMPEST_LOCAL_MODEL (or the llama3 default) wins; a real tag
        // passed in still takes priority.
        actualModel = (model && !['local-model', 'local/ollama'].includes(model) ? model : undefined) || process.env.TEMPEST_LOCAL_MODEL?.trim() || 'llama3';
        apiKey = process.env.TEMPEST_LOCAL_API_KEY?.trim();
        break;
      default:
        throw new Error(`Unknown provider: ${actualProvider}`);
    }

    const oauthHydrated = (actualProvider === 'xai' && hasOAuth('xai'))
      || (actualProvider === 'chatgpt' && hasOAuth('openai'))
      || (actualProvider === 'anthropic' && hasOAuth('claude'));

    return {
      provider: actualProvider,
      model: actualModel,
      apiKey,
      authType: oauthHydrated ? 'oauth' : 'api-key',
      baseUrl,
      maxTokens: this.config.get('maxTokens'),
      temperature: this.config.get('temperature'),
      // Local inference is far slower than cloud APIs, so it must not inherit the cloud-tuned
      // default timeout: floor it at 120s (matching the frontend llmTimeoutFor) and let the
      // operator override via TEMPEST_LOCAL_TIMEOUT for very slow reasoning models.
      timeout: actualProvider === 'local'
        ? ((): number => {
            const parsed = Number(process.env.TEMPEST_LOCAL_TIMEOUT);
            return Number.isFinite(parsed) && parsed > 0
              ? parsed
              : Math.max(Number(this.config.get('timeout')) || 0, 120000);
          })()
        : this.config.get('timeout'),
      fallbackChain: this.buildFallbackChain(actualProvider),
    };
  }

  /**
   * Opt-in model fallback ladder. When TEMPEST_MODEL_FALLBACK is set, any primary-
   * model failure that the model can't self-recover from — a refusal, an empty 200,
   * or a hard error that survives same-model retries (rate-limit, 5xx, timeout, dead
   * key, missing model, context blowout) — escalates across the OTHER configured
   * providers in priority order (openrouter → venice → anthropic → openai), each with its own
   * key/model. OFF by default (no surprise model-switching). On a refusal the real
   * authorization context is restated — honest escalation, no jailbreak prompts
   * (see LLMBackbone.chat).
   */
  private buildFallbackChain(primary: LLMProvider): FallbackEntry[] {
    const flag = (process.env.TEMPEST_MODEL_FALLBACK || '').trim().toLowerCase();
    if (!flag || ['0', 'false', 'off', 'no'].includes(flag)) return [];
    const chain: FallbackEntry[] = [];
    const add = (p: 'openrouter' | 'venice' | 'anthropic' | 'openai' | 'xai' | 'gemini' | 'litellm' | 'deepseek' | 'zai' | 'huggingface' | 'nanogpt' | 'novita') => {
      if (p === primary) return;
      const oauthVendor = p === 'xai' ? 'xai' : p === 'anthropic' ? 'claude' : undefined;
      const oauth = oauthVendor ? hasOAuth(oauthVendor) : false;
      if (p === 'litellm' ? !this.hasLiteLLMProxy() : !(this.hasApiKey(p) || oauth)) return;
      chain.push({
        provider: p,
        model: this.config.get(p).defaultModel,
        apiKey: oauth && oauthVendor ? peekOAuthAccessToken(oauthVendor) : this.getApiKey(p),
        authType: oauth ? 'oauth' : 'api-key',
        baseUrl: this.config.get(p).baseUrl,
      });
    };
    add('openrouter');
    add('venice');
    add('litellm');
    add('anthropic');
    add('openai');
    add('xai');
    add('gemini');
    add('deepseek');
    add('zai');
    add('huggingface');
    add('nanogpt');
    add('novita');
    return chain;
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(provider: LLMProvider): void {
    this.config.set('defaultProvider', provider);

    // Also set the appropriate default model
    switch (provider) {
      case 'openrouter':
        this.config.set('defaultModel', this.config.get('openrouter').defaultModel);
        break;
      case 'venice':
        this.config.set('defaultModel', this.config.get('venice').defaultModel);
        break;
      case 'anthropic':
        this.config.set('defaultModel', this.config.get('anthropic').defaultModel);
        break;
      case 'openai':
        this.config.set('defaultModel', this.config.get('openai').defaultModel);
        break;
      case 'zai':
        this.config.set('defaultModel', this.config.get('zai').defaultModel);
        break;
      case 'deepseek':
        this.config.set('defaultModel', this.config.get('deepseek').defaultModel);
        break;
      case 'huggingface':
        this.config.set('defaultModel', this.config.get('huggingface').defaultModel);
        break;
      case 'nanogpt':
        this.config.set('defaultModel', this.config.get('nanogpt').defaultModel);
        break;
      case 'xai':
        this.config.set('defaultModel', this.config.get('xai').defaultModel);
        break;
      case 'gemini':
        this.config.set('defaultModel', this.config.get('gemini').defaultModel);
        break;
      case 'litellm':
        this.config.set('defaultModel', this.config.get('litellm').defaultModel);
        break;
      case 'codex':
        this.config.set('defaultModel', this.config.get('codex').defaultModel);
        break;
      case 'local':
        this.config.set('defaultModel', process.env.TEMPEST_LOCAL_MODEL?.trim() || 'llama3');
        break;
    }
  }

  /**
   * Set the default model for a provider
   */
  setDefaultModel(provider: LLMProvider, model: string): void {
    switch (provider) {
      case 'openrouter':
        this.config.set('openrouter', { ...this.config.get('openrouter'), defaultModel: model });
        break;
      case 'venice':
        this.config.set('venice', { ...this.config.get('venice'), defaultModel: model });
        break;
      case 'anthropic':
        this.config.set('anthropic', { ...this.config.get('anthropic'), defaultModel: model });
        break;
      case 'openai':
        this.config.set('openai', { ...this.config.get('openai'), defaultModel: model });
        break;
      case 'zai':
        this.config.set('zai', { ...this.config.get('zai'), defaultModel: model });
        break;
      case 'deepseek':
        this.config.set('deepseek', { ...this.config.get('deepseek'), defaultModel: model });
        break;
      case 'huggingface':
        this.config.set('huggingface', { ...this.config.get('huggingface'), defaultModel: model });
        break;
      case 'nanogpt':
        this.config.set('nanogpt', { ...this.config.get('nanogpt'), defaultModel: model });
        break;
      case 'xai':
        this.config.set('xai', { ...this.config.get('xai'), defaultModel: model });
        break;
      case 'gemini':
        this.config.set('gemini', { ...this.config.get('gemini'), defaultModel: model });
        break;
      case 'litellm':
        this.config.set('litellm', { ...this.config.get('litellm'), defaultModel: model });
        break;
      case 'codex':
        this.config.set('codex', { ...this.config.get('codex'), defaultModel: model });
        break;
    }

    if (this.config.get('defaultProvider') === provider) {
      this.config.set('defaultModel', model);
    }
  }

  /**
   * Reset to default settings
   */
  reset(): void {
    this.config.clear();
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.config.path;
  }

  /**
   * Export configuration to a file
   */
  exportConfig(filePath: string): void {
    const settings = this.getAll();
    // Remove sensitive data
    const safeSettings = {
      ...settings,
      apiKeys: {
        openrouter: settings.apiKeys.openrouter ? '***REDACTED***' : undefined,
        venice: settings.apiKeys.venice ? '***REDACTED***' : undefined,
        anthropic: settings.apiKeys.anthropic ? '***REDACTED***' : undefined,
        openai: settings.apiKeys.openai ? '***REDACTED***' : undefined,
        xai: settings.apiKeys.xai ? '***REDACTED***' : undefined,
        gemini: settings.apiKeys.gemini ? '***REDACTED***' : undefined,
        deepseek: settings.apiKeys.deepseek ? '***REDACTED***' : undefined,
        zai: settings.apiKeys.zai ? '***REDACTED***' : undefined,
        huggingface: settings.apiKeys.huggingface ? '***REDACTED***' : undefined,
        nanogpt: settings.apiKeys.nanogpt ? '***REDACTED***' : undefined,
        novita: settings.apiKeys.novita ? '***REDACTED***' : undefined,
        litellm: settings.apiKeys.litellm ? '***REDACTED***' : undefined,
      },
    };
    writeFileSync(filePath, JSON.stringify(safeSettings, null, 2));
  }

  /**
   * Create a .env template file
   */
  createEnvTemplate(filePath: string = join(process.cwd(), '.env.template')): void {
    const template = `# Purple Team Environment Configuration
# Save this file as ~/.t3mp3st/.env and fill in your API keys
# The setup script writes the same Purple Team-owned file.

# OpenRouter API Key (recommended - access to multiple models)
# Get your key at: https://openrouter.ai/keys
OPENROUTER_API_KEY=

# Venice API Key
# Get your key at: https://venice.ai
VENICE_API_KEY=

# Anthropic API Key (direct Claude access)
# Get your key at: https://console.anthropic.com/
ANTHROPIC_API_KEY=

# OpenAI API Key
# Get your key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=

# xAI API Key (optional if you sign in with Super Grok Heavy OAuth in Settings)
# Get your key at: https://console.x.ai/
XAI_API_KEY=

# LiteLLM Proxy (AI gateway — 100+ providers via single API)
# Docs: https://docs.litellm.ai/docs/proxy/quick_start
LITELLM_BASE_URL=http://localhost:4000/v1
LITELLM_API_KEY=
LITELLM_MODEL=gpt-4o

# Google Gemini API Key (direct Gemini API via its OpenAI-compatible endpoint)
# Get your key at: https://aistudio.google.com/apikey
GEMINI_API_KEY=

# DeepSeek API Key (direct DeepSeek API via its OpenAI-compatible endpoint)
# Get your key at: https://platform.deepseek.com/api_keys
DEEPSEEK_API_KEY=

# Z.ai API Key (general API only; the GLM Coding Plan endpoint is not used)
ZAI_API_KEY=

# Hugging Face access token (open models via the OpenAI-compatible Inference Providers router)
# Get your token at: https://huggingface.co/settings/tokens
# HUGGINGFACE_API_KEY / HUGGINGFACE_TOKEN are also accepted as aliases.
HF_TOKEN=

# NanoGPT API Key (direct OpenAI-compatible API)
# Docs and key management: https://docs.nano-gpt.com/authentication
NANOGPT_API_KEY=

# Novita AI API Key (OpenAI-compatible API serving open-source and frontier models)
# Get your key at: https://novita.ai/settings/key-management
NOVITA_API_KEY=

# Local model (Ollama / LM Studio / vLLM / llama.cpp, or any OpenAI-compatible server)
# Point TEMPEST_LOCAL_BASE_URL at the server root (Ollama default shown below).
# For an OpenAI-compatible server, use a versioned path: LM Studio :1234/v1,
# vLLM :8000/v1, or e.g. Zhipu/z.ai /api/paas/v4 — any /vN path speaks the
# OpenAI wire (/chat/completions, choices[]); otherwise the Ollama native format is used.
# Most local servers are keyless; if yours requires a bearer (Zhipu, Together, …)
# set TEMPEST_LOCAL_API_KEY. Provider keys (ZAI_API_KEY, etc.) are never sent to this endpoint.
TEMPEST_LOCAL_BASE_URL=http://localhost:11434/api
TEMPEST_LOCAL_MODEL=llama3
TEMPEST_LOCAL_API_KEY=
`;
    writeFileSync(filePath, template);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const config = new ConfigManager();

// Helper functions for quick access
export const getApiKey = (provider: ApiKeyProvider) => config.getApiKey(provider);
export const setApiKey = (provider: ApiKeyProvider, key: string) => config.setApiKey(provider, key);
export const hasApiKey = (provider: ApiKeyProvider) => config.hasApiKey(provider);
export const getLLMConfig = (provider?: LLMProvider, model?: string) => config.getLLMConfig(provider, model);
export const getConfiguredProviders = () => config.getConfiguredProviders();
