import { create } from 'zustand';
import type { GitHubResolveResponse } from '../api/client';

/**
 * The repo attached as the target for the next Purple Team run. This is the
 * agreed handoff seam between the GitHub section (write) and the run-config
 * surfaces (read): values are already validated server-side by
 * GET /api/github/resolve, so consumers never re-parse URLs.
 *
 * The target is conversation-scoped: `threadId` records the conversation the
 * target belongs to, and consumers (composer chip, paste capture, run-config
 * prefill, hunt default) must only treat it as attached when that id matches
 * their active conversation — otherwise a mission launched in one thread
 * would silently leak its repo into every other thread. `select` stays the
 * GitHub page handoff (no conversation, threadId null): it feeds the page's
 * own surfaces but attaches to no thread.
 *
 * If the account disconnects while a private repo is selected the selection is
 * kept, but run config must re-resolve before starting a run.
 */
export interface SelectedRepo {
  owner: string;
  repo: string;
  /** Branch / tag / commit — explicit ref from the URL when present, else defaultBranch. */
  ref: string;
  visibility: 'public' | 'private' | 'internal';
  fullName: string;
}

interface SelectedRepoState {
  selected: SelectedRepo | null;
  /** Full GET /api/github/resolve payload when the target arrived via a resolve. */
  resolution: GitHubResolveResponse | null;
  /** Owning conversation id — null for the GitHub page handoff (attached to no thread). */
  threadId: string | null;
  /** GitHub page handoff — attach() without a resolution payload or conversation. */
  select: (repo: SelectedRepo) => void;
  /** Attach the run target to a conversation (compact summary + optional resolve payload). */
  attach: (repo: SelectedRepo, resolution?: GitHubResolveResponse, threadId?: string) => void;
  clear: () => void;
  /** True when a target exists AND belongs to the given conversation. */
  isAttachedTo: (threadId: string) => boolean;
  /** A GitHub URL pasted anywhere in the UI, waiting for the repo entry screen. */
  pastePrefill: string | null;
  setPastePrefill: (url: string) => void;
  /** Reads and clears the pending paste prefill (single consumer). */
  consumePastePrefill: () => string | null;
}

export const useSelectedRepo = create<SelectedRepoState>()((set, get) => ({
  selected: null,
  resolution: null,
  threadId: null,
  select: repo => set({ selected: repo, resolution: null, threadId: null }),
  attach: (repo, resolution, threadId) =>
    set({ selected: repo, resolution: resolution ?? null, threadId: threadId ?? null }),
  clear: () => set({ selected: null, resolution: null, threadId: null, pastePrefill: null }),
  isAttachedTo: threadId => {
    const state = get();
    return state.selected !== null && state.threadId === threadId;
  },
  pastePrefill: null,
  setPastePrefill: url => set({ pastePrefill: url }),
  consumePastePrefill: () => {
    const url = get().pastePrefill;
    if (url !== null) set({ pastePrefill: null });
    return url;
  },
}));
