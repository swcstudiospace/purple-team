import { create } from 'zustand';

/**
 * The repo selected as the target for the next Purple Team run. This is the
 * agreed handoff seam between the GitHub section (write) and the run-config
 * surfaces (read): values are already validated server-side by
 * GET /api/github/resolve, so consumers never re-parse URLs.
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
  select: (repo: SelectedRepo) => void;
  clear: () => void;
}

export const useSelectedRepo = create<SelectedRepoState>(set => ({
  selected: null,
  select: repo => set({ selected: repo }),
  clear: () => set({ selected: null }),
}));
