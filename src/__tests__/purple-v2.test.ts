import { describe, it, expect } from 'vitest';
import { synthesize, type DarkPurpleSynthesis, type PurpleVerdictByFinding } from '../teams/purple.js';
import type { DetectionGap, RedFindingShape } from '../teams/blue.js';
import type { RoeVerdict } from '../teams/white.js';

// Purple v2 behavioral pins: id-keyed correlation, declared positional fallback,
// and the deterministic residual-risk tier table. Pure module only — no server
// import (the route pass-through is pinned by teams-integration-static.test.ts).

function gap(findingId: string, coverage: DetectionGap['coverage']): DetectionGap {
  return { findingId, coverage, recommendedControl: `test control for ${findingId}` };
}

function row(synthesis: DarkPurpleSynthesis, findingId: string): DarkPurpleSynthesis['coverageMatrix'][number] {
  const entry = synthesis.coverageMatrix.find(row => row.findingId === findingId);
  if (!entry) throw new Error(`coverageMatrix row missing for ${findingId}`);
  return entry;
}

describe('purple v2: id-keyed correlation', () => {
  const findings: RedFindingShape[] = [
    { id: 'f-a', title: 'SQL injection', severity: 'high' },
    { id: 'f-b', title: 'Missing headers', severity: 'low' },
  ];
  // Decoy: under the v1 positional join this array would put 'compliant' on
  // f-a (index 0) and nothing on f-b. The id-keyed map must ignore it entirely.
  const positionalDecoy: RoeVerdict[] = [
    { actionIndex: 0, verdict: 'compliant', rationale: 'decoy', conditions: [] },
  ];
  // Shuffled insertion order: f-b before f-a, plus an unknown-finding key.
  const shuffled: Record<string, PurpleVerdictByFinding> = {
    'f-b': { verdict: 'compliant' },
    'unknown-finding': { verdict: 'violation' },
    'f-a': { verdict: 'violation', rationale: 'out of scope target' },
  };

  it('joins the verdict stored under finding X to finding X regardless of map insertion order', () => {
    const result = synthesize({ findings, detections: [], verdicts: positionalDecoy, verdictsByFinding: shuffled });

    expect(result.correlation).toBe('id');
    expect(row(result, 'f-a').verdict).toBe('violation');
    expect(row(result, 'f-b').verdict).toBe('compliant');
    // The unknown key neither crashes nor leaks its verdict onto a real finding.
    expect(result.coverageMatrix).toHaveLength(2);
    expect(row(result, 'f-a').verdict).not.toBe('compliant');
  });

  it('id mode wins even when the positional array would tell the opposite story', () => {
    const result = synthesize({
      findings,
      detections: [],
      verdicts: positionalDecoy,
      verdictsByFinding: { 'f-a': { verdict: 'violation' }, 'f-b': { verdict: 'compliant' } },
    });
    // Positional would have f-a 'compliant' (decoy index 0); id join says violation.
    expect(result.correlation).toBe('id');
    expect(row(result, 'f-a').verdict).toBe('violation');
  });

  it('a findings id with no map entry carries no verdict instead of shifting neighbors', () => {
    const result = synthesize({
      findings,
      detections: [],
      verdicts: positionalDecoy,
      verdictsByFinding: { 'f-b': { verdict: 'compliant' } },
    });
    expect(row(result, 'f-a').verdict).toBeUndefined();
    expect(row(result, 'f-b').verdict).toBe('compliant');
  });
});

describe('purple v2: declared correlation mode', () => {
  const findings: RedFindingShape[] = [
    { id: 'f1', severity: 'medium' },
    { id: 'f2', severity: 'low' },
  ];

  it('without verdictsByFinding the v1 positional join applies and is declared', () => {
    const verdicts: RoeVerdict[] = [
      { actionIndex: 0, verdict: 'violation', rationale: 'r', conditions: [] },
      { actionIndex: 1, verdict: 'needs_approval', rationale: 'r', conditions: [] },
    ];
    const result = synthesize({ findings, detections: [], verdicts });

    expect(result.correlation).toBe('positional-fallback');
    expect(row(result, 'f1').verdict).toBe('violation');
    expect(row(result, 'f2').verdict).toBe('needs_approval');
  });

  it('an empty verdictsByFinding object still declares id mode', () => {
    const result = synthesize({ findings, detections: [], verdicts: [], verdictsByFinding: {} });
    expect(result.correlation).toBe('id');
    expect(result.coverageMatrix.every(entry => entry.verdict === undefined)).toBe(true);
  });
});

