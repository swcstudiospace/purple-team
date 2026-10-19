import { useCallback, useSyncExternalStore } from 'react';

/**
 * Per-thread composer drafts. Module-level (not React state) so a draft
 * survives unmounts and thread switches — switching conversations restores
 * the right draft instantly, and nothing is persisted to storage.
 */
const drafts = new Map<string, string>();
const listeners = new Set<() => void>();

function notifyDrafts(): void {
  for (const listener of [...listeners]) listener();
}

function subscribeDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Sets (or clears, on '') one thread's draft and notifies subscribers. */
export function setDraft(threadId: string, value: string): void {
  if (value === '') {
    if (!drafts.has(threadId)) return;
    drafts.delete(threadId);
  } else {
    drafts.set(threadId, value);
  }
  notifyDrafts();
}

/** Binds one thread's draft to the component; `[value, setValue]`. */
export function useDraft(threadId: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribeDrafts, () => drafts.get(threadId) ?? '');
  const update = useCallback((next: string) => setDraft(threadId, next), [threadId]);
  return [value, update];
}
