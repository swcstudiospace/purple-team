import { describe, it, expect } from 'vitest';
import { parseRoe } from '../teams/white/roe-parser.js';
import { auditEvidenceChain, type LedgerEvidenceShape } from '../teams/white/evidence-chain.js';
import { auditReport, type FindingShape } from '../teams/white/report-auditor.js';
import { roeAudit, type AuditedAction } from '../teams/white.js';
import { stageRoeAudit, pairDisputeRulings, aggregateEvidenceStanding } from '../teams/white/workflow.js';
import { WHITE_PARENT_PROMPT, WHITE_SPECIALIST_PROMPTS } from '../prompts/white.js';

describe('white suite: parseRoe', () => {
  it('maps scope and allow-active directives onto RoeSpec fields with per-line accounting', () => {
    const parse = parseRoe([
      '# Engagement ROE',
      'scope: app.example.com, api.example.com',
      'allow active: no',
      '',
    ].join('\n'));
    expect(parse.ok).toBe(true);
    expect(parse.roe.allowedTargets).toEqual(['app.example.com', 'api.example.com']);
    expect(parse.roe.allowActive).toBe(false);
    expect(parse.commentLines).toBe(1);
    expect(parse.unresolved).toEqual([]);
    expect(parse.resolved.map(resolution => resolution.field)).toEqual(['allowedTargets', 'allowActive']);
    expect(parse.resolved[0]).toMatchObject({ line: 2, value: 'app.example.com, api.example.com' });
    expect(parse.resolved[1]).toMatchObject({ line: 3, value: 'false' });
    expect(parse.summary).toContain('parsed 2 directive line(s)');
  });

  it('continues a scope directive through bullet lines into the spec', () => {
    const parse = parseRoe([
      'allowed targets:',
      '- app.example.com',
      '* api.example.com',
    ].join('\n'));
    expect(parse.ok).toBe(true);
    expect(parse.roe.allowedTargets).toEqual(['app.example.com', 'api.example.com']);
    expect(parse.resolved.map(resolution => resolution.line)).toEqual([1, 2, 3]);
    expect(parse.resolved[0].value).toBe('filled by the bullet list below');
  });

  it('reports a conflicting allow-active redefinition, keeps the later value, and withholds ok', () => {
    const parse = parseRoe([
      'scope: app.example.com',
      'allow active: permitted',
      'active testing: forbidden',
    ].join('\n'));
    expect(parse.ok).toBe(false);
    expect(parse.roe.allowActive).toBe(false);
    expect(parse.roe.allowedTargets).toEqual(['app.example.com']);
    expect(parse.unresolved).toHaveLength(1);
    expect(parse.unresolved[0].line).toBe(3);
    expect(parse.unresolved[0].reason).toContain('conflicting redefinition of allowActive');
    expect(parse.unresolved[0].reason).toContain('line 2');
  });

  it('reports every unhonored line with its exact reason instead of guessing', () => {
    const parse = parseRoe([
      'deploy the implant on tuesday',
      'scope:',
      '- app.example.com',
      '// a counted comment',
    ].join('\n'));
    expect(parse.ok).toBe(false);
    expect(parse.commentLines).toBe(1);
    expect(parse.roe.allowedTargets).toEqual(['app.example.com']);
    expect(parse.unresolved.map(issue => issue.line)).toEqual([1]);
    expect(parse.unresolved[0].reason).toContain('unrecognized directive');

    const emptyScope = parseRoe('scope:');
    expect(emptyScope.ok).toBe(false);
    expect(emptyScope.unresolved[0].reason).toContain('scope directive carries no targets');

    const orphanBullet = parseRoe('- orphan.example.net');
    expect(orphanBullet.ok).toBe(false);
    expect(orphanBullet.unresolved[0].reason).toContain('list item without a preceding "scope:" directive');
  });

  it('parses empty and comment-only text honestly (nothing guessed, nothing parsed)', () => {
    const empty = parseRoe('');
    expect(empty.ok).toBe(false);
    expect(empty.roe).toEqual({});
    expect(empty.resolved).toEqual([]);
    expect(empty.unresolved).toEqual([]);
    expect(empty.commentLines).toBe(0);
    expect(empty.summary).toBe('no ROE directives found in the text');

    const comments = parseRoe('# operator left only a header\n');
    expect(comments.ok).toBe(false);
    expect(comments.resolved).toEqual([]);
    expect(comments.unresolved).toEqual([]);
    expect(comments.commentLines).toBe(1);
  });
});

