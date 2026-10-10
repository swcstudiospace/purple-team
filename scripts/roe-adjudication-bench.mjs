#!/usr/bin/env node
// roe-adjudication-bench.mjs — the White loadout's ROE-adjudication benchmark.
//
// Scores the REAL white pipeline (dist/teams/white: the ROE parser, the receipt-ledger
// evidence-chain validator, and the findings↔evidence report auditor — plus the v1 roeAudit
// the parsed spec feeds) against a committed corpus of missions with KNOWN ground-truth
// verdicts. Four scored axes per mission, present exactly when the mission declares the input:
//   • parsing       — ok/commentLines/counted comments, the structured RoeSpec, every resolved
//                     directive (field, line, normalized value), every unresolved line with its
//                     EXACT reason, and the one-line summary
//   • adjudication  — v1 roeAudit verdicts over the PARSED spec (compliant / violation /
//                     needs_approval per action); declared only for missions whose text parses ok
//   • chain         — evidence-chain audit: intact/broken counts plus per-entry status and the
//                     platform verdict (accepted / insufficient)
//   • report        — report auditor: report-ready vs coverage-gap findings, the exact gap and
//                     condition strings, and ledger evidence no finding claims
//   • discrimination — DECOY missions of fully BENIGN approved work (aggressive-sounding tooling
//                     under a signed ROE, receipts attached) must adjudicate ALL GREEN: parsed ok,
//                     compliant verdicts, intact chain, report-ready, nothing unclaimed. A naive
//                     keyword matcher flags the "nmap"/"drill" wording; the real engines rule by
//                     structure — parsed spec, provenance strength, and replay hooks
//
// HONEST SCOPE: this measures the deterministic adjudication engines over DECLARED mission text —
// not whether a live engagement would stay inside its ROE. The number is directional (small
// corpus, pure functions, no I/O, no LLM). The default run (`--self-test`) is deterministic: same
// corpus, same dist build → byte-identical report.json. A live-server mode scoring a running
// instance's ledgers is deferred until the white routes accept mission inputs — there is no
// --live here, and shipping one that fakes it would be worse than none.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, '..', 'bench', 'roe-adjudication', 'corpus.json');
const REPORT = path.join(HERE, '..', 'bench', 'roe-adjudication', 'report.json');

export function loadCorpus() {
  return JSON.parse(readFileSync(CORPUS, 'utf8'));
}

// Load the engines from the built dist/ output — the real pipeline, never a vendored copy.
// Missing dist means the caller must build first; the error says exactly that.
export async function loadEngines() {
  const white = path.join(HERE, '..', 'dist', 'teams', 'white');
  try {
    const [parser, chain, auditor, v1] = await Promise.all([
      import(pathToFileURL(path.join(white, 'roe-parser.js')).href),
      import(pathToFileURL(path.join(white, 'evidence-chain.js')).href),
      import(pathToFileURL(path.join(white, 'report-auditor.js')).href),
      // v1 white.ts compiles to dist/teams/white.js — a SIBLING of the v2 module directory.
      import(pathToFileURL(path.join(HERE, '..', 'dist', 'teams', 'white.js')).href),
    ]);
    return {
      parseRoe: parser.parseRoe,
      roeAudit: v1.roeAudit,
      auditEvidenceChain: chain.auditEvidenceChain,
      auditReport: auditor.auditReport,
    };
  } catch {
    throw new Error('white pipeline not found under dist/teams/white — run `npm run build` (tsc) first');
  }
}

// Run the real engines over every corpus mission, mapping case id → {parse, adjudication?, chain?, report?}.
export function runCorpus(engines, corpus) {
  const runs = {};
  for (const c of corpus.cases) {
    const parse = engines.parseRoe(c.roe ?? '');
    runs[c.id] = { parse };
    if (c.actions !== undefined) runs[c.id].adjudication = engines.roeAudit(c.actions, parse.roe);
    if (c.evidence !== undefined) runs[c.id].chain = engines.auditEvidenceChain(c.evidence);
    if (c.findings !== undefined) runs[c.id].report = engines.auditReport(c.findings, c.evidence ?? []);
  }
  return runs;
}

