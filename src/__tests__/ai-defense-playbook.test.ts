import { describe, it, expect } from 'vitest';
import {
  AI_DEFENSE_PLAYBOOK,
  AI_DEFENSE_TECHNIQUE_IDS,
  aiDefenseBriefing,
  defenseTechnique,
} from '../resources/ai-defense-playbook.js';

describe('AI defense playbook (blue parity with the red arsenal)', () => {
  it('has the full defense technique set', () => {
    expect(AI_DEFENSE_PLAYBOOK.length).toBeGreaterThanOrEqual(16);
    expect(AI_DEFENSE_PLAYBOOK.length).toBeLessThanOrEqual(20);
    expect(AI_DEFENSE_TECHNIQUE_IDS.length).toBe(AI_DEFENSE_PLAYBOOK.length);
  });

  it('every technique is well-formed (all fields, kebab-case id)', () => {
    for (const t of AI_DEFENSE_PLAYBOOK) {
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const field of ['category', 'telemetry', 'signal', 'validation'] as const) {
        expect(typeof t[field]).toBe('string');
        expect(t[field].length).toBeGreaterThan(10);
      }
    }
  });

  it('ids are unique', () => {
    expect(new Set(AI_DEFENSE_TECHNIQUE_IDS).size).toBe(AI_DEFENSE_TECHNIQUE_IDS.length);
  });

  it('spans the required defense domains', () => {
    for (const domain of ['Endpoint', 'Network', 'Identity', 'Cloud', 'Supply Chain', 'Deception', 'Threat Hunting']) {
      expect(AI_DEFENSE_PLAYBOOK.some(t => t.category.startsWith(domain))).toBe(true);
    }
  });

  it('lookup resolves a known id and rejects unknown', () => {
    expect(defenseTechnique('process-lineage-anomaly')?.category).toMatch(/endpoint/i);
    expect(defenseTechnique('does-not-exist')).toBeUndefined();
  });

  it('briefing is a non-empty multi-line summary covering every technique', () => {
    const brief = aiDefenseBriefing();
    expect(brief.length).toBeGreaterThan(100);
    expect(brief.split('\n').length).toBe(AI_DEFENSE_PLAYBOOK.length);
    for (const id of AI_DEFENSE_TECHNIQUE_IDS) {
      expect(brief).toContain(`[${id}]`);
    }
  });

  it('briefing honors a limit smaller than the playbook', () => {
    const brief = aiDefenseBriefing(3);
    expect(brief.split('\n').length).toBe(3);
  });

  it('every technique names concrete telemetry, a detection signal, and a validation method', () => {
    expect(AI_DEFENSE_PLAYBOOK.every(t => t.telemetry.trim().length > 0 && t.signal.trim().length > 0 && t.validation.trim().length > 0)).toBe(true);
  });
});
