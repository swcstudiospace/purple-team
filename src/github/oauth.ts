/**
 * GitHub OAuth App connection (user-owned, env-gated) — phase 35 (SPE-15994).
 *
 * Confidential-client authorization-code flow: PKCE S256 AND client_secret are
 * both sent (GitHub supports PKCE since 2025-07-14 and does not distinguish
 * public/confidential clients). `state` is single-use — consumed BEFORE any
 * network I/O — and bound to the same pending entry as the PKCE verifier.
 *
 * Tokens since 2026-08-14 are expiring by default: 8 h access + 6 mo `ghr_`
 * refresh token, and BOTH rotate on every refresh. Refresh is therefore
 * single-flight (a concurrent second refresh burns the rotation into an
 * invalid_grant lockout). The pair persists atomically in a 0600 JSON store at
 * ~/.t3mp3st/github-oauth.json — separate from the LLM oauth.json because its
 * schema belongs to a different lifecycle (no initLLM() re-init on change).
 *
 * Tokens never leave the server: status()/callback pages/complete responses
 * carry projections only (login, avatarUrl, scopes, expiry epochs).
 */

import { createHash, randomBytes } from 'crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

// =============================================================================
// Types
// =============================================================================

export interface GitHubTokens {
  accessToken: string;
  refreshToken?: string;
  /** ms epoch; absent when the app was registered without expiring tokens. */
  expiresAt?: number;
  refreshTokenExpiresAt?: number;
  tokenType?: string;
  /** Granted scopes, from the token response (e.g. ['repo', 'read:user']). */
  scopes?: string[];
  obtainedAt: number;
}

export interface GitHubProfile {
  login: string;
  avatarUrl?: string;
}

/**
 * Status projection served to clients. No token fields, ever — mirrors the
 * "status has no secrets" invariant of src/llm/oauth.ts. Field name `login`
 * follows the pinned cross-phase contract (.planning/v1.7-EXECUTION-PLAN.md #3),
 * not the design doc's §4.7 `handle` wording.
 */
export interface GitHubStatus {
  configured: boolean;
  connected: boolean;
  /** Derived callback URL — GitHub requires an exact match at registration. */
  redirectUri: string;
  login?: string;
  avatarUrl?: string;
  scopes?: string[];
  expiresAt?: number;
  refreshTokenExpiresAt?: number;
  mode: 'connected' | 'anonymous';
}

export interface GitHubFlowStart {
  authorizeUrl: string;
  state: string;
}

export type GitHubOAuthErrorCode =
  | 'not-configured'
  | 'unknown-state'
  | 'expired-state'
  | 'state-mismatch'
  | 'bad-code'
  | 'exchange-failed'
  | 'token-expired'
  | 'refresh-failed';

export class GitHubOAuthError extends Error {
  readonly code: GitHubOAuthErrorCode;
  readonly httpStatus: number;

