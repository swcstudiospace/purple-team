#!/usr/bin/env node
// Prompt-unit extractor + preservation manifest for T3MP3ST.
//
// Modes:
//   node scripts/prompt-manifest.mjs --write   regenerate scripts/prompt-manifest.json (inventory time)
//   node scripts/prompt-manifest.mjs           verify current sources still contain every
//                                              baseline directive line (preservation lint)
//
// A "prompt unit" is one template-literal-backed exported prompt:
//   - export const NAME = `...`
//   - key: `...` members inside exported prompt objects
//   - export function NAME(...) { return `...` }
// Directive lines are extracted AFTER expanding ${SHARED_CONST} interpolations so that
// composed prompts (REACT_PREAMBLE, OPSEC_RULES, AUTHORIZATION_NOTICE,
// PLINIAN_OPERATOR_DOCTRINE) contribute their real content once, at the constant's unit.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const MANIFEST_PATH = path.join(root, 'scripts', 'prompt-manifest.json');

const SURFACES = [
  {
    file: 'src/prompts/index.ts',
    // every exported template unit in this file is a prompt
    include: () => true,
  },
  {
    file: 'src/orchestration/prompts.ts',
    include: () => true,
  },
  {
    file: 'src/resources/index.ts',
    // structured data: preserve quoted-string directive pools per export block
    quotedStrings: [
      'WORKFLOW_PRESETS',
      'FOREFRONT_PRESSURE_LANES',
      'RESOURCE_PACKS',
      'AGENT_PROMPT_PACKS',
      'OPERATOR_RUNBOOKS',
    ],
  },
];

// ---------------------------------------------------------------------------
// Template-literal extraction (escape-aware, no TS dependency)
// ---------------------------------------------------------------------------

/** Scan source, yield every top-level template literal with its span and anchor id. */
function findTemplateLiterals(src) {
  const units = [];

  // Consume a template literal starting at src[i] === '`'.
  // Returns [endIndexAfterClosingBacktick, body]. Tracks ${ … } nesting so that
  // nested templates inside interpolations (legal TS) don't terminate the outer
  // literal, and honors backslash escapes everywhere.
  function scanTemplate(i) {
    let body = '';
    i += 1; // opening backtick
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\\' && i + 1 < src.length) {
        body += ch + src[i + 1];
        i += 2;
        continue;
      }
      if (ch === '`') return [i, body];
      if (ch === '$' && src[i + 1] === '{') {
        const exprEnd = scanExpression(i + 1); // src[i+1] === '{'; returns just past matching '}'
        body += src.slice(i, exprEnd);
        i = exprEnd;
        continue;
      }
      body += ch;
      i += 1;
    }
    return [i, body];
  }

  // src[brace] === '{'; consume until its matching '}'.
  // Handles nested braces, string literals, and nested template literals.
  function scanExpression(brace) {
    let depth = 0;
    let i = brace;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\\' && i + 1 < src.length) {
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"') {
        const quote = ch;
        i += 1;
        while (i < src.length) {
          if (src[i] === '\\') {
            i += 2;
            continue;
          }
          if (src[i] === quote) break;
          i += 1;
        }
        i += 1;
        continue;
      }
      if (ch === '`') {
        const [end] = scanTemplate(i);
        i = end + 1;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
      i += 1;
    }
    return i;
  }

  let i = 0;
  while (i < src.length) {
    if (src[i] !== '`') {
      i += 1;
      continue;
    }
    // find anchor: last word before the backtick (handles `= \``, `: \``, `key: \``, `return \``)
    const prefix = src.slice(Math.max(0, i - 200), i);
    const anchorMatch = prefix.match(/(\w+)\s*(?:\([^)]*\))?\s*(?::\s*[^`:=]*)?[=:]\s*\\?\s*$/) || prefix.match(/return\s+\\?\s*$/);
    const start = i;
    const [end, body] = scanTemplate(i);
    const anchor = anchorMatch ? anchorMatch[1] : null;
    units.push({ anchor, start, end, body });
    i = end + 1;
  }
  return units;
}

/** Map template literals to named prompt units for a TS module. */
function extractTemplateUnits(file, src) {
  const out = [];
  const literals = findTemplateLiterals(src);

  // exported consts: export const NAME = `
  const constRe = /export const (\w+)[^=`]*=\s*\\?\n?`/g;
  // exported object members inside known prompt objects: NAME = { key: ` ... ` }
  const objRe = /(OPERATOR_SYSTEM_PROMPTS|COGNITION_PROMPTS|REASONING_PROMPTS|WORKFLOW_PROMPTS|SPECIALIZED_PROMPTS|PROMPT_TEMPLATES)\s*(?::\s*[^=;{}]+)?\s*[:=]\s*{/g;
  const fnRe = /export function (\w+)\s*\(/g;
  // inner function-returning-template members: key: (...) => `
  const arrowRe = /(\w+):\s*\(([^)]*)\)\s*=>\s*\\?\n?`/g;

  const taken = new Set();

  for (const m of src.matchAll(constRe)) {
    const lit = literals.find(l => l.start === matchIndexToLiteralStart(src, m.index + m[0].length - 1));
    if (!lit) continue;
    out.push({ unit: m[1], body: lit.body });
    taken.add(lit.start);
  }

  for (const m of src.matchAll(arrowRe)) {
    const lit = literals.find(l => l.start === matchIndexToLiteralStart(src, m.index + m[0].length - 1));
    if (!lit || taken.has(lit.start)) continue;
    out.push({ unit: m[1], body: lit.body });
    taken.add(lit.start);
  }

  for (const m of src.matchAll(fnRe)) {
    // find `return \`` after the signature
    const sigEnd = m.index + m[0].length;
    const retIdx = src.indexOf('return `', sigEnd);
    if (retIdx === -1 || retIdx - sigEnd > 400) continue;
    const lit = literals.find(l => l.start === retIdx + 'return '.length);
    if (!lit || taken.has(lit.start)) continue;
    out.push({ unit: m[1], body: lit.body });
    taken.add(lit.start);
  }

  // bare members of exported prompt objects (keys matched by anchor)
  const exportedObjects = [...src.matchAll(objRe)].map(m => ({
    name: m[1],
    open: src.indexOf('{', m.index),
  }));
  for (const obj of exportedObjects) {
    // brace-match the object
    let depth = 0, j = obj.open;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (depth === 0) break; }
    }
    for (const lit of literals) {
      if (lit.start < obj.open || lit.start > j || taken.has(lit.start)) continue;
      const prefix = src.slice(Math.max(obj.open, lit.start - 120), lit.start);
      const km = prefix.match(/(\w+):\s*\\?\s*$/) || prefix.match(/(\w+)\s*=\s*\\?\s*$/);
      if (!km) continue;
      out.push({ unit: `${obj.name}.${km[1]}`, body: lit.body });
      taken.add(lit.start);
    }
  }

  return out.filter(u => u.anchorOk !== false).map(u => ({ file, unit: u.unit, body: u.body }));
}

function matchIndexToLiteralStart(src, idx) {
  // idx points at the backtick position candidate; walk back to actual '`'
  while (idx < src.length && src[idx] !== '`') idx++;
  return idx;
}

// ---------------------------------------------------------------------------
// Expansion + directive normalization
// ---------------------------------------------------------------------------

const MAX_DEPTH = 8;

function expandConsts(body, constTable, depth = 0) {
  if (depth > MAX_DEPTH) return body;
  return body.replace(/\$\{(\w+)\}/g, (full, ident) =>
    Object.prototype.hasOwnProperty.call(constTable, ident)
      ? expandConsts(constTable[ident], constTable, depth + 1)
      : full,
  );
}

function normalizeLine(line) {
  return line
    .replace(/^[-*•]\s+/, '')       // bullets
    .replace(/^\d+[.)]\s+/, '')     // ordered markers
    .replace(/^→\s*/, '')            // workflow arrows
    .replace(/\s+/g, ' ')
    .trim();
}

