#!/usr/bin/env node
// opsec-review-bench.mjs — the Black loadout's opsec-review benchmark.
//
// Scores the REAL black pipeline (dist/teams/black: the structured noise budget, the
// phase-keyed opsec review, and the egress path cost model) against a committed corpus of
// labeled red plans with KNOWN ground-truth verdicts. Two axes:
//   • adherence      — per-plan noise spend (total/tier/within + the exact violation strings),
//                      phase-keyed review output (matched techniques per phase, item count,
//                      egress notes), and per-path egress cost arithmetic (channel resolution,
//                      technique, base/volume/penalty decomposition, tier, feasibility) must all
//                      equal ground truth
//   • discrimination — DECOY plans of BENIGN operations text (near-miss wording a naive keyword
//                      matcher would flag) must score totally quiet: zero cost, zero violations,
//                      zero phases; an unknown exfil channel key must resolve to 'unspecified'
//                      (C2-channel fallback technique), never be silently adopted
//
// HONEST SCOPE: this measures the deterministic doctrine engines over DECLARED plan text — not
// whether a live blue team would catch the operator. The number is directional (small corpus,
// pure functions, no I/O, no LLM). The default run (`--self-test`) is deterministic: same corpus,
// same dist build → byte-identical report.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, '..', 'bench', 'opsec-review', 'corpus.json');
const REPORT = path.join(HERE, '..', 'bench', 'opsec-review', 'report.json');

export function loadCorpus() {
  return JSON.parse(readFileSync(CORPUS, 'utf8'));
}

// Load the engines from the built dist/ output — the real pipeline, never a vendored copy.
// Missing dist means the caller must build first; the error says exactly that.
export async function loadEngines() {
  const black = path.join(HERE, '..', 'dist', 'teams', 'black');
  try {
    const [noise, checklist, exfil, attackData] = await Promise.all([
      import(pathToFileURL(path.join(black, 'noise.js')).href),
      import(pathToFileURL(path.join(black, 'checklist.js')).href),
      import(pathToFileURL(path.join(black, 'exfil.js')).href),
      import(pathToFileURL(path.join(black, 'attack-data.js')).href),
    ]);
    return {
      structuredNoiseBudget: noise.structuredNoiseBudget,
      opsecReview: checklist.opsecReview,
      exfilCostModel: exfil.exfilCostModel,
      ATTACK_BY_ID: attackData.ATTACK_BY_ID,
      OPSEC_PHASES: checklist.OPSEC_PHASES,
      EXFIL_CHANNELS: exfil.EXFIL_CHANNELS,
    };
  } catch {
    throw new Error('black pipeline not found under dist/teams/black — run `npm run build` (tsc) first');
  }
}

// Run all three real engines over every corpus plan, mapping case id → {noise, review, exfil}.
export function runCorpus(engines, corpus) {
  const runs = {};
  for (const c of corpus.cases) {
    const plan = { actions: c.plan.actions ?? [], egress: c.plan.egress ?? [] };
    runs[c.id] = {
      noise: engines.structuredNoiseBudget(plan),
      review: engines.opsecReview(plan),
      exfil: engines.exfilCostModel({ paths: c.exfil?.paths ?? [], egress: plan.egress }),
    };
  }
  return runs;
}

const sameSorted = (a, b) => {
  if (a.length !== b.length) return false;
  const want = [...a].sort();
  const got = [...b].sort();
  return want.every((v, i) => got[i] === v);
};

// Ground-truth the noise ledger: exact total, tier, budget verdict, and the exact violation set.
function noiseMisses(run, exp) {
  const reasons = [];
  if (run.total !== exp.total) reasons.push(`total ${run.total} != expected ${exp.total}`);
  if (run.tier !== exp.tier) reasons.push(`tier '${run.tier}' != expected '${exp.tier}'`);
  if (run.within !== exp.within) reasons.push(`within ${run.within} != expected ${exp.within}`);
  if (!sameSorted(run.violations ?? [], exp.violations ?? [])) {
    reasons.push(`violations [${(run.violations ?? []).join(' | ')}] != expected [${(exp.violations ?? []).join(' | ')}]`);
  }
  return reasons;
}

