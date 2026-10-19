/**
 * Subscription OAuth for SuperGrok / Super Grok Heavy (xAI device-code),
 * ChatGPT Plan (OpenAI PKCE), and Claude Pro/Max (Anthropic consumer PKCE).
 * Tokens live in a 0600 file under ~/.t3mp3st — never in Conf export, never in
 * API responses, never in logs.
 *
 * Inference uses the access token as a Bearer against the provider's public API
 * (api.x.ai / chatgpt.com Codex backend / api.anthropic.com Messages). These are
 * the same public-client flows the official Grok CLI, Codex CLI, and Claude Code
 * install use; T3MP3ST does not mint API keys and never spoofs a CLI identity.
 *
 * The Claude leg is community-sourced and contractually contested (Anthropic bars
 * third-party use of Pro/Max OAuth tokens): every endpoint/client constant is
 * env-overridable, provider refusals surface verbatim-sanitized, and the local
 * `claude` CLI connector (src/agent/local-agents.ts) remains a separate path.
 */

import { createHash, randomBytes } from 'crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

export type OAuthVendor = 'xai' | 'openai' | 'claude';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** OIDC id_token (JWT), when the provider returns one. Never logged; the ChatGPT
   *  adapter decodes its payload (WITHOUT verifying the signature) to derive the
   *  chatgpt-account-id header. */
  idToken?: string;
  expiresAt: number;
  tokenType?: string;
  obtainedAt: number;
  /** Granted scope string, when the provider echoes one. The Claude refresh grant
   *  replays exactly what was granted instead of re-requesting the default. */
  scope?: string;
}

export interface OAuthStatus {
  connected: boolean;
  expiresAt?: number;
  label: string;
  /** Claude only: short plan-tier label (e.g. "Max 20x") derived from the OAuth profile. */
  tier?: string;
  /** Claude only: the stored refresh token is spent/revoked — sign in again. */
  needsReauth?: boolean;
}

