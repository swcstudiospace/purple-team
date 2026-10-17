/**
 * Server-side model-list fetching for the Universal API Config panel (issue #90).
 *
 * The Settings "Fetch models" button can't hit api.openai.com/v1/models (etc.) directly from the
 * browser (CORS), so the /api/models route calls this. It queries a provider's own model endpoint
 * using the correct wire shape (OpenAI-compatible Bearer `/models`, or the Anthropic `x-api-key`
 * `/v1/models`).
 *
 * The provider's live list is the only source of model ids shown to the UI. `listProviderModels`
 * is the raw fetch and THROWS on failure; `resolveProviderModels` wraps it with a per-provider
 * in-memory TTL cache and never throws. The cache key is provider + normalised baseUrl + a SHA-256
 * of the API key, so the key itself is never stored or returned.
 */

import { createHash } from 'node:crypto';

export interface ProviderModel {
  id: string;
}

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const ANTHROPIC_VERSION = '2023-06-01';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const DEFAULT_MODEL_LIST_TIMEOUT_MS = 15_000;

/** How long a successful live list is served without contacting the provider. */
export const MODEL_LIST_TTL_MS = 6 * 60 * 60 * 1000;
/** Upper bound on cached (provider, baseUrl, key-hash) entries; oldest insertion is evicted first. */
const MODEL_CACHE_MAX_ENTRIES = 64;

// Pseudo-providers with no remote model list (CLI-driven, OAuth-only with a static
// catalog, or in-process).
const NO_REMOTE_LIST = new Set(['codex', 'mock', 'local-agent', 'chatgpt', 'cursor']);
const OPENAI_COMPATIBLE_REMOTE_LIST: Record<string, true> = {
  openai: true, venice: true, xai: true, gemini: true, nanogpt: true, novita: true, zai: true,
  litellm: true, huggingface: true, local: true,
};
const DIRECT_REMOTE_LIST = new Set(['anthropic', 'openrouter']);

const stripTrailingSlash = (u: string): string => u.replace(/\/+$/, '');

export function providerCanListModels(provider: string): boolean {
  return DIRECT_REMOTE_LIST.has(provider) || OPENAI_COMPATIBLE_REMOTE_LIST[provider] === true;
}

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  if (typeof AbortController === 'undefined') return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timeout.unref === 'function') timeout.unref();
  return controller.signal;
}

/** Extract `data[].id` from an OpenAI-/Anthropic-shaped model-list response, or throw if malformed/empty. */
function parseModelList(body: unknown): ProviderModel[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error('provider model-list response has no data[] array');
  const models = data
    .map((m) => (m && typeof m === 'object' ? (m as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id }));
  if (!models.length) throw new Error('provider returned an empty model list');
  return models;
}

/**
 * List a provider's available models via its own endpoint. Throws on any failure (missing baseUrl,
 * non-2xx, malformed/empty body, or a provider with no remote list). Callers that need caching or
 * fail-open behaviour use `resolveProviderModels`.
 */
