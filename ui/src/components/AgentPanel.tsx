import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterCommands, parseComposerInput } from '../../../src/ui-commands/parser';
import { COMMANDS, type AgentId, type ArgSpec, type CommandSpec } from '../../../src/ui-commands/registry';
import './agent-panel.css';

type TabId = 'red' | 'blue' | 'white' | 'black' | 'unified';
type EntryStatus = 'running' | 'ok' | 'error' | 'aborted' | 'help';

interface Tab {
  id: TabId;
  label: string;
  /** null = every executed command (the Unified Purple Stream). */
  agent: AgentId | null;
}

interface TimelineEntry {
  id: number;
  agent: AgentId;
  echo: string;
  status: EntryStatus;
  elapsedMs: number | null;
  httpStatus: number | null;
  error: string | null;
  resultText: string | null;
}

type Coerced = { ok: true; value: unknown } | { ok: false; error: string };
type BuiltRequest =
  | { ok: true; method: 'GET' | 'POST'; url: string; body: string | undefined }
  | { ok: false; error: string };
type ParsedBody = { ok: true; value: unknown } | { ok: false };

const TABS: readonly Tab[] = [
  { id: 'red', label: 'Red', agent: 'red' },
  { id: 'blue', label: 'Blue', agent: 'blue' },
  { id: 'white', label: 'White', agent: 'white' },
  { id: 'black', label: 'Black', agent: 'black' },
  { id: 'unified', label: 'Unified Purple Stream', agent: null },
];

const AGENT_LABEL: Record<AgentId, string> = {
  red: 'Red',
  blue: 'Blue',
  white: 'White',
  black: 'Black',
  purple: 'Purple',
  system: 'System',
};

const STATUS_LABEL: Record<EntryStatus, string> = {
  running: 'Running',
  ok: 'Done',
  error: 'Error',
  aborted: 'Stopped',
  help: 'Help',
};

const TEXT_NOTE = 'Free-text dispatch is not wired yet; use a slash command.';
const PREVIEW_CHARS = 480;
const ECHO_VALUE_CHARS = 60;

// Arguments the server expects as JSON arrays or objects, and comma-separated lists.
const JSON_ARRAY_FIELDS: Readonly<Record<string, true>> = {
  artifactIds: true,
  findings: true,
  telemetry: true,
  actions: true,
  paths: true,
  egress: true,
  routeEvidence: true,
  detections: true,
  verdicts: true,
};
const JSON_OBJECT_FIELDS: Readonly<Record<string, true>> = {
  observedByFinding: true,
  meta: true,
  verdictsByFinding: true,
};
const LIST_FIELDS: Readonly<Record<string, true>> = { operators: true, targets: true };

const SECRET_KEY = /api[-_]?key|secret|passw|authorization|bearer|private[-_]?key|token$/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g;

function redactString(text: string): string {
  return text.replace(SECRET_VALUE, '[redacted]');
}

function redactForDisplay(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactString(value);
  if (depth > 32) return '[depth limit]';
  if (Array.isArray(value)) return value.map(item => redactForDisplay(item, depth + 1));
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : redactForDisplay(item, depth + 1);
    }
    return out;
  }
  return value;
}

function echoFor(spec: CommandSpec, args: Record<string, string>): string {
  const parts = [`/${spec.name}`];
  for (const arg of spec.args) {
    const value = args[arg.name];
    if (value !== undefined && value.trim() !== '') {
      const shown = redactString(value.trim());
      const clipped = shown.length > ECHO_VALUE_CHARS ? `${shown.slice(0, ECHO_VALUE_CHARS)}…` : shown;
      parts.push(`${arg.name}=${clipped}`);
    }
  }
  return parts.join(' ');
}

function coerceArg(name: string, raw: string): Coerced {
  const trimmed = raw.trim();
  if (JSON_ARRAY_FIELDS[name] === true || JSON_OBJECT_FIELDS[name] === true) {
    const wantArray = JSON_ARRAY_FIELDS[name] === true;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: `${name} must be valid JSON.` };
    }
    const valid = wantArray
      ? Array.isArray(value)
      : typeof value === 'object' && value !== null && !Array.isArray(value);
    if (!valid) {
      return { ok: false, error: `${name} must be a JSON ${wantArray ? 'array' : 'object'}.` };
    }
    return { ok: true, value };
  }
  if (LIST_FIELDS[name] === true) {
    return { ok: true, value: trimmed.split(',').map(item => item.trim()).filter(item => item !== '') };
  }
  return { ok: true, value: trimmed };
}