export interface XaiDeviceStart {
  flowId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface OpenAiPkceStart {
  flowId: string;
  authorizeUrl: string;
  state: string;
}

export interface ClaudePkceStart {
  flowId: string;
  authorizeUrl: string;
  state: string;
}

export type DevicePollResult =
  | { status: 'pending'; interval: number }
  | { status: 'slow_down'; interval: number }
  | { status: 'authorized' }
  | { status: 'denied'; error: string }
  | { status: 'expired'; error: string };

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

const XAI_ISSUER = 'https://auth.x.ai';
const XAI_DEVICE_CODE_URL = `${XAI_ISSUER}/oauth2/device/code`;
const XAI_TOKEN_URL = `${XAI_ISSUER}/oauth2/token`;
const XAI_DEFAULT_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
const XAI_SCOPE = 'openid profile email offline_access grok-cli:access api:access';
const XAI_ALLOWED_HOSTS = new Set(['auth.x.ai', 'accounts.x.ai']);

// OpenAI / ChatGPT Plan — PKCE with the Codex CLI's public client. The redirect URI is a
// loopback HTTP listener (the CLI's own pattern), NOT an https endpoint — it is pasted/
// captured locally and is deliberately not run through assertHttpsHost.
const OPENAI_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const OPENAI_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const OPENAI_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const OPENAI_DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const OPENAI_SCOPE = 'openid profile email offline_access';
const OPENAI_ALLOWED_HOSTS = new Set(['auth.openai.com', 'chatgpt.com']);

// Claude Pro/Max — consumer PKCE against the Claude Code public client.
// Current Claude Code starts at claude.com/cai/oauth/authorize. Hosts have moved
// before (claude.ai, console.anthropic.com, platform.claude.com), so every value
// is env-overridable: a host move is a config change, not a code change.
// console.anthropic.com stays allowed so operators can repoint to the legacy host.
const CLAUDE_AUTHORIZE_URL = 'https://claude.com/cai/oauth/authorize';
const CLAUDE_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CLAUDE_PROFILE_URL = 'https://api.anthropic.com/api/oauth/profile';
const CLAUDE_DEFAULT_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
// Least privilege: inference plus the profile read the plan-tier label needs —
// deliberately NOT the full CLI scope set (user:sessions:claude_code, …).
const CLAUDE_SCOPE = 'user:inference user:profile';
const CLAUDE_ALLOWED_HOSTS = new Set(['claude.com', 'claude.ai', 'platform.claude.com', 'console.anthropic.com']);
const CLAUDE_PROFILE_ALLOWED_HOSTS = new Set(['api.anthropic.com']);
/** Beta flag the Anthropic token endpoint and OAuth-bearing Messages calls require. */
export const CLAUDE_OAUTH_BETA = 'oauth-2025-04-20';

const DEFAULT_INTERVAL_SEC = 5;
const MIN_INTERVAL_MS = 1000;
const SLOW_DOWN_BUMP_MS = 5000;
const REFRESH_SKEW_MS = 120_000;
const FLOW_TTL_MS = 15 * 60 * 1000;

interface StoreFile {
  xai?: OAuthTokens;
  openai?: OAuthTokens;
  claude?: OAuthTokens;
  /** Derived Claude plan-tier label + check time. Only the derived label is
   *  persisted — the profile's account/email payload is deliberately dropped. */
  claudeTier?: { tier: string; checkedAt: number };
}

interface PendingXai {
  deviceCode: string;
  intervalMs: number;
  expiresAt: number;
}

interface PendingOpenAi {
  verifier: string;
  state: string;
  expiresAt: number;
}

interface PendingClaude {
  verifier: string;
  state: string;
  redirectUri: string;
  expiresAt: number;
}

const pendingXai = new Map<string, PendingXai>();
const pendingOpenAi = new Map<string, PendingOpenAi>();
const pendingClaude = new Map<string, PendingClaude>();
// Claude refresh tokens are single-use and rotate: at most one refresh round-trip in
// flight so concurrent callers share it instead of burning rotations into an
// invalid_grant lockout. xai/openai keep their existing per-call behavior.
let claudeRefreshFlight: Promise<string | undefined> | null = null;
// Set when a Claude refresh fails with invalid_grant-class errors — the "sign in
// again" UI state. Cleared on sign-in and logout.
let claudeNeedsReauth = false;

let storeCache: StoreFile | null = null;
let injectedFetch: FetchLike | undefined;
let nowFn: () => number = () => Date.now();

export function setOAuthFetch(fn: FetchLike | undefined): void {
  injectedFetch = fn;
}

/** Test helper — override the clock. */
export function __setOAuthNow(fn: (() => number) | undefined): void {
  nowFn = fn ?? (() => Date.now());
}

/** Test helper — drop in-memory token cache + pending flows. */
export function __resetOAuthState(): void {
  storeCache = null;
  pendingXai.clear();
  pendingOpenAi.clear();
  pendingClaude.clear();
  claudeRefreshFlight = null;
  claudeNeedsReauth = false;
}

export function oauthStorePath(): string {
  const override = (process.env.T3MP3ST_OAUTH_STORE || '').trim();
  if (override) return override;
  return join(homedir(), '.t3mp3st', 'oauth.json');
}

function xaiClientId(): string {
  return (process.env.T3MP3ST_XAI_OAUTH_CLIENT_ID || '').trim() || XAI_DEFAULT_CLIENT_ID;
}

function openaiClientId(): string {
  return (process.env.T3MP3ST_OPENAI_OAUTH_CLIENT_ID || '').trim() || OPENAI_DEFAULT_CLIENT_ID;
}

function openaiAuthorizeUrl(): string {
  return (process.env.T3MP3ST_OPENAI_OAUTH_AUTHORIZE || '').trim() || OPENAI_AUTHORIZE_URL;
}

function openaiTokenUrl(): string {
  return (process.env.T3MP3ST_OPENAI_OAUTH_TOKEN || '').trim() || OPENAI_TOKEN_URL;
}

function claudeClientId(): string {
  return (process.env.T3MP3ST_CLAUDE_OAUTH_CLIENT_ID || '').trim() || CLAUDE_DEFAULT_CLIENT_ID;
}

function claudeAuthorizeUrl(): string {
  return (process.env.T3MP3ST_CLAUDE_OAUTH_AUTHORIZE || '').trim() || CLAUDE_AUTHORIZE_URL;
}

function claudeTokenUrl(): string {
  return (process.env.T3MP3ST_CLAUDE_OAUTH_TOKEN || '').trim() || CLAUDE_TOKEN_URL;
}

/** Loopback the public client accepts. Env override wins; http loopback is not forced to https. */
function claudeRedirectUri(): string {
  const override = (process.env.T3MP3ST_CLAUDE_OAUTH_REDIRECT_URI || '').trim();
  if (override) return assertClaudeRedirectUri(override);
  const port = process.env.T3MP3ST_PORT || '3333';
  return `http://localhost:${port}/callback`;
}

function assertClaudeRedirectUri(uri: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Claude redirect URI is not a valid URL');
  }
  const host = parsed.hostname.toLowerCase();
  // The public client redirects to this app's loopback. Do not force https there.
  if (parsed.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')) {
    return uri;
  }
  if (parsed.protocol === 'https:') return uri;
  throw new Error('Claude redirect URI must be https, or http on localhost or 127.0.0.1');
}

