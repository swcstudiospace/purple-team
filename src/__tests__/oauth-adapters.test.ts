import { afterEach, describe, expect, it, vi } from 'vitest';
import { LLMBackbone } from '../llm/index.js';

describe('OAuth-aware provider adapters', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
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
});
