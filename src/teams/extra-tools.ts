/**
 * Cross-Hat Extra Utility Tools — Context Transformer, Artifact Diff,
 * Versioned Snapshot Manager, and Cross-Hat Batch Runner.
 *
 * Refs SPE-14019, SPE-14033
 */

import { createHash } from 'node:crypto';
import { migrateWorkspaceState, sanitizeInput, type HatDomain, type MigratedWorkspaceState } from './guardrails.js';
import { HAT_TOOL_REGISTRY } from './skills.js';

function sha256Short(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}

// =============================================================================
// 1. CONTEXT TRANSFORMER ("Send to Hat")
// =============================================================================

export interface ContextTransformInput {
  fromHat?: HatDomain;
  toHat?: HatDomain;
  sourceToolId?: string;
  targetToolId?: string;
  payload?: unknown;
  note?: string;
}

export interface ContextTransformResult {
  state: 'empty' | 'success';
  fromHat: HatDomain;
  toHat: HatDomain;
  targetToolId: string;
  transformedInput: Record<string, unknown>;
  provenanceHash: string;
  summary: string;
}

const DEFAULT_TARGET_TOOL_BY_HAT: Record<HatDomain, string> = {
  blue: 'blue-workflow-sequencer',
  white: 'white-data-inspector',
  black: 'black-risk-analyzer',
  red: 'red-surface-validator',
};

/**
 * Extra Tool 1: Context Transformer (`runContextTransformTool`).
 * Converts structured output from one Hat tool into the input schema of a
 * target Hat tool for one-click cross-Hat forwarding.
 */
