/**
 * Conversation sidebar state (phase 36 §3.4) — the UI's first zustand store.
 *
 * The server JSON store is the single durable substrate: there is no
 * browser-side mirror of messages (avoids split-brain). This store holds the
 * meta list, the active id, and the debounced 1s PUT-sync seam ChatStream
 * reports settled threads into. Composer drafts live in
 * ui/src/components/chat/drafts.ts keyed by the same thread id.
 */

import { create } from 'zustand';
import type { UIMessage } from 'ai';
import {
  ApiError,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  putConversationMessages,
  renameConversation,
  type ConversationMeta,
} from '../api/client';
import { readPrefs, savePrefs } from '../components/workbench/prefs';

type ConversationsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ConversationsState {
  metas: ConversationMeta[];
  activeId: string | null;
  status: ConversationsStatus;
  error: string | null;
  /** Thread whose reply is streaming right now (null when none); the sidebar gates export on it. */
  streamingThreadId: string | null;
  setStreaming: (threadId: string, streaming: boolean) => void;
  /** Thread that started each run (runId or missionId → threadId). In memory only; not persisted across reloads. */
  runOwners: Record<string, string>;
  /** Records the thread that started these runs; the first owner of a runId is kept. */
  recordRunOwners: (threadId: string, runIds: string[]) => void;
  /** Loads the list and guarantees an active conversation (creating one when empty). */
  load: (preferredId?: string | null) => Promise<void>;
  createAndActivate: () => Promise<void>;
  switchTo: (id: string) => void;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Debounced PUT-sync of a settled thread; dedupes unchanged payloads. */
  syncMessages: (id: string, messages: UIMessage[]) => void;
  /** Loads a conversation's messages for the workbench (and remembers the snapshot to dedupe syncs). */
  loadMessages: (id: string) => Promise<UIMessage[]>;
}

const SYNC_DEBOUNCE_MS = 1000;

const syncTimers = new Map<string, number>();
const pendingPayloads = new Map<string, string>();
const lastSyncedPayloads = new Map<string, string>();

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'The conversation store is unreachable.';
}

function applyEvictions(state: ConversationsState, evictedIds: string[] | undefined): Partial<ConversationsState> {
  if (evictedIds === undefined || evictedIds.length === 0) return {};
  const dropped = new Set(evictedIds);
  const metas = state.metas.filter(meta => !dropped.has(meta.id));
  return { metas };
}

function upsertMeta(metas: ConversationMeta[], meta: ConversationMeta): ConversationMeta[] {
  const index = metas.findIndex(entry => entry.id === meta.id);
  if (index === -1) return [meta, ...metas];
  const next = metas.slice();
  next[index] = meta;
  return next;
}

/** In-flight PUTs per thread, so an export can await a request that already left. */
const inFlightSyncs = new Map<string, Promise<void>>();

/** Fires (and clears) the pending debounced PUT for one conversation, if any. */
function flushSync(id: string): void {
  const timer = syncTimers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    syncTimers.delete(id);
  }
  const payload = pendingPayloads.get(id);
  if (payload === undefined) return;
  pendingPayloads.delete(id);
  if (payload === lastSyncedPayloads.get(id)) return;
  lastSyncedPayloads.set(id, payload);
  const request = putConversationMessages(id, JSON.parse(payload) as UIMessage[])
    .then(response => {
      useConversationsStore.setState(state => ({
        ...applyEvictions(state, response.evictedIds),
        metas: upsertMeta(state.metas, response.meta),
        error: null,
      }));
    })
    .catch((err: unknown) => {
      // The next settle re-schedules; surface the failure without blocking chat.
      lastSyncedPayloads.delete(id);
      useConversationsStore.setState({ error: errorMessage(err) });
    })
    .finally(() => {
      if (inFlightSyncs.get(id) === request) inFlightSyncs.delete(id);
    });
  inFlightSyncs.set(id, request);
}

/** Settles the thread's queued or in-flight PUT so an export reads the settled replies. */
export async function flushPendingSync(id: string): Promise<void> {
  flushSync(id);
  await inFlightSyncs.get(id);
}

