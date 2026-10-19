/**
 * JSON-file conversation store (phase 36 §3.2).
 *
 * Conversations are bulk user data, not settings, so this follows the
 * `src/llm/oauth.ts` JSON-file pattern (env-overridable path under
 * `~/.t3mp3st`, `0600` permissions, in-memory cache) rather than `Conf` —
 * with one upgrade: conversation files are larger and written on every chat
 * settle, so mutations serialize through a promise chain and persist via
 * temp-file + rename to guarantee a crash never leaves a half-written store.
 *
 * Caps (enforced on every write, all exported for tests):
 *  - MAX_CONVERSATIONS: LRU-evict lowest `updatedAt` past 50 records.
 *  - MAX_STORED_MESSAGES: keep the newest 200 messages per conversation.
 *  - MAX_MESSAGE_TEXT_CHARS: clip each message's text to 8000 characters
 *    (same ceiling the client enforces in ChatStream).
 *  - MAX_STORE_BYTES: evict conversations LRU until the serialized file is
 *    under ~5 MB (never evicts the last remaining conversation).
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import type { UIMessage } from 'ai';

export const MAX_CONVERSATIONS = 50;
export const MAX_STORED_MESSAGES = 200;
export const MAX_MESSAGE_TEXT_CHARS = 8000;
export const MAX_STORE_BYTES = 5 * 1024 * 1024;

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ConversationRecord {
  meta: ConversationMeta;
  messages: UIMessage[];
}

interface StoreFile {
  version: 1;
  conversations: ConversationRecord[];
}

/** Store path override seam (mirrors `oauthStorePath`, src/llm/oauth.ts). */
export function conversationStorePath(): string {
  const override = (process.env.T3MP3ST_CONVERSATIONS_STORE || '').trim();
  if (override) return override;
  return join(homedir(), '.t3mp3st', 'conversations.json');
}

let cache: StoreFile | null = null;
let nowFn: () => number = () => Date.now();

/** All mutations and reads serialize through this chain (atomic-write §3.2). */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => T): Promise<T> {
  const run = writeChain.then(operation);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Test helper — drop the in-memory cache (env var selects the next path). */
export function __resetConversationStore(): void {
  cache = null;
  writeChain = Promise.resolve();
}

/** Test helper — override the clock. */
export function __setConversationNow(fn: (() => number) | undefined): void {
  nowFn = fn ?? (() => Date.now());
}

function isValidMeta(meta: unknown): meta is ConversationMeta {
  if (typeof meta !== 'object' || meta === null) return false;
  const record = meta as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    record.id !== '' &&
    typeof record.title === 'string' &&
    typeof record.createdAt === 'number' &&
    Number.isFinite(record.createdAt) &&
    typeof record.updatedAt === 'number' &&
    Number.isFinite(record.updatedAt) &&
    typeof record.messageCount === 'number'
  );
}

function isValidRecord(entry: unknown): entry is ConversationRecord {
  return typeof entry === 'object' && entry !== null && isValidMeta((entry as Record<string, unknown>).meta) &&
    Array.isArray((entry as Record<string, unknown>).messages);
}

/** Corrupt or foreign files load as an empty store (same recovery as oauth `loadStore`). */
function normalizeFile(parsed: unknown): StoreFile {
  if (typeof parsed !== 'object' || parsed === null) return { version: 1, conversations: [] };
  const conversations: unknown = (parsed as Record<string, unknown>).conversations;
  if (!Array.isArray(conversations)) return { version: 1, conversations: [] };
  return { version: 1, conversations: conversations.filter(isValidRecord) };
}

