import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import {
  GitHubOAuthError,
  __resetGitHubState,
  __setGitHubNow,
  completeGitHubFlow,
  consumeGitHubFlowState,
  disconnectGitHub,
  ensureGitHubAccessToken,
  githubCallbackPage,
  githubRedirectUri,
  githubStatus,
  githubStorePath,
  parseGitHubAuthCode,
  peekGitHubAccessToken,
  startGitHubPkceFlow,
} from '../github/oauth.js';

const ACCESS = 'gho_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const REFRESH = 'ghr_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function fakeFetch(handler: (url: string, init?: { body?: string; headers?: Record<string, string>; method?: string }) => { ok: boolean; status: number; body: unknown }) {
  return vi.fn(async (url: string, init?: { body?: string; headers?: Record<string, string>; method?: string }) => ({
    ok: handler(url, init).ok,
    status: handler(url, init).status,
    json: async () => handler(url, init).body,
    text: async () => JSON.stringify(handler(url, init).body),
  }));
}

/** Full happy-path handler: token exchange + /user identity in one fetch stub. */
function connectFetch() {
  return fakeFetch((url) => {
    if (url.startsWith('https://github.com/login/oauth/access_token')) {
      return { ok: true, status: 200, body: { access_token: ACCESS, refresh_token: REFRESH, expires_in: 28800, refresh_token_expires_in: 15897600, token_type: 'bearer', scope: 'repo read:user' } };
    }
    if (url === 'https://api.github.com/user') {
      return { ok: true, status: 200, body: { login: 'octo-oper', avatar_url: 'https://avatars.githubusercontent.com/u/1' } };
    }
    return { ok: false, status: 404, body: { message: `unexpected ${url}` } };
  });
}

