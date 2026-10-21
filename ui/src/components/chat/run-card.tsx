import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import type { PurpleRunCounters, PurpleRunEvent, PurpleRunEventState } from '../../lib/events';
const Markdown = lazy(() => import('./markdown'));
/**
 * Inline Purple Team run progress (`data-purple-run` DataUIPart renderer).
 *
 * The SSE bus emits `purple-run` events ({runId, repo?, state, counters,
 * errorCode, message, missionId?}). Repo-ingest states are fetching|analyzing|
 * completed|failed|cancelled; mission states are executing|paused|stopped.
 * This module projects them onto the §5
 * display model (labelled card, phase checklist, monotonic counters) and
 * provides the pure list operations ChatStream uses to upsert run parts
 * inside the thread. Run-card messages never reach the model —
 * `toWireMessages` strips them before any POST /api/chat.
 */

export type PurpleRunPhaseId = 'resolve' | 'fetch' | 'analyze';
export type PurpleRunPhaseState = 'pending' | 'active' | 'done' | 'error';

export interface PurpleRunPhase {
  id: PurpleRunPhaseId;
  label: string;
  state: PurpleRunPhaseState;
}

export type PurpleRunDisplayState = 'ingesting' | 'done' | 'error' | 'cancelled';

export interface PurpleRunData {
  runId: string;
  /** Canonical `${owner}/${repo}@${ref}` (plus subpath when scoped). */
  label: string;
  state: PurpleRunDisplayState;
  phases: PurpleRunPhase[];
  counters: Partial<PurpleRunCounters>;
  startedAt: number;
  endedAt?: number;
  /** Skip summary (completed) or server-redacted display copy (failed). */
  summary?: string;
  errorCode?: string;
  /** Mission the run belongs to; View Report requests its report and stays disabled without one. */
  missionId?: string;
  /** Last wire state seen, so a later failure/cancel knows which phase was interrupted. */
  lastEventState: PurpleRunEventState;
}

const SECRET_VALUE =
  /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|ghr_[A-Za-z0-9]{12,})\b/g;

const RUN_STATE_LABEL: Record<PurpleRunDisplayState, string> = {
  ingesting: 'Ingesting',
  done: 'Completed',
  error: 'Failed',
  cancelled: 'Cancelled',
};

const PHASE_LABEL: Record<PurpleRunPhaseId, string> = {
  resolve: 'Resolve',
  fetch: 'Fetch files',
  analyze: 'Analyze',
};

const PHASE_STATE_LABEL: Record<PurpleRunPhaseState, string> = {
  pending: 'pending',
  active: 'in progress',
  done: 'done',
  error: 'failed',
};

/** Progression rank of wire states; terminal states all rank 3. */
const EVENT_RANK: Record<PurpleRunEventState, number> = {
  fetching: 1,
  analyzing: 2,
  executing: 2,
  paused: 2,
  completed: 3,
  failed: 3,
  cancelled: 3,
  stopped: 3,
};

/** Error codes that fail before any file is fetched — resolve-phase failures. */
const RESOLVE_ERROR_CODES: Record<string, true> = {
  repo_not_found: true,
  private_inaccessible: true,
  not_connected: true,
  invalid_url: true,
};

/** Copy and retry text per ingest error code (phase 35 §5.3). Unknown codes show the raw code only. */
const ERROR_GUIDANCE: Record<string, { copy: string; retry?: string }> = {
  invalid_url: {
    copy: 'The URL is not valid.',
    retry: 'Fix the URL. The message above names the exact problem.',
  },
  repo_not_found: {
    copy: 'Repository not found on github.com.',
    retry: 'Check the spelling. If the repository is private, connect GitHub with the repo scope in Settings.',
  },
  private_inaccessible: {
    copy: 'The repository is private, or it does not exist for this connection.',
    retry: 'Connect GitHub with the repo scope in Settings, then retry.',
  },
  not_connected: {
    copy: 'No GitHub connection is available for this repository.',
    retry: 'Connect GitHub with the repo scope, set T3MP3ST_GITHUB_TOKEN, or pick a public repository.',
  },
  rate_limited: {
    copy: 'GitHub rate limit reached.',
    retry: 'Wait for the reset time, then retry. Do not retry in a loop.',
  },
  oversized: {
    copy: 'The repository exceeds an ingest cap.',
    retry: 'Narrow the URL to a /tree/<ref>/<subpath> scope, or raise the named T3MP3ST_REPO_* limit.',
  },
  network: {
    copy: 'Could not fetch the repository from GitHub.',
    retry: 'Check connectivity. Retrying is safe.',
  },
  cancelled: {
    copy: 'Ingest cancelled.',
  },
};

