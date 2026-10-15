import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// Pins for the tempest_* MCP gateway in src/mcp-server.ts: registry shape,
// loopback guard, degraded mode, and the no-shell rule. The degraded-mode
// cases run the real server over stdio against a closed loopback port — no
// network beyond loopback is ever touched.

const src = readFileSync(join(process.cwd(), 'src', 'mcp-server.ts'), 'utf8');

const TEMPEST_TOOLS = [
  'tempest_status',
  'tempest_mission_start',
  'tempest_mission_stop',
  'tempest_report',
  'tempest_operators_list',
  'tempest_operator_task',
  'tempest_findings',
  'tempest_providers',
  'tempest_purple_synthesize',
  'tempest_blue_gaps',
  'tempest_blue_rules',
  'tempest_blue_hardening',
  'tempest_blue_coverage',
  'tempest_black_workflow',
  'tempest_white_stage',
  'tempest_black_cover',
  'tempest_black_noise',
  'tempest_black_exfil',
  'tempest_white_evidence',
  'tempest_white_report',
  'tempest_white_roe',
  'tempest_hats_list',
  'tempest_hat_dispatch',
];

const DOCS_NEEDLE = 'doc' + 's/'; // assembled, never a literal in this file

function tempestToolsBlock(): string {
  const start = src.indexOf("name: 'tempest_status'");
  expect(start, 'tempest tool definitions missing').toBeGreaterThanOrEqual(0);
  const end = src.indexOf('];', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

function tempestHandlerBlock(): string {
  const start = src.indexOf('TEMPEST BOT PROXY — one canonical');
  expect(start, 'tempest handler section missing').toBeGreaterThanOrEqual(0);
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

describe('tempest tool registry', () => {
  it('exposes every tempest_* tool with an input schema', () => {
    const block = tempestToolsBlock();
    expect(block.match(/name: 'tempest_/g)).toHaveLength(TEMPEST_TOOLS.length);
    for (const name of TEMPEST_TOOLS) {
      expect(block, `missing tool ${name}`).toContain(`name: '${name}'`);
    }
    expect(block.match(/inputSchema/g)).toHaveLength(TEMPEST_TOOLS.length);
  });

  it('implements a handler for every tempest_* tool', () => {
    const block = tempestHandlerBlock();
    expect(block.match(/case 'tempest_/g)).toHaveLength(TEMPEST_TOOLS.length);
    for (const name of TEMPEST_TOOLS) {
      expect(block, `missing handler ${name}`).toContain(`case '${name}'`);
    }
  });

  it('requires operatorId for task dispatch', () => {
    expect(src).toContain("required: ['operatorId']");
  });

  it('proxies the loopback HTTP API paths', () => {
    for (const path of [
      '/api/mission/status',
      '/api/mission/start',
      '/api/mission/stop',
      '/api/mission/report',
      '/api/operators/list',
      '/api/findings',
      '/api/llm/status',
      '/api/oauth/status',
      '/api/teams/purple/synthesize',
      '/api/teams/blue/gaps',
      '/api/teams/blue/rules',
      '/api/teams/blue/hardening',
      '/api/teams/black/cover',
      '/api/teams/black/noise',
      '/api/teams/black/exfil',
      '/api/teams/white/evidence',
      '/api/teams/white/report-audit',
      '/api/teams/white/roe',
    ]) {
      expect(src, `missing proxy path ${path}`).toContain(path);
    }
  });
});

describe('tempest loopback guard', () => {
  it('matches the full quad and refuses anything non-loopback', () => {
    expect(src).toContain('tempestIsLoopbackHostname');
    expect(src).toContain('/^127(?:\\.\\d{1,3}){3}$/');
    expect(src).toContain('Refusing non-loopback T3MP3ST_URL');
  });

  it('runs no shell or child process for the tempest tools', () => {
    for (const block of [tempestToolsBlock(), tempestHandlerBlock()]) {
      expect(block).not.toContain('execFile');
      expect(block).not.toContain('spawn(');
      expect(block).not.toContain('SAFE_COMMANDS');
      expect(block).not.toContain('runTool');
    }
  });

  it('references no browser-panel paths in the new tools', () => {
    expect(tempestToolsBlock()).not.toContain(DOCS_NEEDLE);
    expect(tempestHandlerBlock()).not.toContain(DOCS_NEEDLE);
  });
});

describe('tempest degraded mode over stdio', () => {
  it('tempest_status returns ok:false against a closed loopback port', async () => {
    const message = await mcpCall(
      { T3MP3ST_URL: 'http://127.0.0.1:1' },
      'tools/call',
      { name: 'tempest_status', arguments: {} },
    );
    const text = message.result.content[0].text as string;
    const body = JSON.parse(text) as {
      mission: { ok: boolean; error: string };
      llm: { ok: boolean; error: string };
    };
    expect(body.mission.ok).toBe(false);
    expect(body.mission.error).toContain('npm run server');
    expect(body.llm.ok).toBe(false);
  }, 30000);

  it('refuses a non-loopback base URL without sending traffic', async () => {
    const message = await mcpCall(
      { T3MP3ST_URL: 'https://example.com:3333' },
      'tools/call',
      { name: 'tempest_status', arguments: {} },
    );
    const text = message.result.content[0].text as string;
    const body = JSON.parse(text) as {
      mission: { ok: boolean; error: string };
    };
    expect(body.mission.ok).toBe(false);
    expect(body.mission.error).toContain('Refusing non-loopback');
  }, 30000);
});
