/**
 * github-ingest — phase 35 repo-URL fetch adapter.
 *
 * Turns a parsed GitHub repo URL (recon/repo-url.ts) into `SourceFileInput[]`
 * for the in-memory whitebox seam (`ingestFetchedFilesToSourceContext`):
 *
 *   validator → fetch plan → streamed codeload tarball → skip engine → files
 *
 * Fetch strategy (35-CONTEXT §3.2, live-verified): ONE streamed tarball.
 *   anonymous: https://codeload.github.com/{owner}/{repo}/tar.gz/{ref}
 *   authed:    https://api.github.com/repos/{owner}/{repo}/tarball/{ref}
 *              → 302 to a presigned codeload URL (consumes one core-quota
 *              request; never auto-hammered on failure).
 * The tarball root dir is `{repo}-{ref}/` (ref literal, `/`→`-` sanitized by
 * GitHub) preceded by a `pax_global_header` entry — tar-stream consumes pax/GNU
 * meta-records itself, and the root is stripped by FIRST SEGMENT so any ref
 * form (branch, slash-branch, tag, 40-hex SHA) resolves identically.
 *
 * SECURITY posture (35-CONTEXT §4):
 *   - Per-hop SSRF origin allowlist; `redirect: 'manual'`, max 5 hops; every
 *     hop must be https and on a GitHub fetch host. The Bearer token is
 *     attached ONLY when the next hop host is api.github.com — never re-sent
 *     to codeload/raw (the redirect URL is presigned).
 *   - Errors are constructed token-free (host/status/code only).
 *   - One AbortController per ingest (runGuardedTool composition): wall-clock
 *     timer + linked caller signal; cap breaches and cancellation tear the
 *     socket down mid-stream.
 *
 * No Express, no server state — `fetch` and the token peek are injectable for
 * tests (precedent: setGitHubFetch in github/oauth.ts).
 */

import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import tar from 'tar-stream';
import { extname } from 'node:path';
import { peekGitHubAccessToken } from '../github/oauth.js';
import { parseRepoTarget, type ParsedRepoTarget, type RepoUrlFault } from './repo-url.js';
import {
  DEFAULT_EXCLUDES,
  MULTI_LANG_INCLUDE_EXTS,
  type SourceFileInput,
} from './code-ingest.js';

// =============================================================================
// ERROR TAXONOMY — 8 codes, distinct copy + retry guidance (35-CONTEXT §5.3)
// =============================================================================

export type RepoIngestErrorCode =
  | 'invalid_url'
  | 'repo_not_found'
  | 'private_inaccessible'
  | 'not_connected'
  | 'rate_limited'
  | 'oversized'
  | 'network'
  | 'cancelled';

/**
 * The single classified error thrown by this module. The API layer maps it to
 * `{ error: message, errorCode, retryHint }` with `httpStatus`. Constructed
 * token-free: host/status/code only, never the Authorization value or the
 * credential portion of a URL.
 */
export class RepoIngestError extends Error {
  readonly code: RepoIngestErrorCode;
  readonly httpStatus: number;
  readonly retryHint?: string;
  /** rate_limited only: seconds to wait (Retry-After, or core-reset epoch − now). */
  readonly retryAfterSeconds?: number;
  /** invalid_url only: the exact validator fault. */
  readonly fault?: RepoUrlFault;

  constructor(
    code: RepoIngestErrorCode,
    message: string,
    opts: {
      httpStatus?: number;
      retryHint?: string;
      retryAfterSeconds?: number;
      fault?: RepoUrlFault;
    } = {},
  ) {
    super(message);
    this.name = 'RepoIngestError';
    this.code = code;
    this.httpStatus = opts.httpStatus ?? 400;
    if (opts.retryHint !== undefined) this.retryHint = opts.retryHint;
    if (opts.retryAfterSeconds !== undefined) this.retryAfterSeconds = opts.retryAfterSeconds;
    if (opts.fault !== undefined) this.fault = opts.fault;
  }
}

// =============================================================================
// TYPES + CONSTANTS
// =============================================================================

/** Skip reasons, one per file, first match wins (35-CONTEXT §3.4). */
export type RepoIngestSkipReason =
  | 'dir-fragment'
  | 'out-of-scope'
  | 'lockfile'
  | 'ext-not-analyzable'
  | 'binary-signature'
  | 'minified'
  | 'file-too-large'
  | 'non-utf8';

