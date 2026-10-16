/**
 * Blue Hat Component Tools — Process Control, Workflow Sequencing,
 * Session & Decision Ledger, and Execution Monitor & Dispatcher.
 *
 * Pure deterministic local analyzers with explicit loading/empty/error/success
 * state contracts and cross-Hat handoff support.
 *
 * Refs SPE-14019, SPE-14034
 */

import { createHash } from 'node:crypto';
import { HAT_TOOL_REGISTRY } from '../skills.js';

export type BlueToolHat = 'blue' | 'white' | 'black' | 'red';
export type BlueStepCondition = 'always' | 'on_findings' | 'on_gaps' | 'on_high_risk';

export interface BlueWorkflowStepInput {
  id?: string;
  hat: BlueToolHat;
  toolId: string;
  label?: string;
  condition?: BlueStepCondition;
  checkpoint?: boolean;
  inputSummary?: string;
  simulateFailure?: boolean;
}

export interface BlueWorkflowSequencerInput {
  workflowName?: string;
  objective?: string;
  steps?: readonly BlueWorkflowStepInput[];
  contextSignals?: {
    hasFindings?: boolean;
    hasGaps?: boolean;
    highRiskDetected?: boolean;
  };
  resumeFromStep?: number;
}

export interface BlueStarterTemplate {
  id: string;
  name: string;
  description: string;
  steps: ReadonlyArray<{
    hat: BlueToolHat;
    toolId: string;
    label: string;
    condition: BlueStepCondition;
    checkpoint: boolean;
  }>;
}

export interface BlueWorkflowTimelineItem {
  stepIndex: number;
  id: string;
  hat: BlueToolHat;
  toolId: string;
  label: string;
  condition: BlueStepCondition;
  status: 'completed' | 'skipped' | 'failed' | 'pending';
  checkpointHash?: string;
  outputSummary: string;
  durationMs: number;
}

export interface BlueFailedStepIsolation {
  stepIndex: number;
  toolId: string;
  errorMessage: string;
  retryFromStep: number;
  fallbackOption: string;
}

export interface BlueWorkflowSequencerResult {
  state: 'empty' | 'error' | 'success';
  workflowName: string;
  objective: string;
  starterTemplates: readonly BlueStarterTemplate[];
  timeline: readonly BlueWorkflowTimelineItem[];
  failedStep?: BlueFailedStepIsolation;
  synthesisReport: string;
  nextHatHandoff?: {
    targetHat: BlueToolHat;
    reason: string;
  };
}

export const BLUE_STARTER_TEMPLATES: readonly BlueStarterTemplate[] = [
  {
    id: 'd3fend-verification-chain',
    name: 'D3FEND Coverage → ROE Audit → Hardening Retest',
    description: 'Sequence White Hat fact inspection, Blue Hat D3FEND detector mapping, and Black Hat policy validation.',
    steps: [
      { hat: 'white', toolId: 'white-data-inspector', label: 'Inspect telemetry & evidence schema', condition: 'always', checkpoint: true },
      { hat: 'blue', toolId: 'coverageGaps', label: 'Map D3FEND coverage gaps', condition: 'on_findings', checkpoint: true },
      { hat: 'black', toolId: 'black-policy-validator', label: 'Validate hardening policy boundaries', condition: 'on_gaps', checkpoint: false },
      { hat: 'blue', toolId: 'blue-decision-ledger', label: 'Record retest decision ledger', condition: 'always', checkpoint: true },
    ],
  },
  {
    id: 'cross-hat-containment-loop',
    name: 'Cross-Hat Containment & Risk Mitigation Loop',
    description: 'Route Red findings through Black failure-mode analysis and White gap verification into Blue containment.',
    steps: [
      { hat: 'red', toolId: 'recon', label: 'Ingest scoped Red surface findings', condition: 'always', checkpoint: true },
      { hat: 'black', toolId: 'black-risk-analyzer', label: 'Analyze failure modes & egress exposure', condition: 'on_findings', checkpoint: true },
      { hat: 'white', toolId: 'white-gap-analyzer', label: 'Identify unverified scope assumptions', condition: 'on_high_risk', checkpoint: false },
      { hat: 'blue', toolId: 'hardeningPlan', label: 'Synthesize prioritized hardening plan', condition: 'always', checkpoint: true },
    ],
  },
  {
    id: 'roe-to-hardening-retest',
    name: 'White ROE Gate → Blue Detector Validation',
    description: 'Verify ROE standing and evidence provenance before running detector validation and retest.',
    steps: [
      { hat: 'white', toolId: 'white-evidence-collector', label: 'Verify artifact provenance & hashes', condition: 'always', checkpoint: true },
      { hat: 'blue', toolId: 'detectionGaps', label: 'Validate Sigma/YARA detector standing', condition: 'always', checkpoint: true },
    ],
  },
];

