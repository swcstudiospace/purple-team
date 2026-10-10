import { describe, it, expect } from 'vitest';
import { noiseBudget, coverAudit } from '../teams/black.js';
import { detectionGaps, hardeningPlan } from '../teams/blue.js';
import { roeAudit, adjudicateEvidence } from '../teams/white.js';
import { teamToolGrants } from '../teams/index.js';
import {
  HAT_ARCHETYPES,
  hatTeam,
  hatToolGrants,
  specterCoverReview,
  wraithExfilSim,
  sentinelDetectorMap,
  wardenHardeningReview,
  arbiterDispute,
  auditorScore,
} from '../teams/hats.js';

describe('hat grant-subset discipline', () => {
  it('every hat grant is granted to its parent team (hat ⊆ parent)', () => {
    for (const hat of HAT_ARCHETYPES) {
      const parent = teamToolGrants(hatTeam[hat]);
      for (const id of hatToolGrants(hat)) {
        expect(parent).toContain(id);
      }
    }
  });

  it('black hats stay disjoint from blue and white grants like the black team itself', () => {
    const blue = new Set(teamToolGrants('blue'));
    const white = new Set(teamToolGrants('white'));
    for (const hat of ['specter', 'wraith'] as const) {
      expect(hatTeam[hat]).toBe('black');
      for (const id of hatToolGrants(hat)) {
        expect(blue.has(id)).toBe(false);
        expect(white.has(id)).toBe(false);
      }
    }
  });

  it('hatTeam maps each hat to its parent team', () => {
    expect(hatTeam).toEqual({
      specter: 'black',
      wraith: 'black',
      sentinel: 'blue',
      warden: 'blue',
      arbiter: 'white',
      auditor: 'white',
    });
  });

  it('rejects unknown hats', () => {
    expect(() => hatToolGrants('purple' as never)).toThrow();
    expect(() => hatToolGrants('recon' as never)).toThrow();
  });
});

describe('specter: specterCoverReview', () => {
  it('passes a quiet, routed plan as holds with no flags', () => {
    const plan = { actions: ['dig @approved-resolver example.com', 'dig @approved-resolver www.example.com'], egress: ['proxy-egress-1'] };
    const result = specterCoverReview(plan);
    expect(result.noise.score).toBe(100);
    expect(result.noise.violations).toEqual([]);
    expect(result.realismFlags).toEqual([]);
    expect(result.verdict).toBe('holds');
    expect(result.reviews).toHaveLength(2);
  });

  it('reuses the parent functions honestly (cover per action, noise for the plan)', () => {
    const plan = { actions: ['nmap -sV 10.0.0.0/8', 'curl http://target/'], egress: ['proxy-egress-1'] };
    const result = specterCoverReview(plan);
    expect(result.reviews).toEqual(plan.actions.map(command => coverAudit({ command })));
    expect(result.noise).toEqual(noiseBudget(plan));
  });

  it('flags unbounded scans as fragile and destructive tradecraft as blown', () => {
    const fragile = specterCoverReview({ actions: ['nmap -sV 10.0.0.0/8'], egress: ['proxy-egress-1'] });
    expect(fragile.noise.violations.length).toBeGreaterThan(0);
    expect(fragile.verdict).toBe('fragile');

    const blown = specterCoverReview({ actions: ['rm -rf /tmp/cache'], egress: ['proxy-egress-1'] });
    expect(blown.realismFlags.some(f => f.includes('destructive'))).toBe(true);
    expect(blown.verdict).toBe('blown');
  });

  it('flags staged-looking claims without evidence', () => {
    const result = specterCoverReview({ actions: ['zero-day exploit for undetectable access'], egress: ['proxy-egress-1'] });
    expect(result.realismFlags.some(f => f.includes('staged-looking'))).toBe(true);
    expect(result.verdict).toBe('fragile');
  });
});