function isStructural(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^#{1,6}\s/.test(t)) return true;          // markdown heading (structure, converts to tags)
  if (/^\$\{\w+\}$/.test(t)) return true;        // bare interpolation slot
  return false;
}

/** Directive lines of one unit, expanded, normalized, deduped, order-stable. */
function directivesOf(body, constTable) {
  const expanded = expandConsts(body.replace(/\\\n\s*/g, '\n'), constTable);
  const seen = new Set();
  const out = [];
  for (const raw of expanded.split('\n')) {
    if (isStructural(raw)) continue;
    const norm = normalizeLine(raw);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return { expanded, directives: out };
}

// ---------------------------------------------------------------------------
// Quoted-string pools (resources surface)
// ---------------------------------------------------------------------------

function extractQuotedPool(file, src, exportName) {
  const re = new RegExp(`export const ${exportName}\\b`);
  const em = re.exec(src);
  if (!em) return null;
  const open = src.indexOf('[', em.index);
  let depth = 0, j = open;
  for (; j < src.length; j++) {
    if (src[j] === '[' || src[j] === '{') depth++;
    else if (src[j] === ']' || src[j] === '}') { depth--; if (depth === 0) break; }
  }
  const block = src.slice(open, j);
  const strings = [];
  const strRe = /'((?:[^'\\]|\\.)*)'/g;
  for (const m of block.matchAll(strRe)) {
    const norm = normalizeLine(m[1].replace(/\\'/g, "'"));
    if (norm) strings.push(norm);
  }
  return { file, unit: `quotes:${exportName}`, directives: [...new Set(strings)] };
}

// ---------------------------------------------------------------------------
// Build / verify
// ---------------------------------------------------------------------------

function buildManifest() {
  const constTable = {};
  const units = [];

  for (const surface of SURFACES) {
    const abs = path.join(root, surface.file);
    const src = fs.readFileSync(abs, 'utf8');
    if (surface.quotedStrings) {
      for (const name of surface.quotedStrings) {
        const pool = extractQuotedPool(surface.file, src, name);
        if (pool) units.push(pool);
      }
      continue;
    }
    const extracted = extractTemplateUnits(surface.file, src);
    for (const u of extracted) {
      if (/^(REACT_PREAMBLE|OPSEC_RULES|AUTHORIZATION_NOTICE|PLINIAN_OPERATOR_DOCTRINE)$/.test(u.unit) && u.file === 'src/prompts/index.ts') {
        constTable[u.unit] = expandConsts(stripLeadingBackslashNl(u.body), {});
      }
    }
    // second pass so shared consts resolve inside dependent units
    for (const u of extracted) {
      const { directives } = directivesOf(stripLeadingBackslashNl(u.body), constTable);
      const hadHeaders = /^\s*#{1,3}\s/m.test(stripLeadingBackslashNl(u.body));
      units.push({
        file: u.file,
        unit: u.unit,
        hadMarkdownHeaders: hadHeaders,
        directiveCount: directives.length,
        directives,
      });
    }
  }

  const rev = (() => {
    try { return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); }
    catch { return 'unknown'; }
  })();

  return {
    audit: 't3mp3st-prompt-preservation-manifest',
    generatedFrom: rev,
    unitCount: units.length,
    units,
  };
}