const LEGACY_SEQUENCER_STAGE_IDS: ReadonlySet<string> = new Set([
  'coverageGaps',
  'recon',
  'hardeningPlan',
  'detectionGaps',
]);

function isKnownSequencerToolId(toolId: string): boolean {
  return LEGACY_SEQUENCER_STAGE_IDS.has(toolId) || HAT_TOOL_REGISTRY.some((t) => t.id === toolId);
}

function shortSha256(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}

function shouldExecuteStep(
  condition: BlueStepCondition,
  signals: { hasFindings: boolean; hasGaps: boolean; highRiskDetected: boolean },
): boolean {
  switch (condition) {
    case 'always':
      return true;
    case 'on_findings':
      return signals.hasFindings;
    case 'on_gaps':
      return signals.hasGaps;
    case 'on_high_risk':
      return signals.highRiskDetected;
  }
}

/**
 * Blue Hat Tool 1: Workflow Sequencer (`runBlueWorkflowSequencer`).
 * Defines, chains, and executes multi-step workflows across Hats with conditional
 * branching, checkpoint hashes, and step-level failure isolation.
 */
export function runBlueWorkflowSequencer(
  input: BlueWorkflowSequencerInput = {},
): BlueWorkflowSequencerResult {
  const workflowName = (input.workflowName ?? '').trim() || 'Blue Hat Multi-Perspective Sequence';
  const objective = (input.objective ?? '').trim() || 'Coordinate verification across Blue, White, Black, and Red Hats';
  const steps = input.steps ?? [];

  if (steps.length === 0) {
    return {
      state: 'empty',
      workflowName,
      objective,
      starterTemplates: BLUE_STARTER_TEMPLATES,
      timeline: [],
      synthesisReport: 'No active workflow steps configured. Select one of the guided starter templates to initialize a cross-Hat pipeline.',
      nextHatHandoff: {
        targetHat: 'white',
        reason: 'Initialize pipeline with White Hat Structured Data Inspector to establish baseline facts.',
      },
    };
  }

  const signals = {
    hasFindings: input.contextSignals?.hasFindings ?? true,
    hasGaps: input.contextSignals?.hasGaps ?? true,
    highRiskDetected: input.contextSignals?.highRiskDetected ?? true,
  };
  const resumeFromStep = Math.max(0, Math.min(steps.length - 1, input.resumeFromStep ?? 0));

  const timeline: BlueWorkflowTimelineItem[] = [];
  let failedStep: BlueFailedStepIsolation | undefined;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const stepId = (step.id ?? '').trim() || `step-${i + 1}`;
    const toolId = (step.toolId ?? '').trim();
    const label = (step.label ?? '').trim() || `${step.hat.toUpperCase()} · ${toolId || 'unassigned'}`;
    const condition: BlueStepCondition = step.condition ?? 'always';

    if (failedStep) {
      timeline.push({
        stepIndex: i,
        id: stepId,
        hat: step.hat,
        toolId: toolId || 'unassigned',
        label,
        condition,
        status: 'pending',
        outputSummary: `Held pending resolution of failed step ${failedStep.stepIndex + 1} (${failedStep.toolId}).`,
        durationMs: 0,
      });
      continue;
    }

    if (i < resumeFromStep) {
      timeline.push({
        stepIndex: i,
        id: stepId,
        hat: step.hat,
        toolId: toolId || 'unassigned',
        label,
        condition,
        status: 'skipped',
        outputSummary: `Skipped prior to resume checkpoint (step ${resumeFromStep + 1}).`,
        durationMs: 0,
      });
      continue;
    }

    if (!toolId || !isKnownSequencerToolId(toolId) || step.simulateFailure === true) {
      const errorMessage = !toolId
        ? `Step ${i + 1} is missing a valid toolId`
        : !isKnownSequencerToolId(toolId)
          ? `Step ${i + 1} references unknown toolId "${toolId}"`
          : `Step ${i + 1} (${toolId}) reported simulated execution failure`;
      failedStep = {
        stepIndex: i,
        toolId: toolId || 'missing-tool-id',
        errorMessage,
        retryFromStep: i,
        fallbackOption: i + 1 < steps.length
          ? `Skip step ${i + 1} and resume from step ${i + 2} (${steps[i + 1].toolId})`
          : 'Route failure payload to Black Hat Risk Analyzer for root-cause triage',
      };
      timeline.push({
        stepIndex: i,
        id: stepId,
        hat: step.hat,
        toolId: toolId || 'missing-tool-id',
        label,
        condition,
        status: 'failed',
        outputSummary: errorMessage,
        durationMs: 0,
      });
      continue;
    }

    if (!shouldExecuteStep(condition, signals)) {
      timeline.push({
        stepIndex: i,
        id: stepId,
        hat: step.hat,
        toolId,
        label,
        condition,
        status: 'skipped',
        outputSummary: `Condition "${condition}" evaluated to false under current context signals.`,
        durationMs: 0,
      });
      continue;
    }

    const checkpointHash = step.checkpoint
      ? `chk-${shortSha256(`${workflowName}:${i}:${step.hat}:${toolId}:${step.inputSummary ?? ''}`)}`
      : undefined;

    timeline.push({
      stepIndex: i,
      id: stepId,
      hat: step.hat,
      toolId,
      label,
      condition,
      status: 'completed',
      ...(checkpointHash ? { checkpointHash } : {}),
      outputSummary: `[${step.hat.toUpperCase()}] Staged plan step ${toolId}${step.inputSummary ? ` on "${step.inputSummary}"` : ''} — dry-run sequence checkpoint ready for downstream handoff.`,
      durationMs: 0,
    });
  }

  if (failedStep) {
    return {
      state: 'error',
      workflowName,
      objective,
      starterTemplates: BLUE_STARTER_TEMPLATES,
      timeline,
      failedStep,
      synthesisReport: `Workflow halted at step ${failedStep.stepIndex + 1} (${failedStep.toolId}): ${failedStep.errorMessage}. Retry from step ${failedStep.retryFromStep + 1} or apply fallback.`,
      nextHatHandoff: {
        targetHat: 'black',
        reason: `Audit failed step ${failedStep.toolId} in Black Hat Risk & Failure Mode Analyzer.`,
      },
    };
  }

  const completedCount = timeline.filter(t => t.status === 'completed').length;
  const skippedCount = timeline.filter(t => t.status === 'skipped').length;
  const lastCompleted = [...timeline].reverse().find(t => t.status === 'completed');

  return {
    state: 'success',
    workflowName,
    objective,
    starterTemplates: BLUE_STARTER_TEMPLATES,
    timeline,
    synthesisReport: `Workflow plan "${workflowName}" staged ${completedCount} of ${timeline.length} step(s) (${skippedCount} skipped) for objective: ${objective}.`,
    nextHatHandoff: {
      targetHat: lastCompleted?.hat === 'blue' ? 'white' : 'blue',
      reason: 'Record completed workflow checkpoints in the Blue Hat Session & Decision Ledger.',
    },
  };
}