describe('wraith: wraithExfilSim', () => {
  it('verifies a small encrypted path on declared egress as feasible and low-noise', () => {
    const result = wraithExfilSim({
      paths: [{ id: 'p1', channel: 'api-pagination', volumeMb: 4, encrypted: true }],
      egress: ['proxy-egress-1'],
    });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toMatchObject({ pathId: 'p1', feasible: true, noiseCost: 'low', egressVerified: true });
    expect(result.paths[0].pressureNotes).toEqual([]);
    expect(result.totalVolumeMb).toBe(4);
    expect(result.budget.violations).toEqual([]);
  });

  it('rates bulk unencrypted tunnels high-noise and infeasible, with pressure notes', () => {
    const result = wraithExfilSim({
      paths: [{ id: 'p2', channel: 'dns-tunnel', volumeMb: 500, encrypted: false }],
      egress: ['proxy-egress-1'],
    });
    expect(result.paths[0].noiseCost).toBe('high');
    expect(result.paths[0].feasible).toBe(false);
    expect(result.paths[0].pressureNotes.join(' ')).toMatch(/DLP/);
    expect(result.paths[0].pressureNotes.join(' ')).toMatch(/anomaly detection/);
    expect(result.paths[0].pressureNotes.join(' ')).toMatch(/tunneling-shaped/);
    expect(result.totalVolumeMb).toBe(500);
  });

  it('fails egress verification when no egress route is declared', () => {
    const result = wraithExfilSim({ paths: [{ id: 'p3', channel: 'api-pagination', volumeMb: 1, encrypted: true }] });
    expect(result.paths[0].egressVerified).toBe(false);
    expect(result.paths[0].feasible).toBe(false);
    expect(result.budget.violations.join(' ')).toMatch(/no egress routing/);
  });

  it('sums volumes across paths', () => {
    const result = wraithExfilSim({
      paths: [
        { id: 'a', channel: 'api-pagination', volumeMb: 10, encrypted: true },
        { id: 'b', channel: 'cloud-storage-put', volumeMb: 20, encrypted: true },
      ],
      egress: ['proxy-egress-1'],
    });
    expect(result.totalVolumeMb).toBe(30);
  });
});

describe('sentinel: sentinelDetectorMap', () => {
  const findings = [
    { id: 'f1', title: 'SQL injection in /api/users', severity: 'critical' },
    { id: 'f2', title: 'Missing security headers', severity: 'low' },
  ];

  it('writes one detector artifact per uncovered finding, critical first', () => {
    const result = sentinelDetectorMap(findings);
    expect(result.gaps.map(g => g.coverage)).toEqual(['none', 'none']);
    expect(result.detectorRecommendations).toHaveLength(2);
    expect(result.detectorRecommendations[0]).toContain('f1');
    expect(result.detectorRecommendations[0]).toContain('critical');
    expect(result.detectorRecommendations[0]).toMatch(/replay/i);
    expect(result.gapPriority).toEqual(['f1', 'f2']);
  });

  it('reuses detectionGaps and skips covered findings in artifacts and priority', () => {
    const telemetry = [{ source: 'siem', coveredIds: ['f2'] }];
    const result = sentinelDetectorMap(findings, telemetry);
    expect(result.gaps).toEqual(detectionGaps(findings, telemetry));
    expect(result.detectorRecommendations).toHaveLength(1);
    expect(result.detectorRecommendations[0]).toContain('f1');
    expect(result.gapPriority).toEqual(['f1']);
  });
});

describe('warden: wardenHardeningReview', () => {
  it('reuses hardeningPlan and attaches a verification checklist per item', () => {
    const findings = [
      { id: 'c1', severity: 'critical' },
      { id: 'h1', severity: 'high' },
    ];
    const result = wardenHardeningReview(findings);
    expect(result.items).toEqual(hardeningPlan(findings));
    expect(result.items.map(i => i.priority)).toEqual([1, 2]);
    expect(result.verificationChecklist).toHaveLength(2);
    expect(result.verificationChecklist[0]).toContain('c1');
    expect(result.verificationChecklist[0]).toMatch(/replay/i);
  });

  it('calls out misconfigurations explicitly', () => {
    const result = wardenHardeningReview([
      { id: 'm1', title: 'S3 bucket misconfiguration exposes snapshots', severity: 'high' },
      { id: 's1', title: 'SQL injection in /api/users', severity: 'critical' },
    ]);
    expect(result.misconfigurations).toHaveLength(1);
    expect(result.misconfigurations[0]).toContain('m1');
    expect(result.misconfigurations[0]).toMatch(/configuration review target/);
  });
});

