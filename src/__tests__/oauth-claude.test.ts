import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import {
  __resetOAuthState,
  __setOAuthNow,
  clearOAuth,
  completeClaudePkceFlow,
  ensureOAuthAccessToken,
  hasOAuth,
  oauthStatus,
  oauthStorePath,
  oauthVendorForProvider,
  parseClaudeAuthCode,
  peekOAuthAccessToken,
  startClaudePkceFlow,
} from '../llm/oauth.js';
import { config } from '../config/index.js';

function fakeFetch(handler: (url: string, init?: { body?: string; headers?: Record<string, string> }) => { ok: boolean; status: number; body: unknown }) {
  return vi.fn(async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
    // Resolve the handler exactly once per fetch call so ok/status/json/text all
    // describe ONE round-trip — handler-side counters (the single-flight refresh
    // test) must count round-trips, not property reads (which triple-count).
    const res = handler(url, init);
    return {
      ok: res.ok,
      status: res.status,
      json: async () => res.body,
      text: async () => JSON.stringify(res.body),
    };
  });
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Happy-path token response; the tier/profile leg is degraded to a 429 unless a
 *  test overrides it (branching on URL keeps assertions from being swallowed by
 *  the non-fatal tier catch inside completeClaudePkceFlow). */
function claudeTokenFetch(tokenResponse: { ok?: boolean; status?: number; body?: Record<string, unknown> } = {}) {
  return fakeFetch((url) => {
    if (url === 'https://api.anthropic.com/api/oauth/profile') {
      return { ok: false, status: 429, body: { error: 'rate_limited' } };
    }
    return {
      ok: tokenResponse.ok ?? true,
      status: tokenResponse.status ?? 200,
      body: {
        access_token: 'sk-ant-oat01-access-secret',
        refresh_token: 'sk-ant-ort01-refresh-secret',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'user:inference user:profile',
        account: { email: 'operator@example.com' },
        organization: { organization_type: 'individual' },
        ...(tokenResponse.body ?? {}),
      },
    };
  });
}