// =============================================================================
// 2. SESSION & DECISION LEDGER
// =============================================================================

export interface BlueDecisionEntryInput {
  id?: string;
  fromHat: BlueToolHat;
  toHat: BlueToolHat;
  summary: string;
  rationale: string;
  evidenceRefs?: readonly string[];
  evidenceHash?: string;
  status?: 'accepted' | 'deferred' | 'rejected';
}

export interface BlueDecisionLedgerInput {
  sessionId?: string;
  objective?: string;
  constraints?: readonly string[];
  decisions?: readonly BlueDecisionEntryInput[];
}

export interface BlueDecisionEntryRecord {
  index: number;
  id: string;
  fromHat: BlueToolHat;
  toHat: BlueToolHat;
  summary: string;
  rationale: string;
  evidenceRefs: readonly string[];
  evidenceHash?: string;
  status: 'accepted' | 'deferred' | 'rejected';
  entryHash: string;
}

export interface BlueDecisionLedgerResult {
  state: 'empty' | 'error' | 'success';
  sessionId: string;
  objective: string;
  constraints: readonly string[];
  entries: readonly BlueDecisionEntryRecord[];
  hatTransitionCount: number;
  unbackedDecisionCount: number;
  ledgerDigest: string;
  exportMarkdown: string;
  exportJson: string;
}

