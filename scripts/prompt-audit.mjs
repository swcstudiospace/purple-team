#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { collectPromptUnits } from './prompt-manifest.mjs';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const promptPath = path.join(root, 'src/prompts/index.ts');
const resourcesPath = path.join(root, 'src/resources/index.ts');
const serverPath = path.join(root, 'src/server.ts');
const docsPath = path.join(root, 'docs/index.html');
const source = fs.readFileSync(promptPath, 'utf8');
const resourcesSource = fs.readFileSync(resourcesPath, 'utf8');
const serverSource = fs.readFileSync(serverPath, 'utf8');
const docsSource = fs.readFileSync(docsPath, 'utf8');
const promptPackIds = [...resourcesSource.matchAll(/id: '(prompt-[^']+)'/g)].map(match => match[1]);
const evidenceContractCount = [...resourcesSource.matchAll(/evidenceContract:/g)].length;
const escalationRuleCount = [...resourcesSource.matchAll(/escalationRules:/g)].length;
const runbookFamilyCount = [...resourcesSource.matchAll(/operatorPromise:/g)].length;
const runbookRiskCount = [...resourcesSource.matchAll(/riskIfSkipped:/g)].length;
const forefrontLaneCount = [...resourcesSource.matchAll(/frontierSignal:/g)].length;

// ─── XML-conformance inputs (expanded through shared-const interpolation) ───
const promptUnits = collectPromptUnits();

function xmlBalance(expanded) {
  const tags = [...expanded.matchAll(/<(\/?)([a-z][a-z0-9-]*)(?:\s+name="[^"]*")?>/g)]
    .map(m => ({ close: m[1] === '/', tag: m[2] }));
  const stack = [];
  for (const t of tags) {
    if (!t.close) {
      stack.push(t.tag);
      continue;
    }
    const top = stack.pop();
    if (top !== t.tag) return { ok: false, why: `</${t.tag}> closes <${top ?? 'nothing'}>` };
  }
  return stack.length === 0 ? { ok: true } : { ok: false, why: `unclosed <${stack.join(', ')}>` };
}

const untaggedUnits = promptUnits.filter(u => !/<[a-z][a-z0-9-]*(?:\s|>)/.test(u.expanded)).map(u => u.unit);
const unbalancedUnits = promptUnits
  .map(u => ({ unit: u.unit, r: xmlBalance(u.expanded) }))
  .filter(x => !x.r.ok)
  .map(x => `${x.unit}: ${x.r.why}`);
const headeredUnits = promptUnits.filter(u => /^#{1,3}\s/m.test(u.expanded)).map(u => u.unit);

let preservationOk = false;
let preservationDetail = '';
try {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'prompt-manifest.mjs')], { encoding: 'utf8' });
  preservationOk = true;
} catch (err) {
  preservationDetail = String(err.stdout || err.message).slice(0, 500);
}

