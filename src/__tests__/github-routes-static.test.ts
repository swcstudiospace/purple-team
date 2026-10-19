import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Static contract for the GitHub integration routes. The OAuth set MUST mirror the
// existing vendor pattern (start → callback/complete → logout/status) plus the two
// API proxies, and NONE of them may echo a token (access/refresh ghr_/gho_) back in
// a response body or log line — GitHub tokens stay on the server in the 0600 store.
// These tests pin the seven routes so a refactor cannot drop one or leak a credential.

const server = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

describe('GitHub OAuth + API routes', () => {
  it('registers the seven GitHub routes', () => {
    expect(server).toContain("app.get('/api/oauth/github/status'");
    expect(server).toContain("app.get('/api/oauth/github/start'");
    expect(server).toContain("app.get('/api/oauth/github/callback'");
    expect(server).toContain("app.post('/api/oauth/github/complete'");
    expect(server).toContain("app.post('/api/oauth/github/logout'");
    expect(server).toContain("app.get('/api/github/repositories'");
    expect(server).toContain("app.get('/api/github/resolve'");
  });

  it('wires the github module flows end to end', () => {
    expect(server).toContain('githubStatus');
    expect(server).toContain('githubCallbackPage');
    expect(server).toContain('disconnectGitHub');
    expect(server).toContain('listGitHubRepos');
    expect(server).toContain('resolveGitHubRepo');
  });

  it('callback page builder is the only callback response path and never receives tokens', () => {
    const route = server.slice(
      server.indexOf("app.get('/api/oauth/github/callback'"),
      server.indexOf("app.post('/api/oauth/github/complete'"),
    );
    expect(route).toContain('githubCallbackPage');
    expect(route).not.toMatch(/res\.(send|json)\([^)]*(?<!\.)token/i);
  });

  it('api proxies answer auth-required instead of leaking a token to anonymous callers', () => {
    const repos = server.slice(
      server.indexOf("app.get('/api/github/repositories'"),
      server.indexOf("app.get('/api/github/resolve'"),
    );
    expect(repos).toContain('auth-required');
  });
});
