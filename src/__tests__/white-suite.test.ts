import { describe, it, expect } from 'vitest';
import { parseRoe } from '../teams/white/roe-parser.js';
import { auditEvidenceChain, type LedgerEvidenceShape } from '../teams/white/evidence-chain.js';
import { auditReport, type FindingShape } from '../teams/white/report-auditor.js';
import { roeAudit, type AuditedAction } from '../teams/white.js';

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

describe('white suite: parseRoe fails closed on inherited property names', () => {
  it('resolves constructor/toString/__proto__ allow-active values as unresolved with no ok path to verdicts', () => {
    for (const token of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const parse = parseRoe(`scope: app.example.com\nallow active: ${token}`);
      expect(parse.ok, token).toBe(false);
      expect(parse.roe.allowActive, token).toBeUndefined();
      expect(parse.unresolved.map((issue) => issue.line), token).toEqual([2]);
      expect(parse.unresolved[0].reason, token).toContain('not a recognized yes/no token');
    }
  });
});

describe('white suite: v1 roeAudit fed by a parsed spec', () => {
  it('hands parseRoe output straight to roeAudit and rules per action', () => {
    const parse = parseRoe('scope: app.example.com\nallow active: yes');
    expect(parse.ok).toBe(true);
    const actions: AuditedAction[] = [
      { command: 'curl -s https://app.example.com/login', target: 'app.example.com' },
      { command: 'nmap -sV app.example.com', approved: true },
      { command: 'nmap -sV 10.0.0.5', target: '10.0.0.5', approved: true },
      { command: 'sqlmap -u http://app.example.com/item?id=1' },
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
    const verdicts = roeAudit([{ command: 'nmap -sV app.example.com', approved: true }], parse.roe);
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
