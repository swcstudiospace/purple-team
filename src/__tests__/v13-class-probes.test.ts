import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { roeAudit } from '../teams/white.js';
import { parseRoe } from '../teams/white/roe-parser.js';
import { coverageGaps } from '../teams/blue/coverage.js';
import { structuredNoiseBudget } from '../teams/black/noise.js';
import { synthesize } from '../teams/purple.js';

describe('v1.3 class probes: phase-19 empty-spec never-all-compliant (flagship)', () => {
  it('never green-lights a mixed plan against an empty spec, still binds an explicit allowActive=false, and refuses an empty parse', () => {
    // Facet 1: mixed active-plus-passive set against an empty spec must never
    // return all-compliant; the unapproved active action needs approval first.
    const mixed = roeAudit(
      [
        { command: 'nmap -sV app.example.com', target: 'app.example.com' },
        { command: 'cat /etc/hosts', target: 'app.example.com' },
      ],
      {},
    );
    expect(mixed.map((v) => v.verdict)).toContain('needs_approval');
    expect(mixed.every((v) => v.verdict === 'compliant')).toBe(false);
    expect(mixed[0].verdict).toBe('needs_approval');

    // Facet 2: an explicit allowActive=false spec still binds approved active work.
    const bound = roeAudit(
      [{ command: 'nmap -sV app.example.com', target: 'app.example.com', approved: true }],
      { allowActive: false },
    );
    expect(bound[0].verdict).toBe('violation');

    // Facet 3: absent ROE text never parses — fail closed, never permissive.
    expect(parseRoe('').ok).toBe(false);
  });
});

describe('v1.3 class probes: phase-15 lookalike-id coverage honesty', () => {
  it('surfaces id-prefix lookalikes as unresolved and scores coverage on resolved ids only', () => {
    const [gap] = coverageGaps(
      [{ id: 'F-X', countermeasures: ['D3-PA', 'D3-P'] }],
      [{ source: 'edr-process', countermeasures: ['D3-PA'] }],
    );
    // The invented/prefix id never silently counts as coverage.
    expect(gap.unresolvedCountermeasures).toContain('D3-P');
    expect(gap.countermeasures).toEqual(['D3-PA']);
    expect(gap.coveredCountermeasures).toEqual(['D3-PA']);
    expect(gap.coverage).toBe('covered');
    expect(gap.recommendation).toContain('reported, not used');
  });
});

describe('v1.3 class probes: phase-16 blue bench fail-closed pin', () => {
  it('keeps the blue bench loading the real dist pipeline with a missing-dist throw', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/detection-coverage-bench.mjs'), 'utf8');
    expect(source).toContain('dist/teams/blue');
    expect(source).toContain('run `npm run build`');
  });
});

describe('v1.3 class probes: phase-17 unmatched-input honesty', () => {
  it('scores vocabulary misses at zero cost and says unmatched is not safe', () => {
    const report = structuredNoiseBudget({
      actions: ['totally-unmatched-action'],
      egress: ['egress.internal:443'],
    });
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0].cost).toBe(0);
    expect(report.entries[0].rationale).toContain('unmatched is not safe');
  });
});

describe('v1.3 class probes: phase-18 black bench fail-closed pin', () => {
  it('keeps the black bench loading the real dist pipeline with a missing-dist throw', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/opsec-review-bench.mjs'), 'utf8');
    expect(source).toContain('dist/teams/black');
    expect(source).toContain('run `npm run build`');
  });
});

describe('v1.3 class probes: phase-20 orphan-verdict isolation', () => {
  it('leaves every coverage row byte-identical when verdict keys match no finding', () => {
    const findings = [{ id: 'F-1', title: 'open port', severity: 'high' }];
    const detections = [
      { findingId: 'F-1', coverage: 'covered' as const, recommendedControl: 'probe control' },
    ];
    const base = synthesize({ findings, detections, verdicts: [] });
    const withOrphans = synthesize({
      findings,
      detections,
      verdicts: [],
      verdictsByFinding: {
        'NOPE-1': { verdict: 'violation' as const },
        'NOPE-2': { verdict: 'compliant' as const },
      },
    });
    expect(withOrphans.correlation).toBe('id');
    expect(JSON.stringify(withOrphans.coverageMatrix)).toBe(JSON.stringify(base.coverageMatrix));
  });
});