// Ground-truth the phase-keyed review: exact matched-technique sets per phase, item count,
// egress declaration, and egress notes.
function reviewMisses(run, exp) {
  const reasons = [];
  const key = (p) => `${p.phase}=[${[...p.matchedTechniques].sort().join(',')}]`;
  const got = (run.phases ?? []).map(key).sort();
  const want = (exp.phases ?? []).map(key).sort();
  if (got.length !== want.length || got.some((k, i) => k !== want[i])) {
    reasons.push(`phases [${got.join(' | ')}] != expected [${want.join(' | ')}]`);
  }
  if (run.itemCount !== exp.itemCount) reasons.push(`itemCount ${run.itemCount} != expected ${exp.itemCount}`);
  if (run.egressDeclared !== exp.egressDeclared) reasons.push(`egressDeclared ${run.egressDeclared} != expected ${exp.egressDeclared}`);
  if (!sameSorted(run.egressNotes ?? [], exp.egressNotes ?? [])) {
    reasons.push(`egressNotes [${(run.egressNotes ?? []).join(' | ')}] != expected [${(exp.egressNotes ?? []).join(' | ')}]`);
  }
  return reasons;
}

// Ground-truth the egress cost model: per-path channel resolution, technique, the full
// base/volume/penalty decomposition, tier, feasibility — plus run totals.
const EXFIL_PATH_FIELDS = ['channel', 'techniqueId', 'baseCost', 'volumeCost', 'penalty', 'totalCost', 'tier', 'feasible'];

function exfilMisses(run, exp) {
  const reasons = [];
  const byPathId = new Map((run.paths ?? []).map((p) => [p.pathId, p]));
  for (const want of exp.paths ?? []) {
    const got = byPathId.get(want.pathId);
    if (!got) {
      reasons.push(`path ${want.pathId}: no costed path in report`);
      continue;
    }
    for (const field of EXFIL_PATH_FIELDS) {
      if (got[field] !== want[field]) {
        reasons.push(`path ${want.pathId}: ${field} ${JSON.stringify(got[field])} != expected ${JSON.stringify(want[field])}`);
      }
    }
  }
  const reported = (run.paths ?? []).map((p) => p.pathId);
  const expected = (exp.paths ?? []).map((p) => p.pathId);
  if (!sameSorted(reported, expected)) {
    reasons.push(`costed paths [${reported.join(',')}] != expected [${expected.join(',')}]`);
  }
  if (run.totalCost !== exp.totalCost) reasons.push(`totalCost ${run.totalCost} != expected ${exp.totalCost}`);
  if (run.within !== exp.within) reasons.push(`within ${run.within} != expected ${exp.within}`);
  return reasons;
}

// Score engine runs against the corpus ground truth, one expectation group per axis per case;
// decoy plans additionally must score totally quiet (each flagged decoy accrues the penalty).
export function scoreCorpus(corpus, runs) {
  let hits = 0, total = 0, decoyPlans = 0, decoyFlagged = 0;
  const perCase = corpus.cases.map((c) => {
    const run = runs[c.id] ?? {};
    const misses = [];
    const groups = [];
    if (c.expect.noise) groups.push(['noise', noiseMisses(run.noise ?? {}, c.expect.noise)]);
    if (c.expect.review) groups.push(['review', reviewMisses(run.review ?? {}, c.expect.review)]);
    if (c.expect.exfil) groups.push(['exfil', exfilMisses(run.exfil ?? {}, c.expect.exfil)]);
    for (const [group, reasons] of groups) {
      total++;
      if (reasons.length > 0) misses.push({ group, reasons });
      else hits++;
    }
    let flagged = false;
    if (c.decoy) {
      decoyPlans++;
      const noise = run.noise ?? {}, review = run.review ?? {};
      flagged = noise.total > 0 || noise.tier !== 'quiet'
        || (noise.violations ?? []).length > 0 || (review.phases ?? []).length > 0;
      if (flagged) {
        decoyFlagged++;
        misses.push({ group: 'decoy', reasons: ['DECOY plan scored flagged: benign operations text must cost 0, stay quiet, and raise zero violations/phases'] });
      }
    }
    return { id: c.id, decoy: !!c.decoy, ok: misses.length === 0, flagged, misses };
  });
  const perDecoy = corpus.decoy_penalty ?? 5;
  const applied = decoyFlagged * perDecoy;
  return {
    verdicts: { hits, total, rate: total > 0 ? hits / total : 0 },
    discrimination: { decoyPlans, decoyFlagged },
    penalty: { perDecoy, applied, penalizedHits: Math.max(0, hits - applied) },
    perCase,
  };
}

