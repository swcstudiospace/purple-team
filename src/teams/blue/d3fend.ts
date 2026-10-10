/**
 * D3FEND ontology access — parses the vendored CSV (./d3fend-ontology.ts) into
 * lookup tables. Pure data transformation: no I/O, no network, no persistence.
 *
 * Every D3FEND id the blue pipeline emits (coverage recommendations, Sigma tags
 * and references, telemetry registry entries) must resolve against D3FEND_BY_ID,
 * which is built from the real ontology — invented technique ids are a bug.
 */

import { D3FEND_ONTOLOGY_CSV } from './d3fend-ontology.js';

/** One ontology term: a D3FEND tactic node, countermeasure technique, or sub-technique. */
export interface D3fendTerm {
  /** Canonical D3FEND id, e.g. "D3-PSA". */
  id: string;
  /** D3FEND tactic the term sits under (Model, Harden, Detect, Isolate, Deceive, Evict, Restore). */
  tactic: string;
  /** Human-readable technique label, e.g. "Process Spawn Analysis". */
  label: string;
  /** Depth in the technique hierarchy: 0 = top-level technique, 1 = Level 0 sub-technique, 2 = Level 1 sub-technique. */
  depth: 0 | 1 | 2;
  /** Id of the enclosing technique, or null for depth-0 roots. */
  parentId: string | null;
  /** Ontology definition; empty string when the CSV ships none (some root rows). */
  definition: string;
}

/** Parse one RFC-4180 CSV line (quoted fields, "" escapes; the vendor CSV has no multi-line fields). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// Column indices in the vendored d3fend.csv export.
const COL_ID = 0;
const COL_TACTIC = 1;
const COL_TECHNIQUE = 2;
const COL_LEVEL0 = 3;
const COL_LEVEL1 = 4;
const COL_DEFINITION = 5;

/**
 * Flatten the CSV rows into terms. The export spreads the ontology tree across
 * three label columns ("D3FEND Technique", "Level 0", "Level 1"), so a row's
 * parent is the most recent row filling the previous column — exactly how the
 * vendor orders the export. Single-column invariant violations throw instead of
 * guessing.
 */
function parseOntology(csv: string): D3fendTerm[] {
  const lines = csv.split('\n').filter(line => line.length > 0);
  const header = splitCsvLine(lines[0]);
  const terms: D3fendTerm[] = [];
  let depth0Id: string | null = null;
  let depth1Id: string | null = null;

  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);
    const id = fields[COL_ID]?.trim() || '';
    if (!/^D3-/.test(id)) {
      throw new Error(`d3fend-ontology: unexpected row id "${id}" (expected a D3- prefixed id)`);
    }
    if (header[COL_ID] !== 'ID' || !header[COL_TACTIC].startsWith('D3FEND Tactic')) {
      throw new Error('d3fend-ontology: unrecognized CSV header');
    }
    const technique = fields[COL_TECHNIQUE]?.trim() || '';
    const level0 = fields[COL_LEVEL0]?.trim() || '';
    const level1 = fields[COL_LEVEL1]?.trim() || '';
    const filled = [technique, level0, level1].filter(label => label.length > 0);
    if (filled.length !== 1) {
      throw new Error(`d3fend-ontology: ${id} fills ${filled.length} technique columns (expected exactly one)`);
    }

    let depth: 0 | 1 | 2;
    let parentId: string | null;
    if (technique) {
      depth = 0;
      parentId = null;
      depth0Id = id;
      depth1Id = null;
    } else if (level0) {
      depth = 1;
      parentId = depth0Id;
      depth1Id = id;
    } else {
      depth = 2;
      parentId = depth1Id;
    }

    terms.push({
      id,
      tactic: fields[COL_TACTIC]?.trim() || '',
      label: filled[0],
      depth,
      parentId,
      definition: fields[COL_DEFINITION]?.trim() || '',
    });
  }
  return terms;
}

/** All ontology terms in vendored file order (tactic-grouped, hierarchy-ordered). */
export const D3FEND_TERMS: readonly D3fendTerm[] = parseOntology(D3FEND_ONTOLOGY_CSV);

/** Id-keyed lookup over the vendored ontology. Unresolvable ids are a caller bug — check membership first. */
export const D3FEND_BY_ID: Readonly<Record<string, D3fendTerm>> = Object.fromEntries(
  D3FEND_TERMS.map(term => [term.id, term]),
);

/** The D3FEND tactics present in the vendored ontology, in file order. */
export const D3FEND_TACTICS: readonly string[] = [...new Set(D3FEND_TERMS.map(term => term.tactic))];

/** Label for a D3FEND id, falling back to the raw id for unknown input so callers never print `undefined`. */
export function d3fendLabel(id: string): string {
  return D3FEND_BY_ID[id]?.label ?? id;
}
