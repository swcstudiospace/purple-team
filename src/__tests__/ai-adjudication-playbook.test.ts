import { describe, it, expect } from 'vitest';
import {
  AI_ADJUDICATION_PLAYBOOK,
  AI_ADJUDICATION_TECHNIQUE_IDS,
  adjudicationTechniquesForFramework,
  aiAdjudicationBriefing,
  adjudicationTechnique,
  type AdjudicationFramework,
} from '../resources/ai-adjudication-playbook.js';
import { TOOL_ADAPTERS } from '../arsenal/catalog.js';

const FRAMEWORKS: readonly AdjudicationFramework[] = ['nist-800-115', 'ptes', 'osstmm'];

describe('AI adjudication playbook (white governance rule catalogs)', () => {
  it('has the full adjudication technique set', () => {
    expect(AI_ADJUDICATION_PLAYBOOK.length).toBeGreaterThanOrEqual(15);
    expect(AI_ADJUDICATION_PLAYBOOK.length).toBeLessThanOrEqual(20);
    expect(AI_ADJUDICATION_TECHNIQUE_IDS.length).toBe(AI_ADJUDICATION_PLAYBOOK.length);
  });

  it('every technique is well-formed (all fields, kebab-case id)', () => {
    for (const t of AI_ADJUDICATION_PLAYBOOK) {
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const field of ['control', 'adjudicationRule', 'evidenceStandard'] as const) {
        expect(typeof t[field]).toBe('string');
        expect(t[field].length).toBeGreaterThan(10);
      }
    }
  });

  it('ids are unique', () => {
    expect(new Set(AI_ADJUDICATION_TECHNIQUE_IDS).size).toBe(AI_ADJUDICATION_TECHNIQUE_IDS.length);
  });

  it('every framework id resolves in the governance catalog (no invented ids)', () => {
    const GOVERNANCE_IDS: Record<string, boolean> = Object.fromEntries(
      TOOL_ADAPTERS.filter(adapter => adapter.category === 'governance').map(adapter => [adapter.id, true]),
    );
    for (const t of AI_ADJUDICATION_PLAYBOOK) {
      expect(GOVERNANCE_IDS[t.framework], `framework ${t.framework} (${t.id}) absent from the TOOL_ADAPTERS governance category`).toBe(true);
    }
  });

  it('frameworks stay inside the declared union', () => {
    for (const t of AI_ADJUDICATION_PLAYBOOK) {
      expect(FRAMEWORKS).toContain(t.framework);
    }
  });

  it('all three governance packs are covered with real depth', () => {
    for (const framework of FRAMEWORKS) {
      expect(adjudicationTechniquesForFramework(framework).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('id list is derived from the playbook in order', () => {
    expect(AI_ADJUDICATION_TECHNIQUE_IDS).toEqual(AI_ADJUDICATION_PLAYBOOK.map(t => t.id));
  });

  it('lookup resolves a known id and rejects unknown', () => {
    expect(adjudicationTechnique('roe-authorization-gate')?.framework).toBe('nist-800-115');
    expect(adjudicationTechnique('does-not-exist')).toBeUndefined();
  });

  it('framework accessor filters exactly', () => {
    for (const technique of adjudicationTechniquesForFramework('osstmm')) {
      expect(technique.framework).toBe('osstmm');
    }
    expect(adjudicationTechniquesForFramework('ptes').length + adjudicationTechniquesForFramework('osstmm').length + adjudicationTechniquesForFramework('nist-800-115').length).toBe(AI_ADJUDICATION_PLAYBOOK.length);
  });

  it('briefing is a non-empty multi-line summary covering every technique', () => {
    const brief = aiAdjudicationBriefing();
    expect(brief.length).toBeGreaterThan(100);
    expect(brief.split('\n').length).toBe(AI_ADJUDICATION_PLAYBOOK.length);
    for (const id of AI_ADJUDICATION_TECHNIQUE_IDS) {
      expect(brief).toContain(`[${id}]`);
    }
  });

  it('briefing honors a limit smaller than the playbook', () => {
    const brief = aiAdjudicationBriefing(3);
    expect(brief.split('\n').length).toBe(3);
  });

  it('every technique names a framework anchor and an evidence standard', () => {
    expect(AI_ADJUDICATION_PLAYBOOK.every(t => t.control.trim().length > 0 && t.evidenceStandard.trim().length > 0)).toBe(true);
  });
});
