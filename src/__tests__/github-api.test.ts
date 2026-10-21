import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GitHubApiError,
  __resetGitHubApiState,
  classifyGitHubFailure,
  listGitHubRepos,
  parseGitHubRepoUrl,
  resolveGitHubRepo,
  setGitHubApiFetch,
} from '../github/api.js';

const TOKEN = 'gho_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function fakeApiFetch(
  handler: (url: string, init?: { headers?: Record<string, string> }) => {
    ok: boolean;
    status: number;
    body?: unknown;
    headers?: Record<string, string>;
  },
) {
  return vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    const h = handler(url, init);
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(h.headers ?? {})) lower[k.toLowerCase()] = v;
    return {
      ok: h.ok,
      status: h.status,
      headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
      json: async () => h.body,
      text: async () => JSON.stringify(h.body ?? {}),
    };
  });
}

function repoRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'purple-team',
    full_name: 'octo-org/purple-team',
    owner: { login: 'octo-org' },
    description: 'Posture correlation',
    visibility: 'private',
    private: true,
    default_branch: 'main',
    pushed_at: '2026-10-01T00:00:00Z',
    html_url: 'https://github.com/octo-org/purple-team',
    clone_url: 'https://github.com/octo-org/purple-team.git',
    ...overrides,
  };
}

function headersOf(init: { headers?: Record<string, string> } | undefined): Record<string, string> {
  return init?.headers ?? {};
}

