import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { createGenUiHandler } from '../genui/generate-route.js';
import { GENUI_LIBRARY } from '../genui/library-spec.js';
import type { ChatModelConfig } from '../chat/chat-route.js';

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
  return { prompt: 'Summarise the open findings by severity' };
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

describe('POST /api/genui/generate handler', () => {
  it('returns 400 for a body without a string prompt', async () => {
    const handler = createGenUiHandler({ getConfig: () => Promise.resolve(openAiConfig()) });

    const nullBody = fakeRes();
    await handler(fakeReq(null), nullBody);
    expect(nullBody.statusCode).toBe(400);
    expect(nullBody.jsonBody).toEqual({ error: expect.any(String) });

    const numberPrompt = fakeRes();
    await handler(fakeReq({ prompt: 42 }), numberPrompt);
    expect(numberPrompt.statusCode).toBe(400);
  });

  it('returns 400 for an empty, whitespace-only, or over-length prompt', async () => {
    const createModel = vi.fn();
    const handler = createGenUiHandler({ getConfig: () => Promise.resolve(openAiConfig()), createModel });

    for (const prompt of ['', '   \n\t ', 'x'.repeat(8001)]) {
      const res = fakeRes();
      await handler(fakeReq({ prompt }), res);
      expect(res.statusCode).toBe(400);
      expect(res.jsonBody).toEqual({ error: expect.any(String) });
    }
    expect(createModel).not.toHaveBeenCalled();
  });

  it('returns 409 for a provider with no OpenAI-compatible streaming path', async () => {
    const createModel = vi.fn();
    const handler = createGenUiHandler({
      getConfig: () => Promise.resolve(openAiConfig({ provider: 'anthropic' })),
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
    const handler = createGenUiHandler({
      getConfig: () => Promise.resolve(openAiConfig({ apiKey: '' })),
      createModel,
    });
    const res = fakeRes();
    await handler(fakeReq(validBody()), res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.jsonBody)).not.toContain(SECRET);
    expect(createModel).not.toHaveBeenCalled();
  });

  it('returns 503 when the base URL is missing', async () => {
    const handler = createGenUiHandler({ getConfig: () => Promise.resolve(openAiConfig({ baseUrl: '' })) });
    const res = fakeRes();
    await handler(fakeReq(validBody()), res);
    expect(res.statusCode).toBe(503);
  });

  it('streams plain text from an injected model, with the system prompt built from the spec', async () => {
    const model = new MockLanguageModelV3({
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'Stack(children: [])' },
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
    const handler = createGenUiHandler({ getConfig: () => Promise.resolve(openAiConfig()), createModel });

    const res = fakeRes();
    await handler(fakeReq({ prompt: '  Summarise the open findings  ' }), res);

    expect(createModel).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openrouter', model: 'test/model' }));
    expect(res.jsonBody).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.chunks.join('')).toBe('Stack(children: [])');
    expect(res.ended).toBe(true);

    const [call] = model.doStreamCalls;
    const system = call.prompt.find((m) => m.role === 'system');
    expect(system).toBeDefined();
    for (const component of Object.values(GENUI_LIBRARY.components)) {
      expect(String(system?.content)).toContain(component.signature);
    }
    const user = call.prompt.filter((m) => m.role === 'user');
    expect(user).toHaveLength(1);
    expect(JSON.stringify(user[0].content)).toContain('Summarise the open findings');
  });

  it('answers 502 with a generic message and keeps the key out of the response and logs', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = new MockLanguageModelV3({
      doStream: {
        stream: simulateReadableStream({
          chunks: [{ type: 'error', error: new Error(`upstream rejected key ${SECRET}`) }],
        }),
      },
    });
    const handler = createGenUiHandler({
      getConfig: () => Promise.resolve(openAiConfig()),
      createModel: () => failing,
    });

    const res = fakeRes();
    await handler(fakeReq(validBody()), res);

    expect(res.statusCode).toBe(502);
    expect(res.jsonBody).toEqual({ error: 'GenUI generation failed' });
    expect(JSON.stringify(res.jsonBody)).not.toContain(SECRET);
    expect(res.chunks.join('')).not.toContain(SECRET);
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(SECRET);
  });
});
