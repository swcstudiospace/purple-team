import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { D3FEND_BY_ID, D3FEND_TERMS } from '../teams/blue/d3fend.js';
import { registryTelemetry, TELEMETRY_REGISTRY } from '../teams/blue/telemetry.js';
import { coverageGaps, type CoverageFinding, type CoverageGap, type TelemetryDeclaration } from '../teams/blue/coverage.js';
import { sigmaRulepack, validateDetectorStanding } from '../teams/blue/rulepacks.js';
import {
  applyHardeningRetest,
  detectionGaps,
  evaluateHardeningRetest,
  hardeningPlan,
} from '../teams/blue.js';
import {
  BLUE_WORKFLOW_FAMILIES,
  blueInputHash,
  runBlueCoverageAcrossFamilies,
  runBlueCoverageStage,
  runBlueDetectionStage,
  runBlueDetectorStage,
  runBlueRetestStage,
} from '../teams/blue/workflow.js';
import { BLUE_PARENT_PROMPT, BLUE_SENTINEL_PROMPT, BLUE_WARDEN_PROMPT } from '../prompts/blue.js';
import { FAMILY_TEAM_MAPPING } from '../teams/index.js';

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
        if (!D3FEND_BY_ID[id]) unknown.push(`${spec.source}:${id}`);
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
    // Id overlap alone is not coverage: without an observed artifact id the
    // overlapped finding caps at partial with a limitation.
    const gaps = coverageGaps(findings, telemetry);
    const byId: Record<string, CoverageGap> = Object.fromEntries(gaps.map(gap => [gap.findingId, gap]));
    expect(byId['F-COVERED']?.coverage).toBe('partial');
    expect(byId['F-COVERED']?.uncoveredCountermeasures).toEqual([]);
    expect(byId['F-COVERED']?.limitations.length).toBeGreaterThan(0);
    expect(byId['F-COVERED']?.limitations.join(' ')).toContain('observed artifact id');
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

  it('yields covered only once an observed artifact id is linked to the finding', () => {
    const findings: CoverageFinding[] = [{ id: 'F-COVERED', countermeasures: ['D3-PA', 'D3-PSA'] }];
    const telemetry: TelemetryDeclaration[] = [
      { source: 'edr-process', countermeasures: ['D3-PA', 'D3-PSA'] },
    ];
    const bound = coverageGaps(findings, telemetry, { 'F-COVERED': ['A-1'] });
    expect(bound[0].coverage).toBe('covered');
    expect(bound[0].limitations).toEqual([]);
    expect(bound[0].uncoveredCountermeasures).toEqual([]);
    // An artifact bound to a different finding does not cover this one.
    const other = coverageGaps(findings, telemetry, { 'F-ELSEWHERE': ['A-1'] });
    expect(other[0].coverage).toBe('partial');
  });

  it('never lets a coverage-claiming recommendation string upgrade the standing', () => {
    const findings: CoverageFinding[] = [
      {
        id: 'F-PROSE',
        countermeasures: ['D3-PA'],
        evidence: ['Existing telemetry covers F-PROSE; retain and regression-test it'],
      },
    ];
    const telemetry: TelemetryDeclaration[] = [{ source: 'edr-process', countermeasures: ['D3-PA'] }];
    const gaps = coverageGaps(findings, telemetry);
    expect(gaps[0].coverage).toBe('partial');
    expect(gaps[0].limitations.length).toBeGreaterThan(0);
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

  it('treats direct finding-id overlap without an artifact as partial with a limitation (v1 compatibility)', () => {
    const gaps = coverageGaps(
      [{ id: 'F-DIRECT' }],
      [{ source: 'siem', coveredIds: ['F-DIRECT'] }],
    );
    expect(gaps[0].coverage).toBe('partial');
    expect(gaps[0].recommendation).toContain('by finding id');
    expect(gaps[0].limitations.join(' ')).toContain('observed artifact id');
    const bound = coverageGaps(
      [{ id: 'F-DIRECT' }],
      [{ source: 'siem', coveredIds: ['F-DIRECT'] }],
      { 'F-DIRECT': ['A-9'] },
    );
    expect(bound[0].coverage).toBe('covered');
    expect(bound[0].recommendation).toContain('by finding id');
  });

  it('reports an honest empty report for an empty ledger', () => {
    expect(coverageGaps([], registryTelemetry())).toEqual([]);
  });
});