// Ground-truth the parser: ok/commentCounts, the structured spec, every resolved directive
// (field, line, normalized value) and every unresolved line with its exact reason, in source order.
function parseMisses(run, exp) {
  const reasons = [];
  if (run.ok !== exp.ok) reasons.push(`ok ${run.ok} != expected ${exp.ok}`);
  if (run.commentLines !== exp.commentLines) reasons.push(`commentLines ${run.commentLines} != expected ${exp.commentLines}`);
  const gotTargets = JSON.stringify(run.roe.allowedTargets ?? null);
  if (gotTargets !== JSON.stringify(exp.allowedTargets ?? null)) {
    reasons.push(`allowedTargets ${gotTargets} != expected ${JSON.stringify(exp.allowedTargets ?? null)}`);
  }
  if ((run.roe.allowActive ?? null) !== (exp.allowActive ?? null)) {
    reasons.push(`allowActive ${JSON.stringify(run.roe.allowActive ?? null)} != expected ${JSON.stringify(exp.allowActive ?? null)}`);
  }
  const resolvedKey = (r) => `${r.field}@${r.line}=${r.value}`;
  const gotResolved = run.resolved.map(resolvedKey);
  const wantResolved = (exp.resolved ?? []).map(resolvedKey);
  if (gotResolved.length !== wantResolved.length || gotResolved.some((k, i) => k !== wantResolved[i])) {
    reasons.push(`resolved [${gotResolved.join(' | ')}] != expected [${wantResolved.join(' | ')}]`);
  }
  const issueKey = (u) => `${u.line}:${u.reason}`;
  const gotIssues = run.unresolved.map(issueKey);
  const wantIssues = (exp.unresolved ?? []).map(issueKey);
  if (gotIssues.length !== wantIssues.length || gotIssues.some((k, i) => k !== wantIssues[i])) {
    reasons.push(`unresolved [${gotIssues.join(' | ')}] != expected [${wantIssues.join(' | ')}]`);
  }
  if (run.summary !== exp.summary) reasons.push(`summary '${run.summary}' != expected '${exp.summary}'`);
  return reasons;
}

// Ground-truth the v1 adjudication: one verdict per declared action, in action order.
function adjudicationMisses(run, exp) {
  const got = run.map((v) => `${v.actionIndex}:${v.verdict}`);
  const want = exp.map((v) => `${v.actionIndex}:${v.verdict}`);
  if (got.length !== want.length || got.some((k, i) => k !== want[i])) {
    return [`verdicts [${got.join(' | ')}] != expected [${want.join(' | ')}]`];
  }
  return [];
}

// Ground-truth the evidence chain: exact intact/broken counts plus per-entry status and platform
// verdict, in ledger order (duplicates keep their ledger position — that IS the defect).
function chainMisses(run, exp) {
  const reasons = [];
  if (run.intact !== exp.intact) reasons.push(`intact ${run.intact} != expected ${exp.intact}`);
  if (run.broken !== exp.broken) reasons.push(`broken ${run.broken} != expected ${exp.broken}`);
  const linkKey = (l) => `${l.evidenceId}:${l.status}:${l.verdict}`;
  const got = run.links.map(linkKey);
  const want = (exp.links ?? []).map(linkKey);
  if (got.length !== want.length || got.some((k, i) => k !== want[i])) {
    reasons.push(`links [${got.join(' | ')}] != expected [${want.join(' | ')}]`);
  }
  return reasons;
}

// Ground-truth the report audit: ready/gap counts, per-finding status with the exact gap and
// condition strings, and the unclaimed-evidence list with its exact reasons.
function reportMisses(run, exp) {
  const reasons = [];
  if (run.reportReady !== exp.reportReady) reasons.push(`reportReady ${run.reportReady} != expected ${exp.reportReady}`);
  if (run.withGaps !== exp.withGaps) reasons.push(`withGaps ${run.withGaps} != expected ${exp.withGaps}`);
  const findingKey = (f) => `${f.findingId}:${f.status}|gaps[${f.gaps.join(' ; ')}]|cond[${f.conditions.join(' ; ')}]`;
  const gotFindings = run.findings.map(findingKey);
  const wantFindings = (exp.findings ?? []).map(findingKey);
  if (gotFindings.length !== wantFindings.length || gotFindings.some((k, i) => k !== wantFindings[i])) {
    reasons.push(`findings [${gotFindings.join(' | ')}] != expected [${wantFindings.join(' | ')}]`);
  }
  const unclaimedKey = (u) => `${u.evidenceId}:${u.reason}`;
  const gotUnclaimed = run.unclaimedEvidence.map(unclaimedKey);
  const wantUnclaimed = (exp.unclaimed ?? []).map(unclaimedKey);
  if (gotUnclaimed.length !== wantUnclaimed.length || gotUnclaimed.some((k, i) => k !== wantUnclaimed[i])) {
    reasons.push(`unclaimed [${gotUnclaimed.join(' | ')}] != expected [${wantUnclaimed.join(' | ')}]`);
  }
  return reasons;
}

