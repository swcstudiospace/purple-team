import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Static contract for the ChatGPT Plan (openai-vendor) subscription OAuth routes.
// The three routes MUST mirror the existing anthropic PKCE pair exactly (start →
// parse+complete → logout), and NONE of them may echo a token (access/refresh/id)
// back in a response body or log line — the subscription tokens stay on the server.
// /api/oauth/status already reports every vendor via oauthStatus(); these tests pin
// the openai trio so a refactor cannot drop a route or leak a credential.

const server = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

function block(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `missing start marker ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end, `missing end marker ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('openai vendor OAuth routes (ChatGPT Plan)', () => {
  it('registers start / complete / logout mirroring the anthropic PKCE routes', () => {
    expect(server).toContain("app.post('/api/oauth/openai/start'");
    expect(server).toContain("app.post('/api/oauth/openai/complete'");
    expect(server).toContain("app.post('/api/oauth/openai/logout'");
  });

  it('wires the openai-vendor wave-A flows end to end', () => {
    expect(server).toContain('startOpenAiPkceFlow');
    expect(server).toContain('completeOpenAiPkceFlow');
    expect(server).toContain("clearOAuth('openai')");
  });

  it('complete validates flowId + code before exchanging', () => {
    const route = block(
      server,
      "app.post('/api/oauth/openai/complete'",
      "app.post('/api/oauth/openai/logout'",
    );

    expect(route).toMatch(/flowId and code required/);
    expect(route).toContain('completeOpenAiPkceFlow(flowId, code)');
    // Same re-init posture as the anthropic pair: hydrate the default backbone.
    expect(route).toContain('llm = await initLLM()');
  });

  it('never returns a token in a route body or echoes one into a log line', () => {
    // The whole openai OAuth route surface: status → start → complete → logout.
    const routes = block(
      server,
      "app.get('/api/oauth/status'",
      "// POST /api/models",
    );

    expect(routes).not.toMatch(/res\.json\(\s*\{[^}]*accessToken/);
    expect(routes).not.toMatch(/res\.json\(\s*\{[^}]*refreshToken/);
    expect(routes).not.toMatch(/res\.json\(\s*\{[^}]*idToken/);
    expect(routes).not.toMatch(/console\.(log|error|warn)\([^)]*accessToken/);
    // Bodies report only connection state via oauthStatus(), exactly like xai/anthropic.
    expect(routes).toContain('oauth: oauthStatus()');
  });
});
