/**
 * Shared subscription helper for the server's SSE bus (`GET /api/events`).
 *
 * The server writes named events as `event: <name>\ndata: <json>`, so each
 * event name is dispatched through its own `addEventListener` channel. A single
 * module-level `EventSource` is shared across every subscriber in the app:
 * mounting N components that listen to `purple-run` still opens ONE connection,
 * and the browser's native reconnect handles drops without duplicate streams.
 */

/** Progress counters on a `purple-run` event; all monotonic, all optional. */
export interface PurpleRunCounters {
  discovered: number;
  fetched: number;
  skipped: number;
  bytes: number;
}

/** Lifecycle states emitted by the repo-ingest run (pinned n5↔n6 contract). */
export type PurpleRunEventState = 'fetching' | 'analyzing' | 'completed' | 'failed' | 'cancelled';

/** Wire shape of a `purple-run` SSE event. */
export interface PurpleRunEvent {
  runId: string;
  repo: { owner: string; repo: string; ref: string; subpath?: string };
  state: PurpleRunEventState;
  counters?: Partial<PurpleRunCounters>;
  errorCode?: string;
  /** Terminal events carry the skip summary; failed events carry display copy. */
  message?: string;
}

const EVENT_PURPLE_RUN = 'purple-run';
const EVENT_STATES: Record<string, true> = {
  fetching: true,
  analyzing: true,
  completed: true,
  failed: true,
  cancelled: true,
};

type RawListener = (data: unknown) => void;

const listenersByEvent = new Map<string, Set<RawListener>>();
let source: EventSource | null = null;

function dispatch(eventName: string, data: unknown): void {
  const set = listenersByEvent.get(eventName);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(data);
    } catch {
      // A faulty listener must never take the shared bus down.
    }
  }
}

function ensureConnection(eventName: string): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/events');
  // The string overload of addEventListener takes an EventListener; each frame
  // for a named event is a MessageEvent carrying one JSON payload.
  const onFrame: EventListener = event => {
    let data: unknown;
    try {
      data = JSON.parse((event as MessageEvent<string>).data);
    } catch {
      return; // Malformed frame: drop it, the bus stays up.
    }
    dispatch(eventName, data);
  };
  source.addEventListener(eventName, onFrame);
}

function releaseConnection(): void {
  if (!source) return;
  source.close();
  source = null;
}

/**
 * Subscribes to one named SSE event. Returns an unsubscribe function; the last
 * unsubscribe closes the shared connection, so StrictMode double-mounts and
 * component churn never leak connections.
 */
function subscribeEvent(eventName: string, listener: RawListener): () => void {
  let set = listenersByEvent.get(eventName);
  if (!set) {
    set = new Set();
    listenersByEvent.set(eventName, set);
    ensureConnection(eventName);
  }
  set.add(listener);
  return () => {
    const current = listenersByEvent.get(eventName);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listenersByEvent.delete(eventName);
      if (listenersByEvent.size === 0) releaseConnection();
    }
  };
}

/**
 * Validates an unknown SSE payload as a {@link PurpleRunEvent}.
 * Returns null for anything malformed — a bad frame never reaches the thread.
 */
export function parsePurpleRunEvent(data: unknown): PurpleRunEvent | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const repo = record.repo;
  if (typeof record.runId !== 'string' || record.runId === '' || typeof repo !== 'object' || repo === null) {
    return null;
  }
  const repoRecord = repo as Record<string, unknown>;
  const owner = repoRecord.owner;
  const repoName = repoRecord.repo;
  const ref = repoRecord.ref;
  const state = record.state;
  if (
    typeof owner !== 'string' ||
    owner === '' ||
    typeof repoName !== 'string' ||
    repoName === '' ||
    typeof ref !== 'string' ||
    ref === '' ||
    typeof state !== 'string' ||
    EVENT_STATES[state] !== true
  ) {
    return null;
  }

  let counters: Partial<PurpleRunCounters> | undefined;
  if (typeof record.counters === 'object' && record.counters !== null) {
    const raw = record.counters as Record<string, unknown>;
    const next: Partial<PurpleRunCounters> = {};
    for (const key of ['discovered', 'fetched', 'skipped', 'bytes'] as const) {
      const value = raw[key];
      if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
    }
    counters = next;
  }

  const parsedState = state as PurpleRunEventState;
  return {
    runId: record.runId,
    repo: {
      owner,
      repo: repoName,
      ref,
      ...(typeof repoRecord.subpath === 'string' ? { subpath: repoRecord.subpath } : {}),
    },
    state: parsedState,
    counters,
    ...(typeof record.errorCode === 'string' ? { errorCode: record.errorCode } : {}),
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
  };
}

/**
 * Subscribes to `purple-run` progress events. The listener receives only
 * validated {@link PurpleRunEvent} payloads.
 */
export function subscribePurpleRuns(listener: (event: PurpleRunEvent) => void): () => void {
  return subscribeEvent(EVENT_PURPLE_RUN, data => {
    const event = parsePurpleRunEvent(data);
    if (event) listener(event);
  });
}
