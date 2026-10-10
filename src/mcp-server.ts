#!/usr/bin/env node
/**
 * T3MP3ST MCP Server v3.0
 *
 * Production-grade Model Context Protocol server exposing t3mp3st security
 * tooling (security_recon — nmap/DNS reconnaissance).
 *
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import { readFileSync } from 'fs';
import { promisify } from 'util';
import { resolveBearerToken } from './net/remote-access.js';

const execFileAsync = promisify(execFile);

// Strict target allowlist: hostnames, IPv4/IPv6, no shell metacharacters.
// Anything outside this set is rejected before it can reach a subprocess.
const TARGET_RE = /^[A-Za-z0-9._:-]+$/;
// =============================================================================
// TEMPEST BOT PROXY — loopback HTTP API fronted as MCP tools
// =============================================================================
//
// One canonical behavior layer: every tempest_* tool proxies the local t3mp3st
// HTTP API. No shells, no child processes — the SAFE_COMMANDS path above is
// untouched. Reads use GET, state changes use POST, and every failure
// degrades to { ok: false, error } instead of throwing.


// Same loopback definition as the server: exactly `localhost`, `::1`, or a
// full dotted quad in 127.0.0.0/8. The quad is matched in full — a prefix
// match would also accept attacker-registered names shaped like a prefix.
function tempestIsLoopbackHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127(?:\.\d{1,3}){3}$/.test(h);
}

function tempestBearer(): string {
  const loaded = resolveBearerToken(process.env, (path) => readFileSync(path, 'utf8'));
  return loaded.ok ? loaded.token : '';
}

function tempestHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = tempestBearer();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function tempestBaseOrError(): { base?: string; error?: string } {
  const base = (process.env.T3MP3ST_URL || 'http://127.0.0.1:3333').trim().replace(/\/+$/, '');
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    return { error: `Invalid T3MP3ST_URL ${JSON.stringify(base)}: not a parseable URL.` };
  }
  if (!tempestIsLoopbackHostname(host) && !tempestBearer()) {
    return {
      error: `Refusing non-loopback T3MP3ST_URL ${JSON.stringify(base)}: set T3MP3ST_BEARER_TOKEN (the server requires it off loopback).`,
    };
  }
  return { base };
}


async function tempestReadBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function tempestGet(path: string): Promise<string> {
  const checked = tempestBaseOrError();
  if (!checked.base) return JSON.stringify({ ok: false, error: checked.error });
  try {
    const res = await fetch(checked.base + path, { headers: tempestHeaders() });
    return JSON.stringify({ ok: res.ok, status: res.status, data: await tempestReadBody(res) });
  } catch {
    return JSON.stringify({ ok: false, error: `t3mp3st backend unreachable at ${checked.base} — start it with npm run server` });
  }
}

async function tempestPost(path: string, body: unknown): Promise<string> {
  const checked = tempestBaseOrError();
  if (!checked.base) return JSON.stringify({ ok: false, error: checked.error });
  try {
    const res = await fetch(checked.base + path, {
      method: 'POST',
      headers: tempestHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body ?? {}),
    });
    return JSON.stringify({ ok: res.ok, status: res.status, data: await tempestReadBody(res) });
  } catch {
    return JSON.stringify({ ok: false, error: `t3mp3st backend unreachable at ${checked.base} — start it with npm run server` });
  }
}

// =============================================================================
// COMPREHENSIVE PAYLOAD DATABASES
// =============================================================================


// =============================================================================
// SECRET PATTERNS DATABASE (GRIFFIN)
// =============================================================================


// =============================================================================
// PRIVILEGE ESCALATION DATABASE (CERBERUS)
// =============================================================================


// =============================================================================
// WAF BYPASS TECHNIQUES (TYPHON)
// =============================================================================


// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const MCP_TOOLS: Tool[] = [
  {
    name: 'security_recon',
    description: `Quick reconnaissance using nmap and DNS tools.

Performs network reconnaissance with configurable depth.

Use when: Starting an engagement.
Requires: Target hostname or IP.`,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target hostname or IP' },
        scan_type: { type: 'string', enum: ['quick', 'standard', 'full', 'stealth'], description: 'Scan depth' }
      },
      required: ['target']
    }
  },
  {
    name: 'tempest_status',
    description: `Mission + provider status from the loopback backend (GET /api/mission/status + /api/llm/status). Use when: the operator asks what is running or whether the backend answers.`,
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'tempest_mission_start',
    description: `Start a mission on the loopback backend (POST /api/mission/start). Use when: the operator gives an objective with targets and operators.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Mission name' },
        targets: { type: 'array', description: 'Targets, e.g. [{ "host": "example.com" }]' },
        operators: { type: 'array', description: 'Operator archetypes, e.g. ["recon", "scanner"]' }
      }
    }
  },
  {
    name: 'tempest_mission_stop',
    description: `Stop the active mission on the loopback backend (POST /api/mission/stop). Use when: the operator ends or parks the run.`,
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'tempest_report',
    description: `Engagement report for a mission (GET /api/mission/report). Use when: the operator asks for the report or summary.`,
    inputSchema: {
      type: 'object',
      properties: {
        missionId: { type: 'string', description: 'Mission id; omit for the active mission' }
      }
    }
  },
  {
    name: 'tempest_operators_list',
    description: `List backend operators and their states (GET /api/operators/list). Use when: the operator asks which seats are live.`,
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'tempest_operator_task',
    description: `Dispatch a task to one backend operator (POST /api/operators/:id/task). Use when: the operator tasks a seat.`,
    inputSchema: {
      type: 'object',
      properties: {
        operatorId: { type: 'string', description: 'Operator id from tempest_operators_list' },
        taskName: { type: 'string', description: 'Short task name' },
        taskDescription: { type: 'string', description: 'What the operator should do' }
      },
      required: ['operatorId']
    }
  },
  {
    name: 'tempest_findings',
    description: `Ledger findings, optionally for one mission (GET /api/findings). Use when: the operator asks what was found.`,
    inputSchema: {
      type: 'object',
      properties: {
        missionId: { type: 'string', description: 'Mission id filter; omit for all findings' }
      }
    }
  },
  {
    name: 'tempest_providers',
    description: `Provider + subscription-session state (GET /api/llm/status + /api/oauth/status). Use when: the operator asks which models or sessions are live.`,
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'tempest_purple_synthesize',
    description: `Purple posture synthesis from red findings + blue detection gaps (POST /api/teams/purple/synthesize). Use when: the operator asks for the combined posture view.`,
    inputSchema: {
      type: 'object',
      properties: {
        findings: { type: 'array', description: 'Findings, e.g. [{ "id": "...", "title": "...", "severity": "high" }]' },
        detections: { type: 'array', description: 'Detection gaps paired with the findings' }
      }
    }
  }
  ,
  {
    name: 'tempest_blue_gaps',
    description: `Blue detection-coverage gaps for the whole findings ledger (GET /api/teams/blue/gaps). Use when: the operator asks which findings lack telemetry coverage or which detectors to build.`,
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'tempest_hats_list',
    description: `Specialist hats with parent teams and live tool grants (GET /api/teams/tool-grants + /api/operators/prompts). Use when: the operator asks which hats are spawnable or what each hat may wield.`,
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'tempest_hat_dispatch',
    description: `Spawn one specialist hat and dispatch a task to it (POST /api/operators/spawn {archetype} then POST /api/operators/:id/task). Use when: the operator tasks a hat.`,
    inputSchema: {
      type: 'object',
      properties: {
        hat: { type: 'string', description: 'Hat archetype to spawn; the backend validates it' },
        task: { type: 'string', description: 'What the hat should do' },
        missionId: { type: 'string', description: 'Mission id quoted on follow-ups; omit when the backend holds the active mission' }
      },
      required: ['hat', 'task']
    }
  }
];

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

const SAFE_COMMANDS = ['nmap', 'curl', 'dig', 'host', 'whois', 'nikto', 'gobuster', 'whatweb'];

/**
 * Run a whitelisted binary with an explicit argument array — NO shell.
 *
 * Because execFile does not spawn a shell and each arg is passed verbatim as a
 * single argv entry, shell metacharacters in the (already regex-validated)
 * target cannot be interpreted as command separators. The binary is checked
 * against the allowlist, and every arg is validated for the absence of NUL.
 */
