/**
 * Sigma rule-pack generator — one deterministic, experimental Sigma YAML rule
 * per uncovered coverage gap (see ./coverage.ts), keyed to real D3FEND ids from
 * the vendored ontology (./d3fend.ts).
 *
 * Honesty rules enforced here:
 * - Rule ids are uuidv5 derived from the finding id in a fixed t3mp3st
 *   namespace, so regeneration is stable for pins and idempotent re-runs.
 * - Selection keywords come only from finding fields (evidence, title) or, as
 *   a last resort, the cited countermeasure labels — no invented IOCs.
 * - D3FEND ids appear as tags and d3fend.mitre.org references; the rule never
 *   degrades to prose recommendations.
 * - The default logsource is a disclosed generic template; callers with real
 *   telemetry knowledge pass `logsource` instead.
 *
 * Pure functions: no I/O, no LLM, no persistence.
 */

import { createHash } from 'node:crypto';
import type { RedFindingShape } from '../blue.js';
import { d3fendLabel } from './d3fend.js';
import type { CoverageGap } from './coverage.js';

/**
 * Sigma uuidv5 namespace for generated rule ids: uuidv5 of the name
 * "t3mp3st:blue:sigma:v1" in the DNS namespace
 * (6ba7b810-9dad-11d1-80b4-00c04fd430c8). Regenerate with any RFC 4122 uuidv5
 * implementation using those exact inputs; changing it changes every rule id.
 */
const SIGMA_RULE_NAMESPACE = '9b549f41-1a32-5e75-a75c-523d3209bd41';

/** Finding severity → Sigma level, matching the severity-word convention of blue.ts (unknown folds to medium). */
const SEVERITY_TO_SIGMA_LEVEL: Record<string, 'informational' | 'low' | 'medium' | 'high' | 'critical'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'informational',
};

/** Sigma logsource selector; at least one of category/product/service must be set for a valid rule. */
export interface SigmaLogsource {
  category?: string;
  product?: string;
  service?: string;
  /** Free-text clarification; the template default discloses that it is a placeholder. */
  definition?: string;
}

export interface SigmaRuleOptions {
  /** Rule author; defaults to the pipeline attribution. */
  author?: string;
  /**
   * Logsource the generated selection targets. Replaces the default wholesale —
   * pass it whenever the caller knows which telemetry implements the cited
   * countermeasures.
   */
  logsource?: SigmaLogsource;
}

export interface SigmaDetection {
  selection: {
    keywords: string[];
  };
  condition: string;
}

export interface SigmaRule {
  id: string;
  title: string;
  status: 'experimental';
  description: string;
  references: string[];
  author: string;
  logsource: SigmaLogsource;
  detection: SigmaDetection;
  falsepositives: string[];
  level: 'informational' | 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
}

/** Generated pack: the structured rules plus their multi-document Sigma YAML rendering. */
export interface SigmaRulePack {
  rules: SigmaRule[];
  yaml: string;
}

/** RFC 4122 §4.1.3 name-based UUID (SHA-1, version 5) — deterministic rule ids. */
function uuidV5(namespace: string, name: string): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  if (namespaceBytes.length !== 16) {
    throw new Error(`sigma rule namespace must be 16 hex bytes, got "${namespace}"`);
  }
  const digest = createHash('sha1').update(namespaceBytes).update(name, 'utf8').digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Build selection keywords from finding fields only: evidence excerpts, then title, then countermeasure labels, then the finding id. */
function selectionKeywords(finding: RedFindingShape | undefined, gap: CoverageGap): string[] {
  const keywords: string[] = [];
  const candidates = [...(finding?.evidence || []), finding?.title || ''];
  for (const candidate of candidates) {
    const text = candidate.trim().slice(0, 120);
    if (text.length < 4) continue;
    if (keywords.some(existing => existing.toLowerCase() === text.toLowerCase())) continue;
    keywords.push(text);
    if (keywords.length >= 8) return keywords;
  }
  if (keywords.length === 0) {
    for (const id of gap.uncoveredCountermeasures.slice(0, 3)) {
      keywords.push(d3fendLabel(id));
    }
  }
  if (keywords.length === 0) keywords.push(gap.findingId);
  return keywords;
}