// Score engine runs against the corpus ground truth, one expectation group per axis per mission;
// decoy missions additionally must adjudicate ALL GREEN (each flagged decoy accrues the penalty).
export function scoreCorpus(corpus, runs) {
  let hits = 0, total = 0, decoyMissions = 0, decoyFlagged = 0;
  const perCase = corpus.cases.map((c) => {
    const run = runs[c.id] ?? {};
    const misses = [];
    const groups = [];
    if (c.expect.parse) groups.push(['parse', parseMisses(run.parse ?? { roe: {}, resolved: [], unresolved: [] }, c.expect.parse)]);
    if (c.expect.adjudication) groups.push(['adjudication', adjudicationMisses(run.adjudication ?? [], c.expect.adjudication)]);
    if (c.expect.chain) groups.push(['chain', chainMisses(run.chain ?? { links: [] }, c.expect.chain)]);
    if (c.expect.report) groups.push(['report', reportMisses(run.report ?? { findings: [], unclaimedEvidence: [] }, c.expect.report)]);
    for (const [group, reasons] of groups) {
      total++;
      if (reasons.length > 0) misses.push({ group, reasons });
      else hits++;
    }
    let flagged = false;
    if (c.decoy) {
      decoyMissions++;
      const parse = run.parse ?? {}, chain = run.chain ?? {}, rep = run.report ?? {};
      flagged = parse.ok !== true || (parse.unresolved ?? []).length > 0
        || (run.adjudication ?? []).some((v) => v.verdict !== 'compliant')
        || (chain.broken ?? 0) > 0
        || (rep.withGaps ?? 0) > 0 || (rep.unclaimedEvidence ?? []).length > 0;
      if (flagged) {
        decoyFlagged++;
        misses.push({ group: 'decoy', reasons: ['DECOY mission scored flagged: benign approved work must parse clean, adjudicate compliant, keep an intact chain, and ship report-ready — never be talked into a violation'] });
      }
    }
    return { id: c.id, decoy: !!c.decoy, ok: misses.length === 0, flagged, misses };
  });
  const perDecoy = corpus.decoy_penalty ?? 5;
  const applied = decoyFlagged * perDecoy;
  return {
    verdicts: { hits, total, rate: total > 0 ? hits / total : 0 },
    discrimination: { decoyMissions, decoyFlagged },
    penalty: { perDecoy, applied, penalizedHits: Math.max(0, hits - applied) },
    perCase,
  };
}

// Corpus hygiene: ids unique, every mission parse-ground-truthed, expectation groups present
// exactly when the matching input is declared, adjudication only on ok parses with a full
// actionIndex sequence, verdicts/severities from the closed platform sets, chain ground truth
// mirrors the ledger entry-for-entry, report ground truth mirrors the findings, and decoys are
// all-green BY CONSTRUCTION while every non-decoy mission carries at least one red expectation.
function corpusHygiene(corpus) {
  const VERDICTS = new Set(['compliant', 'violation', 'needs_approval']);
  const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
  const seen = new Set();
  for (const c of corpus.cases) {
    if (seen.has(c.id) || !c.expect?.parse) return false;
    seen.add(c.id);
    if ((c.expect.adjudication !== undefined) !== (c.actions !== undefined)) return false;
    if ((c.expect.chain !== undefined) !== (c.evidence !== undefined)) return false;
    if ((c.expect.report !== undefined) !== (c.findings !== undefined)) return false;
    if (c.actions !== undefined) {
      if (c.expect.parse.ok !== true) return false; // never adjudicate against a partial spec
      if (c.expect.adjudication.length !== c.actions.length) return false;
      for (const [i, v] of c.expect.adjudication.entries()) {
        if (v.actionIndex !== i || !VERDICTS.has(v.verdict)) return false;
      }
    }
    if (c.evidence !== undefined && (c.expect.chain.links ?? []).length !== c.evidence.length) return false;
    if (c.findings !== undefined) {
      if ((c.expect.report.findings ?? []).length !== c.findings.length) return false;
      for (const f of c.findings) {
        if (!SEVERITIES.has(f.severity)) return false;
      }
      for (const f of c.expect.report.findings ?? []) {
        if (!c.findings.some((got) => got.id === f.findingId)) return false;
      }
    }
    const allGreen = c.expect.parse.ok === true && (c.expect.parse.unresolved ?? []).length === 0
      && (c.expect.adjudication ?? []).every((v) => v.verdict === 'compliant')
      && (c.expect.chain?.broken ?? 0) === 0
      && (c.expect.report?.withGaps ?? 0) === 0 && (c.expect.report?.unclaimed ?? []).length === 0;
    if (c.decoy ? !allGreen : allGreen) return false;
  }
  return true;
}