describe('GitHub API client + classifier', () => {
  afterEach(() => {
    __resetGitHubApiState();
    setGitHubApiFetch(undefined);
  });

  describe('error classification (§4.8 table)', () => {

    it('maps 401 to token-expired (401)', () => {
      const e = classifyGitHubFailure(401, { get: () => null }, '', 'token');
      expect(e).toMatchObject({ code: 'token-expired', httpStatus: 401 });
      expect(e.retryAt).toBeUndefined();
    });

    it('maps 403 with Retry-After to rate-limited with retryAt = now + seconds', () => {
      const before = Date.now();
      const e = classifyGitHubFailure(403, { get: (n) => (n === 'retry-after' ? '42' : null) }, '', 'token');
      expect(e).toMatchObject({ code: 'rate-limited', httpStatus: 429 });
      expect(e.retryAt).toBeGreaterThanOrEqual(before + 42_000);
      expect(e.retryAt).toBeLessThanOrEqual(Date.now() + 42_000);
    });

    it('maps 403 with remaining=0 to the primary limit with retryAt = x-ratelimit-reset epoch', () => {
      const resetEpoch = Math.floor(Date.now() / 1000) + 1800;
      const e = classifyGitHubFailure(403, { get: (n) => (n === 'x-ratelimit-remaining' ? '0' : n === 'x-ratelimit-reset' ? String(resetEpoch) : null) }, '', 'anonymous');
      expect(e).toMatchObject({ code: 'rate-limited', httpStatus: 429 });
      expect(e.retryAt).toBe(resetEpoch * 1000);
    });

    it('maps a bare 429 to rate-limited with the 60 s floor', () => {
      const before = Date.now();
      const e = classifyGitHubFailure(429, { get: () => null }, '', 'anonymous');
      expect(e.code).toBe('rate-limited');
      expect(e.retryAt).toBeGreaterThanOrEqual(before + 60_000);
      expect(e.retryAt).toBeLessThanOrEqual(Date.now() + 60_000);
    });

    it('maps a 403 with no rate-limit markers to token-expired with the upstream message', () => {
      const e = classifyGitHubFailure(403, { get: () => null }, JSON.stringify({ message: 'Resource not accessible by integration' }), 'token');
      expect(e).toMatchObject({ code: 'token-expired', httpStatus: 401 });
      expect(e.message).toContain('Resource not accessible by integration');
    });

    it('distinguishes 404 by mode: anonymous gets the connect hint, connected is definitive', () => {
      const anon = classifyGitHubFailure(404, { get: () => null }, '', 'anonymous');
      const token = classifyGitHubFailure(404, { get: () => null }, '', 'token');
      expect(anon).toMatchObject({ code: 'repo-not-found-or-private', httpStatus: 404 });
      expect(anon.message).toContain('connect a GitHub account');
      expect(token).toMatchObject({ code: 'repo-not-found', httpStatus: 404 });
    });
  });

  describe('resolve URL parser', () => {
    it('accepts every documented form', () => {
      const base = { owner: 'octo-org', repo: 'purple-team' };
      expect(parseGitHubRepoUrl('https://github.com/octo-org/purple-team')).toEqual({ ok: true, value: base });
      expect(parseGitHubRepoUrl('https://github.com/octo-org/purple-team/')).toEqual({ ok: true, value: base });
      expect(parseGitHubRepoUrl('https://github.com/octo-org/purple-team.git')).toEqual({ ok: true, value: base });
      expect(parseGitHubRepoUrl('https://www.github.com/octo-org/purple-team')).toEqual({ ok: true, value: base });
      expect(parseGitHubRepoUrl('octo-org/purple-team')).toEqual({ ok: true, value: base });
      expect(parseGitHubRepoUrl('https://github.com/octo-org/purple-team/tree/v1.2.3'))
        .toEqual({ ok: true, value: { ...base, ref: 'v1.2.3' } });
      expect(parseGitHubRepoUrl('https://github.com/octo-org/purple-team/tree/feature%2Fblue'))
        .toEqual({ ok: true, value: { ...base, ref: 'feature/blue' } });
    });

    it('rejects other hosts, schemes, credentials, and malformed shapes', () => {
      for (const bad of [
        '',
        '   ',
        'https://gist.github.com/octo-org/gist-id',
        'https://api.github.com/repos/octo-org/purple-team',
        'https://raw.githubusercontent.com/octo-org/purple-team/main/x.ts',
        'http://github.com/octo-org/purple-team',
        'https://user:token@github.com/octo-org/purple-team',
        'evil.com/octo-org/purple-team',
        'github.com/octo-org/purple-team',
        'https://github.com/octo-org',
        'https://github.com/octo-org/purple-team/releases/tag/v1',
        'https://github.com/-badowner/purple-team',
        'https://github.com/octo--org/purple-team',
        'https://github.com/octo-org/.hidden',
        'https://github.com/octo-org/purple-team/tree/..',
        'x'.repeat(2049),
      ]) {
        expect(parseGitHubRepoUrl(bad).ok, `expected invalid: ${bad}`).toBe(false);
      }
    });

    it('delegates to parseRepoTarget: a bare owner/repo gives the same owner and repo as the full URL', () => {
      const full = parseGitHubRepoUrl('https://github.com/octo-org/purple-team');
      const bare = parseGitHubRepoUrl('octo-org/purple-team');
      expect(full).toEqual({ ok: true, value: { owner: 'octo-org', repo: 'purple-team' } });
      expect(bare).toEqual(full);
    });

    it('delegates to parseRepoTarget: a /blob/ URL is rejected as an unsupported view', () => {
      const result = parseGitHubRepoUrl('https://github.com/octo-org/purple-team/blob/main/src/x.ts');
      if (result.ok) throw new Error('expected /blob/ to be rejected');
      expect(result.message).toContain('/tree/');
    });
  });

  describe('resolveGitHubRepo', () => {
    it('maps the upstream repo record with ref defaulting to the default branch', async () => {
      const f = fakeApiFetch((url) => {
        expect(url).toBe('https://api.github.com/repos/octo-org/purple-team');
        return { ok: true, status: 200, body: repoRecord() };
      });

      const r = await resolveGitHubRepo({ owner: 'octo-org', repo: 'purple-team', fetchImpl: f });
      expect(r).toEqual({
        owner: 'octo-org',
        repo: 'purple-team',
        ref: 'main',
        defaultBranch: 'main',
        fullName: 'octo-org/purple-team',
        visibility: 'private',
        private: true,
        cloneUrl: 'https://github.com/octo-org/purple-team.git',
        htmlUrl: 'https://github.com/octo-org/purple-team',
        pushedAt: '2026-10-01T00:00:00Z',
        accessible: 'anonymous',
      });
      // Pinned headers on every proxied call.
      const h = headersOf(f.mock.calls[0]?.[1]);
      expect(h.Accept).toBe('application/vnd.github+json');
      expect(h['X-GitHub-Api-Version']).toBe('2026-03-10');
      expect(h['User-Agent']).toBeTruthy();
      expect(h.Authorization).toBeUndefined();
      expect(JSON.stringify(r)).not.toContain(TOKEN);
    });

    it('sends the Bearer token and marks access token-side when connected', async () => {
      const f = fakeApiFetch(() => ({ ok: true, status: 200, body: repoRecord() }));
      const r = await resolveGitHubRepo({ owner: 'octo-org', repo: 'purple-team', token: TOKEN, fetchImpl: f });
      expect(r.accessible).toBe('token');
      expect(headersOf(f.mock.calls[0]?.[1]).Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it('honors an explicit ref over the default branch', async () => {
      const f = fakeApiFetch(() => ({ ok: true, status: 200, body: repoRecord() }));
      const r = await resolveGitHubRepo({ owner: 'octo-org', repo: 'purple-team', ref: 'v1.2.3', fetchImpl: f });
      expect(r.ref).toBe('v1.2.3');
      expect(r.defaultBranch).toBe('main');
    });

    it('classifies 404 by mode end to end', async () => {
      const f = fakeApiFetch(() => ({ ok: false, status: 404, body: { message: 'Not Found' } }));
      await expect(resolveGitHubRepo({ owner: 'o', repo: 'r', fetchImpl: f }))
        .rejects.toMatchObject({ code: 'repo-not-found-or-private', httpStatus: 404 });
      __resetGitHubApiState();
      await expect(resolveGitHubRepo({ owner: 'o', repo: 'r', token: TOKEN, fetchImpl: f }))
        .rejects.toMatchObject({ code: 'repo-not-found', httpStatus: 404 });
    });

    it('maps 5xx and thrown fetches to network-error', async () => {
      const f5 = fakeApiFetch(() => ({ ok: false, status: 503, body: {} }));
      await expect(resolveGitHubRepo({ owner: 'o', repo: 'r', fetchImpl: f5 }))
        .rejects.toMatchObject({ code: 'network-error', httpStatus: 502 });

      const throwing = vi.fn(async (): Promise<never> => { throw new Error('ECONNRESET'); });
      await expect(resolveGitHubRepo({ owner: 'o', repo: 'r', fetchImpl: throwing }))
        .rejects.toMatchObject({ code: 'network-error', httpStatus: 502 });
    });

    it('auto-refreshes once on an auth failure and retries with the fresh token', async () => {
      let calls = 0;
      const f = fakeApiFetch((_url, init) => {
        calls += 1;
        if (headersOf(init).Authorization === `Bearer ${TOKEN}`) {
          return { ok: false, status: 401, body: { message: 'Bad credentials' } };
        }
        return { ok: true, status: 200, body: repoRecord() };
      });
      const onAuthFailure = vi.fn(async () => 'gho_FRESHFRESHFRESHFRESHFRESHFRESHFRESH');

      const r = await resolveGitHubRepo({ owner: 'o', repo: 'r', token: TOKEN, fetchImpl: f, onAuthFailure });
      expect(calls).toBe(2);
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
      expect(r.accessible).toBe('token');
    });

    it('does not retry anonymous calls and surfaces the classified error', async () => {
      const f = fakeApiFetch(() => ({ ok: false, status: 403, body: {}, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60) } }));
      await expect(resolveGitHubRepo({ owner: 'o', repo: 'r', fetchImpl: f, onAuthFailure: vi.fn() }))
        .rejects.toMatchObject({ code: 'rate-limited', httpStatus: 429 });
    });

    it('caches resolve results for 60 s per (owner, repo, ref, mode)', async () => {
      const f = fakeApiFetch(() => ({ ok: true, status: 200, body: repoRecord() }));
      await resolveGitHubRepo({ owner: 'o', repo: 'r', fetchImpl: f });
      await resolveGitHubRepo({ owner: 'o', repo: 'r', fetchImpl: f });
      expect(f).toHaveBeenCalledTimes(1);

      // Different mode → different cache key → refetch.
      await resolveGitHubRepo({ owner: 'o', repo: 'r', token: TOKEN, fetchImpl: f });
      expect(f).toHaveBeenCalledTimes(2);

      // Different repo → refetch.
      await resolveGitHubRepo({ owner: 'o', repo: 'other', fetchImpl: f });
      expect(f).toHaveBeenCalledTimes(3);

      // Cache drop → refetch.
      __resetGitHubApiState();
      await resolveGitHubRepo({ owner: 'o', repo: 'r', fetchImpl: f });
      expect(f).toHaveBeenCalledTimes(4);
    });
  });

  describe('listGitHubRepos', () => {
    it('proxies /user/repos with visibility+affiliation, never type, and maps rows', async () => {
      const f = fakeApiFetch((url) => {
        expect(url.startsWith('https://api.github.com/user/repos?')).toBe(true);
        expect(url).toContain('visibility=all');
        expect(url).toContain('affiliation=owner%2Ccollaborator%2Corganization_member');
        expect(url).toContain('sort=updated');
        expect(url).toContain('direction=desc');
        expect(url).toContain('per_page=50');
        expect(url).toContain('page=2');
        expect(url).not.toContain('type=');
        return {
          ok: true,
          status: 200,
          body: [repoRecord(), repoRecord({ name: 'public-thing', full_name: 'octo-org/public-thing', visibility: 'public', private: false, default_branch: null })],
          headers: { Link: '<https://api.github.com/user/repos?page=3>; rel="next", <https://api.github.com/user/repos?page=9>; rel="last"' },
        };
      });

      const page = await listGitHubRepos({ token: TOKEN, page: 2, perPage: 50, fetchImpl: f });
      expect(page).toMatchObject({ page: 2, perPage: 50, hasNext: true });
      expect(page.repositories).toEqual([
        expect.objectContaining({ owner: 'octo-org', repo: 'purple-team', visibility: 'private', private: true, defaultBranch: 'main' }),
        expect.objectContaining({ repo: 'public-thing', visibility: 'public', private: false, defaultBranch: 'HEAD' }),
      ]);
      expect(JSON.stringify(page)).not.toContain(TOKEN);
    });

    it('defaults and clamps pagination params, and reads hasNext from the Link header', async () => {
      const f = fakeApiFetch((url) => {
        expect(url).toContain('per_page=30');
        expect(url).toContain('page=1');
        expect(url).toContain('visibility=private');
        return { ok: true, status: 200, body: [], headers: {} };
      });
      const page = await listGitHubRepos({ token: TOKEN, visibility: 'private', fetchImpl: f });
      expect(page).toEqual({ repositories: [], page: 1, perPage: 30, hasNext: false });

      const clamped = await listGitHubRepos({ token: TOKEN, page: -3, perPage: 5000, fetchImpl: fakeApiFetch(() => ({ ok: true, status: 200, body: [] })) });
      expect(clamped.page).toBe(1);
      expect(clamped.perPage).toBe(100);
    });

    it('requires an auth failure to have a fresh token before retrying', async () => {
      let calls = 0;
      const f = fakeApiFetch(() => {
        calls += 1;
        return { ok: false, status: 401, body: { message: 'Bad credentials' } };
      });
      // Refresh unavailable (disconnected concurrently) → the classified error stands.
      await expect(listGitHubRepos({ token: TOKEN, fetchImpl: f, onAuthFailure: async () => undefined }))
        .rejects.toMatchObject({ code: 'token-expired', httpStatus: 401 });
      expect(calls).toBe(1);
    });

    it('caches pages per token fingerprint', async () => {
      const f = fakeApiFetch(() => ({ ok: true, status: 200, body: [] }));
      await listGitHubRepos({ token: TOKEN, fetchImpl: f });
      await listGitHubRepos({ token: TOKEN, fetchImpl: f });
      expect(f).toHaveBeenCalledTimes(1);
      await listGitHubRepos({ token: 'gho_DIFFERENTDIFFERENTDIFFERENTDIFF', fetchImpl: f });
      expect(f).toHaveBeenCalledTimes(2);
    });
  });

  it('uses the injected global fetch when no per-call impl is given', async () => {
    const f = fakeApiFetch(() => ({ ok: true, status: 200, body: repoRecord() }));
    setGitHubApiFetch(f);
    const r = await resolveGitHubRepo({ owner: 'o', repo: 'r' });
    expect(r.fullName).toBe('octo-org/purple-team');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-array /user/repos body as network-error', async () => {
    const f = fakeApiFetch(() => ({ ok: true, status: 200, body: { nope: true } }));
    await expect(listGitHubRepos({ token: TOKEN, fetchImpl: f })).rejects.toBeInstanceOf(GitHubApiError);
  });

  describe('resolve: slash-branch ref', () => {
    const OWNER = 'octo-org';
    const REPO = 'purple-team';

    // Answers the branch probe for the listed names (404 otherwise) and the repo record for every other URL.
    function branchFetch(branches: string[]) {
      return fakeApiFetch((url) => {
        const probe = url.split('/branches/')[1];
        if (probe === undefined) return { ok: true, status: 200, body: repoRecord() };
        const name = decodeURIComponent(probe);
        return branches.includes(name)
          ? { ok: true, status: 200, body: { name } }
          : { ok: false, status: 404, body: { message: 'Branch not found' } };
      });
    }

    function probedBranches(f: { mock: { calls: unknown[][] } }): string[] {
      return f.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/branches/'))
        .map((url) => decodeURIComponent(url.split('/branches/')[1]));
    }

    it('/tree/feature/blue resolves to the slash branch when the split ref is not a branch', async () => {
      const parsed = parseGitHubRepoUrl(`https://github.com/${OWNER}/${REPO}/tree/feature/blue`);
      if (!parsed.ok) throw new Error(parsed.message);
      expect(parsed.value).toEqual({ owner: OWNER, repo: REPO, ref: 'feature', subpath: 'blue' });

      const f = branchFetch(['feature/blue']);
      const r = await resolveGitHubRepo({ owner: OWNER, repo: REPO, ref: 'feature', subpath: 'blue', fetchImpl: f });
      expect(r.ref).toBe('feature/blue');
      expect(probedBranches(f)).toEqual(['feature', 'feature/blue']);
    });

    it('/tree/main/src keeps ref main when main is a branch, and main/src is never probed', async () => {
      const parsed = parseGitHubRepoUrl(`https://github.com/${OWNER}/${REPO}/tree/main/src`);
      if (!parsed.ok) throw new Error(parsed.message);
      expect(parsed.value).toEqual({ owner: OWNER, repo: REPO, ref: 'main', subpath: 'src' });

      const f = branchFetch(['main']);
      const r = await resolveGitHubRepo({ owner: OWNER, repo: REPO, ref: 'main', subpath: 'src', fetchImpl: f });
      expect(r.ref).toBe('main');
      expect(probedBranches(f)).toEqual(['main']);
    });

    it('keeps the parsed ref when no candidate is a branch (a tag or commit)', async () => {
      const f = branchFetch([]);
      const r = await resolveGitHubRepo({ owner: OWNER, repo: REPO, ref: 'v1.2.3', subpath: 'docs', fetchImpl: f });
      expect(r.ref).toBe('v1.2.3');
      expect(probedBranches(f)).toEqual(['v1.2.3', 'v1.2.3/docs']);
    });

    it('an encoded slash ref without a subpath is taken as written and never probed', async () => {
      const parsed = parseGitHubRepoUrl(`https://github.com/${OWNER}/${REPO}/tree/feature%2Fblue`);
      if (!parsed.ok) throw new Error(parsed.message);
      expect(parsed.value).toEqual({ owner: OWNER, repo: REPO, ref: 'feature/blue' });

      const f = branchFetch([]);
      const r = await resolveGitHubRepo({ owner: OWNER, repo: REPO, ref: 'feature/blue', fetchImpl: f });
      expect(r.ref).toBe('feature/blue');
      expect(probedBranches(f)).toEqual([]);
    });
  });
});
