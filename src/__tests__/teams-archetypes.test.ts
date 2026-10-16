import { describe, it, expect } from 'vitest';
import { OPERATOR_SYSTEM_PROMPTS } from '../prompts/index.js';
import { TEAM_ARCHETYPES, teamToolGrants, FAMILY_TEAM_MAPPING } from '../teams/index.js';
import { TOOL_ADAPTERS } from '../arsenal/catalog.js';

const CATALOG_IDS = new Set(TOOL_ADAPTERS.map(adapter => adapter.id));
const RISK_BY_ID = new Map(TOOL_ADAPTERS.map(adapter => [adapter.id, adapter.risk]));

describe('dark purple team archetypes', () => {
  it('adds black, blue, and white to the operator archetype space without purple', () => {
    // OPERATOR_SYSTEM_PROMPTS is Record<OperatorArchetype, string>, so these keys
    // existing at runtime proves the union carries the three archetypes.
    for (const archetype of ['black', 'blue', 'white']) {
      expect(Object.keys(OPERATOR_SYSTEM_PROMPTS)).toContain(archetype);
    }
    expect(TEAM_ARCHETYPES).toEqual(['black', 'blue', 'white']);
    expect(TEAM_ARCHETYPES).not.toContain('purple');
  });

  it('composes every team prompt from the shared doctrine blocks', () => {
    for (const archetype of TEAM_ARCHETYPES) {
      const prompt = OPERATOR_SYSTEM_PROMPTS[archetype];
      expect(prompt.length).toBeGreaterThan(1500);
      expect(prompt).toContain('<role>');
      expect(prompt).toContain('plinian-authority-model');
      expect(prompt).toContain('execution-model'); // REACT_PREAMBLE
      expect(prompt).toContain('<authorization>'); // AUTHORIZATION_NOTICE
      expect(prompt).toContain('tool-usage-rules'); // shared tool-usage block
    }
  });

  it('black prompt carries the stealth doctrine markers and the anti-forensics line', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.black;
    expect(prompt).toContain('<stealth-doctrine>');
    expect(prompt).toContain('noise budget');
    expect(prompt).toMatch(/anti-forensics/i);
    expect(prompt).toContain('NEVER wipe');
    expect(prompt).toContain('approval path');
    expect(prompt).toContain('<opsec-awareness>'); // black is an offensive operator: keeps OPSEC_RULES
  });

  it('blue prompt carries the defender doctrine markers and the no-offense rule', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.blue;
    expect(prompt).toContain('<defender-doctrine>');
    expect(prompt).toContain('none, partial, or covered');
    expect(prompt).toContain('never run offensive tooling');
  });

  it('white prompt carries the referee doctrine markers and provenance ranking', () => {
    const prompt = OPERATOR_SYSTEM_PROMPTS.white;
    expect(prompt).toContain('<referee-doctrine>');
    expect(prompt).toContain('replayable > tool > context > weak');
    expect(prompt).toContain('appeal path');
    expect(prompt).toContain('untrusted evidence');
  });
});

describe('team tool grants', () => {
  it('every granted id exists in the arsenal catalog', () => {
    for (const archetype of TEAM_ARCHETYPES) {
      const grants = teamToolGrants(archetype);
      expect(grants.length).toBeGreaterThan(0);
      for (const id of grants) expect(CATALOG_IDS.has(id)).toBe(true);
    }
  });

  it('blue and white grants are read/inspect-grade only (local_read or passive)', () => {
    for (const archetype of ['blue', 'white'] as const) {
      for (const id of teamToolGrants(archetype)) {
        expect(['local_read', 'passive']).toContain(RISK_BY_ID.get(id));
      }
    }
  });

  it('black grants are routing/noise-grade: no intrusive, credential, or dangerous tools', () => {
    for (const id of teamToolGrants('black')) {
      expect(['intrusive', 'credential', 'dangerous']).not.toContain(RISK_BY_ID.get(id));
    }
  });

  it('blue and white never receive an offensive team grant and black stays disjoint from both', () => {
    const black = new Set(teamToolGrants('black'));
    const blue = new Set(teamToolGrants('blue'));
    const white = new Set(teamToolGrants('white'));
    for (const id of blue) expect(black.has(id)).toBe(false);
    for (const id of white) expect(black.has(id)).toBe(false);
    // blue ∩ white overlap is justified: both are read-only inspectors of evidence
    // artifacts, so shared local_read ids are intentional, not grant leakage.
    const overlap = [...blue].filter(id => white.has(id));
    expect(overlap.length).toBeGreaterThan(0);
    for (const id of overlap) expect(['local_read', 'passive']).toContain(RISK_BY_ID.get(id));
  });

  it('rejects non-team archetypes (purple is orchestrator-level, not an operator)', () => {
    expect(() => teamToolGrants('recon')).toThrow();
    expect(() => teamToolGrants('ghost')).toThrow();
  });
});

describe('family-team mapping', () => {
  it('white referees every mission family; black and blue cover their specialist families', () => {
    const familyCount = new Set(Object.values(FAMILY_TEAM_MAPPING).flat()).size;
    expect(FAMILY_TEAM_MAPPING.white.length).toBe(familyCount);
    for (const archetype of TEAM_ARCHETYPES) {
      expect(FAMILY_TEAM_MAPPING[archetype].length).toBeGreaterThan(0);
      for (const family of FAMILY_TEAM_MAPPING[archetype]) {
        expect(family).toMatch(/^[a-z_]+$/);
      }
    }
    expect(FAMILY_TEAM_MAPPING.black).toContain('web_api');
    expect(FAMILY_TEAM_MAPPING.blue).toContain('reporting_remediation');
  });
});

describe('phase 26 family routing without grant change', () => {
  it('blue is selectable for ai_red_team and agent_warfare without gaining an offensive tool', () => {
    expect(FAMILY_TEAM_MAPPING.blue).toContain('ai_red_team');
    expect(FAMILY_TEAM_MAPPING.blue).toContain('agent_warfare');
    expect(FAMILY_TEAM_MAPPING.black).toContain('ai_red_team');
    expect(FAMILY_TEAM_MAPPING.black).toContain('agent_warfare');
    // A family label never grants a tool: blue grants are unchanged
    // read/inspect-grade ids only.
    for (const id of teamToolGrants('blue')) {
      expect(['local_read', 'passive']).toContain(RISK_BY_ID.get(id));
    }
  });

  it('blue/white probe-grade profile tools stay denied: profiles are not authority', () => {
    // The operator defaultTools profiles list probe-grade http_request and
    // curl_request, but the frozen per-run allowlist resolves from the
    // catalog grant tables — never from defaultTools.
    for (const archetype of ['blue', 'white'] as const) {
      const grants = new Set(teamToolGrants(archetype));
      expect(grants.has('http_request')).toBe(false);
      expect(grants.has('curl_request')).toBe(false);
    }
  });
});
