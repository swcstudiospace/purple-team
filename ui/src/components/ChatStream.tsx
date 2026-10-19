import { useChat } from '@ai-sdk/react';
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { DefaultChatTransport, type ChatStatus, type UIMessage } from 'ai';
import { subscribePurpleRuns } from '../lib/events';
import { AnnounceContext } from './chat/announce';
import { Composer } from './chat/composer';
import { MessageItem } from './chat/message';
import { cancelPurpleRunInMessages, upsertPurpleRun } from './chat/run-card';
import './chat-stream.css';
import './chat/chat.css';

/** Imperative handle the workbench uses beside the embedded composer. */
export interface ChatStreamHandle {
  /** Sends free text. Returns false, and sends nothing, while a reply is in flight. */
  send(text: string): boolean;
  /** Replaces the thread — persisted-conversation load after a sidebar switch. */
  loadMessages(messages: UIMessage[]): void;
  /** Moves focus to the composer textarea (panel-open focus, phase 36 §7). */
  focusComposer(): void;
}

interface ChatStreamProps {
  ref?: Ref<ChatStreamHandle>;
  /** Thread identity: keys the SDK chat state and the per-thread draft. */
  threadId?: string;
  /**
   * Workbench persistence seam (phase 36 §3.4): called with the full display
   * thread whenever it changes while settled (after a finish or error, or an
   * SSE run-card upsert). The workbench debounces the PUT; ChatStream stays
   * storage-free.
   */
  onThreadSettled?: (messages: UIMessage[], threadId: string) => void;
  /** False when the sidebar owns thread lifecycle (hides the header New chat). */
  showNewChat?: boolean;
  /** Focus the composer on mount (panel open). Never refocuses on thread switch. */
  autoFocusComposer?: boolean;
}

interface ErrorView {
  title: string;
  detail: string | null;
}

const transport = new DefaultChatTransport<UIMessage>({
  api: '/api/chat',
  // Send only text parts, trimmed under the server's history limits: `{ messages: UIMessage[] }`.
  prepareSendMessagesRequest: ({ messages }) => ({ body: { messages: toWireMessages(trimHistory(messages)) } }),
});

/** Per-message ceiling; keeps any single message under the server's trim budget. */
const MAX_MESSAGE_CHARS = 8000;

/** Scroll anchoring (§4.3): "pinned" while the user sits within this distance of the bottom. */
const PIN_DISTANCE_PX = 48;

/** Chunked aria-live (§7): at most one announcement per 500ms, each capped at ~200 chars. */
const LIVE_CHUNK_CHARS = 200;
const LIVE_CHUNK_INTERVAL_MS = 500;
const NOTICE_TIMEOUT_MS = 4000;

const DEFAULT_THREAD_ID = 'default';

const STATUS_TEXT: Record<ChatStatus, string> = {
  ready: 'Ready.',
  submitted: 'Waiting for the model…',
  streaming: 'Receiving reply…',
  error: 'The last request failed.',
};

const DETAIL_CHARS = 300;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g;

/**
 * Returns the server's `error` field from a JSON error body, redacted and clipped.
 * Returns null for anything else, so raw bodies and stack traces are never shown.
 */
function serverErrorField(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) return null;
  const message = parsed.error;
  if (typeof message !== 'string' || message.trim() === '') return null;
  const clean = message.trim().replace(SECRET_VALUE, '[redacted]');
  return clean.length > DETAIL_CHARS ? `${clean.slice(0, DETAIL_CHARS)}…` : clean;
}

function describeError(error: Error): ErrorView {
  const statusCode = 'statusCode' in error ? error.statusCode : undefined;
  const responseBody = 'responseBody' in error ? error.responseBody : undefined;
  // The transport puts the raw response body on `responseBody`; fall back to the message.
  const raw = typeof responseBody === 'string' && responseBody !== '' ? responseBody : error.message;
  const detail = serverErrorField(raw);

  if (typeof statusCode !== 'number') {
    return { title: 'The chat request failed before a reply arrived.', detail: null };
  }
  if (statusCode === 400) {
    return { title: 'The server rejected this request as malformed (HTTP 400).', detail };
  }
  if (statusCode === 409) {
    return { title: 'The configured provider cannot stream chat (HTTP 409).', detail };
  }
  if (statusCode === 503) {
    return { title: 'Chat is not configured on the server (HTTP 503).', detail };
  }
  return { title: `Chat request failed with HTTP ${statusCode}.`, detail };
}

