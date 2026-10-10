import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// Static pins for the seven hat slash skills plus the two hat MCP tools in
// src/mcp-server.ts: registry pairing, frontmatter, shared-grammar pointer,
// doctrine short quotes (never full prompt bodies), loopback proxy shape,
// degraded mode, and the two integrity rules (no credential/UUID shapes, no
// browser-panel references). Degraded-mode cases run the real server over
// stdio against a closed loopback port — no network beyond loopback.

const ROOT = join(process.cwd(), 'grokbot');
const src = readFileSync(join(process.cwd(), 'src', 'mcp-server.ts'), 'utf8');

const HAT_SKILLS = [
  'black-specter',
  'black-wraith',
  'blue-sentinel',
  'blue-warden',
  'white-arbiter',
  'white-auditor',
  'dark-purple',
];

const HAT_TOOLS = ['tempest_hats_list', 'tempest_hat_dispatch'];

const HAT_DOCTRINE: Record<string, string> = {
  'black-specter': 'covert tradecraft',
  'black-wraith': 'exfil-simulation',
  'blue-sentinel': 'detection-engineering',
  'blue-warden': 'control verification',
  'white-arbiter': 'ROE adjudication',
  'white-auditor': 'replayable > tool > context > weak',
  'dark-purple': 'white verdict',
};

