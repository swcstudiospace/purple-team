/**
 * POST /api/chat — streams a chat completion as an AI SDK UI message stream.
 *
 * Request:  { messages: UIMessage[], provider?: string, model?: string }
 * Response: text/event-stream (piped, not buffered) on success.
 * Errors:   JSON { error: string }
 *   400 bad body or unknown provider, 409 provider has no streaming path,
 *   503 no API key or base URL configured.
 *
 * Anthropic streams via POST {baseUrl}/v1/messages (OAuth Bearer or x-api-key).
 * Other streamable providers stay on the OpenAI-compatible streamText path.
 *
 * Provider keys stay on the server: they are never echoed in responses or logs.
 */

import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { convertToModelMessages, pipeUIMessageStreamToResponse, streamText } from 'ai';
import type { LanguageModel, UIMessage, UIMessageChunk } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { StreamingConfigOverride, StreamingModelConfig } from './streaming-config.js';
import { CLAUDE_OAUTH_BETA } from '../llm/oauth.js';

export type ChatModelConfig = StreamingModelConfig;
export type ChatConfigOverride = StreamingConfigOverride;

export interface ChatRouteDeps {
  getConfig: (override?: ChatConfigOverride) => Promise<ChatModelConfig>;
  createModel?: (cfg: ChatModelConfig) => LanguageModel;
}

export const STREAMABLE_PROVIDERS: Record<string, true> = {
  openrouter: true,
  venice: true,
  openai: true,
  chatgpt: true,
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
const ANTHROPIC_MAX_TOKENS = 8192;

type ChatMessage = Omit<UIMessage, 'id'>;
type Validated = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };
type LooseModelMessage = { role?: string; content?: unknown };

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

function readOverride(body: unknown): ChatConfigOverride | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const rec = body as Record<string, unknown>;
  const provider = typeof rec.provider === 'string' ? rec.provider.trim() : '';
  const model = typeof rec.model === 'string' ? rec.model.trim() : '';
  if (!provider && !model) return undefined;
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
}

export const defaultCreateModel = (cfg: ChatModelConfig): LanguageModel =>
  createOpenAICompatible({
    name: cfg.provider,
    baseURL: cfg.baseUrl as string,
    apiKey: cfg.apiKey,
  }).chatModel(cfg.model);

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const part of content) {
    if (typeof part === 'string') {
      out += part;
      continue;
    }
    if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
      out += part.text;
    }
  }
  return out;
}

function anthropicRequestBody(model: string, modelMessages: LooseModelMessage[]): {
  model: string;
  max_tokens: number;
  stream: true;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  system?: string;
} {
  const system: string[] = [];
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of modelMessages) {
    const text = textFromContent(msg.content).trim();
    if (!text) continue;
    if (msg.role === 'system') {
      system.push(text);
      continue;
    }
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    const prev = messages[messages.length - 1];
    if (prev && prev.role === msg.role) prev.content += `\n\n${text}`;
    else messages.push({ role: msg.role, content: text });
  }
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
  return {
    model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    stream: true,
    messages,
    ...(system.length > 0 ? { system: system.join('\n\n') } : {}),
  };
}

function anthropicHeaders(cfg: ChatModelConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (cfg.authType === 'oauth') {
    headers.Authorization = `Bearer ${cfg.apiKey ?? ''}`;
    headers['anthropic-beta'] = CLAUDE_OAUTH_BETA;
  } else {
    headers['x-api-key'] = cfg.apiKey ?? '';
  }
  return headers;
}

/** Text from an Anthropic SSE `content_block_delta`, or undefined if the event is not text. */
function anthropicTextDelta(payload: string): string | undefined {
  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return undefined;
  }
  if (!event || typeof event !== 'object') return undefined;
  const rec = event as Record<string, unknown>;
  if (rec.type === 'error') throw new Error('anthropic stream error');
  if (rec.type !== 'content_block_delta') return undefined;
  const delta = rec.delta;
  if (!delta || typeof delta !== 'object') return undefined;
  const typed = delta as Record<string, unknown>;
  if (typed.type === 'text_delta' && typeof typed.text === 'string') return typed.text;
  return undefined;
}

function anthropicSseToUiStream(body: ReadableStream<Uint8Array>): ReadableStream<UIMessageChunk> {
  const messageId = randomUUID();
  const textId = randomUUID();
  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      controller.enqueue({ type: 'start', messageId });
      controller.enqueue({ type: 'start-step' });
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let opened = false;
      const emitPayload = (payload: string): void => {
        const text = anthropicTextDelta(payload);
        if (!text) return;
        if (!opened) {
          controller.enqueue({ type: 'text-start', id: textId });
          opened = true;
        }
        controller.enqueue({ type: 'text-delta', id: textId, delta: text });
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload && payload !== '[DONE]') emitPayload(payload);
          }
        }
        const tail = buf.trim();
        if (tail.startsWith('data:')) {
          const payload = tail.slice(5).trim();
          if (payload && payload !== '[DONE]') emitPayload(payload);
        }
        if (opened) controller.enqueue({ type: 'text-end', id: textId });
        controller.enqueue({ type: 'finish-step' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      } catch {
        if (opened) controller.enqueue({ type: 'text-end', id: textId });
        controller.enqueue({ type: 'error', errorText: 'The model request failed.' });
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });
}

async function streamAnthropicChat(
  cfg: ChatModelConfig,
  modelMessages: LooseModelMessage[],
  res: Response,
): Promise<void> {
  const payload = anthropicRequestBody(cfg.model, modelMessages);
  if (payload.messages.length === 0) {
    res.status(400).json({ error: 'messages must include a user turn' });
    return;
  }
  const baseUrl = (cfg.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  const abort = new AbortController();
  const onClose = (): void => {
    if (!res.writableEnded) abort.abort();
  };
  res.on('close', onClose);
  try {
    const upstream = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: anthropicHeaders(cfg),
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: 'The model request failed.' });
      return;
    }
    await pipeUIMessageStreamToResponse({
      response: res,
      stream: anthropicSseToUiStream(upstream.body),
    });
  } finally {
    res.off('close', onClose);
  }
}

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
      cfg = await deps.getConfig(readOverride(req.body));
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.startsWith('Unknown provider:')) {
        res.status(400).json({ error: 'unknown provider' });
        return;
      }
      res.status(503).json({ error: 'LLM configuration is unavailable' });
      return;
    }

    if (cfg.provider !== 'anthropic' && !Object.hasOwn(STREAMABLE_PROVIDERS, cfg.provider)) {
      res.status(409).json({ error: `Provider "${cfg.provider}" does not support chat streaming` });
      return;
    }
    if (!cfg.apiKey) {
      res.status(503).json({ error: 'No API key configured for the selected provider' });
      return;
    }
    if (!cfg.baseUrl) {
      res.status(503).json({ error: 'No base URL configured for the selected provider' });
      return;
    }

    try {
      const modelMessages = await convertToModelMessages<UIMessage>(checked.messages);
      if (cfg.provider === 'anthropic') {
        await streamAnthropicChat(cfg, modelMessages, res);
        return;
      }
      const result = streamText({
        model: createModel(cfg),
        messages: modelMessages,
        // Cap the completion budget: without it the provider prices the model's
        // full output ceiling (e.g. 64k) against the account balance up front,
        // so any credit-limited key 402s on every send.
        maxOutputTokens: 8192,
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