export async function listProviderModels(
  provider: string,
  opts: { baseUrl?: string; apiKey?: string; authType?: 'api-key' | 'oauth'; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<ProviderModel[]> {
  if (NO_REMOTE_LIST.has(provider)) {
    throw new Error(`provider '${provider}' has no remote model list`);
  }
  if (!providerCanListModels(provider)) {
    throw new Error(`provider '${provider}' is not supported for remote model listing`);
  }
  const doFetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!doFetch) throw new Error('no fetch implementation available');

  let url: string;
  const headers: Record<string, string> = {};

  if (provider === 'anthropic') {
    // Strip a trailing /v1 first so a user who types ".../v1" (matching every other provider's base)
    // doesn't get a double /v1/v1/models → 404.
    const abase = stripTrailingSlash(opts.baseUrl || 'https://api.anthropic.com').replace(/\/v1$/, '');
    url = `${abase}/v1/models`;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
    if (opts.apiKey) headers['x-api-key'] = opts.apiKey;                     // Anthropic API keys use x-api-key, NOT Bearer
  } else if (provider === 'openrouter') {
    // Honor a custom OpenRouter-compatible base URL if given; else the public list.
    url = opts.baseUrl && opts.baseUrl.trim() ? `${stripTrailingSlash(opts.baseUrl)}/models` : OPENROUTER_MODELS_URL;
    if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  } else {
    // OpenAI-compatible: openai / venice / xai / gemini / local / litellm / openai-compat.
    const base = opts.baseUrl && opts.baseUrl.trim() ? stripTrailingSlash(opts.baseUrl) : undefined;
    if (!base) throw new Error(`provider '${provider}' requires a baseUrl to list models`);
    url = `${base}/models`;
    if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  }

  const signal = timeoutSignal(opts.timeoutMs ?? DEFAULT_MODEL_LIST_TIMEOUT_MS);
  const res = await doFetch(url, { headers, signal });
  if (!res.ok) throw new Error(`model-list request failed: HTTP ${res.status}`);
  return parseModelList(await res.json());
}

export type ModelListSource = 'live' | 'stale' | 'unavailable';

export interface ProviderModelList {
  provider: string;
  /** live: fetched now or within TTL · stale: last good list, refresh failed · unavailable: no list. */
  source: ModelListSource;
  models: ProviderModel[];
  /** Epoch ms of the last successful live list for this key, or null when there is none. */
  fetchedAt: number | null;
  note?: string;
}

interface CacheEntry {
  models: ProviderModel[];
  fetchedAt: number;
}

const modelCache = new Map<string, CacheEntry>();

/** Cache key: provider + normalised baseUrl (trimmed, no trailing slashes) + SHA-256 of the API key. The raw key never enters the map. */
function modelCacheKey(provider: string, baseUrl: string | undefined, apiKey: string): string {
  const normalisedBase = stripTrailingSlash((baseUrl ?? '').trim());
  const keyFingerprint = createHash('sha256').update(apiKey).digest('hex');
  return [provider, normalisedBase, keyFingerprint].join('\n');
}

function cacheStore(key: string, entry: CacheEntry): void {
  modelCache.delete(key);                       // re-insert so a refreshed entry is the newest
  modelCache.set(key, entry);
  while (modelCache.size > MODEL_CACHE_MAX_ENTRIES) {
    const oldest = modelCache.keys().next().value;
    if (oldest === undefined) break;
    modelCache.delete(oldest);
  }
}

const copyModels = (models: ProviderModel[]): ProviderModel[] => models.map((m) => ({ id: m.id }));

function unavailable(provider: string, note: string): ProviderModelList {
  return { provider, source: 'unavailable', models: [], fetchedAt: null, note };
}

/** Test/introspection helper: the opaque cache keys currently held. Keys never contain the API key. */
export function providerModelCacheKeys(): string[] {
  return [...modelCache.keys()];
}

/** Test helper: drop every cached model list. */
export function clearProviderModelCache(): void {
  modelCache.clear();
}

/**
 * Live model list for one provider with a per-key TTL cache. NEVER throws.
 *
 * - No remote list for the provider, or no API key → `unavailable` with a note saying which.
 * - Fresh cache entry (younger than MODEL_LIST_TTL_MS) and no `refresh` → `live` from cache, no fetch.
 * - Successful fetch → `live`; replaces the cache entry.
 * - Failed fetch with an existing entry (any age) → `stale` with the cached list.
 * - Failed fetch with no entry → `unavailable` with empty models.
 */
export async function resolveProviderModels(
  provider: string,
  opts: { baseUrl?: string; apiKey?: string; authType?: 'api-key' | 'oauth'; fetchImpl?: FetchLike; timeoutMs?: number; refresh?: boolean } = {},
): Promise<ProviderModelList> {
  if (NO_REMOTE_LIST.has(provider)) {
    return unavailable(provider, `provider '${provider}' has no remote model list`);
  }
  if (!providerCanListModels(provider)) {
    return unavailable(provider, `provider '${provider}' is not supported for remote model listing`);
  }
  if (!opts.apiKey) {
    return unavailable(provider, `no API key configured for '${provider}'`);
  }

  const key = modelCacheKey(provider, opts.baseUrl, opts.apiKey);
  const cached = modelCache.get(key);
  if (cached && !opts.refresh && Date.now() - cached.fetchedAt < MODEL_LIST_TTL_MS) {
    return { provider, source: 'live', models: copyModels(cached.models), fetchedAt: cached.fetchedAt };
  }

  try {
    const models = await listProviderModels(provider, opts);
    const fetchedAt = Date.now();
    cacheStore(key, { models, fetchedAt });
    return { provider, source: 'live', models: copyModels(models), fetchedAt };
  } catch (e) {
    const note = e instanceof Error ? e.message : String(e);
    const previous = modelCache.get(key);
    if (previous) {
      return {
        provider,
        source: 'stale',
        models: copyModels(previous.models),
        fetchedAt: previous.fetchedAt,
        note: `live refresh failed: ${note}`,
      };
    }
    return unavailable(provider, note);
  }
}
