import { createContext, useContext } from 'react';

/**
 * Announces a short, human-readable line through the chat's polite status
 * region (role="status" aria-live="polite"). Screen-reader-only feedback for
 * one-off outcomes like "Copied code." — the provider lives in ChatStream.
 */
export type Announce = (message: string) => void;

export const AnnounceContext = createContext<Announce>(() => {});

export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
