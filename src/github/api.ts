/**
 * GitHub REST client + shared error classifier for the server-side repo proxy
 * (phase 35, SPE-15994) — and the credential seam the phase-35 ingest adapter
 * composes with `peekGitHubAccessToken` from ./oauth.ts.
 *
 * Design invariants (35-RESEARCH-GITHUB-SECTION.md §4.8):
 * - Every upstream call is ONE request per user action (plus at most one
 *   forced refresh via onAuthFailure): the proxy never auto-retries, so it
 *   cannot trip GitHub's secondary limits by itself.
 * - Rate-limit classification follows GitHub's documented precedence:
 *   `Retry-After` (secondary) → `x-ratelimit-reset` (primary) → 60 s floor.
 * - 60 s in-memory LRU caches (repositories keyed by token fingerprint,
 *   resolve keyed by owner/repo/ref/mode) protect the anonymous 60 req/h
 *   budget and repeated resolve clicks.
 * - Error payloads are token-free by construction: status codes, classified
 *   codes, and retry epochs only.
 */

import { createHash } from 'crypto';

// =============================================================================
// Errors + classifier
// =============================================================================

export type GitHubApiErrorCode =
  | 'invalid-url'
  | 'token-expired'
  | 'rate-limited'
  | 'repo-not-found'
  | 'repo-not-found-or-private'
  | 'network-error';

export class GitHubApiError extends Error {
  readonly code: GitHubApiErrorCode;
  readonly httpStatus: number;
  /** ms epoch after which the request may be retried (rate-limited only). */
  readonly retryAt?: number;

  constructor(code: GitHubApiErrorCode, message: string, httpStatus: number, retryAt?: number) {
    super(message);
    this.name = 'GitHubApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryAt = retryAt;
  }
}

// =============================================================================
// Fetch plumbing
// =============================================================================

export interface GitHubFetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export type GitHubFetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<GitHubFetchResponse>;

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_ALLOWED_HOSTS: Record<string, true> = { 'api.github.com': true };
const GITHUB_USER_AGENT = 't3mp3st-github-client';
// Doc'd examples pin both 2022-11-28 and 2026-03-10; the newer version is the
// recommendation (§10.1) with an env escape hatch if GitHub retires it.
const GITHUB_API_VERSION = (process.env.T3MP3ST_GITHUB_API_VERSION || '').trim() || '2026-03-10';

let injectedFetch: GitHubFetchLike | undefined;

/** Server wires the proxy-bypassing fetch here (same pattern as setOAuthFetch). */
export function setGitHubApiFetch(fn: GitHubFetchLike | undefined): void {
  injectedFetch = fn;
}

/** Test helper — drop the injected fetch and both 60 s caches. */
export function __resetGitHubApiState(): void {
  injectedFetch = undefined;
  repoPageCache.clear();
  resolveCache.clear();
}

function assertApiUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || GITHUB_API_ALLOWED_HOSTS[parsed.hostname.toLowerCase()] !== true) {
    throw new GitHubApiError('network-error', 'GitHub API endpoint host is not allowed', 502);
  }
  return parsed;
}

interface ApiCallResult {
  body: unknown;
  headers: { get(name: string): string | null };
}

async function ghApiGet(path: string, token: string | undefined, fetchImpl?: GitHubFetchLike): Promise<ApiCallResult> {
  const url = assertApiUrl(`${GITHUB_API_BASE}${path}`);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': GITHUB_USER_AGENT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const fn = fetchImpl ?? injectedFetch ?? (globalThis.fetch as unknown as GitHubFetchLike | undefined);
  if (!fn) throw new GitHubApiError('network-error', 'no fetch implementation available for GitHub', 502);

  let res: GitHubFetchResponse;
  try {
    res = await fn(url.toString(), { method: 'GET', headers });
  } catch (e) {
    throw new GitHubApiError('network-error', `GitHub request failed: ${(e as Error).message}`, 502);
  }
  if (res.status >= 500) {
    throw new GitHubApiError('network-error', `GitHub returned HTTP ${res.status}`, 502);
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw classifyGitHubFailure(res.status, res.headers, bodyText, token ? 'token' : 'anonymous');
  }
  try {
    return { body: await res.json(), headers: res.headers };
  } catch {
    throw new GitHubApiError('network-error', `GitHub returned a non-JSON body (HTTP ${res.status})`, 502);
  }
}

function upstreamMessage(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message.slice(0, 180);
  } catch {
    /* non-JSON error body — fall through to the generic message */
  }
  return '';
}

