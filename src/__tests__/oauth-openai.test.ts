import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  __resetOAuthState,
  __setOAuthNow,
  clearOAuth,
  completeOpenAiPkceFlow,
  ensureOAuthAccessToken,
  hasOAuth,
  oauthStatus,
  oauthStorePath,
  oauthVendorForProvider,
  peekOAuthAccessToken,
  peekOAuthIdToken,
  parseOpenAiAuthCode,
  startOpenAiPkceFlow,
} from '../llm/oauth.js';
import { config } from '../config/index.js';

function fakeFetch(handler: (url: string, init?: { body?: string; headers?: Record<string, string> }) => { ok: boolean; status: number; body: unknown }) {
  return vi.fn(async (url: string, init?: { body?: string; headers?: Record<string, string> }) => ({
    ok: handler(url, init).ok,
    status: handler(url, init).status,
    json: async () => handler(url, init).body,
    text: async () => JSON.stringify(handler(url, init).body),
  }));
}

/** Minimal unsigned JWT carrying a chatgpt_account_id claim (shape-matched, not signed). */
function makeIdToken(accountId: string): string {
  const seg = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${seg({ alg: 'none' })}.${seg({ chatgpt_account_id: accountId, email: 'op@example.com' })}.sig`;
}

describe('OpenAI (ChatGPT Plan) OAuth vendor', () => {
  const dirs: string[] = [];

  afterEach(() => {
    __resetOAuthState();
    __setOAuthNow(undefined);
    delete process.env.T3MP3ST_OAUTH_STORE;
    delete process.env.T3MP3ST_OPENAI_OAUTH_CLIENT_ID;
    delete process.env.T3MP3ST_OPENAI_OAUTH_AUTHORIZE;
    delete process.env.T3MP3ST_OPENAI_OAUTH_TOKEN;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function tempStore(): string {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-oauth-openai-'));
    dirs.push(dir);
    const path = join(dir, 'oauth.json');
    process.env.T3MP3ST_OAUTH_STORE = path;
    return path;
  }

  it('builds a ChatGPT PKCE authorize URL against auth.openai.com with the Codex public client', async () => {
    tempStore();
    const start = await startOpenAiPkceFlow();
    expect(start.authorizeUrl).toContain('https://auth.openai.com/oauth/authorize');
    expect(start.authorizeUrl).toContain('code_challenge_method=S256');
    expect(start.authorizeUrl).toContain('client_id=app_EMoamEEZ73f0CkXaXp7hrann');
    expect(start.authorizeUrl).toContain(`redirect_uri=${encodeURIComponent('http://localhost:1455/auth/callback')}`);
    expect(start.authorizeUrl).toContain(encodeURIComponent('offline_access'));
    expect(start.state).toBeTruthy();
    expect(start.flowId).toBeTruthy();
  });

  it('honors the T3MP3ST_OPENAI_OAUTH_* env overrides for client_id / authorize / token', async () => {
    tempStore();
    process.env.T3MP3ST_OPENAI_OAUTH_CLIENT_ID = 'app_custom_client';
    process.env.T3MP3ST_OPENAI_OAUTH_AUTHORIZE = 'https://auth.openai.com/oauth/authorize-alt';

    const start = await startOpenAiPkceFlow();
    expect(start.authorizeUrl).toContain('client_id=app_custom_client');
    expect(start.authorizeUrl).toContain('/oauth/authorize-alt');

    process.env.T3MP3ST_OPENAI_OAUTH_TOKEN = 'https://auth.openai.com/oauth/token-alt';
    const f = fakeFetch((url) => {
      expect(url).toBe('https://auth.openai.com/oauth/token-alt');
      return { ok: true, status: 200, body: { access_token: 'a', expires_in: 3600 } };
    });
    await completeOpenAiPkceFlow(start.flowId, `code#${start.state}`, { fetchImpl: f });
    expect(hasOAuth('openai')).toBe(true);
  });

  it('rejects an authorize URL whose host is off the allowlist', async () => {
    tempStore();
    process.env.T3MP3ST_OPENAI_OAUTH_AUTHORIZE = 'https://evil.example/oauth/authorize';
    await expect(startOpenAiPkceFlow()).rejects.toThrow(/allowed OAuth endpoint/i);
    expect(hasOAuth('openai')).toBe(false);
  });

  it('parses a raw code, code#state, and a full callback URL', () => {
    expect(parseOpenAiAuthCode('abc123')).toEqual({ code: 'abc123' });
    expect(parseOpenAiAuthCode('abc123#st')).toEqual({ code: 'abc123', state: 'st' });
    expect(parseOpenAiAuthCode('http://localhost:1455/auth/callback?code=xyz&state=s1'))
      .toEqual({ code: 'xyz', state: 's1' });
  });

  it('completes the PKCE exchange, persists tokens + id_token, and never leaks secrets via status', async () => {
    const path = tempStore();
    const start = await startOpenAiPkceFlow();

    const f = fakeFetch((url, init) => {
      expect(url).toBe('https://auth.openai.com/oauth/token');
      const body = JSON.parse(String(init?.body));
      expect(body.grant_type).toBe('authorization_code');
      expect(body.client_id).toBe('app_EMoamEEZ73f0CkXaXp7hrann');
      expect(body.code).toBe('authcode-1');
      expect(body.code_verifier).toBeTruthy();
      expect(body.state).toBe(start.state);
      expect(body.redirect_uri).toBe('http://localhost:1455/auth/callback');
      return {
        ok: true,
        status: 200,
        body: {
          access_token: 'openai-access-secret',
          refresh_token: 'openai-refresh-secret',
          id_token: makeIdToken('acct-123'),
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };
    });

    await completeOpenAiPkceFlow(start.flowId, `authcode-1#${start.state}`, { fetchImpl: f });
    expect(hasOAuth('openai')).toBe(true);
    expect(peekOAuthAccessToken('openai')).toBe('openai-access-secret');
    expect(peekOAuthIdToken('openai')).toContain('.');
    expect(oauthStatus().openai).toMatchObject({ connected: true, label: 'ChatGPT Plan' });
    expect(JSON.stringify(oauthStatus())).not.toContain('openai-access-secret');
    expect(JSON.stringify(oauthStatus())).not.toContain('acct-123');

    // 0600 store-file mode, secrets only inside the store (same contract as xai/anthropic).
    expect(oauthStorePath()).toBe(path);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, 'utf8')).toContain('openai-access-secret');

    clearOAuth('openai');
    expect(hasOAuth('openai')).toBe(false);
    expect(oauthStatus().openai.connected).toBe(false);
  });

  it('rejects a complete with a mismatched state and an unknown flow id', async () => {
    tempStore();
    const start = await startOpenAiPkceFlow();
    await expect(completeOpenAiPkceFlow(start.flowId, 'code#other-state')).rejects.toThrow(/state/i);
    expect(hasOAuth('openai')).toBe(false);
    await expect(completeOpenAiPkceFlow('no-such-flow', 'code')).rejects.toThrow(/unknown or expired ChatGPT login/i);
  });

  it('refreshes an expiring token and PRESERVES the stored id_token when refresh omits it', async () => {
    tempStore();
    const start = await startOpenAiPkceFlow();
    const t0 = 5_000_000;
    __setOAuthNow(() => t0);
    await completeOpenAiPkceFlow(start.flowId, `authcode-1#${start.state}`, {
      fetchImpl: fakeFetch(() => ({
        ok: true,
        status: 200,
        body: {
          access_token: 'old-access',
          refresh_token: 'old-refresh',
          id_token: makeIdToken('acct-123'),
          expires_in: 60,
        },
      })),
    });

    // Inside the 120s refresh-skew window (60s TTL) → refresh fires before inference.
    __setOAuthNow(() => t0 + 50_000);
    const refreshed = await ensureOAuthAccessToken('openai', {
      fetchImpl: fakeFetch((url, init) => {
        expect(url).toBe('https://auth.openai.com/oauth/token');
        const body = JSON.parse(String(init?.body));
        expect(body.grant_type).toBe('refresh_token');
        expect(body.client_id).toBe('app_EMoamEEZ73f0CkXaXp7hrann');
        expect(body.refresh_token).toBe('old-refresh');
        return { ok: true, status: 200, body: { access_token: 'new-access', expires_in: 3600 } };
      }),
    });
    expect(refreshed).toBe('new-access');
    expect(peekOAuthAccessToken('openai')).toBe('new-access');
    // The refresh response omitted id_token — the previously stored JWT must survive
    // intact, including the chatgpt_account_id claim the ChatGPT adapter decodes.
    const idToken = peekOAuthIdToken('openai');
    expect(idToken).toContain('.');
    const claim = JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8'));
    expect(claim).toMatchObject({ chatgpt_account_id: 'acct-123' });
  });

  it('surfaces a refresh failure past expiry when no refresh token was issued', async () => {
    tempStore();
    const start = await startOpenAiPkceFlow();
    const t0 = 5_000_000;
    __setOAuthNow(() => t0);
    await completeOpenAiPkceFlow(start.flowId, `authcode-1#${start.state}`, {
      fetchImpl: fakeFetch(() => ({
        ok: true,
        status: 200,
        body: { access_token: 'only-access', expires_in: 60 }, // no refresh_token issued
      })),
    });
    // Past expiry the refresh failure is no longer masked by the still-valid access
    // token — it throws honestly instead of serving a dead session.
    __setOAuthNow(() => t0 + 70_000);
    await expect(ensureOAuthAccessToken('openai')).rejects.toThrow(/no refresh token/i);
  });

  it('maps the chatgpt provider to the openai vendor and hydrates getLLMConfig with OAuth', async () => {
    tempStore();
    expect(oauthVendorForProvider('chatgpt')).toBe('openai');
    expect(oauthVendorForProvider('cursor')).toBeUndefined();

    const start = await startOpenAiPkceFlow();
    await completeOpenAiPkceFlow(start.flowId, `authcode-1#${start.state}`, {
      fetchImpl: fakeFetch(() => ({
        ok: true,
        status: 200,
        body: { access_token: 'chatgpt-plan-access', refresh_token: 'r', id_token: makeIdToken('acct-9'), expires_in: 3600 },
      })),
    });

    const cfg = config.getLLMConfig('chatgpt', 'gpt-5.1-codex');
    expect(cfg.authType).toBe('oauth');
    expect(cfg.apiKey).toBe('chatgpt-plan-access');
    expect(cfg.model).toBe('gpt-5.1-codex');
    expect(cfg.baseUrl).toBe('https://chatgpt.com/backend-api/codex');
    expect(config.getConfiguredProviders()).toContain('chatgpt');
  });
});
