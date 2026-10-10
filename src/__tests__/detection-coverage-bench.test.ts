/**
 * Locks the Blue loadout's detection-coverage benchmark into CI: the corpus must be fully
 * ground-truthed (verdicts + uncovered/unresolvable id sets), the REAL blue pipeline
 * (dist/teams/blue) must match every ground-truth verdict, decoys with wrong countermeasure
 * keys must never score covered, and the hunt must be deterministic across runs.
 */
import { describe, it, expect } from 'vitest';
// The benchmark logic is authored in the bench script (ESM .mjs); import its pure functions directly.
import { loadCorpus, loadHunter, huntCorpus, scoreCorpus } from '../../scripts/detection-coverage-bench.mjs';

const corpus = loadCorpus();
const hunter = await loadHunter();
const byCase = huntCorpus(hunter, corpus);
const score = scoreCorpus(corpus, byCase);

describe('detection-coverage benchmark (real blue pipeline via dist/)', () => {
  it('the corpus has labeled cases + decoys, every finding ground-truthed', () => {
    expect(corpus.cases.length).toBeGreaterThanOrEqual(6);
    expect(corpus.cases.filter((c) => c.decoy).length).toBeGreaterThanOrEqual(2);
    expect(corpus.cases.every((c) => c.findings.every((f) => c.expect[f.id]))).toBe(true);
  });

  it('the real pipeline matches every ground-truth verdict + uncovered-id set', () => {
    expect(score.coverage.hits).toBe(score.coverage.total);
    expect(score.coverage.total).toBeGreaterThanOrEqual(15);
  });

  it('decoys with wrong countermeasure keys never score covered — penalties active but unspent', () => {
    expect(score.discrimination.decoyFindings).toBeGreaterThanOrEqual(2);
    expect(score.discrimination.decoyCovered).toBe(0);
    expect(score.penalty.applied).toBe(0);
  });

  it('corpus cites only real ontology ids + registry telemetry slugs (ground-truthed unresolved excepted)', () => {
    for (const c of corpus.cases) {
      for (const t of c.telemetry) {
        expect(hunter.TELEMETRY_BY_SOURCE[t.source]).toBeTruthy();
      }
      const expectedUnresolved = new Set<string>(Object.values(c.expect).flatMap((e) => e.unresolved || []));
      for (const f of c.findings) {
        for (const id of f.countermeasures || []) {
          expect(Boolean(hunter.D3FEND_BY_ID[id]) || expectedUnresolved.has(id)).toBe(true);
        }
      }
    }
  });

  it('the hunt is deterministic (two runs, identical results)', () => {
    const again = scoreCorpus(corpus, huntCorpus(hunter, corpus));
    expect(JSON.stringify(again)).toBe(JSON.stringify(score));
  });
});
