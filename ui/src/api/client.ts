/**
 * Typed fetch helper for the T3MP3ST API. The UI is served by the same Express
 * process at `/app/`, so every path is relative (e.g. `/api/health`).
 */
import type { UIMessage } from 'ai';

export class ApiError extends Error {
  readonly status: number;
  /** Machine-readable code from the JSON error body, when the route sends one. */
  readonly code?: string;
  /** Epoch-ms earliest retry time from the JSON body (rate-limited responses). */
  readonly retryAt?: number;

  constructor(status: number, message: string, code?: string, retryAt?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAt = retryAt;
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
    const body = await readErrorBody(res);
    throw new ApiError(res.status, body.message, body.code, body.retryAt);
  }
  return (await res.json()) as T;
}

interface ErrorBody {
  message: string;
  code?: string;
  retryAt?: number;
}

async function readErrorBody(res: Response): Promise<ErrorBody> {
  const fallback: ErrorBody = { message: `Request failed with HTTP ${res.status}` };
  try {
    const body: unknown = await res.json();
    if (body !== null && typeof body === 'object') {
      const { error, code, retryAt } = body as Record<string, unknown>;
      const message =
        typeof error === 'string' && error.trim() ? error : fallback.message;
      const parsedCode = typeof code === 'string' && code.trim() ? code : undefined;
      const parsedRetryAt =
        typeof retryAt === 'number' && Number.isFinite(retryAt) ? retryAt : undefined;
      if (message !== fallback.message || parsedCode !== undefined || parsedRetryAt !== undefined) {
        return { message, code: parsedCode, retryAt: parsedRetryAt };
      }
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

// ---------------------------------------------------------------------------
// GitHub section (phase 35). Shapes from the route contracts in
// src/server.ts / src/github/* per .planning/phases/35-github-integration-repo-url/.
// ---------------------------------------------------------------------------

export type GitHubVisibility = 'public' | 'private' | 'internal';

/** GET /api/oauth/github/status — no token fields ever leave the server. */
export interface GitHubStatus {
  configured: boolean;
  connected: boolean;
  login?: string;
  avatarUrl?: string;
  scopes?: string[];
  /** ms epoch of the access token (short-lived; the server refreshes on demand). */
  expiresAt?: number;
  /** Derived redirect URI to register on the GitHub OAuth App (setup card). */
  redirectUri?: string;
  mode?: 'connected' | 'anonymous';
}

/** GET /api/oauth/github/start */
export interface GitHubStartResponse {
  authorizeUrl: string;
  state: string;
}

/** POST /api/oauth/github/complete | /api/oauth/github/logout */
export interface GitHubActionResult {
  ok: boolean;
  github: GitHubStatus;
}

/** One repository row from GET /api/github/repositories (owner/repo pre-split). */
export interface GitHubRepoSummary {
  owner: string;
  repo: string;
  fullName: string;
  description?: string;
  visibility: GitHubVisibility;
  private: boolean;
  defaultBranch: string;
  pushedAt?: string;
  htmlUrl: string;
}

/** GET /api/github/repositories */
export interface GitHubRepositoriesResponse {
  repositories: GitHubRepoSummary[];
  page: number;
  perPage: number;
  hasNext: boolean;
}

/** GET /api/github/resolve?url= */
export interface GitHubResolveResponse {
  owner: string;
  repo: string;
  ref: string;
  defaultBranch: string;
  fullName: string;
  visibility: GitHubVisibility;
  private: boolean;
  cloneUrl: string;
  htmlUrl: string;
  pushedAt?: string;
  accessible: 'token' | 'anonymous';
}

export function listGitHubRepositories(params: {
  page: number;
  perPage: number;
  visibility: 'all' | 'public' | 'private';
}): Promise<GitHubRepositoriesResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    per_page: String(params.perPage),
    visibility: params.visibility,
  });
  return getJson<GitHubRepositoriesResponse>(`/api/github/repositories?${query.toString()}`);
}

