/**
 * Conversation sidebar (phase 36 §3.1): list with title/relative time/count,
 * "New chat", inline Rename dialog and two-step Delete confirm — the delete
 * mirrors the /stop confirm philosophy (registry.ts). At ≤1024px the same
 * markup becomes an overlay drawer (role="dialog", focus-trapped, §7);
 * wider layouts render it as the inline 280px column.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { UIMessage } from 'ai';
import { ApiError, getConversation } from '../../api/client';
import { flushPendingSync, useConversationsStore } from '../../stores/conversations';
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

/** Turns a thread title into a safe download basename (falls back when empty). */
function exportFileBase(title: string): string {
  const safe = Array.from(title, ch => (ch.charCodeAt(0) < 0x20 ? ' ' : ch))
    .join('')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
    .trim();
  return safe === '' ? 'conversation' : safe;
}

/** Joins a message's text parts; non-text parts (run cards, step markers) are skipped. */
function messageText(message: UIMessage): string {
  const texts: string[] = [];
  for (const part of message.parts) {
    if (part.type === 'text') texts.push(part.text);
  }
  return texts.join('\n\n');
}

/** Renders a thread as Markdown: title header, then one section per message. */
function toMarkdown(title: string, messages: UIMessage[]): string {
  const lines: string[] = [`# ${title}`];
  for (const message of messages) {
    const text = messageText(message);
    if (text === '') continue;
    lines.push('', `## ${message.role === 'user' ? 'You' : 'Model'}`, '', text);
  }
  return `${lines.join('\n')}\n`;
}

/** Saves a string through a Blob URL + temporary anchor click, revoking afterwards. */
function downloadText(content: string, mediaType: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ConversationSidebar({ id, open, onClose }: ConversationSidebarProps) {
  const metas = useConversationsStore(state => state.metas);
  const activeId = useConversationsStore(state => state.activeId);
  const status = useConversationsStore(state => state.status);
  const error = useConversationsStore(state => state.error);
  const streaming = useConversationsStore(
    state => state.streamingThreadId !== null && state.streamingThreadId === state.activeId,
  );
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
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Client-side title filter; an empty query keeps the full list and its keyboard behavior.
  const searchQuery = search.trim().toLowerCase();
  const visibleMetas =
    searchQuery === ''
      ? metas
      : metas.filter(meta => (meta.title === '' ? 'New chat' : meta.title).toLowerCase().includes(searchQuery));

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
    if (focusedIndex > visibleMetas.length - 1) setFocusedIndex(Math.max(0, visibleMetas.length - 1));
  }, [visibleMetas.length, focusedIndex]);

  useFocusTrap(open && isDrawer, drawerPanelRef, onClose);

  if (!open) return null;

  function focusItem(index: number): void {
    const count = visibleMetas.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    setFocusedIndex(next);
    itemRefs.current[next]?.focus();
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (visibleMetas.length === 0) return;
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
      focusItem(visibleMetas.length - 1);
    }
  }

  /** Fetches the thread exactly like hydration (GET /api/conversations/:id) and downloads MD + JSON. */
  async function exportConversation(id: string, title: string): Promise<void> {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await flushPendingSync(id);
      const { messages } = await getConversation(id);
      const base = exportFileBase(title);
      downloadText(toMarkdown(title, messages), 'text/markdown', `${base}.md`);
      downloadText(JSON.stringify(messages, null, 2), 'application/json', `${base}.json`);
    } catch (err: unknown) {
      setExportError(
        err instanceof ApiError ? `Export failed: ${err.message}` : 'Export failed: the conversation store is unreachable.',
      );
    } finally {
      setExporting(false);
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

      <div className="apx-sidebar-search">
        <label className="visually-hidden" htmlFor="apx-sidebar-search-input">
          Search conversations
        </label>
        <input
          id="apx-sidebar-search-input"
          className="apx-sidebar-search-input"
          type="search"
          placeholder="Search conversations"
          autoComplete="off"
          value={search}
          onChange={event => {
            setSearch(event.target.value);
            setFocusedIndex(0);
          }}
        />
      </div>

      {error !== null && (
        <p className="apx-sidebar-error" role="alert">
          {error}
        </p>
      )}
      {exportError !== null && (
        <p className="apx-sidebar-error" role="alert">
          {exportError}
        </p>
      )}

      {metas.length === 0 ? (
        <p className="apx-sidebar-empty">No conversations yet</p>
      ) : visibleMetas.length === 0 ? (
        <p className="apx-sidebar-empty" role="status">
          No matches
        </p>
      ) : (
        <ul className="apx-sidebar-list" aria-label="Conversation list" onKeyDown={handleListKeyDown}>
          {visibleMetas.map((meta, index) => {
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
                  {active && (
                    <button
                      type="button"
                      className="apx-sidebar-action"
                      aria-label={`Export conversation ${title}`}
                      disabled={exporting || streaming}
                      onClick={() => void exportConversation(meta.id, title)}
                    >
                      Export
                    </button>
                  )}
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
