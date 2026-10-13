import { describe, it, expect } from 'vitest';
import { noiseBudget, coverAudit } from '../teams/black.js';
import { detectionGaps, hardeningPlan } from '../teams/blue.js';
import { roeAudit, adjudicateEvidence } from '../teams/white.js';
import { synthesize, type PurpleRiskTier } from '../teams/purple.js';

describe('black team: noiseBudget', () => {
  it('scores a quiet, bounded, routed plan at 100 with no violations', () => {
    const result = noiseBudget({
      actions: ['nmap --top-ports 100 -sV t.example', 'dig @approved-resolver t.example'],
      egress: ['egress-gw:8443'],
    });
    expect(result.score).toBe(100);
    expect(result.violations).toEqual([]);
  });

  it('flags unbounded scans and names the offending action', () => {
    const result = noiseBudget({
      actions: ['nmap -sV 10.0.0.0/8', 'nuclei -t cves/ https://t.example'],
      egress: ['egress-gw:8443'],
    });
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0]).toContain('unbounded scan');
    expect(result.violations[0]).toContain('nmap -sV 10.0.0.0/8');
    expect(result.score).toBe(76); // 100 - 12 - 12
  });

  it('flags repeated probes (3x identical action) and docks exactly 10', () => {
    const result = noiseBudget({
      actions: ['curl https://t.example/api', 'curl https://t.example/api', 'curl https://t.example/api'],
      egress: ['egress-gw:8443'],
    });
    expect(result.violations).toEqual(['repeated probe (3x): "curl https://t.example/api"']);
    expect(result.score).toBe(90);
  });

  it('treats missing egress routing as the standing violation', () => {
    const result = noiseBudget({ actions: [] });
    expect(result.violations[0]).toContain('no egress routing declared');
    expect(result.score).toBe(80);
  });

  it('combines all violation classes and clamps into 0-100', () => {
    const result = noiseBudget({
      actions: [
        'nmap -sV 10.0.0.0/8',
        'nuclei -t cves/ https://t.example',
        'curl https://t.example/api',
        'curl https://t.example/api',
        'curl https://t.example/api',
      ],
    });
    expect(result.violations).toHaveLength(4); // missing egress + 2 unbounded + 1 repeated class
    expect(result.score).toBe(46); // 100 - 20 - 12 - 12 - 10
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('black team: coverAudit', () => {
  it('passes a sanitized probe with no artifacts residue', () => {
    const result = coverAudit({
      command: 'curl -A research-agent https://t.example/api',
      artifacts: ['reports/finding-1.json'],
    });
    expect(result.leaks).toEqual([]);
    expect(result.checklist).toHaveLength(5);
    for (const entry of result.checklist) expect(entry.clean).toBe(true);
  });

  it('catches default user-agent leakage on curl without -A', () => {
    const result = coverAudit({ command: 'curl https://t.example/api' });
    expect(result.leaks.some(l => l.includes('user-agent'))).toBe(true);
    expect(result.checklist.find(c => c.item === 'user-agent hygiene')?.clean).toBe(false);
  });

  it('catches timestamps, temp residue, dns bypass, and credential material', () => {
    const result = coverAudit({
      command: 'dig t.example --timestamp and curl -A research-agent --password hunter2 https://t.example',
      artifacts: ['/tmp/resp.out', 'run-ts=2024-01-01T00:00:00Z'],
    });
    expect(result.leaks).toHaveLength(4);
    const dirty = result.checklist.filter(c => !c.clean).map(c => c.item);
    expect(dirty).toEqual(['timestamp exposure', 'dns residue', 'temp-file residue', 'credential material in args']);
  });

  it('keeps the anti-forensics posture: leaks are reported, never "cleaned"', () => {
    const result = coverAudit({ command: 'curl -A x https://t.example', artifacts: ['/tmp/resp.out'] });
    expect(result.leaks[0]).toContain('do not delete it');
  });
});

describe('blue team: detectionGaps', () => {
  const findings = [
    { id: 'f1', title: 'SQL injection in /api/users', severity: 'critical' },
    { id: 'f2', title: 'Stored XSS in comments', severity: 'high' },
    { id: 'f3', title: 'Missing security headers', severity: 'medium' },
  ];

  it('maps covered ids to covered and everything else to partial when telemetry exists', () => {
    const gaps = detectionGaps(findings, [
      { source: 'waf', coveredIds: ['f3'] },
      { source: 'siem', coveredIds: [] },
    ]);
    expect(gaps.find(g => g.findingId === 'f3')?.coverage).toBe('covered');
    expect(gaps.find(g => g.findingId === 'f1')?.coverage).toBe('partial');
    expect(gaps.find(g => g.findingId === 'f2')?.coverage).toBe('partial');
  });

  it('returns none for every finding when no telemetry exists at all', () => {
    const gaps = detectionGaps(findings);
    expect(gaps.map(g => g.coverage)).toEqual(['none', 'none', 'none']);
    expect(gaps[0].recommendedControl).toContain('f1');
    expect(gaps[0].recommendedControl).toContain('SQL injection in /api/users');
    expect(gaps[0].recommendedControl).toMatch(/SIEM/i);
  });

  it('recommends a concrete control naming the red artifact it defends against', () => {
    const gaps = detectionGaps([findings[0]]);
    expect(gaps[0].coverage).toBe('none');
    expect(gaps[0].recommendedControl).toContain('critical');
  });
});

describe('blue team: hardeningPlan', () => {
  it('groups findings into severity tiers, highest priority first', () => {
    const plan = hardeningPlan([
      { id: 'c1', severity: 'critical' },
      { id: 'h1', severity: 'high' },
      { id: 'l1', severity: 'low' },
      { id: 'l2', severity: 'low' },
    ]);
    expect(plan.map(p => p.priority)).toEqual([1, 2, 4]);
    expect(plan[0].findingIds).toEqual(['c1']);
    expect(plan[0].effort).toBe('high');
    expect(plan[2].findingIds).toEqual(['l1', 'l2']);
    expect(plan[2].effort).toBe('low');
  });

  it('buckets unknown severities into the medium tier instead of dropping them', () => {
    const plan = hardeningPlan([{ id: 'm1', severity: 'weird' }]);
    expect(plan).toHaveLength(1);
    expect(plan[0].priority).toBe(3);
    expect(plan[0].findingIds).toEqual(['m1']);
  });
});

describe('white team: roeAudit', () => {
  const roe = { allowedTargets: ['app.example.com'], allowActive: true };

  it('marks approved in-scope active actions compliant', () => {
    const verdicts = roeAudit(
      [{ command: 'nmap -sV app.example.com', target: 'https://app.example.com/admin', approved: true }],
      roe,
    );
    expect(verdicts[0].verdict).toBe('compliant');
    expect(verdicts[0].conditions.length).toBeGreaterThan(0);
  });

  it('marks out-of-scope targets violations even when approved', () => {
    const verdicts = roeAudit(
      [{ command: 'nmap -sV other.com', target: 'https://other.com', approved: true }],
      roe,
    );
    expect(verdicts[0].verdict).toBe('violation');
    expect(verdicts[0].rationale).toContain('other.com');
  });

  it('marks unapproved active in-scope actions as needs_approval with conditions', () => {
    const verdicts = roeAudit(
      [{ command: 'nuclei -t cves/ https://app.example.com', target: 'app.example.com', approved: false }],
      roe,
    );
    expect(verdicts[0].verdict).toBe('needs_approval');
    expect(verdicts[0].conditions.join(' ')).toMatch(/approval receipt/i);
  });

  it('marks active actions as violations when the ROE forbids active testing', () => {
    const verdicts = roeAudit(
      [{ command: 'nmap -sV app.example.com', target: 'app.example.com', approved: false }],
      { allowedTargets: ['app.example.com'], allowActive: false },
    );
    expect(verdicts[0].verdict).toBe('violation');
    expect(verdicts[0].rationale).toContain('allowActive=false');
  });

  it('allows passive actions without approval even under a no-active ROE', () => {
    const verdicts = roeAudit(
      [{ command: 'dig @approved-resolver app.example.com', target: 'app.example.com' }],
      { allowedTargets: ['app.example.com'], allowActive: false },
    );
    expect(verdicts[0].verdict).toBe('compliant');
  });

  it('preserves action indices in the verdict ledger', () => {
    const verdicts = roeAudit(
      [
        { command: 'nmap -sV app.example.com', target: 'app.example.com', approved: true },
        { command: 'nmap -sV other.com', target: 'other.com', approved: true },
        { command: 'nuclei -t cves/ https://app.example.com', target: 'app.example.com' },
      ],
      roe,
    );
    expect(verdicts.map(v => v.actionIndex)).toEqual([0, 1, 2]);
    expect(verdicts.map(v => v.verdict)).toEqual(['compliant', 'violation', 'needs_approval']);
  });
});

describe('white team: adjudicateEvidence', () => {
  it('ranks by provenance strength: replayable/tool accepted, context/weak insufficient', () => {
    const verdicts = adjudicateEvidence([
      { id: 'e1', strength: 'replayable' },
      { id: 'e2', strength: 'tool' },
      { id: 'e3', strength: 'context' },
      { id: 'e4', strength: 'weak' },
    ]);
    expect(verdicts.map(v => v.verdict)).toEqual(['accepted', 'accepted', 'insufficient', 'insufficient']);
    expect(verdicts[0].rationale).toContain('replayable');
    expect(verdicts[2].rationale).toContain('below the tool-grade threshold');
  });

  it('infers strength from entry type using the platform semantics when strength is absent', () => {
    const verdicts = adjudicateEvidence([
      { id: 'r1', type: 'receipt' },
      { id: 's1', type: 'screenshot' },
      { id: 'c1', type: 'command' },
      { id: 'a1', type: 'log' },
      { id: 'u1' },
    ]);
    expect(verdicts.map(v => v.verdict)).toEqual(['accepted', 'accepted', 'accepted', 'insufficient', 'insufficient']);
  });
});

describe('purple synthesis', () => {
  const findings = [
    { id: 'f1', title: 'SQL injection in /api/users', severity: 'critical' },
    { id: 'f2', title: 'Missing security headers', severity: 'medium' },
  ];
  const roe = { allowedTargets: ['t.example'], allowActive: true };

  it('correlates findings, detection coverage, and verdicts into the ledger', () => {
    // f1's gap comes from a no-telemetry run (coverage 'none'); f2's from the
    // telemetry run that covers it. detectionGaps() cannot mix the two in one call.
    const detections = [
      ...detectionGaps([findings[0]]),
      ...detectionGaps([findings[1]], [{ source: 'siem', coveredIds: ['f2'] }]),
    ];
    const verdicts = roeAudit([{ command: 'nmap --top-ports 100 t.example', target: 't.example', approved: true }], roe);
    const result = synthesize({ findings, detections, verdicts });

    expect(result.coverageMatrix).toHaveLength(2);
    expect(result.coverageMatrix[0]).toMatchObject({ findingId: 'f1', detection: 'none', verdict: 'compliant', riskTier: 'critical' });
    expect(result.coverageMatrix[0].residualRisk).toBe('critical residual risk — f1 (SQL injection in /api/users) sits at the top tier; do not declare the posture acceptable while this row is critical');
    expect(result.coverageMatrix[1]).toMatchObject({ findingId: 'f2', detection: 'covered', riskTier: 'medium' });
    expect(result.coverageMatrix[1].residualRisk).toBe('medium residual risk — f2 (Missing security headers) sits at the middle tier; harden the open items on its matrix row before declaring the posture acceptable');
    expect(result.unresolved).toEqual(['f1']);
    expect(result.nextMissions.some(m => m.startsWith('Detection engineering:'))).toBe(true);
  });

  it('escalates ROE violations into unresolved items and remediation missions', () => {
    const detections = detectionGaps([findings[0]]);
    const verdicts = roeAudit([{ command: 'nmap -sV other.com', target: 'other.com', approved: true }], roe);
    const result = synthesize({ findings: [findings[0]], detections, verdicts });

    expect(result.coverageMatrix[0].verdict).toBe('violation');
    expect(result.unresolved).toContain('f1');
    expect(result.nextMissions.some(m => m.startsWith('ROE remediation:'))).toBe(true);
  });

  it('flags needs-approval verdicts into approval-path missions and ends with the purple regression', () => {
    const detections = detectionGaps([findings[1]], [{ source: 'siem', coveredIds: ['f2'] }]);
    const verdicts = roeAudit([{ command: 'nuclei -t cves/ https://t.example', target: 't.example', approved: false }], roe);
    const result = synthesize({ findings: [findings[1]], detections, verdicts });

    expect(result.unresolved).toEqual([]);
    expect(result.nextMissions.some(m => m.startsWith('Approval path:'))).toBe(true);
    expect(result.nextMissions[result.nextMissions.length - 1]).toContain('Purple regression');
  });

  it('treats missing detection entries as no coverage rather than throwing', () => {
    const result = synthesize({ findings: [findings[0]], detections: [], verdicts: [] });
    expect(result.coverageMatrix[0].detection).toBe('none');
    expect(result.unresolved).toEqual(['f1']);
  });
  it('derives residualRisk strictly from riskTier across the whole tier vocabulary', () => {
    // Whole-vocabulary parity pin (purple-v2 CASES-loop idiom): every tier in
    // the PurpleRiskTier vocabulary renders its exact template via string
    // equality — prose drift can no longer pass alongside a green tier pin.
    const EXPECTED: Record<PurpleRiskTier, string> = {
      critical: 'critical residual risk — p-critical (T) sits at the top tier; do not declare the posture acceptable while this row is critical',
      high: 'high residual risk — p-high (T) sits above appetite; do not declare the posture acceptable while this row is high',
      medium: 'medium residual risk — p-medium (T) sits at the middle tier; harden the open items on its matrix row before declaring the posture acceptable',
      low: 'low residual risk — p-low (T) sits at a low tier; confirm its matrix row before declaring the posture acceptable',
      info: 'informational residual risk — p-info (T) carries no tiered risk; track its matrix row only',
    };
    const CASES: Array<{ tier: PurpleRiskTier; severity?: string; coverage: 'none' | 'partial' | 'covered' }> = [
      { tier: 'info', severity: 'info', coverage: 'covered' },
      { tier: 'low', severity: 'low', coverage: 'covered' },
      { tier: 'medium', severity: 'medium', coverage: 'covered' },
      { tier: 'high', severity: 'medium', coverage: 'none' },
      { tier: 'critical', severity: 'critical', coverage: 'covered' },
    ];
    for (const entry of CASES) {
      const id = `p-${entry.tier}`;
      const result = synthesize({
        findings: [{ id, title: 'T', severity: entry.severity }],
        detections: [{ findingId: id, coverage: entry.coverage, recommendedControl: 'parity-pin' }],
        verdicts: [],
        verdictsByFinding: { [id]: { verdict: 'compliant' } },
      });
      expect(result.coverageMatrix[0].riskTier, `${id} tier`).toBe(entry.tier);
      expect(result.coverageMatrix[0].residualRisk, `${id} prose`).toBe(EXPECTED[entry.tier]);
    }
  });

  it('renders the floored/bumped tier template at tier-boundary input combos', () => {
    // Adjacency coverage: each combo yields a tier different from its severity
    // base, and the prose must equal that tier's exact template.
    const CASES: Array<{
      id: string; severity?: string; coverage: 'none' | 'partial' | 'covered';
      verdict?: 'compliant' | 'violation'; tier: PurpleRiskTier; prose: string;
    }> = [
      { id: 'b-high', severity: 'medium', coverage: 'none', verdict: 'compliant', tier: 'high', prose: 'high residual risk — b-high (T) sits above appetite; do not declare the posture acceptable while this row is high' },
      { id: 'b-medium', severity: 'low', coverage: 'none', verdict: 'compliant', tier: 'medium', prose: 'medium residual risk — b-medium (T) sits at the middle tier; harden the open items on its matrix row before declaring the posture acceptable' },
      { id: 'b-critical', severity: 'high', coverage: 'none', verdict: 'compliant', tier: 'critical', prose: 'critical residual risk — b-critical (T) sits at the top tier; do not declare the posture acceptable while this row is critical' },
      { id: 'b-floor', severity: 'low', coverage: 'covered', verdict: 'violation', tier: 'high', prose: 'high residual risk — b-floor (T) sits above appetite; do not declare the posture acceptable while this row is high' },
      { id: 'b-partial-floor', severity: 'medium', coverage: 'partial', verdict: 'violation', tier: 'high', prose: 'high residual risk — b-partial-floor (T) sits above appetite; do not declare the posture acceptable while this row is high' },
    ];
    for (const entry of CASES) {
      const result = synthesize({
        findings: [{ id: entry.id, title: 'T', severity: entry.severity }],
        detections: [{ findingId: entry.id, coverage: entry.coverage, recommendedControl: 'parity-pin' }],
        verdicts: [],
        verdictsByFinding: { [entry.id]: { verdict: entry.verdict ?? 'compliant' } },
      });
      expect(result.coverageMatrix[0].riskTier, `${entry.id} tier`).toBe(entry.tier);
      expect(result.coverageMatrix[0].residualRisk, `${entry.id} prose`).toBe(entry.prose);
    }
  });

  it('interpolates a missing or empty title as an empty subject', () => {
    const missing = synthesize({
      findings: [{ id: 't-missing', severity: 'info' }],
      detections: [{ findingId: 't-missing', coverage: 'covered', recommendedControl: 'parity-pin' }],
      verdicts: [],
      verdictsByFinding: { 't-missing': { verdict: 'compliant' } },
    });
    expect(missing.coverageMatrix[0].riskTier).toBe('info');
    expect(missing.coverageMatrix[0].residualRisk).toBe('informational residual risk — t-missing carries no tiered risk; track its matrix row only');
    const empty = synthesize({
      findings: [{ id: 't-empty', title: '', severity: 'low' }],
      detections: [{ findingId: 't-empty', coverage: 'covered', recommendedControl: 'parity-pin' }],
      verdicts: [],
      verdictsByFinding: { 't-empty': { verdict: 'compliant' } },
    });
    expect(empty.coverageMatrix[0].riskTier).toBe('low');
    expect(empty.coverageMatrix[0].residualRisk).toBe('low residual risk — t-empty sits at a low tier; confirm its matrix row before declaring the posture acceptable');
  });

});