/**
 * One Sigma rule for an uncovered gap, or null when the gap needs no rule
 * (covered, or no uncovered countermeasure ids to key on). All D3FEND ids on
 * the rule resolve in the vendored ontology by construction.
 */
export function sigmaRuleForGap(
  finding: RedFindingShape | undefined,
  gap: CoverageGap,
  options?: SigmaRuleOptions,
): SigmaRule | null {
  const uncovered = gap.uncoveredCountermeasures;
  if (gap.coverage === 'covered' || uncovered.length === 0) return null;

  const rawTitle = finding?.title?.trim() || gap.findingId;
  const description =
    `Purple Team blue pipeline template for finding ${gap.findingId} (coverage: ${gap.coverage}). ` +
    `Uncovered D3FEND countermeasures: ${uncovered.map(id => `${id} ${d3fendLabel(id)}`).join('; ')}.` +
    (gap.unresolvedCountermeasures.length > 0
      ? ` Reported unresolvable ids: ${gap.unresolvedCountermeasures.join(', ')}.`
      : '');

  return {
    id: uuidV5(SIGMA_RULE_NAMESPACE, gap.findingId),
    title: rawTitle.length > 100 ? `${rawTitle.slice(0, 97)}...` : rawTitle,
    status: 'experimental',
    description,
    references: uncovered.map(id => `https://d3fend.mitre.org/technique/d3f:${id}`),
    author: options?.author ?? 'Purple Team blue pipeline',
    logsource:
      options?.logsource ?? {
        category: 'process_creation',
        definition: 'Template default — retarget to the telemetry source implementing the cited countermeasures.',
      },
    detection: {
      selection: {
        keywords: selectionKeywords(finding, gap),
      },
      condition: 'selection',
    },
    falsepositives: ['Unknown — template generated from a red finding; validate against production telemetry.'],
    level: (finding?.severity && SEVERITY_TO_SIGMA_LEVEL[finding.severity]) || 'medium',
    tags: uncovered.map(id => `d3fend.${id.toLowerCase()}`),
  };
}

/** Quote a YAML scalar deterministically (JSON string escaping is valid YAML double-flow style). */
function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

/** Render one rule as Sigma YAML with a fixed field order (deterministic output for pins). */
function sigmaYaml(rule: SigmaRule): string {
  const lines: string[] = [
    `title: ${yamlScalar(rule.title)}`,
    `id: ${rule.id}`,
    `status: ${rule.status}`,
    `description: ${yamlScalar(rule.description)}`,
    `references:`,
    ...rule.references.map(reference => `  - ${yamlScalar(reference)}`),
    `author: ${yamlScalar(rule.author)}`,
    `logsource:`,
  ];
  for (const [key, value] of Object.entries(rule.logsource)) {
    if (value !== undefined) lines.push(`  ${key}: ${yamlScalar(value)}`);
  }
  lines.push(
    `detection:`,
    `  selection:`,
    `    keywords:`,
    ...rule.detection.selection.keywords.map(keyword => `      - ${yamlScalar(keyword)}`),
    `  condition: ${rule.detection.condition}`,
    `falsepositives:`,
    ...rule.falsepositives.map(entry => `  - ${yamlScalar(entry)}`),
    `level: ${rule.level}`,
    `tags:`,
    ...rule.tags.map(tag => `  - ${tag}`),
  );
  return `${lines.join('\n')}\n`;
}

/**
 * Generate the pack: one Sigma rule per gap that is both uncovered and has
 * uncovered countermeasure ids to key on (gaps without D3FEND keys cannot
 * produce a keyed rule — their CoverageGap.recommendation says so instead),
 * correlated to its finding by id. Covered gaps produce no rule — the pack
 * only contains actionable detections.
 */
export function sigmaRulepack(
  findings: RedFindingShape[],
  gaps: CoverageGap[],
  options?: SigmaRuleOptions,
): SigmaRulePack {
  const findingById = new Map<string, RedFindingShape>();
  for (const finding of findings) findingById.set(finding.id, finding);
  const rules: SigmaRule[] = [];
  for (const gap of gaps) {
    const rule = sigmaRuleForGap(findingById.get(gap.findingId), gap, options);
    if (rule) rules.push(rule);
  }
  return {
    rules,
    yaml: rules.map(sigmaYaml).join('---\n'),
  };
}
