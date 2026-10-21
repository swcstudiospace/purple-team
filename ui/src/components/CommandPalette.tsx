/**
 * Global Ctrl/Cmd+K command palette — navigation and actions only.
 *
 * Self-mounting: the (Ctrl|Meta)+K window listener lives here, so the host
 * just renders <CommandPalette /> once. Nothing is rendered to the DOM until
 * the first open; closing unmounts the overlay. Focus management (initial
 * focus on the filter input, Tab loop, Escape dismissal, focus restored to
 * the opener) is delegated to the shared useFocusTrap from workbench/focus,
 * which also raises escapeGuard.dialogOpen so the shell's window-level
 * Escape handler stays out of the way.
 *
 * Section ids mirror App.tsx NAV_ITEMS / sectionFromHash verbatim; the
 * palette navigates purely through location.hash and imports nothing from
 * App.tsx.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from './workbench/focus';
import './command-palette.css';

/** Keep in sync with the SectionId union + NAV_ITEMS in App.tsx. */
const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'github', label: 'GitHub' },
  { id: 'chat', label: 'Chat Panel' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
];

const THEME_STORAGE_KEY = 't3mp3st_theme';

/** Flips the root data-theme and persists the choice for the next session. */
function toggleTheme(): void {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable (privacy modes); the visual toggle still applies.
  }
}

interface PaletteItem {
  id: string;
  label: string;
  kind: 'Section' | 'Action';
  run: () => void;
}

const ITEMS: ReadonlyArray<PaletteItem> = [
  ...SECTIONS.map((section): PaletteItem => ({
    id: `nav-${section.id}`,
    label: section.label,
    kind: 'Section',
    run: () => {
      // Same guarded hash write App.tsx uses; its hashchange listener reacts.
      if (window.location.hash !== `#${section.id}`) window.location.hash = section.id;
    },
  })),
  { id: 'toggle-theme', label: 'Toggle dark mode', kind: 'Action', run: toggleTheme },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const needle = query.toLowerCase();
  const items = needle === '' ? ITEMS : ITEMS.filter(item => item.label.toLowerCase().includes(needle));
  const activeIndex = items.length > 0 ? Math.min(highlight, items.length - 1) : -1;
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-opt-${items[activeIndex].id}` : null;

  const close = useCallback(() => setOpen(false), []);

  // Filter input gets initial focus; Tab loops the dialog; Escape closes and
  // the trap restores focus to the element focused before the palette opened.
  useFocusTrap(open, dialogRef, close);

  // (Ctrl|Meta)+K toggles the palette from anywhere on the page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(value => !value);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // A fresh open starts with an empty filter and the first row highlighted.
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
    }
  }, [open]);

  // Keep the highlighted row visible once the list overflows.
  useEffect(() => {
    if (activeOptionId === null) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId]);

  function activate(item: PaletteItem): void {
    close();
    item.run();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault();
      setHighlight((activeIndex + 1) % items.length);
    } else if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault();
      setHighlight((activeIndex - 1 + items.length) % items.length);
    } else if (event.key === 'Enter' && event.target === inputRef.current && activeIndex >= 0) {
      // Row buttons own their native Enter click; only the filter input
      // activates the highlighted row from here.
      event.preventDefault();
      activate(items[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div className="cmdk-overlay">
      <div className="cmdk-backdrop" aria-hidden="true" onClick={close} />
      <div
        ref={dialogRef}
        className="cmdk-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          className="cmdk-input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId ?? undefined}
          aria-label="Filter commands"
          placeholder="Type a command…"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setHighlight(0);
          }}
        />
        <ul id={listboxId} className="cmdk-list" role="listbox" aria-label="Commands">
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listboxId}-opt-${item.id}`}
              className="cmdk-item"
              role="option"
              aria-selected={index === activeIndex}
            >
              <button type="button" className="cmdk-option" onClick={() => activate(item)}>
                <span className="cmdk-label">{item.label}</span>
                <span className="cmdk-kind">{item.kind}</span>
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 ? <p className="cmdk-empty" role="status">No matching commands</p> : null}
      </div>
    </div>
  );
}