function report(score) {
  const v = score.verdicts, g = score.discrimination, p = score.penalty;
  console.log(`\n  adjudication:   ${v.hits}/${v.total} engine outputs match ground truth (${(100 * v.rate).toFixed(1)}%)`);
  console.log(`  discrimination: ${g.decoyMissions - g.decoyFlagged}/${g.decoyMissions} benign decoys left all-green (${g.decoyFlagged} flagged, penalty ${p.applied} applied)`);
  for (const r of score.perCase) {
    const mark = r.ok ? '✅' : '❌';
    const detail = r.ok ? (r.decoy ? 'benign mission refused (all green)' : 'all engines match')
      : r.misses.map((m) => `${m.group}: ${m.reasons.join('; ')}`).join(' | ');
    console.log(`    ${mark} ${r.id.padEnd(32)} ${detail}`);
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
  const refusedParses = corpus.cases.filter((c) => c.expect.parse.ok === false).length;
  const brokenLinks = corpus.cases.flatMap((c) => c.expect.chain?.links ?? []).filter((l) => l.status === 'broken').length;
  const gapFindings = corpus.cases.flatMap((c) => c.expect.report?.findings ?? []).filter((f) => f.status === 'coverage_gaps').length;
  const verdictKinds = new Set(corpus.cases.flatMap((c) => (c.expect.adjudication ?? []).map((v) => v.verdict)));
  console.log('=== Roe-adjudication benchmark — SELF-TEST (offline, real pipeline via dist/) ===');
  ok('corpus has labeled missions incl. decoys, every mission parse-ground-truthed, groups paired with inputs',
    corpus.cases.length >= 6
    && corpus.cases.filter((c) => c.decoy).length >= 2
    && corpus.cases.every((c) => c.expect.parse
      && (c.expect.adjudication !== undefined) === (c.actions !== undefined)
      && (c.expect.chain !== undefined) === (c.evidence !== undefined)
      && (c.expect.report !== undefined) === (c.findings !== undefined)));
  ok('the real engines match every ground-truth parse/adjudication/chain/report output',
    score.verdicts.hits === score.verdicts.total && score.verdicts.total >= 24);
  ok('no benign decoy scored flagged — decoy penalties active but unspent',
    score.discrimination.decoyMissions >= 2 && score.discrimination.decoyFlagged === 0 && score.penalty.applied === 0);
  ok('corpus hygiene: ids unique, adjudication only on ok parses, verdicts/severities legal, decoys green by construction, non-decoys carry red expectations',
    corpusHygiene(corpus));
  ok('corpus exercises the honesty axes: refused parses, broken links, coverage gaps, all three verdicts',
    refusedParses >= 5 && brokenLinks >= 3 && gapFindings >= 2
    && verdictKinds.has('violation') && verdictKinds.has('needs_approval') && verdictKinds.has('compliant'));
  ok('scoring is deterministic (two runs, identical results)',
    JSON.stringify(scoreCorpus(corpus, runCorpus(engines, corpus))) === JSON.stringify(score));
  report(score);
  // Deterministic JSON report: no timestamps, no ordering hazards — byte-identical across runs.
  const out = {
    schema: 't3mp3st.bench/roe-adjudication/v1',
    engines: 'dist/teams/white {roe-parser.parseRoe, white.roeAudit, evidence-chain.auditEvidenceChain, report-auditor.auditReport}',
    cases: corpus.cases.length,
    score,
  };
  writeFileSync(REPORT, JSON.stringify(out, null, 2) + '\n');
  if (json) console.log('\n' + JSON.stringify(out, null, 2));
  else console.log('\n  JSON report: bench/roe-adjudication/report.json (deterministic; --json prints it instead)');
  console.log('  NOTE: scores the adjudication engines over DECLARED mission text — not live engagement compliance.');
  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ ' + fail + ' FAILED'} — ${pass}/${pass + fail}\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSelfTest(process.argv.includes('--json'));
}
