#!/usr/bin/env node
// detection-coverage-bench.mjs — the Blue loadout's detection-coverage benchmark.
//
// Scores the REAL blue pipeline (dist/teams/blue/coverage.js, the D3FEND-keyed coverage scorer)
// against a committed corpus of labeled finding/telemetry pairs with KNOWN ground-truth verdicts.
// Two axes:
//   • coverage       — per-finding verdicts (covered/partial/none) plus the exact uncovered and
//                      unresolvable countermeasure-id sets must equal ground truth
//   • discrimination — decoy findings with WRONG countermeasure keys (invented ids, or real ids
//                      from the wrong countermeasure family) must NOT score covered, and invented
//                      ids must surface as unresolvedCountermeasures — never silently used
//
// HONEST SCOPE: this measures the keyed coverage reasoner over DECLARED telemetry — not whether
// deployed sensors would actually fire in production. The number is directional (small corpus,
// pure functions, no I/O, no LLM). The default run (`--self-test`) is deterministic: same corpus,
// same dist build → byte-identical report.json. A live-server mode scoring a running instance's
// ledger is deferred until the blue routes accept case inputs — there is no --live here, and
// shipping one that fakes it would be worse than none.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, '..', 'bench', 'detection-coverage', 'corpus.json');
const REPORT = path.join(HERE, '..', 'bench', 'detection-coverage', 'report.json');

export function loadCorpus() {
  return JSON.parse(readFileSync(CORPUS, 'utf8'));
}

// Load the hunter from the built dist/ output — the real pipeline, never a vendored copy.
// Missing dist means the caller must build first; the error says exactly that.
export async function loadHunter() {
  const blue = path.join(HERE, '..', 'dist', 'teams', 'blue');
  try {
    const [coverage, d3fend, telemetry] = await Promise.all([
      import(pathToFileURL(path.join(blue, 'coverage.js')).href),
      import(pathToFileURL(path.join(blue, 'd3fend.js')).href),
      import(pathToFileURL(path.join(blue, 'telemetry.js')).href),
    ]);
    return {
      coverageGaps: coverage.coverageGaps,
      D3FEND_BY_ID: d3fend.D3FEND_BY_ID,
      TELEMETRY_BY_SOURCE: telemetry.TELEMETRY_BY_SOURCE,
    };
  } catch {
    throw new Error('blue pipeline not found under dist/teams/blue — run `npm run build` (tsc) first');
  }
}

// Run the real coverage scorer over every corpus case, mapping case id → CoverageGap[].
export function huntCorpus(hunter, corpus) {
  const byCase = {};
  for (const c of corpus.cases) {
    byCase[c.id] = hunter.coverageGaps(c.findings, c.telemetry);
  }
  return byCase;
}

// Score hunted gaps against the corpus ground truth: verdict + uncovered/unresolved id sets per
// finding; decoys additionally must never score covered (each miss accrues the decoy penalty).
export function scoreCorpus(corpus, byCase) {
  const sameSet = (a, b) => {
    if (a.length !== b.length) return false;
    const want = [...a].sort();
    const got = [...b].sort();
    return want.every((id, i) => got[i] === id);
  };
  let hits = 0, total = 0, decoyFindings = 0, decoyCovered = 0;
  const perCase = corpus.cases.map((c) => {
    const gapById = new Map((byCase[c.id] || []).map((g) => [g.findingId, g]));
    const misses = [];
    for (const f of c.findings) {
      total++;
      const exp = (c.expect || {})[f.id];
      const gap = gapById.get(f.id);
      const reasons = [];
      if (!exp) reasons.push('no ground truth for finding');
      if (!gap) reasons.push('pipeline emitted no gap');
      if (exp && gap) {
        if (gap.coverage !== exp.coverage) {
          reasons.push(`coverage '${gap.coverage}' != expected '${exp.coverage}'`);
        }
        if (!sameSet(gap.uncoveredCountermeasures, exp.uncovered || [])) {
          reasons.push(`uncovered [${gap.uncoveredCountermeasures.join(',')}] != expected [${(exp.uncovered || []).join(',')}]`);
        }
        if (exp.unresolved && !sameSet(gap.unresolvedCountermeasures, exp.unresolved)) {
          reasons.push(`unresolved [${gap.unresolvedCountermeasures.join(',')}] != expected [${exp.unresolved.join(',')}]`);
        }
        if (c.decoy && gap.coverage === 'covered') {
          reasons.push('DECOY scored covered');
          decoyCovered++;
        }
      }
      if (c.decoy) decoyFindings++;
      if (reasons.length > 0) misses.push({ findingId: f.id, reasons });
      else hits++;
    }
    return { id: c.id, decoy: !!c.decoy, ok: misses.length === 0, misses };
  });
  const perDecoy = corpus.decoy_penalty ?? 5;
  const applied = decoyCovered * perDecoy;
  return {
    coverage: { hits, total, rate: total > 0 ? hits / total : 0 },
    discrimination: { decoyFindings, decoyCovered },
    penalty: { perDecoy, applied, penalizedHits: Math.max(0, hits - applied) },
    perCase,
  };
}