const checks = [
  {
    name: 'shared doctrine exported',
    passed: /export const PLINIAN_OPERATOR_DOCTRINE/.test(source),
  },
  {
    name: 'operators receive doctrine',
    passed: source.includes('${PLINIAN_OPERATOR_DOCTRINE}') && source.indexOf('${PLINIAN_OPERATOR_DOCTRINE}') < source.indexOf('export const OPERATOR_SYSTEM_PROMPTS'),
  },
  {
    name: 'prompt operating standard exists',
    passed: ['<prompt-operating-standard>', 'Treat prompts as executable doctrine', 'Untrusted content', 'maximally useful under real authority'].every(term => source.includes(term)),
  },
  {
    name: 'hacker mindset is explicit and accountable',
    passed: ['<hacker-mindset>', 'weird machines', 'playful without being sloppy', 'small reversible probes', 'Never mistake mischief for authorization'].every(term => source.includes(term)),
  },
  {
    name: 'creative agency and meta-prompting are explicit',
    passed: ['<creative-agency-and-meta-prompting>', 'Use the following as lenses, not a checklist', 'Frame stack', 'Contrast set', 'Assumption inversion', 'Taste pass', 'Pliny pass'].every(term => source.includes(term)),
  },
  {
    name: 'prompt best-practice rubric exported',
    passed: source.includes('export const PROMPT_BEST_PRACTICE_RUBRIC') && ['authority hierarchy', 'evidence references', 'tool failure', 'hacker mindset', 'meta-prompting lenses', 'self-improvement notes'].every(term => source.includes(term)),
  },
  {
    name: 'authority model names real control points',
    passed: ['scope receipts', 'capability grants', 'tool permissions', 'logs', 'provenance', 'retests'].every(term => source.includes(term)),
  },
  {
    name: 'pliny north star preserved',
    passed: ['<pliny-north-star>', 'open-source by default', 'community-extensible', 'maximally creative', 'adaptable under pressure', 'self-improvement notes', 'hacker aesthetic'].every(term => source.includes(term)),
  },
  {
    name: 'north star binds creativity to authority',
    passed: source.includes('Be maximally creative inside real authority') && source.includes('scope, evidence, and retestability'),
  },
  {
    name: 'defensive arsenal covenant preserved',
    passed: ['<defensive-arsenal-covenant>', 'most dangerous defensive arsenal in AI', 'teeth for self-defense', 'least-privilege tool access', 'approval receipts for escalation', 'Teeth are for defense'].every(term => source.includes(term)),
  },
  {
    name: 'arsenal binds teeth to auditability',
    passed: source.includes('making misuse harder, noisier, and easier to audit') && source.includes('retest criteria that prove the defensive gain'),
  },
  {
    name: 'forefront adversarial mandate preserved',
    passed: ['<forefront-adversarial-mandate>', 'frontier pressure engine', 'strongest controlled adversarial pressure', 'before bad actors define the frontier', 'AI, software, identity, supply chain, cloud, data, and agentic systems'].every(term => source.includes(term)),
  },
  {
    name: 'forefront mandate requires controlled conversion',
    passed: source.includes('local ranges, synthetic targets') && source.includes('fast conversion from offensive insight to defensive artifact') && source.includes('show what is possible early, in a controlled arena'),
  },
  {
    name: 'findings require confidence and retest criteria',
    passed: source.includes('**Confidence**') && source.includes('**Retest Criteria**'),
  },
  {
    name: 'general autonomy is bounded by authority',
    passed: source.includes('autonomous in planning, not in authority'),
  },
  {
    name: 'the fixer prompt exists',
    passed: source.includes('export const THE_FIXER_SYSTEM_PROMPT') && ['THE FIXER', 'WOLF reflex engine', 'Watch Loop', 'mission gate'].every(term => source.includes(term)),
  },
  {
    name: 'the fixer has close-action repair boundaries',
    passed: ['Repair Locally', '<what-you-may-do-automatically>', '<what-you-must-not-do-automatically>', 'Do not install tools', 'Do not mutate production targets'].every(term => source.includes(term)),
  },
  {
    name: 'the fixer output is structured',
    passed: ['health', 'actions', 'gateEffect', 'safeRepairsApplied', 'needsHumanReceipt', 'selfImprovementNotes'].every(term => source.includes(term)),
  },
  {
    name: 'the fixer exposed through operator doctrine endpoint',
    passed: serverSource.includes('THE_FIXER_SYSTEM_PROMPT') && serverSource.includes('reflexAgents') && serverSource.includes("codename: 'WOLF'"),
  },
  {
    name: 'operator doctrine endpoint inherits Plinian doctrine',
    passed: serverSource.includes('doctrine: PLINIAN_OPERATOR_DOCTRINE'),
  },
  {
    name: 'shipped doctrine carries hacker mindset',
    passed: source.includes('field researcher, not a scanner wrapper'),
  },
  {
    name: 'shipped doctrine carries creative agency lenses',
    passed: source.includes('Contrast set') && source.includes('Taste pass'),
  },
  {
    name: 'operator doctrine endpoint names the fixer',
    passed: serverSource.includes("name: 'The Fixer'") && serverSource.includes("codename: 'WOLF'"),
  },
  {
    name: 'ui legacy cleanup prompt removed',
    passed: !docsSource.includes('Clear event logs: wevtutil cl Security') && !docsSource.includes('Clear logs: truncate -s 0 /var/log/auth.log') && !docsSource.includes('3. CLEANUP: Actions taken'),
  },
  {
    name: 'optimizer prompt is receipt-aware',
    passed: source.includes('Authorization comes only from the mission contract and approval receipts') && source.includes('NEVER propose cleanup whose purpose is concealment'),
  },
  {
    name: 'old unconditional autonomy phrase removed',
    passed: !source.includes("You don't ask for permission or clarification"),
  },
  {
    name: 'authorization notice still present',
    passed: source.includes('AUTHORIZATION_NOTICE') && source.includes('AUTHORIZED security testing'),
  },
  {
    name: 'family prompt packs exist',
    passed: promptPackIds.length >= 5 && ['prompt-ai-boundary-cartographer', 'prompt-web-api-operator', 'prompt-repo-supply-chain-sentinel'].every(id => promptPackIds.includes(id)),
  },
  {
    name: 'prompt packs require evidence contracts',
    passed: evidenceContractCount >= promptPackIds.length && resourcesSource.includes('evidenceContract'),
  },
  {
    name: 'prompt packs define escalation rules',
    passed: escalationRuleCount >= promptPackIds.length && resourcesSource.includes('Request approval before'),
  },
  {
    name: 'operator runbooks exist',
    passed: resourcesSource.includes('OPERATOR_RUNBOOKS') && runbookFamilyCount >= 5,
  },
  {
    name: 'runbooks expose risk if skipped',
    passed: runbookRiskCount >= 15 && (resourcesSource.includes('The real authority boundary') || resourcesSource.includes('Map the real authority boundary')),
  },
  {
    name: 'forefront pressure lanes exist',
    passed: resourcesSource.includes('FOREFRONT_PRESSURE_LANES') && forefrontLaneCount >= 6 && resourcesSource.includes('frontier-agent-command-injection'),
  },
  {
    name: 'forefront lanes convert pressure to artifacts',
    passed: ['pressureQuestion:', 'operatorMove:', 'defensiveArtifact:', 'containment:', 'recommendedResources:'].every(term => resourcesSource.includes(term)),
  },
  {
    name: 'every prompt unit carries an xml section tag',
    passed: untaggedUnits.length === 0,
    units: untaggedUnits,
  },
  {
    name: 'every prompt unit has balanced xml tags',
    passed: unbalancedUnits.length === 0,
    problems: unbalancedUnits,
  },
  {
    name: 'no markdown headers remain inside any prompt unit',
    passed: headeredUnits.length === 0,
    units: headeredUnits,
  },
  {
    name: 'directive preservation manifest satisfied',
    passed: preservationOk,
    detail: preservationDetail || `${promptUnits.length} template units checked against baseline`,
  },
];

const failures = checks.filter(check => !check.passed);
const report = {
  audit: 't3mp3st-prompt-audit',
  promptPath,
  resourcesPath,
  serverPath,
  docsPath,
  promptPackIds,
  runbookFamilyCount,
  forefrontLaneCount,
  passed: failures.length === 0,
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