/** encodeURIComponent emits %20. URLSearchParams would emit '+' and Anthropic rejects that scope. */
function setPercentEncodedQuery(url: URL, params: Array<[string, string]>): void {
  url.search = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function claudeProfileUrl(): string {
  return (process.env.T3MP3ST_CLAUDE_OAUTH_PROFILE || '').trim() || CLAUDE_PROFILE_URL;
}

function assertHttpsHost(url: string, allowed: Set<string>, label: string): URL {
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
  const ok = allowed.has(host) || [...allowed].some((h) => host === h || host.endsWith(`.${h}`));
  if (!ok) {
    throw new Error(`${label} host '${host}' is not an allowed OAuth endpoint`);
  }
  return parsed;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomId(): string {
  return base64url(randomBytes(16));
}

function loadStore(): StoreFile {
  if (storeCache) return storeCache;
  const path = oauthStorePath();
  if (!existsSync(path)) {
    storeCache = {};
    return storeCache;
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as StoreFile;
    storeCache = raw && typeof raw === 'object' ? raw : {};
  } catch {
    storeCache = {};
  }
  return storeCache;
}

function saveStore(next: StoreFile): void {
  storeCache = next;
  const path = oauthStorePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* best-effort on platforms that ignore mode */ }
}

function tokensOf(vendor: OAuthVendor): OAuthTokens | undefined {
  const t = loadStore()[vendor];
  if (!t || typeof t.accessToken !== 'string' || !t.accessToken) return undefined;
  return t;
}

export function peekOAuthAccessToken(vendor: OAuthVendor): string | undefined {
  return tokensOf(vendor)?.accessToken;
}

/** Stored OIDC id_token for a vendor (if the provider returned one). Never logged. */
export function peekOAuthIdToken(vendor: OAuthVendor): string | undefined {
  return tokensOf(vendor)?.idToken;
}

export function hasOAuth(vendor: OAuthVendor): boolean {
  return Boolean(tokensOf(vendor)?.accessToken);
}

export function oauthStatus(): Record<OAuthVendor, OAuthStatus> {
  const xai = tokensOf('xai');
  const openai = tokensOf('openai');
  const claude = tokensOf('claude');
  return {
    xai: {
      connected: Boolean(xai),
      expiresAt: xai?.expiresAt,
      label: 'Super Grok Heavy',
    },
    openai: {
      connected: Boolean(openai),
      expiresAt: openai?.expiresAt,
      label: 'ChatGPT Plan',
    },
    claude: {
      connected: Boolean(claude),
      expiresAt: claude?.expiresAt,
      label: 'Claude Pro/Max',
      tier: claude ? loadStore().claudeTier?.tier : undefined,
      needsReauth: claude && claudeNeedsReauth ? true : undefined,
    },
  };
}

export function clearOAuth(vendor: OAuthVendor): void {
  const store = { ...loadStore() };
  delete store[vendor];
  if (vendor === 'claude') {
    delete store.claudeTier;
    claudeNeedsReauth = false;
  }
  saveStore(store);
}

function persistTokens(vendor: OAuthVendor, tokens: OAuthTokens): void {
  saveStore({ ...loadStore(), [vendor]: tokens });
}

function parseTokenResponse(body: unknown, fallbackRefresh?: string): OAuthTokens {
  const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  const access = typeof rec.access_token === 'string' ? rec.access_token : '';
  if (!access) throw new Error('OAuth token response missing access_token');
  const refresh = typeof rec.refresh_token === 'string' && rec.refresh_token
    ? rec.refresh_token
    : fallbackRefresh;
  // Persist the OIDC id_token when present — the ChatGPT adapter derives the
  // chatgpt-account-id header from it (unverified decode, never logged).
  const idToken = typeof rec.id_token === 'string' && rec.id_token ? rec.id_token : undefined;
  const expiresIn = Number(rec.expires_in);
  const ttlSec = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 6 * 60 * 60;
  return {
    accessToken: access,
    refreshToken: refresh,
    idToken,
    expiresAt: nowFn() + ttlSec * 1000,
    tokenType: typeof rec.token_type === 'string' ? rec.token_type : 'Bearer',
    obtainedAt: nowFn(),
    scope: typeof rec.scope === 'string' && rec.scope ? rec.scope : undefined,
  };
}

async function doFetch(url: string, init: Parameters<FetchLike>[1], fetchImpl?: FetchLike): Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }> {
  const fn = fetchImpl ?? injectedFetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!fn) throw new Error('no fetch implementation available for OAuth');
  return fn(url, init);
}