describe('white suite: v1 roeAudit fed by a parsed spec', () => {
  it('hands parseRoe output straight to roeAudit and rules per action', () => {
    const parse = parseRoe('scope: app.example.com\nallow active: yes');
    expect(parse.ok).toBe(true);
    const actions: AuditedAction[] = [
      { command: 'curl -s https://app.example.com/login', target: 'app.example.com' },
      { command: 'nmap -sV app.example.com', target: 'app.example.com', approved: true },
      { command: 'nmap -sV 10.0.0.5', target: '10.0.0.5', approved: true },
      { command: 'sqlmap -u http://app.example.com/item?id=1', target: 'app.example.com' },
    ];
    const verdicts = roeAudit(actions, parse.roe);
    expect(verdicts.map(verdict => verdict.verdict)).toEqual([
      'compliant',
      'compliant',
      'violation',
      'needs_approval',
    ]);
    expect(verdicts[2].rationale).toContain('outside the ROE allowed targets');
    expect(verdicts[3].rationale).toContain('requires an approval receipt');
    expect(verdicts.map(verdict => verdict.actionIndex)).toEqual([0, 1, 2, 3]);
  });

  it('rules an approved active technique a violation when the parsed spec forbids active', () => {
    const parse = parseRoe('scope: app.example.com\nallow active: no');
    expect(parse.ok).toBe(true);
    const verdicts = roeAudit([{ command: 'nmap -sV app.example.com', target: 'app.example.com', approved: true }], parse.roe);
    expect(verdicts[0].verdict).toBe('violation');
    expect(verdicts[0].rationale).toContain('disallowed by the ROE');
  });
});

describe('white suite: auditEvidenceChain', () => {
  it('breaks replayable evidence with no replay hook and restores it once a hook is attached', () => {
    const audit = auditEvidenceChain([{ id: 'E-1', type: 'receipt' }]);
    expect(audit.broken).toBe(1);
    expect(audit.links[0].status).toBe('broken');
    expect(audit.links[0].strength).toBe('replayable');
    expect(audit.links[0].reason).toContain('no replay hook');
    expect(audit.links[0].conditions).toEqual([
      'attach the receipt uri or the exact command so the evidence can be replayed',
    ]);

    const rewired = auditEvidenceChain([{ id: 'E-1', type: 'receipt', command: 'nuclei -u https://app.example.com' }]);
    expect(rewired.intact).toBe(1);
    expect(rewired.broken).toBe(0);
    expect(rewired.links[0].status).toBe('intact');
    expect(rewired.links[0].replayHook).toBe('nuclei -u https://app.example.com');
    expect(rewired.links[0].conditions).toEqual([]);
  });

  it('breaks duplicate ledger ids so the records cannot be told apart', () => {
    const audit = auditEvidenceChain([
      { id: 'E-1', type: 'command', command: 'nmap -sV app.example.com' },
      { id: 'E-1', type: 'command', command: 'nmap -sV app.example.com' },
    ]);
    expect(audit.links).toHaveLength(2);
    expect(audit.links[0].status).toBe('intact');
    expect(audit.links[1].status).toBe('broken');
    expect(audit.links[1].reason).toContain('duplicate evidence id "E-1"');
    expect(audit.summary).toBe('1 intact, 1 broken of 2 ledger entries');
  });

  it('resolves strength from the persisted provenanceStrength over the entry type', () => {
    const audit = auditEvidenceChain([
      { id: 'E-1', type: 'note', provenanceStrength: 'tool' },
      { id: 'E-2', type: 'command', provenanceStrength: 'weak' },
    ]);
    expect(audit.links[0].strength).toBe('tool');
    expect(audit.links[0].status).toBe('intact');
    expect(audit.links[1].strength).toBe('weak');
    expect(audit.links[1].status).toBe('broken');
    expect(audit.links[1].reason).toContain('insufficient');
    expect(audit.links[1].conditions).toEqual(['corroborate with tool output or a replayable receipt']);
  });

  it('audits an empty ledger to honest zeroed counts', () => {
    const audit = auditEvidenceChain([]);
    expect(audit.links).toEqual([]);
    expect(audit.intact).toBe(0);
    expect(audit.broken).toBe(0);
    expect(audit.summary).toBe('0 intact, 0 broken of 0 ledger entries');
  });
});