/**
 * Maps an upstream failure onto the proxy's HTTP surface (§4.8 table).
 * Order is GitHub's documented retry precedence; a 403 with NO rate-limit
 * markers is a permission/credential problem (org OAuth restrictions, revoked
 * token), not a rate limit, and is classified auth — surfaced 401.
 */
export function classifyGitHubFailure(
  status: number,
  headers: { get(name: string): string | null },
  bodyText: string,
  mode: 'token' | 'anonymous',
): GitHubApiError {
  if (status === 403 || status === 429) {
    const retryAfterRaw = (headers.get('retry-after') || '').trim();
    const remaining = (headers.get('x-ratelimit-remaining') || '').trim();
    const resetRaw = (headers.get('x-ratelimit-reset') || '').trim();
    const retryAfterSec = Number(retryAfterRaw);
    const resetEpoch = Number(resetRaw);
    let retryAt: number | undefined;
    if (retryAfterRaw && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      retryAt = Date.now() + retryAfterSec * 1000;
    } else if (remaining === '0' && resetRaw && Number.isFinite(resetEpoch) && resetEpoch > 0) {
      retryAt = resetEpoch * 1000;
    }
    // A 429 is definitionally a rate limit even when GitHub omits both headers
    // — fall back to the documented 60 s floor.
    if (retryAt !== undefined || remaining === '0' || status === 429) {
      return new GitHubApiError(
        'rate-limited',
        `GitHub rate limit reached — retry at ${new Date(retryAt ?? Date.now() + 60_000).toISOString()}`,
        429,
        retryAt ?? Date.now() + 60_000,
      );
    }
    const upstream = upstreamMessage(bodyText);
    return new GitHubApiError(
      'token-expired',
      `GitHub rejected the request${upstream ? `: ${upstream}` : ' — reconnect the account'}`,
      401,
    );
  }
  if (status === 401) {
    return new GitHubApiError('token-expired', 'GitHub rejected the credentials — reconnect the account', 401);
  }
  if (status === 404) {
    // GitHub deliberately 404s private repos you cannot see: anonymous misses
    // get the connect hint; connected misses are definitive (repo scope sees
    // every repo the account can access).
    return mode === 'anonymous'
      ? new GitHubApiError('repo-not-found-or-private', 'Not found. If this repository is private, connect a GitHub account.', 404)
      : new GitHubApiError('repo-not-found', 'Repository not found (or your account has no access)', 404);
  }
  return new GitHubApiError('network-error', `GitHub request failed with HTTP ${status}`, 502);
}

// =============================================================================
// 60 s LRU caches
// =============================================================================

const CACHE_TTL_MS = 60_000;
const REPOS_CACHE_MAX = 10;
const RESOLVE_CACHE_MAX = 50;

interface CacheEntry<T> {
  at: number;
  value: T;
}

const repoPageCache = new Map<string, CacheEntry<GitHubRepoPage>>();
const resolveCache = new Map<string, CacheEntry<GitHubRepoResolution>>();

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // LRU refresh: re-insert so eviction order follows recency.
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cachePut<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, max: number): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  while (cache.size > max) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Stable non-reversible key fragment: cache keys never contain the token. */
function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12);
}

// =============================================================================
// Response mapping
// =============================================================================

type RepoRecord = Record<string, unknown>;

function repoVisibilityOf(rec: RepoRecord): 'public' | 'private' | 'internal' {
  const v = rec.visibility;
  return v === 'private' || v === 'internal' ? v : 'public';
}

function defaultBranchOf(rec: RepoRecord): string {
  // Empty repositories have no default branch — HEAD is GitHub's own sentinel
  // for "the default branch, whatever it is".
  return typeof rec.default_branch === 'string' && rec.default_branch ? rec.default_branch : 'HEAD';
}

function ownerLoginOf(rec: RepoRecord): string {
  const owner = rec.owner as Record<string, unknown> | undefined;
  if (owner && typeof owner.login === 'string' && owner.login) return owner.login;
  const fullName = typeof rec.full_name === 'string' ? rec.full_name : '';
  return fullName.split('/')[0] ?? '';
}

function summaryOf(rec: RepoRecord): GitHubRepoSummary {
  const name = typeof rec.name === 'string' && rec.name ? rec.name : '';
  const fullName = typeof rec.full_name === 'string' && rec.full_name ? rec.full_name : '';
  const summary = {
    owner: ownerLoginOf(rec),
    repo: name || fullName.split('/')[1] || '',
    fullName,
    description: typeof rec.description === 'string' && rec.description ? rec.description : undefined,
    visibility: repoVisibilityOf(rec),
    private: rec.private === true,
    defaultBranch: defaultBranchOf(rec),
    pushedAt: typeof rec.pushed_at === 'string' && rec.pushed_at ? rec.pushed_at : undefined,
    htmlUrl: typeof rec.html_url === 'string' && rec.html_url ? rec.html_url : '',
  };
  if (!summary.owner || !summary.repo) {
    throw new GitHubApiError('network-error', 'GitHub repository response missing owner/name', 502);
  }
  return summary;
}

