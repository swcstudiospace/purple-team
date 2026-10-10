import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Static pins for the grokbot/ headless Bot package: roster shape, template
// sections, skill registry pairing, marketplace shape, plus the two integrity
// rules (no credential/UUID shapes, no browser-panel references).

const ROOT = join(process.cwd(), 'grokbot');
const DOCS_NEEDLE = 'doc' + 's/'; // assembled, never a literal in this file
const UUID_RE =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const TOKEN_RE =
  /\b(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{16,}|gho_[A-Za-z0-9]{16,}|xai-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

const SEATS = ['commander', 'red', 'black', 'blue', 'white'];
const SKILLS = [
  'tempest-bootstrap',
  'tempest-run',
  'tempest-mission',
  'tempest-operators',
  'tempest-status',
  'tempest-report',
  'tempest-memory',
  'black-specter',
  'black-wraith',
  'blue-sentinel',
  'blue-warden',
  'white-arbiter',
  'white-auditor',
  'dark-purple',
];
const TEMPLATE_SECTIONS = [
  '## Name',
  '## Description',
  '## First run',
  '## Gateway',
  '## Enabled skills',
  '## Routines',
  '## Avatar',
];

function grokbotFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(ROOT);
  return out;
}

describe('grokbot roster', () => {
  it('has the redteam shape with loopback gateway and empty seat ids', () => {
    const roster = JSON.parse(
      readFileSync(join(ROOT, 'rosters', 'redteam.json'), 'utf8'),
    ) as Record<string, any>;
    expect(roster.team).toBe('redteam');
    expect(roster.gateway_url).toMatch(/^http:\/\/(127\.0\.0\.1|localhost|::1)/);
    expect(roster.roster_version).toBe(1);
    expect(Object.keys(roster.seats).sort()).toEqual([...SEATS].sort());
    for (const seat of SEATS) {
      expect(typeof roster.seats[seat].id).toBe('string');
    }
  });
});

describe('grokbot templates', () => {
  for (const seat of SEATS) {
    it(`${seat} carries the required sections in order`, () => {
      const file = join(ROOT, 'templates', `${seat.toUpperCase()}.md`);
      expect(existsSync(file), `missing template ${file}`).toBe(true);
      const body = readFileSync(file, 'utf8');
      expect(body.startsWith('# ')).toBe(true);
      let cursor = -1;
      for (const section of TEMPLATE_SECTIONS) {
        const at = body.indexOf(section, cursor + 1);
        expect(at, `${seat}: missing or misordered ${section}`).toBeGreaterThan(cursor);
        cursor = at;
      }
      expect(body).toContain('127.0.0.1');
      expect(body).toContain('/tempest bootstrap');
    });
  }

  it('commander is the only seat the human talks to', () => {
    const body = readFileSync(join(ROOT, 'templates', 'COMMANDER.md'), 'utf8');
    expect(body).toMatch(/only seat the human talks to/);
  });
});

describe('grokbot skills registry', () => {
  it('pairs every index row with a SKILL.md carrying name/description frontmatter', () => {
    const index = JSON.parse(
      readFileSync(join(ROOT, 'skills', 'index.json'), 'utf8'),
    ) as { skills: Array<{ id: string; path: string; description: string }> };
    expect(index.skills.map((row) => row.id).sort()).toEqual([...SKILLS].sort());
    for (const row of index.skills) {
      expect(row.path, `${row.id}: empty path`).toMatch(/SKILL\.md$/);
      expect(row.description, `${row.id}: empty description`).toContain('Use when');
      const skillFile = join(ROOT, row.path.replace(/^skills\//, 'skills/'));
      expect(existsSync(skillFile), `${row.id}: missing ${row.path}`).toBe(true);
      const skill = readFileSync(skillFile, 'utf8');
      expect(skill.startsWith('---')).toBe(true);
      expect(skill).toContain(`name: ${row.id}`);
      expect(skill).toMatch(/description:.*Use when/s);
    }
  });

  it('drives the MCP tools or the loopback API, never a browser panel', () => {
    for (const id of SKILLS) {
      const skill = readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');
      const viaTools = skill.includes('tempest_');
      const viaApi = skill.includes('http://127.0.0.1:3333');
      expect(viaTools || viaApi, `${id}: no tool or loopback path`).toBe(true);
    }
  });
});

describe('grokbot marketplace', () => {
  it('mirrors the plugin shape with the fourteen skill refs', () => {
    const plugin = JSON.parse(
      readFileSync(join(ROOT, 'marketplace', 'plugin.json'), 'utf8'),
    ) as { name: string; description: string; skills: string[] };
    expect(plugin.name.length).toBeGreaterThan(0);
    expect(plugin.description.length).toBeGreaterThan(0);
    expect([...plugin.skills].sort()).toEqual([...SKILLS].sort());
  });
});

describe('grokbot integrity', () => {
  it('commits no token or UUID-shaped strings anywhere under grokbot/', () => {
    for (const file of grokbotFiles()) {
      const body = readFileSync(file, 'utf8');
      expect(body, `${file}: UUID-shaped string`).not.toMatch(UUID_RE);
      expect(body, `${file}: token-shaped string`).not.toMatch(TOKEN_RE);
    }
  });

  it('references no browser-panel paths anywhere under grokbot/', () => {
    for (const file of grokbotFiles()) {
      const body = readFileSync(file, 'utf8');
      expect(body, `${file}: browser-panel reference`).not.toContain(DOCS_NEEDLE);
    }
  });
});