describe('white suite: auditReport', () => {
  // A tool-grade entry the tests can reference: accepted by the platform ruling.
  const carried: LedgerEvidenceShape = { id: 'E-1', type: 'command', command: 'nmap -sV app.example.com' };

  it('flags a dangling evidence reference as an exact gap', () => {
    const finding: FindingShape = {
      id: 'F-1',
      title: 'Open admin panel',
      severity: 'high',
      evidenceIds: ['E-missing'],
      recommendedFix: 'restrict /admin to the VPN range',
      acceptanceCriteria: ['/admin answers 403 from off-VPN'],
    };
    const audit = auditReport([finding], [carried]);
    expect(audit.withGaps).toBe(1);
    expect(audit.findings[0].status).toBe('coverage_gaps');
    expect(audit.findings[0].links[0]).toEqual({ evidenceId: 'E-missing', present: false, verdict: 'absent' });
    expect(audit.findings[0].gaps).toContain('evidence "E-missing" is referenced but absent from the ledger');
  });

  it('enforces the report contract: tool-grade evidence carrying the finding plus fix and retest criteria', () => {
    const noContract: FindingShape = {
      id: 'F-2',
      title: 'Reflected XSS in search',
      severity: 'medium',
      evidenceIds: ['E-1'],
      recommendedFix: '   ',
      acceptanceCriteria: [],
    };
    const audit = auditReport([noContract], [carried]);
    expect(audit.findings[0].links[0]).toMatchObject({ evidenceId: 'E-1', present: true, verdict: 'accepted', strength: 'tool' });
    expect(audit.findings[0].gaps).toContain('no recommended fix: the report cannot ship a finding without remediation');
    expect(audit.findings[0].gaps).toContain('no retest acceptance criteria: the report cannot ship without a retest path');
    expect(audit.reportReady).toBe(0);

    const complete: FindingShape = {
      ...noContract,
      recommendedFix: 'encode search output',
      acceptanceCriteria: ['payload renders as text'],
    };
    const ready = auditReport([complete], [carried]);
    expect(ready.findings[0].status).toBe('report_ready');
    expect(ready.findings[0].gaps).toEqual([]);
    expect(ready.reportReady).toBe(1);
  });

  it('reports below-tool-grade evidence as insufficient to carry a finding', () => {
    const finding: FindingShape = {
      id: 'F-3',
      title: 'Stale server banner',
      severity: 'low',
      evidenceIds: ['E-9'],
      recommendedFix: 'patch the banner',
      acceptanceCriteria: ['banner no longer discloses the version'],
    };
    const audit = auditReport([finding], [{ id: 'E-9', type: 'report' }]);
    expect(audit.findings[0].links[0]).toMatchObject({ present: true, verdict: 'insufficient', strength: 'context' });
    expect(audit.findings[0].gaps).toContain('no tool-grade or better evidence carries this finding');
  });

  it('surfaces an unknown severity bucket unmangled without inventing a high/critical condition', () => {
    // Probe from outside the union: the audit must echo what it was handed, not
    // normalize an unknown bucket into high/critical (which would invent a
    // replayable-grade condition the operator never claimed).
    const oddSeverity: string = 'blocker';
    const finding: FindingShape = {
      id: 'F-4',
      title: 'Odd severity probe',
      severity: oddSeverity as FindingShape['severity'],
      evidenceIds: ['E-1'],
      recommendedFix: 'fix it',
      acceptanceCriteria: ['it is fixed'],
    };
    const audit = auditReport([finding], [carried]);
    expect(audit.findings[0].severity).toBe('blocker');
    expect(audit.findings[0].conditions).toEqual([]);
    expect(audit.findings[0].status).toBe('report_ready');
    expect(audit.reportReady).toBe(1);
    expect(audit.withGaps).toBe(0);
  });

  it('draws a non-blocking replayable-grade condition for critical claims carried below receipt grade', () => {
    const finding: FindingShape = {
      id: 'F-5',
      title: 'SQL injection in login',
      severity: 'critical',
      evidenceIds: ['E-1'],
      recommendedFix: 'parameterize the query',
      acceptanceCriteria: ['payload errors out without executing'],
    };
    const audit = auditReport([finding], [carried]);
    expect(audit.findings[0].status).toBe('report_ready');
    expect(audit.findings[0].conditions).toEqual([
      'critical-severity claim rests below replayable grade; attach a receipt a third party can re-run',
    ]);
  });

  it('reports unclaimed ledger entries, including dangling findingId back-references', () => {
    const finding: FindingShape = {
      id: 'F-6',
      title: 'Open admin panel',
      severity: 'medium',
      evidenceIds: ['E-1'],
      recommendedFix: 'restrict /admin',
      acceptanceCriteria: ['/admin requires auth'],
    };
    const audit = auditReport([finding], [
      carried,
      { id: 'E-2', type: 'note', findingId: 'F-404' },
      { id: 'E-3', type: 'log' },
    ]);
    expect(audit.unclaimedEvidence.map(entry => entry.evidenceId)).toEqual(['E-2', 'E-3']);
    expect(audit.unclaimedEvidence[0].reason).toBe('references finding "F-404", which is not in the audited report');
    expect(audit.unclaimedEvidence[1].reason).toBe('not referenced by any finding in the report');
  });

  it('computes report completeness and zeroes honestly on empty ledgers', () => {
    const ready: FindingShape = {
      id: 'F-7',
      title: 'Cookie without Secure flag',
      severity: 'low',
      evidenceIds: ['E-1'],
      recommendedFix: 'set the Secure attribute',
      acceptanceCriteria: ['cookie refused over plain http'],
    };
    const gappy: FindingShape = { ...ready, id: 'F-8', evidenceIds: ['E-nope'] };
    const audit = auditReport([ready, gappy], [carried]);
    expect(audit.reportReady).toBe(1);
    expect(audit.withGaps).toBe(1);
    expect(audit.reportReady + audit.withGaps).toBe(audit.findings.length);

    const empty = auditReport([], []);
    expect(empty.findings).toEqual([]);
    expect(empty.reportReady).toBe(0);
    expect(empty.withGaps).toBe(0);
    expect(empty.unclaimedEvidence).toEqual([]);
    expect(empty.summary).toBe('0/0 findings report-ready; 0 unclaimed ledger entries');
  });
});

