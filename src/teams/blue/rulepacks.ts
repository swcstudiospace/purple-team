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

// ── Offline detector standing (AC-FH-026, AC-FH-015) ──────────────────────────

/** Detector standing: exactly one of these three, never a stubbed pass. */
export type DetectorStanding = 'validated' | 'failed' | 'unavailable';

/** Local validator the standing is claimed against. Binaries are never spawned. */
export type DetectorValidator = 'sigma' | 'yara';

/**
 * Catalog next actions for a missing validator (mirrors the catalog installHint
 * text so the workflow never invents install advice).
 */
export const DETECTOR_INSTALL_HINTS: Record<DetectorValidator, string> = {
  sigma: 'pipx install sigma-cli  # plus the pySigma conversion-pipeline extras',
  yara: 'brew install yara',
};

/** Supplied inputs for one offline detector-evidence compare. */
export interface DetectorValidationInput {
  /** Finding the detector claims to catch (required, nonempty). */
  findingId: string;
  /** Which local validator the rule targets. */
  validator: DetectorValidator;
  /** Detection keyword compared offline against the supplied evidence. */
  pattern: string;
  /** Evidence excerpts the detector must hit. */
  matchingEvidence: string[];
  /** Evidence excerpts the detector must miss. */
  nonMatchingEvidence: string[];
  /** Optional syntax-only Sigma YAML context. Presence alone never validates:
   * without an evidence compare the standing stays `unavailable`. */
  ruleYaml?: string;
}

/** Outcome of one offline detector-evidence compare. */
export interface DetectorValidation {
  findingId: string;
  validator: DetectorValidator;
  standing: DetectorStanding;
  /** Present exactly when standing is `unavailable`: the next safe action. */
  nextAction?: string;
  /** One honest sentence saying what was compared. */
  detail: string;
}

/**
 * Validate a detector offline by comparing a supplied detection keyword against
 * supplied matching and non-matching evidence, entirely in process: every
 * matching excerpt must contain the keyword and every non-matching excerpt must
 * not. Malformed arguments (missing finding id, wrong-typed evidence) throw
 * before any compare runs. Syntax-only YAML, missing evidence, or a missing
 * pattern yields `unavailable` plus the catalog next action — never a pass.
 * No subprocess is spawned; `sigma` and `yara` binaries are never executed.
 */
export function validateDetectorStanding(input: DetectorValidationInput): DetectorValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('validateDetectorStanding: input must be an object');
  }
  if (typeof input.findingId !== 'string' || !input.findingId.trim()) {
    throw new Error('validateDetectorStanding: findingId must be a nonempty string');
  }
  if (input.validator !== 'sigma' && input.validator !== 'yara') {
    throw new Error('validateDetectorStanding: validator must be "sigma" or "yara"');
  }
  if (typeof input.pattern !== 'string') {
    throw new Error('validateDetectorStanding: pattern must be a string');
  }
  for (const field of ['matchingEvidence', 'nonMatchingEvidence'] as const) {
    const value = input[field];
    if (!Array.isArray(value)) {
      throw new Error(`validateDetectorStanding: ${field} must be an array of strings`);
    }
    for (const entry of value) {
      if (typeof entry !== 'string') {
        throw new Error(`validateDetectorStanding: ${field} must be an array of strings`);
      }
    }
  }

  const findingId = input.findingId.trim();
  const needle = input.pattern.toLowerCase();
  const unavailable = (detail: string): DetectorValidation => ({
    findingId,
    validator: input.validator,
    standing: 'unavailable',
    nextAction: `${input.validator} validation needs supplied matching and non-matching evidence to compare offline; syntax-only YAML is not validation. Next action: ${DETECTOR_INSTALL_HINTS[input.validator]}`,
    detail,
  });

  if (!needle) {
    return unavailable(`No detection pattern was supplied for ${findingId}; nothing was compared.`);
  }
  if (input.matchingEvidence.length === 0) {
    return unavailable(
      `No matching evidence was supplied for ${findingId}; a syntax-only rule${input.ruleYaml ? ' (rule YAML was supplied but not compared)' : ''} cannot be validated.`,
    );
  }

  const missed = input.matchingEvidence.filter(text => !text.toLowerCase().includes(needle));
  const falseHits = input.nonMatchingEvidence.filter(text => text.toLowerCase().includes(needle));
  if (missed.length === 0 && falseHits.length === 0) {
    return {
      findingId,
      validator: input.validator,
      standing: 'validated',
      detail: `Offline compare hit on all ${input.matchingEvidence.length} matching excerpt(s) and missed on all ${input.nonMatchingEvidence.length} non-matching excerpt(s) for ${findingId}.`,
    };
  }
  const reasons: string[] = [];
  if (missed.length > 0) reasons.push(`${missed.length} matching excerpt(s) missed`);
  if (falseHits.length > 0) reasons.push(`${falseHits.length} non-matching excerpt(s) hit`);
  return {
    findingId,
    validator: input.validator,
    standing: 'failed',
    detail: `Offline compare for ${findingId} did not discriminate: ${reasons.join(' and ')}.`,
  };
}