  constructor(code: GitHubOAuthErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'GitHubOAuthError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

// =============================================================================
// Constants + env
// =============================================================================

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_ORIGIN = 'https://api.github.com';
// Least privilege that still ships private repos (locked D3): `repo` is the
// only scope that reaches private repositories (no read-only variant exists
// for OAuth Apps) and `read:user` covers the profile response.
const GITHUB_SCOPE = 'repo read:user';
const GITHUB_ALLOWED_HOSTS: Record<string, true> = { 'github.com': true };
const GITHUB_API_ALLOWED_HOSTS: Record<string, true> = { 'api.github.com': true };
const GITHUB_USER_AGENT = 't3mp3st-github-client';

const REFRESH_SKEW_MS = 120_000;
const FLOW_TTL_MS = 15 * 60 * 1000;

interface PendingFlow {
  verifier: string;
  expiresAt: number;
}

interface GitHubStoreFile {
  tokens?: GitHubTokens;
  profile?: GitHubProfile;
}

const pendingFlows = new Map<string, PendingFlow>();
// GitHub refresh tokens rotate on EVERY use — single-flight is mandatory or a
// concurrent loser burns the rotation into an invalid_grant lockout.
let refreshFlight: Promise<string | undefined> | null = null;

let storeCache: GitHubStoreFile | null = null;
let injectedFetch: FetchLike | undefined;
let nowFn: () => number = () => Date.now();

export function setGitHubFetch(fn: FetchLike | undefined): void {
  injectedFetch = fn;
}

/** Test helper — override the clock. */
export function __setGitHubNow(fn: (() => number) | undefined): void {
  nowFn = fn ?? (() => Date.now());
}

/** Test helper — drop in-memory token cache, pending flows, and refresh flight. */
export function __resetGitHubState(): void {
  storeCache = null;
  pendingFlows.clear();
  refreshFlight = null;
}

export function githubStorePath(): string {
  const override = (process.env.T3MP3ST_GITHUB_OAUTH_STORE || '').trim();
  if (override) return override;
  return join(homedir(), '.t3mp3st', 'github-oauth.json');
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(githubClientId() && githubClientSecret());
}

function githubClientId(): string {
  return (process.env.T3MP3ST_GITHUB_OAUTH_CLIENT_ID || '').trim();
}

function githubClientSecret(): string {
  return (process.env.T3MP3ST_GITHUB_OAUTH_CLIENT_SECRET || '').trim();
}

/**
 * Loopback callback by default, derived from the server's own port resolution
 * (`PORT = process.env.T3MP3ST_PORT || 3333`, src/server.ts). When the server
 * is bound non-loopback (T3MP3ST_HOST) or proxied, the operator overrides it
 * verbatim via T3MP3ST_GITHUB_OAUTH_REDIRECT_URI — GitHub exact-string-matches
 * the registered callback URL.
 */
export function githubRedirectUri(): string {
  const override = (process.env.T3MP3ST_GITHUB_OAUTH_REDIRECT_URI || '').trim();
  if (override) return override;
  const port = (process.env.T3MP3ST_PORT || '').trim() || '3333';
  return `http://127.0.0.1:${port}/api/oauth/github/callback`;
}

// =============================================================================
// Shared helpers (mirrors src/llm/oauth.ts)
// =============================================================================

function assertHttpsHost(url: string, allowed: Record<string, true>, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must be https`);
  }
  const host = parsed.hostname.toLowerCase();
  const ok = allowed[host] === true || Object.keys(allowed).some((h) => host === h || host.endsWith(`.${h}`));
  if (!ok) {
    throw new Error(`${label} host '${host}' is not an allowed GitHub endpoint`);
  }
  return parsed;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function loadStore(): GitHubStoreFile {
  if (storeCache) return storeCache;
  const path = githubStorePath();
  if (!existsSync(path)) {
    storeCache = {};
    return storeCache;
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as GitHubStoreFile;
    storeCache = raw && typeof raw === 'object' ? raw : {};
  } catch {
    storeCache = {};
  }
  return storeCache;
}

function saveStore(next: GitHubStoreFile): void {
  storeCache = next;
  const path = githubStorePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* best-effort on platforms that ignore mode */ }
}

function tokensOf(): GitHubTokens | undefined {
  const t = loadStore().tokens;
  if (!t || typeof t.accessToken !== 'string' || !t.accessToken) return undefined;
  return t;
}

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function doFetch(
  url: string,
  init: Parameters<FetchLike>[1],
  fetchImpl?: FetchLike,
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }> {
  const fn = fetchImpl ?? injectedFetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!fn) throw new Error('no fetch implementation available for GitHub OAuth');
  return fn(url, init);
}

async function readJson(res: { ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub endpoint returned HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
  }
}

function errorDetail(body: unknown, status: number): string {
  const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  if (typeof rec.error_description === 'string' && rec.error_description) return rec.error_description;
  if (typeof rec.error === 'string' && rec.error) return rec.error;
  if (typeof rec.message === 'string' && rec.message) return rec.message.slice(0, 180);
  return `HTTP ${status}`;
}

function parseGitHubTokenResponse(body: unknown, fallbackRefresh?: string): GitHubTokens {
  const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  const access = typeof rec.access_token === 'string' ? rec.access_token : '';
  if (!access) throw new GitHubOAuthError('exchange-failed', 'GitHub token response missing access_token');
  const refresh = typeof rec.refresh_token === 'string' && rec.refresh_token
    ? rec.refresh_token
    : fallbackRefresh;
  const expiresIn = Number(rec.expires_in);
  const refreshExpiresIn = Number(rec.refresh_token_expires_in);
  const scopeRaw = typeof rec.scope === 'string' && rec.scope ? rec.scope : '';
  return {
    accessToken: access,
    refreshToken: refresh,
    // Absent expires_in = app registered without expiring tokens: nothing to refresh against.
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? nowFn() + expiresIn * 1000 : undefined,
    refreshTokenExpiresAt: Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0
      ? nowFn() + refreshExpiresIn * 1000
      : undefined,
    tokenType: typeof rec.token_type === 'string' ? rec.token_type : 'bearer',
    scopes: scopeRaw ? scopeRaw.split(/\s+/).filter(Boolean) : undefined,
    obtainedAt: nowFn(),
  };
}

// =============================================================================
// Flow lifecycle
// =============================================================================

export async function startGitHubPkceFlow(): Promise<GitHubFlowStart> {
  if (!isGitHubOAuthConfigured()) {
    throw new GitHubOAuthError(
      'not-configured',
      'GitHub OAuth is not configured — set T3MP3ST_GITHUB_OAUTH_CLIENT_ID/SECRET',
      503,
    );
  }
  const authorize = assertHttpsHost(GITHUB_AUTHORIZE_URL, GITHUB_ALLOWED_HOSTS, 'GitHub authorize URL');
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = base64url(randomBytes(16));
  pendingFlows.set(state, { verifier, expiresAt: nowFn() + FLOW_TTL_MS });

  // Scope is serialized with %20, not '+': GitHub's authorize endpoint expects
  // RFC 3986 encoding for the scope parameter (space-encoded per its docs).
  const params = new URLSearchParams({
    client_id: githubClientId(),
    response_type: 'code',
    redirect_uri: githubRedirectUri(),
    scope: GITHUB_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const query = params.toString().replace(/\+/g, '%20');
  return { authorizeUrl: `${authorize.origin}${authorize.pathname}?${query}`, state };
}

/** Parses the pasted GitHub callback: raw code, code#state, or full callback URL. */
export function parseGitHubAuthCode(raw: string): { code: string; state?: string } {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const code = u.searchParams.get('code') || '';
    const state = u.searchParams.get('state') || (u.hash.startsWith('#') ? u.hash.slice(1) : '') || undefined;
    if (code) return { code, state: state || undefined };
  } catch {
    /* not a URL — treat as code[#state] */
  }
  const hash = trimmed.split('#');
  if (hash.length >= 2) return { code: hash[0], state: hash.slice(1).join('#') };
  return { code: trimmed };
}

/**
 * Consume a pending flow state without exchanging (the user clicked Deny on
 * GitHub's consent page — the state is still spent so it cannot be replayed).
 */
export function consumeGitHubFlowState(state: string | undefined): void {
  if (state) pendingFlows.delete(state);
}

export async function completeGitHubFlow(
  rawState: string | undefined,
  rawCode: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<GitHubStatus> {
  if (!isGitHubOAuthConfigured()) {
    throw new GitHubOAuthError(
      'not-configured',
      'GitHub OAuth is not configured — set T3MP3ST_GITHUB_OAUTH_CLIENT_ID/SECRET',
      503,
    );
  }
  const parsed = parseGitHubAuthCode(rawCode);
  if (!parsed.code) {
    throw new GitHubOAuthError('bad-code', 'paste the authorization code from the GitHub callback page');
  }
  const state = (rawState && rawState.trim()) || parsed.state || '';
  if (!state) {
    throw new GitHubOAuthError('state-mismatch', 'GitHub sign-in state missing — start again');
  }
  const pending = pendingFlows.get(state);
  // Single-use: consumed BEFORE any network I/O, so a replay racing the real
  // exchange cannot succeed. The state doubles as the pending-map key, binding
  // the CSRF token and the PKCE verifier to the same flow entry.
  pendingFlows.delete(state);
  if (!pending) {
    throw new GitHubOAuthError('unknown-state', 'unknown or expired GitHub sign-in — start again');
  }
  if (nowFn() > pending.expiresAt) {
    throw new GitHubOAuthError('expired-state', 'GitHub sign-in timed out — start again');
  }

  const tokenUrl = assertHttpsHost(GITHUB_TOKEN_URL, GITHUB_ALLOWED_HOSTS, 'GitHub token URL');
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': GITHUB_USER_AGENT,
    },
    body: formBody({
      client_id: githubClientId(),
      client_secret: githubClientSecret(),
      code: parsed.code,
      redirect_uri: githubRedirectUri(),
      code_verifier: pending.verifier,
    }),
  }, opts.fetchImpl);

  const body = await readJson(res);
  if (!res.ok) {
    throw new GitHubOAuthError('exchange-failed', `GitHub token exchange failed: ${errorDetail(body, res.status)}`);
  }
  const tokens = parseGitHubTokenResponse(body);

  // One GET /user at connect caches { login, avatarUrl } locally — status is
  // pure store-read afterwards (zero GitHub API calls). Best-effort: a failed
  // profile read still connects (the token is the connection; the handle is UX).
  const profile = await fetchProfileAtConnect(tokens.accessToken, opts.fetchImpl);
  saveStore({ tokens, profile });
  return githubStatus();
}

async function fetchProfileAtConnect(accessToken: string, fetchImpl?: FetchLike): Promise<GitHubProfile | undefined> {
  try {
    const url = assertHttpsHost(`${GITHUB_API_ORIGIN}/user`, GITHUB_API_ALLOWED_HOSTS, 'GitHub user URL');
    const res = await doFetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': GITHUB_USER_AGENT,
      },
    }, fetchImpl);
    if (!res.ok) return undefined;
    const body = (await readJson(res)) as Record<string, unknown>;
    const login = typeof body.login === 'string' && body.login ? body.login : '';
    if (!login) return undefined;
    return {
      login,
      avatarUrl: typeof body.avatar_url === 'string' && body.avatar_url ? body.avatar_url : undefined,
    };
  } catch {
    return undefined;
  }
}

// =============================================================================
// Status / store / disconnect
// =============================================================================

export function githubStatus(): GitHubStatus {
  const store = loadStore();
  const tokens = store.tokens && store.tokens.accessToken ? store.tokens : undefined;
  return {
    configured: isGitHubOAuthConfigured(),
    connected: Boolean(tokens),
    redirectUri: githubRedirectUri(),
    login: store.profile?.login,
    avatarUrl: store.profile?.avatarUrl,
    scopes: tokens?.scopes,
    expiresAt: tokens?.expiresAt,
    refreshTokenExpiresAt: tokens?.refreshTokenExpiresAt,
    mode: tokens ? 'connected' : 'anonymous',
  };
}

/** D5 accessor: the ONLY way ingest code reads the connected token. No refresh. */
export function peekGitHubAccessToken(): string | undefined {
  return tokensOf()?.accessToken;
}

export function clearGitHubOAuth(): void {
  saveStore({});
}

/**
 * Disconnect: best-effort `DELETE /applications/{client_id}/grant` (Basic
 * client credentials) revokes every token of this app for the user and
 * unpins it from their GitHub settings — then the local store is cleared
 * UNCONDITIONALLY. Remote revocation is opportunistic; local disconnection
 * is the guarantee (network failure / 401 / 404 still yields a clean local
 * logout).
 */
export async function disconnectGitHub(opts: { fetchImpl?: FetchLike } = {}): Promise<void> {
  const tokens = tokensOf();
  if (tokens && isGitHubOAuthConfigured()) {
    try {
      const url = assertHttpsHost(
        `${GITHUB_API_ORIGIN}/applications/${encodeURIComponent(githubClientId())}/grant`,
        GITHUB_API_ALLOWED_HOSTS,
        'GitHub grant URL',
      );
      const basic = Buffer.from(`${githubClientId()}:${githubClientSecret()}`).toString('base64');
      await doFetch(url.toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': GITHUB_USER_AGENT,
        },
        body: JSON.stringify({ access_token: tokens.accessToken }),
      }, opts.fetchImpl);
    } catch {
      /* best-effort — the unconditional clear below is the contract */
    }
  }
  clearGitHubOAuth();
}

// =============================================================================
// Refresh (mandatory: 8 h tokens, rotating ghr_ refresh)
// =============================================================================

async function doRefreshGitHubTokens(tokens: GitHubTokens, fetchImpl?: FetchLike): Promise<string> {
  if (!tokens.refreshToken) {
    // Non-expiring app or refresh never issued: nothing to refresh against.
    // If the access token is already past its expiry, surface reconnect now.
    if (tokens.expiresAt !== undefined && tokens.expiresAt <= nowFn()) {
      throw new GitHubOAuthError('token-expired', 'GitHub session expired — reconnect the account', 401);
    }
    return tokens.accessToken;
  }
  const tokenUrl = assertHttpsHost(GITHUB_TOKEN_URL, GITHUB_ALLOWED_HOSTS, 'GitHub token URL');
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': GITHUB_USER_AGENT,
    },
    body: formBody({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: githubClientId(),
      client_secret: githubClientSecret(),
    }),
  }, fetchImpl);

  const body = await readJson(res);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const error = typeof rec.error === 'string' ? rec.error : '';
    // GitHub says bad_refresh_token for a spent/revoked rotation; OAuth-native
    // name for the same class. Only a DEFINITIVE rejection clears the store —
    // transient failures keep the (already unusable-old-refresh) pair so a
    // retry can still land, and the next honest signal is the API 401.
    if (error === 'bad_refresh_token' || error === 'invalid_grant' || error === 'refresh_token_expired') {
      clearGitHubOAuth();
      throw new GitHubOAuthError('token-expired', 'GitHub session expired — reconnect the account', 401);
    }
    throw new GitHubOAuthError('refresh-failed', `GitHub token refresh failed: ${errorDetail(body, res.status)}`, 502);
  }
  const next = parseGitHubTokenResponse(body, tokens.refreshToken);
  // Atomic rotation: the new pair (and the surviving profile) land in ONE
  // store write; scope survives when the refresh response omits it.
  saveStore({
    tokens: { ...next, scopes: next.scopes ?? tokens.scopes },
    profile: loadStore().profile,
  });
  return next.accessToken;
}

function launchRefreshFlight(tokens: GitHubTokens, fetchImpl?: FetchLike): Promise<string | undefined> {
  // Single-flight: concurrent callers share ONE refresh round-trip or the
  // loser burns the rotation and the store is left holding a spent token.
  if (refreshFlight) return refreshFlight;
  const flight = doRefreshGitHubTokens(tokens, fetchImpl)
    .finally(() => {
      if (refreshFlight === flight) refreshFlight = null;
    });
  refreshFlight = flight;
  return flight;
}

/**
 * Refresh-on-demand with 120 s skew (src/llm/oauth.ts precedent). Called by
 * the proxy routes before their upstream call and by any server-side consumer
 * of the connected token (ingest uses peekGitHubAccessToken, not this).
 */
export async function ensureGitHubAccessToken(opts: { fetchImpl?: FetchLike } = {}): Promise<string | undefined> {
  const tokens = tokensOf();
  if (!tokens) return undefined;
  if (tokens.expiresAt === undefined || tokens.expiresAt - nowFn() > REFRESH_SKEW_MS) {
    return tokens.accessToken;
  }
  return launchRefreshFlight(tokens, opts.fetchImpl);
}

/**
 * Forced refresh for the classifier's auto-refresh-once path: the stored token
 * looks fine locally but GitHub answered 401/403-auth (revoked mid-session).
 * Shares the same single-flight as ensureGitHubAccessToken.
 */
export async function forceGitHubTokenRefresh(opts: { fetchImpl?: FetchLike } = {}): Promise<string | undefined> {
  const tokens = tokensOf();
  if (!tokens) return undefined;
  return launchRefreshFlight(tokens, opts.fetchImpl);
}

// =============================================================================
// Callback result page (tiny static HTML — no tokens, no JSON)
// =============================================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The GET /api/oauth/github/callback landing page. Pure string builder so the
 * no-secrets invariant is unit-testable without booting the server. Every
 * interpolated value (login, upstream message) is HTML-escaped.
 */
export function githubCallbackPage(
  kind: 'connected' | 'denied' | 'expired' | 'failed',
  detail: { login?: string; message?: string } = {},
): string {
  const title = kind === 'connected'
    ? 'GitHub connected'
    : kind === 'denied'
      ? 'Connection cancelled'
      : kind === 'expired'
        ? 'Sign-in link expired'
        : 'GitHub sign-in failed';
  const body = kind === 'connected'
    ? `&#10003; Connected as @${escapeHtml(detail.login ?? 'unknown')} — return to Purple Team.`
    : kind === 'denied'
      ? 'Connection cancelled. Close this tab and connect again from the Purple Team GitHub page when ready.'
      : kind === 'expired'
        ? 'Sign-in link expired — start again from the Purple Team GitHub page.'
        : `${escapeHtml(detail.message ?? 'GitHub sign-in failed.')}`;
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    `<title>${title}</title></head>`,
    '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;">',
    `<h1>${title}</h1>`,
    `<p>${body}</p>`,
    '<p><a href="/#/github">Return to Purple Team</a></p>',
    '</body></html>',
  ].join('');
}
