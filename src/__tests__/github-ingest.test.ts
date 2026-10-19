/**
 * github-ingest tests (phase 35 repo-URL fetch adapter)
 *
 * Fixture tarballs are built in-test with tar-stream + zlib (gzipped buffers
 * served through an injected fetch), exercising:
 *   - the skip engine (all 8 reasons, ordered, first match wins) + root strip
 *   - subpath scope filtering
 *   - caps: download bytes / file count (terminal oversized), per-file
 *     (non-terminal), with both numbers + knob + offending file in the copy
 *   - the 8-code error taxonomy incl. redirect-origin rejection (SSRF
 *     allowlist) and token placement (Bearer ONLY on api.github.com hops)
 *   - slash-branch long-prefix retry: a 404 on the grammar-split ref refetches
 *     with longer refs consuming subpath segments; exhaustion, non-404 codes,
 *     and cancellation never retry
 *   - cancellation (mid-stream + pre-start) and wall-clock timeout
 *   - progress counters monotonic
 *   - refactor parity: ingestRepository (disk) ≡ crawl+read → ingestFiles,
 *     and ingestRepoToSourceContext ≡ ingestFetchedFilesToSourceContext
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import tar from 'tar-stream';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  fetchRepoFiles,
  ingestRepoUrl,
  setRepoIngestFetch,
  __setRepoIngestTokenPeek,
  RepoIngestError,
  type RepoFetchLike,
  type RepoFetchResponseLike,
  type FetchedRepoFiles,
  type RepoIngestCounters,
} from '../recon/github-ingest.js';
import { parseRepoTarget, type ParsedRepoTarget } from '../recon/repo-url.js';
import {
  ingestRepository,
  ingestFiles,
  createMultiLangIngestConfig,
  crawl,
  MULTI_LANG_MAX_TOTAL_BYTES,
  DEFAULT_EXCLUDES,
  MULTI_LANG_INCLUDE_EXTS,
  type IngestConfig,
  type SourceFileInput,
} from '../recon/code-ingest.js';
import {
  ingestRepoToSourceContext,
  ingestFetchedFilesToSourceContext,
} from '../recon/whitebox.js';

// ---------------------------------------------------------------------------
// Fixtures + helpers
// ---------------------------------------------------------------------------

const ROOT = 'Hello-World-HEAD';

function mustTarget(url: string): ParsedRepoTarget {
  const parsed = parseRepoTarget(url);
  if (!parsed.ok) throw new Error(`fixture URL failed to parse: ${parsed.message}`);
  return parsed.value;
}

const WHOLE_REPO = mustTarget('https://github.com/octocat/Hello-World');
const SRC_SCOPE = mustTarget('https://github.com/octocat/Hello-World/tree/main/src');

interface TarEntry {
  name: string;
  content?: string | Buffer;
  type?: 'file' | 'directory' | 'symlink';
  linkname?: string;
}

/** Build a gzipped tarball exactly like codeload serves (root-prefixed entries). */
async function tarGz(entries: TarEntry[]): Promise<Buffer> {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    pack.on('data', (chunk: unknown) => {
      // tar pack emits node Buffers; streamx types payloads unknown.
      const buf = chunk as Buffer;
      chunks.push(buf);
    });
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.on('error', reject);
  });
  for (const entry of entries) {
    const buf =
      typeof entry.content === 'string'
        ? Buffer.from(entry.content, 'utf8')
        : entry.content ?? Buffer.alloc(0);
    if (entry.type === 'directory') {
      await new Promise<void>((resolve, reject) =>
        pack.entry({ name: entry.name, type: 'directory' }, (err) => (err ? reject(err) : resolve())));
      continue;
    }
    if (entry.type === 'symlink') {
      await new Promise<void>((resolve, reject) =>
        pack.entry(
          { name: entry.name, type: 'symlink', linkname: entry.linkname ?? 'target' },
          (err) => (err ? reject(err) : resolve()),
        ));
      continue;
    }
    await new Promise<void>((resolve, reject) =>
      pack.entry({ name: entry.name, size: buf.length, type: 'file' }, buf, (err) => (err ? reject(err) : resolve())));
  }
  pack.finalize();
  return gzipSync(await done);
}

