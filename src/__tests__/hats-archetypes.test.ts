import { describe, it, expect } from 'vitest';
import { OPERATOR_SYSTEM_PROMPTS } from '../prompts/index.js';
import { HAT_ARCHETYPES, hatTeam, hatToolGrants } from '../teams/hats.js';
import { TEAM_ARCHETYPES, teamToolGrants } from '../teams/index.js';
import { TOOL_ADAPTERS } from '../arsenal/catalog.js';

const CATALOG_IDS = new Set(TOOL_ADAPTERS.map(adapter => adapter.id));
const RISK_BY_ID = new Map(TOOL_ADAPTERS.map(adapter => [adapter.id, adapter.risk]));

describe('hat archetypes', () => {
  it('adds the six hats to the operator archetype space without touching the team set', () => {
    // OPERATOR_SYSTEM_PROMPTS is Record<OperatorArchetype, string>, so these keys
    // existing at runtime proves the union carries the six hats.
    for (const hat of HAT_ARCHETYPES) {
      expect(Object.keys(OPERATOR_SYSTEM_PROMPTS)).toContain(hat);
    }
    expect(HAT_ARCHETYPES).toEqual(['specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor']);
    expect(TEAM_ARCHETYPES).toEqual(['black', 'blue', 'white']);
  });

  it('composes every hat prompt from the shared doctrine blocks', () => {
    for (const hat of HAT_ARCHETYPES) {
      const prompt = OPERATOR_SYSTEM_PROMPTS[hat];
      expect(prompt.length).toBeGreaterThan(1500);
      expect(prompt).toContain('<role>');
      expect(prompt).toContain('plinian-authority-model');
      expect(prompt).toContain('execution-model'); // REACT_PREAMBLE
      expect(prompt).toContain('tool-usage-rules'); // shared tool-usage block
      expect(prompt).toContain('<authorization>'); // AUTHORIZATION_NOTICE
    }
  });

  it('black hats keep the opsec block like the black team; inspector hats do not', () => {
    expect(OPERATOR_SYSTEM_PROMPTS.specter).toContain('<opsec-awareness>');
    expect(OPERATOR_SYSTEM_PROMPTS.wraith).toContain('<opsec-awareness>');
    for (const hat of ['sentinel', 'warden', 'arbiter', 'auditor'] as const) {
      expect(OPERATOR_SYSTEM_PROMPTS[hat]).not.toContain('<opsec-awareness>');
    }
  });

  it('specter prompt carries the covert tradecraft doctrine markers', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.specter;
    expect(prompt).toContain('T3MP3ST Specter');
    expect(prompt).toContain('<specter-doctrine>');
    expect(prompt).toContain('covert tradecraft');
    expect(prompt).toContain("adversary's eyes");
    expect(prompt).toContain('Awareness-only');
    expect(prompt).toContain('approval path');
  });

  it('wraith prompt carries the exfil-simulation doctrine markers', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.wraith;
    expect(prompt).toContain('T3MP3ST Wraith');
    expect(prompt).toContain('<wraith-doctrine>');
    expect(prompt).toContain('Exfil-simulation');
    expect(prompt).toContain('noise budget');
    expect(prompt).toContain('Egress verification');
  });

  it('sentinel prompt carries the detection-engineering doctrine markers', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.sentinel;
    expect(prompt).toContain('T3MP3ST Sentinel');
    expect(prompt).toContain('<sentinel-doctrine>');
    expect(prompt).toContain('detection-engineering');
    expect(prompt).toContain('detector recommendation');
    expect(prompt).toContain('none / partial / covered');
  });

  it('warden prompt carries the hardening-audit doctrine markers', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.warden;
    expect(prompt).toContain('T3MP3ST Warden');
    expect(prompt).toContain('<warden-doctrine>');
    expect(prompt).toContain('Control verification');
    expect(prompt).toContain('isconfiguration');
    expect(prompt).toContain('hardening plan');
  });

  it('arbiter prompt carries the ROE-adjudication doctrine markers', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.arbiter;
    expect(prompt).toContain('T3MP3ST Arbiter');
    expect(prompt).toContain('<arbiter-doctrine>');
    expect(prompt).toContain('OE adjudication');
    expect(prompt).toContain('compliant / violation / needs_approval');
    expect(prompt).toContain('appeal path');
    expect(prompt).toContain('untrusted evidence');
  });

  it('auditor prompt carries the evidence-scoring doctrine markers', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.auditor;
    expect(prompt).toContain('T3MP3ST Auditor');
    expect(prompt).toContain('<auditor-doctrine>');
    expect(prompt).toContain('replayable > tool > context > weak');
    expect(prompt).toContain('confidence');
    expect(prompt).toContain('retest');
  });
});

describe('hat tool grants', () => {
  it('every hat-granted id exists in the arsenal catalog', () => {
    for (const hat of HAT_ARCHETYPES) {
      const grants = hatToolGrants(hat);
      expect(grants.length).toBeGreaterThan(0);
      for (const id of grants) expect(CATALOG_IDS.has(id)).toBe(true);
    }
  });

  it('every hat grant is a subset slice of its parent team grant', () => {
    for (const hat of HAT_ARCHETYPES) {
      const parent = new Set(teamToolGrants(hatTeam[hat]));
      for (const id of hatToolGrants(hat)) expect(parent.has(id)).toBe(true);
    }
  });

  it('inspector hats (sentinel/warden/arbiter/auditor) are read/inspect-grade only', () => {
    for (const hat of ['sentinel', 'warden', 'arbiter', 'auditor'] as const) {
      expect(['blue', 'white']).toContain(hatTeam[hat]);
      for (const id of hatToolGrants(hat)) {
        expect(['local_read', 'passive']).toContain(RISK_BY_ID.get(id));
      }
    }
  });

  it('black hats (specter/wraith) carry no intrusive, credential, or dangerous tools', () => {
    for (const hat of ['specter', 'wraith'] as const) {
      expect(hatTeam[hat]).toBe('black');
      for (const id of hatToolGrants(hat)) {
        expect(['intrusive', 'credential', 'dangerous']).not.toContain(RISK_BY_ID.get(id));
      }
    }
  });

  it('black hats stay disjoint from blue and white grants', () => {
    const blue = new Set(teamToolGrants('blue'));
    const white = new Set(teamToolGrants('white'));
    for (const hat of ['specter', 'wraith'] as const) {
      for (const id of hatToolGrants(hat)) {
        expect(blue.has(id)).toBe(false);
        expect(white.has(id)).toBe(false);
      }
    }
  });
});