describe('Claude (Pro/Max) OAuth vendor', () => {
  const dirs: string[] = [];
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    __resetOAuthState();
    __setOAuthNow(undefined);
    delete process.env.T3MP3ST_OAUTH_STORE;
    delete process.env.T3MP3ST_CLAUDE_OAUTH_CLIENT_ID;
    delete process.env.T3MP3ST_CLAUDE_OAUTH_AUTHORIZE;
    delete process.env.T3MP3ST_CLAUDE_OAUTH_TOKEN;
    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function tempStore(): string {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-oauth-claude-'));
    dirs.push(dir);
    const path = join(dir, 'oauth.json');
    process.env.T3MP3ST_OAUTH_STORE = path;
    return path;
  }

  it('builds a Claude PKCE authorize URL against claude.ai with the Claude Code public client', async () => {
    tempStore();
    const start = await startClaudePkceFlow();
    expect(start.authorizeUrl).toContain('https://claude.ai/oauth/authorize');
    expect(start.authorizeUrl).toContain('code_challenge_method=S256');
    expect(start.authorizeUrl).toContain('client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e');
    expect(start.authorizeUrl).toContain(`redirect_uri=${encodeURIComponent('https://platform.claude.com/oauth/code/callback')}`);
    // code=true makes the hosted callback page render a pasteable code.
    expect(start.authorizeUrl).toContain('code=true');
    // Least-privilege scope: inference + the profile read the tier label needs.
    expect(start.authorizeUrl).toContain('scope=user%3Ainference+user%3Aprofile');
    expect(start.state).toBeTruthy();
    expect(start.flowId).toBeTruthy();
  });

  it('exchanges an S256 verifier that recomputes to the authorize challenge', async () => {
    tempStore();
    const start = await startClaudePkceFlow();
    const challenge = new URL(start.authorizeUrl).searchParams.get('code_challenge');
    expect(challenge).toBeTruthy();

    let exchangedVerifier = '';
    const f = fakeFetch((url, init) => {
      if (url === 'https://api.anthropic.com/api/oauth/profile') {
        return { ok: false, status: 429, body: {} };
      }
      exchangedVerifier = JSON.parse(String(init?.body)).code_verifier;
      return { ok: true, status: 200, body: { access_token: 'a', expires_in: 3600 } };
    });
    await completeClaudePkceFlow(start.flowId, `authcode-1#${start.state}`, { fetchImpl: f });

    const recomputed = base64url(createHash('sha256').update(exchangedVerifier).digest());
    expect(recomputed).toBe(challenge);
  });

  it('honors the T3MP3ST_CLAUDE_OAUTH_* env overrides for client_id / authorize / token', async () => {
    tempStore();
    process.env.T3MP3ST_CLAUDE_OAUTH_CLIENT_ID = 'custom-client-id';
    process.env.T3MP3ST_CLAUDE_OAUTH_AUTHORIZE = 'https://claude.ai/oauth/authorize-alt';

    const start = await startClaudePkceFlow();
    expect(start.authorizeUrl).toContain('client_id=custom-client-id');
    expect(start.authorizeUrl).toContain('/oauth/authorize-alt');

    process.env.T3MP3ST_CLAUDE_OAUTH_TOKEN = 'https://platform.claude.com/v1/oauth/token-alt';
    const f = fakeFetch((url) => {
      if (url === 'https://api.anthropic.com/api/oauth/profile') {
        return { ok: false, status: 429, body: {} };
      }
      expect(url).toBe('https://platform.claude.com/v1/oauth/token-alt');
      return { ok: true, status: 200, body: { access_token: 'a', expires_in: 3600 } };
    });
    await completeClaudePkceFlow(start.flowId, `code#${start.state}`, { fetchImpl: f });
    expect(hasOAuth('claude')).toBe(true);
  });

  it('rejects authorize/token URLs that are off the allowlist or not https', async () => {
    tempStore();
    process.env.T3MP3ST_CLAUDE_OAUTH_AUTHORIZE = 'https://evil.example/oauth/authorize';
    await expect(startClaudePkceFlow()).rejects.toThrow(/allowed OAuth endpoint/i);

    process.env.T3MP3ST_CLAUDE_OAUTH_AUTHORIZE = 'http://claude.ai/oauth/authorize';
    await expect(startClaudePkceFlow()).rejects.toThrow(/must be https/i);

    // console.anthropic.com stays allowed so operators can repoint to the legacy host.
    process.env.T3MP3ST_CLAUDE_OAUTH_AUTHORIZE = 'https://console.anthropic.com/oauth/authorize';
    await expect(startClaudePkceFlow()).resolves.toHaveProperty('flowId');

    process.env.T3MP3ST_CLAUDE_OAUTH_AUTHORIZE = '';
    process.env.T3MP3ST_CLAUDE_OAUTH_TOKEN = 'https://evil.example/v1/oauth/token';
    const start = await startClaudePkceFlow();
    await expect(completeClaudePkceFlow(start.flowId, `code#${start.state}`))
      .rejects.toThrow(/allowed OAuth endpoint/i);
    expect(hasOAuth('claude')).toBe(false);
  });

  it('parses a raw code, code#state, and a full callback URL', () => {
    expect(parseClaudeAuthCode('abc123')).toEqual({ code: 'abc123' });
    expect(parseClaudeAuthCode('abc123#st')).toEqual({ code: 'abc123', state: 'st' });
    expect(parseClaudeAuthCode('https://platform.claude.com/oauth/code/callback?code=xyz&state=s1'))
      .toEqual({ code: 'xyz', state: 's1' });
  });

  it('completes the exchange with a JSON body + beta header (no claude-cli UA), persists 0600, and never leaks secrets via status', async () => {
    const path = tempStore();
    const start = await startClaudePkceFlow();
    const t0 = 5_000_000;
    __setOAuthNow(() => t0);

    const f = fakeFetch((url, init) => {
      if (url === 'https://api.anthropic.com/api/oauth/profile') {
        return { ok: false, status: 429, body: {} };
      }
      expect(url).toBe('https://platform.claude.com/v1/oauth/token');
      expect(init?.headers?.['Content-Type']).toBe('application/json');
      expect(init?.headers?.['anthropic-beta']).toBe('oauth-2025-04-20');
      // No spoofed Claude Code identity — the default UA rides the request (D6).
      for (const k of Object.keys(init?.headers || {})) expect(k.toLowerCase()).not.toBe('user-agent');
      const body = JSON.parse(String(init?.body));
      expect(body.grant_type).toBe('authorization_code');
      expect(body.client_id).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');
      expect(body.code).toBe('authcode-1');
      expect(body.code_verifier).toBeTruthy();
      expect(body.state).toBe(start.state);
      expect(body.redirect_uri).toBe('https://platform.claude.com/oauth/code/callback');
      expect(body.scope).toBe('user:inference user:profile');
      return {
        ok: true,
        status: 200,
        body: {
          access_token: 'sk-ant-oat01-access-secret',
          refresh_token: 'sk-ant-ort01-refresh-secret',
          expires_in: 28800,
          token_type: 'Bearer',
          scope: 'user:inference user:profile',
          account: { email: 'operator@example.com' },
          organization: { organization_type: 'individual' },
        },
      };
    });

    await completeClaudePkceFlow(start.flowId, `authcode-1#${start.state}`, { fetchImpl: f });
    expect(hasOAuth('claude')).toBe(true);
    expect(peekOAuthAccessToken('claude')).toBe('sk-ant-oat01-access-secret');
    // expires_in 28800 → expiresAt exactly 8 h out under the pinned clock.
    expect(oauthStatus().claude.expiresAt).toBe(t0 + 28_800_000);
    expect(oauthStatus().claude).toMatchObject({ connected: true, label: 'Claude Pro/Max' });
    expect(JSON.stringify(oauthStatus())).not.toContain('sk-ant-oat01-access-secret');
    expect(JSON.stringify(oauthStatus())).not.toContain('operator@example.com');

    // 0600 store; secrets only inside the store; response account email never persisted.
    expect(oauthStorePath()).toBe(path);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    const stored = readFileSync(path, 'utf8');
    expect(stored).toContain('sk-ant-oat01-access-secret');
    expect(stored).not.toContain('operator@example.com');

    clearOAuth('claude');
    expect(hasOAuth('claude')).toBe(false);
    expect(oauthStatus().claude.connected).toBe(false);
  });

  it('rejects a complete with a mismatched state, an unknown flow id, and an expired flow', async () => {
    tempStore();
    const start = await startClaudePkceFlow();
    await expect(completeClaudePkceFlow(start.flowId, 'code#other-state')).rejects.toThrow(/state/i);
    expect(hasOAuth('claude')).toBe(false);
    // The mismatched flow is destroyed — the same flowId cannot be retried.
    await expect(completeClaudePkceFlow(start.flowId, `code#${start.state}`)).rejects.toThrow(/unknown or expired Claude login/i);
    await expect(completeClaudePkceFlow('no-such-flow', 'code')).rejects.toThrow(/unknown or expired Claude login/i);

    const t0 = 1_000_000;
    __setOAuthNow(() => t0);
    const fresh = await startClaudePkceFlow();
    __setOAuthNow(() => t0 + 16 * 60 * 1000); // past the 15-min pending-flow TTL
    await expect(completeClaudePkceFlow(fresh.flowId, `code#${fresh.state}`)).rejects.toThrow(/timed out/i);
    expect(hasOAuth('claude')).toBe(false);
  });

  it('derives the plan tier from the OAuth profile without persisting the account payload', async () => {
    const path = tempStore();
    const start = await startClaudePkceFlow();

    const f = fakeFetch((url, init) => {
      if (url === 'https://api.anthropic.com/api/oauth/profile') {
        expect(init?.headers?.Authorization).toBe('Bearer sk-ant-oat01-access-secret');
        expect(init?.headers?.['anthropic-beta']).toBe('oauth-2025-04-20');
        return {
          ok: true,
          status: 200,
          body: {
            account: { email: 'operator@example.com', has_claude_max: true, has_claude_pro: false },
            organization: { organization_type: 'individual', rate_limit_tier: 'default_claude_max_20x' },
          },
        };
      }
      return {
        ok: true,
        status: 200,
        body: { access_token: 'sk-ant-oat01-access-secret', refresh_token: 'r', expires_in: 3600, scope: 'user:inference user:profile' },
      };
    });

    await completeClaudePkceFlow(start.flowId, `authcode-1#${start.state}`, { fetchImpl: f });
    expect(oauthStatus().claude.tier).toBe('Max 20x');
    const stored = readFileSync(path, 'utf8');
    expect(stored).toContain('Max 20x');
    expect(stored).not.toContain('operator@example.com');
    expect(stored).not.toContain('has_claude_max');
    expect(JSON.stringify(oauthStatus())).not.toContain('operator@example.com');

    clearOAuth('claude');
    expect(oauthStatus().claude.tier).toBeUndefined();
  });

  it('degrades to label-only status when the profile fetch fails', async () => {
    tempStore();
    const start = await startClaudePkceFlow();
    await completeClaudePkceFlow(start.flowId, `authcode-1#${start.state}`, {
      fetchImpl: claudeTokenFetch(),
    });
    expect(hasOAuth('claude')).toBe(true); // tier failure is non-fatal
    expect(oauthStatus().claude.tier).toBeUndefined();
  });

  it('refreshes an expiring token with rotation and shares ONE round-trip across concurrent callers', async () => {
    const path = tempStore();
    const start = await startClaudePkceFlow();
    const t0 = 5_000_000;
    __setOAuthNow(() => t0);
    await completeClaudePkceFlow(start.flowId, `authcode-1#${start.state}`, {
      fetchImpl: claudeTokenFetch({ body: { access_token: 'old-access', refresh_token: 'old-refresh', expires_in: 60 } }),
    });

    // Inside the 120s refresh-skew window (60s TTL) → refresh fires before inference.
    __setOAuthNow(() => t0 + 50_000);
    let tokenCalls = 0;
    const f = fakeFetch((url, init) => {
      if (url === 'https://api.anthropic.com/api/oauth/profile') {
        return { ok: false, status: 429, body: {} };
      }
      tokenCalls += 1;
      expect(url).toBe('https://platform.claude.com/v1/oauth/token');
      const body = JSON.parse(String(init?.body));
      expect(body.grant_type).toBe('refresh_token');
      expect(body.client_id).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');
      expect(body.refresh_token).toBe('old-refresh');
      expect(body.scope).toBe('user:inference user:profile');
      expect(init?.headers?.['anthropic-beta']).toBe('oauth-2025-04-20');
      return {
        ok: true,
        status: 200,
        body: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 },
      };
    });

    // Two concurrent callers (mission + chat) must share a single refresh: Claude
    // refresh tokens are single-use, so a second round-trip burns the rotation.
    const [a, b] = await Promise.all([
      ensureOAuthAccessToken('claude', { fetchImpl: f }),
      ensureOAuthAccessToken('claude', { fetchImpl: f }),
    ]);
    expect(a).toBe('new-access');
    expect(b).toBe('new-access');
    expect(tokenCalls).toBe(1);
    expect(peekOAuthAccessToken('claude')).toBe('new-access');
    // Rotation persisted: the NEW refresh token replaced the old one atomically.
    const stored = readFileSync(path, 'utf8');
    expect(stored).toContain('new-refresh');
    expect(stored).not.toContain('old-refresh');
  });

  it('marks needsReauth when the refresh token is spent, and keeps the old token on transient failure', async () => {
    tempStore();
    const start = await startClaudePkceFlow();
    const t0 = 5_000_000;
    __setOAuthNow(() => t0);
    await completeClaudePkceFlow(start.flowId, `authcode-1#${start.state}`, {
      fetchImpl: claudeTokenFetch({ body: { access_token: 'old-access', refresh_token: 'old-refresh', expires_in: 60 } }),
    });

    // Transient 5xx BEFORE expiry: keep the unexpired access token, no needsReauth.
    __setOAuthNow(() => t0 + 30_000);
    const transient = await ensureOAuthAccessToken('claude', {
      fetchImpl: claudeTokenFetch({ ok: false, status: 500, body: { error: 'server_error' } }),
    });
    expect(transient).toBe('old-access');
    expect(peekOAuthAccessToken('claude')).toBe('old-access');
    expect(oauthStatus().claude.needsReauth).toBeUndefined();

    // Past expiry with a spent (rotated) refresh token: honest failure + needsReauth.
    __setOAuthNow(() => t0 + 70_000);
    await expect(ensureOAuthAccessToken('claude', {
      fetchImpl: claudeTokenFetch({
        ok: false,
        status: 400,
        body: { error: 'invalid_grant', error_description: 'refresh token is no longer valid' },
      }),
    })).rejects.toThrow(/no longer valid/i);
    expect(oauthStatus().claude.needsReauth).toBe(true);
    expect(JSON.stringify(oauthStatus())).not.toContain('old-refresh');

    // Signing in again re-arms the flow and clears the flag.
    __setOAuthNow(() => t0 + 80_000);
    const again = await startClaudePkceFlow();
    await completeClaudePkceFlow(again.flowId, `authcode-2#${again.state}`, {
      fetchImpl: claudeTokenFetch({ body: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' } }),
    });
    expect(oauthStatus().claude.needsReauth).toBeUndefined();
    expect(peekOAuthAccessToken('claude')).toBe('fresh-access');
  });

  it('maps the anthropic provider to the claude vendor and hydrates getLLMConfig with OAuth (OAuth wins over the API key)', async () => {
    tempStore();
    expect(oauthVendorForProvider('anthropic')).toBe('claude');
    expect(oauthVendorForProvider('local-agent')).toBeUndefined();

    const start = await startClaudePkceFlow();
    await completeClaudePkceFlow(start.flowId, `authcode-1#${start.state}`, {
      fetchImpl: claudeTokenFetch({ body: { access_token: 'claude-sub-access' } }),
    });

    // A metered ANTHROPIC_API_KEY must NOT silently win over the subscription —
    // same rationale as the xai OAuth-wins hydration.
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-real-metered-key';
    const cfg = config.getLLMConfig('anthropic', 'claude-opus-4-8');
    expect(cfg.authType).toBe('oauth');
    expect(cfg.apiKey).toBe('claude-sub-access');
    expect(cfg.baseUrl).toBe('https://api.anthropic.com');
    expect(cfg.model).toBe('claude-opus-4-8');
    expect(config.getConfiguredProviders()).toContain('anthropic');
  });
});