async function readJson(res: { ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth endpoint returned HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
  }
}

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

function saneIntervalMs(seconds: unknown, fallbackSec = DEFAULT_INTERVAL_SEC): number {
  const n = Number(seconds);
  const sec = Number.isFinite(n) && n > 0 ? n : fallbackSec;
  return Math.max(MIN_INTERVAL_MS, sec * 1000);
}

// =============================================================================
// xAI — RFC 8628 device code (SuperGrok / Super Grok Heavy)
// =============================================================================

export async function startXaiDeviceFlow(opts: { fetchImpl?: FetchLike } = {}): Promise<XaiDeviceStart> {
  assertHttpsHost(XAI_DEVICE_CODE_URL, XAI_ALLOWED_HOSTS, 'xAI device-code URL');
  const res = await doFetch(XAI_DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: formBody({
      client_id: xaiClientId(),
      scope: XAI_SCOPE,
      referrer: 't3mp3st',
    }),
  }, opts.fetchImpl);

  const body = await readJson(res) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof body.error_description === 'string' ? body.error_description
      : typeof body.error === 'string' ? body.error
      : `HTTP ${res.status}`;
    throw new Error(`xAI device-code request failed: ${err}`);
  }

  const deviceCode = typeof body.device_code === 'string' ? body.device_code : '';
  const userCode = typeof body.user_code === 'string' ? body.user_code : '';
  const verificationUri = typeof body.verification_uri === 'string' ? body.verification_uri : '';
  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error('xAI device-code response missing device_code, user_code, or verification_uri');
  }
  const verified = assertHttpsHost(verificationUri, XAI_ALLOWED_HOSTS, 'xAI verification_uri');
  let complete: string | undefined;
  if (typeof body.verification_uri_complete === 'string' && body.verification_uri_complete) {
    const c = assertHttpsHost(body.verification_uri_complete, XAI_ALLOWED_HOSTS, 'xAI verification_uri_complete');
    complete = c.toString();
  }

  const expiresIn = Number(body.expires_in);
  const ttlSec = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 900;
  const intervalMs = saneIntervalMs(body.interval);
  const flowId = randomId();
  pendingXai.set(flowId, {
    deviceCode,
    intervalMs,
    expiresAt: nowFn() + ttlSec * 1000,
  });

  return {
    flowId,
    userCode,
    verificationUri: verified.toString(),
    verificationUriComplete: complete,
    expiresIn: ttlSec,
    interval: Math.round(intervalMs / 1000),
  };
}