const PHASE_ORDER: readonly PurpleRunPhaseId[] = ['resolve', 'fetch', 'analyze'];

const COUNTER_SPECS: ReadonlyArray<{
  key: keyof PurpleRunCounters;
  label: string;
  format: 'count' | 'bytes';
}> = [
  { key: 'discovered', label: 'discovered', format: 'count' },
  { key: 'fetched', label: 'fetched', format: 'count' },
  { key: 'skipped', label: 'skipped', format: 'count' },
  { key: 'bytes', label: 'fetched', format: 'bytes' },
];

/** Builds the canonical run label from the event's repo descriptor. */
export function runLabel(repo: NonNullable<PurpleRunEvent['repo']>): string {
  const base = `${repo.owner}/${repo.repo}@${repo.ref}`;
  if (repo.subpath === undefined) return base;
  const sub = repo.subpath.trim().replace(/^\/+/, '');
  return sub === '' ? base : `${base} · ${sub}`;
}

/** Phase the checklist currently shows as in progress, if any. */
function activePhaseOf(data: PurpleRunData | undefined): PurpleRunPhaseId | undefined {
  return data?.phases.find(phase => phase.state === 'active')?.id;
}

/** Which ingest phase a failure belongs to, branching on errorCode (never prose). */
function failedPhaseFor(event: PurpleRunEvent, prev: PurpleRunData | undefined): PurpleRunPhaseId {
  if (event.errorCode !== undefined && RESOLVE_ERROR_CODES[event.errorCode] === true) return 'resolve';
  return activePhaseOf(prev) ?? 'fetch';
}

/**
 * Ingest phase a live wire state sits in; null once the run is terminal.
 * Mission states run during analyze; paused keeps the phase it interrupted.
 */
function livePhaseOf(state: PurpleRunEventState, prev: PurpleRunData | undefined): PurpleRunPhaseId | null {
  switch (state) {
    case 'fetching':
      return 'fetch';
    case 'analyzing':
    case 'executing':
      return 'analyze';
    case 'paused':
      return activePhaseOf(prev) ?? 'analyze';
    default:
      return null;
  }
}

/** Derives the phase checklist from the live phase plus failure/cancel position. */
export function derivePhases(
  currentPhase: PurpleRunPhaseId | null,
  failedPhase: PurpleRunPhaseId | null,
  cancelledPhase: PurpleRunPhaseId | null,
): PurpleRunPhase[] {
  return PHASE_ORDER.map(phase => {
    const position = PHASE_ORDER.indexOf(phase);
    let state: PurpleRunPhaseState;
    if (failedPhase !== null) {
      state = failedPhase === phase ? 'error' : position < PHASE_ORDER.indexOf(failedPhase) ? 'done' : 'pending';
    } else if (cancelledPhase !== null) {
      // Interrupted: earlier phases finished; the interrupted one and later ones never did.
      state = position < PHASE_ORDER.indexOf(cancelledPhase) ? 'done' : 'pending';
    } else if (currentPhase === null) {
      state = 'done';
    } else {
      state = phase === currentPhase ? 'active' : position < PHASE_ORDER.indexOf(currentPhase) ? 'done' : 'pending';
    }
    return { id: phase, label: PHASE_LABEL[phase], state };
  });
}

/** Counters are monotonic: keep the max per field across events. */
function mergeCounters(
  prev: Partial<PurpleRunCounters> | undefined,
  next: Partial<PurpleRunCounters> | undefined,
): Partial<PurpleRunCounters> {
  const merged: Partial<PurpleRunCounters> = { ...prev };
  if (next === undefined) return merged;
  for (const key of ['discovered', 'fetched', 'skipped', 'bytes'] as const) {
    const incoming = next[key];
    if (incoming === undefined) continue;
    const existing = merged[key];
    merged[key] = existing === undefined ? incoming : Math.max(existing, incoming);
  }
  return merged;
}

/**
 * Projects one wire event onto the display model, merging with the previous
 * snapshot. Once a run is terminal, later (stale/replayed) events are ignored.
 * Mission states share the card: executing/paused keep it ingesting (cancellable),
 * stopped reads as cancelled.
 */