/**
 * Blue Hat Tool 2: Session & Decision Ledger (`runBlueDecisionLedger`).
 * Tracks active objectives, constraints, cross-Hat transitions, and auditable
 * conclusions with Markdown and JSON export.
 */
export function runBlueDecisionLedger(
  input: BlueDecisionLedgerInput = {},
): BlueDecisionLedgerResult {
  const sessionId = (input.sessionId ?? '').trim() || 'session-default';
  const objective = (input.objective ?? '').trim();
  const constraints = (input.constraints ?? []).map(c => c.trim()).filter(Boolean);
  const decisions = input.decisions ?? [];

  if (!objective && decisions.length === 0) {
    return {
      state: 'empty',
      sessionId,
      objective: 'No active session objective set',
      constraints: [],
      entries: [],
      hatTransitionCount: 0,
      unbackedDecisionCount: 0,
      ledgerDigest: `sha256-${shortSha256('empty-ledger')}`,
      exportMarkdown: '# Blue Hat Decision Ledger (Empty)\n\nAdd an objective and cross-Hat transition entries to generate an auditable session summary.',
      exportJson: JSON.stringify({ sessionId, entries: [] }, null, 2),
    };
  }

  const entries: BlueDecisionEntryRecord[] = [];
  let hatTransitionCount = 0;
  let unbackedDecisionCount = 0;

  for (let i = 0; i < decisions.length; i += 1) {
    const d = decisions[i];
    const id = (d.id ?? '').trim() || `dec-${i + 1}`;
    const summary = (d.summary ?? '').trim();
    const rationale = (d.rationale ?? '').trim() || 'No explicit rationale provided';
    const evidenceRefs = (d.evidenceRefs ?? []).map(r => r.trim()).filter(Boolean);
    const evidenceHash = (d.evidenceHash ?? '').trim();
    const status = d.status ?? 'accepted';

    if (!summary) {
      return {
        state: 'error',
        sessionId,
        objective: objective || 'Unspecified objective',
        constraints,
        entries,
        hatTransitionCount,
        unbackedDecisionCount,
        ledgerDigest: `sha256-${shortSha256(`error:${i}`)}`,
        exportMarkdown: `# Blue Hat Decision Ledger Error\n\nDecision entry at index ${i} is missing a non-empty summary.`,
        exportJson: JSON.stringify({ error: `Decision at index ${i} is missing summary` }),
      };
    }

    if (d.fromHat !== d.toHat) {
      hatTransitionCount += 1;
    }
    if (evidenceRefs.length === 0 && status === 'accepted') {
      unbackedDecisionCount += 1;
    }

    const entryHash = `sha256-${shortSha256(
      JSON.stringify([
        sessionId,
        i,
        id,
        d.fromHat,
        d.toHat,
        summary,
        rationale,
        status,
        evidenceRefs,
        evidenceHash,
      ]),
    )}`;
    entries.push({
      index: i,
      id,
      fromHat: d.fromHat,
      toHat: d.toHat,
      summary,
      rationale,
      evidenceRefs,
      ...(evidenceHash ? { evidenceHash } : {}),
      status,
      entryHash,
    });
  }

  const resolvedObjective = objective || 'Cross-Hat Operational Session';
  const ledgerDigest = `sha256-${shortSha256(
    JSON.stringify([sessionId, resolvedObjective, constraints, entries.map(e => e.entryHash)]),
  )}`;
  const mdLines: string[] = [
    `# Blue Hat Session & Decision Ledger — ${sessionId}`,
    '',
    `- **Objective:** ${resolvedObjective}`,
    `- **Ledger Digest:** \`${ledgerDigest}\``,
    `- **Hat Transitions:** ${hatTransitionCount}`,
    `- **Unbacked Accepted Decisions:** ${unbackedDecisionCount}`,
  ];
  if (constraints.length > 0) {
    mdLines.push('', '## Constraints', ...constraints.map(c => `- ${c}`));
  }
  mdLines.push('', '## Decisions');
  for (const e of entries) {
    const refs = e.evidenceRefs.length > 0 ? e.evidenceRefs.join(', ') : 'none (unbacked)';
    mdLines.push(
      `${e.index + 1}. **[${e.fromHat.toUpperCase()} → ${e.toHat.toUpperCase()}] (${e.status})** ${e.summary}`,
      `   - Rationale: ${e.rationale}`,
      `   - Evidence Refs: \`${refs}\`${e.evidenceHash ? ` · Evidence Hash: \`${e.evidenceHash}\`` : ''} · Hash: \`${e.entryHash}\``,
    );
  }

  const exportMarkdown = mdLines.join('\n');
  const exportJson = JSON.stringify(
    {
      sessionId,
      objective: resolvedObjective,
      constraints,
      ledgerDigest,
      hatTransitionCount,
      unbackedDecisionCount,
      entries,
    },
    null,
    2,
  );

  return {
    state: 'success',
    sessionId,
    objective: resolvedObjective,
    constraints,
    entries,
    hatTransitionCount,
    unbackedDecisionCount,
    ledgerDigest,
    exportMarkdown,
    exportJson,
  };
}