function headersOf(map: Record<string, string>): { get(name: string): string | null } {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

function tarResponse(gz: Buffer): RepoFetchResponseLike {
  return {
    status: 200,
    ok: true,
    headers: headersOf({ 'content-type': 'application/x-gzip' }),
    body: Readable.toWeb(Readable.from(gz)) as unknown as ReadableStream<Uint8Array>,
  };
}

function errorResponse(status: number, headers: Record<string, string> = {}): RepoFetchResponseLike {
  return { status, ok: false, headers: headersOf(headers), body: null };
}

function redirectResponse(location: string): RepoFetchResponseLike {
  return { status: 302, ok: false, headers: headersOf({ location }), body: null };
}

interface RecordedHop {
  url: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

/** fetch stub script: each call pops the next canned response; hops recorded. */
function scriptFetch(responses: RepoFetchResponseLike[], hops: RecordedHop[] = []): RepoFetchLike {
  return async (url, init) => {
    hops.push({ url, headers: { ...(init?.headers ?? {}) }, signal: init?.signal });
    const response = responses.shift();
    if (response === undefined) throw new Error(`unexpected extra fetch hop: ${url}`);
    return response;
  };
}

async function fetchFixture(
  entries: TarEntry[],
  target: ParsedRepoTarget = WHOLE_REPO,
): Promise<FetchedRepoFiles> {
  const gz = await tarGz(entries);
  setRepoIngestFetch(async () => tarResponse(gz));
  return fetchRepoFiles(target);
}

// ---------------------------------------------------------------------------
// Env hygiene — deterministic caps + anonymous token state per test
// ---------------------------------------------------------------------------

// Env knobs the ADAPTER reads — wiped per test for determinism.
// T3MP3ST_REPO_ROOT is deliberately NOT here: only the parity describe owns
// its lifecycle (beforeAll/afterAll); a per-test wipe would clobber it
// between its beforeAll and first test.
const ENV_KEYS = [
  'T3MP3ST_REPO_MAX_DOWNLOAD_BYTES',
  'T3MP3ST_REPO_MAX_FILES',
  'T3MP3ST_REPO_MAX_FILE_BYTES',
  'T3MP3ST_REPO_TIMEOUT_MS',
  'T3MP3ST_GITHUB_TOKEN',
  'GITHUB_TOKEN',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  __setRepoIngestTokenPeek(() => undefined);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  setRepoIngestFetch(undefined);
  __setRepoIngestTokenPeek(undefined);
});

// ---------------------------------------------------------------------------
// Skip rules
// ---------------------------------------------------------------------------

describe('github-ingest — skip engine (ordered, first match wins)', () => {
  it('classifies every skip reason, strips the tarball root, ignores meta/non-file entries', async () => {
    const longLineJs = `${'a'.repeat(2500)}\n`;
    const bigPy = `${'x'.repeat(100)}\n`.repeat(12_000); // 1.2 MB, lines ≤ 101 chars
    const nulDeepPy = `${'x'.repeat(100)}\n`.repeat(95) + '\0tail'; // NUL at ~9.6 KB, past the 8 KiB head
    const pngMagic = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]), Buffer.alloc(64)]);

    const result = await fetchFixture([
      { name: ROOT, type: 'directory' },
      { name: `${ROOT}/src`, type: 'directory' },
      { name: `${ROOT}/src/app.py`, content: 'def handler(cmd):\n    return run(cmd)\n' },
      { name: `${ROOT}/src/util.py`, content: '\uFEFFdef util():\n    return 1\n' },
      { name: `${ROOT}/node_modules/pkg/index.js`, content: 'module.exports = 1\n' },
      { name: `${ROOT}/vendor/lib.ts`, content: 'export const x = 1;\n' },
      { name: `${ROOT}/out/built.js`, content: 'export {};\n' },
      { name: `${ROOT}/.next/page.js`, content: 'export {};\n' },
      { name: `${ROOT}/coverage/index.js`, content: 'export {};\n' },
      { name: `${ROOT}/package-lock.json`, content: '{}\n' },
      { name: `${ROOT}/yarn.lock`, content: '# yarn lock\n' },
      { name: `${ROOT}/docs/logo.png`, content: pngMagic },
      { name: `${ROOT}/Makefile`, content: 'all:\n\techo hi\n' },
      { name: `${ROOT}/app.min.js`, content: 'export {};\n' },
      { name: `${ROOT}/src/longline.js`, content: longLineJs },
      { name: `${ROOT}/big.py`, content: bigPy },
      { name: `${ROOT}/img.py`, content: pngMagic },
      { name: `${ROOT}/latin1.py`, content: Buffer.from('olé\nfunción\n', 'latin1') },
      { name: `${ROOT}/nuldeep.py`, content: nulDeepPy },
      { name: `${ROOT}/link`, type: 'symlink', linkname: 'src/app.py' },
      { name: 'loosefile.py', content: 'def loose():\n    pass\n' },
    ]);

    // Selected files — root stripped, BOM stripped, content untouched otherwise.
    expect(result.files.map((f) => f.path)).toEqual(['src/app.py', 'src/util.py']);
    expect(result.files[1].content.startsWith('def util')).toBe(true);

    const byReason = result.skipSummary.byReason;
    expect(byReason['dir-fragment']).toBe(5); // node_modules, vendor, out, .next, coverage
    expect(byReason['lockfile']).toBe(2); // package-lock.json, yarn.lock
    expect(byReason['ext-not-analyzable']).toBe(2); // logo.png, Makefile
    expect(byReason['minified']).toBe(2); // app.min.js (name), longline.js (≥2000-char line)
    expect(byReason['file-too-large']).toBe(1); // big.py — 1.2 MB > 1 MB default
    expect(byReason['binary-signature']).toBe(1); // img.py — NUL in first 8 KiB
    expect(byReason['non-utf8']).toBe(2); // latin1.py (fatal decode), nuldeep.py (NUL past head)
    expect(result.skipSummary.total).toBe(15);
    // One example per reason; stream order decides the first.
    expect(result.skipSummary.example['dir-fragment']).toBe('node_modules/pkg/index.js');
    expect(result.skipSummary.example['lockfile']).toBe('package-lock.json');

    // Counters: symlink + directories + rootless entry never counted.
    expect(result.counters).toEqual({
      discovered: 17,
      fetched: 2,
      skipped: 15,
      bytes: Buffer.byteLength('def handler(cmd):\n    return run(cmd)\n', 'utf8') +
        Buffer.byteLength('\uFEFFdef util():\n    return 1\n', 'utf8'),
    });
    expect(result.label).toBe('octocat/Hello-World@HEAD');
    expect(result.authed).toBe(false);
  });

  it('subpath scope keeps only prefixed entries; the rest skip as out-of-scope', async () => {
    const result = await fetchFixture(
      [
        { name: 'Hello-World-main/src/a.py', content: 'def a():\n    pass\n' },
        { name: 'Hello-World-main/src/deep/b.py', content: 'def b():\n    pass\n' },
        { name: 'Hello-World-main/other/c.go', content: 'package other\n' },
        { name: 'Hello-World-main/srcx/d.py', content: 'def d():\n    pass\n' }, // prefix, not segment
      ],
      SRC_SCOPE,
    );
    expect(result.files.map((f) => f.path)).toEqual(['src/a.py', 'src/deep/b.py']);
    expect(result.skipSummary.byReason['out-of-scope']).toBe(2);
    expect(result.skipSummary.example['out-of-scope']).toBe('other/c.go');
  });
});

