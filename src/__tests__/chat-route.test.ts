import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { createChatHandler, type ChatModelConfig } from '../chat/chat-route.js';

const SECRET = 'sk-test-SECRET-KEY-123456';

class FakeResponse extends EventEmitter {
  statusCode: number | undefined;
  jsonBody: unknown;
  headers: Record<string, string> = {};
  chunks: string[] = [];
  headersSent = false;
  destroyed = false;
  writableFinished = false;
  ended = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.jsonBody = body;
    this.headersSent = true;
    this.ended = true;
    return this;
  }

  setHeaders(headers: Headers | Record<string, string> | [string, string][]): this {
    new Headers(headers).forEach((value, key) => {
      this.headers[key] = value;
    });
    return this;
  }

  writeHead(code: number): this {
    this.statusCode = code;
    this.headersSent = true;
    return this;
  }

  write(chunk: Uint8Array | string): boolean {
    this.chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }

  end(): this {
    this.ended = true;
    this.writableFinished = true;
    return this;
  }
}

function fakeReq(body: unknown): Request {
  return { body } as unknown as Request;
}

function fakeRes(): FakeResponse & Response {
  return new FakeResponse() as unknown as FakeResponse & Response;
}

function validBody() {
  return {
    messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
  };
}

function openAiConfig(overrides: Partial<ChatModelConfig> = {}): ChatModelConfig {
  return {
    provider: 'openrouter',
    model: 'test/model',
    apiKey: SECRET,
    baseUrl: 'https://example.invalid/v1',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/chat handler', () => {
  it('returns 400 for a body that is not an object with messages', async () => {
    const handler = createChatHandler({ getConfig: () => openAiConfig() });
    const res = fakeRes();
    await handler(fakeReq(null), res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: expect.any(String) });
  });

  it('returns 400 when messages is empty or over 60 entries', async () => {
    const handler = createChatHandler({ getConfig: () => openAiConfig() });

    const empty = fakeRes();
    await handler(fakeReq({ messages: [] }), empty);
    expect(empty.statusCode).toBe(400);

    const tooMany = fakeRes();
    const many = Array.from({ length: 61 }, (_, i) => ({ id: `m${i}`, role: 'user', parts: [] }));
    await handler(fakeReq({ messages: many }), tooMany);
    expect(tooMany.statusCode).toBe(400);
  });

  it('returns 400 for an unknown role or non-array parts', async () => {
    const handler = createChatHandler({ getConfig: () => openAiConfig() });

    const badRole = fakeRes();
    await handler(fakeReq({ messages: [{ id: 'a', role: 'tool', parts: [] }] }), badRole);
    expect(badRole.statusCode).toBe(400);

    const badParts = fakeRes();
    await handler(fakeReq({ messages: [{ id: 'a', role: 'user', parts: 'hi' }] }), badParts);
    expect(badParts.statusCode).toBe(400);
  });

  it('returns 400 when total text exceeds 64000 characters', async () => {
    const handler = createChatHandler({ getConfig: () => openAiConfig() });
    const big = 'x'.repeat(64001);
    const res = fakeRes();
    await handler(
      fakeReq({ messages: [{ id: 'a', role: 'user', parts: [{ type: 'text', text: big }] }] }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 for a provider with no OpenAI-compatible streaming path', async () => {
    const createModel = vi.fn();
    const handler = createChatHandler({
      getConfig: () => openAiConfig({ provider: 'anthropic' }),
      createModel,
    });
    const res = fakeRes();
    await handler(fakeReq(validBody()), res);
    expect(res.statusCode).toBe(409);
    expect(res.jsonBody).toEqual({ error: expect.any(String) });
    expect(createModel).not.toHaveBeenCalled();
  });

  it('returns 503 when the API key is missing and never echoes a key', async () => {
    const createModel = vi.fn();
    const handler = createChatHandler({
      getConfig: () => openAiConfig({ apiKey: '' }),
      createModel,
    });
    const res = fakeRes();
    await handler(fakeReq(validBody()), res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.jsonBody)).not.toContain(SECRET);
    expect(createModel).not.toHaveBeenCalled();
  });

  it('returns 503 when the base URL is missing', async () => {
    const handler = createChatHandler({
      getConfig: () => openAiConfig({ baseUrl: '' }),
    });
    const res = fakeRes();
    await handler(fakeReq(validBody()), res);
    expect(res.statusCode).toBe(503);
  });

  it('streams a UI message response from an injected model without buffering JSON', async () => {
    const model = new MockLanguageModelV3({
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'Hello' },
            { type: 'text-delta', id: 't1', delta: ' there' },
            { type: 'text-end', id: 't1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 2, text: 2, reasoning: undefined },
              },
            },
          ],
        }),
      },
    });
    const createModel = vi.fn(() => model);
    const handler = createChatHandler({ getConfig: () => openAiConfig(), createModel });

    const res = fakeRes();
    await handler(fakeReq(validBody()), res);

    expect(createModel).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openrouter', model: 'test/model' }));
    expect(res.jsonBody).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.chunks.length).toBeGreaterThan(1);
    expect(res.chunks.join('')).toContain('Hello');
    expect(res.ended).toBe(true);
  });

  it('keeps the key out of the stream when the upstream model call fails', async () => {
    const failing = new MockLanguageModelV3({
      doStream: async () => {
        throw new Error(`upstream rejected key ${SECRET}`);
      },
    });
    const handler = createChatHandler({
      getConfig: () => openAiConfig(),
      createModel: () => failing,
    });
    const res = fakeRes();
    await handler(fakeReq(validBody()), res);

    expect(res.chunks.join('')).not.toContain(SECRET);
    expect(res.chunks.join('')).toContain('The model request failed.');
    expect(res.ended).toBe(true);
  });

  it('returns a generic 500 and redacts the key from the log when setup throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createChatHandler({
      getConfig: () => openAiConfig(),
      createModel: () => {
        throw new Error(`bad credential ${SECRET}`);
      },
    });
    const res = fakeRes();
    await handler(fakeReq(validBody()), res);

    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.jsonBody)).not.toContain(SECRET);
    expect(errorSpy).toHaveBeenCalled();
    for (const call of errorSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(SECRET);
    }
  });
});
