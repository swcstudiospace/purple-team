/**
 * Blue staged offline workflow (B1 tracer) — artifact-bound coverage that fails
 * closed without the artifact.
 *
 * Each stage cites the bound artifact id(s) plus an inputSha256 over bytes
 * actually read, and returns stage bindings only after real computation. The
 * binding fields mirror the private recordReceipt contract (runId, missionId,
 * stage, tool, inputSha256, itemId); tool is coverageGaps, detectionGaps, or
 * hardeningPlan, never sigma/yara. No origin is set and no receipt writer is
 * called — persistence of origin:'observed' stays behind the private writer.
 *
 * Per D Blue-offline: no EDR, SIEM, or live remediation. Detector standing is
 * an in-process offline compare of supplied evidence (see ./rulepacks.ts); the
 * binaries are never spawned. Imported plans stay untrusted data and cannot
 * change grants.
 *
 * Pure functions: no I/O, no LLM, no persistence. Nothing at module load can
 * throw: one unavailable family never fails its siblings or Red.
 */

import { createHash } from 'node:crypto';
import {
  coverageGaps,
  type CoverageFinding,
  type CoverageGap,
  type TelemetryDeclaration,
} from './coverage.js';
import {
  applyHardeningRetest,
  detectionGaps,
  type DetectionGap,
  type HardeningItem,
  type HardeningRetestOutcome,
  type ObservedArtifactIds,
  type RedFindingShape,
  type TelemetrySourceShape,
} from '../blue.js';
import {
  validateDetectorStanding,
  type DetectorValidation,
  type DetectorValidationInput,
} from './rulepacks.js';

/**
 * Mission families the Blue parent and specialist paths cover offline. Mirrors
 * FAMILY_TEAM_MAPPING.blue in src/teams/index.ts; kept as a local literal so
 * this module never throws at import and never pulls the hat wrappers.
 */
export const BLUE_WORKFLOW_FAMILIES = [
  'web_api',
  'cloud_infra',
  'code_supply_chain',
  'crypto_secrets',
  'reporting_remediation',
  'ai_red_team',
  'agent_warfare',
] as const;

export type BlueFamily = (typeof BLUE_WORKFLOW_FAMILIES)[number];

/** Tools a stage binding may cite. Never sigma/yara: those binaries are not run. */
export type BlueWorkflowTool = 'coverageGaps' | 'detectionGaps' | 'hardeningPlan';

/** Stage binding returned after real computation (mirrors the receipt fields, sets no origin). */
export interface BlueStageBinding {
  runId: string;
  missionId: string;
  stage: string;
  tool: BlueWorkflowTool;
  inputSha256: string;
  itemId: string;
}

/** Stage completion standing. Missing artifacts or evidence fail closed here, never as covered. */
export type BlueStageStatus = 'complete' | 'insufficient-evidence' | 'unavailable';

/**
 * Workflow-local sha256 over bytes actually read, grouped the same way as the
 * artifact hash (four 16-hex groups). Defined locally so this module imports
 * neither server.ts nor contracts.ts.
 */
export function blueInputHash(bytes: string): string {
  const hex = createHash('sha256').update(bytes, 'utf8').digest('hex');
  return `${hex.slice(0, 16)}-${hex.slice(16, 32)}-${hex.slice(32, 48)}-${hex.slice(48, 64)}`;
}

function requireRunHeader(input: { runId?: unknown; missionId?: unknown }, stage: string): {
  runId: string;
  missionId: string;
} {
  if (typeof input?.runId !== 'string' || !input.runId.trim()) {
    throw new Error(`blue workflow ${stage}: runId must be a nonempty string`);
  }
  if (typeof input?.missionId !== 'string' || !input.missionId.trim()) {
    throw new Error(`blue workflow ${stage}: missionId must be a nonempty string`);
  }
  return { runId: input.runId.trim(), missionId: input.missionId.trim() };
}

function requireFamily(family: unknown): BlueFamily {
  if (typeof family !== 'string' || !(BLUE_WORKFLOW_FAMILIES as readonly string[]).includes(family)) {
    throw new Error(
      `blue workflow: unknown family "${String(family)}" (expected one of ${BLUE_WORKFLOW_FAMILIES.join(', ')})`,
    );
  }
  return family as BlueFamily;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`blue workflow: ${field} must be an array of strings`);
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new Error(`blue workflow: ${field} must be an array of strings`);
    }
    const id = entry.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// ── Coverage stage ────────────────────────────────────────────────────────────

export interface BlueCoverageStageInput {
  runId: string;
  missionId: string;
  family: string;
  /** Selected artifact ids bound to this stage. Empty fails closed. */
  artifactIds: string[];
  /** Bytes actually read; the inputSha256 covers these plus the stage inputs. */
  artifactBytes: string;
  findings: CoverageFinding[];
  telemetry: TelemetryDeclaration[];
}

