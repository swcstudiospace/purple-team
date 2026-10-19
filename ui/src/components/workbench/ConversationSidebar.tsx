/**
 * Conversation sidebar (phase 36 §3.1): list with title/relative time/count,
 * "New chat", inline Rename dialog and two-step Delete confirm — the delete
 * mirrors the /stop confirm philosophy (registry.ts). At ≤1024px the same
 * markup becomes an overlay drawer (role="dialog", focus-trapped, §7);
 * wider layouts render it as the inline 280px column.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useConversationsStore } from '../../stores/conversations';
import { useFocusTrap } from './focus';
import { WorkbenchDialog } from './WorkbenchDialog';
import './workbench.css';

interface ConversationSidebarProps {
  /** id of the sidebar element (the header toggle's aria-controls). */
  id: string;
  open: boolean;
  /** Drawer-mode close (narrow viewport); inline mode ignores it. */
  onClose: () => void;
}

const TITLE_MAX_CHARS = 120;

/** Compact relative time for the sidebar rows ("just now", "5m ago", "3d ago"). */
function relativeTime(updatedAt: number, now: number): string {
  const deltaSeconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (deltaSeconds < 45) return 'just now';
  const minutes = Math.round(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(updatedAt).toLocaleDateString();
}

export function ConversationSidebar({ id, open, onClose }: ConversationSidebarProps) {
  const metas = useConversationsStore(state => state.metas);
  const activeId = useConversationsStore(state => state.activeId);
  const status = useConversationsStore(state => state.status);
  const error = useConversationsStore(state => state.error);
  const createAndActivate = useConversationsStore(state => state.createAndActivate);
  const switchTo = useConversationsStore(state => state.switchTo);
  const rename = useConversationsStore(state => state.rename);
  const remove = useConversationsStore(state => state.remove);

  const [isDrawer, setIsDrawer] = useState(() => window.matchMedia('(max-width: 1024px)').matches);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drawerPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => setIsDrawer(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Keep the relative times honest while the panel stays open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (focusedIndex > metas.length - 1) setFocusedIndex(Math.max(0, metas.length - 1));
  }, [metas.length, focusedIndex]);

  useFocusTrap(open && isDrawer, drawerPanelRef, onClose);

  if (!open) return null;

  function focusItem(index: number): void {
    const count = metas.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    setFocusedIndex(next);
    itemRefs.current[next]?.focus();
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (metas.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(focusedIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(focusedIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(metas.length - 1);
    }
  }

  function submitRename(): void {
    const trimmed = renameValue.trim();
    if (renaming === null || trimmed === '') return;
    void rename(renaming.id, trimmed.slice(0, TITLE_MAX_CHARS));
    setRenaming(null);
  }

  const role = isDrawer ? 'dialog' : 'complementary';
  const label = 'Conversations';

  return (
    <>
      {isDrawer && <div className="apx-sidebar-backdrop" aria-hidden="true" onClick={onClose} />}
      <div
        ref={drawerPanelRef}
        id={id}
        role={role}
        aria-modal={isDrawer ? true : undefined}
        aria-label={label}
        className={`apx-sidebar${isDrawer ? ' apx-sidebar--drawer' : ''}`}
        tabIndex={isDrawer ? -1 : undefined}
      >
      {isDrawer && (
        <button type="button" className="apx-sidebar-close" aria-label="Close conversations" onClick={onClose}>
          ×
        </button>
      )}
      <div className="apx-sidebar-head">
        <h3 className="apx-sidebar-title">{label}</h3>
        <button
          type="button"
          className="apx-sidebar-new"
          onClick={() => void createAndActivate()}
          disabled={status === 'loading'}
        >
          New chat
        </button>
      </div>

      {error !== null && (
        <p className="apx-sidebar-error" role="alert">
          {error}
        </p>
      )}

      {metas.length === 0 ? (
        <p className="apx-sidebar-empty">No conversations yet</p>
      ) : (
        <ul className="apx-sidebar-list" aria-label="Conversation list" onKeyDown={handleListKeyDown}>
          {metas.map((meta, index) => {
            const active = meta.id === activeId;
            const title = meta.title === '' ? 'New chat' : meta.title;
            return (
              <li key={meta.id} className="apx-sidebar-item">
                <button
                  type="button"
                  ref={el => {
                    itemRefs.current[index] = el;
                  }}
                  className={`apx-sidebar-link${active ? ' apx-sidebar-link--active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  tabIndex={index === focusedIndex ? 0 : -1}
                  onClick={() => switchTo(meta.id)}
                >
                  <span className="apx-sidebar-link-title">{title}</span>
                  <span className="apx-sidebar-link-meta">
                    {relativeTime(meta.updatedAt, now)}
                    {' · '}
                    {meta.messageCount === 1 ? '1 message' : `${meta.messageCount} messages`}
                  </span>
                </button>
                <span className="apx-sidebar-actions">
                  <button
                    type="button"
                    className="apx-sidebar-action"
                    aria-label={`Rename conversation ${title}`}
                    onClick={() => {
                      setRenaming({ id: meta.id, title: meta.title });
                      setRenameValue(meta.title);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="apx-sidebar-action apx-sidebar-action--danger"
                    aria-label={`Delete conversation ${title}`}
                    onClick={() => setDeleting({ id: meta.id, title })}
                  >
                    Delete
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <WorkbenchDialog
        open={renaming !== null}
        title="Rename conversation"
        onClose={() => setRenaming(null)}
        footer={
          <>
            <button type="button" className="apx-dialog-cancel" onClick={() => setRenaming(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="apx-dialog-confirm"
              onClick={submitRename}
              disabled={renameValue.trim() === ''}
            >
              Save title
            </button>
          </>
        }
      >
        <label className="apx-dialog-label" htmlFor="apx-rename-input">
          Title
        </label>
        <input
          id="apx-rename-input"
          className="apx-dialog-input"
          value={renameValue}
          maxLength={TITLE_MAX_CHARS}
          autoComplete="off"
          onChange={event => setRenameValue(event.target.value)}
        />
      </WorkbenchDialog>

      <WorkbenchDialog
        open={deleting !== null}
        title="Delete conversation"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button type="button" className="apx-dialog-cancel" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="apx-dialog-confirm apx-dialog-confirm--danger"
              onClick={() => {
                if (deleting !== null) void remove(deleting.id);
                setDeleting(null);
              }}
            >
              Delete conversation
            </button>
          </>
        }
      >
        <p>
          Delete <strong>{deleting?.title ?? ''}</strong>? Its messages are removed from the server store. This
          cannot be undone.
        </p>
      </WorkbenchDialog>
    </div>
    </>
  );
}
