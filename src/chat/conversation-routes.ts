/**
 * /api/conversations — sidebar CRUD + thread persistence (phase 36 §3.3).
 *
 * Mounted beside /api/chat in src/server.ts. The SPA is same-origin and the
 * server-wide loopback/origin guards on /api/* already cover these routes.
 * Bodies are hand-validated with the same tolerance as createChatHandler
 * (src/chat/chat-route.ts): the envelope is checked strictly, UIMessage
 * internals are checked for role/parts shape only and stored verbatim — data
 * parts (`data-purple-run`, `data-genui`) persist for display reload and are
 * stripped client-side by `toWireMessages` before they could reach the model.
 *
 * Response shapes (doc §3.3 table):
 *   GET    /                     { conversations: ConversationMeta[] }  (updatedAt desc)
 *   POST   /          {}         { conversation: ConversationMeta, evictedIds? }
 *   GET    /:id                  { meta, messages } | 404 { error }
 *   PATCH  /:id       { title }  { conversation: ConversationMeta } | 404
 *   DELETE /:id                  { ok: true }  (idempotent)
 *   PUT    /:id/messages { messages }  { meta } | 404
 */

import { Router, type Request, type Response } from 'express';
import type { UIMessage } from 'ai';
import {
  MAX_STORED_MESSAGES,
  createConversation,
  deleteConversation,
  getConversationRecord,
  listConversations,
  putConversationMessages,
  renameConversation,
  type ConversationMeta,
} from './conversation-store.js';

export interface ConversationRouteDeps {
  list: () => Promise<ConversationMeta[]>;
  create: () => Promise<{ meta: ConversationMeta; evictedIds: string[] }>;
  get: (id: string) => Promise<{ meta: ConversationMeta; messages: UIMessage[] } | null>;
  rename: (id: string, title: string) => Promise<{ meta: ConversationMeta | null; evictedIds: string[] }>;
  remove: (id: string) => Promise<boolean>;
  putMessages: (id: string, messages: UIMessage[]) => Promise<{ meta: ConversationMeta; evictedIds: string[] } | null>;
}

export const defaultConversationDeps: ConversationRouteDeps = {
  list: listConversations,
  create: createConversation,
  get: getConversationRecord,
  rename: renameConversation,
  remove: deleteConversation,
  putMessages: putConversationMessages,
};

const TITLE_MIN_CHARS = 1;
const TITLE_MAX_CHARS = 120;

/** 1..120 chars after trim; returns null so the route can 400 with the rule text. */
function parseTitle(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const title: unknown = (body as Record<string, unknown>).title;
  if (typeof title !== 'string') return null;
  const trimmed = title.trim();
  if (trimmed.length < TITLE_MIN_CHARS || trimmed.length > TITLE_MAX_CHARS) return null;
  return trimmed;
}

/** Envelope + per-message role/parts shape; messages are stored verbatim after this. */
function parseMessagesBody(body: unknown): UIMessage[] | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const messages: unknown = (body as Record<string, unknown>).messages;
  if (!Array.isArray(messages) || messages.length > 2 * MAX_STORED_MESSAGES) return null;
  for (const entry of messages) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { role, parts } = entry as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') return null;
    if (!Array.isArray(parts)) return null;
    for (const part of parts) {
      if (typeof part !== 'object' || part === null || typeof (part as Record<string, unknown>).type !== 'string') {
        return null;
      }
    }
  }
  return messages as UIMessage[];
}

export function createConversationRoutes(deps: ConversationRouteDeps = defaultConversationDeps): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    void (async () => {
      try {
        res.json({ conversations: await deps.list() });
      } catch {
        res.status(500).json({ error: 'Conversation store is unavailable' });
      }
    })();
  });

  router.post('/', (_req: Request, res: Response) => {
    void (async () => {
      try {
        const { meta, evictedIds } = await deps.create();
        res.json({ conversation: meta, evictedIds });
      } catch {
        res.status(500).json({ error: 'Conversation store is unavailable' });
      }
    })();
  });

  router.get('/:id', (req: Request, res: Response) => {
    void (async () => {
      try {
        const record = await deps.get(req.params.id);
        if (record === null) {
          res.status(404).json({ error: 'Conversation not found' });
          return;
        }
        res.json({ meta: record.meta, messages: record.messages });
      } catch {
        res.status(500).json({ error: 'Conversation store is unavailable' });
      }
    })();
  });

  router.patch('/:id', (req: Request, res: Response) => {
    void (async () => {
      const title = parseTitle(req.body);
      if (title === null) {
        res.status(400).json({ error: 'title must be 1 to 120 characters' });
        return;
      }
      try {
        const { meta } = await deps.rename(req.params.id, title);
        if (meta === null) {
          res.status(404).json({ error: 'Conversation not found' });
          return;
        }
        res.json({ conversation: meta });
      } catch {
        res.status(500).json({ error: 'Conversation store is unavailable' });
      }
    })();
  });

  router.delete('/:id', (req: Request, res: Response) => {
    void (async () => {
      try {
        await deps.remove(req.params.id);
        res.json({ ok: true });
      } catch {
        res.status(500).json({ error: 'Conversation store is unavailable' });
      }
    })();
  });

  router.put('/:id/messages', (req: Request, res: Response) => {
    void (async () => {
      const messages = parseMessagesBody(req.body);
      if (messages === null) {
        res.status(400).json({ error: 'Request body must be an object with a messages array of UI messages' });
        return;
      }
      try {
        const result = await deps.putMessages(req.params.id, messages);
        if (result === null) {
          res.status(404).json({ error: 'Conversation not found' });
          return;
        }
        res.json({ meta: result.meta, evictedIds: result.evictedIds });
      } catch {
        res.status(500).json({ error: 'Conversation store is unavailable' });
      }
    })();
  });

  return router;
}
