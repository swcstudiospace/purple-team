/**
 * Blue v2 coverage scorer — detection coverage keyed by D3FEND countermeasure
 * ids from the vendored ontology (./d3fend.ts), replacing the v1
 * severity→control-text table (src/teams/blue.ts keeps its stable v1 surface).
 *
 * Inputs are plain shapes:
 * - findings optionally carry countermeasure ids (D3FEND countermeasures that
 *   would detect or mitigate them) — supplied by the caller, never guessed here;
 * - telemetry declarations carry the countermeasure ids their sources provide
 *   signal for (see ./telemetry.ts for the curated registry).
 *
 * A finding whose resolved countermeasures are all covered is 'covered';
 * partially covered, or uncovered while telemetry is deployed, is 'partial';
 * uncovered with no telemetry at all is 'none'. Findings without countermeasure
 * keys fall back to the v1 finding-id semantics and say so in their
 * recommendation. Ids absent from the ontology are reported per gap — never
 * silently dropped, never invented.
 *
 * Pure functions: no I/O, no LLM, no persistence.
 */

import type { RedFindingShape, TelemetrySourceShape } from '../blue.js';
import { D3FEND_BY_ID, d3fendLabel } from './d3fend.js';

/** A red finding with optional D3FEND countermeasure keys for keyed coverage. */
export interface CoverageFinding extends RedFindingShape {
  /** D3FEND countermeasure ids that would detect or mitigate this finding. */
  countermeasures?: string[];
}

/** A deployed telemetry source with optional D3FEND countermeasure coverage. */
export interface TelemetryDeclaration extends TelemetrySourceShape {
  /** D3FEND countermeasure ids this source provides detection signal for. */
  countermeasures?: string[];
}

/** D3FEND-keyed coverage decision for one finding. */
export interface CoverageGap {
  findingId: string;
  coverage: 'none' | 'partial' | 'covered';
  /** Supplied countermeasure ids that resolve in the vendored ontology (input order, deduped). */
  countermeasures: string[];
  /** Resolved countermeasures the declared telemetry covers. */
  coveredCountermeasures: string[];
  /** Resolved countermeasures nothing covers — these key Sigma rule packs. */
  uncoveredCountermeasures: string[];
  /** Supplied ids absent from the vendored ontology, surfaced instead of dropped. */
  unresolvedCountermeasures: string[];
  /** Recommendation naming real ontology countermeasures, never severity prose. */
  recommendation: string;
}

/** Render ids with their ontology labels for recommendation text (shared so every gap cites the same way). */
function citeAll(ids: string[]): string {
  return ids.map(id => `${id} (${d3fendLabel(id)})`).join(', ');
}

/** Assemble the gap once the per-finding id resolution is done. */
function buildGap(
  finding: RedFindingShape,
  resolved: string[],
  unresolved: string[],
  covered: string[],
  directFindingCover: boolean,
  hasTelemetry: boolean,
): CoverageGap {
  const uncovered = resolved.filter(id => !covered.includes(id));
  let coverage: CoverageGap['coverage'];
  let recommendation: string;

  if (resolved.length > 0) {
    if (uncovered.length === 0) {
      coverage = 'covered';
      recommendation = `Existing telemetry covers ${finding.id} via ${citeAll(covered)}; retain and regression-test it against stored evidence.`;
    } else if (covered.length > 0 || hasTelemetry) {
      coverage = 'partial';
      recommendation = `Telemetry is deployed but does not cover ${finding.id} on ${citeAll(uncovered)}; extend the deployed sources or add sources implementing these countermeasures.`;
    } else {
      coverage = 'none';
      recommendation = `No telemetry covers ${finding.id}; deploy sources implementing ${citeAll(resolved)}.`;
    }
  } else if (directFindingCover) {
    // No countermeasure keys, but some source listed the finding id directly (v1 semantics).
    coverage = 'covered';
    recommendation = `Existing telemetry directly covers ${finding.id} by finding id; retain and regression-test it against stored evidence.`;
  } else if (hasTelemetry) {
    coverage = 'partial';
    recommendation = `Telemetry is deployed but does not cover ${finding.id}, and the finding carries no D3FEND countermeasure keys; tag the finding with countermeasure ids from D3FEND_BY_ID to enable keyed coverage and Sigma rule packs.`;
  } else {
    coverage = 'none';
    recommendation = `No telemetry covers ${finding.id} and the finding carries no D3FEND countermeasure keys; deploy telemetry, then tag the finding with countermeasure ids from D3FEND_BY_ID.`;
  }
  if (unresolved.length > 0) {
    recommendation += ` Unresolvable ids reported, not used: ${unresolved.join(', ')}.`;
  }

  return {
    findingId: finding.id,
    coverage,
    countermeasures: resolved,
    coveredCountermeasures: covered,
    uncoveredCountermeasures: uncovered,
    unresolvedCountermeasures: unresolved,
    recommendation,
  };
}

/**
 * Score detection coverage per finding against the declared telemetry. Direct
 * finding-id matches in telemetry coveredIds still count (v1 compatibility) and
 * mark every resolved countermeasure as covered; countermeasure coverage is the
 * v2 key. Decisions derive only from the vendored ontology and supplied inputs.
 */
export function coverageGaps(findings: CoverageFinding[], telemetry: TelemetryDeclaration[]): CoverageGap[] {
  const telemetryCountermeasures = new Set<string>();
  const directlyCovered = new Set<string>();
  for (const source of telemetry) {
    for (const id of source.countermeasures || []) telemetryCountermeasures.add(id);
    for (const id of source.coveredIds || []) directlyCovered.add(id);
  }

  return findings.map(finding => {
    const resolved: string[] = [];
    const unresolved: string[] = [];
    for (const id of finding.countermeasures || []) {
      if (D3FEND_BY_ID[id]) {
        if (!resolved.includes(id)) resolved.push(id);
      } else if (!unresolved.includes(id)) {
        unresolved.push(id);
      }
    }
    // Direct finding-id coverage by any deployed source covers the finding's whole keyed surface.
    const covered = directlyCovered.has(finding.id)
      ? [...resolved]
      : resolved.filter(id => telemetryCountermeasures.has(id));
    return buildGap(finding, resolved, unresolved, covered, directlyCovered.has(finding.id), telemetry.length > 0);
  });
}
