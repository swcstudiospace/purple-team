/**
 * Workbench display preferences (phase 36 §2.2).
 *
 * Typed façade over one localStorage key, try/catch-wrapped for private-mode
 * and quota errors. Display prefs are UI-local state: they never belong in the
 * server conversation store or `Conf`. The in-module cache keeps reads cheap
 * and makes `savePrefs` merge-on-write for callers that only own one field.
 */

export type RailState = 'expanded' | 'collapsed' | 'hidden';

export interface WorkbenchPrefs {
  railState: RailState;
  /** True exactly when railState === 'hidden' (focus mode); stored for the doc's §2.2 shape. */
  focusMode: boolean;
  sidebarOpen: boolean;
  activeConversationId?: string;
}

const PREFS_KEY = 't3mp3st.ui.prefs.v1';

const DEFAULT_PREFS: WorkbenchPrefs = {
  railState: 'expanded',
  focusMode: false,
  sidebarOpen: true,
};

const RAIL_STATES: Record<RailState, true> = {
  expanded: true,
  collapsed: true,
  hidden: true,
};

let prefsCache: WorkbenchPrefs | null = null;

function isPrefs(value: unknown): value is WorkbenchPrefs {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.railState !== 'string' || !Object.hasOwn(RAIL_STATES, record.railState)) return false;
  if (typeof record.focusMode !== 'boolean') return false;
  if (typeof record.sidebarOpen !== 'boolean') return false;
  if (record.activeConversationId !== undefined && typeof record.activeConversationId !== 'string') return false;
  return true;
}

export function readPrefs(): WorkbenchPrefs {
  if (prefsCache !== null) return prefsCache;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isPrefs(parsed)) {
        prefsCache = parsed;
        return prefsCache;
      }
    }
  } catch {
    // Private mode / disabled storage: fall through to defaults for this session.
  }
  prefsCache = { ...DEFAULT_PREFS };
  return prefsCache;
}

/** Merges a patch into the cached prefs and best-effort persists them. */
export function savePrefs(patch: Partial<WorkbenchPrefs>): void {
  const current = readPrefs();
  const next: WorkbenchPrefs = { ...current, ...patch };
  if (next.railState === 'hidden' !== next.focusMode) next.focusMode = next.railState === 'hidden';
  prefsCache = next;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the in-memory cache still holds this session's prefs.
  }
}
