/**
 * AgentPanel — the full-screen workbench host (phase 36 §2/§8).
 *
 * Rebuilt from the stacked panel: the tabs, palette grammar, and run-card
 * timeline survive; the panel-scoped composer is gone (the embedded ChatStream
 * composer is the only composer — the palette drives it through the shared
 * draft store). Thread lifecycle moved to the conversation sidebar + zustand
 * store; persistence rides ChatStream's onThreadSettled seam.
 *
 * Layout (workbench.css / styles.css): .shell--workbench gives the section
 * the full viewport; inside, exactly three bands — header (auto), thread
 * scroller (flex), composer (outside the scroller, sticky by construction).
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { UIMessage } from 'ai';
import { COMMANDS, type AgentId, type CommandSpec } from '../../../src/ui-commands/registry';
import ChatStream, { type ChatStreamHandle } from './ChatStream';
import { ConversationSidebar } from './workbench/ConversationSidebar';
import { SlashPalette } from './workbench/SlashPalette';
import { AGENT_LABEL } from './workbench/agent-labels';
import { readPrefs, savePrefs } from './workbench/prefs';
import { useConversationsStore } from '../stores/conversations';
import { useSelectedRepo } from '../stores/github';
import './agent-panel.css';
import './workbench/workbench.css';

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

const STATUS_LABEL: Record<EntryStatus, string> = {
  running: 'Running',
  ok: 'Done',
  error: 'Error',
  aborted: 'Stopped',
  help: 'Help',
};

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

  // hunt body builder passes repoUrl (when present from registry arg or wired store default) preferring targetContext+repoUrl for repo runs (over targets); backward for snippets.
  const body = spec.name === 'hunt'
    ? (typeof values.repoUrl === 'string' && values.repoUrl.trim() !== ''
        ? {
            objective: values.objective,
            roleInputs: values.operators,
            targetContext: { kind: 'artifacts' },
            repoUrl: values.repoUrl.trim(),
            ...(typeof values.name === 'string' ? { name: values.name } : {}),
          }
        : {
            objective: values.objective,
            roleInputs: values.operators,
            targets: values.targets,
            ...(typeof values.name === 'string' ? { name: values.name } : {}),
          })
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

export interface AgentPanelProps {
  /** True while the rail is hidden (focus mode) — the header shows the exit button. */
  focusMode: boolean;
  onExitFocusMode: () => void;
}