export function mergePurpleRunData(
  prev: PurpleRunData | undefined,
  event: PurpleRunEvent,
  now: number,
): PurpleRunData {
  if (prev !== undefined && prev.state !== 'ingesting') return prev;
  const terminal = EVENT_RANK[event.state] >= 3;
  const failedPhase = event.state === 'failed' ? failedPhaseFor(event, prev) : null;
  const interrupted = event.state === 'cancelled' || event.state === 'stopped';
  const cancelledPhase = interrupted ? (activePhaseOf(prev) ?? 'fetch') : null;
  const displayState: PurpleRunDisplayState =
    event.state === 'completed'
      ? 'done'
      : event.state === 'failed'
        ? 'error'
        : interrupted
          ? 'cancelled'
          : 'ingesting';
  const summary =
    event.message !== undefined ? event.message.replace(SECRET_VALUE, '[redacted]') : prev?.summary;
  const errorCode = event.errorCode ?? prev?.errorCode;
  // Mission-scoped emitters (tick progress, stop notice) send the mission id as runId and no repo.
  const missionId = event.missionId ?? prev?.missionId ?? (event.repo === undefined ? event.runId : undefined);
  return {
    runId: event.runId,
    label: prev?.label ?? (event.repo !== undefined ? runLabel(event.repo) : `Mission ${event.runId}`),
    state: displayState,
    phases: derivePhases(livePhaseOf(event.state, prev), failedPhase, cancelledPhase),
    counters: mergeCounters(prev?.counters, event.counters),
    startedAt: prev?.startedAt ?? now,
    ...(terminal ? { endedAt: now } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(errorCode !== undefined ? { errorCode } : {}),
    ...(missionId !== undefined ? { missionId } : {}),
    lastEventState: event.state,
  };
}

/** Type guard for a stored `data-purple-run` part payload (persisted threads reload unvalidated). */
export function isPurpleRunData(data: unknown): data is PurpleRunData {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    typeof record.runId === 'string' &&
    record.runId !== '' &&
    typeof record.label === 'string' &&
    (record.state === 'ingesting' || record.state === 'done' || record.state === 'error' || record.state === 'cancelled') &&
    Array.isArray(record.phases) &&
    typeof record.startedAt === 'number' &&
    (record.missionId === undefined || typeof record.missionId === 'string')
  );
}

/**
 * Inserts or updates the `data-purple-run` part for `event.runId` inside the
 * thread. New runs append an assistant message holding only the run part;
 * updates replace the part's data in place (same part id, same message id) —
 * the list stays append-only.
 */
export function upsertPurpleRun(messages: UIMessage[], event: PurpleRunEvent, now: number): UIMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    let touched = false;
    const parts = message.parts.map(part => {
      if (part.type === 'data-purple-run' && isPurpleRunData(part.data) && part.data.runId === event.runId) {
        touched = true;
        return { ...part, data: mergePurpleRunData(part.data, event, now) };
      }
      return part;
    });
    if (touched) {
      const next = messages.slice();
      next[index] = { ...message, parts };
      return next;
    }
  }
  return [
    ...messages,
    {
      id: `purple-run-${event.runId}`,
      role: 'assistant',
      parts: [{ type: 'data-purple-run', id: event.runId, data: mergePurpleRunData(undefined, event, now) }],
    },
  ];
}

