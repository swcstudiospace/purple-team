/**
 * POST /api/genui/generate — streams OpenUI Lang generated from one user prompt.
 *
 * Request:  { prompt: string }   (1 to 8000 characters after trimming)
 * Response: text/plain; charset=utf-8 OpenUI Lang, piped as it arrives (not buffered).
 * Errors:   JSON { error: string }
 *   400 bad body, 409 provider has no OpenAI-compatible streaming path,
 *   503 no API key or base URL configured, 502 model failed before producing output,
 *   500 unexpected server-side failure.
 *
 * Provider keys stay on the server: they are never echoed in responses or logs.
 */

import type { Request, Response } from 'express';
import { generateSystemPrompt } from '@openuidev/lang-core';
import { pipeTextStreamToResponse, streamText } from 'ai';
import type { LanguageModel, TextStreamPart, ToolSet } from 'ai';
import { defaultCreateModel, type ChatModelConfig } from '../chat/chat-route.js';
import { GENUI_LIBRARY } from './library-spec.js';
import { STREAMABLE_PROVIDERS } from '../chat/chat-route.js';

export interface GenUiRouteDeps {
  getConfig: () => ChatModelConfig;
  createModel?: (cfg: ChatModelConfig) => LanguageModel;
}

const MAX_PROMPT_CHARS = 8000;
const SYSTEM_PROMPT = generateSystemPrompt({ library: GENUI_LIBRARY });

type Validated = { ok: true; prompt: string } | { ok: false; error: string };

function validateBody(body: unknown): Validated {
  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('prompt' in body)) {
    return { ok: false, error: 'Request body must be an object with a prompt string' };
  }
  const prompt: unknown = body.prompt;
  if (typeof prompt !== 'string') {
    return { ok: false, error: 'prompt must be a string' };
  }
  const trimmed = prompt.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_PROMPT_CHARS) {
    return { ok: false, error: `prompt must contain 1 to ${MAX_PROMPT_CHARS} characters` };
  }
  return { ok: true, prompt: trimmed };
}

/** Thrown when the model stream reports an error. The message is fixed; the provider detail is kept only for the redacted log. */
class UpstreamFailure extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('GenUI model stream failed');
    this.name = 'UpstreamFailure';
    this.detail = detail;
  }
}

/** Yields text deltas only. Model errors become UpstreamFailure, because textStream would otherwise drop them silently. */
async function* textDeltas(parts: AsyncIterable<TextStreamPart<ToolSet>>): AsyncGenerator<string> {
  for await (const part of parts) {
    if (part.type === 'error') {
      const raw = part.error instanceof Error ? part.error.message : String(part.error);
      throw new UpstreamFailure(raw);
    }
    if (part.type === 'text-delta') {
      yield part.text;
    }
  }
}

/**
 * Reads the first delta before any header is written, so a model that fails straight away
 * still gets a 502. After that, deltas are pulled on demand, one at a time, with no buffering.
 */
async function primeTextStream(deltas: AsyncGenerator<string>): Promise<ReadableStream<string>> {
  const first = await deltas.next();
  return new ReadableStream<string>({
    start(controller) {
      if (first.done) controller.close();
      else controller.enqueue(first.value);
    },
    async pull(controller) {
      const next = await deltas.next();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
    async cancel() {
      await deltas.return(undefined);
    },
  });
}

/** Logs a failure with the API key scrubbed, so a provider error that echoes the key never reaches the log. */
function logFailure(apiKey: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const detail = err instanceof UpstreamFailure ? err.detail : message;
  console.error('[genui] generation failed:', apiKey ? detail.split(apiKey).join('[redacted]') : detail);
}

export function createGenUiHandler(deps: GenUiRouteDeps) {
  const createModel = deps.createModel ?? defaultCreateModel;

  return async (req: Request, res: Response): Promise<void> => {
    const checked = validateBody(req.body);
    if (!checked.ok) {
      res.status(400).json({ error: checked.error });
      return;
    }

    let cfg: ChatModelConfig;
    try {
      cfg = deps.getConfig();
    } catch {
      res.status(503).json({ error: 'LLM configuration is unavailable' });
      return;
    }

    if (!Object.hasOwn(STREAMABLE_PROVIDERS, cfg.provider)) {
      res.status(409).json({ error: `Provider "${cfg.provider}" does not support streaming` });
      return;
    }
    if (!cfg.apiKey) {
      res.status(503).json({ error: 'No API key configured for the selected provider' });
      return;
    }
    // Every streamable provider is reached through its OpenAI-compatible base URL.
    if (!cfg.baseUrl) {
      res.status(503).json({ error: 'No base URL configured for the selected provider' });
      return;
    }

    try {
      const result = streamText({
        model: createModel(cfg),
        system: SYSTEM_PROMPT,
        prompt: checked.prompt,
        // Errors reach textDeltas as error parts. The default handler would log the raw provider error.
        onError: () => undefined,
      });
      const stream = await primeTextStream(textDeltas(result.fullStream));
      await pipeTextStreamToResponse({ response: res, stream });
    } catch (err) {
      logFailure(cfg.apiKey, err);
      if (res.headersSent) {
        res.end();
      } else if (err instanceof UpstreamFailure) {
        res.status(502).json({ error: 'GenUI generation failed' });
      } else {
        res.status(500).json({ error: 'GenUI request failed' });
      }
    }
  };
}