/** Monotonic per-run counters (the purple-run SSE projection). */
export interface RepoIngestCounters {
  /** Regular-file tar entries seen (after root strip). */
  discovered: number;
  /** Files selected for analysis. */
  fetched: number;
  /** Entries skip-classified (all reasons). */
  skipped: number;
  /** Decompressed bytes of selected files. */
  bytes: number;
}

/** Visible skip summary: counts + reasons, one example path each. */
export interface RepoSkipSummary {
  total: number;
  byReason: Record<string, number>;
  example: Record<string, string>;
}

export interface FetchedRepoFiles {
  target: ParsedRepoTarget;
  /** Canonical `owner/repo@ref[/subpath]` label. */
  label: string;
  files: SourceFileInput[];
  skipSummary: RepoSkipSummary;
  counters: RepoIngestCounters;
  /** True when a token drove the authed (api.github.com) fetch plan. */
  authed: boolean;
}

export interface RepoIngestOptions {
  /** Caller cancellation (mission stop / client disconnect). */
  signal?: AbortSignal;
  /** Per-file progress (called on every skip/select decision). */
  onProgress?: (counters: RepoIngestCounters) => void;
}

/** Fetch seam — structurally satisfied by global fetch; injectable for tests. */
export interface RepoFetchResponseLike {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}
export type RepoFetchLike = (
  url: string,
  init: {
    redirect: 'manual';
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<RepoFetchResponseLike>;

/** SSRF origin allowlist — the ONLY hosts any hop may target (35-CONTEXT §4). */
const FETCH_HOST_ALLOWLIST: Record<string, true> = {
  'api.github.com': true,
  'codeload.github.com': true,
  'objects.githubusercontent.com': true,
  'raw.githubusercontent.com': true,
};

/**
 * Fetch-side dir fragments: the exported local-flow `DEFAULT_EXCLUDES` PLUS
 * `vendor`/`target`/`out`/`.next`/`coverage`. Kept here (not folded back into
 * DEFAULT_EXCLUDES) so the local-flow contract is not silently widened.
 */
const FETCH_DIR_EXCLUDES: Record<string, true> = {
  ...Object.fromEntries(DEFAULT_EXCLUDES.map((fragment) => [fragment, true as const])),
  vendor: true,
  target: true,
  out: true,
  '.next': true,
  coverage: true,
};

/** Basename-exact lockfiles (35-CONTEXT §3.4 rule 4). */
const LOCKFILE_BASENAMES: Record<string, true> = {
  'package-lock.json': true,
  'yarn.lock': true,
  'pnpm-lock.yaml': true,
  'Poetry.lock': true,
  'poetry.lock': true,
  'Cargo.lock': true,
  'go.sum': true,
  'Gemfile.lock': true,
  'composer.lock': true,
  'Pipfile.lock': true,
  'flake.lock': true,
};

const MAX_REDIRECT_HOPS = 5;
/** NUL byte anywhere in the first 8 KiB ⇒ binary-signature. */
const BINARY_SNIFF_BYTES = 8192;
/** Any single line ≥ this many bytes ⇒ minified (UTF-8 bytes ≥ chars, so the
 *  byte scan is conservative-correct). */
const MINIFIED_LINE_BYTES = 2000;

/** Cap defaults — env-overridable via the T3MP3ST_REPO_* knobs (§3.3). */
export const REPO_MAX_DOWNLOAD_BYTES_DEFAULT = 64 * 1024 * 1024; // 64 MiB
export const REPO_MAX_FILES_DEFAULT = 5_000;
export const REPO_MAX_FILE_BYTES_DEFAULT = 1_000_000; // matches ingest maxFileBytes
export const REPO_TIMEOUT_MS_DEFAULT = 120_000;

const USER_AGENT = 't3mp3st-repo-ingest';

// =============================================================================
// INJECTION SEAMS (tests)
// =============================================================================

let injectedFetch: RepoFetchLike | undefined;

/** Test seam — inject a fake fetch (precedent: setGitHubFetch). */
export function setRepoIngestFetch(fn: RepoFetchLike | undefined): void {
  injectedFetch = fn;
}

let tokenPeek: () => string | undefined = peekGitHubAccessToken;

/**
 * Test seam — pin the connected-token peek (default: peekGitHubAccessToken,
 * D5: read-only, never refreshes). Tests force anonymous or authed plans
 * deterministically regardless of the developer machine's OAuth store.
 */
export function __setRepoIngestTokenPeek(fn: (() => string | undefined) | undefined): void {
  tokenPeek = fn ?? peekGitHubAccessToken;
}

function resolveToken(): string | undefined {
  const peeked = tokenPeek();
  if (peeked) return peeked;
  const env = process.env.T3MP3ST_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  return env || undefined;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

interface RepoIngestCaps {
  maxDownloadBytes: number;
  maxFiles: number;
  maxFileBytes: number;
  timeoutMs: number;
}

function loadCaps(): RepoIngestCaps {
  return {
    maxDownloadBytes: envInt('T3MP3ST_REPO_MAX_DOWNLOAD_BYTES', REPO_MAX_DOWNLOAD_BYTES_DEFAULT),
    maxFiles: envInt('T3MP3ST_REPO_MAX_FILES', REPO_MAX_FILES_DEFAULT),
    maxFileBytes: envInt('T3MP3ST_REPO_MAX_FILE_BYTES', REPO_MAX_FILE_BYTES_DEFAULT),
    timeoutMs: envInt('T3MP3ST_REPO_TIMEOUT_MS', REPO_TIMEOUT_MS_DEFAULT),
  };
}

// =============================================================================
// HELPERS
// =============================================================================

const UTF8_FATAL = new TextDecoder('utf-8', { fatal: true });

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

function networkError(target: ParsedRepoTarget, detail: string): RepoIngestError {
  return new RepoIngestError(
    'network',
    `Could not fetch ${target.canonical} from GitHub: ${detail}`,
    {
      httpStatus: 502,
      retryHint: 'Check connectivity; the fetch is a single GitHub request — retry is safe.',
    },
  );
}

function cancelledError(counters: RepoIngestCounters): RepoIngestError {
  return new RepoIngestError(
    'cancelled',
    `Ingest cancelled after ${counters.fetched} files (${formatBytes(counters.bytes)})`,
    { httpStatus: 499 },
  );
}

function isAbortLike(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Best-effort transport-error class for the network message: Node's errno
 * code when present (ENOTFOUND, ECONNRESET, …), else the error text. Narrowed
 * with `in`, never an unchecked shape cast.
 */
function transportErrorDetail(err: unknown): string {
  if (err !== null && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  if (err instanceof Error && err.message !== '') return err.message;
  return String(err);
}

/** Any single line ≥ MINIFIED_LINE_BYTES bytes (no 0x0A for that long). */
function hasLongLine(buf: Buffer): boolean {
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) {
      if (i - start >= MINIFIED_LINE_BYTES) return true;
      start = i + 1;
    }
  }
  return buf.length - start >= MINIFIED_LINE_BYTES;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/** Parse + validate a repo URL, mapping validator faults to invalid_url. */
export function parseRepoUrlForIngest(input: string): ParsedRepoTarget {
  const parsed = parseRepoTarget(input);
  if (!parsed.ok) {
    throw new RepoIngestError('invalid_url', parsed.message, {
      httpStatus: 400,
      fault: parsed.fault,
    });
  }
  return parsed.value;
}

/** Parse + fetch in one step (route convenience). */
export async function ingestRepoUrl(
  input: string,
  opts: RepoIngestOptions = {},
): Promise<FetchedRepoFiles> {
  return fetchRepoFiles(parseRepoUrlForIngest(input), opts);
}

/**
 * The 404-derived codes — the only terminal errors that advance a
 * slash-branch retry. Produced exclusively by classifyNotFound (the
 * HTTP-404 path); every other code (rate_limited, network, cancelled,
 * oversized, invalid_url) is final on the attempt that raised it.
 */
const NOT_FOUND_FETCH_CODES: Partial<Record<RepoIngestErrorCode, true>> = {
  repo_not_found: true,
  private_inaccessible: true,
  not_connected: true,
};

/**
 * Slash-branch candidate refs: the validator's grammar split cannot know
 * where a ref containing '/' ends — `/tree/feature/login-flow` parses as
 * ref `feature` + subpath `login-flow`. When that fetch 404s, the only
 * correct retries consume subpath segments into progressively longer refs
 * until the ref is the full slash branch:
 *   (feature, login-flow/docs) → (feature/login-flow, docs) → (feature/login-flow/docs, '')
 * Canonical is invariant across candidates (the same path segments, only
 * the split point moves), so the run label never changes on a retry.
 */
function slashBranchRefCandidates(target: ParsedRepoTarget): ParsedRepoTarget[] {
  if (target.subpath === '') return [target];
  const segments = target.subpath.split('/');
  const candidates: ParsedRepoTarget[] = [target];
  for (let take = 1; take <= segments.length; take++) {
    candidates.push({
      owner: target.owner,
      repo: target.repo,
      ref: `${target.ref}/${segments.slice(0, take).join('/')}`,
      subpath: segments.slice(take).join('/'),
      canonical: target.canonical,
    });
  }
  return candidates;
}

/**
 * Fetch a repo's analyzable source as in-memory files: redirect-followed
 * tarball stream, root-stripped, subpath-filtered, skip-classified, capped.
 * Throws RepoIngestError (one of the 8 codes) on every terminal failure.
 *
 * Slash-branch retry: when the parsed target carries a subpath and the
 * tarball fetch 404s, the fetch is retried with progressively longer refs
 * consuming subpath segments (`feature` + `login-flow` may really be the
 * branch `feature/login-flow`) before the not-found family classification
 * surfaces. Only the 404-derived codes retry — cancellation, rate limits,
 * caps, and transport errors surface from the attempt that raised them.
 */
export async function fetchRepoFiles(
  target: ParsedRepoTarget,
  opts: RepoIngestOptions = {},
): Promise<FetchedRepoFiles> {
  const candidates = slashBranchRefCandidates(target);
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchRepoFilesOnce(candidates[attempt], opts);
    } catch (err) {
      if (
        attempt + 1 >= candidates.length ||
        !(err instanceof RepoIngestError) ||
        NOT_FOUND_FETCH_CODES[err.code] !== true
      ) {
        throw err;
      }
    }
  }
}

/** Single-candidate fetch — the retry wrapper above drives the candidate list. */
async function fetchRepoFilesOnce(
  target: ParsedRepoTarget,
  opts: RepoIngestOptions = {},
): Promise<FetchedRepoFiles> {
  const caps = loadCaps();
  const fetchImpl = injectedFetch ?? (globalThis.fetch as unknown as RepoFetchLike);
  const token = resolveToken();

  // Abort composition (runGuardedTool pattern, guardrails.ts): internal
  // controller + external listener + wall-clock timer. Every abort path
  // (timeout, caller cancel, cap breach) tears down the live socket.
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = (): void => {
    controller.abort();
  };
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, caps.timeoutMs);

  const counters: RepoIngestCounters = { discovered: 0, fetched: 0, skipped: 0, bytes: 0 };
  const byReason: Record<string, number> = {};
  const example: Record<string, string> = {};
  const files: SourceFileInput[] = [];
  let failure: RepoIngestError | undefined;
  let settleStreams: (() => void) | undefined;

  const classifyAbort = (): RepoIngestError =>
    timedOut
      ? networkError(target, `timeout after ${caps.timeoutMs}ms (T3MP3ST_REPO_TIMEOUT_MS)`)
      : cancelledError(counters);

  const maybeProgress = (): void => {
    opts.onProgress?.({ ...counters });
  };

  try {
    const response = await followAllowedRedirects(target, token, fetchImpl, controller.signal, () =>
      timedOut ? networkError(target, `timeout after ${caps.timeoutMs}ms (T3MP3ST_REPO_TIMEOUT_MS)`) : cancelledError(counters),
    );
    if (!response.body) throw networkError(target, 'empty response body');

    const nodeBody = Readable.fromWeb(response.body as unknown as NodeWebReadableStream<Uint8Array>);
    const gunzip = createGunzip();
    const extract = tar.extract();

    const teardown = (): void => {
      controller.abort(); // tears the fetch socket down if still live
      nodeBody.destroy();
      gunzip.destroy();
      extract.destroy();
    };

    const onAbortDuringStream = (): void => {
      if (failure === undefined) {
        failure = classifyAbort();
        teardown();
        settleStreams?.();
      }
    };
    controller.signal.addEventListener('abort', onAbortDuringStream, { once: true });

    const recordSkip = (reason: RepoIngestSkipReason, rel: string): void => {
      byReason[reason] = (byReason[reason] ?? 0) + 1;
      if (example[reason] === undefined) example[reason] = rel;
      counters.skipped += 1;
      maybeProgress();
    };

    extract.on('entry', (header, entryStream, next) => {
      let advanced = false;
      const advance = (): void => {
        if (!advanced) {
          advanced = true;
          next();
        }
      };

      if (failure !== undefined || header.type !== 'file') {
        // tar-stream consumes pax/GNU meta-records itself; directories,
        // symlinks and devices carry no analyzable source.
        entryStream.resume();
        advance();
        return;
      }
      // Root strip: first segment is the `{repo}-{ref}/` prefix (any ref
      // form). Entries without a separator are the root dir itself or a
      // meta passthrough — never source.
      const name = header.name.replace(/^\.\//, '');
      const slash = name.indexOf('/');
      if (slash === -1) {
        entryStream.resume();
        advance();
        return;
      }
      const rel = name.slice(slash + 1);
      if (rel === '' || rel.includes('\0')) {
        entryStream.resume();
        advance();
        return;
      }
      const segments = rel.split('/');
      // Malformed tar paths (empty / dot segments) are ignored outright —
      // they are neither source nor a classified skip.
      if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        entryStream.resume();
        advance();
        return;
      }

      counters.discovered += 1;
      const basename = segments[segments.length - 1];

      const skipEntry = (reason: RepoIngestSkipReason): void => {
        recordSkip(reason, rel);
        entryStream.resume();
        advance();
      };

      // Skip engine — ordered, first match wins (35-CONTEXT §3.4).
      // 1. dir-fragment
      if (segments.some((segment) => FETCH_DIR_EXCLUDES[segment] === true)) {
        skipEntry('dir-fragment');
        return;
      }
      // 2. out-of-scope (subpath runs)
      if (
        target.subpath !== '' &&
        rel !== target.subpath &&
        !rel.startsWith(`${target.subpath}/`)
      ) {
        skipEntry('out-of-scope');
        return;
      }
      // 3. lockfile — checked before the extension rule: every known lockfile
      //    basename carries a non-analyzable extension, so the doc's §8
      //    observable (package-lock.json ⇒ `lockfile`) pins this order.
      if (LOCKFILE_BASENAMES[basename] === true) {
        skipEntry('lockfile');
        return;
      }
      // 4. ext-not-analyzable
      const ext = extname(basename).toLowerCase();
      if (!MULTI_LANG_INCLUDE_EXTS.includes(ext)) {
        skipEntry('ext-not-analyzable');
        return;
      }

      // Rules 5–8 inspect content. Collect bounded by the per-file cap and
      // drain the rest — a hostile huge entry never buffers.
      const chunks: Buffer[] = [];
      let collected = 0;
      entryStream.on('data', (chunk: unknown) => {
        if (failure !== undefined) return;
        if (collected < caps.maxFileBytes) {
          // tar entries always emit node Buffers; streamx types payloads unknown.
          const buf = chunk as Buffer;
          chunks.push(buf);
          collected += buf.length;
        }
      });
      entryStream.on('end', () => {
        if (failure !== undefined) {
          advance();
          return;
        }
        try {
          const prefix = Buffer.concat(chunks);
          // 5. binary-signature — NUL in the first 8 KiB.
          if (prefix.subarray(0, Math.min(prefix.length, BINARY_SNIFF_BYTES)).includes(0)) {
            recordSkip('binary-signature', rel);
            advance();
            return;
          }
          // 6. minified — name markers, or any single line ≥ 2000 bytes.
          if (
            basename.includes('.min.') ||
            basename.includes('.bundle.') ||
            basename.includes('-bundle.') ||
            hasLongLine(prefix)
          ) {
            recordSkip('minified', rel);
            advance();
            return;
          }
          // 7. file-too-large — per-file skip, NOT terminal.
          if (header.size > caps.maxFileBytes) {
            recordSkip('file-too-large', rel);
            advance();
            return;
          }
          // 8. non-utf8 — NUL beyond the head, or fatal decode.
          if (prefix.subarray(BINARY_SNIFF_BYTES).includes(0)) {
            recordSkip('non-utf8', rel);
            advance();
            return;
          }
          let content: string;
          try {
            // fatal: true, BOM stripped, NO newline normalization — parity
            // with the disk flow's readFileSync(path, 'utf8') output.
            content = UTF8_FATAL.decode(prefix);
          } catch {
            recordSkip('non-utf8', rel);
            advance();
            return;
          }
          if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);

          // Terminal caps (§3.3): both numbers + first offending file +
          // the knob name. Counters freeze at the breach.
          if (files.length + 1 > caps.maxFiles) {
            throw new RepoIngestError(
              'oversized',
              `Repo exceeds the file-count cap (kept ${caps.maxFiles} selected files; ${files.length + 1} requested at ${rel}). Narrow the URL to a /tree/<ref>/<subpath> scope, or raise T3MP3ST_REPO_MAX_FILES.`,
              {
                httpStatus: 413,
                retryHint: 'Narrow the URL to a /tree/<ref>/<subpath> scope, or raise T3MP3ST_REPO_MAX_FILES.',
              },
            );
          }
          const totalAfter = counters.bytes + header.size;
          if (totalAfter > caps.maxDownloadBytes) {
            throw new RepoIngestError(
              'oversized',
              `Repo exceeds the ${formatBytes(caps.maxDownloadBytes)} download cap (hit ${formatBytes(totalAfter)} at ${rel}). Narrow the URL to a /tree/<ref>/<subpath> scope, or raise T3MP3ST_REPO_MAX_DOWNLOAD_BYTES.`,
              {
                httpStatus: 413,
                retryHint: 'Narrow the URL to a /tree/<ref>/<subpath> scope, or raise T3MP3ST_REPO_MAX_DOWNLOAD_BYTES.',
              },
            );
          }

          files.push({ path: rel, content });
          counters.fetched += 1;
          counters.bytes = totalAfter;
          maybeProgress();
          advance();
        } catch (err) {
          failure = err instanceof RepoIngestError ? err : networkError(target, String(err));
          advance();
          teardown();
          settleStreams?.();
        }
      });
      entryStream.on('error', (err: Error) => {
        if (failure === undefined) {
          failure = isAbortLike(err) ? classifyAbort() : networkError(target, err.message);
        }
        advance();
        if (failure !== undefined) {
          teardown();
          settleStreams?.();
        }
      });
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = (): void => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      settleStreams = settle;
      extract.on('finish', settle);
      extract.on('close', settle);
      const failStream = (err: Error): void => {
        if (failure === undefined) {
          failure = isAbortLike(err) ? classifyAbort() : networkError(target, err.message);
        }
        settle();
      };
      nodeBody.on('error', failStream);
      gunzip.on('error', failStream);
      extract.on('error', failStream);
      nodeBody.pipe(gunzip);
      gunzip.pipe(extract);
    });

    if (failure !== undefined) throw failure;
    if (controller.signal.aborted && files.length === 0 && counters.discovered === 0) {
      // Raced: aborted before any stream error surfaced.
      throw classifyAbort();
    }

    return {
      target,
      label: target.canonical,
      files,
      skipSummary: { total: counters.skipped, byReason, example },
      counters,
      authed: token !== undefined,
    };
  } catch (err) {
    if (err instanceof RepoIngestError) throw err;
    if (isAbortLike(err)) throw classifyAbort();
    throw networkError(target, transportErrorDetail(err));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }
}

