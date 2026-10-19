import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { __resetOAuthState } from '../llm/oauth.js';
import { LLMBackbone } from '../llm/index.js';

describe('OAuth-aware provider adapters', () => {
  const originalFetch = global.fetch;
  const dirs: string[] = [];

  beforeEach(() => {
    // Hermetic: a live operator store at ~/.t3mp3st/oauth.json must never leak a
    // real token into these assertions (or get refreshed by them). Point the store
    // at a fresh empty temp path per test, the way oauth-openai.test.ts does.
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-oauth-adapters-'));
    dirs.push(dir);
    process.env.T3MP3ST_OAUTH_STORE = join(dir, 'oauth.json');
    __resetOAuthState();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    __resetOAuthState();
    delete process.env.T3MP3ST_OAUTH_STORE;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('keeps API-key Anthropic on x-api-key with no identity prefix', async () => {
    const fetchSpy = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        model: 'claude-opus-4-8',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
      }),
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const bb = new LLMBackbone({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      apiKey: 'sk-ant-api03-test-key-0123456789',
      baseUrl: 'https://api.anthropic.com',
    });
    await bb.chat([{ role: 'system', content: 'Hunt this target.' }, { role: 'user', content: 'hello' }]);
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-api03-test-key-0123456789');
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body.system).toBe('Hunt this target.');
  });

  it('sends SuperGrok OAuth as Bearer against api.x.ai', async () => {
    const fetchSpy = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        model: 'grok-4-heavy',
        choices: [{ message: { content: 'heavy-ok' }, finish_reason: 'stop' }],
      }),
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const bb = new LLMBackbone({
      provider: 'xai',
      model: 'grok-4-heavy',
      apiKey: 'xai-oauth-access',
      authType: 'oauth',
      baseUrl: 'https://api.x.ai/v1',
    });
    const response = await bb.chat([{ role: 'user', content: 'hello' }]);
    expect(response.content).toBe('heavy-ok');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer xai-oauth-access');
    expect(JSON.parse(String(init?.body)).model).toBe('grok-4-heavy');
  });

  it('sends Claude subscription OAuth as Bearer + the oauth beta flag against /v1/messages', async () => {
    const fetchSpy = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        model: 'claude-opus-4-8',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
      }),
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const bb = new LLMBackbone({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      apiKey: 'sk-ant-oat01-subscription-token',
      authType: 'oauth',
      baseUrl: 'https://api.anthropic.com',
    });
    await bb.chat([{ role: 'user', content: 'hello' }]);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-ant-oat01-subscription-token');
    // OAuth mode drops x-api-key — the API rejects OAuth sent as an API key.
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers['anthropic-beta']).toBe('oauth-2025-04-20');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    // No spoofed Claude Code identity rides the request.
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('user-agent');
    expect(JSON.parse(String((init as RequestInit).body)).model).toBe('claude-opus-4-8');
  });
});
