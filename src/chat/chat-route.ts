/**
 * POST /api/chat — streams a chat completion as an AI SDK UI message stream.
 *
 * Request:  { messages: UIMessage[] }   (UI-message shape, text parts)
 * Response: text/event-stream (piped, not buffered) on success.
 * Errors:   JSON { error: string }
 *   400 bad body, 409 provider has no OpenAI-compatible streaming path,
 *   503 no API key or base URL configured.
 *
 * Provider keys stay on the server: they are never echoed in responses or logs.
 */

import type { Request, Response } from 'express';
import { convertToModelMessages, pipeUIMessageStreamToResponse, streamText } from 'ai';
import type { LanguageModel, UIMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export interface ChatModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatRouteDeps {
  getConfig: () => ChatModelConfig;
  createModel?: (cfg: ChatModelConfig) => LanguageModel;
}

const STREAMABLE_PROVIDERS: Record<string, true> = {
  openrouter: true,
  venice: true,
  openai: true,
  xai: true,
  deepseek: true,
  zai: true,
  gemini: true,
  litellm: true,
  huggingface: true,
  nanogpt: true,
  novita: true,
};

const ALLOWED_ROLES: Record<string, true> = { user: true, assistant: true, system: true };
const MAX_MESSAGES = 60;
const MAX_TEXT_CHARS = 64000;

type ChatMessage = Omit<UIMessage, 'id'>;
type Validated = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

function validateBody(body: unknown): Validated {
  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('messages' in body)) {
    return { ok: false, error: 'Request body must be an object with a messages array' };
  }
  const messages: unknown = body.messages;
  if (!Array.isArray(messages)) {
    return { ok: false, error: 'messages must be an array' };
  }
  if (messages.length < 1 || messages.length > MAX_MESSAGES) {
    return { ok: false, error: `messages must contain 1 to ${MAX_MESSAGES} entries` };
  }

  let totalText = 0;
  for (const entry of messages as unknown[]) {
    if (typeof entry !== 'object' || entry === null || !('role' in entry) || !('parts' in entry)) {
      return { ok: false, error: 'each message must be an object with role and parts' };
    }
    const role: unknown = entry.role;
    if (typeof role !== 'string' || !Object.hasOwn(ALLOWED_ROLES, role)) {
      return { ok: false, error: 'message role must be user, assistant, or system' };
    }
    const parts: unknown = entry.parts;
    if (!Array.isArray(parts)) {
      return { ok: false, error: 'message parts must be an array' };
    }
    for (const part of parts as unknown[]) {
      if (typeof part !== 'object' || part === null || !('type' in part) || typeof part.type !== 'string') {
        return { ok: false, error: 'each message part must be an object with a string type' };
      }
      if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
        totalText += part.text.length;
      }
    }
  }
  if (totalText > MAX_TEXT_CHARS) {
    return { ok: false, error: `total text must be at most ${MAX_TEXT_CHARS} characters` };
  }

  // Role and parts shape checked above; the SDK's converter validates the remaining part fields.
  const uiMessages = messages as ChatMessage[];
  return { ok: true, messages: uiMessages };
}

const defaultCreateModel = (cfg: ChatModelConfig): LanguageModel =>
  createOpenAICompatible({
    name: cfg.provider,
    baseURL: cfg.baseUrl as string,
    apiKey: cfg.apiKey,
  }).chatModel(cfg.model);

export function createChatHandler(deps: ChatRouteDeps) {
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
      res.status(409).json({ error: `Provider "${cfg.provider}" does not support chat streaming` });
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
      const modelMessages = await convertToModelMessages<UIMessage>(checked.messages);
      const result = streamText({
        model: createModel(cfg),
        messages: modelMessages,
      });
      // Pipes chunks to the Express response as they arrive; nothing is buffered.
      // onError keeps provider error text (which may echo the key) out of the stream.
      await pipeUIMessageStreamToResponse({
        response: res,
        stream: result.toUIMessageStream({ onError: () => 'The model request failed.' }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Scrub the secret so a thrown error that echoes it never reaches the log.
      console.error('[chat] stream failed:', cfg.apiKey ? message.split(cfg.apiKey).join('[redacted]') : message);
      if (res.headersSent) {
        res.end();
      } else {
        res.status(500).json({ error: 'Chat request failed' });
      }
    }
  };
}
