import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  __resetOAuthState,
  __setOAuthNow,
  completeOpenAiPkceFlow,
  hasOAuth,
  peekOAuthAccessToken,
  setOAuthFetch,
  startOpenAiPkceFlow,
} from '../llm/oauth.js';
import { config } from '../config/index.js';
import { createChatGPTBackbone } from '../llm/index.js';

const dirs: string[] = [];

function fakeFetch(handler: (url: string, init?: { body?: string; headers?: Record<string, string> }) => { ok: boolean; status: number; body: unknown }) {
  return vi.fn(async (url: string, init?: { body?: string; headers?: Record<string, string> }) => ({
    ok: handler(url, init).ok,
    status: handler(url, init).status,
    json: async () => handler(url, init).body,
    text: async () => JSON.stringify(handler(url, init).body),
  }));
}

function makeIdToken(accountId: string): string {
  const seg = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${seg({ alg: 'none' })}.${seg({ chatgpt_account_id: accountId })}.sig`;
}

/** Sign in the 'openai' OAuth vendor against a temp store (id_token carries acct-123). */
async function signIn(accessToken: string, opts: { expiresIn?: number; idToken?: string } = {}): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 't3mp3st-chatgpt-'));
  dirs.push(dir);
  process.env.T3MP3ST_OAUTH_STORE = join(dir, 'oauth.json');
  __setOAuthNow(() => 1_000_000);
  const start = await startOpenAiPkceFlow();
  await completeOpenAiPkceFlow(start.flowId, `authcode-1#${start.state}`, {
    fetchImpl: fakeFetch(() => ({
      ok: true,
      status: 200,
      body: {
        access_token: accessToken,
        refresh_token: 'refresh-secret',
        id_token: opts.idToken ?? makeIdToken('acct-123'),
        expires_in: opts.expiresIn ?? 3600,
      },
    })),
  });
}

describe('ChatGPT Plan provider', () => {
  const originalFetch = global.fetch;
  let fetchSpy: Mock;

  afterEach(() => {
    __resetOAuthState();
    __setOAuthNow(undefined);
    setOAuthFetch(undefined);
    delete process.env.T3MP3ST_OAUTH_STORE;
    delete process.env.T3MP3ST_CHATGPT_BASE_URL;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('resolves the Codex backend base URL, default model, and OAuth bearer from getLLMConfig', async () => {
    await signIn('chatgpt-access-secret');
    const cfg = config.getLLMConfig('chatgpt');
    expect(cfg.provider).toBe('chatgpt');
    expect(cfg.authType).toBe('oauth');
    expect(cfg.apiKey).toBe('chatgpt-access-secret');
    expect(cfg.baseUrl).toBe('https://chatgpt.com/backend-api/codex');
    expect(cfg.model).toBe('gpt-5.1');
    expect(config.getConfiguredProviders()).toContain('chatgpt');
  });

  it('POSTs the Responses wire shape with Bearer + account-id headers and parses message/function_call output', async () => {
    await signIn('chatgpt-access-secret');
    fetchSpy = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gpt-5.1-codex',
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'plan ready' }] },
          { type: 'function_call', name: 'port_scan', call_id: 'fc_1', arguments: '{"target":"10.0.0.7","ports":"22,80"}' },
        ],
        usage: { input_tokens: 11, output_tokens: 7 },
      }),
      text: async () => '',
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const bb = createChatGPTBackbone('gpt-5.1-codex');
    const response = await bb.chatWithTools(
      [
        { role: 'system', content: 'Hunt this target.' },
        { role: 'user', content: 'enumerate the host' },
      ],
      [
        { name: 'port_scan', description: 'scan ports', parameters: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] } },
      ],
    );

    expect(response.content).toBe('plan ready');
    expect(response.model).toBe('gpt-5.1-codex');
    expect(response.finishReason).toBe('tool_calls');
    expect(response.toolCalls).toEqual([
      { id: 'fc_1', name: 'port_scan', arguments: { target: '10.0.0.7', ports: '22,80' } },
    ]);
    expect(response.usage).toEqual({ promptTokens: 11, completionTokens: 7, totalTokens: 18 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://chatgpt.com/backend-api/codex/responses');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer chatgpt-access-secret');
    expect(headers['OpenAI-Beta']).toBe('responses=experimental');
    // Derived from the stored id_token's chatgpt_account_id claim (unverified decode).
    expect(headers['chatgpt-account-id']).toBe('acct-123');
    // No token material anywhere in the request body.
    expect(String(init?.body)).not.toContain('chatgpt-access-secret');

    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('gpt-5.1-codex');
    expect(body.instructions).toBe('Hunt this target.');
    expect(body.tool_choice).toBe('auto');
    expect(body.input).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'enumerate the host' }] },
    ]);
    expect(body.tools).toEqual([
      {
        type: 'function',
        name: 'port_scan',
        description: 'scan ports',
        parameters: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] },
      },
    ]);
  });

  it('omits the account-id header when no id_token is stored', async () => {
    // An empty id_token is dropped by parseTokenResponse, so the store holds no JWT.
    await signIn('chatgpt-access-secret', { idToken: '' as unknown as string });
    expect(hasOAuth('openai')).toBe(true);

    fetchSpy = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ model: 'gpt-5.1', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] }),
      text: async () => '',
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    await createChatGPTBackbone().chat([{ role: 'user', content: 'hi' }]);
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['chatgpt-account-id']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer chatgpt-access-secret');
  });

  it('refreshes an expiring access token through ensureOAuthAccessToken before inference', async () => {
    await signIn('old-access', { expiresIn: 60 });
    const t0 = 1_000_000;
    const oauthSpy = vi.fn(async (url: string, init?: { body?: string }) => {
      expect(url).toBe('https://auth.openai.com/oauth/token');
      // refreshOpenAi posts JSON (same wire shape as the Anthropic refresh).
      const body = JSON.parse(String(init?.body)) as { grant_type?: string; refresh_token?: string };
      expect(body.grant_type).toBe('refresh_token');
      expect(body.refresh_token).toBe('refresh-secret');
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'new-access', expires_in: 3600 }),
        text: async () => '',
      };
    });
    setOAuthFetch(oauthSpy as unknown as Parameters<typeof setOAuthFetch>[0]);

    // 50s into a 60s TTL — inside the 120s refresh-skew window, so LLMBackbone.chat
    // refreshes BEFORE dispatching inference, and the fresh bearer goes on the wire.
    __setOAuthNow(() => t0 + 50_000);

    fetchSpy = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ model: 'gpt-5.1', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] }),
      text: async () => '',
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    await createChatGPTBackbone().chat([{ role: 'user', content: 'hi' }]);
    expect(oauthSpy).toHaveBeenCalledTimes(1);
    expect(peekOAuthAccessToken('openai')).toBe('new-access');
    expect(((fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>).Authorization)
      .toBe('Bearer new-access');
  });

  it('fails honestly when ChatGPT Plan OAuth is missing — no silent provider swap', async () => {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-chatgpt-empty-'));
    dirs.push(dir);
    process.env.T3MP3ST_OAUTH_STORE = join(dir, 'oauth.json');

    fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    expect(config.getConfiguredProviders()).not.toContain('chatgpt');
    const bb = createChatGPTBackbone();
    expect(bb.getProvider()).toBe('chatgpt');
    expect(bb.validateConfig()).toEqual({
      valid: false,
      error: expect.stringMatching(/ChatGPT Plan sign-in required/i),
    });
    await expect(bb.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(/ChatGPT Plan sign-in required/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