export function resolveGitHubRepository(url: string): Promise<GitHubResolveResponse> {
  return getJson<GitHubResolveResponse>(
    `/api/github/resolve?url=${encodeURIComponent(url)}`,
  );
}

/** Paste fallback: `code` may be a raw code, `code#state`, or the whole callback URL. */
export function completeGitHubConnect(code: string): Promise<GitHubActionResult> {
  return getJson<GitHubActionResult>('/api/oauth/github/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

// ---------------------------------------------------------------------------
// Write helpers (phase 36 §3.4). Same ApiError/redaction conventions as getJson.
// ---------------------------------------------------------------------------

async function sendJson<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }

  if (!res.ok) {
    const errorBody = await readErrorBody(res);
    throw new ApiError(res.status, errorBody.message, errorBody.code, errorBody.retryAt);
  }
  return (await res.json()) as T;
}

/** POST JSON to a same-origin API path. */
export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return sendJson<T>('POST', path, body);
}

/** PATCH JSON to a same-origin API path. */
export function patchJson<T>(path: string, body?: unknown): Promise<T> {
  return sendJson<T>('PATCH', path, body);
}

/** PUT JSON to a same-origin API path. */
export function putJson<T>(path: string, body?: unknown): Promise<T> {
  return sendJson<T>('PUT', path, body);
}

/** DELETE a same-origin API path. */
export function delJson<T>(path: string): Promise<T> {
  return sendJson<T>('DELETE', path);
}

// ---------------------------------------------------------------------------
// Conversations (phase 36 §3). Shapes from src/chat/conversation-{store,routes}.ts.
// ---------------------------------------------------------------------------

export interface ConversationMeta {
  id: string;
  /** '' until the first message settles; then the clipped first user message. */
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/** GET /api/conversations */
export interface ConversationsResponse {
  conversations: ConversationMeta[];
}

/** POST /api/conversations */
export interface ConversationCreateResponse {
  conversation: ConversationMeta;
  /** Server LRU evictions (50-conversation / 5 MB caps) the client should drop. */
  evictedIds?: string[];
}

/** GET /api/conversations/:id */
export interface ConversationMessagesResponse {
  meta: ConversationMeta;
  messages: UIMessage[];
}

/** PATCH /api/conversations/:id */
export interface ConversationRenameResponse {
  conversation: ConversationMeta;
}

/** PUT /api/conversations/:id/messages */
export interface ConversationPutMessagesResponse {
  meta: ConversationMeta;
  evictedIds?: string[];
}

/** DELETE /api/conversations/:id */
export interface ConversationDeleteResponse {
  ok: boolean;
}

export function listConversations(): Promise<ConversationsResponse> {
  return getJson<ConversationsResponse>('/api/conversations');
}

export function createConversation(): Promise<ConversationCreateResponse> {
  return postJson<ConversationCreateResponse>('/api/conversations', {});
}

export function getConversation(id: string): Promise<ConversationMessagesResponse> {
  return getJson<ConversationMessagesResponse>(`/api/conversations/${encodeURIComponent(id)}`);
}

export function renameConversation(id: string, title: string): Promise<ConversationRenameResponse> {
  return patchJson<ConversationRenameResponse>(`/api/conversations/${encodeURIComponent(id)}`, { title });
}

export function deleteConversation(id: string): Promise<ConversationDeleteResponse> {
  return delJson<ConversationDeleteResponse>(`/api/conversations/${encodeURIComponent(id)}`);
}

/** Persists the full display thread (run cards and genui parts included). */
export function putConversationMessages(
  id: string,
  messages: UIMessage[],
): Promise<ConversationPutMessagesResponse> {
  return putJson<ConversationPutMessagesResponse>(
    `/api/conversations/${encodeURIComponent(id)}/messages`,
    { messages },
  );
}

