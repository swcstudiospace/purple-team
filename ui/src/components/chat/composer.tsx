import { useEffect, useId, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useDraft } from './drafts';
import { suggestGhost, type GhostSuggestion } from './ghost';
import { useSelectedRepo } from '../../stores/github';
import { COMMANDS } from '../../../../src/ui-commands/registry';

/** Provider/model the picker persists. Omitted fields are not sent. */
export interface ChatModelChoice {
  provider: string;
  model: string;
}

export const CHAT_MODEL_STORAGE_KEY = 't3mp3st_chat_model';

let chatModelChoice: ChatModelChoice | null = readStoredChatModel();

function readStoredChatModel(): ChatModelChoice | null {
  try {
    const raw = localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
    if (raw === null || raw === '') return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const provider = 'provider' in parsed ? parsed.provider : undefined;
    const model = 'model' in parsed ? parsed.model : undefined;
    if (typeof provider !== 'string' || provider === '' || typeof model !== 'string' || model === '') return null;
    return { provider, model };
  } catch {
    return null;
  }
}

/** Module-level choice the chat transport reads at send time. Also writes `t3mp3st_chat_model`. */
export function setChatModelChoice(next: ChatModelChoice | null): void {
  chatModelChoice = next;
  try {
    if (next === null) localStorage.removeItem(CHAT_MODEL_STORAGE_KEY);
    else localStorage.setItem(CHAT_MODEL_STORAGE_KEY, JSON.stringify({ provider: next.provider, model: next.model }));
  } catch {
    // Storage can throw in private mode; the in-memory choice still reaches the transport.
  }
}

export function getChatModelChoice(): ChatModelChoice | null {
  return chatModelChoice ?? readStoredChatModel();
}

interface ComposerProps {
  /** Thread identity — binds the per-thread draft store to this composer. */
  threadId: string;
  busy: boolean;
  /** id of the polite status region that describes this input. */
  describedById: string;
  onSend(text: string): boolean;
  onStop(): void;
  /** Reopens the repository picker without clearing the current target. */
  onChangeRepo?: () => void;
}

interface LlmProviderOption {
  id: string;
  label: string;
  streamable: boolean;
  connected: boolean;
  models: string[];
}

interface LlmOptionsResponse {
  active: { provider: string; model: string };
  providers: LlmProviderOption[];
}

function selectableProviders(options: LlmOptionsResponse): LlmProviderOption[] {
  return options.providers.filter(
    provider => provider.connected || provider.models.length > 0 || provider.id === options.active.provider,
  );
}

/**
 * Provider + model picker. Writes `t3mp3st_chat_model` through setChatModelChoice
 * so POST /api/chat includes the pair. A failed options fetch shows the server
 * default as disabled text and does not throw.
 */