export interface BlueCoverageStageResult {
  status: BlueStageStatus;
  family: string;
  artifactIds: string[];
  bindings: BlueStageBinding[];
  gaps: CoverageGap[];
  limitations: string[];
}

/**
 * Run the artifact-bound coverage stage for one family. Supplied artifacts plus
 * evidence yield covered; id-only overlap yields partial with a limitation;
 * missing artifacts or bytes fail closed as insufficient-evidence, never covered.
 */
export function runBlueCoverageStage(input: BlueCoverageStageInput): BlueCoverageStageResult {
  const { runId, missionId } = requireRunHeader(input, 'blue-coverage');
  const family = requireFamily(input?.family);
  const artifactIds = requireStringArray(input?.artifactIds, 'artifactIds');
  if (typeof input?.artifactBytes !== 'string') {
    throw new Error('blue workflow blue-coverage: artifactBytes must be a string');
  }
  if (!Array.isArray(input?.findings)) {
    throw new Error('blue workflow blue-coverage: findings must be an array');
  }
  if (!Array.isArray(input?.telemetry)) {
    throw new Error('blue workflow blue-coverage: telemetry must be an array');
  }
  const findings = input.findings;
  const telemetry = input.telemetry;
  const stage = `blue-coverage:${family}`;

  if (artifactIds.length === 0 || !input.artifactBytes) {
    const gaps = coverageGaps(findings, telemetry);
    const inputSha256 = blueInputHash(JSON.stringify({ findings, telemetry }));
    return {
      status: 'insufficient-evidence',
      family,
      artifactIds,
      bindings: findings.map(finding => ({ runId, missionId, stage, tool: 'coverageGaps' as const, inputSha256, itemId: finding.id })),
      gaps,
      limitations: [
        'Missing artifact: no artifact id or artifact bytes were supplied, so the stage fails closed. No finding is covered.',
      ],
    };
  }

  const observed: ObservedArtifactIds = Object.fromEntries(findings.map(finding => [finding.id, artifactIds]));
  const inputSha256 = blueInputHash(`${input.artifactBytes}\n${JSON.stringify({ family, findings, telemetry })}`);
  const gaps = coverageGaps(findings, telemetry, observed);
  return {
    status: 'complete',
    family,
    artifactIds,
    bindings: findings.map(finding => ({ runId, missionId, stage, tool: 'coverageGaps' as const, inputSha256, itemId: finding.id })),
    gaps,
    limitations: gaps.flatMap(gap => gap.limitations),
  };
}

// ── Detection stage (v1 finding-id path, same artifact binding) ───────────────

export interface BlueDetectionStageInput {
  runId: string;
  missionId: string;
  family: string;
  artifactIds: string[];
  artifactBytes: string;
  findings: RedFindingShape[];
  telemetry?: TelemetrySourceShape[];
}

export interface BlueDetectionStageResult {
  status: BlueStageStatus;
  family: string;
  artifactIds: string[];
  bindings: BlueStageBinding[];
  gaps: DetectionGap[];
  limitations: string[];
}

export function runBlueDetectionStage(input: BlueDetectionStageInput): BlueDetectionStageResult {
  const { runId, missionId } = requireRunHeader(input, 'blue-detection');
  const family = requireFamily(input?.family);
  const artifactIds = requireStringArray(input?.artifactIds, 'artifactIds');
  if (typeof input?.artifactBytes !== 'string') {
    throw new Error('blue workflow blue-detection: artifactBytes must be a string');
  }
  if (!Array.isArray(input?.findings)) {
    throw new Error('blue workflow blue-detection: findings must be an array');
  }
  const findings = input.findings;
  const telemetry = Array.isArray(input?.telemetry) ? input.telemetry : [];
  const stage = `blue-detection:${family}`;

  if (artifactIds.length === 0 || !input.artifactBytes) {
    const gaps = detectionGaps(findings, telemetry);
    const inputSha256 = blueInputHash(JSON.stringify({ findings, telemetry }));
    return {
      status: 'insufficient-evidence',
      family,
      artifactIds,
      bindings: findings.map(finding => ({ runId, missionId, stage, tool: 'detectionGaps' as const, inputSha256, itemId: finding.id })),
      gaps,
      limitations: [
        'Missing artifact: no artifact id or artifact bytes were supplied, so the stage fails closed. No finding is covered.',
      ],
    };
  }

  const observed: ObservedArtifactIds = Object.fromEntries(findings.map(finding => [finding.id, artifactIds]));
  const inputSha256 = blueInputHash(`${input.artifactBytes}\n${JSON.stringify({ family, findings, telemetry })}`);
  const gaps = detectionGaps(findings, telemetry, observed);
  const limitations = gaps
    .filter(gap => gap.coverage === 'partial' && gap.recommendedControl.includes('Limitation:'))
    .map(gap => `Finding-id overlap alone is not coverage for ${gap.findingId}: supply an observed artifact id.`);
  return {
    status: 'complete',
    family,
    artifactIds,
    bindings: findings.map(finding => ({ runId, missionId, stage, tool: 'detectionGaps' as const, inputSha256, itemId: finding.id })),
    gaps,
    limitations,
  };
}

