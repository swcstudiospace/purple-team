import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const docsDir = join(process.cwd(), 'docs');
const settings = readFileSync(join(docsDir, 'settings.html'), 'utf8');
const landing = readFileSync(join(docsDir, 'index.html'), 'utf8');
const tokens = readFileSync(join(docsDir, 'assets/tokens.css'), 'utf8');
const server = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');
const operators = readFileSync(join(docsDir, 'operators.html'), 'utf8');
const pages = readdirSync(docsDir).filter((f) => f.endsWith('.html'));
const allHtml = pages.map((f) => readFileSync(join(docsDir, f), 'utf8')).join('\n');

describe('settings sign-in surface (all five providers)', () => {
  it('labels ChatGPT Plan, Claude Pro, Super Grok Heavy, Cursor, and OpenRouter', () => {
    for (const label of ['ChatGPT Plan', 'Claude Pro', 'Super Grok Heavy', 'Cursor', 'OpenRouter']) {
      expect(settings, `settings.html missing provider label "${label}"`).toContain(label);
    }
  });

  it('wires a startOAuth flow per subscription vendor', () => {
    for (const fn of ['startOpenaiOAuth', 'startXaiOAuth', 'startAnthropicOAuth']) {
      expect(settings, `settings.html missing ${fn}`).toContain(fn);
    }
    expect(settings).toContain('/api/oauth/openai/start');
    expect(settings).toContain('/api/oauth/openai/complete');
    expect(settings).toContain('/api/oauth/openai/logout');
    expect(settings).toContain('/api/oauth/xai/start');
    expect(settings).toContain('/api/oauth/anthropic/start');
  });

  it('connects Cursor as a local agent and detects agents', () => {
    expect(settings).toContain('/api/agents/local/connect');
    expect(settings).toContain("id: 'cursor'");
    expect(settings).toContain('/api/agents/local/detect');
  });

  it('reports per-provider status from oauth + llm status', () => {
    expect(settings).toContain('/api/oauth/status');
    expect(settings).toContain('/api/llm/status');
  });

  it('keeps the landing keyless callout on the subscription + agent story', () => {
    expect(landing).toContain('Super Grok Heavy');
    expect(landing).toContain('Claude Pro/Max');
    expect(landing).toContain('startXaiOAuth');
    expect(landing).toContain('startAnthropicOAuth');
    expect(landing).toContain('xai:grok-4-heavy');
    expect(landing).toContain("auth: 'oauth'");
  });
});

describe('token foundation', () => {
  it('defines every required custom property in docs/assets/tokens.css', () => {
    for (const name of [
      '--bg', '--surface', '--surface-alt', '--border',
      '--text-primary', '--text-secondary',
      '--accent-red', '--accent-red-hover', '--text-accent',
      '--danger', '--danger-surface', '--focus-ring',
      '--radius', '--gap',
    ]) {
      expect(tokens, `tokens.css missing ${name}`).toContain(name + ':');
    }
  });

  it('has zero motion-chrome classes across every docs page', () => {
    for (const cls of ['aurora', 'spotlight', 'meteors', 'meteor', 'btn-shimmer', 'border-beam', 'gradient-text']) {
      expect(allHtml, `docs/*.html still contains motion chrome "${cls}"`).not.toContain(cls);
    }
  });
});

describe('server OAuth routes (unchanged)', () => {
  it('wires server OAuth routes that never return tokens in their names/paths', () => {
    expect(server).toContain("app.get('/api/oauth/status'");
    expect(server).toContain("app.post('/api/oauth/xai/start'");
    expect(server).toContain("app.post('/api/oauth/anthropic/complete'");
    expect(server).toContain("app.post('/api/oauth/openai/start'");
    expect(server).toContain("app.post('/api/oauth/openai/complete'");
    expect(server).toContain("app.post('/api/oauth/openai/logout'");
    expect(server).toContain('oauthStatus()');
  });
});

describe('operators hats surface (six spawnable hats)', () => {
  it('lists every hat archetype on the operators page', () => {
    for (const hat of ['specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor']) {
      expect(operators, `operators.html missing hat "${hat}"`).toContain(hat);
    }
  });

  it('renders the hats panel with grant display and per-hat dispatch', () => {
    expect(operators).toContain('hatsGrid');
    expect(operators).toContain('hatsState');
    expect(operators).toContain('/api/operators/prompts');
    expect(operators).toContain('/api/teams/tool-grants');
    expect(operators).toContain('/api/operators/spawn');
    expect(operators).toContain('data-dispatch');
  });

  it('keeps the Dark Purple synthesis panel and roster editor working', () => {
    expect(operators).toContain('/api/teams/purple/synthesize');
    expect(operators).toContain('openEditor');
    expect(operators).toContain('/api/operators/prompt');
  });
});

describe('v1.1 component-system tokens', () => {
  it('defines the raised-surface, faint-text, and success/warning aliases', () => {
    for (const name of [
      '--surface-raised', '--surface-overlay', '--border-strong', '--text-faint',
      '--accent-red-crisp', '--success', '--warning',
      '--tint-success', '--tint-warning',
      '--shadow-raised', '--shadow-pop', '--touch',
      '--trans-fast', '--trans-med', '--trans-slow', '--ease-out',
    ]) {
      expect(tokens, `tokens.css missing ${name}`).toContain(name + ':');
    }
  });

  it('kills all motion under prefers-reduced-motion', () => {
    expect(tokens).toContain('prefers-reduced-motion');
  });
});
