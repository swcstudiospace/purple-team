/**
 * Slash-command palette over the embedded ChatStream composer (phase 36 §8:
 * the rebuilt AgentPanel keeps the palette but drops its own textarea).
 *
 * The palette owns no textarea: it shares the per-thread draft store
 * (chat/drafts.ts) with ChatStream's embedded composer and intercepts the
 * keys it needs in the CAPTURE phase on its wrapper — before the composer's
 * own handlers run. Plain text always falls through untouched, so sending,
 * Shift+Enter, and IME composition keep their composer semantics verbatim
 * (§4.4). Combobox ARIA is augmented onto the composer textarea from here.
 *
 * Escape precedence (§2.2) is strict: palette dismissal, then command
 * confirm-cancel, then focus-mode exit — the first two consume the event here
 * and keep escapeGuard in sync for the shell's window-level handler.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { filterCommands, parseComposerInput } from '../../../../src/ui-commands/parser';
import { COMMANDS, type ArgSpec, type CommandSpec } from '../../../../src/ui-commands/registry';
import { useDraft } from '../chat/drafts';
import { AGENT_LABEL } from './agent-labels';
import { escapeGuard } from './focus';

function replaceCommandName(text: string, name: string): string {
  const match = /^(\s*)\/\S*/.exec(text);
  if (!match) return text;
  const rest = text.slice(match[0].length);
  return `${match[1]}/${name}${rest === '' ? ' ' : rest}`;
}

interface SlashPaletteProps {
  /** Same thread id the embedded ChatStream uses — drafts and palette share it. */
  threadId: string;
  /** Executes a confirmed command (fetch + timeline entry stay in AgentPanel). */
  onRunCommand: (spec: CommandSpec, args: Record<string, string>) => void;
  children: ReactNode;
}

