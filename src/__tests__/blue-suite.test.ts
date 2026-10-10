import { describe, it, expect } from 'vitest';
import { D3FEND_BY_ID, D3FEND_TERMS } from '../teams/blue/d3fend.js';
import { registryTelemetry, TELEMETRY_REGISTRY } from '../teams/blue/telemetry.js';
import { coverageGaps, type CoverageFinding, type CoverageGap, type TelemetryDeclaration } from '../teams/blue/coverage.js';
import { sigmaRulepack } from '../teams/blue/rulepacks.js';

describe('blue pipeline: vendored D3FEND ontology', () => {
  it('parses exactly 271 ontology terms into an id-keyed lookup', () => {
    expect(D3FEND_TERMS).toHaveLength(271);
    expect(Object.keys(D3FEND_BY_ID)).toHaveLength(271);
    expect(D3FEND_TERMS.every(term => /^D3-/.test(term.id))).toBe(true);
  });

  it('resolves every telemetry registry coveredIds in the ontology (registry never drifts)', () => {
    const unknown: string[] = [];
    for (const spec of TELEMETRY_REGISTRY) {
      for (const id of spec.coveredIds) {
        if (!D3FEND_BY_ID[id]) unknown.push(`${spec.source}: ${id}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});

describe('blue pipeline: coverageGaps', () => {
  it('scores covered, partial, and none against declared telemetry', () => {
    const findings: CoverageFinding[] = [
      { id: 'F-COVERED', countermeasures: ['D3-PA', 'D3-PSA'] },
      { id: 'F-PARTIAL', countermeasures: ['D3-PA', 'D3-FH'] },
      { id: 'F-NONE', countermeasures: ['D3-FIM', 'D3-SFA'] },
    ];
    const telemetry: TelemetryDeclaration[] = [
      { source: 'edr-process', countermeasures: ['D3-PA', 'D3-PSA'] },
    ];
    const gaps = coverageGaps(findings, telemetry);
    const byId: Record<string, CoverageGap> = Object.fromEntries(gaps.map(gap => [gap.findingId, gap]));
    expect(byId['F-COVERED']?.coverage).toBe('covered');
    expect(byId['F-COVERED']?.uncoveredCountermeasures).toEqual([]);
    expect(byId['F-PARTIAL']?.coverage).toBe('partial');
    expect(byId['F-PARTIAL']?.coveredCountermeasures).toEqual(['D3-PA']);
    expect(byId['F-PARTIAL']?.uncoveredCountermeasures).toEqual(['D3-FH']);
    // Uncovered while telemetry IS deployed → 'partial' (documented contract);
    // 'none' requires an empty telemetry declaration.
    expect(byId['F-NONE']?.coverage).toBe('partial');
    expect(byId['F-NONE']?.uncoveredCountermeasures).toEqual(['D3-FIM', 'D3-SFA']);
    const noTelemetry = coverageGaps(findings, []);
    const noneById: Record<string, CoverageGap> = Object.fromEntries(noTelemetry.map(gap => [gap.findingId, gap]));
    expect(noneById['F-NONE']?.coverage).toBe('none');
    expect(noneById['F-COVERED']?.coverage).toBe('none');
  });

  it('surfaces unresolved countermeasure ids in the gap instead of dropping them', () => {
    const gaps = coverageGaps([{ id: 'F-BOGUS', countermeasures: ['D3-PA', 'D3-NOT-REAL'] }], []);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].countermeasures).toEqual(['D3-PA']);
    expect(gaps[0].unresolvedCountermeasures).toEqual(['D3-NOT-REAL']);
    expect(gaps[0].recommendation).toContain('D3-NOT-REAL');
  });

  it('falls back to v1 semantics for keyless findings and says so in the recommendation', () => {
    const withTelemetry = coverageGaps([{ id: 'F-KEYLESS' }], [{ source: 'edr-process' }]);
    expect(withTelemetry[0].coverage).toBe('partial');
    expect(withTelemetry[0].countermeasures).toEqual([]);
    expect(withTelemetry[0].recommendation).toContain('no D3FEND countermeasure keys');

    const bare = coverageGaps([{ id: 'F-KEYLESS' }], []);
    expect(bare[0].coverage).toBe('none');
    expect(bare[0].recommendation).toContain('no D3FEND countermeasure keys');
  });

  it('still counts direct finding-id coverage from deployed sources (v1 compatibility)', () => {
    const gaps = coverageGaps(
      [{ id: 'F-DIRECT' }],
      [{ source: 'siem', coveredIds: ['F-DIRECT'] }],
    );
    expect(gaps[0].coverage).toBe('covered');
    expect(gaps[0].recommendation).toContain('by finding id');
  });

  it('reports an honest empty report for an empty ledger', () => {
    expect(coverageGaps([], registryTelemetry())).toEqual([]);
  });
});

describe('blue pipeline: sigmaRulepack', () => {
  const SIGMA_REQUIRED_FIELDS = [
    'title:',
    'id:',
    'status:',
    'description:',
    'references:',
    'author:',
    'logsource:',
    'detection:',
    'falsepositives:',
    'level:',
    'tags:',
  ];

  it('generates a deterministic experimental rule with a d3fend.* tag and all Sigma fields in the YAML', () => {
    const findings: CoverageFinding[] = [
      {
        id: 'F-1',
        title: 'SQL injection in login form',
        severity: 'high',
        evidence: ['UNION SELECT payload echoed in the error page'],
        countermeasures: ['D3-DQSA', 'D3-CSPP'],
      },
    ];
    const gaps = coverageGaps(findings, [{ source: 'edr-process', countermeasures: ['D3-PA'] }]);
    expect(gaps[0].uncoveredCountermeasures).toEqual(['D3-DQSA', 'D3-CSPP']);

    const first = sigmaRulepack(findings, gaps);
    const second = sigmaRulepack(findings, gaps);
    expect(first.yaml).toBe(second.yaml);
    expect(first.rules).toHaveLength(1);

    const rule = first.rules[0];
    expect(rule.status).toBe('experimental');
    expect(rule.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(rule.tags.every(tag => tag.startsWith('d3fend.'))).toBe(true);
    expect(rule.level).toBe('high');
    for (const field of SIGMA_REQUIRED_FIELDS) {
      expect(first.yaml).toContain(field);
    }
  });

  it('produces no rule for keyless or fully covered gaps', () => {
    const findings: CoverageFinding[] = [
      { id: 'F-KEYLESS', title: 'Missing security header' },
      { id: 'F-COVERED', title: 'Covered by EDR', countermeasures: ['D3-PA'] },
    ];
    const telemetry: TelemetryDeclaration[] = [{ source: 'edr-process', countermeasures: ['D3-PA'] }];
    const gaps = coverageGaps(findings, telemetry);
    const pack = sigmaRulepack(findings, gaps);
    expect(pack.rules).toEqual([]);
    expect(pack.yaml).toBe('');
  });
});