export function runContextTransformTool(
  input: ContextTransformInput,
): ContextTransformResult {
  const fromHat: HatDomain = input.fromHat ?? 'white';
  const toHat: HatDomain = input.toHat ?? 'blue';
  const targetToolId = (input.targetToolId ?? '').trim() || DEFAULT_TARGET_TOOL_BY_HAT[toHat];
  const sanitizedPayload = sanitizeInput(input.payload);

  if (
    sanitizedPayload === undefined
    || sanitizedPayload === null
    || (typeof sanitizedPayload === 'string' && sanitizedPayload.trim().length === 0)
  ) {
    return {
      state: 'empty',
      fromHat,
      toHat,
      targetToolId,
      transformedInput: {},
      provenanceHash: `sha256-${sha256Short('empty')}`,
      summary: `No payload supplied to transform from ${fromHat.toUpperCase()} to ${toHat.toUpperCase()}.`,
    };
  }

  const rawText = typeof sanitizedPayload === 'string'
    ? sanitizedPayload
    : JSON.stringify(sanitizedPayload, null, 2);
  const provenanceHash = `sha256-${sha256Short(`${fromHat}:${toHat}:${targetToolId}:${rawText}`)}`;
  const note = (input.note ?? '').trim() || `Forwarded from ${fromHat.toUpperCase()} (${input.sourceToolId ?? 'workspace'})`;
  const payloadRecord = typeof sanitizedPayload === 'object' && sanitizedPayload !== null && !Array.isArray(sanitizedPayload)
    ? (sanitizedPayload as Record<string, unknown>)
    : null;
  const sourceArtifactId = typeof payloadRecord?.artifactId === 'string' && payloadRecord.artifactId.trim()
    ? payloadRecord.artifactId.trim()
    : undefined;
  const sourceSha256 = typeof payloadRecord?.sha256 === 'string' && payloadRecord.sha256.trim()
    ? payloadRecord.sha256.trim()
    : undefined;
  const sourceCorroboratedBy = Array.isArray(payloadRecord?.corroboratedBy)
    ? payloadRecord.corroboratedBy.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const sourceContradictedBy = Array.isArray(payloadRecord?.contradictedBy)
    ? payloadRecord.contradictedBy.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const sourceEvidenceRefs = Array.isArray(payloadRecord?.evidenceRefs)
    ? payloadRecord.evidenceRefs.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : (sourceArtifactId ? [sourceArtifactId] : []);
  const sourceVerified = (payloadRecord?.verified === true || payloadRecord?.confidence === 'verified')
    && Boolean(sourceArtifactId)
    && Boolean(sourceSha256)
    && sourceCorroboratedBy.length > 0
    && sourceContradictedBy.length === 0;
  const sourceDecisionStatus = payloadRecord?.status === 'rejected' || sourceContradictedBy.length > 0
    ? 'rejected'
    : (payloadRecord?.status === 'accepted' && sourceEvidenceRefs.length > 0 ? 'accepted' : 'deferred');

  let transformedInput: Record<string, unknown>;

  if (toHat === 'blue') {
    if (targetToolId === 'blue-decision-ledger') {
      transformedInput = {
        sessionId: `handoff-${provenanceHash.slice(7, 15)}`,
        objective: note,
        decisions: [
          {
            fromHat,
            toHat: 'blue',
            summary: note,
            rationale: `Imported ${fromHat.toUpperCase()} output (${provenanceHash})`,
            evidenceRefs: sourceEvidenceRefs,
            evidenceHash: sourceSha256,
            status: sourceDecisionStatus,
          },
        ],
      };
    } else {
      transformedInput = {
        workflowName: `${fromHat.toUpperCase()} → BLUE Follow-up Pipeline`,
        objective: note,
        steps: [
          { hat: fromHat, toolId: input.sourceToolId ?? `${fromHat}-source`, label: `Ingest ${fromHat.toUpperCase()} context`, condition: 'always', checkpoint: true, inputSummary: provenanceHash },
          { hat: 'blue', toolId: 'coverageGaps', label: 'Evaluate Blue Hat defensive controls', condition: 'always', checkpoint: true },
        ],
      };
    }
  } else if (toHat === 'white') {
    if (targetToolId === 'white-evidence-collector') {
      const fact: Record<string, unknown> = {
        claim: note,
        source: `${fromHat.toUpperCase()}:${input.sourceToolId ?? 'tool'}`,
        tags: [fromHat, 'forwarded'],
      };
      if (sourceArtifactId) fact.artifactId = sourceArtifactId;
      if (sourceSha256) fact.sha256 = sourceSha256;
      if (sourceCorroboratedBy.length > 0) fact.corroboratedBy = sourceCorroboratedBy;
      if (sourceContradictedBy.length > 0) fact.contradictedBy = sourceContradictedBy;
      transformedInput = {
        facts: [fact],
      };
    } else if (targetToolId === 'white-gap-analyzer') {
      transformedInput = {
        objective: note,
        requiredVariables: ['scope_target', 'telemetry_source', 'approval_receipt'],
        knownFacts: [
          { variable: 'scope_target', value: rawText.slice(0, 80), verified: sourceVerified, source: fromHat },
        ],
      };
    } else {
      transformedInput = {
        rawPayload: rawText,
        format: 'auto',
      };
    }
  } else if (toHat === 'black') {
    if (targetToolId === 'black-policy-validator') {
      transformedInput = {
        artifactName: `${fromHat}-forwarded-artifact`,
        rawConfig: rawText,
        policyProfile: 'all',
      };
    } else {
      transformedInput = {
        planName: `${fromHat.toUpperCase()} → BLACK Risk Review`,
        components: [
          {
            name: `${fromHat.toUpperCase()} Forwarded Artifact`,
            category: 'workflow',
            singlePointOfFailure: true,
            handlesSecrets: /token|secret|key|bearer/i.test(rawText),
            noiseLevel: fromHat === 'red' ? 'high' : 'low',
            hasFallback: false,
          },
        ],
        assumptions: [note],
      };
    }
  } else {
    const explicitTarget = [payloadRecord?.target, payloadRecord?.host, payloadRecord?.scope]
      .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)?.trim() ?? '';
    transformedInput = {
      target: explicitTarget,
      requiresTargetSelection: explicitTarget.length === 0,
      contextNote: note,
      upstreamHash: provenanceHash,
      rawContext: rawText.slice(0, 500),
    };
  }

  return {
    state: 'success',
    fromHat,
    toHat,
    targetToolId,
    transformedInput,
    provenanceHash,
    summary: `Transformed ${fromHat.toUpperCase()} output into ${toHat.toUpperCase()} (${targetToolId}) input [${provenanceHash}].`,
  };
}

// =============================================================================
// 2. ARTIFACT DIFF TOOL
// =============================================================================

export interface ArtifactDiffInput {
  beforeLabel?: string;
  afterLabel?: string;
  before?: string | Record<string, unknown>;
  after?: string | Record<string, unknown>;
}

export interface ArtifactDiffHunk {
  index: number;
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface ArtifactDiffResult {
  state: 'empty' | 'success';
  beforeLabel: string;
  afterLabel: string;
  identical: boolean;
  addedLines: number;
  removedLines: number;
  changedKeys: readonly string[];
  hunks: readonly ArtifactDiffHunk[];
  summary: string;
}

function normalizeDiffText(val: string | Record<string, unknown> | undefined): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  return JSON.stringify(val, null, 2);
}

/**
 * Extra Tool 2: Artifact Diff Tool (`runArtifactDiffTool`).
 * Computes structural key diffs and line-by-line diff hunks between two artifacts.
 */
