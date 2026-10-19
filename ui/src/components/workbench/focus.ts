/**
 * Shared focus utilities for the workbench (phase 36 §7).
 *
 * `escapeGuard` is a module-level snapshot of the transient UI states that
 * outrank "Escape exits focus mode" — the doc pins the precedence as palette
 * dismissal first, then confirm-cancel, then focus-mode exit, and dialogs trap
 * Escape while open. The shell's window-level Escape handler reads this guard;
 * the palette and dialogs update it every render and reset it on unmount.
 */

import { useEffect, type RefObject } from 'react';

export const escapeGuard = {
  paletteOpen: false,
  confirmPending: false,
  dialogOpen: false,
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function focusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    element => element.offsetWidth > 0 || element.offsetHeight > 0,
  );
}

/**
 * Focus trap for `role="dialog" aria-modal="true"` surfaces (rename/delete
 * dialogs, the ≤1024px sidebar drawer). Traps Tab/Shift+Tab, closes on
 * Escape, and restores focus to the element recorded at open time.
 */
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (panel === null) return undefined;
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    escapeGuard.dialogOpen = true;

    const initial = focusableElements(panel);
    (initial[0] ?? panel).focus();

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = focusableElements(panel!);
      if (focusables.length === 0) {
        event.preventDefault();
        panel!.focus();
        return;
      }
      if (focusables.length === 0) {
        event.preventDefault();
        (panel as HTMLElement).focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    (panel as HTMLElement).addEventListener('keydown', handleKeyDown);
    return () => {
      panel.removeEventListener('keydown', handleKeyDown);
      escapeGuard.dialogOpen = false;
      if (invoker !== null && document.contains(invoker)) invoker.focus();
    };
  }, [open, panelRef, onClose]);
}

