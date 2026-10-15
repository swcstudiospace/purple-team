import { describe, it, expect } from 'vitest';
import {
  AI_TRADECRAFT_PLAYBOOK,
  AI_TRADECRAFT_TECHNIQUE_IDS,
  aiTradecraftBriefing,
  tradecraftTechnique,
  type OpsecRiskLevel,
} from '../resources/ai-tradecraft-playbook.js';
import { teamToolGrants } from '../teams/index.js';
import { hatToolGrants } from '../teams/hats.js';
import { ATTACK_BY_ID } from '../teams/black/attack-data.js';

const RISK_LEVELS: readonly OpsecRiskLevel[] = ['low', 'medium', 'high', 'critical'];

describe('AI tradecraft playbook (black counterpart to the blue corpus)', () => {
  it('has the full tradecraft technique set', () => {
    expect(AI_TRADECRAFT_PLAYBOOK.length).toBeGreaterThanOrEqual(15);
    expect(AI_TRADECRAFT_PLAYBOOK.length).toBeLessThanOrEqual(20);
    expect(AI_TRADECRAFT_TECHNIQUE_IDS.length).toBe(AI_TRADECRAFT_PLAYBOOK.length);
  });

  it('every technique is well-formed (all fields, kebab-case id, ATT&CK-shaped attckId)', () => {
    for (const t of AI_TRADECRAFT_PLAYBOOK) {
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.attckId).toMatch(/^T\d{4}(\.\d{3})?$/);
      for (const field of ['detectionSurface', 'tradecraftUse', 'evidence', 'validation', 'completion'] as const) {
        expect(typeof t[field]).toBe('string');
        expect(t[field].length).toBeGreaterThan(10);
      }
      expect(t.permittedTools.length).toBeGreaterThan(0);
    }
  });

  it('ids are unique', () => {
    expect(new Set(AI_TRADECRAFT_TECHNIQUE_IDS).size).toBe(AI_TRADECRAFT_TECHNIQUE_IDS.length);
  });

  it('every attckId resolves in the vendored ATT&CK universe (no invented ids)', () => {
    for (const t of AI_TRADECRAFT_PLAYBOOK) {
      expect(ATTACK_BY_ID[t.attckId], `attckId ${t.attckId} (${t.id}) absent from ATTACK_BY_ID`).toBeDefined();
    }
  });

  it('opsecRisk stays inside the declared union', () => {
    for (const t of AI_TRADECRAFT_PLAYBOOK) {
      expect(RISK_LEVELS).toContain(t.opsecRisk);
    }
  });

  it('tactic spread covers at least four distinct ATT&CK tactics', () => {
    const tactics = new Set(AI_TRADECRAFT_PLAYBOOK.flatMap(t => ATTACK_BY_ID[t.attckId]?.tactics ?? []));
    expect(tactics.size).toBeGreaterThanOrEqual(4);
  });

  it('id list is derived from the playbook in order', () => {
    expect(AI_TRADECRAFT_TECHNIQUE_IDS).toEqual(AI_TRADECRAFT_PLAYBOOK.map(t => t.id));
  });

  it('lookup resolves a known id and rejects unknown', () => {
    expect(tradecraftTechnique('passive-recon-first')?.attckId).toBe('T1596');
    expect(tradecraftTechnique('does-not-exist')).toBeUndefined();
  });

  it('briefing is a non-empty multi-line summary covering every technique', () => {
    const brief = aiTradecraftBriefing();
    expect(brief.length).toBeGreaterThan(100);
    expect(brief.split('\n').length).toBe(AI_TRADECRAFT_PLAYBOOK.length);
    for (const id of AI_TRADECRAFT_TECHNIQUE_IDS) {
      expect(brief).toContain(`[${id}]`);
    }
  });

  it('briefing honors a limit smaller than the playbook', () => {
    const brief = aiTradecraftBriefing(3);
    expect(brief.split('\n').length).toBe(3);
  });

  it('every technique names concrete telemetry and a quiet-operations discipline', () => {
    expect(AI_TRADECRAFT_PLAYBOOK.every(t => t.detectionSurface.trim().length > 0 && t.tradecraftUse.trim().length > 0)).toBe(true);
  });
  it('permitted-tool ids reference existing black grants only (labels, never new ids)', () => {
    const grants = new Set([...teamToolGrants('black'), ...hatToolGrants('specter'), ...hatToolGrants('wraith')]);
    for (const t of AI_TRADECRAFT_PLAYBOOK) {
      for (const id of t.permittedTools) {
        expect(grants.has(id), `tool ${id} (${t.id}) is not an existing black grant`).toBe(true);
      }
    }
  });

  it('briefing lines carry evidence, tool, validation, completion, and untrusted-data segments', () => {
    const lines = aiTradecraftBriefing().split('\n');
    expect(lines.length).toBe(AI_TRADECRAFT_PLAYBOOK.length);
    lines.forEach((line, i) => {
      const t = AI_TRADECRAFT_PLAYBOOK[i];
      expect(line).toContain(`[${t.id}]`);
      expect(line).toContain('evidence:');
      expect(line).toContain(t.evidence.slice(0, 40));
      expect(line).toContain('tools:');
      for (const id of t.permittedTools) expect(line).toContain(id);
      expect(line).toContain('grants unchanged');
      expect(line).toContain('validation:');
      expect(line).toContain('done:');
      expect(line).toContain(t.completion.slice(0, 40));
      expect(line).toContain('untrusted-data');
    });
  });
});