describe('blue team: detectionGaps artifact binding', () => {
  const findings = [{ id: 'f1', title: 'SQL injection in /api/users', severity: 'critical' }];
  const telemetry = [{ source: 'siem', coveredIds: ['f1'] }];

  it('keeps coveredIds-only overlap at partial with a limitation', () => {
    const gaps = detectionGaps(findings, telemetry);
    expect(gaps[0].coverage).toBe('partial');
    expect(gaps[0].recommendedControl).toContain('Limitation:');
    expect(gaps[0].recommendedControl).toContain('observed artifact id');
  });

  it('returns covered once an observed artifact id is linked', () => {
    const gaps = detectionGaps(findings, telemetry, { f1: ['A-2'] });
    expect(gaps[0].coverage).toBe('covered');
    expect(gaps[0].recommendedControl).toContain('regression-test');
  });

  it('still returns none when no telemetry exists at all', () => {
    const gaps = detectionGaps(findings);
    expect(gaps[0].coverage).toBe('none');
  });
});

describe('blue pipeline: detector standing', () => {
  it('returns unavailable plus the catalog next action for syntax-only YAML with no evidence compare', () => {
    const result = validateDetectorStanding({
      findingId: 'F-1',
      validator: 'sigma',
      pattern: 'UNION SELECT',
      matchingEvidence: [],
      nonMatchingEvidence: [],
      ruleYaml: 'title: sqli attempt\nstatus: experimental\nlogsource:\n  category: web',
    });
    expect(result.standing).toBe('unavailable');
    expect(result.nextAction).toContain('pipx install sigma-cli');
    expect(result.validator).toBe('sigma');
  });

  it('returns validated when matching evidence hits and non-matching evidence misses', () => {
    const result = validateDetectorStanding({
      findingId: 'F-1',
      validator: 'sigma',
      pattern: 'UNION SELECT',
      matchingEvidence: ["error page echoed 'UNION SELECT 1,2,3' from the login form"],
      nonMatchingEvidence: ['normal login POST with username and password fields'],
    });
    expect(result.standing).toBe('validated');
    expect(result.nextAction).toBeUndefined();
  });

  it('returns failed when the evidence does not discriminate', () => {
    const result = validateDetectorStanding({
      findingId: 'F-1',
      validator: 'sigma',
      pattern: 'UNION SELECT',
      matchingEvidence: ['normal login POST with username and password fields'],
      nonMatchingEvidence: ["error page echoed 'UNION SELECT 1,2,3'"],
    });
    expect(result.standing).toBe('failed');
    expect(result.detail).toContain('did not discriminate');
  });

  it('names the yara install hint when yara validation cannot compare', () => {
    const result = validateDetectorStanding({
      findingId: 'F-2',
      validator: 'yara',
      pattern: 'MZ',
      matchingEvidence: [],
      nonMatchingEvidence: [],
    });
    expect(result.standing).toBe('unavailable');
    expect(result.nextAction).toContain('brew install yara');
  });

  it('throws before computing on bad detector arguments', () => {
    expect(() =>
      validateDetectorStanding({
        findingId: '   ',
        validator: 'sigma',
        pattern: 'x',
        matchingEvidence: ['x'],
        nonMatchingEvidence: [],
      }),
    ).toThrow(/findingId/);
    expect(() =>
      validateDetectorStanding({
        findingId: 'F-1',
        validator: 'sigma',
        pattern: 'x',
        matchingEvidence: 'not-an-array' as unknown as string[],
        nonMatchingEvidence: [],
      }),
    ).toThrow(/matchingEvidence/);
    expect(() =>
      validateDetectorStanding({
        findingId: 'F-1',
        validator: 'sigma',
        pattern: 'x',
        matchingEvidence: ['x'],
        nonMatchingEvidence: [42] as unknown as string[],
      }),
    ).toThrow(/nonMatchingEvidence/);
  });
});

