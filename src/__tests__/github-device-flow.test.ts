import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'node:path';
import {
  __resetGitHubState,
  __setGitHubNow,
  connectGitHubPat,
  pollGitHubDeviceFlow,
  startGitHubDeviceFlow,
} from '../github/oauth.js';
import { GitHubApiError, __resetGitHubApiState, listGitHubBranches } from '../github/api.js';

const DEVICE_CLIENT_ID_DEFAULT = '178c6fc778ccc68e1d6a';
const ACCESS = 'gho_DEVICEDEVICEDEVICEDEVICEDEVICEDEVICE';
const PAT = 'ghp_PATPATPATPATPATPATPATPATPATPATPATPAT';

const DEVICE_CODE_BODY = {
  device_code: 'dev-abc-123',
  user_code: 'AB12-CD34',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 5,
};

interface FetchInit {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
}

function fakeFetch(handler: (url: string, init?: FetchInit) => {
  ok: boolean;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  return vi.fn(async (url: string, init?: FetchInit) => {
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

/** Device-code start + /user profile in one stub; the token endpoint's answer is injected. */
function deviceFlowFetch(tokenAnswers: Record<string, unknown>[]) {
  let tokenCall = 0;
  return fakeFetch((url, init) => {
    if (url === 'https://github.com/login/device/code') {
      expect(init?.method).toBe('POST');
      return { ok: true, status: 200, body: DEVICE_CODE_BODY };
    }
    if (url.startsWith('https://github.com/login/oauth/access_token')) {
      expect(init?.method).toBe('POST');
      return { ok: true, status: 200, body: tokenAnswers[tokenCall++] };
    }
    if (url === 'https://api.github.com/user') {
      return { ok: true, status: 200, body: { login: 'octo-oper', avatar_url: 'https://avatars.githubusercontent.com/u/1' } };
    }
    return { ok: false, status: 404, body: { message: `unexpected ${url}` } };
  });
}

describe('GitHub zero-config device flow + PAT + branches', () => {
  const dirs: string[] = [];

  afterEach(() => {
    __resetGitHubState();
    __resetGitHubApiState();
    __setGitHubNow(undefined);
    delete process.env.T3MP3ST_GITHUB_OAUTH_STORE;
    delete process.env.T3MP3ST_GITHUB_DEVICE_CLIENT_ID;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function tempStore(): string {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-github-device-'));
    dirs.push(dir);
    const path = join(dir, 'github-oauth.json');
    process.env.T3MP3ST_GITHUB_OAUTH_STORE = path;
    return path;
  }

  describe('startGitHubDeviceFlow', () => {
    it('posts to github.com/login/device/code with the default client id and repo scope', async () => {
      const f = fakeFetch((url, init) => {
        expect(url).toBe('https://github.com/login/device/code');
        expect(init?.headers?.Accept).toBe('application/json');
        expect(decodeURIComponent(init?.body ?? '')).toContain('client_id=178c6fc778ccc68e1d6a');
        expect(decodeURIComponent(init?.body ?? '')).toContain('scope=repo read:user');
        return { ok: true, status: 200, body: DEVICE_CODE_BODY };
      });
      const start = await startGitHubDeviceFlow({ fetchImpl: f });
      expect(start).toEqual({
        flowId: expect.any(String),
        userCode: 'AB12-CD34',
        verificationUri: 'https://github.com/login/device',
        expiresIn: 900,
        interval: 5,
      });
      expect(start.flowId.length).toBeGreaterThanOrEqual(16);
    });

    it('honors T3MP3ST_GITHUB_DEVICE_CLIENT_ID over the default', async () => {
      process.env.T3MP3ST_GITHUB_DEVICE_CLIENT_ID = 'Iv1.custom.client';
      const f = fakeFetch(() => ({ ok: true, status: 200, body: DEVICE_CODE_BODY }));
      await startGitHubDeviceFlow({ fetchImpl: f });
      const body = String(f.mock.calls[0]?.[1]?.body ?? '');
      expect(decodeURIComponent(body)).toContain('client_id=Iv1.custom.client');
      expect(body).not.toContain(DEVICE_CLIENT_ID_DEFAULT);
    });

    it('rejects a malformed device-code response', async () => {
      const f = fakeFetch(() => ({ ok: true, status: 200, body: { user_code: 'AB12-CD34' } }));
      await expect(startGitHubDeviceFlow({ fetchImpl: f })).rejects.toMatchObject({ code: 'exchange-failed' });
    });
  });

  describe('pollGitHubDeviceFlow', () => {
    it('walks pending → slow_down → connected and persists a refresh-free token', async () => {
      const path = tempStore();
      const f = deviceFlowFetch([
        { error: 'authorization_pending' },
        { error: 'slow_down' },
        { access_token: ACCESS, token_type: 'bearer', scope: 'repo read:user' },
      ]);
      const start = await startGitHubDeviceFlow({ fetchImpl: f });

      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).resolves.toEqual({ status: 'pending', interval: 5 });
      // slow_down bumps the polling interval by 5 s and stays replayable.
      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).resolves.toEqual({ status: 'pending', interval: 10 });

      const tokenBody = decodeURIComponent(String(f.mock.calls[1]?.[1]?.body ?? ''));
      expect(tokenBody).toContain('grant_type=urn:ietf:params:oauth:grant-type:device_code');
      expect(tokenBody).toContain('device_code=dev-abc-123');
      expect(tokenBody).toContain(`client_id=${DEVICE_CLIENT_ID_DEFAULT}`);

      const connected = await pollGitHubDeviceFlow(start.flowId, { fetchImpl: f });
      expect(connected.status).toBe('connected');
      if (connected.status !== 'connected') throw new Error('expected connected');
      expect(connected.github).toMatchObject({
        connected: true,
        mode: 'connected',
        login: 'octo-oper',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1',
        scopes: ['repo', 'read:user'],
      });
      expect(JSON.stringify(connected)).not.toContain(ACCESS);

      const store = JSON.parse(readFileSync(path, 'utf8')) as { tokens?: { accessToken?: string; refreshToken?: string } };
      expect(store.tokens?.accessToken).toBe(ACCESS);
      expect(store.tokens?.refreshToken).toBeUndefined();

      // The flow is consumed by the terminal answer.
      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).rejects.toMatchObject({ code: 'unknown-flow', httpStatus: 404 });
    });

    it('clears the flow and 410s on expired_token', async () => {
      tempStore();
      const f = deviceFlowFetch([{ error: 'expired_token' }]);
      const start = await startGitHubDeviceFlow({ fetchImpl: f });
      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).rejects.toMatchObject({ code: 'flow-expired', httpStatus: 410 });
      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).rejects.toMatchObject({ code: 'unknown-flow' });
    });

    it('clears the flow and 403s on access_denied', async () => {
      tempStore();
      const f = deviceFlowFetch([{ error: 'access_denied' }]);
      const start = await startGitHubDeviceFlow({ fetchImpl: f });
      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).rejects.toMatchObject({ code: 'access-denied', httpStatus: 403 });
      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).rejects.toMatchObject({ code: 'unknown-flow' });
    });

    it('enforces the local TTL without touching the network', async () => {
      tempStore();
      const f = deviceFlowFetch([{ error: 'authorization_pending' }]);
      let clock = 1_000_000;
      __setGitHubNow(() => clock);
      const start = await startGitHubDeviceFlow({ fetchImpl: f });
      clock += 901_000; // device_code TTL is 900 s
      await expect(pollGitHubDeviceFlow(start.flowId, { fetchImpl: f })).rejects.toMatchObject({ code: 'flow-expired', httpStatus: 410 });
      expect(f).toHaveBeenCalledTimes(1); // only the device-code start — no token POST
    });

    it('answers unknown-flow for a flowId that was never started', async () => {
      tempStore();
      await expect(pollGitHubDeviceFlow('nope', { fetchImpl: fakeFetch(() => ({ ok: true, status: 200, body: {} })) }))
        .rejects.toMatchObject({ code: 'unknown-flow', httpStatus: 404 });
    });
  });

  describe('connectGitHubPat', () => {
    it('validates via GET /user, derives scopes from x-oauth-scopes, and persists', async () => {
      const path = tempStore();
      const f = fakeFetch((url, init) => {
        expect(url).toBe('https://api.github.com/user');
        expect(init?.headers?.Authorization).toBe(`Bearer ${PAT}`);
        return {
          ok: true,
          status: 200,
          body: { login: 'pat-oper', avatar_url: 'https://avatars.githubusercontent.com/u/9' },
          headers: { 'x-oauth-scopes': 'repo, read:user, workflow' },
        };
      });
      const status = await connectGitHubPat(PAT, { fetchImpl: f });
      expect(status).toMatchObject({
        connected: true,
        mode: 'connected',
        login: 'pat-oper',
        avatarUrl: 'https://avatars.githubusercontent.com/u/9',
        scopes: ['repo', 'read:user', 'workflow'],
      });
      expect(JSON.stringify(status)).not.toContain(PAT);
      const store = JSON.parse(readFileSync(path, 'utf8')) as { tokens?: Record<string, unknown> };
      expect(store.tokens).toMatchObject({ accessToken: PAT, tokenType: 'bearer', scopes: ['repo', 'read:user', 'workflow'] });
      expect(store.tokens?.refreshToken).toBeUndefined();
      expect(store.tokens?.expiresAt).toBeUndefined();
    });

    it('falls back to the requested scopes when x-oauth-scopes is absent', async () => {
      tempStore();
      const f = fakeFetch(() => ({ ok: true, status: 200, body: { login: 'pat-oper' } }));
      const status = await connectGitHubPat(PAT, { fetchImpl: f });
      expect(status.scopes).toEqual(['repo', 'read:user']);
    });

    it('rejects a bad PAT as invalid-token without touching the store', async () => {
      const path = tempStore();
      const f = fakeFetch(() => ({ ok: false, status: 401, body: { message: 'Bad credentials' } }));
      await expect(connectGitHubPat('ghp_wrong', { fetchImpl: f })).rejects.toMatchObject({
        code: 'invalid-token',
        httpStatus: 401,
      });
      expect(() => readFileSync(path, 'utf8')).toThrow();
    });
  });

  describe('listGitHubBranches', () => {
    const BRANCHES = [
      { name: 'main', commit: { sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0' }, protected: true },
      { name: 'dev', commit: { sha: '0b1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b' }, protected: false },
    ];

    it('proxies /branches tokened with Link-header pagination', async () => {
      const f = fakeFetch((url, init) => {
        expect(url).toBe('https://api.github.com/repos/octo-org/purple-team/branches?per_page=30&page=1');
        expect(init?.headers?.Authorization).toBe(`Bearer ${ACCESS}`);
        return {
          ok: true,
          status: 200,
          body: BRANCHES,
          headers: { Link: '<https://api.github.com/repos/octo-org/purple-team/branches?page=2>; rel="next"' },
        };
      });
      const page = await listGitHubBranches({ owner: 'octo-org', repo: 'purple-team', token: ACCESS, fetchImpl: f });
      expect(page).toEqual({
        branches: [
          { name: 'main', commitSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', protected: true },
          { name: 'dev', commitSha: '0b1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', protected: false },
        ],
        page: 1,
        perPage: 30,
        hasNext: true,
      });
      expect(JSON.stringify(page)).not.toContain(ACCESS);
    });

    it('lists anonymously (no Authorization header) and defaults hasNext to false', async () => {
      const f = fakeFetch((url, init) => {
        expect(url).toBe('https://api.github.com/repos/octo-org/purple-team/branches?per_page=30&page=2');
        expect(init?.headers?.Authorization).toBeUndefined();
        return { ok: true, status: 200, body: [] };
      });
      const page = await listGitHubBranches({ owner: 'octo-org', repo: 'purple-team', page: 2, fetchImpl: f });
      expect(page).toEqual({ branches: [], page: 2, perPage: 30, hasNext: false });
    });

    it('clamps perPage into 1..100 and page to >= 1', async () => {
      const f = fakeFetch((url) => {
        expect(url).toContain('per_page=100');
        expect(url).toContain('page=1');
        return { ok: true, status: 200, body: [] };
      });
      const page = await listGitHubBranches({ owner: 'o', repo: 'r', page: -3, perPage: 5000, fetchImpl: f });
      expect(page).toMatchObject({ page: 1, perPage: 100 });
    });

    it('rejects a non-array body as network-error', async () => {
      const f = fakeFetch(() => ({ ok: true, status: 200, body: { nope: true } }));
      await expect(listGitHubBranches({ owner: 'o', repo: 'r', fetchImpl: f })).rejects.toBeInstanceOf(GitHubApiError);
    });
  });

  describe('route registration (static contract)', () => {
    const server = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

    it('registers the four zero-config routes', () => {
      expect(server).toContain("app.get('/api/oauth/github/device'");
      expect(server).toContain("app.post('/api/oauth/github/device'");
      expect(server).toContain("app.post('/api/oauth/github/token'");
      expect(server).toContain("app.get('/api/github/branches'");
    });

    it('wires the new module functions and never echoes a token in a response', () => {
      const routes = server.slice(
        server.indexOf("app.get('/api/oauth/github/device'"),
        server.indexOf("app.get('/api/teams/tool-grants'"),
      );
      expect(routes).toContain('startGitHubDeviceFlow');
      expect(routes).toContain('pollGitHubDeviceFlow');
      expect(routes).toContain('connectGitHubPat');
      expect(routes).toContain('listGitHubBranches');
      expect(routes).not.toMatch(/res\.(send|json)\([^)]*(?<!\.)token/i);
    });
  });
});