/** Client-side history cap, kept under the server's `/api/chat` limits (60 messages, 64000 characters). */
export const MAX_HISTORY_MESSAGES = 40;
export const MAX_HISTORY_CHARS = 48000;

function textLength(message: UIMessage): number {
  let total = 0;
  for (const part of message.parts) {
    if (part.type === 'text') total += part.text.length;
  }
  return total;
}

/**
 * Returns the most recent contiguous messages that fit both history limits, dropping the oldest first.
 * Does not modify the input. May return an empty list if the newest message alone exceeds the character cap.
 */
export function trimHistory(messages: UIMessage[]): UIMessage[] {
  const kept: UIMessage[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && kept.length < MAX_HISTORY_MESSAGES; i--) {
    const size = textLength(messages[i]);
    if (chars + size > MAX_HISTORY_CHARS) break;
    chars += size;
    kept.unshift(messages[i]);
  }
  return kept;
}

/**
 * Strips every non-text part (`data-purple-run`, `data-genui`, `step-start`, …)
 * and drops messages left with no text parts. The server forwards whatever it
 * receives to `convertToModelMessages`, which rejects unknown part types — a
 * thread containing a run card would 400 on the next send without this.
 * Applied after `trimHistory`, so the 40 msgs / 48k chars client window stays a
 * strict subset of the server's 60 / 64k.
 */
export function toWireMessages(messages: UIMessage[]): UIMessage[] {
  const wire: UIMessage[] = [];
  for (const message of messages) {
    const parts = message.parts.filter(part => part.type === 'text');
    if (parts.length === 0) continue;
    wire.push(parts.length === message.parts.length ? message : { ...message, parts });
  }
  return wire;
}

/** Joined text of the streaming assistant message (empty unless the last message is an assistant reply). */
function lastAssistantText(messages: UIMessage[]): string {
  const last = messages[messages.length - 1];
  if (last === undefined || last.role !== 'assistant') return '';
  let text = '';
  for (const part of last.parts) {
    if (part.type === 'text') text += part.text;
  }
  return text;
}