// ── Detector standing stage ───────────────────────────────────────────────────

export interface BlueDetectorStageInput extends DetectorValidationInput {
  runId: string;
  missionId: string;
}

export interface BlueDetectorStageResult {
  stage: string;
  inputSha256: string;
  validation: DetectorValidation;
}

/**
 * Run the offline detector-evidence compare. Bad detector arguments throw
 * before anything computes (via validateDetectorStanding). This stage returns
 * no recordReceipt-style binding on purpose: the only citable tools are
 * coverageGaps, detectionGaps, and hardeningPlan — never sigma/yara.
 */
export function runBlueDetectorStage(input: BlueDetectorStageInput): BlueDetectorStageResult {
  const { runId: _runId, missionId: _missionId } = requireRunHeader(input, 'blue-detector');
  void _runId;
  void _missionId;
  const validation = validateDetectorStanding(input);
  const inputSha256 = blueInputHash(
    `${input.pattern}\n${JSON.stringify({ matching: input.matchingEvidence, nonMatching: input.nonMatchingEvidence })}`,
  );
  return { stage: 'blue-detector', inputSha256, validation };
}

// ── Hardening retest stage ────────────────────────────────────────────────────

export interface BlueRetestStageInput {
  runId: string;
  missionId: string;
  item: HardeningItem;
  baselineEvidenceIds: string[];
  retestEvidenceIds: string[];
  retestPassed: boolean;
}

export interface BlueRetestStageResult {
  stage: string;
  outcome: HardeningRetestOutcome;
  item: HardeningItem;
}

/**
 * Resolve a hardening retest from item-linked evidence ids. A prose sentence
 * alone resolves to insufficient-evidence, never successful-retest.
 */
export function runBlueRetestStage(input: BlueRetestStageInput): BlueRetestStageResult {
  requireRunHeader(input, 'blue-retest');
  const item = input?.item;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new Error('blue workflow blue-retest: item must be a hardening work item object');
  }
  if (!Array.isArray(item.findingIds) || typeof item.control !== 'string') {
    throw new Error('blue workflow blue-retest: item must carry findingIds and control');
  }
  const baselineEvidenceIds = requireStringArray(input?.baselineEvidenceIds, 'baselineEvidenceIds');
  const retestEvidenceIds = requireStringArray(input?.retestEvidenceIds, 'retestEvidenceIds');
  if (typeof input?.retestPassed !== 'boolean') {
    throw new Error('blue workflow blue-retest: retestPassed must be a boolean derived from the linked evidence');
  }
  const updated = applyHardeningRetest(item, { baselineEvidenceIds, retestEvidenceIds, retestPassed: input.retestPassed });
  return { stage: 'blue-retest', outcome: updated.retestOutcome, item: updated };
}

// ── Cross-family fan-out ──────────────────────────────────────────────────────

export interface BlueFamilyCoverageResult {
  family: string;
  status: BlueStageStatus;
  gaps: CoverageGap[];
  bindings: BlueStageBinding[];
  limitations: string[];
  error?: string;
}

/**
 * Run the coverage stage across families without letting one family fail the
 * others: per-family throws become `unavailable` results, and a family missing
 * its artifact stays `insufficient-evidence` in isolation.
 */
export function runBlueCoverageAcrossFamilies(input: {
  runId: string;
  missionId: string;
  artifactIds: string[];
  artifactBytes: string;
  findings: CoverageFinding[];
  telemetry: TelemetryDeclaration[];
  families?: readonly string[];
}): BlueFamilyCoverageResult[] {
  const families = input?.families ?? BLUE_WORKFLOW_FAMILIES;
  return families.map(family => {
    try {
      const result = runBlueCoverageStage({ ...input, family });
      return {
        family,
        status: result.status,
        gaps: result.gaps,
        bindings: result.bindings,
        limitations: result.limitations,
      } satisfies BlueFamilyCoverageResult;
    } catch (error) {
      return {
        family,
        status: 'unavailable' as const,
        gaps: [],
        bindings: [],
        limitations: [`Family ${family} is unavailable in isolation: ${error instanceof Error ? error.message : String(error)}`],
        error: error instanceof Error ? error.message : String(error),
      } satisfies BlueFamilyCoverageResult;
    }
  });
}