function ModelPicker() {
  const providerId = useId();
  const modelId = useId();
  const [options, setOptions] = useState<LlmOptionsResponse | null>(null);
  const [failedDefault, setFailedDefault] = useState<string | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/llm/options', { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('options');
        const data = (await response.json()) as LlmOptionsResponse;
        if (cancelled) return;
        if (!data || !Array.isArray(data.providers) || data.active == null) throw new Error('shape');
        const list = selectableProviders(data);
        setOptions({ ...data, providers: list });
        const storedRaw = localStorage.getItem('t3mp3st_chat_model');
        let stored: ChatModelChoice | null = null;
        if (storedRaw) {
          try {
            const parsed = JSON.parse(storedRaw) as ChatModelChoice;
            if (typeof parsed.provider === 'string' && typeof parsed.model === 'string') stored = parsed;
          } catch {
            stored = null;
          }
        }
        const picked =
          list.find(item => item.id === stored?.provider) ??
          list.find(item => item.id === data.active.provider) ??
          list[0];
        if (picked === undefined) {
          setFailedDefault(`${data.active.provider} / ${data.active.model}`);
          return;
        }
        const nextModel =
          stored && picked.id === stored.provider && picked.models.includes(stored.model)
            ? stored.model
            : picked.models.includes(data.active.model)
              ? data.active.model
              : (picked.models[0] ?? data.active.model);
        setProvider(picked.id);
        setModel(nextModel);
        setChatModelChoice({ provider: picked.id, model: nextModel });
      } catch {
        try {
          const response = await fetch('/api/llm/status', { headers: { Accept: 'application/json' } });
          const data = (await response.json()) as { provider?: string; model?: string };
          if (!cancelled) {
            const label = `${data.provider ?? 'server default'} / ${data.model ?? 'configured model'}`;
            setFailedDefault(label);
          }
        } catch {
          if (!cancelled) setFailedDefault('server default unavailable');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failedDefault !== null && options === null) {
    return (
      <p className="chat-composer-label">
        <label htmlFor={providerId}>Provider and model</label>
        <input id={providerId} className="apx-dialog-input" value={failedDefault} disabled />
      </p>
    );
  }

  const current = options?.providers.find(item => item.id === provider);
  const models = current?.models ?? [];

  function choose(nextProvider: string, nextModel: string): void {
    setProvider(nextProvider);
    setModel(nextModel);
    if (nextProvider !== '' && nextModel !== '') setChatModelChoice({ provider: nextProvider, model: nextModel });
  }

  return (
    <div className="chat-composer-actions">
      <label className="chat-composer-label" htmlFor={providerId}>
        Provider
      </label>
      <select
        id={providerId}
        className="apx-dialog-input"
        value={provider}
        disabled={options === null}
        onChange={event => {
          const next = options?.providers.find(item => item.id === event.target.value);
          const nextModel = next?.models.includes(model) ? model : (next?.models[0] ?? '');
          choose(event.target.value, nextModel);
        }}
      >
        {options === null && <option value="">Loading providers…</option>}
        {options?.providers.map(item => (
          <option key={item.id} value={item.id}>
            {item.label}
            {item.streamable ? '' : ' (not streamable)'}
          </option>
        ))}
      </select>
      <label className="chat-composer-label" htmlFor={modelId}>
        Model
      </label>
      <select
        id={modelId}
        className="apx-dialog-input"
        value={model}
        disabled={options === null || models.length === 0}
        onChange={event => choose(provider, event.target.value)}
      >
        {models.length === 0 && <option value={model}>{model || 'No models listed'}</option>}
        {models.map(item => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
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
 * slice; the Chat Panel opens the repo entry screen prefilled with it. A
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
export function Composer({ threadId, busy, describedById, onSend, onStop, onChangeRepo }: ComposerProps) {
  const inputId = useId();
  const [draft, setDraft] = useDraft(threadId);
  const repo = useSelectedRepo(state => state.selected);
  const resolution = useSelectedRepo(state => state.resolution);
  const repoThreadId = useSelectedRepo(state => state.threadId);
  const clearRepo = useSelectedRepo(state => state.clear);
  // Ghost text only makes sense with the caret at the end of the draft.
  const [caretAtEnd, setCaretAtEnd] = useState(true);
  // Escape stands the ghost down until the next draft edit.
  const [ghostDismissed, setGhostDismissed] = useState(false);
  // Once the textarea scrolls, the unscrolled ghost mirror would sit outside the visible field: hide it.
  const [fieldScrolled, setFieldScrolled] = useState(false);

  // `/name` with no whitespace yet is palette territory: the palette popover
  // completes command names there (Tab on the highlighted option), so the
  // ghost stands down for it. Every `enum`/`example` ghost draft carries a
  // space after the command name, so suppressing whitespace-free slash drafts
  // is exactly palette suppression — and 'command' ghosts never double up.
  const ghost = useMemo(
    () => (/^\/\S*$/.test(draft) ? null : suggestGhost(draft, COMMANDS)),
    [draft],
  );
  const showGhost = ghost !== null && !ghostDismissed && caretAtEnd && !fieldScrolled;

  function trackCaret(event: { currentTarget: HTMLTextAreaElement }): void {
    const element = event.currentTarget;
    setCaretAtEnd(element.selectionStart === element.selectionEnd && element.selectionEnd === element.value.length);
  }

  function acceptGhost(suggestion: GhostSuggestion): void {
    // 'example' ghosts end with a trailing space so the next argument starts clean.
    setDraft(draft + suggestion.ghost + (suggestion.kind === 'example' ? ' ' : ''));
    setGhostDismissed(false);
    setCaretAtEnd(true);
  }

  function submit(): void {
    const trimmed = draft.trim();
    if (trimmed === '' || busy) return;
    if (onSend(trimmed)) setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.nativeEvent.isComposing) {
      // IME composition owns Tab, Escape, and the arrows until it settles.
      return;
    }
    const ghostNow = ghost;
    if (ghostNow !== null && showGhost && event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      acceptGhost(ghostNow);
      return;
    }
    if (ghostNow !== null && showGhost && event.key === 'ArrowRight') {
      const element = event.currentTarget;
      if (element.selectionStart === element.selectionEnd && element.selectionEnd === element.value.length) {
        event.preventDefault();
        acceptGhost(ghostNow);
        return;
      }
    }
    if (event.key === 'Escape' && showGhost) {
      setGhostDismissed(true);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handleDraftChange(event: { currentTarget: HTMLTextAreaElement }): void {
    const element = event.currentTarget;
    setGhostDismissed(false);
    setCaretAtEnd(element.selectionStart === element.selectionEnd && element.selectionEnd === element.value.length);
    setFieldScrolled(element.scrollTop > 0);
    setDraft(element.value);
  }

  const attached = repo !== null && (repoThreadId === threadId || repoThreadId === null);
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
          {onChangeRepo && (
            <button type="button" className="chat-composer-repo-detach" onClick={onChangeRepo}>
              Change repository
            </button>
          )}
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
      <ModelPicker />
      <div className="chat-composer-field">
        {showGhost && ghost !== null && (
          <div className="chat-composer-ghost" aria-hidden="true">
            <span className="chat-composer-ghost-base">{draft}</span>
            <span className="chat-composer-ghost-hint">{ghost.ghost}</span>
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
          onChange={handleDraftChange}
          onSelect={trackCaret}
          onScroll={event => setFieldScrolled(event.currentTarget.scrollTop > 0)}
          onKeyDown={handleKeyDown}
          onPaste={event => handleComposerPaste(event, threadId)}
        />
      </div>
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