/** Optimistically marks a run cancelled (the terminal SSE event reconciles). */
export function cancelPurpleRunInMessages(messages: UIMessage[], runId: string, now: number): UIMessage[] {
  let touched = false;
  const next = messages.map(message => {
    const parts = message.parts.map(part => {
      if (
        part.type === 'data-purple-run' &&
        isPurpleRunData(part.data) &&
        part.data.runId === runId &&
        part.data.state === 'ingesting'
      ) {
        touched = true;
        return {
          ...part,
          data: {
            ...part.data,
            state: 'cancelled' as const,
            endedAt: now,
            phases: derivePhases(null, null, activePhaseOf(part.data) ?? 'fetch'),
          },
        };
      }
      return part;
    });
    return parts === message.parts ? message : { ...message, parts };
  });
  return touched ? next : messages;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Guidance line under a failed run's error text, keyed by the server's errorCode. */
function RunErrorGuidance({ code }: { code: string }) {
  const mapped = Object.prototype.hasOwnProperty.call(ERROR_GUIDANCE, code) ? ERROR_GUIDANCE[code] : undefined;
  const retry = mapped?.retry;
  return (
    <p className="apx-run-error-guidance">
      {mapped !== undefined ? <span className="apx-run-error-copy">{mapped.copy}</span> : <code>{code}</code>}
      {retry !== undefined && <span className="apx-run-error-retry"> {retry}</span>}
    </p>
  );
}

export function RunCard({ data, onCancelRun }: { data: PurpleRunData; onCancelRun: (runId: string) => void }) {
  const active = data.state === 'ingesting';
  const [confirming, setConfirming] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const resetTimerRef = useRef<number | null>(null);

  const [reportMd, setReportMd] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  // Live elapsed clock only while the run is in flight; the ticking value is
  // aria-hidden so the surrounding role="log" stays quiet (chunked announcements).
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const elapsedMs = (data.endedAt ?? (active ? nowTick : data.startedAt)) - data.startedAt;

  async function handleViewReport() {
    const missionId = data.missionId;
    if (missionId === undefined) return;
    setReportLoading(true);
    setReportErr(null);
    try {
      const res = await fetch(`/api/mission/${encodeURIComponent(missionId)}/report`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        let errText = `HTTP ${res.status}`;
        if (body && typeof body === 'object' && 'error' in body) {
          const e = body.error;
          if (typeof e === 'string') errText = e;
        }
        throw new Error(errText);
      }
      const body = await res.json();
      let rpt = '';
      if (body && typeof body === 'object' && 'report' in body) {
        const v = body.report;
        if (typeof v === 'string') rpt = v;
      }
      const md = rpt.trim() !== '' ? rpt : 'Run completed, no findings yet or generate.';
      setReportMd(md);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch report';
      setReportErr(msg);
      setReportMd('Run completed, no findings yet or generate.');
    } finally {
      setReportLoading(false);
    }
  }

  function requestCancel(): void {
    if (!confirming) {
      setConfirming(true);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null;
        setConfirming(false);
      }, 4000);
      return;
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setConfirming(false);
    onCancelRun(data.runId);
  }

  return (
    <div className={`apx-run apx-run--${data.state}`} role="group" aria-label={`Purple Team run ${data.label}`}>
      <div className="apx-run-head">
        <span className={`apx-run-dot${active ? ' apx-run-dot--active' : ''}`} aria-hidden="true" />
        <code className="apx-run-label">{data.label}</code>
        <span className={`apx-run-pill apx-run-pill--${data.state}`}>{RUN_STATE_LABEL[data.state]}</span>
        <span className="apx-run-elapsed" aria-hidden="true">
          {formatElapsed(elapsedMs)}
        </span>
        {active && (
          <button
            type="button"
            className={`apx-run-cancel${confirming ? ' apx-run-cancel--confirm' : ''}`}
            aria-label={confirming ? `Confirm: cancel run ${data.label}` : `Cancel run ${data.label}`}
            onClick={requestCancel}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? 'Confirm cancel' : 'Cancel'}
          </button>
        )}
      </div>
      <ul className="apx-run-phases" aria-label="Run phases">
        {data.phases.map(phase => (
          <li key={phase.id} className={`apx-run-phase apx-run-phase--${phase.state}`}>
            <span className="apx-run-phase-marker" aria-hidden="true" />
            <span className="apx-run-phase-label">{phase.label}</span>
            <span className="apx-run-phase-state">{PHASE_STATE_LABEL[phase.state]}</span>
          </li>
        ))}
      </ul>
      <div className="apx-run-counters" aria-live="off">
        {COUNTER_SPECS.map(({ key, label, format }) => {
          const value = data.counters[key];
          if (value === undefined) return null;
          return (
            <span key={key} className="apx-run-counter">
              <span className="apx-run-counter-value">
                {format === 'count' ? value.toLocaleString('en-US') : formatBytes(value)}
              </span>{' '}
              {label}
            </span>
          );
        })}
      </div>
      {data.state === 'error' && (
        <p className="apx-run-error">
          {data.summary ?? 'The run failed.'}
          {data.errorCode !== undefined && <span className="apx-run-error-code"> · {data.errorCode}</span>}
        </p>
      )}
      {data.state === 'error' && data.errorCode !== undefined && (
        <RunErrorGuidance code={data.errorCode} />
      )}
      {data.state === 'done' && data.summary !== undefined && <p className="apx-run-summary">{data.summary}</p>}
      {data.state === 'cancelled' && <p className="apx-run-summary">Run cancelled by the operator.</p>}
      {data.state === 'done' && (
        <div>
          <button
            type="button"
            onClick={() => { void handleViewReport(); }}
            disabled={reportLoading || data.missionId === undefined}
            title={data.missionId === undefined ? 'No mission is linked to this run.' : undefined}
            className="apx-run-report-btn"
          >
            {reportLoading ? 'Loading report…' : 'View Report'}
          </button>
          {reportErr ? <span style={{color:'red', marginLeft: '0.5em'}}>{reportErr}</span> : null}
        </div>
      )}
      {reportMd !== null && (
        <div style={{marginTop: '0.5em', border: '1px solid var(--border)', padding: '0.5em', maxHeight: '12em', overflow: 'auto', fontSize: '0.85em', background: 'var(--surface)', color: 'var(--text-primary)'}}>
          <Suspense fallback={<span>Loading report…</span>}>
            <Markdown text={reportMd} />
          </Suspense>
          <button type="button" onClick={() => setReportMd(null)} style={{fontSize:'0.7em', marginTop:'0.3em'}}>Close report</button>
        </div>
      )}
    </div>
  );
}