// =============================================================================
// GET /user/repos — connected-only listing (pagination proxy)
// =============================================================================

export interface GitHubRepoSummary {
  owner: string;
  repo: string;
  fullName: string;
  description?: string;
  visibility: 'public' | 'private' | 'internal';
  private: boolean;
  defaultBranch: string;
  pushedAt?: string;
  htmlUrl: string;
}

export interface GitHubRepoPage {
  repositories: GitHubRepoSummary[];
  page: number;
  perPage: number;
  hasNext: boolean;
}

const LIST_VISIBILITIES: Record<string, true> = { all: true, public: true, private: true };

export async function listGitHubRepos(params: {
  token: string;
  page?: number;
  perPage?: number;
  visibility?: string;
  fetchImpl?: GitHubFetchLike;
  /** Forced-refresh seam: called once when GitHub answers 401/403-auth. */
  onAuthFailure?: () => Promise<string | undefined>;
}): Promise<GitHubRepoPage> {
  const page = Number.isFinite(params.page) && (params.page as number) >= 1 ? Math.floor(params.page as number) : 1;
  const rawPerPage = Number.isFinite(params.perPage) ? Math.floor(params.perPage as number) : 30;
  const perPage = Math.min(100, Math.max(1, rawPerPage));
  const visibility = params.visibility && LIST_VISIBILITIES[params.visibility] ? params.visibility : 'all';

  const cacheKey = `repos:${tokenFingerprint(params.token)}:${visibility}:${perPage}:${page}`;
  const cached = cacheGet(repoPageCache, cacheKey);
  if (cached) return { ...cached, repositories: cached.repositories.map((r) => ({ ...r })) };

  // `type` is deliberately NEVER sent: GitHub 422s it combined with
  // visibility/affiliation, and affiliation=owner,collaborator,organization_
  // member is already the full default matrix.
  const query = new URLSearchParams({
    visibility,
    affiliation: 'owner,collaborator,organization_member',
    sort: 'updated',
    direction: 'desc',
    per_page: String(perPage),
    page: String(page),
  });

  let result: ApiCallResult;
  try {
    result = await ghApiGet(`/user/repos?${query.toString()}`, params.token, params.fetchImpl);
  } catch (e) {
    const fresh = await refreshedTokenAfterAuthFailure(e, params.token, params.onAuthFailure);
    if (!fresh) throw e;
    result = await ghApiGet(`/user/repos?${query.toString()}`, fresh, params.fetchImpl);
  }

  if (!Array.isArray(result.body)) {
    throw new GitHubApiError('network-error', 'GitHub /user/repos returned a non-array body', 502);
  }
  const repositories = (result.body as unknown[])
    .filter((raw): raw is RepoRecord => Boolean(raw) && typeof raw === 'object')
    .map(summaryOf);
  // Pagination signal is the Link header: rel="next" present ⇒ another page.
  const link = result.headers.get('link') || '';
  const value: GitHubRepoPage = { repositories, page, perPage, hasNext: /rel="next"/.test(link) };
  cachePut(repoPageCache, cacheKey, value, REPOS_CACHE_MAX);
  return { ...value, repositories: repositories.map((r) => ({ ...r })) };
}

// =============================================================================
// GET /repos/{owner}/{repo} — resolve (tokened | anonymous)
// =============================================================================

export interface GitHubRepoResolution {
  owner: string;
  repo: string;
  /** Explicit ref from the URL when present, else the default branch. */
  ref: string;
  defaultBranch: string;
  fullName: string;
  visibility: 'public' | 'private' | 'internal';
  private: boolean;
  cloneUrl: string;
  htmlUrl: string;
  pushedAt?: string;
  accessible: 'token' | 'anonymous';
}

