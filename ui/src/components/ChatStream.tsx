import { useChat } from '@ai-sdk/react';
import { useEffect, useId, useImperativeHandle, useRef, type Ref } from 'react';
import { DefaultChatTransport, type ChatStatus, type UIMessage } from 'ai';
import './chat-stream.css';

/** Imperative handle the composer uses to hand free text to the chat. */
export interface ChatStreamHandle {
  /** Sends free text. Returns false, and sends nothing, while a reply is in flight. */
  send(text: string): boolean;
}

interface ChatStreamProps {
  ref?: Ref<ChatStreamHandle>;
}

interface ErrorView {
  title: string;
  detail: string | null;
}

const transport = new DefaultChatTransport<UIMessage>({
  api: '/api/chat',
  // Send only the message list, matching the server contract `{ messages: UIMessage[] }`.
  prepareSendMessagesRequest: ({ messages }) => ({ body: { messages } }),
});

const STATUS_TEXT: Record<ChatStatus, string> = {
  ready: 'Ready.',
  submitted: 'Waiting for the model…',
  streaming: 'Receiving reply…',
  error: 'The last request failed.',
};

const ROLE_LABEL: Record<string, string> = {
  user: 'You',
  assistant: 'Model',
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

function ChatStream({ ref }: ChatStreamProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const logRef = useRef<HTMLOListElement | null>(null);

  const { messages, sendMessage, status, stop, error, clearError } = useChat<UIMessage>({ transport });
  const busy = status === 'submitted' || status === 'streaming';

  useImperativeHandle(ref, () => ({
    send(text: string): boolean {
      const trimmed = text.trim();
      if (trimmed === '' || busy) return false;
      clearError();
      void sendMessage({ text: trimmed });
      return true;
    },
  }), [busy, clearError, sendMessage]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const errorView = error ? describeError(error) : null;

  return (
    <section className="chat-stream" aria-labelledby={titleId}>
      <div className="chat-stream-header">
        <h3 id={titleId} className="chat-stream-title">Model chat</h3>
        <div role="status" aria-live="polite" className="chat-stream-status">
          {STATUS_TEXT[status]}
        </div>
        {busy && (
          <button type="button" className="chat-stream-stop" onClick={() => stop()}>
            Stop
          </button>
        )}
      </div>

      {errorView && (
        <p className="chat-stream-error" role="alert">
          <strong>{errorView.title}</strong>
          {errorView.detail && <span className="chat-stream-error-detail"> {errorView.detail}</span>}
        </p>
      )}

      {messages.length === 0 ? (
        <p className="chat-stream-empty">
          No messages yet. Type text without a leading / to ask the configured default model. No hat routing yet.
        </p>
      ) : (
        <ol ref={logRef} className="chat-stream-log" aria-label="Model chat messages">
          {messages.map(message => (
            <li key={message.id} className={`chat-stream-msg chat-stream-msg--${message.role}`}>
              <span className="chat-stream-role">{ROLE_LABEL[message.role] ?? message.role}</span>
              <div className="chat-stream-text">
                {message.parts.map((part, index) =>
                  part.type === 'text' ? <p key={index}>{part.text}</p> : null,
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default ChatStream;
