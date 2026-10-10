/**
 * Subscription OAuth for SuperGrok / Super Grok Heavy (xAI device-code),
 * Claude Pro / Max (Anthropic PKCE), and ChatGPT Plan (OpenAI PKCE). Tokens
 * live in a 0600 file under ~/.t3mp3st — never in Conf export, never in API
 * responses, never in logs.
 *
 * Inference uses the access token as a Bearer against the provider's public API
 * (api.x.ai / api.anthropic.com / chatgpt.com Codex backend). This is the same
 * public-client flow the official Grok CLI, Claude Code, and Codex CLI use;
 * T3MP3ST does not mint API keys.
 */

import { createHash, randomBytes } from 'crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

export type OAuthVendor = 'xai' | 'anthropic' | 'openai';

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
}

export interface OAuthStatus {
  connected: boolean;
  expiresAt?: number;
  label: string;
}

export interface XaiDeviceStart {
  flowId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface AnthropicPkceStart {
  flowId: string;
  authorizeUrl: string;
  state: string;
}

export interface OpenAiPkceStart {
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

const ANTHROPIC_AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const ANTHROPIC_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const ANTHROPIC_REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const ANTHROPIC_DEFAULT_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const ANTHROPIC_SCOPE = 'org:create_api_key user:profile user:inference';
const ANTHROPIC_ALLOWED_HOSTS = new Set([
  'claude.ai',
  'claude.com',
  'console.anthropic.com',
  'platform.claude.com',
  'api.anthropic.com',
]);

// OpenAI / ChatGPT Plan — PKCE with the Codex CLI's public client. The redirect URI is a
// loopback HTTP listener (the CLI's own pattern), NOT an https endpoint — it is pasted/
// captured locally and is deliberately not run through assertHttpsHost.
const OPENAI_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const OPENAI_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const OPENAI_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const OPENAI_DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const OPENAI_SCOPE = 'openid profile email offline_access';
const OPENAI_ALLOWED_HOSTS = new Set(['auth.openai.com', 'chatgpt.com']);

const DEFAULT_INTERVAL_SEC = 5;
const MIN_INTERVAL_MS = 1000;
const SLOW_DOWN_BUMP_MS = 5000;
const REFRESH_SKEW_MS = 120_000;
const FLOW_TTL_MS = 15 * 60 * 1000;

interface StoreFile {
  xai?: OAuthTokens;
  anthropic?: OAuthTokens;
  openai?: OAuthTokens;
}

interface PendingXai {
  deviceCode: string;
  intervalMs: number;
  expiresAt: number;
}

interface PendingAnthropic {
  verifier: string;
  state: string;
  expiresAt: number;
}

interface PendingOpenAi {
  verifier: string;
  state: string;
  expiresAt: number;
}

const pendingXai = new Map<string, PendingXai>();
const pendingAnthropic = new Map<string, PendingAnthropic>();
const pendingOpenAi = new Map<string, PendingOpenAi>();

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
  pendingAnthropic.clear();
  pendingOpenAi.clear();
}

export function oauthStorePath(): string {
  const override = (process.env.T3MP3ST_OAUTH_STORE || '').trim();
  if (override) return override;
  return join(homedir(), '.t3mp3st', 'oauth.json');
}

function xaiClientId(): string {
  return (process.env.T3MP3ST_XAI_OAUTH_CLIENT_ID || '').trim() || XAI_DEFAULT_CLIENT_ID;
}

function anthropicClientId(): string {
  return (process.env.T3MP3ST_ANTHROPIC_OAUTH_CLIENT_ID || '').trim() || ANTHROPIC_DEFAULT_CLIENT_ID;
}

function anthropicAuthorizeUrl(): string {
  return (process.env.T3MP3ST_ANTHROPIC_OAUTH_AUTHORIZE || '').trim() || ANTHROPIC_AUTHORIZE_URL;
}

function anthropicTokenUrl(): string {
  return (process.env.T3MP3ST_ANTHROPIC_OAUTH_TOKEN || '').trim() || ANTHROPIC_TOKEN_URL;
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
  const anthropic = tokensOf('anthropic');
  const openai = tokensOf('openai');
  return {
    xai: {
      connected: Boolean(xai),
      expiresAt: xai?.expiresAt,
      label: 'Super Grok Heavy',
    },
    anthropic: {
      connected: Boolean(anthropic),
      expiresAt: anthropic?.expiresAt,
      label: 'Claude Pro / Max',
    },
    openai: {
      connected: Boolean(openai),
      expiresAt: openai?.expiresAt,
      label: 'ChatGPT Plan',
    },
  };
}

export function clearOAuth(vendor: OAuthVendor): void {
  const store = { ...loadStore() };
  delete store[vendor];
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
// Anthropic — PKCE (Claude Pro / Max, Claude Code public client)
// =============================================================================

export function parseAnthropicAuthCode(raw: string): { code: string; state?: string } {
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

export async function startAnthropicPkceFlow(): Promise<AnthropicPkceStart> {
  const authorize = assertHttpsHost(anthropicAuthorizeUrl(), ANTHROPIC_ALLOWED_HOSTS, 'Claude authorize URL');
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = randomId();
  const flowId = randomId();
  pendingAnthropic.set(flowId, { verifier, state, expiresAt: nowFn() + FLOW_TTL_MS });

  authorize.searchParams.set('client_id', anthropicClientId());
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', ANTHROPIC_REDIRECT_URI);
  authorize.searchParams.set('scope', ANTHROPIC_SCOPE);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('state', state);

  return { flowId, authorizeUrl: authorize.toString(), state };
}

export async function completeAnthropicPkceFlow(
  flowId: string,
  rawCode: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<void> {
  const pending = pendingAnthropic.get(flowId);
  if (!pending) throw new Error('unknown or expired Claude login — start again');
  if (nowFn() > pending.expiresAt) {
    pendingAnthropic.delete(flowId);
    throw new Error('Claude login timed out — start again');
  }

  const parsed = parseAnthropicAuthCode(rawCode);
  if (!parsed.code) throw new Error('paste the authorization code from the Claude callback page');
  if (parsed.state && parsed.state !== pending.state) {
    pendingAnthropic.delete(flowId);
    throw new Error('Claude login state mismatch — start again');
  }

  const tokenUrl = assertHttpsHost(anthropicTokenUrl(), ANTHROPIC_ALLOWED_HOSTS, 'Claude token URL');
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: anthropicClientId(),
      code: parsed.code,
      redirect_uri: ANTHROPIC_REDIRECT_URI,
      code_verifier: pending.verifier,
      state: pending.state,
    }),
  }, opts.fetchImpl);