// =============================================================================
// FETCH PLAN + REDIRECT ALLOWLIST
// =============================================================================

interface AllowedFetch {
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}

/**
 * Walk the fetch plan with `redirect: 'manual'`, enforcing the per-hop SSRF
 * origin allowlist (https + GitHub fetch hosts only, max 5 hops) and
 * classifying every terminal HTTP error. The Bearer token rides ONLY the
 * api.github.com hops — redirect targets are presigned and never see it.
 */
async function followAllowedRedirects(
  target: ParsedRepoTarget,
  token: string | undefined,
  fetchImpl: RepoFetchLike,
  signal: AbortSignal,
  classifyAbort: () => RepoIngestError,
): Promise<AllowedFetch> {
  let currentUrl =
    token !== undefined
      ? `https://api.github.com/repos/${target.owner}/${target.repo}/tarball/${target.ref}`
      : `https://codeload.github.com/${target.owner}/${target.repo}/tar.gz/${target.ref}`;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    // Abort classification wins over any HTTP mapping: a request whose
    // signal is already dead (pre-start caller cancel, or a cancel that
    // raced the hop) must surface as cancelled/timeout, never as the
    // artifact status a torn-down hop happens to return.
    if (signal.aborted) throw classifyAbort();
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw networkError(target, `invalid redirect URL from GitHub`);
    }
    // Per-hop allowlist — checked before any request leaves. The first hop
    // is our own planned URL; later hops are GitHub-issued Locations.
    if (parsed.protocol !== 'https:' || FETCH_HOST_ALLOWLIST[parsed.hostname] !== true) {
      throw new RepoIngestError(
        'network',
        `redirect to ${parsed.hostname || '(no host)'} refused — only GitHub fetch hosts are allowed`,
        {
          httpStatus: 502,
          retryHint: 'Check connectivity; the fetch is a single GitHub request — retry is safe.',
        },
      );
    }

    const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
    if (token !== undefined && parsed.hostname === 'api.github.com') {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: RepoFetchResponseLike;
    try {
      response = await fetchImpl(parsed.toString(), { redirect: 'manual', headers, signal });
    } catch (err) {
      if (isAbortLike(err)) throw classifyAbort();
      throw networkError(target, transportErrorDetail(err));
    }
    if (signal.aborted) throw classifyAbort();

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location === null) {
        throw networkError(target, `HTTP ${response.status} without a Location header`);
      }
      let next: URL;
      try {
        next = new URL(location, parsed);
      } catch {
        throw networkError(target, `invalid Location header from GitHub`);
      }
      // The allowlist check happens at the top of the next iteration — the
      // blocked-host message names the exact host.
      currentUrl = next.toString();
      continue;
    }

    if (response.status === 404) {
      throw classifyNotFound(target, token, hop > 0);
    }
    if (response.status === 403 || response.status === 429) {
      const rateLimited =
        response.headers.get('x-ratelimit-remaining') === '0' ||
        response.headers.get('retry-after') !== null;
      if (rateLimited) throw rateLimitedError(response);
      throw networkError(target, `HTTP ${response.status}`);
    }
    if (response.status !== 200) {
      throw networkError(target, `HTTP ${response.status}`);
    }
    return response;
  }
  throw networkError(target, `too many redirect hops (max ${MAX_REDIRECT_HOPS})`);
}