async function runTool(
  binary: string,
  args: string[],
  timeout = 30000
): Promise<{ success: boolean; output: string; error?: string }> {
  if (!SAFE_COMMANDS.includes(binary)) {
    return { success: false, output: '', error: `Command not allowed: ${binary}` };
  }
  // Defence-in-depth: reject NUL bytes which can truncate args at the syscall boundary.
  if (args.some((a) => a.includes('\0'))) {
    return { success: false, output: '', error: 'Invalid argument: NUL byte' };
  }
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      timeout,
      maxBuffer: 1024 * 1024 * 5,
    });
    return { success: true, output: stdout || stderr };
  } catch (error: any) {
    return { success: false, output: error.stdout || '', error: error.message };
  }
}



async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    // =========================================================================
    // SECURITY RECON
    // =========================================================================
    case 'security_recon': {
      const { target, scan_type = 'quick' } = args as any;

      // Validate the target BEFORE it reaches any subprocess. Only hostnames /
      // IPv4 / IPv6 literals are permitted; shell metacharacters (';', '|',
      // '&', '$', spaces, backticks, ...) are rejected here. Combined with the
      // no-shell execFile call below, "evil.com; id" is refused and, even if it
      // slipped through, would be passed as a single inert argv entry.
      if (typeof target !== 'string' || !TARGET_RE.test(target)) {
        return JSON.stringify({
          error: 'Invalid target: only hostnames, IPv4/IPv6 addresses are allowed ([A-Za-z0-9._:-]).',
          target: typeof target === 'string' ? target : String(target)
        }, null, 2);
      }

      const scanConfigs: Record<string, { portArgs: string[]; timing: string; scripts: boolean }> = {
        quick: { portArgs: ['-F'], timing: '-T4', scripts: false },
        standard: { portArgs: ['--top-ports', '1000'], timing: '-T3', scripts: true },
        full: { portArgs: ['-p-'], timing: '-T2', scripts: true },
        stealth: { portArgs: ['--top-ports', '100'], timing: '-T1', scripts: false }
      };

      const config = scanConfigs[scan_type] || scanConfigs.quick;

      const nmapArgs = [
        ...config.portArgs,
        config.timing,
        '-sV',
        ...(config.scripts ? ['-sC'] : []),
        '--open',
        target
      ];

      const [dns, ports] = await Promise.all([
        runTool('dig', ['+short', target, 'ANY']),
        runTool('nmap', nmapArgs, 300000)
      ]);

      return JSON.stringify({
        tool: 'RECON',
        version: '3.0.0',
        target,
        scan_type,
        results: {
          dns: {
            success: dns.success,
            records: dns.output.trim().split('\n').filter(Boolean)
          },
          ports: {
            success: ports.success,
            output: ports.output,
            error: ports.error
          }
        },
        commands_executed: [
          `dig +short ${target} ANY`,
          `nmap ${nmapArgs.join(' ')}`
        ],
        next_steps: [
          'Run vulnerability scan with nuclei',
          'Enumerate web directories with gobuster',
          'Check for common vulnerabilities'
        ]
      }, null, 2);
    }

    // =========================================================================
    // TEMPEST BOT PROXY — one canonical behavior layer over the loopback API.
    // No shells, no child processes; unreachable backends degrade, never throw.
    // =========================================================================
    case 'tempest_status': {
      const [mission, llm] = await Promise.all([
        tempestGet('/api/mission/status'),
        tempestGet('/api/llm/status'),
      ]);
      return JSON.stringify({ tool: 'tempest_status', mission: JSON.parse(mission), llm: JSON.parse(llm) });
    }

    case 'tempest_mission_start': {
      const { name, targets, operators } = args as { name?: unknown; targets?: unknown; operators?: unknown };
      return tempestPost('/api/mission/start', { name, targets, operators });
    }

    case 'tempest_mission_stop': {
      return tempestPost('/api/mission/stop', {});
    }

    case 'tempest_report': {
      const { missionId } = args as { missionId?: unknown };
      const path = typeof missionId === 'string' && missionId
        ? `/api/mission/${encodeURIComponent(missionId)}/report`
        : '/api/mission/report';
      return tempestGet(path);
    }

    case 'tempest_operators_list': {
      return tempestGet('/api/operators/list');
    }

    case 'tempest_operator_task': {
      const { operatorId, taskName, taskDescription } = args as {
        operatorId?: unknown; taskName?: unknown; taskDescription?: unknown;
      };
      if (typeof operatorId !== 'string' || !operatorId) {
        return JSON.stringify({ ok: false, error: 'operatorId required' });
      }
      return tempestPost(`/api/operators/${encodeURIComponent(operatorId)}/task`, { taskName, taskDescription });
    }

    case 'tempest_findings': {
      const { missionId } = args as { missionId?: unknown };
      const path = typeof missionId === 'string' && missionId
        ? `/api/findings?missionId=${encodeURIComponent(missionId)}`
        : '/api/findings';
      return tempestGet(path);
    }

    case 'tempest_providers': {
      const [llm, oauth] = await Promise.all([
        tempestGet('/api/llm/status'),
        tempestGet('/api/oauth/status'),
      ]);
      return JSON.stringify({ tool: 'tempest_providers', llm: JSON.parse(llm), oauth: JSON.parse(oauth) });
    }

    case 'tempest_purple_synthesize': {
      const { findings, detections } = args as { findings?: unknown; detections?: unknown };
      return tempestPost('/api/teams/purple/synthesize', { findings: findings ?? [], detections: detections ?? [] });
    }

    case 'tempest_blue_gaps': {
      return tempestGet('/api/teams/blue/gaps');
    }

    case 'tempest_hats_list': {
      const [grantsRes, promptsRes] = await Promise.all([
        tempestGet('/api/teams/tool-grants'),
        tempestGet('/api/operators/prompts'),
      ]);
      const grantsBody: { ok: boolean; data?: unknown; error?: string } = JSON.parse(grantsRes);
      const promptsBody: { ok: boolean; data?: unknown; error?: string } = JSON.parse(promptsRes);
      if (!grantsBody.ok || !promptsBody.ok) {
        return JSON.stringify({ tool: 'tempest_hats_list', ok: false, grants: grantsBody, prompts: promptsBody });
      }
      // No hardcoded grant tables: the hat rows and the parent-team rows are
      // both projected live from the tool-grants response. Only the three
      // parent-team ids separate the two groupings; every grant list itself
      // comes from the backend.
      const grantsData = grantsBody.data as { grants?: unknown } | null;
      const grantsRecord = (grantsData && typeof grantsData === 'object' && grantsData.grants && typeof grantsData.grants === 'object'
        ? grantsData.grants as Record<string, unknown>
        : {}) as Record<string, string[]>;
      const promptsData = promptsBody.data as { operators?: unknown } | null;
      const operators = (promptsData && typeof promptsData === 'object' && Array.isArray(promptsData.operators)
        ? promptsData.operators as Array<{ archetype?: unknown }>
        : []);
      const prompted: Record<string, true> = {};
      for (const o of operators) {
        if (o && typeof o.archetype === 'string') prompted[o.archetype] = true;
      }
      const parentTeams = ['black', 'blue', 'white'];
      const teams = parentTeams
        .filter((t) => Array.isArray(grantsRecord[t]))
        .map((t) => ({ team: t, grants: grantsRecord[t] }));
      const hats = Object.keys(grantsRecord)
        .filter((k) => !parentTeams.includes(k))
        .map((k) => ({ hat: k, grants: grantsRecord[k], hasPrompt: prompted[k] === true }));
      return JSON.stringify({ tool: 'tempest_hats_list', ok: true, teams, hats });
    }

    case 'tempest_hat_dispatch': {
      const { hat, task, missionId } = args as { hat?: unknown; task?: unknown; missionId?: unknown };
      if (typeof hat !== 'string' || !hat) {
        return JSON.stringify({ ok: false, error: 'hat required' });
      }
      if (typeof task !== 'string' || !task) {
        return JSON.stringify({ ok: false, error: 'task required' });
      }
      // Composition of the canonical calls: spawn by archetype, then task the
      // spawned operator id. No duplicated spawn/task logic lives here.
      const spawned: { ok: boolean; data?: unknown } = JSON.parse(await tempestPost('/api/operators/spawn', { archetype: hat }));
      if (!spawned?.ok) return JSON.stringify({ tool: 'tempest_hat_dispatch', ok: false, stage: 'spawn', result: spawned });
      const spawnData = spawned.data as { operator?: unknown; id?: unknown; operatorId?: unknown } | null;
      const operatorSummary = spawnData?.operator as { id?: unknown } | null;
      const idCandidate = (operatorSummary && typeof operatorSummary === 'object' ? operatorSummary.id : undefined)
        ?? spawnData?.id
        ?? spawnData?.operatorId;
      if (typeof idCandidate !== 'string' || !idCandidate) {
        return JSON.stringify({ tool: 'tempest_hat_dispatch', ok: false, stage: 'spawn', error: 'spawn answered without an operator id', result: spawned });
      }
      const quoted = typeof missionId === 'string' && missionId ? `${task} (mission ${missionId})` : task;
      const tasked = await tempestPost(`/api/operators/${encodeURIComponent(idCandidate)}/task`, { taskName: task.slice(0, 120), taskDescription: quoted });
      return JSON.stringify({ tool: 'tempest_hat_dispatch', ok: true, hat, operatorId: idCandidate, result: JSON.parse(tasked) });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// =============================================================================
// MCP SERVER
// =============================================================================

const server = new Server(
  { name: 't3mp3st-chef-specials', version: '3.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: MCP_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleToolCall(name, args || {});
    return { content: [{ type: 'text', text: result }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[T3MP3ST MCP] server running — security_recon (nmap/DNS recon) + tempest_* (loopback API proxy)');
}

main().catch(console.error);