describe('white suite: fail-closed scope', () => {
  const roe = { allowedTargets: ['allowed.example'], allowActive: true };

  it('rules a missing target out of scope, never in scope', () => {
    const verdicts = roeAudit([{ command: 'curl -s https://allowed.example/' }], roe);
    expect(verdicts[0].verdict).toBe('violation');
    expect(verdicts[0].rationale).toContain('outside the ROE allowed targets');
  });

  it('rules every host out of scope against an empty allow-list', () => {
    const verdicts = roeAudit(
      [{ command: 'curl -s https://allowed.example/', target: 'allowed.example' }],
      { allowedTargets: [], allowActive: true },
    );
    expect(verdicts[0].verdict).toBe('violation');
  });

  it('resolves userinfo-bearing URLs by their real host', () => {
    const carried = roeAudit(
      [{ command: 'curl -s https://user:pass@allowed.example/path', target: 'https://user:pass@allowed.example/path' }],
      roe,
    );
    expect(carried[0].verdict).toBe('compliant');
    const spoofed = roeAudit(
      [{ command: 'curl -s https://allowed.example@attacker.test/path', target: 'https://allowed.example@attacker.test/path' }],
      roe,
    );
    expect(spoofed[0].verdict).toBe('violation');
  });

  it('keeps a permitted host matching after port normalization', () => {
    const verdicts = roeAudit(
      [{ command: 'curl -s http://allowed.example:8443/admin', target: 'http://allowed.example:8443/admin' }],
      roe,
    );
    expect(verdicts[0].verdict).toBe('compliant');
  });

  it('parses bracketed IPv6 targets before matching', () => {
    const v6 = roeAudit(
      [{ command: 'curl -s http://[::1]:8080/admin', target: 'http://[::1]:8080/admin' }],
      { allowedTargets: ['::1'], allowActive: true },
    );
    expect(v6[0].verdict).toBe('compliant');
  });

  it('rejects named-suffix and path/query lookalikes', () => {
    for (const target of [
      'allowed.example.attacker.test',
      'https://attacker.test/allowed.example',
      'https://attacker.test?x=allowed.example',
      'notallowed.example',
    ]) {
      const verdicts = roeAudit([{ command: `curl -s ${target}`, target }], roe);
      expect(verdicts[0].verdict).toBe('violation');
    }
  });

  it('never lets approval flip an out-of-scope host to compliant', () => {
    const verdicts = roeAudit(
      [{ command: 'nmap -sV 10.0.0.5', target: '10.0.0.5', approved: true }],
      roe,
    );
    expect(verdicts[0].verdict).toBe('violation');
    expect(verdicts[0].rationale).toContain('outside the ROE allowed targets');
  });
});