// =============================================================================
// 3. EXECUTION MONITOR & DISPATCHER
// =============================================================================

export interface BlueMonitorTaskInput {
  id: string;
  hat: BlueToolHat;
  toolId: string;
  status: 'running' | 'queued' | 'completed' | 'failed' | 'timed_out';
  elapsedMs: number;
  retries?: number;
  maxRetries?: number;
}

export interface BlueExecutionMonitorInput {
  budgetLimitMs?: number;
  maxConcurrency?: number;
  tasks?: readonly BlueMonitorTaskInput[];
}

export interface BlueDispatchAction {
  taskId: string;
  hat: BlueToolHat;
  toolId: string;
  action: 'continue' | 'dispatch_now' | 'retry' | 'backoff_cancel' | 'archive';
  reason: string;
}

export interface BlueHatRuntimeStat {
  total: number;
  running: number;
  queued: number;
  failed: number;
  elapsedMs: number;
}

export interface BlueExecutionMonitorResult {
  state: 'empty' | 'error' | 'success';
  queueDepth: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  budgetUsedMs: number;
  budgetLimitMs: number;
  budgetUtilizationPct: number;
  withinBudget: boolean;
  perHatStats: Record<BlueToolHat, BlueHatRuntimeStat>;
  dispatchActions: readonly BlueDispatchAction[];
}

/**
 * Blue Hat Tool 3: Execution Monitor & Dispatcher (`runBlueExecutionMonitor`).
 * Inspects active tool runs, queue depth, execution timing, retry controls,
 * and resource budgets across all 4 Hats.
 */
