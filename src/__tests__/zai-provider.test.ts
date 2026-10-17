import { afterEach, describe, expect, it, vi } from 'vitest';
import { createZaiBackbone } from '../llm/index.js';

const KEY = 'zai-key-abcdef123456';
const originalFetch = global.fetch;

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  };
}

afterEach(() => {
  delete process.env.ZAI_API_KEY;
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Z.ai provider (general API)', () => {
  it('posts chat completions to the general endpoint with a Bearer key', async () => {
    process.env.ZAI_API_KEY = KEY;
    const fetchMock = vi.fn(async () => jsonResponse({
      model: 'glm-5.3',
      choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await createZaiBackbone().chat([{ role: 'user', content: 'ping' }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.z.ai/api/paas/v4/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  it('parses an OpenAI-shaped response into the normal LLM response', async () => {
    process.env.ZAI_API_KEY = KEY;
    global.fetch = vi.fn(async () => jsonResponse({
      model: 'glm-5.3',
      choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    })) as unknown as typeof fetch;

    const res = await createZaiBackbone().chat([{ role: 'user', content: 'ping' }]);

    expect(res.content).toBe('pong');
    expect(res.model).toBe('glm-5.3');
    expect(res.finishReason).toBe('stop');
    expect(res.usage).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  });

  it('surfaces a non-2xx response as an error carrying its status', async () => {
    process.env.ZAI_API_KEY = KEY;
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'invalid api key',
      headers: new Headers(),
    })) as unknown as typeof fetch;

    await expect(createZaiBackbone().chat([{ role: 'user', content: 'ping' }])).rejects.toThrow(/401/);
  }, 15_000);
});