// ---------------------------------------------------------------------------
// Caps
// ---------------------------------------------------------------------------

describe('github-ingest — caps', () => {
  it('download-bytes cap aborts the stream with both numbers + knob + offending file', async () => {
    process.env.T3MP3ST_REPO_MAX_DOWNLOAD_BYTES = '100';
    const hops: RecordedHop[] = [];
    const gz = await tarGz([
      { name: `${ROOT}/a.py`, content: 'a'.repeat(60) },
      { name: `${ROOT}/b.py`, content: 'b'.repeat(60) },
      { name: `${ROOT}/c.py`, content: 'c'.repeat(60) },
    ]);
    setRepoIngestFetch(async (url, init) => {
      hops.push({ url, headers: {}, signal: init?.signal });
      return tarResponse(gz);
    });

    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RepoIngestError);
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('oversized');
    expect(repoErr.httpStatus).toBe(413);
    expect(repoErr.message).toContain('100 bytes');
    expect(repoErr.message).toContain('120 bytes'); // 60 + 60 cumulative at the breach
    expect(repoErr.message).toContain('b.py');
    expect(repoErr.message).toContain('T3MP3ST_REPO_MAX_DOWNLOAD_BYTES');
    expect(repoErr.retryHint).toContain('T3MP3ST_REPO_MAX_DOWNLOAD_BYTES');
    // Stream torn down: the fetch signal aborted; counters froze at the breach.
    expect(hops[0]?.signal?.aborted).toBe(true);
  });

  it('file-count cap is terminal oversized with the file-count copy', async () => {
    process.env.T3MP3ST_REPO_MAX_FILES = '2';
    let err: unknown;
    try {
      await fetchFixture([
        { name: `${ROOT}/a.py`, content: 'a'.repeat(10) },
        { name: `${ROOT}/b.py`, content: 'b'.repeat(10) },
        { name: `${ROOT}/c.py`, content: 'c'.repeat(10) },
      ]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RepoIngestError);
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('oversized');
    expect(repoErr.message).toContain('T3MP3ST_REPO_MAX_FILES');
    expect(repoErr.message).toContain('c.py');
  });

  it('per-file cap is a SKIP, never terminal — the run still succeeds', async () => {
    const result = await fetchFixture([
      { name: `${ROOT}/big.py`, content: `${'x'.repeat(100)}\n`.repeat(12_000) }, // 1.2 MB
      { name: `${ROOT}/ok.py`, content: 'def ok():\n    pass\n' },
    ]);
    expect(result.files.map((f) => f.path)).toEqual(['ok.py']);
    expect(result.skipSummary.byReason['file-too-large']).toBe(1);
    expect(result.counters.fetched).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Error taxonomy (8 codes) + redirect allowlist + token placement
// ---------------------------------------------------------------------------

describe('github-ingest — error mapping', () => {
  it('404 anonymous → not_connected (402)', async () => {
    setRepoIngestFetch(scriptFetch([errorResponse(404)]));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('not_connected');
    expect(repoErr.httpStatus).toBe(402);
    expect(repoErr.message).toContain('not accessible anonymously');
    expect(repoErr.message).toContain('octocat/Hello-World');
  });

  it('404 with token → private_inaccessible (402); Bearer ONLY on the api.github.com hop', async () => {
    process.env.T3MP3ST_GITHUB_TOKEN = 'ghp_localtest123';
    const hops: RecordedHop[] = [];
    setRepoIngestFetch(scriptFetch([errorResponse(404)], hops));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('private_inaccessible');
    expect(repoErr.httpStatus).toBe(402);
    expect(repoErr.message).toContain('is private or does not exist');
    // Authed plan: single api.github.com hop carrying the token.
    expect(hops).toHaveLength(1);
    expect(hops[0]?.url).toBe('https://api.github.com/repos/octocat/Hello-World/tarball/HEAD');
    expect(hops[0]?.headers.Authorization).toBe('Bearer ghp_localtest123');
    expect(hops[0]?.headers.Authorization).not.toContain('codeload');
  });

  it('authed 302 → codeload 200 → files; the redirect hop NEVER carries the token', async () => {
    process.env.T3MP3ST_GITHUB_TOKEN = 'ghp_localtest123';
    const hops: RecordedHop[] = [];
    const gz = await tarGz([{ name: `${ROOT}/m.py`, content: 'def m():\n    pass\n' }]);
    setRepoIngestFetch(scriptFetch([redirectResponse('https://codeload.github.com/octocat/Hello-World/tar.gz/HEAD'), tarResponse(gz)], hops));
    const result = await fetchRepoFiles(WHOLE_REPO);
    expect(result.authed).toBe(true);
    expect(result.files.map((f) => f.path)).toEqual(['m.py']);
    expect(hops).toHaveLength(2);
    expect(hops[0]?.headers.Authorization).toBe('Bearer ghp_localtest123');
    expect(hops[1]?.url).toBe('https://codeload.github.com/octocat/Hello-World/tar.gz/HEAD');
    expect(hops[1]?.headers.Authorization).toBeUndefined();
  });

  it('404 AFTER the redirect (metadata already resolved) → repo_not_found (404)', async () => {
    process.env.T3MP3ST_GITHUB_TOKEN = 'ghp_localtest123';
    setRepoIngestFetch(scriptFetch([
      redirectResponse('https://codeload.github.com/octocat/Hello-World/tar.gz/HEAD'),
      errorResponse(404),
    ]));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('repo_not_found');
    expect(repoErr.httpStatus).toBe(404);
    expect(repoErr.message).toContain('not found on github.com');
  });

  it('403 + x-ratelimit-remaining: 0 → rate_limited with reset copy + retryAfterSeconds', async () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 600;
    setRepoIngestFetch(scriptFetch([errorResponse(403, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(resetEpoch),
    })]));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('rate_limited');
    expect(repoErr.httpStatus).toBe(429);
    expect(repoErr.message).toContain('resets at');
    expect(repoErr.retryAfterSeconds).toBeDefined();
    expect(repoErr.retryAfterSeconds ?? 0).toBeGreaterThanOrEqual(500);
  });

  it('429 + Retry-After: 42 → rate_limited honoring the header', async () => {
    setRepoIngestFetch(scriptFetch([errorResponse(429, { 'retry-after': '42' })]));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('rate_limited');
    expect(repoErr.retryAfterSeconds).toBe(42);
  });

  it('redirect to a non-GitHub host is refused (redirect-blocked under network)', async () => {
    setRepoIngestFetch(scriptFetch([redirectResponse('https://evil.example/octocat/Hello-World/tar.gz/HEAD')]));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('network');
    expect(repoErr.httpStatus).toBe(502);
    expect(repoErr.message).toContain('evil.example');
    expect(repoErr.message).toContain('refused');
  });

  it('non-https redirect Location is refused even to an allowed host', async () => {
    process.env.T3MP3ST_GITHUB_TOKEN = 'ghp_localtest123';
    setRepoIngestFetch(scriptFetch([redirectResponse('http://codeload.github.com/octocat/Hello-World/tar.gz/HEAD')]));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('network');
    expect(repoErr.message).toContain('refused');
  });

  it('more than 5 redirect hops → network (too many hops)', async () => {
    const hops: RepoFetchResponseLike[] = [];
    for (let i = 0; i < 7; i++) {
      hops.push(redirectResponse(`https://codeload.github.com/hop-${i}/tar.gz/HEAD`));
    }
    setRepoIngestFetch(scriptFetch(hops));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('network');
    expect(repoErr.message).toContain('redirect hops');
  });

  it('transport failure (ECONNRESET) → network naming the errno class', async () => {
    setRepoIngestFetch(async () => {
      throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    });
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('network');
    expect(repoErr.message).toContain('ECONNRESET');
    expect(repoErr.message).toContain('Could not fetch octocat/Hello-World@HEAD');
  });

  it('invalid URL → invalid_url with the exact validator fault', async () => {
    let err: unknown;
    try {
      await ingestRepoUrl('https://gist.github.com/octocat/x');
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('invalid_url');
    expect(repoErr.httpStatus).toBe(400);
    expect(repoErr.fault).toBe('bad-host');
    expect(repoErr.message).toContain('github.com');
  });

  it('every classified error message is token-free', async () => {
    process.env.T3MP3ST_GITHUB_TOKEN = 'ghp_localtest123';
    const messages: string[] = [];
    const attempts: Array<Promise<unknown>> = [];
    const capture = (p: Promise<unknown>): Promise<unknown> =>
      p.catch((e: unknown) => {
        messages.push(e instanceof Error ? e.message : String(e));
      });
    setRepoIngestFetch(scriptFetch([errorResponse(404)]));
    attempts.push(capture(fetchRepoFiles(WHOLE_REPO)));
    setRepoIngestFetch(scriptFetch([redirectResponse('https://evil.example/x')]));
    attempts.push(capture(fetchRepoFiles(WHOLE_REPO)));
    setRepoIngestFetch(scriptFetch([errorResponse(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60) })]));
    attempts.push(capture(fetchRepoFiles(WHOLE_REPO)));
    await Promise.all(attempts);
    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message).not.toContain('ghp_');
      expect(message).not.toContain('Bearer');
    }
  });
});