// Corpus hygiene: every countermeasure id cited must resolve in the vendored ontology EXCEPT ids
// the ground truth itself declares unresolved (decoys, honesty probes); every telemetry source
// slug must be a real TELEMETRY_REGISTRY entry.
function corpusHygiene(corpus, hunter) {
  for (const c of corpus.cases) {
    for (const t of c.telemetry || []) {
      if (!hunter.TELEMETRY_BY_SOURCE[t.source]) return false;
    }
    const expectedUnresolved = new Set(
      Object.values(c.expect || {}).flatMap((e) => e.unresolved || []),
    );
    for (const f of c.findings || []) {
      for (const id of f.countermeasures || []) {
        if (!hunter.D3FEND_BY_ID[id] && !expectedUnresolved.has(id)) return false;
      }
    }
  }
  return true;
}

function report(score) {
  const d = score.coverage, g = score.discrimination, p = score.penalty;
  console.log(`\n  coverage:       ${d.hits}/${d.total} ground-truth verdicts matched (${(100 * d.rate).toFixed(1)}%)`);
  console.log(`  discrimination: ${g.decoyFindings - g.decoyCovered}/${g.decoyFindings} decoys refused (${g.decoyCovered} scored covered, penalty ${p.applied} applied)`);
  for (const r of score.perCase) {
    const mark = r.ok ? '✅' : '❌';
    const detail = r.ok ? (r.decoy ? 'decoy refused' : 'all verdicts match')
      : r.misses.map((m) => `${m.findingId}: ${m.reasons.join('; ')}`).join(' | ');
    console.log(`    ${mark} ${r.id.padEnd(34)} ${detail}`);
  }
}

async function runSelfTest(json) {
  const corpus = loadCorpus();
  let hunter;
  try {
    hunter = await loadHunter();
  } catch (e) {
    console.error('  ❌ ' + e.message);
    process.exitCode = 2;
    return;
  }
  const score = scoreCorpus(corpus, huntCorpus(hunter, corpus));
  let pass = 0, fail = 0;
  const ok = (l, c) => {
    if (c) { pass++; console.log('  ✅ ' + l); } else { fail++; console.log('  ❌ ' + l); }
  };
  console.log('=== Detection-coverage benchmark — SELF-TEST (offline, real pipeline via dist/) ===');
  ok('corpus has labeled cases incl. decoys, every finding ground-truthed',
    corpus.cases.length >= 6
    && corpus.cases.filter((c) => c.decoy).length >= 2
    && corpus.cases.every((c) => c.findings.every((f) => (c.expect || {})[f.id])));
  ok('the real pipeline matches every ground-truth verdict + uncovered-id set',
    score.coverage.hits === score.coverage.total);
  ok('no decoy scored covered — decoy penalties active but unspent',
    score.discrimination.decoyCovered === 0 && score.discrimination.decoyFindings >= 2);
  ok('corpus cites only real ontology ids + registry telemetry slugs (ground-truthed unresolved excepted)',
    corpusHygiene(corpus, hunter));
  report(score);
  // Deterministic JSON report: no timestamps, no ordering hazards — byte-identical across runs.
  const out = {
    schema: 't3mp3st.bench/detection-coverage/v1',
    hunter: 'dist/teams/blue/coverage.js coverageGaps',
    cases: corpus.cases.length,
    score,
  };
  writeFileSync(REPORT, JSON.stringify(out, null, 2) + '\n');
  if (json) console.log('\n' + JSON.stringify(out, null, 2));
  else console.log('\n  JSON report: bench/detection-coverage/report.json (deterministic; --json prints it instead)');
  console.log('  NOTE: scores the keyed coverage reasoner over DECLARED telemetry — not live sensor efficacy.');
  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ ' + fail + ' FAILED'} — ${pass}/${pass + fail}\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSelfTest(process.argv.includes('--json'));
}
