/**
 * Typed fetch helper for the T3MP3ST API. The UI is served by the same Express
 * process at `/app/`, so every path is relative (e.g. `/api/health`).
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }

  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res));
  }
  return (await res.json()) as T;
}

async function readErrorMessage(res: Response): Promise<string> {
  const fallback = `Request failed with HTTP ${res.status}`;
  try {
    const body: unknown = await res.json();
    if (
      body !== null &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error.trim()
    ) {
      return body.error;
    }
  } catch {
    // Non-JSON error body: fall back to the status-based message.
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Response types. Copied from the handler shapes in src/server.ts and the
// helpers they call. Only fields the UI reads are listed.
// ---------------------------------------------------------------------------

export type OAuthVendor = 'xai' | 'openai' | 'claude';
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type FindingStatus = 'open' | 'validated' | 'false_positive' | 'fix_ready' | 'retest_queued' | 'resolved';
export type LocalAgentId = 'claude' | 'codex' | 'hermes' | 'opencode' | 'omp' | 'cursor';

/** GET /api/health (healthPayload + payload_db_size) */
export interface HealthResponse {
  ok: boolean;
  status: string;
  version: string;
  apiVersion: string;
  llm: {
    configured: boolean;
    connected: boolean;
    provider: string;
    model: string;
  };
  storage: {
    ok: boolean;
    driver: 'memory' | 'filesystem';
  };
  mission: {
    active: boolean;
    id: string | null;
  };
  timestamp: string;
  payload_db_size: number;
}

/** GET /api/oauth/status (oauthStatus) */
export interface OAuthStatus {
  connected: boolean;
  /** Epoch milliseconds. Absent when not connected. */
  expiresAt?: number;
  label: string;
  /** Short plan tier (claude only, e.g. "Max 20x"). Absent when unknown. */
  tier?: string;
  /** True when the refresh token expired and a fresh sign-in is required (claude only). */
  needsReauth?: boolean;
}

export type OAuthStatusResponse = Record<OAuthVendor, OAuthStatus>;

/** GET /api/llm/status */
export interface LlmStatusResponse {
  connected: boolean;
  provider: string;
  model: string;
  hasApiKey: boolean;
  configured: boolean;
  oauth: OAuthStatusResponse;
}

/** AgentDetection from src/agent/local-agents.ts (path omitted: not displayed) */
export interface AgentDetection {
  id: LocalAgentId;
  label: string;
  vendor: string;
  installed: boolean;
  version?: string;
  authed: boolean;
  ready: boolean;
}

/** GET /api/agents/local/detect */
export interface LocalAgentsDetectResponse {
  agents: AgentDetection[];
  connected: string[];
}

/** OperatorCell.getStatus() summary */
export interface OperatorPoolSummary {
  total: number;
  available: number;
  busy: number;
  cooldown: number;
  burned: number;
  byArchetype: Record<string, number>;
}

/**
 * GET /api/mission/status. When no engine is running the server returns only
 * `{ active: false, progress: [], tasks: [] }`, so every other field is optional.
 */
export interface MissionStatusResponse {
  active: boolean;
  paused?: boolean;
  stallReason?: string | null;
  name?: string;
  tickCount?: number;
  mission?: {
    id: string;
    name: string;
    status: string;
    currentPhase: string;
  } | null;
  operators?: {
    summary: OperatorPoolSummary;
    details: unknown[];
  };
}

/** FindingRecord from src/server.ts (subset) */
export interface FindingRecord {
  id: string;
  title: string;
  target: string;
  severity: FindingSeverity;
  status: FindingStatus;
  updatedAt: string;
}

/** GET /api/findings */
export interface FindingsResponse {
  findings: FindingRecord[];
}