export async function pollXaiDeviceFlow(flowId: string, opts: { fetchImpl?: FetchLike } = {}): Promise<DevicePollResult> {
  const pending = pendingXai.get(flowId);
  if (!pending) return { status: 'expired', error: 'unknown or expired SuperGrok login' };
  if (nowFn() > pending.expiresAt) {
    pendingXai.delete(flowId);
    return { status: 'expired', error: 'SuperGrok login timed out — start again' };
  }

  assertHttpsHost(XAI_TOKEN_URL, XAI_ALLOWED_HOSTS, 'xAI token URL');
  const res = await doFetch(XAI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: formBody({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: pending.deviceCode,
      client_id: xaiClientId(),
    }),
  }, opts.fetchImpl);

  const body = await readJson(res) as Record<string, unknown>;
  const err = typeof body.error === 'string' ? body.error : '';

  if (err === 'authorization_pending') {
    return { status: 'pending', interval: Math.round(pending.intervalMs / 1000) };
  }
  if (err === 'slow_down') {
    pending.intervalMs += SLOW_DOWN_BUMP_MS;
    pendingXai.set(flowId, pending);
    return { status: 'slow_down', interval: Math.round(pending.intervalMs / 1000) };
  }
  if (err === 'access_denied') {
    pendingXai.delete(flowId);
    return { status: 'denied', error: 'SuperGrok sign-in was denied' };
  }
  if (err === 'expired_token') {
    pendingXai.delete(flowId);
    return { status: 'expired', error: 'SuperGrok login expired — start again' };
  }
  if (!res.ok || err) {
    pendingXai.delete(flowId);
    const detail = typeof body.error_description === 'string' ? body.error_description : (err || `HTTP ${res.status}`);
    return { status: 'denied', error: detail };
  }

  persistTokens('xai', parseTokenResponse(body));
  pendingXai.delete(flowId);
  return { status: 'authorized' };
}

async function refreshXai(tokens: OAuthTokens, fetchImpl?: FetchLike): Promise<OAuthTokens> {
  if (!tokens.refreshToken) throw new Error('SuperGrok session has no refresh token — sign in again');
  assertHttpsHost(XAI_TOKEN_URL, XAI_ALLOWED_HOSTS, 'xAI token URL');
  const res = await doFetch(XAI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: formBody({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: xaiClientId(),
    }),
  }, fetchImpl);
  const body = await readJson(res);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const detail = typeof rec.error_description === 'string' ? rec.error_description
      : typeof rec.error === 'string' ? rec.error
      : `HTTP ${res.status}`;
    throw new Error(`SuperGrok token refresh failed: ${detail}`);
  }
  return parseTokenResponse(body, tokens.refreshToken);
}

// =============================================================================
// OpenAI — PKCE (ChatGPT Plan, Codex backend public client)
// =============================================================================

