/**
 * Live-only model lists with a per-provider TTL cache (resolveProviderModels).
 *
 * The provider's own list is the only source of ids. A successful list is cached for 6h keyed by
 * provider + baseUrl + SHA-256(apiKey). Failures serve the last good list as `stale`, or report
 * `unavailable` when nothing was ever fetched. No network: every case injects `fetchImpl`.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  MODEL_LIST_TTL_MS,
  clearProviderModelCache,
  providerModelCacheKeys,
  resolveProviderModels,
} from '../config/provider-models.js';

const BASE = 'https://api.openai.com/v1';
const SECRET = 'sk-test-SECRET-do-not-leak-0123456789';

/** A fake fetch whose response body and status are set per call. */
function scriptedFetch(...responses: Array<{ body?: unknown; ok?: boolean; status?: number } | Error>) {
  const queue = [...responses];
  return vi.fn(async (_url: string, _init?: unknown) => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    const r = next ?? { body: { data: [] }, ok: true, status: 200 };
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body };
  });
}

const okList = (...ids: string[]) => ({ body: { data: ids.map((id) => ({ id })) } });

beforeEach(() => {
  clearProviderModelCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resolveProviderModels — live replaces the cache', () => {
  it('a successful refresh replaces the cached list and is served from cache afterwards', async () => {
    const f = scriptedFetch(okList('gpt-a'), okList('gpt-b'));
    const first = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });
    expect(first.source).toBe('live');
    expect(first.models.map((m) => m.id)).toEqual(['gpt-a']);

    vi.advanceTimersByTime(60_000);
    const second = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f, refresh: true });
    expect(second.source).toBe('live');
    expect(second.models.map((m) => m.id)).toEqual(['gpt-b']);
    expect(second.fetchedAt).toBe((first.fetchedAt ?? 0) + 60_000);

    const cachedRead = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });
    expect(cachedRead.models.map((m) => m.id)).toEqual(['gpt-b']);
    expect(f).toHaveBeenCalledTimes(2);   // the cached read made no third call
  });
});

describe('resolveProviderModels — failure with a cache entry returns stale', () => {
  it('serves the last good list with source "stale", its original fetchedAt, and a note', async () => {
    const f = scriptedFetch(okList('gpt-a'), { ok: false, status: 503, body: {} });
    const first = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });

    vi.advanceTimersByTime(MODEL_LIST_TTL_MS + 1);
    const stale = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });
    expect(stale.source).toBe('stale');
    expect(stale.models.map((m) => m.id)).toEqual(['gpt-a']);
    expect(stale.fetchedAt).toBe(first.fetchedAt);
    expect(stale.note).toContain('503');
  });
});

describe('resolveProviderModels — failure without a cache entry returns unavailable', () => {
  it('reports unavailable with an empty list, null fetchedAt and the failure note', async () => {
    const f = scriptedFetch({ ok: false, status: 401, body: {} });
    const r = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });
    expect(r).toMatchObject({ provider: 'openai', source: 'unavailable', models: [], fetchedAt: null });
    expect(r.note).toContain('401');
  });

  it('reports unavailable without any network call for providers with no remote list', async () => {
    const f = scriptedFetch();
    const r = await resolveProviderModels('codex', { apiKey: SECRET, fetchImpl: f });
    expect(r.source).toBe('unavailable');
    expect(r.note).toContain('codex');
    expect(f).not.toHaveBeenCalled();
  });

  it('reports unavailable without any network call when no API key is configured', async () => {
    const f = scriptedFetch();
    const r = await resolveProviderModels('openai', { baseUrl: BASE, fetchImpl: f });
    expect(r.source).toBe('unavailable');
    expect(r.note).toMatch(/no API key/);
    expect(f).not.toHaveBeenCalled();
  });

  it('reports unavailable for an unknown provider without calling the caller-supplied base URL', async () => {
    const f = scriptedFetch();
    const r = await resolveProviderModels('not-a-provider', { baseUrl: 'https://example.test/v1', apiKey: SECRET, fetchImpl: f });
    expect(r.source).toBe('unavailable');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('resolveProviderModels — the API key never appears in cache keys or responses', () => {
  it('stores only a fingerprint of the key', async () => {
    const f = scriptedFetch(okList('gpt-a'));
    const r = await resolveProviderModels('openai', { baseUrl: `${BASE}/`, apiKey: SECRET, fetchImpl: f });

    const keys = providerModelCacheKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].startsWith('openai\n')).toBe(true);
    expect(keys[0]).toContain('https://api.openai.com/v1');   // trailing slash normalised away
    expect(keys.some((k) => k.includes(SECRET))).toBe(false);
    expect(JSON.stringify(r)).not.toContain(SECRET);
  });

  it('does not leak the key into stale or unavailable responses', async () => {
    const f = scriptedFetch(okList('gpt-a'), new Error(`network down for ${BASE}`));
    const live = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });
    const stale = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f, refresh: true });
    const other = await resolveProviderModels('openai', { baseUrl: 'https://other.test/v1', apiKey: SECRET, fetchImpl: f });

    for (const r of [live, stale, other]) expect(JSON.stringify(r)).not.toContain(SECRET);
    expect(stale.source).toBe('stale');
    expect(other.source).toBe('unavailable');
  });
});

describe('resolveProviderModels — refresh bypasses the TTL', () => {
  it('a fresh cache hit makes no fetch; refresh:true fetches even within the TTL', async () => {
    const f = scriptedFetch(okList('gpt-a'), okList('gpt-b'));
    await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });

    vi.advanceTimersByTime(MODEL_LIST_TTL_MS - 1);
    const cachedHit = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(cachedHit.models.map((m) => m.id)).toEqual(['gpt-a']);

    const forced = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f, refresh: true });
    expect(f).toHaveBeenCalledTimes(2);
    expect(forced.models.map((m) => m.id)).toEqual(['gpt-b']);
  });

  it('an entry older than the 6h TTL is refetched without an explicit refresh', async () => {
    const f = scriptedFetch(okList('gpt-a'), okList('gpt-b'));
    await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });

    vi.advanceTimersByTime(MODEL_LIST_TTL_MS);
    const expired = await resolveProviderModels('openai', { baseUrl: BASE, apiKey: SECRET, fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(2);
    expect(expired.models.map((m) => m.id)).toEqual(['gpt-b']);
  });
});