export function runArtifactDiffTool(
  input: ArtifactDiffInput = {},
): ArtifactDiffResult {
  const beforeLabel = (input.beforeLabel ?? '').trim() || 'baseline';
  const afterLabel = (input.afterLabel ?? '').trim() || 'candidate';
  const beforeText = normalizeDiffText(input.before);
  const afterText = normalizeDiffText(input.after);

  if (!beforeText && !afterText) {
    return {
      state: 'empty',
      beforeLabel,
      afterLabel,
      identical: true,
      addedLines: 0,
      removedLines: 0,
      changedKeys: [],
      hunks: [],
      summary: 'Both baseline and candidate artifacts are empty.',
    };
  }

  const changedKeys: string[] = [];
  if (typeof input.before === 'object' && input.before !== null && typeof input.after === 'object' && input.after !== null) {
    const allKeys = new Set([...Object.keys(input.before), ...Object.keys(input.after)]);
    for (const k of [...allKeys].sort()) {
      const bVal = JSON.stringify((input.before as Record<string, unknown>)[k]);
      const aVal = JSON.stringify((input.after as Record<string, unknown>)[k]);
      if (bVal !== aVal) changedKeys.push(k);
    }
  }

  const beforeLines = beforeText.split(/\r?\n/);
  const afterLines = afterText.split(/\r?\n/);
  const hunks: ArtifactDiffHunk[] = [];
  let addedLines = 0;
  let removedLines = 0;

  const maxLen = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < maxLen; i += 1) {
    const bLine = beforeLines[i];
    const aLine = afterLines[i];
    if (bLine === aLine && bLine !== undefined) {
      hunks.push({ index: hunks.length, type: 'unchanged', text: bLine });
    } else {
      if (bLine !== undefined) {
        removedLines += 1;
        hunks.push({ index: hunks.length, type: 'removed', text: bLine });
      }
      if (aLine !== undefined) {
        addedLines += 1;
        hunks.push({ index: hunks.length, type: 'added', text: aLine });
      }
    }
  }

  const identical = addedLines === 0 && removedLines === 0;
  return {
    state: 'success',
    beforeLabel,
    afterLabel,
    identical,
    addedLines,
    removedLines,
    changedKeys,
    hunks,
    summary: identical
      ? `Artifacts "${beforeLabel}" and "${afterLabel}" are byte-identical.`
      : `Diff "${beforeLabel}" → "${afterLabel}": +${addedLines} added, -${removedLines} removed line(s)${changedKeys.length > 0 ? ` (changed keys: ${changedKeys.join(', ')})` : ''}.`,
  };
}

// =============================================================================
// 3. SNAPSHOT MANAGER
// =============================================================================

export interface SnapshotManagerInput {
  action?: 'create' | 'verify' | 'restore';
  label?: string;
  activeHat?: HatDomain;
  workspaceState?: Record<string, unknown>;
  snapshotToVerify?: {
    id: string;
    version: number;
    sha256: string;
    state: Record<string, unknown>;
  };
}

export interface SnapshotManagerResult {
  state: 'empty' | 'error' | 'success';
  action: 'create' | 'verify' | 'restore';
  snapshotId: string;
  version: 2;
  sha256: string;
  integrityVerified: boolean;
  activeHat: HatDomain;
  restoredState: MigratedWorkspaceState | Record<string, unknown>;
  summary: string;
}

/**
 * Extra Tool 3: Snapshot Manager (`runSnapshotManagerTool`).
 * Creates, verifies, and restores versioned (`v2`) SHA-256 signed workspace snapshots.
 */