describe('blue team: hardening retest', () => {
  it('starts fresh plan items open with no linked evidence', () => {
    const plan = hardeningPlan([{ id: 'c1', severity: 'critical' }]);
    expect(plan).toHaveLength(1);
    expect(plan[0].retestOutcome).toBe('open');
    expect(plan[0].baselineEvidenceIds).toEqual([]);
    expect(plan[0].retestEvidenceIds).toEqual([]);
  });

  it('resolves successful-retest or failed-retest only from linked baseline and retest evidence ids', () => {
    expect(
      evaluateHardeningRetest({ baselineEvidenceIds: ['E-BASE'], retestEvidenceIds: ['E-RETEST'], retestPassed: true }),
    ).toBe('successful-retest');
    expect(
      evaluateHardeningRetest({ baselineEvidenceIds: ['E-BASE'], retestEvidenceIds: ['E-RETEST'], retestPassed: false }),
    ).toBe('failed-retest');
  });

  it('returns insufficient-evidence for a prose sentence alone, never successful-retest', () => {
    expect(evaluateHardeningRetest({})).toBe('insufficient-evidence');
    expect(
      evaluateHardeningRetest({ baselineEvidenceIds: [], retestEvidenceIds: [], retestPassed: true }),
    ).toBe('insufficient-evidence');
    expect(
      evaluateHardeningRetest({ baselineEvidenceIds: ['E-BASE'], retestEvidenceIds: [], retestPassed: true }),
    ).toBe('insufficient-evidence');
  });

  it('links evidence onto a copy without mutating the plan item', () => {
    const [item] = hardeningPlan([{ id: 'c1', severity: 'critical' }]);
    const updated = applyHardeningRetest(item, {
      baselineEvidenceIds: ['E-BASE'],
      retestEvidenceIds: ['E-RETEST'],
      retestPassed: true,
    });
    expect(updated.retestOutcome).toBe('successful-retest');
    expect(updated.baselineEvidenceIds).toEqual(['E-BASE']);
    expect(updated.retestEvidenceIds).toEqual(['E-RETEST']);
    expect(item.retestOutcome).toBe('open');
  });
});

describe('blue workflow: artifact-bound coverage stage', () => {
  const findings: CoverageFinding[] = [{ id: 'F-WF', countermeasures: ['D3-PA'] }];
  const telemetry: TelemetryDeclaration[] = [{ source: 'edr-process', countermeasures: ['D3-PA'] }];

  it('yields covered with stage bindings citing the artifact and input hash after real computation', () => {
    const result = runBlueCoverageStage({
      runId: 'R-1',
      missionId: 'M-1',
      family: 'web_api',
      artifactIds: ['A-1'],
      artifactBytes: '{"evidence":"edr process spawn log for F-WF"}',
      findings,
      telemetry,
    });
    expect(result.status).toBe('complete');
    expect(result.gaps[0].coverage).toBe('covered');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0]).toMatchObject({
      runId: 'R-1',
      missionId: 'M-1',
      stage: 'blue-coverage:web_api',
      tool: 'coverageGaps',
      itemId: 'F-WF',
    });
    expect(result.bindings[0].inputSha256).toMatch(/^[0-9a-f]{16}(-[0-9a-f]{16}){3}$/);
    expect(result.bindings[0].inputSha256).toBe(blueInputHash('{"evidence":"edr process spawn log for F-WF"}\n' + JSON.stringify({ family: 'web_api', findings, telemetry })));
    expect('origin' in result.bindings[0]).toBe(false);
  });

  it('fails closed as insufficient-evidence when the artifact is missing, never covered', () => {
    const noIds = runBlueCoverageStage({
      runId: 'R-1',
      missionId: 'M-1',
      family: 'web_api',
      artifactIds: [],
      artifactBytes: '{"evidence":"edr process spawn log"}',
      findings,
      telemetry,
    });
    expect(noIds.status).toBe('insufficient-evidence');
    expect(noIds.gaps.every(gap => gap.coverage !== 'covered')).toBe(true);
    const noBytes = runBlueCoverageStage({
      runId: 'R-1',
      missionId: 'M-1',
      family: 'web_api',
      artifactIds: ['A-1'],
      artifactBytes: '',
      findings,
      telemetry,
    });
    expect(noBytes.status).toBe('insufficient-evidence');
    expect(noBytes.gaps.every(gap => gap.coverage !== 'covered')).toBe(true);
  });

  it('rejects unknown families before computing', () => {
    expect(() =>
      runBlueCoverageStage({
        runId: 'R-1',
        missionId: 'M-1',
        family: 'not-a-family',
        artifactIds: ['A-1'],
        artifactBytes: 'bytes',
        findings,
        telemetry,
      }),
    ).toThrow(/unknown family/);
  });

  it('runs the detection stage on the same binding contract with tool detectionGaps', () => {
    const result = runBlueDetectionStage({
      runId: 'R-2',
      missionId: 'M-2',
      family: 'cloud_infra',
      artifactIds: ['A-7'],
      artifactBytes: 'siem export for f9',
      findings: [{ id: 'f9', title: 'Open bucket', severity: 'high' }],
      telemetry: [{ source: 'siem', coveredIds: ['f9'] }],
    });
    expect(result.status).toBe('complete');
    expect(result.gaps[0].coverage).toBe('covered');
    expect(result.bindings[0].tool).toBe('detectionGaps');
    expect(result.bindings[0].inputSha256).toMatch(/^[0-9a-f]{16}(-[0-9a-f]{16}){3}$/);
    expect('origin' in result.bindings[0]).toBe(false);
  });

  it('resolves detector standing and hardening retest through the workflow stages', () => {
    const detector = runBlueDetectorStage({
      runId: 'R-3',
      missionId: 'M-3',
      findingId: 'F-1',
      validator: 'sigma',
      pattern: 'UNION SELECT',
      matchingEvidence: ["'UNION SELECT 1,2,3' in the error page"],
      nonMatchingEvidence: ['routine login POST'],
    });
    expect(detector.validation.standing).toBe('validated');
    expect(detector.inputSha256).toMatch(/^[0-9a-f]{16}(-[0-9a-f]{16}){3}$/);
    expect(() =>
      runBlueDetectorStage({
        runId: 'R-3',
        missionId: 'M-3',
        findingId: '',
        validator: 'sigma',
        pattern: 'x',
        matchingEvidence: ['x'],
        nonMatchingEvidence: [],
      }),
    ).toThrow(/findingId/);

    const [item] = hardeningPlan([{ id: 'h1', severity: 'high' }]);
    const retest = runBlueRetestStage({
      runId: 'R-3',
      missionId: 'M-3',
      item,
      baselineEvidenceIds: ['E-BASE'],
      retestEvidenceIds: ['E-RETEST'],
      retestPassed: false,
    });
    expect(retest.outcome).toBe('failed-retest');
    expect(retest.item.retestEvidenceIds).toEqual(['E-RETEST']);
  });

  it('branches on the mapped blue families and isolates an unavailable family', () => {
    expect([...BLUE_WORKFLOW_FAMILIES]).toEqual(FAMILY_TEAM_MAPPING.blue);
    const results = runBlueCoverageAcrossFamilies({
      runId: 'R-4',
      missionId: 'M-4',
      artifactIds: ['A-1'],
      artifactBytes: 'family bytes',
      findings,
      telemetry,
      families: ['web_api', 'not-a-family'],
    });
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('complete');
    expect(results[0].gaps[0].coverage).toBe('covered');
    expect(results[1].status).toBe('unavailable');
    expect(results[1].gaps).toEqual([]);
  });
});