// ---------------------------------------------------------------------------
// Slash-branch long-prefix retry (grammar-split 404 recovery)
// ---------------------------------------------------------------------------

describe('github-ingest — slash-branch long-prefix retry', () => {
  // The validator's grammar split cannot know where a ref containing '/'
  // ends: /tree/feature/login-flow parses as ref 'feature' + subpath
  // 'login-flow'. Only a 404 on that fetch reveals the split was wrong.
  const SLASH_BRANCH = mustTarget('https://github.com/octocat/Hello-World/tree/feature/login-flow');
  const BRANCH_SCOPE = mustTarget('https://github.com/octocat/Hello-World/tree/feature/login-flow/docs');

  it('fixture premise: the grammar split yields ref=feature, subpath=login-flow', () => {
    expect(SLASH_BRANCH).toMatchObject({ ref: 'feature', subpath: 'login-flow' });
    expect(BRANCH_SCOPE).toMatchObject({ ref: 'feature', subpath: 'login-flow/docs' });
  });

  it('404 on the grammar-split ref → refetch consumes the subpath into a longer ref and succeeds', async () => {
    const gz = await tarGz([
      { name: 'Hello-World-feature-login-flow/src/app.ts', content: 'export const app = 1;\n' },
    ]);
    const hops: RecordedHop[] = [];
    setRepoIngestFetch(scriptFetch([errorResponse(404), tarResponse(gz)], hops));

    const result = await fetchRepoFiles(SLASH_BRANCH);

    expect(result.files.map((f) => f.path)).toEqual(['src/app.ts']);
    expect(result.target.ref).toBe('feature/login-flow');
    expect(result.target.subpath).toBe('');
    // Canonical label is invariant across candidates — the run label a client
    // joined on never changes when a retry resolves.
    expect(result.label).toBe('octocat/Hello-World@feature/login-flow');
    expect(hops.map((h) => h.url)).toEqual([
      'https://codeload.github.com/octocat/Hello-World/tar.gz/feature',
      'https://codeload.github.com/octocat/Hello-World/tar.gz/feature/login-flow',
    ]);
  });

  it('a mid-progression candidate keeps the unconsumed tail as the subpath scope', async () => {
    // Candidates: (feature, login-flow/docs) → (feature/login-flow, docs) →
    // (feature/login-flow/docs, ''). The branch really is feature/login-flow
    // scoped to docs/ — the SECOND candidate resolves, and out-of-scope
    // filtering uses that attempt's subpath, not the grammar split's.
    const gz = await tarGz([
      { name: 'root/src/main.ts', content: 'const main = 1;\n' },
      { name: 'root/docs/guide.ts', content: 'const guide = 1;\n' },
    ]);
    const hops: RecordedHop[] = [];
    setRepoIngestFetch(scriptFetch([errorResponse(404), tarResponse(gz)], hops));

    const result = await fetchRepoFiles(BRANCH_SCOPE);

    expect(result.files.map((f) => f.path)).toEqual(['docs/guide.ts']);
    expect(result.skipSummary.byReason['out-of-scope']).toBe(1);
    expect(result.target).toMatchObject({ ref: 'feature/login-flow', subpath: 'docs' });
    expect(hops.map((h) => h.url)).toEqual([
      'https://codeload.github.com/octocat/Hello-World/tar.gz/feature',
      'https://codeload.github.com/octocat/Hello-World/tar.gz/feature/login-flow',
    ]);
  });

  it('not found after exhaustion → classified on the longest ref', async () => {
    process.env.T3MP3ST_GITHUB_TOKEN = 'ghp_localtest123';
    // Authed plan: each candidate costs an api.github.com hop (302, token
    // attached) + a codeload hop (404) → repo_not_found per attempt.
    const codeload = (ref: string): string =>
      `https://codeload.github.com/octocat/Hello-World/tar.gz/${ref}`;
    const hops: RecordedHop[] = [];
    setRepoIngestFetch(scriptFetch([
      redirectResponse(codeload('feature')),
      errorResponse(404),
      redirectResponse(codeload('feature/login-flow')),
      errorResponse(404),
    ], hops));
    let err: unknown;
    try {
      await fetchRepoFiles(SLASH_BRANCH);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('repo_not_found');
    expect(repoErr.httpStatus).toBe(404);
    // The final classification names the FULL slash ref — the branch the user
    // actually pasted — not the grammar-split fragment.
    expect(repoErr.message).toContain('octocat/Hello-World@feature/login-flow');
    expect(hops.map((h) => h.url)).toEqual([
      'https://api.github.com/repos/octocat/Hello-World/tarball/feature',
      codeload('feature'),
      'https://api.github.com/repos/octocat/Hello-World/tarball/feature/login-flow',
      codeload('feature/login-flow'),
    ]);
  });

  it('a target with no subpath never retries — one 404 classifies immediately', async () => {
    const hops: RecordedHop[] = [];
    setRepoIngestFetch(scriptFetch([errorResponse(404)], hops));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('not_connected');
    expect(hops).toHaveLength(1);
  });

  it('rate_limited never retries — the first attempt surfaces it', async () => {
    const hops: RecordedHop[] = [];
    setRepoIngestFetch(scriptFetch([errorResponse(429, { 'retry-after': '42' })], hops));
    let err: unknown;
    try {
      await fetchRepoFiles(SLASH_BRANCH);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('rate_limited');
    expect(repoErr.retryAfterSeconds).toBe(42);
    expect(hops).toHaveLength(1);
  });

  it('cancellation never retries — a pre-aborted signal short-circuits every candidate', async () => {
    const hops: RecordedHop[] = [];
    // Empty script: any fetch hop would fail the test ('unexpected extra
    // fetch hop'), pinning that a cancelled ingest leaves zero network.
    setRepoIngestFetch(scriptFetch([], hops));
    const controller = new AbortController();
    controller.abort();
    let err: unknown;
    try {
      await fetchRepoFiles(SLASH_BRANCH, { signal: controller.signal });
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('cancelled');
    expect(repoErr.httpStatus).toBe(499);
    expect(hops).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cancellation + timeout
// ---------------------------------------------------------------------------

describe('github-ingest — cancellation + timeout', () => {
  it('caller abort mid-stream → cancelled with the honest after-N-files copy', async () => {
    const controller = new AbortController();
    const gz = await tarGz([
      { name: `${ROOT}/one.py`, content: 'def one():\n    pass\n' },
      { name: `${ROOT}/two.py`, content: 'def two():\n    pass\n' },
    ]);
    setRepoIngestFetch(async () => tarResponse(gz));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO, {
        signal: controller.signal,
        onProgress: (counters) => {
          if (counters.fetched >= 1) controller.abort();
        },
      });
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('cancelled');
    expect(repoErr.message).toContain('cancelled after 1 files');
  });

  it('pre-start abort → cancelled with zero counters', async () => {
    const controller = new AbortController();
    controller.abort();
    setRepoIngestFetch(scriptFetch([errorResponse(500)]));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO, { signal: controller.signal });
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('cancelled');
    expect(repoErr.message).toContain('cancelled after 0 files');
  });

  it('wall-clock timeout (T3MP3ST_REPO_TIMEOUT_MS) → network timeout classification', async () => {
    process.env.T3MP3ST_REPO_TIMEOUT_MS = '25';
    const hanging = new Readable({ read: () => {} }); // never emits, never ends
    setRepoIngestFetch(async () => ({
      status: 200,
      ok: true,
      headers: headersOf({}),
      body: Readable.toWeb(hanging) as unknown as ReadableStream<Uint8Array>,
    }));
    let err: unknown;
    try {
      await fetchRepoFiles(WHOLE_REPO);
    } catch (e) {
      err = e;
    }
    const repoErr = err as RepoIngestError;
    expect(repoErr.code).toBe('network');
    expect(repoErr.message).toContain('timeout after 25ms');
    expect(repoErr.message).toContain('T3MP3ST_REPO_TIMEOUT_MS');
  });
});

// ---------------------------------------------------------------------------
// Progress counters
// ---------------------------------------------------------------------------

describe('github-ingest — progress', () => {
  it('counters are monotonic and the final snapshot equals the result counters', async () => {
    const snapshots: RepoIngestCounters[] = [];
    const gz = await tarGz([
      { name: `${ROOT}/a.py`, content: 'a'.repeat(30) },
      { name: `${ROOT}/skip.png`, content: 'x' },
      { name: `${ROOT}/b.py`, content: 'b'.repeat(30) },
    ]);
    setRepoIngestFetch(async () => tarResponse(gz));
    const tracked = await fetchRepoFiles(WHOLE_REPO, {
      onProgress: (counters) => snapshots.push(counters),
    });
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].discovered).toBeGreaterThanOrEqual(snapshots[i - 1].discovered);
      expect(snapshots[i].fetched).toBeGreaterThanOrEqual(snapshots[i - 1].fetched);
      expect(snapshots[i].skipped).toBeGreaterThanOrEqual(snapshots[i - 1].skipped);
      expect(snapshots[i].bytes).toBeGreaterThanOrEqual(snapshots[i - 1].bytes);
    }
    expect(snapshots.length).toBeGreaterThanOrEqual(2); // skip + select both reported
    expect(snapshots[snapshots.length - 1]).toEqual(tracked.counters);
    expect(tracked.counters).toEqual({ discovered: 3, fetched: 2, skipped: 1, bytes: 60 });
  });
});

// ---------------------------------------------------------------------------
// Refactor parity — disk flow ≡ in-memory seam
// ---------------------------------------------------------------------------

describe('refactor parity — ingestRepository ≡ crawl+read → ingestFiles', () => {
  let repoRoot: string;
  let base: string;
  let prevRoot: string | undefined;

  beforeAll(() => {
    base = realpathSync(mkdtempSync(join(tmpdir(), 't3mp3st-parity-')));
    prevRoot = process.env.T3MP3ST_REPO_ROOT;
    process.env.T3MP3ST_REPO_ROOT = base;
    repoRoot = join(base, 'repo');
    mkdirSync(repoRoot);
    mkdirSync(join(repoRoot, 'sub'));
    mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
    writeFileSync(join(repoRoot, 'app.py'), 'def handler(cmd):\n    return run(cmd)\n');
    writeFileSync(join(repoRoot, 'util.py'), '\uFEFFdef util():\n    return 1\n');
    writeFileSync(join(repoRoot, 'sub', 'mod.js'), 'export function mod() {\n  return 1;\n}\n');
    writeFileSync(join(repoRoot, 'node_modules', 'skipme.py'), 'def skip():\n    pass\n');
    writeFileSync(join(repoRoot, 'extra.py'), 'def extra(a, b):\n    return a + b\n');
  });

  afterAll(() => {
    if (prevRoot === undefined) delete process.env.T3MP3ST_REPO_ROOT;
    else process.env.T3MP3ST_REPO_ROOT = prevRoot;
  });

  const filesFromCrawl = (config: IngestConfig): SourceFileInput[] =>
    crawl(config).map((path) => ({ path, content: readFileSync(path, 'utf8') }));

  it('ingestRepository output is byte-identical to ingestFiles over the crawled files', () => {
    const config = createMultiLangIngestConfig(repoRoot);
    const disk = ingestRepository(config);
    const mem = ingestFiles(filesFromCrawl(config), { maxTotalBytes: config.maxTotalBytes });
    expect(mem).toEqual(disk);
    expect(disk.stats.files).toBe(4); // node_modules/skipme.py excluded by crawl
    expect(disk.stats.truncated).toBeUndefined();
  });

  it('crawl-ceiling truncation propagates identically (truncatedAtStart)', () => {
    const config = { ...createMultiLangIngestConfig(repoRoot), maxFiles: 2 };
    const disk = ingestRepository(config);
    expect(disk.stats.truncated).toBe(true);
    expect(disk.stats.files).toBe(2);
    const mem = ingestFiles(filesFromCrawl(config), {
      maxTotalBytes: config.maxTotalBytes,
      truncatedAtStart: true,
    });
    expect(mem).toEqual(disk);
  });

  it('byte-ceiling truncation fires identically in both paths', () => {
    const config = { ...createMultiLangIngestConfig(repoRoot), maxTotalBytes: 30 };
    const disk = ingestRepository(config);
    const mem = ingestFiles(filesFromCrawl(createMultiLangIngestConfig(repoRoot)), {
      maxTotalBytes: 30,
    });
    expect(mem).toEqual(disk);
    expect(disk.stats.truncated).toBe(true);
  });

  it('RepoSourceContext: ingestRepoToSourceContext ≡ ingestFetchedFilesToSourceContext', () => {
    const inputs = filesFromCrawl(createMultiLangIngestConfig(repoRoot));
    const disk = ingestRepoToSourceContext(repoRoot);
    const mem = ingestFetchedFilesToSourceContext(inputs);
    expect(mem).toEqual(disk);
    expect(disk.sourceContext).toContain('handler');
  });

  it('shared constants are the single authority for both flows', () => {
    expect([...MULTI_LANG_INCLUDE_EXTS]).toEqual(
      createMultiLangIngestConfig(repoRoot).includeExts,
    );
    expect(DEFAULT_EXCLUDES).toContain('node_modules');
    expect(MULTI_LANG_MAX_TOTAL_BYTES).toBe(createMultiLangIngestConfig(repoRoot).maxTotalBytes);
  });
});