function ChatStream({ ref, threadId = DEFAULT_THREAD_ID, onThreadSettled, showNewChat = true, autoFocusComposer = false }: ChatStreamProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const statusId = `${baseId}-status`;

  const logRef = useRef<HTMLOListElement | null>(null);
  const pinnedRef = useRef(true);
  const seenCountRef = useRef(0);
  const messageCountRef = useRef(0);
  const streamTextRef = useRef('');
  const announcedCharsRef = useRef(0);
  const announceTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  const [limitError, setLimitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pinned, setPinned] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [liveChunk, setLiveChunk] = useState('');

  const { messages, sendMessage, setMessages, status, stop, regenerate, error, clearError } = useChat<UIMessage>({
    id: threadId,
    transport,
  });
  const busy = status === 'submitted' || status === 'streaming';
  messageCountRef.current = messages.length;

  /** Shared send path for the imperative handle, the composer, and the AgentPanel palette. */
  const sendText = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (trimmed === '' || busy) return false;
      if (trimmed.length > MAX_MESSAGE_CHARS) {
        setLimitError(
          `Message is ${trimmed.length} characters; the limit is ${MAX_MESSAGE_CHARS}. Shorten it and try again.`,
        );
        return false;
      }
      setLimitError(null);
      clearError();
      void sendMessage({ text: trimmed });
      return true;
    },
    [busy, clearError, sendMessage],
  );

  const focusComposer = useCallback(() => {
    rootRef.current?.querySelector('textarea')?.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      send: sendText,
      loadMessages: next => {
        clearError();
        setMessages(next);
      },
      focusComposer,
    }),
    [sendText, setMessages, clearError, focusComposer],
  );

  useEffect(() => {
    if (autoFocusComposer) focusComposer();
    // Mount-only: switching conversations must not yank focus from the sidebar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settledCallbackRef = useRef(onThreadSettled);
  useEffect(() => {
    settledCallbackRef.current = onThreadSettled;
  });

  /** Persistence seam: report every settled snapshot (finish, error, run-card upsert). */
  useEffect(() => {
    if (settledCallbackRef.current === undefined) return;
    if (status !== 'ready' && status !== 'error') return;
    settledCallbackRef.current(messages, threadId);
  }, [messages, status, threadId]);

  /** Announces a short line through the polite status region (copy outcomes, cancel results). */
  const announce = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(null);
    }, NOTICE_TIMEOUT_MS);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  /** Regenerate the last assistant reply; also the Retry action in the error view. */
  const regenerateLast = useCallback(() => {
    clearError();
    void regenerate();
  }, [clearError, regenerate]);

  /** Two-step Cancel on the run card: optimistic cancel + POST /api/mission/stop { runId }. */
  const cancelRun = useCallback(
    (runId: string) => {
      setMessages(prev => cancelPurpleRunInMessages(prev, runId, Date.now()));
      void (async () => {
        try {
          const response = await fetch('/api/mission/stop', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ runId }),
          });
          if (!response.ok) {
            announce(`Cancellation request for run ${runId} returned HTTP ${response.status}.`);
          }
        } catch {
          announce(`Cancellation request for run ${runId} failed.`);
        }
      })();
    },
    [announce, setMessages],
  );

  /** Inline run progress (§5): upsert data-purple-run parts from the shared SSE bus. */
  useEffect(
    () =>
      subscribePurpleRuns(event => {
        setMessages(prev => upsertPurpleRun(prev, event, Date.now()));
      }),
    [setMessages],
  );

  /** Recomputes pinned state from the scroller's actual position. */
  const evaluatePin = useCallback(() => {
    const el = logRef.current;
    if (el === null) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nextPinned = distance <= PIN_DISTANCE_PX;
    if (nextPinned) {
      seenCountRef.current = messageCountRef.current;
      setNewCount(0);
    } else {
      setNewCount(Math.max(0, messageCountRef.current - seenCountRef.current));
    }
    pinnedRef.current = nextPinned;
    setPinned(prev => (prev === nextPinned ? prev : nextPinned));
  }, []);

  const hasMessages = messages.length > 0;
  useEffect(() => {
    const el = logRef.current;
    if (el === null) return undefined;
    el.addEventListener('scroll', evaluatePin, { passive: true });
    // scrollend settles momentum/keyboard scrolls at their final position where supported.
    el.addEventListener('scrollend', evaluatePin);
    return () => {
      el.removeEventListener('scroll', evaluatePin);
      el.removeEventListener('scrollend', evaluatePin);
    };
  }, [evaluatePin, hasMessages]);

  /**
   * Anchored scrolling (§4.3): pinned → stick to the bottom inside a rAF;
   * unpinned → never fight the reader, just count what they haven't seen.
   */
  useEffect(() => {
    if (logRef.current === null) return undefined;
    if (pinnedRef.current) {
      seenCountRef.current = messages.length;
      setNewCount(0);
      const frame = requestAnimationFrame(() => {
        const el = logRef.current;
        if (el !== null && pinnedRef.current) el.scrollTop = el.scrollHeight;
      });
      return () => cancelAnimationFrame(frame);
    }
    setNewCount(Math.max(0, messages.length - seenCountRef.current));
    return undefined;
  }, [messages]);

  const jumpToLatest = useCallback(() => {
    const el = logRef.current;
    if (el === null) return;
    pinnedRef.current = true;
    seenCountRef.current = messageCountRef.current;
    setNewCount(0);
    setPinned(true);
    el.scrollTop = el.scrollHeight;
    el.focus({ preventScroll: true });
  }, []);

  /**
   * Chunked aria-live for streaming (§7): while streaming, announce at most one
   * ~200-char tail of newly arrived text per 500ms — never per token. Status
   * transitions ride the polite status region above.
   */
  useEffect(() => {
    if (status !== 'streaming') {
      if (announceTimerRef.current !== null) {
        window.clearTimeout(announceTimerRef.current);
        announceTimerRef.current = null;
      }
      announcedCharsRef.current = 0;
      setLiveChunk('');
      return;
    }
    const text = lastAssistantText(messages);
    if (text.length < announcedCharsRef.current) announcedCharsRef.current = 0;
    streamTextRef.current = text;
    if (text.length <= announcedCharsRef.current) return;
    if (announceTimerRef.current !== null) return;
    announceTimerRef.current = window.setTimeout(() => {
      announceTimerRef.current = null;
      const current = streamTextRef.current;
      if (current.length <= announcedCharsRef.current) return;
      let chunk = current.slice(announcedCharsRef.current);
      if (chunk.length > LIVE_CHUNK_CHARS) chunk = `…${chunk.slice(-LIVE_CHUNK_CHARS)}`;
      announcedCharsRef.current = current.length;
      setLiveChunk(`${chunk} …streaming`);
    }, LIVE_CHUNK_INTERVAL_MS);
  }, [messages, status]);

  const errorView = error ? describeError(error) : null;

  return (
    <AnnounceContext.Provider value={announce}>
      <section className="chat-stream" aria-labelledby={titleId} ref={rootRef}>
        <div className="chat-stream-header">
          <h3 id={titleId} className="chat-stream-title">
            Model chat
          </h3>
          <div id={statusId} role="status" aria-live="polite" className="chat-stream-status">
            {notice === null ? STATUS_TEXT[status] : `${STATUS_TEXT[status]} ${notice}`}
          </div>
          {busy && (
            <button type="button" className="chat-stream-stop" onClick={() => void stop()}>
              Stop
            </button>
          )}
          {showNewChat !== false && (
            <button
              type="button"
              className="chat-stream-new"
              onClick={() => {
                clearError();
                setMessages([]);
              }}
              disabled={busy}
            >
              New chat
            </button>
          )}
        </div>

        {limitError && (
          <p className="chat-stream-error" role="alert">
            <strong>{limitError}</strong>
          </p>
        )}
        {errorView && (
          <p className="chat-stream-error" role="alert">
            <strong>{errorView.title}</strong>
            {errorView.detail && <span className="chat-stream-error-detail"> {errorView.detail}</span>}{' '}
            <button type="button" className="chat-stream-retry" onClick={regenerateLast}>
              Retry
            </button>
          </p>
        )}

        {messages.length === 0 ? (
          <p className="chat-stream-empty">
            No messages yet. Type text without a leading / to ask the configured default model. No hat routing yet.
          </p>
        ) : (
          <div className="chat-log-wrap">
            <ol
              ref={logRef}
              className="chat-stream-log"
              role="log"
              aria-label="Model chat messages"
              tabIndex={0}
            >
              {messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  showRegenerate={
                    !busy &&
                    index === messages.length - 1 &&
                    message.role === 'assistant' &&
                    message.parts.some(part => part.type === 'text' && part.text !== '')
                  }
                  onRegenerate={regenerateLast}
                  onCancelRun={cancelRun}
                />
              ))}
            </ol>
            {!pinned && (
              <button
                type="button"
                className="chat-jump"
                onClick={jumpToLatest}
                aria-label={newCount > 0 ? `Jump to latest, ${newCount} new messages` : 'Jump to latest'}
              >
                ↓ Latest{newCount > 0 ? ` · ${newCount} new` : ''}
              </button>
            )}
          </div>
        )}

        <Composer threadId={threadId} busy={busy} describedById={statusId} onSend={sendText} onStop={() => void stop()} />

        <div className="chat-vh" role="status" aria-live="polite">
          {liveChunk}
        </div>
      </section>
    </AnnounceContext.Provider>
  );
}

export default ChatStream;
