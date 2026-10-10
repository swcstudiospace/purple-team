import { afterEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AVAILABLE_MODELS, config } from '../config/index.js';
import { LLMBackbone } from '../llm/index.js';
import { detectLocalAgents, getSpec, localAgentChat } from '../agent/local-agents.js';

// localAgentChat is mocked so the provider→adapter routing can be pinned WITHOUT
// spawning the real cursor-agent CLI; every other export stays genuine.
vi.mock('../agent/local-agents.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent/local-agents.js')>();
  return { ...actual, localAgentChat: vi.fn(async () => 'cursor reply') };
});

const mockedChat = vi.mocked(localAgentChat);

describe('Cursor provider', () => {
  const dirs: string[] = [];

  afterEach(() => {
    delete process.env.T3MP3ST_AGENT_HOME;
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function tempAgentHome(): string {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-cursor-'));
    dirs.push(dir);
    process.env.T3MP3ST_AGENT_HOME = dir;
    return dir;
  }

  /**
   * Minimal POSIX PATH sandbox (same shape as the hermeticPath() helper in
   * local-agent-path-resolution.test.ts): a scratch dir symlinking ONLY the external
   * command the fixtures need (`cat`; echo/printf are sh builtins, shebangs absolute).
   * With the real PATH pinned out, detectLocalAgents() cannot version-probe real host
   * CLIs (/usr/bin/claude, /usr/bin/codex), which is slow under parallel-suite load and
   * flaky by host — only the fixture binary in the fake agent home resolves.
   */
  function hermeticPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 't3mp3st-cursorpath-'));
    dirs.push(dir);
    const cat = ['/bin/cat', '/usr/bin/cat'].find((c) => existsSync(c)) || '/bin/cat';
    symlinkSync(cat, join(dir, 'cat'));
    return dir;
  }

  it('registers a cursor-agent CLI spec with presence-only auth artifacts', () => {
    const spec = getSpec('cursor');
    expect(spec).toBeDefined();
    expect(spec!.bin).toBe('cursor-agent');
    expect(spec!.authArtifacts).toEqual([
      '~/.cursor/cli/auth.json',
      '~/.cursor/cli/config.json',
      '~/.cursor/auth.json',
    ]);
    // One-shot argv: positional prompt (stdin is ignored by runLocalAgent), -m model.
    expect(spec!.oneShot('plan this', 'composer-1')).toEqual(['-p', 'plan this', '-m', 'composer-1']);
    expect(spec!.oneShot('plan this')).toEqual(['-p', 'plan this']);
  });

  it('detects the CLI via a fake binary in agentHome and keys auth on artifact PRESENCE only', async () => {
    const home = tempAgentHome();
    // A real, executable stand-in for cursor-agent (PATH-independent: .local/bin is a
    // well-known scan dir). It only echoes a version — no credentials anywhere.
    const binDir = join(home, '.local', 'bin');
    mkdirSync(binDir, { recursive: true });
    const bin = join(binDir, 'cursor-agent');
    writeFileSync(bin, '#!/bin/sh\necho "cursor-agent 1.2.3"\n');
    chmodSync(bin, 0o755);

    const savedPath = process.env.PATH;
    process.env.PATH = hermeticPath();
    try {
      const withoutAuth = await detectLocalAgents();
      const cursorMissing = withoutAuth.find((a) => a.id === 'cursor');
      expect(cursorMissing).toMatchObject({ bin: 'cursor-agent', installed: true, authed: false, ready: false });

      // The CLI's own auth artifact appearing (presence ONLY — never its bytes) flips authed.
      mkdirSync(join(home, '.cursor', 'cli'), { recursive: true });
      writeFileSync(join(home, '.cursor', 'cli', 'auth.json'), '{"redacted":"never-read"}');

      const withAuth = await detectLocalAgents();
      const cursorAuthed = withAuth.find((a) => a.id === 'cursor');
      expect(cursorAuthed).toMatchObject({ installed: true, authed: true, ready: true, authMethod: 'file' });
      // The artifact bytes are never surfaced through the detection result.
      expect(JSON.stringify(cursorAuthed)).not.toContain('redacted');
    } finally {
      process.env.PATH = savedPath;
    }
  });

  it('resolves a keyless config with the fixed agent id and the :: model passthrough', () => {
    const cfg = config.getLLMConfig('cursor', 'composer-1');
    expect(cfg.provider).toBe('cursor');
    expect(cfg.model).toBe('cursor::composer-1');
    // Keyless: the CLI uses its own login — no API key or base URL.
    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.baseUrl).toBeUndefined();

    const bare = config.getLLMConfig('cursor');
    expect(bare.model).toBe('cursor');
    expect(() => config.getLLMConfig('cursor')).not.toThrow();
    expect(AVAILABLE_MODELS.cursor.map((m) => m.id)).toEqual(['composer-1', 'auto']);
    expect(config.getConfiguredProviders()).toContain('cursor');
  });

  it('routes the cursor provider through the local-agent drive with agent id cursor', async () => {
    mockedChat.mockClear();
    const bb = new LLMBackbone(config.getLLMConfig('cursor', 'composer-1'));
    expect(bb.getProvider()).toBe('cursor');
    expect(bb.validateConfig().valid).toBe(true);

    const response = await bb.chat([{ role: 'user', content: 'recon plan' }]);
    expect(response.content).toBe('cursor reply');
    expect(response.model).toBe('local-agent:cursor/composer-1');

    // The fixed agent id 'cursor' is what actually drives the CLI; the selected model
    // rides the opts (LocalAgentAdapter strips the 'cursor::' prefix).
    expect(mockedChat).toHaveBeenCalledTimes(1);
    const [agentId, , opts] = mockedChat.mock.calls[0];
    expect(agentId).toBe('cursor');
    expect(opts).toMatchObject({ model: 'composer-1' });
  });

  it('passes no model override for the bare cursor agent id', async () => {
    mockedChat.mockClear();
    await new LLMBackbone(config.getLLMConfig('cursor')).chat([{ role: 'user', content: 'hi' }]);
    expect(mockedChat.mock.calls[0][0]).toBe('cursor');
    expect(mockedChat.mock.calls[0][2]).toMatchObject({ model: undefined });
  });
});