export default function AgentPanel({ focusMode, onExitFocusMode }: AgentPanelProps) {
  const baseId = useId();
  const sidebarId = `${baseId}-sidebar`;
  const timelineId = `${baseId}-timeline`;

  const activeId = useConversationsStore(state => state.activeId);
  const load = useConversationsStore(state => state.load);

  const [tab, setTab] = useState<TabId>('unified');
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => readPrefs().sidebarOpen);

  const nextIdRef = useRef(1);
  const controllersRef = useRef(new Map<number, AbortController>());
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<ChatStreamHandle | null>(null);
  const loadedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    void load();
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, [load]);

  // Conversation switch: hydrate the new thread from the server store.
  useEffect(() => {
    if (activeId === null || activeId === loadedThreadRef.current) return;
    loadedThreadRef.current = activeId;
    void useConversationsStore
      .getState()
      .loadMessages(activeId)
      .then(messages => {
        if (useConversationsStore.getState().activeId === activeId) chatRef.current?.loadMessages(messages);
      });
  }, [activeId]);

  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, tab, timelineOpen]);

  /** ChatStream persistence seam — stable identity; the store debounces the PUT. */
  const handleThreadSettled = useCallback((messages: UIMessage[], threadId: string) => {
    if (threadId === 'unsynced' || messages.length === 0) return;
    useConversationsStore.getState().syncMessages(threadId, messages);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    savePrefs({ sidebarOpen: false });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(open => {
      savePrefs({ sidebarOpen: !open });
      return !open;
    });
  }, []);

  function appendEntry(entry: TimelineEntry): void {
    setEntries(prev => [...prev, entry]);
  }

  function patchEntry(id: number, patch: Partial<TimelineEntry>): void {
    setEntries(prev => prev.map(entry => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  async function runCommand(spec: CommandSpec, args: Record<string, string>): Promise<void> {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    setTimelineOpen(true);

    let finalArgs = args;
    if (spec.name === 'hunt' && !args.repoUrl) {
      const { selected } = useSelectedRepo.getState();
      if (selected) {
        const repoUrl = `https://github.com/${selected.owner}/${selected.repo}${selected.ref && selected.ref !== 'HEAD' ? `/tree/${selected.ref}` : ''}`;
        finalArgs = { ...args, repoUrl };
      }
    }

    const base: TimelineEntry = {
      id,
      agent: spec.agent,
      echo: echoFor(spec, finalArgs),
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

    const built = buildRequest(spec, finalArgs);
    if (!built.ok) {
      appendEntry({ ...base, status: 'error', error: built.error });
      return;
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
  const threadId = activeId ?? 'unsynced';

  return (
    <section className="apx-workbench" aria-labelledby={`${baseId}-title`}>
      <header className="apx-header">
        <div className="apx-header-row">
          <h2 id={`${baseId}-title`} className="apx-title">
            Agent console
          </h2>
          <div className="apx-header-actions">
            {focusMode && (
              <button type="button" className="apx-header-button" onClick={onExitFocusMode}>
                Exit focus mode
              </button>
            )}
            <button
              type="button"
              className="apx-header-button"
              aria-expanded={sidebarOpen}
              aria-controls={sidebarId}
              onClick={toggleSidebar}
            >
              {sidebarOpen ? 'Hide conversations' : 'Show conversations'}
            </button>
            <button
              type="button"
              className="apx-header-button"
              aria-expanded={timelineOpen}
              aria-controls={timelineId}
              onClick={() => setTimelineOpen(open => !open)}
            >
              Timeline
            </button>
            <details className="apx-keys">
              <summary className="apx-header-button">Keys</summary>
              <div className="apx-keys-body">
                <p>Enter send · Shift+Enter newline · / command palette</p>
                <p>Esc palette → confirm → exit focus mode · Alt+1..4 sections</p>
                <p>Home/End jump in the message log</p>
              </div>
            </details>
          </div>
        </div>
        <p className="apx-subtitle">
          Slash commands call server routes. Free text goes to the configured default model. Conversations persist
          server-side.
        </p>

        <div className="ap-tablist" role="tablist" aria-label="Agent lanes">
          {TABS.map((item, index) => {
            const selected = item.id === tab;
            const count =
              item.agent === null ? entries.length : entries.filter(entry => entry.agent === item.agent).length;
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
                aria-controls={`${baseId}-panel`}
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
      </header>

      <div className="apx-body">
        <ConversationSidebar id={sidebarId} open={sidebarOpen} onClose={closeSidebar} />

        <div className="apx-main">
          <SlashPalette threadId={threadId} onRunCommand={(spec, args) => void runCommand(spec, args)}>
            <ChatStream
              ref={chatRef}
              threadId={threadId}
              onThreadSettled={handleThreadSettled}
              showNewChat={false}
              autoFocusComposer
            />
          </SlashPalette>

          {timelineOpen && (
            <div id={timelineId} className="apx-timeline" ref={timelineRef} aria-label="Command timeline">
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
                            aria-label={`Stop ${entry.echo}`}
                            onClick={() => controllersRef.current.get(entry.id)?.abort()}
                          >
                            Stop
                          </button>
                        )}
                      </div>
                      {entry.status === 'running' && (
                        <p className="ap-running">
                          <span className="ap-spinner" aria-hidden={true} />
                          Waiting for response…
                        </p>
                      )}
                      {entry.status === 'help' && <HelpList />}
                      {entry.error !== null && <p className="ap-error">{entry.error}</p>}
                      {entry.resultText !== null && <ResultBlock text={entry.resultText} />}
                    </li>
                  ))}
                </ol>
              )}
              <p className="apx-timeline-count" role="status">
                {visible.length === 0
                  ? 'Timeline empty.'
                  : `${visible.length} timeline ${visible.length === 1 ? 'entry' : 'entries'}.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
