/**
 * White Hat Component Tools — Structured Data Inspector, Evidence & Fact
 * Collector, and Information Gap Analyzer.
 *
 * Pure deterministic local analyzers with non-destructive parse recovery,
 * chunked pagination, provenance tagging, and missing-information queries.
 *
 * Refs SPE-14019, SPE-14037
 */

import { createHash } from 'node:crypto';

export type WhiteToolHat = 'blue' | 'white' | 'black' | 'red';

export interface WhiteDataInspectorInput {
  rawPayload?: string | ReadonlyArray<Record<string, unknown>> | Record<string, unknown>;
  format?: 'auto' | 'json' | 'jsonl' | 'kv_log';
  requiredFields?: readonly string[];
  filterField?: string;
  filterValue?: string;
  chunkSize?: number;
  chunkIndex?: number;
}

export interface WhiteFieldSchemaSummary {
  field: string;
  presentCount: number;
  nullCount: number;
  types: readonly string[];
  required: boolean;
  missingCount: number;
}

export interface WhiteParseDiagnostic {
  line: number;
  column: number;
  message: string;
  rawSnippet: string;
}

export interface WhiteDataInspectorResult {
  state: 'empty' | 'error' | 'success';
  detectedFormat: 'json' | 'jsonl' | 'kv_log' | 'empty';
  totalRecords: number;
  filteredRecordsCount: number;
  chunkIndex: number;
  chunkSize: number;
  totalChunks: number;
  records: ReadonlyArray<Record<string, unknown>>;
  schemaSummary: readonly WhiteFieldSchemaSummary[];
  omittedSchemaFieldsCount?: number;
  omittedSchemaFields?: readonly string[];
  diagnostics: readonly WhiteParseDiagnostic[];
  rawInputPreserved?: string;
  payloadSha256: string;
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseKvLine(line: string): Record<string, unknown> | null {
  const pairs = line.trim().split(/\s+/);
  const record: Record<string, unknown> = {};
  let matched = 0;
  for (const token of pairs) {
    const eqIndex = token.indexOf('=');
    if (eqIndex > 0) {
      const key = token.slice(0, eqIndex).trim();
      const rawVal = token.slice(eqIndex + 1).trim().replace(/^"|"$/g, '');
      if (key) {
        matched += 1;
        if (rawVal === 'true') record[key] = true;
        else if (rawVal === 'false') record[key] = false;
        else if (rawVal === 'null') record[key] = null;
        else if (/^-?\d+(\.\d+)?$/.test(rawVal)) record[key] = Number(rawVal);
        else record[key] = rawVal;
      }
    }
  }
  return matched > 0 ? record : null;
}

const MAX_SCHEMA_FIELDS = 500;

interface SchemaSummaryBuildResult {
  summaries: WhiteFieldSchemaSummary[];
  omittedSchemaFields: string[];
}

function buildSchemaSummary(
  records: ReadonlyArray<Record<string, unknown>>,
  requiredFields: readonly string[],
): SchemaSummaryBuildResult {
  const requiredSet = new Set<string>(requiredFields);
  const statsMap = new Map<string, { presentCount: number; nullCount: number; typeSet: Set<string> }>();
  const omittedFields = new Set<string>();
  for (const reqField of requiredFields) {
    if (statsMap.size >= MAX_SCHEMA_FIELDS) {
      omittedFields.add(reqField);
      continue;
    }
    statsMap.set(reqField, { presentCount: 0, nullCount: 0, typeSet: new Set<string>() });
  }
  for (const rec of records) {
    for (const [field, val] of Object.entries(rec)) {
      let stat = statsMap.get(field);
      if (!stat) {
        if (statsMap.size >= MAX_SCHEMA_FIELDS) {
          omittedFields.add(field);
          continue;
        }
        stat = { presentCount: 0, nullCount: 0, typeSet: new Set<string>() };
        statsMap.set(field, stat);
      }
      if (val === null || val === undefined) {
        stat.nullCount += 1;
        stat.typeSet.add('null');
      } else {
        stat.presentCount += 1;
        stat.typeSet.add(Array.isArray(val) ? 'array' : typeof val);
      }
    }
  }
  const summaries: WhiteFieldSchemaSummary[] = [];
  for (const [field, stat] of [...statsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const missingCount = Math.max(0, records.length - stat.presentCount);
    summaries.push({
      field,
      presentCount: stat.presentCount,
      nullCount: stat.nullCount,
      types: [...stat.typeSet].sort(),
      required: requiredSet.has(field),
      missingCount,
    });
  }
  return {
    summaries,
    omittedSchemaFields: [...omittedFields].sort(),
  };
}

/**
 * White Hat Tool 1: Structured Data Inspector (`runWhiteDataInspector`).
 * Parses, filters, and validates structured datasets (JSON, JSONL, key=value logs)
 * with chunked rendering and non-destructive parse error diagnostics.
 */
export function runWhiteDataInspector(
  input: WhiteDataInspectorInput = {},
): WhiteDataInspectorResult {
  const chunkSize = Math.max(1, Math.min(500, input.chunkSize ?? 50));
  const chunkIndex = Math.max(0, input.chunkIndex ?? 0);
  const requiredFields = (input.requiredFields ?? []).map(f => f.trim()).filter(Boolean);
  const raw = input.rawPayload;

  if (
    raw === undefined
    || raw === null
    || (typeof raw === 'string' && raw.trim().length === 0)
    || (Array.isArray(raw) && raw.length === 0)
  ) {
    return {
      state: 'empty',
      detectedFormat: 'empty',
      totalRecords: 0,
      filteredRecordsCount: 0,
      chunkIndex: 0,
      chunkSize,
      totalChunks: 0,
      records: [],
      schemaSummary: [],
      diagnostics: [],
      payloadSha256: sha256Hex(''),
    };
  }

  const diagnostics: WhiteParseDiagnostic[] = [];
  let allRecords: Array<Record<string, unknown>> = [];
  let detectedFormat: 'json' | 'jsonl' | 'kv_log' = 'json';
  let rawString = '';

  if (Array.isArray(raw)) {
    rawString = JSON.stringify(raw);
    allRecords = raw.filter(
      (item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item),
    );
  } else if (typeof raw === 'object') {
    rawString = JSON.stringify(raw);
    allRecords = [raw as Record<string, unknown>];
  } else {
    rawString = raw;
    const trimmed = rawString.trim();
    const requestedFormat = input.format ?? 'auto';

    if (requestedFormat === 'json' || (requestedFormat === 'auto' && (trimmed.startsWith('[') || trimmed.startsWith('{')) && !trimmed.includes('\n{'))) {
      detectedFormat = 'json';
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          for (let i = 0; i < parsed.length; i += 1) {
            const item = parsed[i];
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
              allRecords.push(item as Record<string, unknown>);
            } else {
              allRecords.push({ value: item, index: i });
            }
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          allRecords.push(parsed as Record<string, unknown>);
        } else {
          allRecords.push({ value: parsed });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Attempt line-by-line JSONL recovery so raw input is never lost
        const lines = rawString.split(/\r?\n/);
        for (let idx = 0; idx < lines.length; idx += 1) {
          const lineText = lines[idx].trim();
          if (!lineText) continue;
          try {
            const lineObj = JSON.parse(lineText) as unknown;
            if (typeof lineObj === 'object' && lineObj !== null && !Array.isArray(lineObj)) {
              allRecords.push(lineObj as Record<string, unknown>);
            }
          } catch {
            const kv = parseKvLine(lineText);
            if (kv) {
              allRecords.push(kv);
            }
          }
        }
        diagnostics.push({
          line: 1,
          column: 1,
          message: `Malformed JSON payload: ${msg}`,
          rawSnippet: trimmed.slice(0, 140),
        });
      }
    } else {
      const lines = rawString.split(/\r?\n/);
      let jsonlCount = 0;
      let kvCount = 0;
      for (let idx = 0; idx < lines.length; idx += 1) {
        const lineText = lines[idx].trim();
        if (!lineText) continue;
        if (lineText.startsWith('{')) {
          try {
            const parsedLine = JSON.parse(lineText) as unknown;
            if (typeof parsedLine === 'object' && parsedLine !== null && !Array.isArray(parsedLine)) {
              allRecords.push(parsedLine as Record<string, unknown>);
              jsonlCount += 1;
              continue;
            }
          } catch (err) {
            diagnostics.push({
              line: idx + 1,
              column: 1,
              message: err instanceof Error ? err.message : 'Invalid JSONL record',
              rawSnippet: lineText.slice(0, 120),
            });
            continue;
          }
        }
        const kv = parseKvLine(lineText);
        if (kv) {
          allRecords.push(kv);
          kvCount += 1;
        } else {
          diagnostics.push({
            line: idx + 1,
            column: 1,
            message: 'Unrecognized line structure (expected JSON object or key=value pairs)',
            rawSnippet: lineText.slice(0, 120),
          });
        }
      }
      detectedFormat = kvCount > jsonlCount ? 'kv_log' : 'jsonl';
    }
  }

  const filterField = (input.filterField ?? '').trim();
  const filterValue = (input.filterValue ?? '').trim().toLowerCase();
  const filtered = filterField
    ? allRecords.filter(rec => {
        if (!Object.prototype.hasOwnProperty.call(rec, filterField)) return false;
        if (!filterValue) return rec[filterField] !== null && rec[filterField] !== undefined;
        return String(rec[filterField]).toLowerCase().includes(filterValue);
      })
    : allRecords;

  const { summaries: schemaSummary, omittedSchemaFields } = buildSchemaSummary(filtered, requiredFields);
  const omittedSchemaFieldsCount = omittedSchemaFields.length;
  let hasRequiredFieldViolation = false;
  for (const fieldStat of schemaSummary) {
    if (fieldStat.required && fieldStat.missingCount > 0) {
      hasRequiredFieldViolation = true;
      diagnostics.push({
        line: 1,
        column: 1,
        message: `Required schema field "${fieldStat.field}" is missing or null in ${fieldStat.missingCount} record(s)`,
        rawSnippet: `requiredField=${fieldStat.field}`,
      });
    }
  }
  if (omittedSchemaFieldsCount > 0) {
    diagnostics.push({
      line: 1,
      column: 1,
      message: `Schema exceeded the ${MAX_SCHEMA_FIELDS}-field bound; ${omittedSchemaFieldsCount} field(s) omitted from schemaSummary`,
      rawSnippet: omittedSchemaFields.slice(0, 10).join(', '),
    });
  }

  const totalChunks = filtered.length === 0 ? 0 : Math.ceil(filtered.length / chunkSize);
  const safeChunkIndex = totalChunks === 0 ? 0 : Math.min(chunkIndex, totalChunks - 1);
  const start = safeChunkIndex * chunkSize;
  const pageRecords = filtered.slice(start, start + chunkSize);

  const hasParseFailure = diagnostics.some(d => d.message.startsWith('Malformed') || d.message.startsWith('Unrecognized') || d.message.includes('JSON'));
  const state: 'empty' | 'error' | 'success' = (hasParseFailure || hasRequiredFieldViolation || omittedSchemaFieldsCount > 0) ? 'error' : 'success';

  return {
    state,
    detectedFormat,
    totalRecords: allRecords.length,
    filteredRecordsCount: filtered.length,
    chunkIndex: safeChunkIndex,
    chunkSize,
    totalChunks,
    records: pageRecords,
    schemaSummary,
    ...(omittedSchemaFieldsCount > 0 ? { omittedSchemaFieldsCount, omittedSchemaFields } : {}),
    diagnostics,
    ...(diagnostics.length > 0 ? { rawInputPreserved: rawString } : {}),
    payloadSha256: sha256Hex(rawString),
  };
}

// =============================================================================
// 2. EVIDENCE & FACT COLLECTOR
// =============================================================================

export interface WhiteFactInput {
  id?: string;
  claim: string;
  source: string;
  artifactId?: string;
  sha256?: string;
  tags?: readonly string[];
  corroboratedBy?: readonly string[];
  contradictedBy?: readonly string[];
}

export interface WhiteEvidenceCollectorInput {
  facts?: readonly WhiteFactInput[];
  tagFilter?: string;
}

export type WhiteConfidenceLevel = 'verified' | 'corroborated' | 'unverified' | 'contradicted';

export interface WhiteEvidenceItem {
  id: string;
  claim: string;
  source: string;
  artifactId: string | null;
  sha256: string;
  tags: readonly string[];
  confidenceLevel: WhiteConfidenceLevel;
  confidenceScore: number;
  corroboratedBy: readonly string[];
  contradictedBy: readonly string[];
}

export interface WhiteEvidenceCollectorResult {
  state: 'empty' | 'error' | 'success';
  items: readonly WhiteEvidenceItem[];
  summaryCounts: {
    total: number;
    verified: number;
    corroborated: number;
    unverified: number;
    contradicted: number;
  };
  collectionDigest: string;
  handoffTargetHat: 'blue' | 'black' | 'red';
}

/**
 * White Hat Tool 2: Evidence & Fact Collector (`runWhiteEvidenceCollector`).
 * Captures, tags, cross-references, and scores facts with provenance metadata
 * and deterministic confidence indicators.
 */
export function runWhiteEvidenceCollector(
  input: WhiteEvidenceCollectorInput = {},
): WhiteEvidenceCollectorResult {
  const facts = input.facts ?? [];
  const tagFilter = (input.tagFilter ?? '').trim().toLowerCase();

  if (facts.length === 0) {
    return {
      state: 'empty',
      items: [],
      summaryCounts: { total: 0, verified: 0, corroborated: 0, unverified: 0, contradicted: 0 },
      collectionDigest: `sha256-${sha256Hex('empty').slice(0, 16)}`,
      handoffTargetHat: 'blue',
    };
  }

  const items: WhiteEvidenceItem[] = [];
  const summaryCounts = { total: 0, verified: 0, corroborated: 0, unverified: 0, contradicted: 0 };

  for (let i = 0; i < facts.length; i += 1) {
    const f = facts[i];
    const claim = (f.claim ?? '').trim();
    const source = (f.source ?? '').trim() || 'unspecified-source';
    if (!claim) {
      return {
        state: 'error',
        items,
        summaryCounts,
        collectionDigest: `sha256-${sha256Hex(`error:${i}`).slice(0, 16)}`,
        handoffTargetHat: 'white' as 'blue',
      };
    }

    const tags = (f.tags ?? []).map(t => t.trim()).filter(Boolean);
    if (tagFilter && !tags.some(t => t.toLowerCase() === tagFilter)) {
      continue;
    }

    const artifactId = (f.artifactId ?? '').trim() || null;
    const corroboratedBy = (f.corroboratedBy ?? []).map(c => c.trim()).filter(Boolean);
    const contradictedBy = (f.contradictedBy ?? []).map(c => c.trim()).filter(Boolean);
    const computedSha = (f.sha256 ?? '').trim() || `sha256-${sha256Hex(`${claim}:${source}:${artifactId ?? ''}`).slice(0, 16)}`;

    let confidenceLevel: WhiteConfidenceLevel;
    let confidenceScore: number;

    if (contradictedBy.length > 0) {
      confidenceLevel = 'contradicted';
      confidenceScore = 20;
      summaryCounts.contradicted += 1;
    } else if (artifactId && (f.sha256 ?? '').trim().length > 0 && corroboratedBy.length > 0) {
      confidenceLevel = 'verified';
      confidenceScore = 95;
      summaryCounts.verified += 1;
    } else if (artifactId || corroboratedBy.length > 0) {
      confidenceLevel = 'corroborated';
      confidenceScore = 75;
      summaryCounts.corroborated += 1;
    } else {
      confidenceLevel = 'unverified';
      confidenceScore = 40;
      summaryCounts.unverified += 1;
    }

    summaryCounts.total += 1;
    items.push({
      id: (f.id ?? '').trim() || `fact-${i + 1}`,
      claim,
      source,
      artifactId,
      sha256: computedSha,
      tags,
      confidenceLevel,
      confidenceScore,
      corroboratedBy,
      contradictedBy,
    });
  }

  const collectionDigest = `sha256-${sha256Hex(items.map(it => `${it.id}:${it.sha256}:${it.confidenceLevel}`).join('|')).slice(0, 16)}`;
  const handoffTargetHat: 'blue' | 'black' | 'red' = summaryCounts.contradicted > 0
    ? 'black'
    : summaryCounts.unverified > 0
      ? 'red'
      : 'blue';

  return {
    state: 'success',
    items,
    summaryCounts,
    collectionDigest,
    handoffTargetHat,
  };
}

// =============================================================================
// 3. INFORMATION GAP ANALYZER
// =============================================================================

export interface WhiteKnownFactInput {
  variable: string;
  value?: string;
  verified?: boolean;
  source?: string;
}

export interface WhiteAssumptionInput {
  id?: string;
  statement: string;
  verified?: boolean;
  criticality?: 'high' | 'medium' | 'low';
}

export interface WhiteGapAnalyzerInput {
  objective?: string;
  requiredVariables?: readonly string[];
  knownFacts?: readonly WhiteKnownFactInput[];
  assumptions?: readonly WhiteAssumptionInput[];
}

export interface WhiteResolutionQuery {
  id: string;
  targetHat: WhiteToolHat;
  targetTool: string;
  question: string;
  resolvesVariable: string;
  priority: 'P1' | 'P2' | 'P3';
}

export interface WhiteGapAnalyzerResult {
  state: 'empty' | 'error' | 'success';
  objective: string;
  completenessScore: number;
  knownVerifiedCount: number;
  missingVariables: readonly string[];
  unverifiedVariables: readonly string[];
  unverifiedAssumptions: ReadonlyArray<{
    id: string;
    statement: string;
    criticality: 'high' | 'medium' | 'low';
  }>;
  resolutionQueries: readonly WhiteResolutionQuery[];
}

function routeVariableToHat(variable: string): { hat: WhiteToolHat; tool: string } {
  const lower = variable.toLowerCase();
  if (/telemetry|siem|log|detector|sigma|yara|d3fend|alert|control/.test(lower)) {
    return { hat: 'blue', tool: 'coverageGaps' };
  }
  if (/egress|route|noise|beacon|opsec|cover|exfil|proxy/.test(lower)) {
    return { hat: 'black', tool: 'black-risk-analyzer' };
  }
  if (/roe|scope|approval|receipt|authority|window|legal/.test(lower)) {
    return { hat: 'white', tool: 'stageRoeAudit' };
  }
  return { hat: 'red', tool: 'recon' };
}

/**
 * White Hat Tool 3: Information Gap Analyzer (`runWhiteGapAnalyzer`).
 * Compares required mission inputs against available facts to surface missing
 * variables, unverified assumptions, and concrete queries routed to target Hats.
 */
export function runWhiteGapAnalyzer(
  input: WhiteGapAnalyzerInput = {},
): WhiteGapAnalyzerResult {
  const objective = (input.objective ?? '').trim() || 'Verify Knowns vs. Unknowns before Operational Execution';
  const requiredVariables = (input.requiredVariables ?? []).map(v => v.trim()).filter(Boolean);
  const knownFacts = input.knownFacts ?? [];
  const assumptions = input.assumptions ?? [];

  if (requiredVariables.length === 0 && assumptions.length === 0) {
    return {
      state: 'empty',
      objective,
      completenessScore: 0,
      knownVerifiedCount: 0,
      missingVariables: [],
      unverifiedVariables: [],
      unverifiedAssumptions: [],
      resolutionQueries: [],
    };
  }

  const factMap = new Map<string, WhiteKnownFactInput>();
  for (const kf of knownFacts) {
    const key = (kf.variable ?? '').trim().toLowerCase();
    if (key) factMap.set(key, kf);
  }

  const missingVariables: string[] = [];
  const unverifiedVariables: string[] = [];
  let knownVerifiedCount = 0;
  const resolutionQueries: WhiteResolutionQuery[] = [];

  for (let i = 0; i < requiredVariables.length; i += 1) {
    const reqVar = requiredVariables[i];
    const match = factMap.get(reqVar.toLowerCase());
    const routing = routeVariableToHat(reqVar);

    if (!match || !(match.value ?? '').trim()) {
      missingVariables.push(reqVar);
      resolutionQueries.push({
        id: `gap-q-${resolutionQueries.length + 1}`,
        targetHat: routing.hat,
        targetTool: routing.tool,
        question: `Collect missing variable "${reqVar}" required for "${objective}"`,
        resolvesVariable: reqVar,
        priority: 'P1',
      });
    } else if (match.verified !== true) {
      unverifiedVariables.push(reqVar);
      resolutionQueries.push({
        id: `gap-q-${resolutionQueries.length + 1}`,
        targetHat: 'white',
        targetTool: 'white-evidence-collector',
        question: `Attach artifact hash and corroboration to verify "${reqVar}" (current source: ${match.source ?? 'unattributed'})`,
        resolvesVariable: reqVar,
        priority: 'P2',
      });
    } else {
      knownVerifiedCount += 1;
    }
  }

  const unverifiedAssumptions: Array<{ id: string; statement: string; criticality: 'high' | 'medium' | 'low' }> = [];
  for (let i = 0; i < assumptions.length; i += 1) {
    const a = assumptions[i];
    const statement = (a.statement ?? '').trim();
    if (!statement) continue;
    const criticality = a.criticality ?? 'medium';
    if (!a.verified) {
      const id = (a.id ?? '').trim() || `assump-${i + 1}`;
      unverifiedAssumptions.push({ id, statement, criticality });
      const routing = routeVariableToHat(statement);
      resolutionQueries.push({
        id: `gap-q-${resolutionQueries.length + 1}`,
        targetHat: routing.hat,
        targetTool: routing.tool,
        question: `Verify ${criticality}-criticality assumption: "${statement}"`,
        resolvesVariable: id,
        priority: criticality === 'high' ? 'P1' : criticality === 'medium' ? 'P2' : 'P3',
      });
    }
  }

  const totalCheckpoints = requiredVariables.length + assumptions.length;
  const satisfiedCheckpoints = knownVerifiedCount
    + (assumptions.length - unverifiedAssumptions.length)
    + (unverifiedVariables.length * 0.5);
  const completenessScore = totalCheckpoints === 0
    ? 100
    : Math.max(0, Math.min(100, Math.round((satisfiedCheckpoints / totalCheckpoints) * 100)));

  return {
    state: 'success',
    objective,
    completenessScore,
    knownVerifiedCount,
    missingVariables,
    unverifiedVariables,
    unverifiedAssumptions,
    resolutionQueries,
  };
}