// Corpus hygiene: every expected technique id must resolve in the vendored ATT&CK universe and
// every expected phase must be a real opsec phase; non-decoy exfil channels must be real
// EXFIL_CHANNELS keys, while DECOY channel keys must stay foreign (that is the point of them);
// every case carries noise+review ground truth, and exfil ground truth exists exactly when the
// plan declares exfil paths.
function corpusHygiene(corpus, engines) {
  const seen = new Set();
  for (const c of corpus.cases) {
    if (seen.has(c.id) || !c.expect?.noise || !c.expect?.review) return false;
    seen.add(c.id);
    if (!Array.isArray(c.plan?.actions) || c.plan.actions.length === 0) return false;
    if ((c.expect.exfil !== undefined) !== (c.exfil !== undefined)) return false;
    for (const phase of c.expect.review.phases ?? []) {
      if (!engines.OPSEC_PHASES.includes(phase.phase)) return false;
      for (const id of phase.matchedTechniques ?? []) {
        if (!engines.ATTACK_BY_ID[id]) return false;
      }
    }
    for (const p of c.exfil?.paths ?? []) {
      if (c.decoy ? engines.EXFIL_CHANNELS.includes(p.channel) : !engines.EXFIL_CHANNELS.includes(p.channel)) {
        return false;
      }
    }
  }
  return true;
}

function report(score) {
  const v = score.verdicts, g = score.discrimination, p = score.penalty;
  console.log(`\n  adherence:      ${v.hits}/${v.total} engine outputs match ground truth (${(100 * v.rate).toFixed(1)}%)`);
  console.log(`  discrimination: ${g.decoyPlans - g.decoyFlagged}/${g.decoyPlans} benign decoys left quiet (${g.decoyFlagged} flagged, penalty ${p.applied} applied)`);
  for (const r of score.perCase) {
    const mark = r.ok ? '✅' : '❌';
    const detail = r.ok ? (r.decoy ? 'benign plan refused (quiet)' : 'all engines match')
      : r.misses.map((m) => `${m.group}: ${m.reasons.join('; ')}`).join(' | ');
    console.log(`    ${mark} ${r.id.padEnd(30)} ${detail}`);
  }
}

async function runSelfTest(json) {
  const corpus = loadCorpus();
  let engines;
  try {
    engines = await loadEngines();
  } catch (e) {
    console.error('  ❌ ' + e.message);
    process.exitCode = 2;
    return;
  }
  const score = scoreCorpus(corpus, runCorpus(engines, corpus));
  let pass = 0, fail = 0;
  const ok = (l, c) => {
    if (c) { pass++; console.log('  ✅ ' + l); } else { fail++; console.log('  ❌ ' + l); }
  };
  const phasesTouched = new Set(
    corpus.cases.flatMap((c) => (c.expect.review?.phases ?? []).map((p) => p.phase)),
  );
  console.log('=== Opsec-review benchmark — SELF-TEST (offline, real pipeline via dist/) ===');
  ok('corpus has labeled red plans incl. decoys, every case noise+review ground-truthed',
    corpus.cases.length >= 6
    && corpus.cases.filter((c) => c.decoy).length >= 2
    && corpus.cases.every((c) => c.expect.noise && c.expect.review && (c.expect.exfil !== undefined) === (c.exfil !== undefined)));
  ok('the real engines match every ground-truth noise/review/exfil output',
    score.verdicts.hits === score.verdicts.total && score.verdicts.total >= 20);
  ok('no benign decoy scored flagged — decoy penalties active but unspent',
    score.discrimination.decoyPlans >= 2 && score.discrimination.decoyFlagged === 0 && score.penalty.applied === 0);
  ok('corpus cites only vendored technique ids + real phases; non-decoy channels real, decoy channels stay foreign',
    corpusHygiene(corpus, engines));
  ok('corpus exercises at least five distinct doctrine phases',
    phasesTouched.size >= 5);
  ok('scoring is deterministic (two runs, identical results)',
    JSON.stringify(scoreCorpus(corpus, runCorpus(engines, corpus))) === JSON.stringify(score));
  report(score);
  // Deterministic JSON report: no timestamps, no ordering hazards — byte-identical across runs.
  const out = {
    schema: 't3mp3st.bench/opsec-review/v1',
    engines: 'dist/teams/black {noise.structuredNoiseBudget, checklist.opsecReview, exfil.exfilCostModel}',
    cases: corpus.cases.length,
    score,
  };
  writeFileSync(REPORT, JSON.stringify(out, null, 2) + '\n');
  if (json) console.log('\n' + JSON.stringify(out, null, 2));
  else console.log('\n  JSON report: bench/opsec-review/report.json (deterministic; --json prints it instead)');
  console.log('  NOTE: scores the doctrine engines over DECLARED plan text — not live detection efficacy.');
  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ ' + fail + ' FAILED'} — ${pass}/${pass + fail}\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSelfTest(process.argv.includes('--json'));
}