function stripLeadingBackslashNl(body) {
  return body.startsWith('\\\n') ? body.slice(2) : body;
}

// Shared collector for the audit: expanded body per template prompt unit.
export function collectPromptUnits() {
  const out = [];
  const constTable = {};
  for (const surface of SURFACES) {
    if (surface.quotedStrings) continue;
    const abs = path.join(root, surface.file);
    const src = fs.readFileSync(abs, 'utf8');
    const extracted = extractTemplateUnits(surface.file, src);
    for (const u of extracted) {
      if (/^(REACT_PREAMBLE|OPSEC_RULES|AUTHORIZATION_NOTICE|PLINIAN_OPERATOR_DOCTRINE)$/.test(u.unit) && u.file === 'src/prompts/index.ts') {
        constTable[u.unit] = expandConsts(stripLeadingBackslashNl(u.body), {});
      }
    }
    for (const u of extracted) {
      const body = stripLeadingBackslashNl(u.body);
      out.push({ file: u.file, unit: u.unit, expanded: expandConsts(body.replace(/\\\n\s*/g, '\n'), constTable) });
    }
  }
  return out;
}

function verify(manifest) {
  const problems = [];
  let checkedUnits = 0;

  // rebuild current directive sets
  const currentByUnit = new Map();
  for (const surface of SURFACES) {
    const abs = path.join(root, surface.file);
    const src = fs.readFileSync(abs, 'utf8');
    if (surface.quotedStrings) {
      for (const name of surface.quotedStrings) {
        const pool = extractQuotedPool(surface.file, src, name);
        if (pool) currentByUnit.set(pool.unit, new Set(pool.directives));
      }
      continue;
    }
    const constTable = {};
    const extracted = extractTemplateUnits(surface.file, src);
    for (const u of extracted) {
      if (/^(REACT_PREAMBLE|OPSEC_RULES|AUTHORIZATION_NOTICE|PLINIAN_OPERATOR_DOCTRINE)$/.test(u.unit) && u.file === 'src/prompts/index.ts') {
        constTable[u.unit] = expandConsts(stripLeadingBackslashNl(u.body), {});
      }
    }
    for (const u of extracted) {
      const { directives } = directivesOf(stripLeadingBackslashNl(u.body), constTable);
      currentByUnit.set(`${u.file}::${u.unit}`, new Set(directives));
    }
  }

  for (const base of manifest.units) {
    checkedUnits++;
    const key = base.unit.includes('::') ? base.unit : `${base.file || ''}::${base.unit}`;
    const cur = currentByUnit.get(key) || currentByUnit.get(base.unit);
    if (!cur) {
      problems.push({ unit: base.unit, missing: ['<whole unit absent>'] });
      continue;
    }
    // containment match: a baseline directive survives if any current directive
    // contains it verbatim or equals it (allows wrapper text around the sentence)
    const curList = [...cur];
    const missing = base.directives.filter(d =>
      !curList.some(c => c.includes(d) || d.includes(c)),
    );
    if (missing.length) problems.push({ unit: base.unit, missing });
  }

  return { ok: problems.length === 0, checkedUnits, problems };
}

function main() {
  const manifestExists = fs.existsSync(MANIFEST_PATH);

  if (process.argv.includes('--write')) {
    const manifest = buildManifest();
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`manifest written: ${MANIFEST_PATH}`);
    console.log(`units: ${manifest.unitCount}, generatedFrom: ${manifest.generatedFrom}`);
    process.exit(0);
  }

  if (!manifestExists) {
    console.error(`no manifest at ${MANIFEST_PATH}; run with --write at inventory time first`);
    process.exit(1);
  }

  const result = verify(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')));
  console.log(JSON.stringify({ audit: 't3mp3st-prompt-preservation', ...result }, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('prompt-manifest.mjs')) main();