describe('white suite: staged workflow', () => {
  const roeText = 'scope: app.example.com\nallow active: yes';

  it('refuses before roeAudit when the ROE text does not parse ok', () => {
    const result = stageRoeAudit('allow active: maybe', [
      { command: 'curl -s https://app.example.com/', target: 'app.example.com' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('roe-parse-failed');
  });

  it('refuses before roeAudit when the parsed allow-list is empty', () => {
    // parseRoe itself withholds ok on allow-active-only text (a spec without
    // scope cannot be adjudicated); the staged workflow refuses before audit.
    const result = stageRoeAudit('allow active: yes', [
      { command: 'curl -s https://app.example.com/', target: 'app.example.com' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('roe-parse-failed');
      expect(result.detail).toContain('no scope');
    }
  });

  it('holds an approved active action at needs_approval without a supplied approval evidence id', () => {
    const result = stageRoeAudit(roeText, [
      { command: 'nmap -sV app.example.com', target: 'app.example.com', approved: true },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verdicts[0].verdict).toBe('needs_approval');
      expect(result.verdicts[0].rationale).toContain('a boolean is not a receipt');
    }
  });

  it('rules a supplied-approval active action compliant and echoes caller provenance without minting', () => {
    const result = stageRoeAudit(
      roeText,
      [{ command: 'nmap -sV app.example.com', target: 'app.example.com', approved: true, approvalEvidenceId: 'R-12' }],
      { revision: 'r3', textHash: 'abc123', sourceLine: 7 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verdicts[0].verdict).toBe('compliant');
      expect(result.revision).toBe('r3');
      expect(result.textHash).toBe('abc123');
      expect(result.sourceLine).toBe(7);
    }
  });

  it('pairs two opposed claims on one action into a single ruling keeping both positions', () => {
    const staged = stageRoeAudit(roeText, [
      { command: 'nmap -sV app.example.com', target: 'app.example.com', approved: true, approvalEvidenceId: 'R-12' },
    ]);
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const rulings = pairDisputeRulings([
      { side: 'red', position: 'scan was approved under receipt R-12', actionIndex: 0 },
      { side: 'blue', position: 'receipt R-12 names a different target', actionIndex: 0 },
    ], staged.verdicts);
    expect(rulings).toHaveLength(1);
    expect(rulings[0].status).toBe('paired');
    expect(rulings[0].redPosition).toBe('scan was approved under receipt R-12');
    expect(rulings[0].bluePosition).toBe('receipt R-12 names a different target');
  });

  it('records a missing dispute side as insufficiency, never a one-sided record', () => {
    const staged = stageRoeAudit(roeText, [
      { command: 'curl -s https://app.example.com/', target: 'app.example.com' },
    ]);
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const rulings = pairDisputeRulings(
      [{ side: 'red', position: 'passive fetch needed no approval', actionIndex: 0 }],
      staged.verdicts,
    );
    expect(rulings).toHaveLength(1);
    expect(rulings[0].status).toBe('insufficient');
    expect(rulings[0].bluePosition).toBeUndefined();
    expect(rulings[0].rationale).toContain('the blue position');
  });
});

describe('white suite: honest aggregates', () => {
  const carried: LedgerEvidenceShape = { id: 'E-1', type: 'command', command: 'nmap -sV app.example.com' };
  const ready = {
    id: 'F-1',
    title: 'Open admin panel',
    severity: 'medium' as const,
    evidenceIds: ['E-1'],
    recommendedFix: 'restrict /admin',
    acceptanceCriteria: ['/admin requires auth'],
  };

  it('scores a fully carried report sufficient at 100', () => {
    const standing = aggregateEvidenceStanding([ready], [carried]);
    expect(standing.sufficient).toBe(true);
    expect(standing.score).toBe(100);
    expect(standing.gaps).toEqual([]);
  });

  it('withholds sufficiency and 100 when a required item is insufficient', () => {
    const weak = { ...ready, id: 'F-2', evidenceIds: ['E-9'] };
    const standing = aggregateEvidenceStanding([ready, weak], [carried, { id: 'E-9', type: 'report' }]);
    expect(standing.sufficient).toBe(false);
    expect(standing.score).toBeLessThan(100);
    expect(standing.gaps.some(gap => gap.includes('F-2'))).toBe(true);
  });

  it('withholds sufficiency and 100 on missing, broken, and contradictory rows', () => {
    const missing = aggregateEvidenceStanding([{ ...ready, id: 'F-req' }], [carried], { requiredFindingIds: ['F-req', 'F-absent'] });
    expect(missing.sufficient).toBe(false);
    expect(missing.score).toBeLessThan(100);

    const dup = aggregateEvidenceStanding([ready], [
      carried,
      { id: 'E-1', type: 'command', command: 'nmap -sV app.example.com' },
    ]);
    expect(dup.sufficient).toBe(false);
    expect(dup.score).toBeLessThan(100);

    const staged = stageRoeAudit('scope: app.example.com\nallow active: yes', [
      { command: 'curl -s https://app.example.com/', target: 'app.example.com' },
    ]);
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const oneSided = pairDisputeRulings(
      [{ side: 'blue', position: 'fetch exceeded scope', actionIndex: 0 }],
      staged.verdicts,
    );
    const contested = aggregateEvidenceStanding([ready], [carried], { disputes: oneSided });
    expect(contested.sufficient).toBe(false);
    expect(contested.score).toBeLessThan(100);
  });

  it('scores an empty required set at honest zero, never 100', () => {
    const standing = aggregateEvidenceStanding([], []);
    expect(standing.sufficient).toBe(false);
    expect(standing.score).toBe(0);
  });
});

describe('white suite: prompts name real exports and referee limits', () => {
  it('parent guidance cites the staged workflow and the fail-closed limits', () => {
    expect(WHITE_PARENT_PROMPT).toContain('stageRoeAudit');
    expect(WHITE_PARENT_PROMPT).toContain('aggregateEvidenceStanding');
    expect(WHITE_PARENT_PROMPT).toContain('auditEvidenceChain');
    expect(WHITE_PARENT_PROMPT).toContain('auditReport');
    expect(WHITE_PARENT_PROMPT).toContain('Fail closed');
    expect(WHITE_PARENT_PROMPT).toContain('Insufficient required evidence can never score sufficient or 100');
  });

  it('specialist blocks name their engine and grant ids', () => {
    expect(WHITE_SPECIALIST_PROMPTS['roe-compliance-reviewer']).toContain('roeAudit');
    expect(WHITE_SPECIALIST_PROMPTS['evidence-custodian']).toContain('auditEvidenceChain');
    expect(WHITE_SPECIALIST_PROMPTS['report-coverage-auditor']).toContain('auditReport');
    expect(WHITE_SPECIALIST_PROMPTS['dispute-adjudicator']).toContain('pairDisputeRulings');
    expect(WHITE_SPECIALIST_PROMPTS['evidence-strength-scorer']).toContain('aggregateEvidenceStanding');
    expect(WHITE_SPECIALIST_PROMPTS['roe-compliance-reviewer']).toContain('dig');
    expect(WHITE_SPECIALIST_PROMPTS['report-coverage-auditor']).toContain('nist-800-115');
  });

  it('matches bare IPv6 and bracketed IPv6 targets accurately in roeAudit', () => {
    const verdicts = roeAudit(
      [
        { command: 'curl -s http://[::1]:8080/health', target: '::1' },
        { command: 'curl -s http://[::1]:8080/health', target: 'http://[::1]:8080/health' },
        { command: 'curl -s http://[::2]:8080/health', target: '::2' },
      ],
      { allowedTargets: ['::1'], allowActive: true },
    );
    expect(verdicts[0].verdict).toBe('compliant');
    expect(verdicts[1].verdict).toBe('compliant');
    expect(verdicts[2].verdict).toBe('violation');
  });
});