export function SlashPalette({ threadId, onRunCommand, children }: SlashPaletteProps) {
  const baseId = useId();
  const listboxId = `apx-listbox-${baseId}`;
  const hintId = `apx-hint-${baseId}`;
  const statusId = `apx-status-${baseId}`;

  const [draft, setDraft] = useDraft(threadId);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [popoverBottom, setPopoverBottom] = useState<number | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  const parsed = parseComposerInput(draft, COMMANDS);
  const open = parsed.kind === 'palette' && !dismissed;
  const options = parsed.kind === 'palette' ? filterCommands(parsed.query, COMMANDS) : [];
  const activeIndex = open && options.length > 0 ? Math.min(highlight, options.length - 1) : -1;
  const activeSpec = activeIndex >= 0 ? options[activeIndex] : undefined;
  const hintSpec: CommandSpec | null = parsed.kind === 'command' ? parsed.spec : (activeSpec ?? null);
  const argValues: Record<string, string> = parsed.kind === 'command' ? parsed.args : {};
  const activeOptionId = activeSpec !== undefined ? `${listboxId}-opt-${activeSpec.name}` : null;

  // Draft edits reset the transient palette state (the old updateDraft behavior).
  useEffect(() => {
    setDismissed(false);
    setPendingConfirm(false);
    setNote(null);
    setHighlight(0);
  }, [draft, threadId]);

  useEffect(() => {
    escapeGuard.paletteOpen = open;
    escapeGuard.confirmPending = pendingConfirm;
    return () => {
      escapeGuard.paletteOpen = false;
      escapeGuard.confirmPending = false;
    };
  }, [open, pendingConfirm]);

  // Anchor the popover just above the embedded composer's textarea.
  useLayoutEffect(() => {
    if (!open) {
      setPopoverBottom(null);
      return;
    }
    const wrap = wrapRef.current;
    const textarea = wrap?.querySelector('textarea');
    if (!wrap || !textarea) return;
    const wrapRect = wrap.getBoundingClientRect();
    const textRect = textarea.getBoundingClientRect();
    setPopoverBottom(wrapRect.bottom - textRect.top + 8);
  }, [open, threadId]);

  // Combobox semantics on the composer textarea (role/aria live outside its file).
  useEffect(() => {
    const textareaEl = wrapRef.current?.querySelector('textarea');
    if (!textareaEl) return undefined;
    const element = textareaEl as HTMLTextAreaElement;
    element.setAttribute('role', 'combobox');
    element.setAttribute('aria-autocomplete', 'list');
    element.setAttribute('aria-controls', listboxId);
    element.setAttribute('aria-expanded', String(open));
    if (activeOptionId !== null) element.setAttribute('aria-activedescendant', activeOptionId);
    else element.removeAttribute('aria-activedescendant');
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy === null || describedBy === '') element.setAttribute('aria-describedby', `${hintId} ${statusId}`);
    else if (!describedBy.includes(statusId)) element.setAttribute('aria-describedby', `${describedBy} ${statusId}`);
    return () => {
      element.removeAttribute('role');
      element.removeAttribute('aria-autocomplete');
      element.removeAttribute('aria-controls');
      element.removeAttribute('aria-expanded');
      element.removeAttribute('aria-activedescendant');
    };
  }, [open, activeOptionId, listboxId, hintId, statusId, threadId]);

  function completeCommand(spec: CommandSpec): void {
    setDraft(`/${spec.name} `);
    wrapRef.current?.querySelector('textarea')?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.nativeEvent.isComposing) return;
    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (open && options.length > 0) {
      if (event.key === 'ArrowDown') {
        consume();
        setHighlight((activeIndex + 1) % options.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        consume();
        setHighlight((activeIndex - 1 + options.length) % options.length);
        return;
      }
      if (event.key === 'Tab' && !event.shiftKey && activeSpec !== undefined) {
        consume();
        completeCommand(activeSpec);
        return;
      }
    }
    if (event.key === 'Escape') {
      if (open) {
        consume();
        setDismissed(true);
      } else if (pendingConfirm) {
        consume();
        setPendingConfirm(false);
      }
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;

    if (parsed.kind === 'palette') {
      if (activeSpec !== undefined) {
        consume();
        completeCommand(activeSpec);
      }
      return; // No matching command: let the composer send the raw text.
    }
    if (parsed.kind === 'unknown') {
      consume();
      setNote(`Unknown command "/${parsed.name}". Type / to browse commands.`);
      return;
    }
    if (parsed.kind === 'text') return; // The embedded composer owns the send.

    consume(); // Confirmed command execution never reaches the composer.
    const { spec, args, missing } = parsed;
    if (missing.length > 0) {
      setDraft(replaceCommandName(draft, spec.name));
      return;
    }
    if (spec.confirm && !pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    setDraft('');
    setHighlight(0);
    setDismissed(false);
    setPendingConfirm(false);
    setNote(null);
    onRunCommand(spec, args);
  }

  // Capture-phase dispatch through a ref so the listener attaches once and
  // always runs the latest handler state (keys arrive between renders).
  const handlerRef = useRef(handleKeyDown);
  useEffect(() => {
    handlerRef.current = handleKeyDown;
  });
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null) return undefined;
    const listener = (event: globalThis.KeyboardEvent) => {
      const reactEvent = event as unknown as React.KeyboardEvent;
      handlerRef.current(reactEvent);
    };
    wrap.addEventListener('keydown', listener, true);
    return () => wrap.removeEventListener('keydown', listener, true);
  }, []);

  let statusMessage: string | null = null;
  if (note !== null) {
    statusMessage = note;
  } else if (parsed.kind === 'command' && parsed.spec.confirm && pendingConfirm) {
    statusMessage = `Press Enter again to run /${parsed.spec.name}.`;
  } else if (parsed.kind === 'command' && parsed.missing.length > 0) {
    statusMessage = `Missing required arguments: ${parsed.missing.join(', ')}. Add them as key=value, then press Enter.`;
  } else if (parsed.kind === 'unknown') {
    statusMessage = `Unknown command "/${parsed.name}". Type / to browse commands.`;
  } else if (draft.trim() === '') {
    statusMessage = 'Type / to browse commands. Enter runs a command or sends a message.';
  }

  return (
    <div className="apx-chat-wrap" ref={wrapRef}>
      {children}
      <div
        className="apx-palette-popover"
        hidden={!open}
        style={popoverBottom === null ? undefined : { bottom: popoverBottom }}
      >
        <ul id={listboxId} role="listbox" aria-label="Slash commands" className="apx-palette-listbox">
          {options.map((spec, index) => (
            <li
              key={spec.name}
              id={`${listboxId}-opt-${spec.name}`}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'apx-palette-option apx-palette-option--active' : 'apx-palette-option'}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => completeCommand(spec)}
            >
              <span className="apx-palette-option-name">/{spec.name}</span>
              <span className="apx-palette-option-agent">{AGENT_LABEL[spec.agent]}</span>
              <span className="apx-palette-option-summary">{spec.summary}</span>
            </li>
          ))}
        </ul>
        {options.length === 0 && (
          <p className="apx-palette-empty">No command matches &ldquo;{parsed.kind === 'palette' ? parsed.query : ''}&rdquo;.</p>
        )}
      </div>

      <div id={statusId} role="status" aria-live="polite" className="apx-palette-status">
        {statusMessage}
      </div>

      <div id={hintId} className="apx-palette-hints">
        {hintSpec !== null ? (
          <>
            <p className="apx-palette-hints-title">
              <code>/{hintSpec.name}</code> {hintSpec.summary}
            </p>
            {hintSpec.args.length === 0 ? (
              <p className="apx-palette-hints-none">No arguments.</p>
            ) : (
              <ul className="apx-palette-hints-list">
                {hintSpec.args.map((arg: ArgSpec) => {
                  const value = argValues[arg.name];
                  let fill = '';
                  if (parsed.kind === 'command') {
                    if (value !== undefined && value.trim() !== '') fill = ' · set';
                    else if (arg.required) fill = ' · missing';
                  }
                  return (
                    <li key={arg.name}>
                      <code>{arg.name}</code>{' '}
                      <span className="apx-palette-hint-req">{arg.required ? 'required' : 'optional'}</span>
                      {' — '}
                      <span>{arg.hint}</span>
                      {fill !== '' && <span className="apx-palette-hint-fill">{fill}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p className="apx-palette-hints-none">Pick a command to see its arguments.</p>
        )}
      </div>
    </div>
  );
}