function parsePastedAuthCode(raw: string): { code: string; state?: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { code: '' };
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

/** Parses the pasted ChatGPT callback: raw code, code#state, or full callback URL. */
export function parseOpenAiAuthCode(raw: string): { code: string; state?: string } {
  return parsePastedAuthCode(raw);
}

/** Parses a Claude callback: raw code, code#state, or full callback URL. */
export function parseClaudeAuthCode(raw: string): { code: string; state?: string } {
  return parsePastedAuthCode(raw);
}

export async function startOpenAiPkceFlow(): Promise<OpenAiPkceStart> {
  const authorize = assertHttpsHost(openaiAuthorizeUrl(), OPENAI_ALLOWED_HOSTS, 'ChatGPT authorize URL');
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = randomId();
  const flowId = randomId();
  pendingOpenAi.set(flowId, { verifier, state, expiresAt: nowFn() + FLOW_TTL_MS });

  authorize.searchParams.set('client_id', openaiClientId());
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', OPENAI_REDIRECT_URI);
  authorize.searchParams.set('scope', OPENAI_SCOPE);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('state', state);

  return { flowId, authorizeUrl: authorize.toString(), state };
}

export async function completeOpenAiPkceFlow(
  flowId: string,
  rawCode: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<void> {
  const pending = pendingOpenAi.get(flowId);
  if (!pending) throw new Error('unknown or expired ChatGPT login — start again');
  if (nowFn() > pending.expiresAt) {
    pendingOpenAi.delete(flowId);
    throw new Error('ChatGPT login timed out — start again');
  }

  const parsed = parseOpenAiAuthCode(rawCode);
  if (!parsed.code) throw new Error('paste the authorization code from the ChatGPT callback page');
  if (parsed.state && parsed.state !== pending.state) {
    pendingOpenAi.delete(flowId);
    throw new Error('ChatGPT login state mismatch — start again');
  }

  const tokenUrl = assertHttpsHost(openaiTokenUrl(), OPENAI_ALLOWED_HOSTS, 'ChatGPT token URL');
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: openaiClientId(),
      code: parsed.code,
      redirect_uri: OPENAI_REDIRECT_URI,
      code_verifier: pending.verifier,
      state: pending.state,
    }),
  }, opts.fetchImpl);

  const body = await readJson(res);
  pendingOpenAi.delete(flowId);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const detail = typeof rec.error_description === 'string' ? rec.error_description
      : typeof rec.error === 'string' ? rec.error
      : `HTTP ${res.status}`;
    throw new Error(`ChatGPT token exchange failed: ${detail}`);
  }
  persistTokens('openai', parseTokenResponse(body));
}

async function refreshOpenAi(tokens: OAuthTokens, fetchImpl?: FetchLike): Promise<OAuthTokens> {
  if (!tokens.refreshToken) throw new Error('ChatGPT session has no refresh token — sign in again');
  const tokenUrl = assertHttpsHost(openaiTokenUrl(), OPENAI_ALLOWED_HOSTS, 'ChatGPT token URL');
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: openaiClientId(),
      refresh_token: tokens.refreshToken,
    }),
  }, fetchImpl);
  const body = await readJson(res);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const detail = typeof rec.error_description === 'string' ? rec.error_description
      : typeof rec.error === 'string' ? rec.error
      : `HTTP ${res.status}`;
    throw new Error(`ChatGPT token refresh failed: ${detail}`);
  }
  return parseTokenResponse(body, tokens.refreshToken);
}

// =============================================================================
// Claude — PKCE (Claude Pro/Max subscription, Claude Code public client)
// =============================================================================

export async function startClaudePkceFlow(): Promise<ClaudePkceStart> {
  const authorize = assertHttpsHost(claudeAuthorizeUrl(), CLAUDE_ALLOWED_HOSTS, 'Claude authorize URL');
  const redirectUri = claudeRedirectUri();
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = randomId();
  const flowId = randomId();
  pendingClaude.set(flowId, { verifier, state, redirectUri, expiresAt: nowFn() + FLOW_TTL_MS });

  // Do not set code=true. Anthropic's authorize page treats that param as an
  // invalid OAuth request even when response_type and code_challenge are present.
  setPercentEncodedQuery(authorize, [
    ['client_id', claudeClientId()],
    ['response_type', 'code'],
    ['redirect_uri', redirectUri],
    ['scope', CLAUDE_SCOPE],
    ['code_challenge', challenge],
    ['code_challenge_method', 'S256'],
    ['state', state],
  ]);

  return { flowId, authorizeUrl: authorize.toString(), state };
}

