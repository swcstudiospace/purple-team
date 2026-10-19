import { useId, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useDraft } from './drafts';
import { useSelectedRepo } from '../../stores/github';

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
 * A pasted GitHub repository URL (repo page or deeper /tree/… path). Anything
 * else — prose, snippets, other hosts — falls through as a normal paste.
 */
export const GITHUB_REPO_URL_PASTE = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/;

/**
 * Paste wiring for the repo entry screen: when the pasted text is a GitHub
 * repo URL and no repository is attached to THIS conversation, the paste is
 * captured (never lands in the draft) and parked in the useSelectedRepo paste
 * slice; the Agent Panel opens the repo entry screen prefilled with it. A
 * target attached to a different conversation does not count — it must not
 * suppress the capture here. With a repo attached to this thread, or for any
 * other text, pastes behave exactly as before.
 */
export function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>, threadId: string): void {
  const text = event.clipboardData.getData('text').trim();
  if (text === '' || !GITHUB_REPO_URL_PASTE.test(text)) return;
  if (useSelectedRepo.getState().isAttachedTo(threadId)) return;
  event.preventDefault();
  useSelectedRepo.getState().setPastePrefill(text);
}

/**
 * Multiline composer: Enter sends, Shift+Enter adds a line, IME composition is
 * respected. The draft is per-thread and survives unmounts, so switching
 * conversations restores it instantly. While a reply is in flight the Send
 * button is disabled and Stop takes its place in the bar (§4.2). When a repo
 * target is attached to THIS conversation (useSelectedRepo), a compact chip
 * inside the pill shows owner/repo@ref with a detach control.
 */
export function Composer({ threadId, busy, describedById, onSend, onStop }: ComposerProps) {
  const inputId = useId();
  const [draft, setDraft] = useDraft(threadId);
  const repo = useSelectedRepo(state => state.selected);
  const resolution = useSelectedRepo(state => state.resolution);
  const repoThreadId = useSelectedRepo(state => state.threadId);
  const clearRepo = useSelectedRepo(state => state.clear);

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

  const attached = repo !== null && repoThreadId === threadId;
  const chipRef = attached && repo.ref !== '' && repo.ref !== 'HEAD'
    ? repo.ref
    : resolution?.defaultBranch ?? 'default';

  return (
    <div className="chat-composer">
      <label htmlFor={inputId} className="chat-composer-label">
        Message the model
      </label>
      {attached && repo !== null && (
        <div className="chat-composer-repo">
          <span className="chat-composer-repo-name" title={repo.fullName}>
            {repo.fullName}@{chipRef}
          </span>
          {repo.visibility === 'private' && <span className="chat-composer-repo-badge">Private</span>}
          <button
            type="button"
            className="chat-composer-repo-detach"
            aria-label={`Detach repository ${repo.fullName}`}
            onClick={clearRepo}
          >
            ×
          </button>
        </div>
      )}
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
        onPaste={event => handleComposerPaste(event, threadId)}
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
