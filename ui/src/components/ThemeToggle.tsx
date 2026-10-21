import { useSyncExternalStore } from 'react';

/**
 * Theme preference toggle: light <-> dark with an "unset follows system" mode.
 *
 * The stored key lives in localStorage; while it is unset, no data-theme
 * attribute is written and the `prefers-color-scheme` dark block in
 * styles.css decides the palette. applyStoredTheme() runs once at module load
 * (main.tsx, before React renders) so a stored dark theme paints without a
 * flash of the light default.
 *
 * One module-level store owns the preference: every control (rail toggle,
 * Settings toggle, command palette) reads the same effective theme and writes
 * through setThemePreference, so no control can fall behind the others.
 */

/** Shared localStorage key; values are 'light' | 'dark' | absent. */
const THEME_STORAGE_KEY = 't3mp3st_theme';

type ThemePreference = 'light' | 'dark';

function readStoredPreference(): ThemePreference | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Storage unavailable (private mode): treat as unset so the system decides.
    return null;
  }
}

/** Stored override; null while unset, which means the system preference decides. */
let storedPreference: ThemePreference | null = readStoredPreference();
const listeners = new Set<() => void>();

function applyDataset(preference: ThemePreference | null): void {
  if (preference !== null) {
    document.documentElement.dataset.theme = preference;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/** Applies the stored preference to <html>; leaves the attribute unset when storage is unset. */
export function applyStoredTheme(): void {
  storedPreference = readStoredPreference();
  applyDataset(storedPreference);
}

/** Effective theme: stored override, else the system preference the CSS falls back to. */
function effectiveTheme(): ThemePreference {
  if (storedPreference !== null) return storedPreference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Persists and applies the preference, then notifies every mounted control. */
function setThemePreference(next: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage unavailable (private mode): the override still applies for this session.
  }
  storedPreference = next;
  applyDataset(next);
  for (const listener of listeners) listener();
}

/** Flips the shared effective theme; the command palette and ThemeToggle both call this. */
export function toggleThemePreference(): void {
  setThemePreference(effectiveTheme() === 'dark' ? 'light' : 'dark');
}

/** Effective theme shared by every control; subscribers re-render when it changes. */
export function useEffectiveTheme(): ThemePreference {
  return useSyncExternalStore(subscribe, effectiveTheme);
}

/** Button that cycles light <-> dark and persists the choice. */
export default function ThemeToggle() {
  const effective = useEffectiveTheme();

  return (
    <button
      type="button"
      onClick={toggleThemePreference}
      aria-pressed={effective === 'dark'}
      style={{
        padding: '8px 16px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--surface-alt)',
        color: 'var(--text-primary)',
        font: 'inherit',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {effective === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
