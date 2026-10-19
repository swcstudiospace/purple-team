import { useId, type KeyboardEvent } from 'react';
import { useDraft } from './drafts';

interface ComposerProps {
  /** Thread identity — binds the per-thread draft store to this composer. */
  threadId: string;
  busy: boolean;
  /** id of the polite status region that describes this input. */
  describedById: string;
  onSend(text: string): boolean;
  onStop(): void;
}

/**
 * Multiline composer: Enter sends, Shift+Enter adds a line, IME composition is
 * respected. The draft is per-thread and survives unmounts, so switching
 * conversations restores it instantly. While a reply is in flight the Send
 * button is disabled and Stop takes its place in the bar (§4.2).
 */
export function Composer({ threadId, busy, describedById, onSend, onStop }: ComposerProps) {
  const inputId = useId();
  const [draft, setDraft] = useDraft(threadId);

  function submit(): void {
    const trimmed = draft.trim();
    if (trimmed === '' || busy) return;
    if (onSend(trimmed)) setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-composer">
      <label htmlFor={inputId} className="chat-composer-label">
        Message the model
      </label>
      <textarea
        id={inputId}
        className="chat-composer-textarea"
        rows={3}
        value={draft}
        spellCheck={false}
        autoComplete="off"
        placeholder="Message the model. Enter sends; Shift+Enter adds a line."
        aria-describedby={describedById}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="chat-composer-actions">
        {busy && (
          <button type="button" className="chat-composer-stop" onClick={onStop}>
            Stop
          </button>
        )}
        <button type="button" className="chat-composer-send" onClick={submit} disabled={busy || draft.trim() === ''}>
          Send
        </button>
      </div>
    </div>
  );
}