function loadFile(): StoreFile {
  if (cache !== null) return cache;
  const path = conversationStorePath();
  try {
    if (!existsSync(path)) {
      cache = { version: 1, conversations: [] };
      return cache;
    }
    cache = normalizeFile(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    cache = { version: 1, conversations: [] };
  }
  return cache;
}

/** Temp-file + rename persistence; `0600` with best-effort chmod (§3.2). */
function persist(file: StoreFile): void {
  const path = conversationStorePath();
  const tmp = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, `${JSON.stringify(file)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best-effort: filesystems without chmod still get the 0600 write mode above.
  }
}

/** LRU order: least recently updated first (createdAt breaks ties deterministically). */
function byLru(a: ConversationRecord, b: ConversationRecord): number {
  return a.meta.updatedAt - b.meta.updatedAt || a.meta.createdAt - b.meta.createdAt;
}

function enforceCaps(file: StoreFile): string[] {
  const evicted: string[] = [];
  if (file.conversations.length > MAX_CONVERSATIONS) {
    const doomed = [...file.conversations].sort(byLru).slice(0, file.conversations.length - MAX_CONVERSATIONS);
    for (const record of doomed) evicted.push(record.meta.id);
    const doomedIds = new Set(evicted);
    file.conversations = file.conversations.filter(record => !doomedIds.has(record.meta.id));
  }
  while (JSON.stringify(file).length > MAX_STORE_BYTES && file.conversations.length > 1) {
    const sorted = [...file.conversations].sort(byLru);
    const victim = sorted[0];
    evicted.push(victim.meta.id);
    file.conversations = file.conversations.filter(record => record.meta.id !== victim.meta.id);
  }
  return evicted;
}

function mutate<T>(operation: (file: StoreFile) => T): Promise<T> {
  return enqueue(() => {
    const file = loadFile();
    const result = operation(file);
    const evicted = enforceCaps(file);
    persist(file);
    return { result, evicted };
  });
}

/** Clips a message's text parts so their combined length fits the per-message cap. */
function capMessageText(message: UIMessage): UIMessage {
  let budget = MAX_MESSAGE_TEXT_CHARS;
  let touched = false;
  const parts = message.parts.map(part => {
    if (part.type === 'text' && typeof part.text === 'string' && part.text.length > 0) {
      const take = Math.min(part.text.length, budget);
      budget -= take;
      if (take < part.text.length) {
        touched = true;
        return { ...part, text: part.text.slice(0, take) };
      }
    }
    return part;
  });
  return touched ? { ...message, parts } : message;
}

/** Default sidebar title: first user text, whitespace-collapsed, clipped to 60 chars (§3.1). */
function deriveTitle(messages: UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== 'user') continue;
    for (const part of message.parts) {
      if (part.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') {
        const collapsed = part.text.replace(/\s+/g, ' ').trim();
        return collapsed.length > 60 ? `${collapsed.slice(0, 60)}…` : collapsed;
      }
    }
  }
  return '';
}

/** Conversations sorted by `updatedAt` desc (newest first). */
export function listConversations(): Promise<ConversationMeta[]> {
  return enqueue(() =>
    loadFile()
      .conversations.map(record => ({ ...record.meta }))
      .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt),
  );
}

export function createConversation(): Promise<{ meta: ConversationMeta; evictedIds: string[] }> {
  return mutate(file => {
    const now = nowFn();
    const meta: ConversationMeta = {
      id: randomUUID(),
      title: '',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    file.conversations.unshift({ meta, messages: [] });
    return { meta: { ...meta } };
  }).then(({ result, evicted }) => ({ meta: result.meta, evictedIds: evicted }));
}

export function getConversationRecord(id: string): Promise<ConversationRecord | null> {
  return enqueue(() => {
    const record = loadFile().conversations.find(entry => entry.meta.id === id);
    if (record === undefined) return null;
    return { meta: { ...record.meta }, messages: record.messages.map(message => ({ ...message })) };
  });
}

export function renameConversation(
  id: string,
  title: string,
): Promise<{ meta: ConversationMeta | null; evictedIds: string[] }> {
  return mutate(file => {
    const record = file.conversations.find(entry => entry.meta.id === id);
    if (record === undefined) return null;
    record.meta.title = title;
    return { ...record.meta };
  }).then(({ result, evicted }) => ({ meta: result, evictedIds: evicted }));
}

export function deleteConversation(id: string): Promise<boolean> {
  return mutate(file => {
    const index = file.conversations.findIndex(entry => entry.meta.id === id);
    if (index === -1) return false;
    file.conversations.splice(index, 1);
    return true;
  }).then(({ result }) => result);
}

/**
 * Replaces a conversation's messages, capped (§3.2): newest 200 kept, each
 * message's text clipped to 8000 chars. Data parts (`data-purple-run`,
 * `data-genui`) persist for display reload but never reach the model — the
 * chat route strips them client-side via `toWireMessages` before /api/chat.
 */
export function putConversationMessages(
  id: string,
  messages: UIMessage[],
): Promise<{ meta: ConversationMeta; evictedIds: string[] } | null> {
  return mutate(file => {
    const record = file.conversations.find(entry => entry.meta.id === id);
    if (record === undefined) return null;
    const capped = messages.slice(-MAX_STORED_MESSAGES).map(capMessageText);
    record.messages = capped;
    record.meta.messageCount = capped.length;
    record.meta.updatedAt = nowFn();
    if (record.meta.title === '') record.meta.title = deriveTitle(capped);
    return { meta: { ...record.meta } };
  }).then(({ result, evicted }) =>
    result === null ? null : { meta: result.meta, evictedIds: evicted },
  );
}