function buildRequest(spec: CommandSpec, args: Record<string, string>): BuiltRequest {
  if (!spec.route) return { ok: false, error: 'This command is local only and has no route.' };

  const values: Record<string, unknown> = {};
  for (const arg of spec.args) {
    const raw = args[arg.name];
    if (raw === undefined || raw.trim() === '') {
      if (arg.required) return { ok: false, error: `Missing required argument: ${arg.name}.` };
      continue;
    }
    const coerced = coerceArg(arg.name, raw);
    if (!coerced.ok) return coerced;
    values[arg.name] = coerced.value;
  }

  if (spec.route.method === 'GET') {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string') query.set(key, value);
    }
    const qs = query.toString();
    return { ok: true, method: 'GET', url: qs ? `${spec.route.path}?${qs}` : spec.route.path, body: undefined };
  }

  // hunt: roleInputs selects the structured start branch; operators are the roles.
  const body = spec.name === 'hunt'
    ? {
        objective: values.objective,
        roleInputs: values.operators,
        targets: values.targets,
        ...(typeof values.name === 'string' ? { name: values.name } : {}),
      }
    : values;
  return { ok: true, method: 'POST', url: spec.route.path, body: JSON.stringify(body) };
}

function parseJsonBody(text: string): ParsedBody {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function serverErrorMessage(body: ParsedBody, response: Response): string {
  if (body.ok && typeof body.value === 'object' && body.value !== null && 'error' in body.value) {
    const message = body.value.error;
    if (typeof message === 'string' && message.trim() !== '') return redactString(message);
  }
  return `Request failed with HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`;
}

function replaceCommandName(text: string, name: string): string {
  const match = /^(\s*)\/\S*/.exec(text);
  if (!match) return text;
  const rest = text.slice(match[0].length);
  return `${match[1]}/${name}${rest === '' ? ' ' : rest}`;
}

function ResultBlock({ text }: { text: string }) {
  const truncated = text.length > PREVIEW_CHARS;
  return (
    <div className="ap-result-wrap">
      <pre className="ap-result">{truncated ? `${text.slice(0, PREVIEW_CHARS)}…` : text}</pre>
      {truncated && (
        <details className="ap-details">
          <summary>Show full result ({text.length} characters)</summary>
          <pre className="ap-result ap-result-full">{text}</pre>
        </details>
      )}
    </div>
  );
}

function HelpList() {
  return (
    <ul className="ap-help-list">
      {COMMANDS.map(spec => (
        <li key={spec.name}>
          <code>/{spec.name}</code>
          {spec.aliases.length > 0 && <span className="ap-help-aliases"> (aliases: {spec.aliases.join(', ')})</span>}
          <span className="ap-help-summary"> {spec.summary}</span>
          {spec.args.length > 0 && (
            <span className="ap-help-args">
              {' '}Args: {spec.args.map(arg => (arg.required ? arg.name : `[${arg.name}]`)).join(' ')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function AgentPanel() {
  const baseId = useId();
  const composerId = `${baseId}-composer`;
  const listboxId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;
  const statusId = `${baseId}-status`;
  const panelId = `${baseId}-panel`;

  const [tab, setTab] = useState<TabId>('unified');
  const [draft, setDraft] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  const nextIdRef = useRef(1);
  const controllersRef = useRef(new Map<number, AbortController>());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, tab]);

  const parsed = useMemo(() => parseComposerInput(draft, COMMANDS), [draft]);
  const open = parsed.kind === 'palette' && !dismissed;
  const options = useMemo(
    () => (parsed.kind === 'palette' ? filterCommands(parsed.query, COMMANDS) : []),
    [parsed],
  );
  const activeIndex = open && options.length > 0 ? Math.min(highlight, options.length - 1) : -1;
  const activeSpec = activeIndex >= 0 ? options[activeIndex] : undefined;
  const hintSpec: CommandSpec | null = parsed.kind === 'command' ? parsed.spec : (activeSpec ?? null);
  const argValues: Record<string, string> = parsed.kind === 'command' ? parsed.args : {};

  function updateDraft(next: string): void {
    setDraft(next);
    setHighlight(0);
    setDismissed(false);
    setPendingConfirm(false);
    setNote(null);
  }

  function completeCommand(spec: CommandSpec): void {
    updateDraft(`/${spec.name} `);
    composerRef.current?.focus();
  }

  function appendEntry(entry: TimelineEntry): void {
    setEntries(prev => [...prev, entry]);
  }

  function patchEntry(id: number, patch: Partial<TimelineEntry>): void {
    setEntries(prev => prev.map(entry => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  async function runCommand(spec: CommandSpec, args: Record<string, string>): Promise<void> {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    const base: TimelineEntry = {
      id,
      agent: spec.agent,
      echo: echoFor(spec, args),
      status: 'running',
      elapsedMs: null,
      httpStatus: null,
      error: null,
      resultText: null,
    };

    if (!spec.route) {
      appendEntry({ ...base, status: 'help' });
      return;
    }

    const built = buildRequest(spec, args);
    if (!built.ok) {
      appendEntry({ ...base, status: 'error', error: built.error });
      return;
    }

    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    appendEntry(base);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (built.body !== undefined) headers['Content-Type'] = 'application/json';

    const started = performance.now();
    try {
      const response = await fetch(built.url, {
        method: built.method,
        headers,
        body: built.body,
        signal: controller.signal,
      });
      const elapsedMs = Math.round(performance.now() - started);
      const text = await response.text();
      const body = parseJsonBody(text);
      let resultText: string;
      if (text.trim() === '') {
        resultText = '(empty response)';
      } else if (body.ok) {
        resultText = JSON.stringify(redactForDisplay(body.value), null, 2) ?? '';
      } else {
        resultText = redactString(text);
      }

      if (response.ok) {
        patchEntry(id, { status: 'ok', httpStatus: response.status, elapsedMs, resultText });
      } else {
        patchEntry(id, {
          status: 'error',
          httpStatus: response.status,
          elapsedMs,
          error: serverErrorMessage(body, response),
          resultText,
        });
      }
    } catch (err) {
      const elapsedMs = Math.round(performance.now() - started);
      if (controller.signal.aborted) {
        patchEntry(id, { status: 'aborted', elapsedMs });
      } else {
        patchEntry(id, {
          status: 'error',
          elapsedMs,
          error: err instanceof Error ? redactString(err.message) : 'Request failed.',
        });
      }
    } finally {
      controllersRef.current.delete(id);
    }
  }

  function handleEnter(): void {
    if (parsed.kind === 'palette') {
      if (activeSpec) completeCommand(activeSpec);
      return;
    }
    if (parsed.kind === 'text') {
      setNote(TEXT_NOTE);
      return;
    }
    if (parsed.kind === 'unknown') {
      setNote(`Unknown command "/${parsed.name}". Type / to browse commands.`);
      return;
    }

    const { spec, args, missing } = parsed;
    if (missing.length > 0) {
      updateDraft(replaceCommandName(draft, spec.name));
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
    void runCommand(spec, args);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (open && options.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlight((activeIndex + step + options.length) % options.length);
        return;
      }
      if (event.key === 'Tab' && !event.shiftKey && activeSpec) {
        event.preventDefault();
        completeCommand(activeSpec);
        return;
      }
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setDismissed(true);
      } else if (pendingConfirm) {
        event.preventDefault();
        setPendingConfirm(false);
      }
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleEnter();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[next];
    setTab(target.id);
    tabRefs.current[target.id]?.focus();
  }

  const activeTab = TABS.find(item => item.id === tab) ?? TABS[TABS.length - 1];
  const visible = activeTab.agent === null ? entries : entries.filter(entry => entry.agent === activeTab.agent);

  let statusMessage: string | null = null;
  if (note) {
    statusMessage = note;
  } else if (parsed.kind === 'command' && parsed.spec.confirm && pendingConfirm) {
    statusMessage = `Press Enter again to run /${parsed.spec.name}.`;
  } else if (parsed.kind === 'command' && parsed.missing.length > 0) {
    statusMessage = `Missing required arguments: ${parsed.missing.join(', ')}. Add them as key=value, then press Enter.`;
  } else if (parsed.kind === 'unknown') {
    statusMessage = `Unknown command "/${parsed.name}". Type / to browse commands.`;
  } else if (draft.trim() === '') {
    statusMessage = 'Type / to browse commands. Enter runs a command.';
  }

  const activeOptionId = activeSpec ? `${listboxId}-opt-${activeSpec.name}` : undefined;

  return (
    <section className="agent-panel" aria-labelledby={`${baseId}-title`}>
      <header className="ap-header">
        <h2 id={`${baseId}-title`} className="ap-title">Agent console</h2>
        <p className="ap-subtitle">Slash commands call server routes. Free text is not sent yet.</p>
      </header>

      <div className="ap-tablist" role="tablist" aria-label="Agent lanes">
        {TABS.map((item, index) => {
          const selected = item.id === tab;
          const count = item.agent === null
            ? entries.length
            : entries.filter(entry => entry.agent === item.agent).length;
          return (
            <button
              key={item.id}
              ref={el => {
                tabRefs.current[item.id] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className="ap-tab"
              onClick={() => setTab(item.id)}
              onKeyDown={event => handleTabKeyDown(event, index)}
            >
              {item.label}
              <span className="ap-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tab}`}
        className="ap-timeline"
        ref={timelineRef}
      >
        {visible.length === 0 ? (
          <p className="ap-empty">
            {activeTab.agent === null
              ? 'No commands executed yet. Type / to choose one.'
              : `No ${activeTab.label} commands yet. Run one below, or see the Unified Purple Stream.`}
          </p>
        ) : (
          <ol className="ap-timeline-list" aria-label={`${activeTab.label} timeline`}>
            {visible.map(entry => (
              <li key={entry.id} className={`ap-card ap-card--${entry.status}`}>
                <div className="ap-card-head">
                  <span className="ap-agent">{AGENT_LABEL[entry.agent]}</span>
                  <code className="ap-echo">{entry.echo}</code>
                </div>
                <div className="ap-card-meta">
                  <span className="ap-pill">{STATUS_LABEL[entry.status]}</span>
                  {entry.httpStatus !== null && <span>HTTP {entry.httpStatus}</span>}
                  {entry.elapsedMs !== null && <span>{entry.elapsedMs} ms</span>}
                  {entry.status === 'running' && (
                    <button
                      type="button"
                      className="ap-stop"
                      onClick={() => controllersRef.current.get(entry.id)?.abort()}
                    >
                      Stop
                    </button>
                  )}
                </div>
                {entry.status === 'running' && (
                  <p className="ap-running">
                    <span className="ap-spinner" aria-hidden="true" />
                    Waiting for response…
                  </p>
                )}
                {entry.status === 'help' && <HelpList />}
                {entry.error && <p className="ap-error">{entry.error}</p>}
                {entry.resultText !== null && <ResultBlock text={entry.resultText} />}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="ap-composer">
        <label htmlFor={composerId} className="ap-label">Command</label>
        <div className="ap-composer-box">
          <textarea
            id={composerId}
            ref={composerRef}
            role="combobox"
            className="ap-textarea"
            rows={2}
            value={draft}
            spellCheck={false}
            autoComplete="off"
            placeholder="/ for commands. Enter runs, Shift+Enter adds a line."
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-describedby={`${hintId} ${statusId}`}
            onChange={event => updateDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
          />
          <div className="ap-popover" hidden={!open}>
            <ul id={listboxId} role="listbox" aria-label="Slash commands" className="ap-listbox">
              {options.map((spec, index) => (
                <li
                  key={spec.name}
                  id={`${listboxId}-opt-${spec.name}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? 'ap-option ap-option--active' : 'ap-option'}
                  onMouseDown={event => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => completeCommand(spec)}
                >
                  <span className="ap-option-name">/{spec.name}</span>
                  <span className="ap-option-agent">{AGENT_LABEL[spec.agent]}</span>
                  <span className="ap-option-summary">{spec.summary}</span>
                </li>
              ))}
            </ul>
            {open && parsed.kind === 'palette' && options.length === 0 && (
              <p className="ap-popover-empty">No command matches &ldquo;{parsed.query}&rdquo;.</p>
            )}
          </div>
        </div>

        <div id={statusId} role="status" aria-live="polite" className="ap-status">
          {statusMessage}
        </div>

        <div id={hintId} className="ap-hints">
          {hintSpec ? (
            <>
              <p className="ap-hints-title">
                <code>/{hintSpec.name}</code> {hintSpec.summary}
              </p>
              {hintSpec.args.length === 0 ? (
                <p className="ap-hints-none">No arguments.</p>
              ) : (
                <ul className="ap-hints-list">
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
                        <span className="ap-hint-req">{arg.required ? 'required' : 'optional'}</span>
                        {' — '}
                        <span>{arg.hint}</span>
                        {fill && <span className="ap-hint-fill">{fill}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="ap-hints-none">Pick a command to see its arguments.</p>
          )}
        </div>
      </div>
    </section>
  );
}