describe('GitHub OAuth App connection', () => {
  const dirs: string[] = [];

  afterEach(() => {
    __resetGitHubState();
    __setGitHubNow(undefined);
    delete process.env.T3MP3ST_GITHUB_OAUTH_STORE;
    delete process.env.T3MP3ST_GITHUB_OAUTH_CLIENT_ID;
    delete process.env.T3MP3ST_GITHUB_OAUTH_CLIENT_SECRET;
    delete process.env.T3MP3ST_GITHUB_OAUTH_REDIRECT_URI;
    delete process.env.T3MP3ST_PORT;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function configure(): void {
    process.env.T3MP3ST_GITHUB_OAUTH_CLIENT_ID = 'Iv1.cli.github.abc123';
    process.env.T3MP3ST_GITHUB_OAUTH_CLIENT_SECRET = 'sekrit-123';
  }

  function tempStore(): string {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-github-oauth-'));
    dirs.push(dir);
    const path = join(dir, 'github-oauth.json');
    process.env.T3MP3ST_GITHUB_OAUTH_STORE = path;
    return path;
  }

  /** Seed a connected store directly (refresh-lifecycle tests bypass the flow). */
  function seedTokens(overrides: Partial<{ accessToken: string; refreshToken: string; expiresAt: number }> = {}): void {
    const path = githubStorePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({
      tokens: {
        accessToken: overrides.accessToken ?? ACCESS,
        refreshToken: overrides.refreshToken ?? REFRESH,
        expiresAt: overrides.expiresAt ?? Date.now() + 3600_000,
        refreshTokenExpiresAt: Date.now() + 90 * 24 * 3600_000,
        tokenType: 'bearer',
        scopes: ['repo', 'read:user'],
        obtainedAt: Date.now(),
      },
      profile: { login: 'octo-oper', avatarUrl: 'https://avatars.githubusercontent.com/u/1' },
    }), { encoding: 'utf8', mode: 0o600 });
    __resetGitHubState(); // drop the cache so the next read sees the seeded file
  }

  it('answers not-configured when the env keys are absent', async () => {
    tempStore();
    await expect(startGitHubPkceFlow()).rejects.toMatchObject({ code: 'not-configured' });
    await expect(completeGitHubFlow('s', 'c')).rejects.toMatchObject({ code: 'not-configured' });
    expect(githubStatus()).toMatchObject({ configured: false, connected: false, mode: 'anonymous' });
  });

  it('derives the redirect URI from T3MP3ST_PORT with a verbatim env override', () => {
    expect(githubRedirectUri()).toBe('http://127.0.0.1:3333/api/oauth/github/callback');
    process.env.T3MP3ST_PORT = '4567';
    expect(githubRedirectUri()).toBe('http://127.0.0.1:4567/api/oauth/github/callback');
    process.env.T3MP3ST_GITHUB_OAUTH_REDIRECT_URI = 'https://proxy.example/api/oauth/github/callback';
    expect(githubRedirectUri()).toBe('https://proxy.example/api/oauth/github/callback');
    expect(githubStatus().redirectUri).toBe('https://proxy.example/api/oauth/github/callback');
  });

  it('starts a PKCE S256 flow with a 43-char challenge and %20-encoded scopes', async () => {
    tempStore();
    configure();
    const start = await startGitHubPkceFlow();
    expect(start.state).toBeTruthy();

    const url = new URL(start.authorizeUrl);
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('Iv1.cli.github.abc123');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:3333/api/oauth/github/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toBe(start.state);
    // Space is %20, never '+': GitHub expects RFC 3986 encoding for scope.
    expect(url.search).toContain('scope=repo%20read%3Auser');
  });

  it('exchanges the code with client_secret AND the PKCE verifier bound to the challenge', async () => {
    tempStore();
    configure();
    const start = await startGitHubPkceFlow();
    const f = connectFetch();

    const status = await completeGitHubFlow(start.state, 'code-xyz', { fetchImpl: f });
    expect(status).toMatchObject({ configured: true, connected: true, mode: 'connected', login: 'octo-oper' });

    const exchange = f.mock.calls.find(([u]) => u === 'https://github.com/login/oauth/access_token');
    expect(exchange).toBeTruthy();
    const body = String(exchange?.[1]?.body);
    expect(body).toContain('client_id=Iv1.cli.github.abc123');
    expect(body).toContain('client_secret=sekrit-123');
    expect(body).toContain('code=code-xyz');
    expect(body).toContain('redirect_uri=');
    const verifier = /code_verifier=([^&]+)/.exec(body)?.[1] ?? '';
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // S256: challenge === base64url(sha256(verifier)) from the start URL.
    const challenge = new URL(start.authorizeUrl).searchParams.get('code_challenge');
    const recomputed = createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(challenge).toBe(recomputed);
  });

  it('treats state as single-use and rejects unknown or expired flows', async () => {
    tempStore();
    configure();
    const start = await startGitHubPkceFlow();

    const first = await completeGitHubFlow(start.state, 'code-1', { fetchImpl: connectFetch() });
    expect(first.connected).toBe(true);

    // Replay of the SAME state (even with a fresh code) is burned.
    await expect(completeGitHubFlow(start.state, 'code-2', { fetchImpl: connectFetch() }))
      .rejects.toMatchObject({ code: 'unknown-state' });
    await expect(completeGitHubFlow('never-started', 'code-3', { fetchImpl: connectFetch() }))
      .rejects.toMatchObject({ code: 'unknown-state' });
    await expect(completeGitHubFlow(undefined, 'code-4', { fetchImpl: connectFetch() }))
      .rejects.toMatchObject({ code: 'state-mismatch' });

    // Expired flow: advance the clock past the 15-min TTL.
    let now = Date.now();
    __setGitHubNow(() => now);
    const second = await startGitHubPkceFlow();
    now += 16 * 60 * 1000;
    await expect(completeGitHubFlow(second.state, 'code-5', { fetchImpl: connectFetch() }))
      .rejects.toMatchObject({ code: 'expired-state' });
  });

  it('consumes the state on consent denial so it cannot be replayed', async () => {
    tempStore();
    configure();
    const start = await startGitHubPkceFlow();
    consumeGitHubFlowState(start.state);
    await expect(completeGitHubFlow(start.state, 'code-1', { fetchImpl: connectFetch() }))
      .rejects.toMatchObject({ code: 'unknown-state' });
  });

  it('keeps tokens out of status, completion payloads, and the callback page', async () => {
    tempStore();
    configure();
    const start = await startGitHubPkceFlow();
    const status = await completeGitHubFlow(start.state, 'code-1', { fetchImpl: connectFetch() });

    const serialized = JSON.stringify({ status, page: githubCallbackPage('connected', { login: status.login }) });
    expect(serialized).not.toContain(ACCESS);
    expect(serialized).not.toContain(REFRESH);
    expect(serialized).not.toContain('accessToken');
    // Key-presence check that survives the legitimate refreshTokenExpiresAt field.
    expect(serialized).not.toContain('"refreshToken":');
    expect(serialized).not.toContain('gho_');
    expect(serialized).not.toContain('ghr_');

    // Status still carries the meaningful projection.
    expect(status).toMatchObject({
      configured: true,
      connected: true,
      login: 'octo-oper',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      scopes: ['repo', 'read:user'],
      mode: 'connected',
    });
    expect(typeof status.expiresAt).toBe('number');
    expect(typeof status.refreshTokenExpiresAt).toBe('number');
  });

  it('HTML-escapes the login on the callback page', () => {
    const page = githubCallbackPage('connected', { login: '<script>alert(1)</script>' });
    expect(page).toContain('@&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(page).not.toContain('<script>');
    expect(githubCallbackPage('denied')).toContain('Connection cancelled');
    expect(githubCallbackPage('expired')).toContain('Sign-in link expired');
    expect(githubCallbackPage('failed', { message: 'boom & "<x>"' })).toContain('boom &amp; &quot;&lt;x&gt;&quot;');
  });

  it('writes a 0600 store that survives a cache reset and clears on logout', async () => {
    const path = tempStore();
    configure();
    const start = await startGitHubPkceFlow();
    await completeGitHubFlow(start.state, 'code-1', { fetchImpl: connectFetch() });

    expect(path).toBe(githubStorePath());
    expect((statSync(path).mode & 0o777)).toBe(0o600);
    const persisted = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    expect(persisted.profile).toEqual({ login: 'octo-oper', avatarUrl: 'https://avatars.githubusercontent.com/u/1' });

    // Simulates a module reload: cache dropped, store re-read from disk.
    __resetGitHubState();
    expect(githubStatus().connected).toBe(true);
    expect(peekGitHubAccessToken()).toBe(ACCESS);

    await disconnectGitHub({ fetchImpl: fakeFetch(() => ({ ok: true, status: 204, body: {} })) });
    expect(githubStatus().connected).toBe(false);
    expect(peekGitHubAccessToken()).toBeUndefined();
    expect((JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>).tokens).toBeUndefined();
  });

  it('refreshes an inside-skew token exactly once across concurrent callers (single-flight)', async () => {
    tempStore();
    configure();
    seedTokens({ expiresAt: Date.now() + 30_000 }); // inside the 120 s skew

    const f = fakeFetch((url) => {
      if (url.startsWith('https://github.com/login/oauth/access_token')) {
        return {
          ok: true,
          status: 200,
          body: { access_token: 'gho_NEWNEWNEWNEWNEWNEWNEWNEWNEWNEWNEWNEW', refresh_token: 'ghr_ROTATEDROTATEDROTATEDROTATEDROTATED1', expires_in: 28800 },
        };
      }
      return { ok: false, status: 404, body: {} };
    });

    const [a, b] = await Promise.all([
      ensureGitHubAccessToken({ fetchImpl: f }),
      ensureGitHubAccessToken({ fetchImpl: f }),
    ]);
    expect(a).toBe('gho_NEWNEWNEWNEWNEWNEWNEWNEWNEWNEWNEWNEW');
    expect(b).toBe(a);
    // ONE upstream refresh for two concurrent callers — rotation is not burned.
    expect(f.mock.calls.filter(([u]) => u === 'https://github.com/login/oauth/access_token')).toHaveLength(1);

    // Atomic rotation: both new values persisted, old ones gone.
    const status = githubStatus();
    expect(peekGitHubAccessToken()).toBe('gho_NEWNEWNEWNEWNEWNEWNEWNEWNEWNEWNEWNEW');
    expect(JSON.stringify(status)).not.toContain(REFRESH);
    expect(status.scopes).toEqual(['repo', 'read:user']); // scope survives an echo-less refresh
    expect(status.login).toBe('octo-oper'); // profile survives rotation
  });

  it('leaves a fresh token alone (no eager refresh outside the skew window)', async () => {
    tempStore();
    configure();
    seedTokens({ expiresAt: Date.now() + 3600_000 });
    const f = connectFetch();
    await expect(ensureGitHubAccessToken({ fetchImpl: f })).resolves.toBe(ACCESS);
    expect(f).not.toHaveBeenCalled();
  });

  it('clears the store when GitHub definitively rejects the refresh token', async () => {
    tempStore();
    configure();
    seedTokens({ expiresAt: Date.now() + 30_000 });
    const f = fakeFetch((url) => {
      if (url.startsWith('https://github.com/login/oauth/access_token')) {
        return { ok: false, status: 400, body: { error: 'bad_refresh_token' } };
      }
      return { ok: false, status: 404, body: {} };
    });

    const attempt = ensureGitHubAccessToken({ fetchImpl: f });
    await expect(attempt).rejects.toBeInstanceOf(GitHubOAuthError);
    await expect(attempt).rejects.toMatchObject({ code: 'token-expired' });
    // Store is cleared: further calls have nothing to refresh and resolve undefined.
    await expect(ensureGitHubAccessToken({ fetchImpl: f })).resolves.toBeUndefined();
    expect(githubStatus().connected).toBe(false);
    expect(peekGitHubAccessToken()).toBeUndefined();
  });

  it('attempts the DELETE-grant revocation with Basic auth and clears locally even when GitHub refuses', async () => {
    tempStore();
    configure();
    seedTokens();
    const f = fakeFetch((url) => {
      if (url === 'https://api.github.com/applications/Iv1.cli.github.abc123/grant') {
        return { ok: false, status: 401, body: { message: 'Bad credentials' } };
      }
      return { ok: false, status: 404, body: {} };
    });

    await disconnectGitHub({ fetchImpl: f });

    const call = f.mock.calls.find(([u]) => u === 'https://api.github.com/applications/Iv1.cli.github.abc123/grant');
    expect(call).toBeTruthy();
    expect(call?.[1]?.method).toBe('DELETE');
    expect(call?.[1]?.headers?.Authorization).toBe(`Basic ${Buffer.from('Iv1.cli.github.abc123:sekrit-123').toString('base64')}`);
    expect(String(call?.[1]?.body)).toContain(ACCESS);
    // Local disconnection is the guarantee regardless of the upstream answer.
    expect(githubStatus().connected).toBe(false);
    expect(githubStatus().mode).toBe('anonymous');
  });

  it('parses pasted callbacks: raw code, code#state, and full URL', () => {
    expect(parseGitHubAuthCode('abc123')).toEqual({ code: 'abc123' });
    expect(parseGitHubAuthCode('abc123#st4te')).toEqual({ code: 'abc123', state: 'st4te' });
    expect(parseGitHubAuthCode('http://127.0.0.1:3333/api/oauth/github/callback?code=abc&state=st'))
      .toEqual({ code: 'abc', state: 'st' });
  });
});