  const body = await readJson(res);
  pendingAnthropic.delete(flowId);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const detail = typeof rec.error_description === 'string' ? rec.error_description
      : typeof rec.error === 'string' ? rec.error
      : `HTTP ${res.status}`;
    throw new Error(`Claude token exchange failed: ${detail}`);
  }
  persistTokens('anthropic', parseTokenResponse(body));
}

async function refreshAnthropic(tokens: OAuthTokens, fetchImpl?: FetchLike): Promise<OAuthTokens> {
  if (!tokens.refreshToken) throw new Error('Claude session has no refresh token — sign in again');
  const tokenUrl = assertHttpsHost(anthropicTokenUrl(), ANTHROPIC_ALLOWED_HOSTS, 'Claude token URL');
  const res = await doFetch(tokenUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: anthropicClientId(),
      refresh_token: tokens.refreshToken,
    }),
  }, fetchImpl);
  const body = await readJson(res);
  if (!res.ok) {
    const rec = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
    const detail = typeof rec.error_description === 'string' ? rec.error_description
      : typeof rec.error === 'string' ? rec.error
      : `HTTP ${res.status}`;
    throw new Error(`Claude token refresh failed: ${detail}`);
  }
  return parseTokenResponse(body, tokens.refreshToken);
}

// =============================================================================
// OpenAI — PKCE (ChatGPT Plan, Codex backend public client)
// =============================================================================

/** Same parsing contract as the Claude callback: raw code, code#state, or full callback URL. */
export function parseOpenAiAuthCode(raw: string): { code: string; state?: string } {
  return parseAnthropicAuthCode(raw);
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
// Refresh-on-demand
// =============================================================================

export async function ensureOAuthAccessToken(
  vendor: OAuthVendor,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<string | undefined> {
  const tokens = tokensOf(vendor);
  if (!tokens) return undefined;
  if (tokens.expiresAt - nowFn() > REFRESH_SKEW_MS) return tokens.accessToken;
  try {
    const next = vendor === 'xai'
      ? await refreshXai(tokens, opts.fetchImpl)
      : vendor === 'anthropic'
      ? await refreshAnthropic(tokens, opts.fetchImpl)
      : await refreshOpenAi(tokens, opts.fetchImpl);
    // A refresh response may omit id_token — keep the previously stored one so the
    // ChatGPT account-id derivation survives token rotation.
    persistTokens(vendor, { ...next, idToken: next.idToken ?? tokens.idToken });
    return next.accessToken;
  } catch (e) {
    // Keep the existing access token — a 401 on inference is the honest next signal.
    // Do not wipe the store on a transient refresh failure.
    if (tokens.expiresAt > nowFn()) return tokens.accessToken;
    throw e;
  }
}

export function oauthVendorForProvider(provider: string): OAuthVendor | undefined {
  if (provider === 'xai') return 'xai';
  if (provider === 'anthropic') return 'anthropic';
  if (provider === 'chatgpt') return 'openai';
  return undefined;
}

/** Identity prefix Anthropic requires on OAuth-billed Messages API calls. */
export const CLAUDE_OAUTH_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";

export const ANTHROPIC_OAUTH_BETA = 'oauth-2025-04-20';