export function runBlueExecutionMonitor(
  input: BlueExecutionMonitorInput = {},
): BlueExecutionMonitorResult {
  const budgetLimitMs = typeof input.budgetLimitMs === 'number' && input.budgetLimitMs > 0
    ? input.budgetLimitMs
    : 60_000;
  const maxConcurrency = typeof input.maxConcurrency === 'number' && input.maxConcurrency > 0
    ? input.maxConcurrency
    : 4;
  const tasks = input.tasks ?? [];

  const perHatStats: Record<BlueToolHat, BlueHatRuntimeStat> = {
    red: { total: 0, running: 0, queued: 0, failed: 0, elapsedMs: 0 },
    blue: { total: 0, running: 0, queued: 0, failed: 0, elapsedMs: 0 },
    black: { total: 0, running: 0, queued: 0, failed: 0, elapsedMs: 0 },
    white: { total: 0, running: 0, queued: 0, failed: 0, elapsedMs: 0 },
  };

  if (tasks.length === 0) {
    return {
      state: 'empty',
      queueDepth: 0,
      runningCount: 0,
      completedCount: 0,
      failedCount: 0,
      budgetUsedMs: 0,
      budgetLimitMs,
      budgetUtilizationPct: 0,
      withinBudget: true,
      perHatStats,
      dispatchActions: [],
    };
  }

  let queueDepth = 0;
  let runningCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let budgetUsedMs = 0;

  for (const t of tasks) {
    const elapsed = Math.max(0, t.elapsedMs || 0);
    budgetUsedMs += elapsed;
    const bucket = perHatStats[t.hat];
    bucket.total += 1;
    bucket.elapsedMs += elapsed;

    if (t.status === 'queued') {
      queueDepth += 1;
      bucket.queued += 1;
    } else if (t.status === 'running') {
      runningCount += 1;
      bucket.running += 1;
    } else if (t.status === 'completed') {
      completedCount += 1;
    } else if (t.status === 'failed' || t.status === 'timed_out') {
      failedCount += 1;
      bucket.failed += 1;
    }
  }

  const budgetUtilizationPct = Math.min(999, Math.round((budgetUsedMs / budgetLimitMs) * 100));
  const withinBudget = budgetUsedMs <= budgetLimitMs;

  let availableSlots = Math.max(0, maxConcurrency - runningCount);
  const dispatchActions: BlueDispatchAction[] = [];

  for (const t of tasks) {
    const retries = t.retries ?? 0;
    const maxRetries = t.maxRetries ?? 2;

    if (t.status === 'running') {
      if (!withinBudget || t.elapsedMs > budgetLimitMs * 0.5) {
        dispatchActions.push({
          taskId: t.id,
          hat: t.hat,
          toolId: t.toolId,
          action: 'backoff_cancel',
          reason: `Task elapsed time (${t.elapsedMs}ms) exceeds safe budget slice; recommend cancellation or throttling.`,
        });
      } else {
        dispatchActions.push({
          taskId: t.id,
          hat: t.hat,
          toolId: t.toolId,
          action: 'continue',
          reason: `Running within execution budget (${t.elapsedMs}ms elapsed).`,
        });
      }
    } else if (t.status === 'queued') {
      if (availableSlots > 0 && withinBudget) {
        availableSlots -= 1;
        dispatchActions.push({
          taskId: t.id,
          hat: t.hat,
          toolId: t.toolId,
          action: 'dispatch_now',
          reason: 'Concurrency slot and resource budget available for immediate dispatch.',
        });
      } else {
        dispatchActions.push({
          taskId: t.id,
          hat: t.hat,
          toolId: t.toolId,
          action: 'continue',
          reason: withinBudget
            ? `Held in queue (${runningCount}/${maxConcurrency} concurrency slots busy).`
            : 'Held in queue because session resource budget is exhausted.',
        });
      }
    } else if (t.status === 'failed' || t.status === 'timed_out') {
      if (retries < maxRetries && withinBudget) {
        dispatchActions.push({
          taskId: t.id,
          hat: t.hat,
          toolId: t.toolId,
          action: 'retry',
          reason: `Eligible for retry (${retries + 1}/${maxRetries}) after ${t.status}.`,
        });
      } else {
        dispatchActions.push({
          taskId: t.id,
          hat: t.hat,
          toolId: t.toolId,
          action: 'backoff_cancel',
          reason: retries >= maxRetries
            ? `Retry ceiling reached (${retries}/${maxRetries}); isolate failure and escalate to Black Hat.`
            : 'Cannot retry while execution budget is exceeded.',
        });
      }
    } else {
      dispatchActions.push({
        taskId: t.id,
        hat: t.hat,
        toolId: t.toolId,
        action: 'archive',
        reason: `Completed in ${t.elapsedMs}ms; ready to pin to Decision Ledger.`,
      });
    }
  }

  return {
    state: 'success',
    queueDepth,
    runningCount,
    completedCount,
    failedCount,
    budgetUsedMs,
    budgetLimitMs,
    budgetUtilizationPct,
    withinBudget,
    perHatStats,
    dispatchActions,
  };
}