describe('arbiter: arbiterDispute', () => {
  const roe = { allowedTargets: ['app.example.com'], allowActive: true };

  it('binds verdicts to the ROE audit and resolves disputes with rationale and appeal path', () => {
    const actions = [
      { command: 'nmap -sV app.example.com', target: 'https://app.example.com/admin', approved: true },
      { command: 'nuclei -t cves/ https://app.example.com', target: 'app.example.com' },
    ];
    const result = arbiterDispute({
      actions,
      roe,
      claims: [
        { side: 'red', position: 'scan was routine mapping', actionIndex: 0 },
        { side: 'blue', position: 'second scan lacked a receipt', actionIndex: 1 },
      ],
    });
    expect(result.verdicts).toEqual(roeAudit(actions, roe));
    expect(result.verdicts.map(v => v.verdict)).toEqual(['compliant', 'needs_approval']);
    expect(result.resolutions).toHaveLength(2);
    expect(result.resolutions[0].ruling).toBe('compliant');
    expect(result.resolutions[0].redPosition).toBe('scan was routine mapping');
    expect(result.resolutions[0].bluePosition).toBeUndefined();
    expect(result.resolutions[1].bluePosition).toBe('second scan lacked a receipt');
    for (const r of result.resolutions) {
      expect(r.rationale).toMatch(/ROE text/);
      expect(r.appealPath.length).toBeGreaterThan(0);
    }
  });

  it('holds disputes on unaudited actions as needs_approval', () => {
    const result = arbiterDispute({
      actions: [],
      roe,
      claims: [{ side: 'red', position: 'phantom action', actionIndex: 7 }],
    });
    expect(result.resolutions[0].ruling).toBe('needs_approval');
    expect(result.resolutions[0].appealPath).toMatch(/re-audit/);
  });
});

describe('auditor: auditorScore', () => {
  it('labels confidence by provenance and aggregates the evidence-strength score', () => {
    const result = auditorScore([
      { id: 'e1', strength: 'replayable' },
      { id: 'e2', strength: 'tool' },
      { id: 'e3', strength: 'context' },
      { id: 'e4', strength: 'weak' },
    ]);
    expect(result.verdicts).toEqual(adjudicateEvidence([
      { id: 'e1', strength: 'replayable' },
      { id: 'e2', strength: 'tool' },
      { id: 'e3', strength: 'context' },
      { id: 'e4', strength: 'weak' },
    ]));
    expect(result.scores.map(s => s.confidence)).toEqual(['high', 'medium', 'low', 'very-low']);
    expect(result.scores.map(s => s.accepted)).toEqual([true, true, false, false]);
    expect(result.aggregate).toEqual({ accepted: 2, insufficient: 2, score: 50 });
    expect(result.scores[0].retestCriterion).toMatch(/Replay entry "e1"/);
    expect(result.scores[3].retestCriterion).toMatch(/Corroborate entry "e4"/);
  });

  it('caps the aggregate score at 100', () => {
    const result = auditorScore([
      { id: 'a', strength: 'tool' },
      { id: 'b', strength: 'tool' },
      { id: 'c', strength: 'tool' },
      { id: 'd', strength: 'tool' },
      { id: 'e', strength: 'replayable' },
    ]);
    expect(result.aggregate).toEqual({ accepted: 5, insufficient: 0, score: 100 });
  });

  it('infers strength from entry type like the platform semantics', () => {
    const result = auditorScore([{ id: 'r1', type: 'receipt' }, { id: 'u1' }]);
    expect(result.scores[0].confidence).toBe('high');
    expect(result.scores[1].confidence).toBe('very-low');
  });
});