/** Pending Claude flow id for a browser callback `state`, if one is still stored. */
export function findClaudeFlowByState(state: string): string | undefined {
  const needle = state.trim();
  if (!needle) return undefined;
  for (const [flowId, pending] of pendingClaude) {
    if (pending.state === needle) return flowId;
  }
  return undefined;
}

export async function completeClaudePkceFlow(
  flowId: string,
  rawCode: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<void> {
  const pending = pendingClaude.get(flowId);
  if (!pending) throw new Error('unknown or expired Claude login — start again');
  if (nowFn() > pending.expiresAt) {
    pendingClaude.delete(flowId);
    throw new Error('Claude login timed out — start again');
  }

  const parsed = parseClaudeAuthCode(rawCode);
  if (!parsed.code) throw new Error('paste the authorization code from the Claude callback page');
  if (parsed.state && parsed.state !== pending.state) {
    pendingClaude.delete(flowId);
    throw new Error('Claude login state mismatch — start again');
  }

  const tokenUrl = assertHttpsHost(claudeTokenUrl(), CLAUDE_ALLOWED_HOSTS, 'Claude token URL');
  // JSON body + the oauth beta header + scope are all load-bearing: form-encoded
  // bodies, a missing scope, or a missing beta header each earn the token endpoint's
  // blanket 429. No claude-cli User-Agent is sent — spoofing gets 404 and is barred
  // regardless (policy: never impersonate Claude Code).
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'anthropic-beta': CLAUDE_OAUTH_BETA,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: claudeClientId(),
      code: parsed.code,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
      state: pending.state,
      scope: CLAUDE_SCOPE,
    }),
  }, opts.fetchImpl);

  const body = await readJson(res);
  pendingClaude.delete(flowId);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const detail = typeof rec.error_description === 'string' ? rec.error_description
      : typeof rec.error === 'string' ? rec.error
      : `HTTP ${res.status}`;
    throw new Error(`Claude token exchange failed: ${detail}`);
  }
  claudeNeedsReauth = false;
  persistTokens('claude', parseTokenResponse(body));
  // Plan tier (Max 20x / Pro / …) — best-effort, once per sign-in: only the derived
  // label is persisted, never the profile's account/email payload. Failure degrades
  // to label-only status.
  try {
    await refreshClaudeTier(opts.fetchImpl);
  } catch {
    /* tier is optional signal, never a sign-in failure */
  }
}

async function refreshClaude(tokens: OAuthTokens, fetchImpl?: FetchLike): Promise<OAuthTokens> {
  if (!tokens.refreshToken) throw new Error('Claude session has no refresh token — sign in again');
  const tokenUrl = assertHttpsHost(claudeTokenUrl(), CLAUDE_ALLOWED_HOSTS, 'Claude token URL');
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'anthropic-beta': CLAUDE_OAUTH_BETA,
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: claudeClientId(),
      refresh_token: tokens.refreshToken,
      scope: tokens.scope ?? CLAUDE_SCOPE,
    }),
  }, fetchImpl);
  const body = await readJson(res);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const error = typeof rec.error === 'string' ? rec.error : '';
    const desc = typeof rec.error_description === 'string' ? rec.error_description : '';
    // A spent or revoked single-use refresh token cannot recover locally — surface
    // the sign-in-again state (rotation race or ~4-week TTL elapsed).
    if (error === 'invalid_grant' || desc.includes('invalid_grant')) claudeNeedsReauth = true;
    const detail = desc || error || `HTTP ${res.status}`;
    throw new Error(`Claude token refresh failed: ${detail}`);
  }
  return parseTokenResponse(body, tokens.refreshToken);
}

