/**
 * Locks the Black loadout's opsec-review benchmark into CI: the corpus must be fully
 * ground-truthed (noise/review verdicts for every case, exfil expectations exactly when a plan
 * declares exfil paths, quiet ground truth for the benign decoys), every ground-truth id must
 * resolve in the vendored ATT&CK universe / phase / channel tables, the REAL black pipeline
 * (dist/teams/black) must match every ground-truth verdict, benign decoys must never score
 * flagged (penalty unspent), and the run must be deterministic across runs.
 */
import { describe, it, expect } from 'vitest';
// The benchmark logic is authored in the bench script (ESM .mjs); import its pure functions directly.
import { loadCorpus, loadEngines, runCorpus, scoreCorpus } from '../../scripts/opsec-review-bench.mjs';
// Ground-truth id universe, straight from the src doctrine tables (the same ones dist is built from).
import { ATTACK_BY_ID } from '../teams/black/attack-data.js';
import { OPSEC_PHASES } from '../teams/black/checklist.js';
import { EXFIL_CHANNELS } from '../teams/black/exfil.js';

const corpus = loadCorpus();
const engines = await loadEngines();
const runs = runCorpus(engines, corpus);
const score = scoreCorpus(corpus, runs);

describe('opsec-review benchmark (real black pipeline via dist/)', () => {
  it('the corpus has labeled cases + benign decoys, every case fully ground-truthed', () => {
    expect(corpus.cases.length).toBeGreaterThanOrEqual(6);
    expect(corpus.cases.filter((c) => c.decoy).length).toBeGreaterThanOrEqual(2);
    for (const c of corpus.cases) {
      // noise + review ground truth is mandatory; exfil ground truth exists exactly when the plan declares exfil paths
      expect(c.expect.noise, c.id).toBeTruthy();
      expect(c.expect.review, c.id).toBeTruthy();
      expect(c.expect.exfil !== undefined, c.id).toBe(c.exfil !== undefined);
      // a decoy's ground truth IS quiet: zero cost, and non-decoy exfil cases carry channel expectations
      if (c.decoy) {
        expect(c.expect.noise.total, c.id).toBe(0);
        expect(c.expect.noise.tier, c.id).toBe('quiet');
      } else if (c.exfil) {
        expect(c.expect.exfil?.paths.length, c.id).toBeGreaterThan(0);
        for (const p of c.expect.exfil?.paths ?? []) expect(p.channel, c.id).toBeTruthy();
      }
    }
  });

  it('ground truth cites only real ids: ATT&CK techniques, opsec phases, and channel keys (decoy channels stay foreign)', () => {
    for (const c of corpus.cases) {
      for (const phase of c.expect.review.phases) {
        expect((OPSEC_PHASES as readonly string[]).includes(phase.phase), c.id).toBe(true);
        for (const id of phase.matchedTechniques) {
          expect(ATTACK_BY_ID[id], `${c.id}: ${id}`).toBeTruthy();
        }
      }
      for (const p of c.exfil?.paths ?? []) {
        const known = EXFIL_CHANNELS.includes(p.channel ?? '');
        expect(known, `${c.id}: channel '${p.channel}'`).toBe(!c.decoy);
      }
    }
  });

  it('the real pipeline matches every ground-truth verdict (noise ledger, phase-keyed review, egress costs)', () => {
    expect(score.verdicts.hits).toBe(score.verdicts.total);
    expect(score.verdicts.total).toBeGreaterThanOrEqual(20);
  });

  it('benign decoys never score flagged — discrimination holds and the penalty stays unspent', () => {
    expect(score.discrimination.decoyPlans).toBeGreaterThanOrEqual(2);
    expect(score.discrimination.decoyFlagged).toBe(0);
    expect(score.penalty.applied).toBe(0);
  });

  it('the run is deterministic (two runs, identical results)', () => {
    const again = scoreCorpus(corpus, runCorpus(engines, corpus));
    expect(JSON.stringify(again)).toBe(JSON.stringify(score));
  });
});