/**
 * 404 classification is decided by auth context (the observable):
 *   - token attached ⇒ the token's view says private-or-missing → private_inaccessible
 *   - anonymous      ⇒ cannot distinguish private from missing → not_connected
 *   - a redirect hop already resolved repo+ref (the 302 was minted for that
 *     exact archive) ⇒ a genuine archive/ref miss → repo_not_found
 */
function classifyNotFound(
  target: ParsedRepoTarget,
  token: string | undefined,
  redirectHop: boolean,
): RepoIngestError {
  if (redirectHop) {
    return new RepoIngestError(
      'repo_not_found',
      `Repository ${target.owner}/${target.repo}@${target.ref} not found on github.com`,
      {
        httpStatus: 404,
        retryHint: 'Check spelling and the ref (branch/tag/SHA); if it is private, connect GitHub in Settings.',
      },
    );
  }
  if (token !== undefined) {
    return new RepoIngestError(
      'private_inaccessible',
      `${target.owner}/${target.repo} is private or does not exist`,
      {
        httpStatus: 402,
        retryHint: 'Connect GitHub with the repo scope in Settings (or verify the repository name), then retry.',
      },
    );
  }
  return new RepoIngestError(
    'not_connected',
    `No GitHub connection is configured, and ${target.owner}/${target.repo} is not accessible anonymously`,
    {
      httpStatus: 402,
      retryHint: 'Connect GitHub (repo scope) or set T3MP3ST_GITHUB_TOKEN, or pick a public repo.',
    },
  );
}

/** rate_limited copy carries the reset time; never auto-hammer (§5.3). */
function rateLimitedError(response: { headers: { get(name: string): string | null } }): RepoIngestError {
  const retryAfterRaw = response.headers.get('retry-after');
  const resetEpoch = Number(response.headers.get('x-ratelimit-reset'));
  let retryAfterSeconds: number | undefined;
  if (retryAfterRaw !== null && /^\d+$/.test(retryAfterRaw)) {
    retryAfterSeconds = Number.parseInt(retryAfterRaw, 10);
  } else if (response.headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(resetEpoch) && resetEpoch > 0) {
    retryAfterSeconds = Math.max(0, resetEpoch - Math.floor(Date.now() / 1000));
  }
  const resetsAt =
    retryAfterSeconds !== undefined
      ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString().slice(11, 16)
      : 'the next rate-limit window';
  return new RepoIngestError(
    'rate_limited',
    `GitHub rate limit reached (resets at ${resetsAt} UTC${retryAfterSeconds !== undefined ? `, in ${retryAfterSeconds}s` : ''})`,
    {
      httpStatus: 429,
      retryHint: 'Wait until the reset time, then retry — repeated requests extend the lockout.',
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    },
  );
}