/** Exact rate_limit_tier → display label. Unknown tiers pass through verbatim and
 *  the claude_pro family maps to Pro — the plan is never guessed. */
const CLAUDE_TIER_LABELS: Record<string, string> = {
  default_claude_max_20x: 'Max 20x',
  default_claude_max_5x: 'Max 5x',
};

function claudeTierLabel(rawTier: string): string {
  const known = CLAUDE_TIER_LABELS[rawTier];
  if (known) return known;
  if (rawTier.includes('claude_pro')) return 'Pro';
  return rawTier;
}

async function refreshClaudeTier(fetchImpl?: FetchLike): Promise<void> {
  const tokens = tokensOf('claude');
  if (!tokens) return;
  const profileUrl = assertHttpsHost(claudeProfileUrl(), CLAUDE_PROFILE_ALLOWED_HOSTS, 'Claude profile URL');
  const res = await doFetch(profileUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
      'anthropic-beta': CLAUDE_OAUTH_BETA,
    },
  }, fetchImpl);
  if (!res.ok) return; // 429-prone surface — degrade to label-only status
  const body = await readJson(res);
  const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  const org = rec.organization && typeof rec.organization === 'object'
    ? rec.organization as Record<string, unknown>
    : {};
  if (typeof org.rate_limit_tier !== 'string' || !org.rate_limit_tier) return;
  saveStore({ ...loadStore(), claudeTier: { tier: claudeTierLabel(org.rate_limit_tier), checkedAt: nowFn() } });
}

// =============================================================================
// Refresh-on-demand
// =============================================================================

async function refreshOAuthTokens(
  vendor: OAuthVendor,
  tokens: OAuthTokens,
  fetchImpl?: FetchLike,
): Promise<string | undefined> {
  try {
    const next = vendor === 'xai'
      ? await refreshXai(tokens, fetchImpl)
      : vendor === 'claude'
        ? await refreshClaude(tokens, fetchImpl)
        : await refreshOpenAi(tokens, fetchImpl);
    // A refresh response may omit id_token — keep the previously stored one so the
    // ChatGPT account-id derivation survives token rotation. Same for scope: the
    // Claude refresh grant replays exactly what was originally granted.
    persistTokens(vendor, {
      ...next,
      idToken: next.idToken ?? tokens.idToken,
      scope: next.scope ?? tokens.scope,
    });
    return next.accessToken;
  } catch (e) {
    // Keep the existing access token — a 401 on inference is the honest next signal.
    // Do not wipe the store on a transient refresh failure.
    if (tokens.expiresAt > nowFn()) return tokens.accessToken;
    throw e;
  }
}

export async function ensureOAuthAccessToken(
  vendor: OAuthVendor,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<string | undefined> {
  const tokens = tokensOf(vendor);
  if (!tokens) return undefined;
  if (tokens.expiresAt - nowFn() > REFRESH_SKEW_MS) return tokens.accessToken;
  if (vendor !== 'claude') return refreshOAuthTokens(vendor, tokens, opts.fetchImpl);
  // Single-flight (claude only): concurrent callers must share ONE refresh
  // round-trip or the loser burns the rotation and the store is left holding a
  // spent token (invalid_grant lockout).
  if (claudeRefreshFlight) return claudeRefreshFlight;
  const flight = refreshOAuthTokens('claude', tokens, opts.fetchImpl).finally(() => {
    if (claudeRefreshFlight === flight) claudeRefreshFlight = null;
  });
  claudeRefreshFlight = flight;
  return flight;
}

export function oauthVendorForProvider(provider: string): OAuthVendor | undefined {
  if (provider === 'xai') return 'xai';
  if (provider === 'chatgpt') return 'openai';
  if (provider === 'anthropic') return 'claude';
  return undefined;
}