describe('purple v2: residual-risk tier table', () => {
  // One row per severity × coverage × verdict combination the model defines.
  // Expected tiers follow the documented f(): base = severity index 4..0
  // (critical..info), +1 tier when detection is 'none' (capped at critical),
  // floored at 'high' when the verdict is 'violation'; missing/unknown
  // severity defaults to the medium base.
  const CASES: Array<{
    id: string;
    severity?: string;
    coverage: DetectionGap['coverage'];
    verdict: PurpleVerdictByFinding['verdict'] | undefined;
    expected: string;
  }> = [
    { id: 'r-1', severity: 'critical', coverage: 'covered', verdict: 'compliant', expected: 'critical' },
    { id: 'r-2', severity: 'critical', coverage: 'none', verdict: 'compliant', expected: 'critical' },
    { id: 'r-3', severity: 'high', coverage: 'covered', verdict: 'compliant', expected: 'high' },
    { id: 'r-4', severity: 'high', coverage: 'none', verdict: 'compliant', expected: 'critical' },
    { id: 'r-5', severity: 'medium', coverage: 'covered', verdict: 'compliant', expected: 'medium' },
    { id: 'r-6', severity: 'medium', coverage: 'partial', verdict: 'compliant', expected: 'medium' },
    { id: 'r-7', severity: 'medium', coverage: 'none', verdict: 'compliant', expected: 'high' },
    { id: 'r-8', severity: 'low', coverage: 'covered', verdict: 'compliant', expected: 'low' },
    { id: 'r-9', severity: 'info', coverage: 'covered', verdict: 'compliant', expected: 'info' },
    { id: 'r-10', severity: 'medium', coverage: 'covered', verdict: 'violation', expected: 'high' },
    { id: 'r-11', severity: 'critical', coverage: 'covered', verdict: 'violation', expected: 'critical' },
    { id: 'r-12', severity: 'low', coverage: 'none', verdict: 'violation', expected: 'high' },
    { id: 'r-13', severity: 'info', coverage: 'none', verdict: 'violation', expected: 'high' },
    { id: 'r-14', severity: 'low', coverage: 'partial', verdict: 'needs_approval', expected: 'low' },
    { id: 'r-15', coverage: 'covered', verdict: 'compliant', expected: 'medium' },
    { id: 'r-16', severity: 'apocalyptic', coverage: 'partial', verdict: 'compliant', expected: 'medium' },
  ];

  it('maps every severity × coverage × verdict combination to the documented tier', () => {
    const findings = CASES.map(entry => ({ id: entry.id, severity: entry.severity }));
    const detections = CASES.map(entry => gap(entry.id, entry.coverage));
    const verdictsByFinding: Record<string, PurpleVerdictByFinding> = {};
    for (const entry of CASES) {
      if (entry.verdict) verdictsByFinding[entry.id] = { verdict: entry.verdict };
    }

    const result = synthesize({ findings, detections, verdicts: [], verdictsByFinding });
    expect(result.correlation).toBe('id');
    for (const entry of CASES) {
      expect(row(result, entry.id).riskTier, `${entry.id} (${entry.severity ?? 'none-stated'}/${entry.coverage}/${entry.verdict ?? 'absent'})`).toBe(entry.expected);
    }
  });

  it('coverage none bumps the tier exactly one step, capped at critical', () => {
    const findings = [
      { id: 'c-low', severity: 'low' },
      { id: 'c-info', severity: 'info' },
    ];
    const detections = [gap('c-low', 'none'), gap('c-info', 'none')];
    const result = synthesize({ findings, detections, verdicts: [], verdictsByFinding: {} });
    expect(row(result, 'c-low').riskTier).toBe('medium');
    expect(row(result, 'c-info').riskTier).toBe('low');
  });
});

describe('purple v2: unresolved and nextMissions invariants preserved', () => {
  it('flags no-coverage findings into unresolved plus detection missions', () => {
    const result = synthesize({
      findings: [{ id: 'g1', severity: 'critical' }, { id: 'g2', severity: 'low' }],
      detections: [gap('g1', 'none'), gap('g2', 'none')],
      verdicts: [],
      verdictsByFinding: {},
    });

    expect(result.unresolved).toEqual(['g1', 'g2']);
    expect(result.nextMissions.some(m => m.startsWith('Detection engineering:'))).toBe(true);
    expect(result.nextMissions.some(m => m.startsWith('Telemetry backlog:'))).toBe(true);
    expect(result.nextMissions[result.nextMissions.length - 1]).toContain('Purple regression');
  });

  it('escalates violations into unresolved plus ROE remediation, via the id-keyed map', () => {
    const result = synthesize({
      findings: [{ id: 'g3', severity: 'high' }],
      detections: [gap('g3', 'covered')],
      verdicts: [],
      verdictsByFinding: { 'g3': { verdict: 'violation' } },
    });

    expect(result.unresolved).toEqual(['g3']);
    expect(result.nextMissions.some(m => m.startsWith('ROE remediation:'))).toBe(true);
  });

  it('routes needs_approval verdicts to the approval path without marking unresolved', () => {
    const result = synthesize({
      findings: [{ id: 'g4', severity: 'medium' }],
      detections: [gap('g4', 'covered')],
      verdicts: [],
      verdictsByFinding: { 'g4': { verdict: 'needs_approval' } },
    });

    expect(result.unresolved).toEqual([]);
    expect(result.nextMissions.some(m => m.startsWith('Approval path:'))).toBe(true);
    expect(result.nextMissions[result.nextMissions.length - 1]).toContain('Purple regression');
  });

  it('fully covered compliant findings stay resolved', () => {
    const result = synthesize({
      findings: [{ id: 'g5', severity: 'high' }],
      detections: [gap('g5', 'covered')],
      verdicts: [],
      verdictsByFinding: { 'g5': { verdict: 'compliant' } },
    });

    expect(result.unresolved).toEqual([]);
    expect(result.nextMissions[result.nextMissions.length - 1]).toContain('Purple regression');
  });
});
