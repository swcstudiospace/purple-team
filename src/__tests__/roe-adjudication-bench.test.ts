/**
 * Locks the White loadout's roe-adjudication benchmark into CI: the corpus must be fully
 * ground-truthed (parse expectations for every mission, adjudication/chain/report groups exactly
 * when the mission declares actions/evidence/findings, all-green ground truth for the benign
 * decoys), the corpus must exercise the honesty axes (refused parses with every unresolved-reason
 * class, broken links, coverage gaps, all three verdicts), the REAL white pipeline
 * (dist/teams/white + dist/teams/white.js) must match every ground-truth verdict, benign decoys
 * must never score flagged (penalty unspent), and the run must be deterministic across runs.
 */
import { describe, it, expect } from 'vitest';
// The benchmark logic is authored in the bench script (ESM .mjs); import its pure functions directly.
import { loadCorpus, loadEngines, runCorpus, scoreCorpus } from '../../scripts/roe-adjudication-bench.mjs';
// Verdict/severity universes, straight from the src doctrine types (the same ones dist is built from).
import type { RoeVerdict } from '../teams/white.js';
import type { FindingShape } from '../teams/white/report-auditor.js';

const VERDICTS: RoeVerdict['verdict'][] = ['compliant', 'violation', 'needs_approval'];
const SEVERITIES: FindingShape['severity'][] = ['info', 'low', 'medium', 'high', 'critical'];

const corpus = loadCorpus();
const engines = await loadEngines();
const runs = runCorpus(engines, corpus);
const score = scoreCorpus(corpus, runs);

describe('roe-adjudication benchmark (real white pipeline via dist/)', () => {
  it('the corpus has labeled missions + benign decoys, every mission parse-ground-truthed, groups paired with declared inputs', () => {
    expect(corpus.cases.length).toBeGreaterThanOrEqual(6);
    expect(corpus.cases.filter((c) => c.decoy).length).toBeGreaterThanOrEqual(2);
    const ids = corpus.cases.map((c) => c.id);
    expect(new Set(ids).size, 'case ids must be unique').toBe(ids.length);
    for (const c of corpus.cases) {
      expect(c.expect.parse, c.id).toBeTruthy();
      // group ground truth exists exactly when the matching input is declared
      expect(c.expect.adjudication !== undefined, c.id).toBe(c.actions !== undefined);
      expect(c.expect.chain !== undefined, c.id).toBe(c.evidence !== undefined);
      expect(c.expect.report !== undefined, c.id).toBe(c.findings !== undefined);
      // a decoy's ground truth IS all-green by construction
      if (c.decoy) {
        expect(c.expect.parse.ok, c.id).toBe(true);
        expect(c.expect.parse.unresolved, c.id).toHaveLength(0);
        for (const v of c.expect.adjudication ?? []) expect(v.verdict, c.id).toBe('compliant');
        expect(c.expect.chain?.broken ?? 0, c.id).toBe(0);
        expect(c.expect.report?.withGaps ?? 0, c.id).toBe(0);
        expect(c.expect.report?.unclaimed ?? [], c.id).toHaveLength(0);
      }
    }
  });

  it('the corpus exercises the honesty axes: refused parses across every unresolved-reason class, broken links, coverage gaps, all three verdicts', () => {
    const refused = corpus.cases.filter((c) => c.expect.parse.ok === false);
    expect(refused.length).toBeGreaterThanOrEqual(5);
    const reasons = refused.flatMap((c) => c.expect.parse.unresolved.map((u) => u.reason)).join('\n');
    // every refusal class the parser can report is pinned somewhere in the corpus
    expect(reasons).toContain('conflicting redefinition of allowActive');
    expect(reasons).toContain('unrecognized directive');
    expect(reasons).toContain('is not a recognized yes/no token');
    expect(reasons).toContain('empty scope directive superseded');
    expect(reasons).toContain('list item without a preceding');
    expect(corpus.cases.some((c) => c.expect.parse.summary === 'no ROE directives found in the text')).toBe(true);
    const brokenLinks = corpus.cases.flatMap((c) => c.expect.chain?.links ?? []).filter((l) => l.status === 'broken');
    expect(brokenLinks.length).toBeGreaterThanOrEqual(3);
    const gapFindings = corpus.cases.flatMap((c) => c.expect.report?.findings ?? []).filter((f) => f.status === 'coverage_gaps');
    expect(gapFindings.length).toBeGreaterThanOrEqual(2);
    const verdicts = new Set(corpus.cases.flatMap((c) => (c.expect.adjudication ?? []).map((v) => v.verdict)));
    for (const v of VERDICTS) expect(verdicts.has(v), `corpus must exercise '${v}'`).toBe(true);
  });

  it('ground truth is well-formed: adjudication only on ok parses, legal verdicts/severities, chain and report mirror the declared ledgers', () => {
    for (const c of corpus.cases) {
      if (c.actions !== undefined) {
        // never adjudicate against a partial spec
        expect(c.expect.parse.ok, c.id).toBe(true);
        expect(c.expect.adjudication?.length, c.id).toBe(c.actions.length);
        c.expect.adjudication?.forEach((v, i) => {
          expect(v.actionIndex, c.id).toBe(i);
          expect(VERDICTS, `${c.id}: ${v.verdict}`).toContain(v.verdict);
        });
      }
      if (c.evidence !== undefined) {
        expect(c.expect.chain?.links.length, c.id).toBe(c.evidence.length);
      }
      if (c.findings !== undefined) {
        for (const f of c.findings) expect(SEVERITIES, `${c.id}: ${f.severity}`).toContain(f.severity);
        expect(c.expect.report?.findings.length, c.id).toBe(c.findings.length);
        for (const f of c.expect.report?.findings ?? []) {
          expect(c.findings.some((got) => got.id === f.findingId), `${c.id}: ${f.findingId}`).toBe(true);
        }
      }
    }
  });

  it('the real pipeline matches every ground-truth verdict (parse, adjudication, chain, report)', () => {
    expect(score.verdicts.hits).toBe(score.verdicts.total);
    expect(score.verdicts.total).toBeGreaterThanOrEqual(24);
  });

  it('benign decoys never score flagged — discrimination holds and the penalty stays unspent', () => {
    expect(score.discrimination.decoyMissions).toBeGreaterThanOrEqual(2);
    expect(score.discrimination.decoyFlagged).toBe(0);
    expect(score.penalty.applied).toBe(0);
  });

  it('the run is deterministic (two runs, identical results)', () => {
    const again = scoreCorpus(corpus, runCorpus(engines, corpus));
    expect(JSON.stringify(again)).toBe(JSON.stringify(score));
  });
});