export function runSnapshotManagerTool(
  input: SnapshotManagerInput = {},
): SnapshotManagerResult {
  const action = input.action ?? 'create';
  const label = (input.label ?? '').trim() || 'workspace-snapshot';

  if (action === 'verify' || action === 'restore') {
    const snap = input.snapshotToVerify;
    if (!snap || typeof snap.sha256 !== 'string' || !snap.sha256.trim()) {
      return {
        state: 'empty',
        action,
        snapshotId: 'none',
        version: 2,
        sha256: '',
        integrityVerified: false,
        activeHat: 'blue',
        restoredState: {},
        summary: `No signed snapshot supplied for ${action === 'restore' ? 'restore' : 'integrity verification'}.`,
      };
    }
    const migrated = migrateWorkspaceState(snap.state);
    const expectedSha = `sha256-${sha256Short(JSON.stringify(migrated))}`;
    const integrityVerified = snap.sha256 === expectedSha;
    return {
      state: integrityVerified ? 'success' : 'error',
      action,
      snapshotId: snap.id || label,
      version: 2,
      sha256: expectedSha,
      integrityVerified,
      activeHat: migrated.activeHat,
      restoredState: integrityVerified ? migrated : {},
      summary: integrityVerified
        ? `${action === 'restore' ? 'Restored' : 'Snapshot'} "${snap.id}" passed SHA-256 integrity verification (${expectedSha}).`
        : `Snapshot "${snap.id}" hash mismatch: expected ${expectedSha} but received ${snap.sha256}.`,
    };
  }

  const rawState = input.snapshotToVerify?.state ?? input.workspaceState ?? (input.activeHat ? { activeHat: input.activeHat } : {});
  const migrated = migrateWorkspaceState(rawState);
  const sha256 = `sha256-${sha256Short(JSON.stringify(migrated))}`;
  const snapshotId = `snap-${label}-${sha256.slice(7, 15)}`;

  return {
    state: 'success',
    action,
    snapshotId,
    version: 2,
    sha256,
    integrityVerified: true,
    activeHat: migrated.activeHat,
    restoredState: migrated,
    summary: `Created v2 workspace snapshot "${snapshotId}" for ${migrated.activeHat.toUpperCase()} Hat (${sha256}).`,
  };
}

// =============================================================================
// 4. CROSS-HAT BATCH RUNNER
// =============================================================================

export interface BatchJobInput {
  id: string;
  hat: HatDomain;
  toolId: string;
  payloadSummary: string;
  simulateError?: boolean;
}

export interface BatchRunnerInput {
  batchName?: string;
  jobs?: readonly BatchJobInput[];
  stopOnError?: boolean;
}

export interface BatchJobResult {
  id: string;
  hat: HatDomain;
  toolId: string;
  status: 'success' | 'error' | 'skipped';
  outputSummary: string;
  durationMs?: number;
}

export interface BatchRunnerResult {
  state: 'empty' | 'error' | 'success';
  batchName: string;
  totalJobs: number;
  succeededJobs: number;
  failedJobs: number;
  skippedJobs: number;
  results: readonly BatchJobResult[];
}

function isKnownBatchToolId(toolId: string): boolean {
  return HAT_TOOL_REGISTRY.some((t) => t.id === toolId);
}

/**
 * Extra Tool 4: Cross-Hat Batch Runner (`runBatchRunnerTool`).
 * Runs a batch of cross-Hat tool jobs with optional fail-fast stop-on-error.
 */
export function runBatchRunnerTool(
  input: BatchRunnerInput = {},
): BatchRunnerResult {
  const batchName = (input.batchName ?? '').trim() || 'Cross-Hat Verification Batch';
  const jobs = input.jobs ?? [];
  const stopOnError = input.stopOnError ?? true;

  if (jobs.length === 0) {
    return {
      state: 'empty',
      batchName,
      totalJobs: 0,
      succeededJobs: 0,
      failedJobs: 0,
      skippedJobs: 0,
      results: [],
    };
  }

  const results: BatchJobResult[] = [];
  let succeededJobs = 0;
  let failedJobs = 0;
  let skippedJobs = 0;
  let halted = false;

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const id = (job.id ?? '').trim() || `job-${i + 1}`;
    const rawToolId = (job.toolId ?? '').trim();
    const toolId = rawToolId || 'unassigned';

    if (halted) {
      skippedJobs += 1;
      results.push({
        id,
        hat: job.hat,
        toolId,
        status: 'skipped',
        outputSummary: 'Skipped due to stopOnError on preceding job.',
        durationMs: 0,
      });
      continue;
    }

    if (job.simulateError === true || !rawToolId || !isKnownBatchToolId(rawToolId)) {
      failedJobs += 1;
      if (stopOnError) halted = true;
      const reason = !rawToolId
        ? 'missing toolId'
        : !isKnownBatchToolId(rawToolId)
          ? `unknown toolId "${rawToolId}"`
          : 'reported execution failure';
      results.push({
        id,
        hat: job.hat,
        toolId,
        status: 'error',
        outputSummary: `Batch job "${id}" (${toolId}) ${reason}.`,
        durationMs: 0,
      });
      continue;
    }

    succeededJobs += 1;
    results.push({
      id,
      hat: job.hat,
      toolId,
      status: 'success',
      outputSummary: `[${job.hat.toUpperCase()}] Staged batch job ${toolId}: ${job.payloadSummary || 'validated catalog tool'}`,
    });
  }

  return {
    state: failedJobs > 0 ? 'error' : 'success',
    batchName,
    totalJobs: jobs.length,
    succeededJobs,
    failedJobs,
    skippedJobs,
    results,
  };
}