const DOCS_NEEDLE = 'doc' + 's/'; // assembled, never a literal in this file
const UUID_RE =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const TOKEN_RE =
  /\b(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{16,}|gho_[A-Za-z0-9]{16,}|xai-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

function hatsToolsBlock(): string {
  const start = src.indexOf("name: 'tempest_hats_list'");
  expect(start, 'hat tool definitions missing').toBeGreaterThanOrEqual(0);
  const end = src.indexOf('];', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

function hatsHandlerBlock(): string {
  const start = src.indexOf("case 'tempest_hats_list'");
  expect(start, 'hat handler section missing').toBeGreaterThanOrEqual(0);
  const end = src.indexOf('default:', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

// Promise.withResolvers is an ES2024 API and this repo pins lib ES2022, so the
// sliver used here is declared locally instead of widening tsconfig.
declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

function mcpCall(
  extraEnv: Record<string, string>,
  method: string,
  params: unknown,
  timeoutMs = 30000,
): Promise<any> {
  const { promise, resolve, reject } = Promise.withResolvers<any>();
  const tsxBin = join(process.cwd(), 'node_modules', '.bin', 'tsx');
  const child = spawn(tsxBin, ['src/mcp-server.ts'], {
    env: { ...process.env, ...extraEnv },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let out = '';
  // Backstop only: this drives a real subprocess over stdio, which fake
  // timers cannot advance — the watchdog kills a hung child instead of
  // hanging the suite. The reply path below resolves on the actual message.
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error('mcp call timed out'));
  }, timeoutMs);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    out += chunk;
    for (const line of out.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        const message = JSON.parse(trimmed);
        if (message.id === 1) {
          clearTimeout(timer);
          child.kill();
          resolve(message);
        }
      } catch {
        // Partial line; wait for more output.
      }
    }
  });
  child.on('error', (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })}\n`);
  return promise;
}

describe('grokbot hat skills registry', () => {
  it('pairs every hat index row with a SKILL.md carrying name/description frontmatter', () => {
    const index = JSON.parse(
      readFileSync(join(ROOT, 'skills', 'index.json'), 'utf8'),
    ) as { skills: Array<{ id: string; path: string; description: string }> };
    for (const id of HAT_SKILLS) {
      const row = index.skills.find((r) => r.id === id);
      expect(row, `${id}: missing index row`).toBeDefined();
      expect(row!.path, `${id}: empty path`).toMatch(/SKILL\.md$/);
      expect(row!.description, `${id}: empty description`).toContain('Use when');
      const skillFile = join(ROOT, row!.path.replace(/^skills\//, 'skills/'));
      expect(existsSync(skillFile), `${id}: missing ${row!.path}`).toBe(true);
      const skill = readFileSync(skillFile, 'utf8');
      expect(skill.startsWith('---')).toBe(true);
      expect(skill).toContain(`name: ${id}`);
      expect(skill).toMatch(/description:.*Use when/s);
    }
  });

  it('points every hat skill at the shared grammar file', () => {
    expect(existsSync(join(ROOT, 'skills', 'GRAMMAR.md')), 'missing skills/GRAMMAR.md').toBe(true);
    for (const id of HAT_SKILLS) {
      const skill = readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');
      expect(skill, `${id}: no shared-grammar reference`).toContain('GRAMMAR.md');
    }
  });

  it('drives the MCP tools or the loopback API, never a browser panel', () => {
    for (const id of HAT_SKILLS) {
      const skill = readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');
      const viaTools = skill.includes('tempest_');
      const viaApi = skill.includes('http://127.0.0.1:3333');
      expect(viaTools || viaApi, `${id}: no tool or loopback path`).toBe(true);
    }
  });

  it('quotes hat doctrine in short lines, never full prompt bodies', () => {
    for (const id of HAT_SKILLS) {
      const skill = readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');
      expect(skill, `${id}: missing doctrine short quote`).toContain(HAT_DOCTRINE[id]);
      expect(skill, `${id}: full prompt body leak`).not.toContain('plinian-authority-model');
      expect(skill, `${id}: full prompt body leak`).not.toContain('<role>');
    }
  });
});

describe('hat tool registry', () => {
  it('exposes both hat tools with input schemas', () => {
    const block = hatsToolsBlock();
    expect(block.match(/name: 'tempest_hats_list'|name: 'tempest_hat_dispatch'/g)).toHaveLength(HAT_TOOLS.length);
    for (const name of HAT_TOOLS) {
      expect(block, `missing tool ${name}`).toContain(`name: '${name}'`);
    }
    expect(block.match(/inputSchema/g)).toHaveLength(HAT_TOOLS.length);
  });

  it('requires hat and task for dispatch', () => {
    expect(hatsToolsBlock()).toContain("required: ['hat', 'task']");
  });

  it('implements both hat handlers', () => {
    const block = hatsHandlerBlock();
    for (const name of HAT_TOOLS) {
      expect(block, `missing handler ${name}`).toContain(`case '${name}'`);
    }
  });

  it('proxies the loopback hat API paths', () => {
    for (const path of [
      '/api/teams/tool-grants',
      '/api/operators/prompts',
      '/api/operators/spawn',
      '/api/operators/',
    ]) {
      expect(src, `missing proxy path ${path}`).toContain(path);
    }
  });

  it('runs no shell or child process for the hat tools', () => {
    for (const block of [hatsToolsBlock(), hatsHandlerBlock()]) {
      expect(block).not.toContain('execFile');
      expect(block).not.toContain('spawn(');
      expect(block).not.toContain('SAFE_COMMANDS');
      expect(block).not.toContain('runTool');
    }
  });

  it('hardcodes no grant tables in the hat tools', () => {
    for (const block of [hatsToolsBlock(), hatsHandlerBlock()]) {
      for (const literal of ['SPECTER_TOOLS', 'WRAITH_TOOLS', 'SENTINEL_TOOLS', 'WARDEN_TOOLS', 'ARBITER_TOOLS', 'AUDITOR_TOOLS']) {
        expect(block, `hardcoded table ${literal}`).not.toContain(literal);
      }
    }
  });
});

describe('hat degraded mode over stdio', () => {
  it('tempest_hats_list returns ok:false against a closed loopback port', async () => {
    const message = await mcpCall(
      { T3MP3ST_URL: 'http://127.0.0.1:1' },
      'tools/call',
      { name: 'tempest_hats_list', arguments: {} },
    );
    const text = message.result.content[0].text as string;
    const body = JSON.parse(text) as { ok: boolean };
    expect(body.ok).toBe(false);
  }, 30000);

  it('tempest_hat_dispatch degrades at the spawn stage against a closed loopback port', async () => {
    const message = await mcpCall(
      { T3MP3ST_URL: 'http://127.0.0.1:1' },
      'tools/call',
      { name: 'tempest_hat_dispatch', arguments: { hat: 'specter', task: 'review the plan' } },
    );
    const text = message.result.content[0].text as string;
    const body = JSON.parse(text) as { ok: boolean; stage: string };
    expect(body.ok).toBe(false);
    expect(body.stage).toBe('spawn');
  }, 30000);

  it('tempest_hat_dispatch refuses empty hat or task without sending traffic', async () => {
    const message = await mcpCall(
      { T3MP3ST_URL: 'http://127.0.0.1:1' },
      'tools/call',
      { name: 'tempest_hat_dispatch', arguments: { hat: '', task: '' } },
    );
    const text = message.result.content[0].text as string;
    const body = JSON.parse(text) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('hat required');
  }, 30000);
});

describe('grokbot hats integrity', () => {
  it('commits no token or UUID-shaped strings in the hat skills or shared grammar', () => {
    const files = [...HAT_SKILLS.map((id) => join(ROOT, 'skills', id, 'SKILL.md')), join(ROOT, 'skills', 'GRAMMAR.md')];
    for (const file of files) {
      const body = readFileSync(file, 'utf8');
      expect(body, `${file}: UUID-shaped string`).not.toMatch(UUID_RE);
      expect(body, `${file}: token-shaped string`).not.toMatch(TOKEN_RE);
    }
  });

  it('references no browser-panel paths in the hat skills, grammar, or hat tools', () => {
    for (const id of HAT_SKILLS) {
      const body = readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');
      expect(body, `${id}: browser-panel reference`).not.toContain(DOCS_NEEDLE);
    }
    expect(readFileSync(join(ROOT, 'skills', 'GRAMMAR.md'), 'utf8')).not.toContain(DOCS_NEEDLE);
    expect(hatsToolsBlock()).not.toContain(DOCS_NEEDLE);
    expect(hatsHandlerBlock()).not.toContain(DOCS_NEEDLE);
  });
});