describe('blue prompts: dedicated role guidance', () => {
  it('names the real workflow exports, engines, grants, and limits in the parent block', () => {
    for (const token of [
      'runBlueCoverageStage',
      'runBlueDetectionStage',
      'runBlueDetectorStage',
      'runBlueRetestStage',
      'coverageGaps',
      'detectionGaps',
      'hardeningPlan',
      'sigma',
      'd3fend',
      'unavailable',
      'observed artifact id',
      'EDR',
      'SIEM',
      'untrusted data',
    ]) {
      expect(BLUE_PARENT_PROMPT).toContain(token);
    }
  });

  it('keeps the specialist blocks honest about standing and retest', () => {
    expect(BLUE_SENTINEL_PROMPT).toContain('runBlueDetectorStage');
    expect(BLUE_SENTINEL_PROMPT).toContain('validated');
    expect(BLUE_SENTINEL_PROMPT).toContain('pipx install sigma-cli');
    expect(BLUE_WARDEN_PROMPT).toContain('runBlueRetestStage');
    expect(BLUE_WARDEN_PROMPT).toContain('successful-retest');
    expect(BLUE_WARDEN_PROMPT).toContain('insufficient-evidence');
    expect(BLUE_WARDEN_PROMPT).toContain('web_api');
  });

  it('avoids a prompt-assembly cycle: no import of the prompt index', () => {
    const source = readFileSync(join(process.cwd(), 'src/prompts/blue.ts'), 'utf8');
    expect(source).not.toContain('./index');
    expect(source).not.toContain('prompts/index');
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

  it('produces no rule for keyless or fully overlapped gaps', () => {
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

  it('requires non-empty nonMatchingEvidence before validateDetectorStanding returns validated', () => {
    const standingWithoutNegative = validateDetectorStanding({
      findingId: 'F-DET',
      validator: 'sigma',
      pattern: 'union select',
      matchingEvidence: ['UNION SELECT payload echoed in the error page'],
      nonMatchingEvidence: [],
    });
    expect(standingWithoutNegative.standing).toBe('unavailable');
  });
});