export async function resolveGitHubRepo(params: {
  owner: string;
  repo: string;
  ref?: string;
  token?: string;
  fetchImpl?: GitHubFetchLike;
  onAuthFailure?: () => Promise<string | undefined>;
}): Promise<GitHubRepoResolution> {
  const mode = params.token ? 'token' : 'anonymous';
  const cacheKey = `resolve:${mode}:${params.owner}/${params.repo}@${params.ref ?? ''}`;
  const cached = cacheGet(resolveCache, cacheKey);
  if (cached) return { ...cached };

  const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}`;
  const fetchWith = (token: string | undefined) => ghApiGet(path, token, params.fetchImpl);

  let result: ApiCallResult;
  try {
    result = await fetchWith(params.token);
  } catch (e) {
    const fresh = await refreshedTokenAfterAuthFailure(e, params.token, params.onAuthFailure);
    if (!fresh) throw e;
    result = await fetchWith(fresh);
  }

  const rec = (result.body && typeof result.body === 'object') ? result.body as RepoRecord : {};
  const s = summaryOf(rec);
  // The resolve surface is exactly GitHubRepoResolution — summary-only extras
  // like `description` must not leak into the resolve response shape.
  const value: GitHubRepoResolution = {
    owner: s.owner,
    repo: s.repo,
    ref: params.ref || s.defaultBranch,
    defaultBranch: s.defaultBranch,
    fullName: s.fullName,
    visibility: s.visibility,
    private: s.private,
    cloneUrl: typeof rec.clone_url === 'string' && rec.clone_url ? rec.clone_url : '',
    htmlUrl: s.htmlUrl,
    accessible: mode,
  };
  if (s.pushedAt) value.pushedAt = s.pushedAt;
  cachePut(resolveCache, cacheKey, value, RESOLVE_CACHE_MAX);
  return { ...value };
}

/**
 * Auto-refresh-once seam (§4.8): on a token-expired classification with a
 * connected token, ask the caller for a forced refresh and retry with the
 * fresh value. Any other outcome rethrows the original classified error.
 */
async function refreshedTokenAfterAuthFailure(
  e: unknown,
  token: string | undefined,
  onAuthFailure: (() => Promise<string | undefined>) | undefined,
): Promise<string | undefined> {
  if (!(e instanceof GitHubApiError) || e.code !== 'token-expired') return undefined;
  if (!token || !onAuthFailure) return undefined;
  const fresh = await onAuthFailure();
  return fresh && fresh !== token ? fresh : undefined;
}

// =============================================================================
// URL parsing for GET /api/github/resolve
// =============================================================================

export interface ParsedGitHubRepoUrl {
  owner: string;
  repo: string;
  ref?: string;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_RE = /^(?!-)(?!\.)(?!.*[.-]$)[A-Za-z0-9._-]{1,100}$/;
const MAX_REF_LENGTH = 255;

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x1f) return true;
  }
  return false;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Accepts `https://github.com/owner/repo`, `github.com/owner/repo`,
 * `owner/repo`, optional `.git` suffix, and `/tree/<ref>` / `/blob/<ref>/…`
 * suffixes (ref extracted, URL-decoded — branch slashes arrive %2F-encoded).
 * Clone URLs normalize to owner/repo. Everything else is invalid.
 */
export function parseGitHubRepoUrl(raw: string): ParsedGitHubRepoUrl | null {
  const input = raw.trim();
  if (!input || input.length > 2048) return null;

  let path: string;
  if (/^https?:\/\//i.test(input)) {
    // Dot segments (., ..) are collapsed by the URL parser before we ever see
    // the pathname (`/tree/..` normalizes to `/`), so screen the raw path up
    // front instead of trusting the already-normalized result.
    const rawSegments = input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[?#]/)[0].split('/');
    if (rawSegments.includes('.') || rawSegments.includes('..')) return null;
    let u: URL;
    try {
      u = new URL(input);
    } catch {
      return null;
    }
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') return null;
    if (u.username || u.password) return null; // embedded credentials never round-trip
    path = u.pathname;
  } else {
    const firstSegment = input.split('/')[0]?.toLowerCase() ?? '';
    if (firstSegment === 'github.com' || firstSegment === 'www.github.com') {
      path = input.slice(firstSegment.length);
    } else if (firstSegment.includes('.')) {
      return null; // some other host (gist.github.com, api.github.com, …)
    } else {
      path = `/${input}`; // bare owner/repo form
    }
  }

  const segments = path.split('/').filter((s) => s.length > 0);
  let ref: string | undefined;
  if (segments.length >= 4 && (segments[2] === 'tree' || segments[2] === 'blob')) {
    // /owner/repo/tree/<ref…> — everything after the view word is the ref
    // (subdirectories are not part of the resolve contract).
    ref = safeDecode(segments.slice(3).join('/'));
    segments.length = 2;
  }
  if (segments.length !== 2) return null;

  const owner = safeDecode(segments[0]);
  let repo = safeDecode(segments[1]);
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);
  if (!OWNER_RE.test(owner) || owner.includes('--') || !REPO_RE.test(repo)) return null;
  if (ref !== undefined && (ref === '' || ref.startsWith('/') || ref.includes('..') || ref.length > MAX_REF_LENGTH || hasControlChars(ref))) {
    return null;
  }
  return { owner, repo, ref: ref || undefined };
}
