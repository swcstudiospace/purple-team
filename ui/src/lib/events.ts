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

/**
 * Lifecycle states. Repo-ingest runs emit fetching/analyzing/completed/failed/cancelled
 * (pinned n5↔n6 contract); mission runs emit executing/paused, and stopped on halt.
 */
export type PurpleRunEventState =
  | 'fetching'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'executing'
  | 'paused'
  | 'stopped';

/** Wire shape of a `purple-run` SSE event. */
export interface PurpleRunEvent {
  runId: string;
  /** Present on repo-ingest events; mission-scoped events (progress, stop) omit it. */
  repo?: { owner: string; repo: string; ref: string; subpath?: string };
  state: PurpleRunEventState;
  /** Mission the run belongs to, when the server names it. Drives the card's View Report. */
  missionId?: string;
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
  executing: true,
  paused: true,
  stopped: true,
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

/** Validates a `repo` descriptor; null when owner, repo or ref is missing or empty. */
function parseRepo(value: unknown): NonNullable<PurpleRunEvent['repo']> | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const owner = record.owner;
  const name = record.repo;
  const ref = record.ref;
  if (
    typeof owner !== 'string' ||
    owner === '' ||
    typeof name !== 'string' ||
    name === '' ||
    typeof ref !== 'string' ||
    ref === ''
  ) {
    return null;
  }
  return {
    owner,
    repo: name,
    ref,
    ...(typeof record.subpath === 'string' ? { subpath: record.subpath } : {}),
  };
}

/**
 * Validates an unknown SSE payload as a {@link PurpleRunEvent}.
 * Returns null for anything malformed — a bad frame never reaches the thread.
 * `repo` is optional: mission-scoped events omit it.
 */
export function parsePurpleRunEvent(data: unknown): PurpleRunEvent | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const runId = record.runId;
  // `active` is the server's placeholder while no mission exists; it names no run.
  if (typeof runId !== 'string' || runId === '' || runId === 'active') return null;
  const state = record.state;
  if (typeof state !== 'string' || EVENT_STATES[state] !== true) return null;

  let repo: PurpleRunEvent['repo'] | undefined;
  if (record.repo !== undefined) {
    const parsedRepo = parseRepo(record.repo);
    if (parsedRepo === null) return null;
    repo = parsedRepo;
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

  return {
    runId,
    ...(repo !== undefined ? { repo } : {}),
    state: state as PurpleRunEventState,
    counters,
    ...(typeof record.errorCode === 'string' ? { errorCode: record.errorCode } : {}),
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
    ...(typeof record.missionId === 'string' && record.missionId !== '' ? { missionId: record.missionId } : {}),
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