/** runId values a start response names: the run id and the mission id (mission ticks emit under the mission id). */
export function startedRunIds(body: unknown): string[] {
  if (body === null || typeof body !== 'object') return [];
  const record: Record<string, unknown> = { ...body };
  return ['runId', 'missionId']
    .map(key => record[key])
    .filter((value): value is string => typeof value === 'string' && value !== '');
}

export const useConversationsStore = create<ConversationsState>()((set, get) => ({
  metas: [],
  streamingThreadId: null,
  setStreaming: (threadId, streaming) => {
    if (streaming) {
      set({ streamingThreadId: threadId });
    } else if (get().streamingThreadId === threadId) {
      set({ streamingThreadId: null });
    }
  },
  runOwners: {},
  recordRunOwners: (threadId, runIds) => {
    const owners = { ...get().runOwners };
    let changed = false;
    for (const runId of runIds) {
      if (runId === '' || owners[runId] !== undefined) continue;
      owners[runId] = threadId;
      changed = true;
    }
    if (changed) set({ runOwners: owners });
  },
  activeId: null,
  status: 'idle',
  error: null,

  load: async preferredId => {
    set({ status: 'loading', error: null });
    try {
      const { conversations } = await listConversations();
      const preferred = preferredId ?? readPrefs().activeConversationId ?? null;
      const activeId =
        (preferred !== null && conversations.some(meta => meta.id === preferred) ? preferred : undefined) ??
        conversations[0]?.id ??
        null;
      set({ metas: conversations, status: 'ready' });
      if (activeId !== null) {
        get().switchTo(activeId);
      } else {
        await get().createAndActivate();
      }
    } catch (err: unknown) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  createAndActivate: async () => {
    try {
      const { conversation, evictedIds } = await createConversation();
      set(state => ({
        ...applyEvictions(state, evictedIds),
        metas: upsertMeta(state.metas, conversation),
        activeId: conversation.id,
        error: null,
      }));
      savePrefs({ activeConversationId: conversation.id });
    } catch (err: unknown) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  switchTo: id => {
    if (get().activeId === id) return;
    const previous = get().activeId;
    if (previous !== null) flushSync(previous);
    set({ activeId: id, error: null });
    savePrefs({ activeConversationId: id });
  },

  rename: async (id, title) => {
    try {
      const { conversation } = await renameConversation(id, title);
      set(state => ({ metas: upsertMeta(state.metas, conversation), error: null }));
    } catch (err: unknown) {
      set({ error: errorMessage(err) });
    }
  },

  remove: async id => {
    const timer = syncTimers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      syncTimers.delete(id);
    }
    pendingPayloads.delete(id);
    lastSyncedPayloads.delete(id);
    try {
      await deleteConversation(id);
      const remaining = get().metas.filter(meta => meta.id !== id);
      set({ metas: remaining, error: null });
      if (get().activeId === id) {
        const next = remaining[0]?.id;
        if (next !== undefined) {
          get().switchTo(next);
        } else {
          await get().createAndActivate();
        }
      }
    } catch (err: unknown) {
      set({ error: errorMessage(err) });
    }
  },

  syncMessages: (id, messages) => {
    if (id === '' || messages.length === 0) return;
    if (get().metas.every(meta => meta.id !== id)) return;
    const payload = JSON.stringify(messages);
    if (payload === lastSyncedPayloads.get(id)) return;
    pendingPayloads.set(id, payload);
    const existing = syncTimers.get(id);
    if (existing !== undefined) window.clearTimeout(existing);
    syncTimers.set(
      id,
      window.setTimeout(() => {
        syncTimers.delete(id);
        flushSync(id);
      }, SYNC_DEBOUNCE_MS),
    );
  },

  loadMessages: async id => {
    try {
      const { meta, messages } = await getConversation(id);
      lastSyncedPayloads.set(id, JSON.stringify(messages));
      set(state => ({ metas: upsertMeta(state.metas, meta), error: null }));
      return messages;
    } catch (err: unknown) {
      set({ error: errorMessage(err) });
      return [];
    }
  },
}));
