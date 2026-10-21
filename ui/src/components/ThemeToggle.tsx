import { useEffect, useState } from 'react';

/**
 * Theme preference toggle: light <-> dark with an "unset follows system" mode.
 *
 * The stored key lives in localStorage; while it is unset, no data-theme
 * attribute is written and the `prefers-color-scheme` dark block in
 * styles.css decides the palette. applyStoredTheme() runs once at module load
 * (main.tsx, before React renders) so a stored dark theme paints without a
 * flash of the light default.
 */

/** Shared localStorage key; values are 'light' | 'dark' | absent. */
const THEME_STORAGE_KEY = 't3mp3st_theme';

type ThemePreference = 'light' | 'dark';

/** Applies the stored preference to <html>; leaves the attribute unset when storage is unset. */
export function applyStoredTheme(): void {
  let stored: ThemePreference | null = null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    stored = value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Storage unavailable (private mode): treat as unset so the system decides.
  }
  if (stored) {
    document.documentElement.dataset.theme = stored;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/** Button that cycles light <-> dark and persists the choice. */
export default function ThemeToggle() {
  const [stored, setStored] = useState<ThemePreference | null>(() => {
    try {
      const value = localStorage.getItem(THEME_STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    applyStoredTheme();
  }, []);

  // Effective theme: stored override, else the system preference the CSS falls back to.
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective: ThemePreference = stored ?? (systemPrefersDark ? 'dark' : 'light');

  const toggle = () => {
    const next: ThemePreference = effective === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the override still applies for this session.
    }
    document.documentElement.dataset.theme = next;
    setStored(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
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
