/**
 * Extensible Tool Registry & Composable Skills Architecture across all 4 Hats.
 *
 * Standardized registration contract for Blue, White, Black, Red, and Shared
 * utility tools with input validation, AbortController timeout execution,
 * and reusable multi-Hat composable Skills.
 *
 * Refs SPE-14019, SPE-14031, SPE-14032, SPE-14035
 */

import {
  DEFAULT_SKILL_TIMEOUT_MS,
  DEFAULT_TOOL_TIMEOUT_MS,
  runGuardedTool,
  sanitizeInput,
  type GuardedToolEnvelope,
  type HatDomain,
  type ToolHatScope,
} from './guardrails.js';
import {
  runBlueDecisionLedger,
  runBlueExecutionMonitor,
  runBlueWorkflowSequencer,
  type BlueDecisionLedgerInput,
  type BlueExecutionMonitorInput,
  type BlueWorkflowSequencerInput,
} from './blue/tools.js';
import {
  runWhiteDataInspector,
  runWhiteEvidenceCollector,
  runWhiteGapAnalyzer,
  type WhiteDataInspectorInput,
  type WhiteEvidenceCollectorInput,
  type WhiteGapAnalyzerInput,
} from './white/tools.js';
import {
  runBlackPolicyValidator,
  runBlackRiskAnalyzer,
  runBlackStressProber,
  type BlackPolicyValidatorInput,
  type BlackRiskAnalyzerInput,
  type BlackStressProberInput,
} from './black/tools.js';
import {
  runArtifactDiffTool,
  runBatchRunnerTool,
  runContextTransformTool,
  runSnapshotManagerTool,
  type ArtifactDiffInput,
  type BatchRunnerInput,
  type ContextTransformInput,
  type SnapshotManagerInput,
} from './extra-tools.js';
import type { CustomTool, ToolContext, ToolResult } from '../types/index.js';
import {
  applyHardeningRetest,
  detectionGaps,
  evaluateHardeningRetest,
  hardeningPlan,
  type HardeningItem,
  type ObservedArtifactIds,
  type RedFindingShape,
  type TelemetrySourceShape,
} from './blue.js';
import {
  blueInputHash,
  runBlueCoverageAcrossFamilies,
  runBlueCoverageStage,
  runBlueDetectionStage,
  runBlueDetectorStage,
  runBlueRetestStage,
  type BlueCoverageStageInput,
  type BlueDetectionStageInput,
  type BlueDetectorStageInput,
  type BlueRetestStageInput,
} from './blue/workflow.js';
import {
  coverageGaps,
  type CoverageFinding,
  type CoverageGap,
  type TelemetryDeclaration,
} from './blue/coverage.js';
import {
  sigmaRuleForGap,
  sigmaRulepack,
  validateDetectorStanding,
  type DetectorValidationInput,
  type SigmaRuleOptions,
} from './blue/rulepacks.js';
import { coverAudit, noiseBudget } from './black.js';
import {
  hashBlackInput,
  runBlackWorkflow,
  type BlackWorkflowInput,
} from './black/workflow.js';
import {
  exfilCostModel,
  type ExfilPath,
  type RouteEvidence,
} from './black/exfil.js';
import { matchVocabulary, structuredNoiseBudget } from './black/noise.js';
import { opsecChecklist, opsecReview, type OpsecPhase } from './black/checklist.js';
import {
  adjudicateEvidence,
  roeAudit,
  type AuditedAction,
  type EvidenceEntryShape,
  type RoeSpec,
  type RoeVerdict,
} from './white.js';
import { parseRoe } from './white/roe-parser.js';
import {
  auditEvidenceChain,
  resolveLedgerStrength,
  type LedgerEvidenceShape,
} from './white/evidence-chain.js';
import { auditReport, type FindingShape } from './white/report-auditor.js';
import {
  aggregateEvidenceStanding,
  pairDisputeRulings,
  stageRoeAudit,
  type ApprovalBearingAction,
  type PairedDisputeRuling,
  type RoeStageMeta,
} from './white/workflow.js';
import {
  arbiterDispute,
  auditorScore,
  sentinelDetectorMap,
  specterCoverReview,
  wardenHardeningReview,
  wraithExfilSim,
  type DisputeClaim,
  type ExfilPathShape,
  type SentinelStageBinding,
} from './hats.js';

export interface HatToolParameterSpec {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required: boolean;
  description: string;
}

export interface HatToolRegistration {
  id: string;
  name: string;
  hat: ToolHatScope;
  category: 'orchestration' | 'inspection' | 'validation' | 'offensive' | 'utility';
  description: string;
  timeoutMs: number;
  parameters: readonly HatToolParameterSpec[];
  defaultPreset: Record<string, unknown>;
}

export const HAT_TOOL_REGISTRY: readonly HatToolRegistration[] = [
  // Blue Hat Tools
  {
    id: 'blue-workflow-sequencer',
    name: 'Workflow Sequencer',
    hat: 'blue',
    category: 'orchestration',
    description: 'Define, chain, and execute multi-step workflows across White, Black, Blue, and Red Hats with conditional branching and checkpoints.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'workflowName', label: 'Workflow Name', type: 'string', required: false, description: 'Display name of the cross-Hat pipeline' },
      { name: 'objective', label: 'Objective', type: 'string', required: false, description: 'Operational goal for the sequence' },
      { name: 'steps', label: 'Workflow Steps (JSON)', type: 'json', required: false, description: 'Ordered array of cross-Hat workflow steps' },
    ],
    defaultPreset: {
      workflowName: 'D3FEND Coverage → ROE Audit → Hardening Retest',
      objective: 'Verify detector coverage and ROE compliance before retest',
      steps: [
        { hat: 'white', toolId: 'white-data-inspector', label: 'Inspect telemetry payload', condition: 'always', checkpoint: true },
        { hat: 'blue', toolId: 'coverageGaps', label: 'Map D3FEND coverage gaps', condition: 'on_findings', checkpoint: true },
        { hat: 'black', toolId: 'black-policy-validator', label: 'Validate policy boundaries', condition: 'on_gaps', checkpoint: false },
      ],
    },
  },
  {
    id: 'blue-decision-ledger',
    name: 'Session & Decision Ledger',
    hat: 'blue',
    category: 'orchestration',
    description: 'Track active objectives, constraints, Hat transitions, and synthesized conclusions with auditable SHA-256 digests and Markdown/JSON export.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'sessionId', label: 'Session ID', type: 'string', required: false, description: 'Unique session identifier' },
      { name: 'objective', label: 'Active Objective', type: 'string', required: true, description: 'Primary session objective' },
      { name: 'decisions', label: 'Decision Entries (JSON)', type: 'json', required: false, description: 'Cross-Hat transition and decision records' },
    ],
    defaultPreset: {
      sessionId: 'session-4hat-01',
      objective: 'Harden API gateway against credential leakage and verify Sigma detection coverage',
      constraints: ['Loopback 127.0.0.1 only', 'Zero unapproved active probes'],
      decisions: [
        {
          fromHat: 'white',
          toHat: 'blue',
          summary: 'Verified ROE scope receipt and telemetry schema',
          rationale: 'All required fields present in structured inspection',
          evidenceRefs: ['ev-roe-001', 'ev-tel-002'],
          status: 'accepted',
        },
      ],
    },
  },
  {
    id: 'blue-execution-monitor',
    name: 'Execution Monitor & Dispatcher',
    hat: 'blue',
    category: 'orchestration',
    description: 'Inspect active tool runs, queue depth, execution timing, retry controls, and resource budgets across all 4 Hats.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'budgetLimitMs', label: 'Budget Limit (ms)', type: 'number', required: false, description: 'Total execution budget in milliseconds' },
      { name: 'maxConcurrency', label: 'Max Concurrency', type: 'number', required: false, description: 'Maximum concurrent tool runs' },
      { name: 'tasks', label: 'Task Queue (JSON)', type: 'json', required: false, description: 'Active, queued, and completed tool tasks' },
    ],
    defaultPreset: {
      budgetLimitMs: 60000,
      maxConcurrency: 4,
      tasks: [
        { id: 't-1', hat: 'white', toolId: 'white-data-inspector', status: 'completed', elapsedMs: 120 },
        { id: 't-2', hat: 'blue', toolId: 'blue-workflow-sequencer', status: 'running', elapsedMs: 450 },
        { id: 't-3', hat: 'black', toolId: 'black-risk-analyzer', status: 'queued', elapsedMs: 0 },
      ],
    },
  },

  // White Hat Tools
  {
    id: 'white-data-inspector',
    name: 'Structured Data Inspector',
    hat: 'white',
    category: 'inspection',
    description: 'Parse, filter, and query structured JSON, JSONL, or key=value logs with schema validation, chunked rendering, and non-destructive error recovery.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'rawPayload', label: 'Structured Payload', type: 'json', required: true, description: 'JSON array/object, JSONL lines, or key=value log lines' },
      { name: 'format', label: 'Format', type: 'string', required: false, description: 'auto, json, jsonl, or kv_log' },
      { name: 'requiredFields', label: 'Required Fields (JSON)', type: 'json', required: false, description: 'Schema fields that must be non-null' },
    ],
    defaultPreset: {
      format: 'json',
      requiredFields: ['id', 'host', 'severity'],
      rawPayload: [
        { id: 'ev-101', host: '127.0.0.1', severity: 'high', source: 'suricata' },
        { id: 'ev-102', host: '127.0.0.1', severity: 'medium', source: 'osquery' },
      ],
    },
  },
  {
    id: 'white-evidence-collector',
    name: 'Evidence & Fact Collector',
    hat: 'white',
    category: 'inspection',
    description: 'Capture, tag, cross-reference, and verify facts with provenance metadata, SHA-256 digests, and deterministic confidence scoring.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'facts', label: 'Fact Entries (JSON)', type: 'json', required: true, description: 'Facts with source, artifactId, sha256, and corroboration' },
      { name: 'tagFilter', label: 'Tag Filter', type: 'string', required: false, description: 'Optional tag to filter collected facts' },
    ],
    defaultPreset: {
      facts: [
        {
          id: 'fact-1',
          claim: 'Loopback server enforces bearer token on non-loopback binds',
          source: 'src/server.ts',
          artifactId: 'art-auth-01',
          sha256: 'sha256-9a8b7c6d5e4f3a2b',
          tags: ['auth', 'boundary'],
          corroboratedBy: ['test-remote-access'],
        },
      ],
    },
  },
  {
    id: 'white-gap-analyzer',
    name: 'Information Gap Analyzer',
    hat: 'white',
    category: 'inspection',
    description: 'Compare required inputs against verified facts to surface missing variables, unverified assumptions, and concrete cross-Hat resolution queries.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'objective', label: 'Audit Objective', type: 'string', required: false, description: 'Objective being evaluated for completeness' },
      { name: 'requiredVariables', label: 'Required Variables (JSON)', type: 'json', required: true, description: 'Variables required before execution' },
      { name: 'knownFacts', label: 'Known Facts (JSON)', type: 'json', required: false, description: 'Currently known variables and verification status' },
    ],
    defaultPreset: {
      objective: 'Pre-Engagement Readiness & Scope Verification',
      requiredVariables: ['roe_allowlist', 'siem_telemetry_source', 'egress_route_budget'],
      knownFacts: [
        { variable: 'roe_allowlist', value: '127.0.0.1/8', verified: true, source: 'white-roe-store' },
      ],
      assumptions: [
        { id: 'a-1', statement: 'Local Suricata rules cover DNS tunnel egress', verified: false, criticality: 'high' },
      ],
    },
  },

  // Black Hat Tools
  {
    id: 'black-risk-analyzer',
    name: 'Risk & Failure Mode Analyzer',
    hat: 'black',
    category: 'validation',
    description: 'Evaluate plans and components against failure modes, producing severity × likelihood matrices and concrete Blue Hat mitigations.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'planName', label: 'Plan Name', type: 'string', required: false, description: 'Name of the architecture or workflow plan' },
      { name: 'components', label: 'Components (JSON)', type: 'json', required: true, description: 'Components with SPOF, secret handling, and noise metadata' },
    ],
    defaultPreset: {
      planName: 'Gateway & Telemetry Relay Assessment',
      components: [
        { name: 'Primary Auth Gateway', category: 'auth', singlePointOfFailure: true, handlesSecrets: true, externalDependency: false, hasFallback: false },
        { name: 'DNS Telemetry Collector', category: 'telemetry', singlePointOfFailure: false, handlesSecrets: false, noiseLevel: 'high', hasFallback: true },
      ],
      assumptions: ['Upstream token rotation completes within 60 seconds'],
    },
  },
  {
    id: 'black-policy-validator',
    name: 'Rule & Policy Validator',
    hat: 'black',
    category: 'validation',
    description: 'Run deterministic security, boundary, regression, and ROE compliance checks against configurations or workflow artifacts.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'artifactName', label: 'Artifact Name', type: 'string', required: false, description: 'Identifier of the artifact under test' },
      { name: 'rawConfig', label: 'Configuration Payload', type: 'json', required: true, description: 'JSON object or configuration string to audit' },
      { name: 'allowedHosts', label: 'Allowed Hosts (JSON)', type: 'json', required: false, description: 'ROE allowed hostnames/IPs' },
    ],
    defaultPreset: {
      artifactName: 'runtime-gateway.json',
      policyProfile: 'all',
      allowedHosts: ['127.0.0.1', 'localhost'],
      rawConfig: {
        bindHost: '127.0.0.1',
        endpoint: 'https://localhost:3333/api/health',
        timeoutMs: 15000,
      },
    },
  },
  {
    id: 'black-stress-prober',
    name: 'Stress & Edge Case Prober',
    hat: 'black',
    category: 'validation',
    description: 'Generate boundary cases, adversarial input vectors, and dependency failure scenarios to test resilience before deployment.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'targetComponent', label: 'Target Component', type: 'string', required: true, description: 'Component or API boundary to probe' },
      { name: 'inputFields', label: 'Input Fields (JSON)', type: 'json', required: false, description: 'Typed input fields to generate boundary probes for' },
      { name: 'dependencies', label: 'Dependencies (JSON)', type: 'json', required: false, description: 'Downstream dependencies to model failure scenarios for' },
    ],
    defaultPreset: {
      targetComponent: 'FourHatToolDispatcher',
      inputFields: [
        { name: 'artifactPath', type: 'path', required: true },
        { name: 'callbackUrl', type: 'url', required: false },
      ],
      dependencies: ['sqlite-evidence-ledger', 'local-sidecar-rpc'],
    },
  },

  // Fourth Hat (Red Hat) Representative Workflow Adapter
  {
    id: 'red-surface-validator',
    name: 'Red Surface & Hypothesis Validator',
    hat: 'red',
    category: 'offensive',
    description: 'Validate authorized attack-surface hypotheses and format scoped findings for White, Black, and Blue Hat handoff.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'target', label: 'Authorized Target', type: 'string', required: true, description: 'Loopback or ROE-authorized target identifier' },
      { name: 'hypothesis', label: 'Adversarial Hypothesis', type: 'string', required: false, description: 'Hypothesis to structure for cross-Hat validation' },
    ],
    defaultPreset: {
      target: '127.0.0.1:3333',
      hypothesis: 'Verify unauthenticated non-loopback requests fail closed with 401/403',
    },
  },

  // Shared Cross-Hat Utility Tools
  {
    id: 'shared-context-transform',
    name: 'Cross-Hat Context Transformer',
    hat: 'shared',
    category: 'utility',
    description: 'Transform outputs from one Hat tool into another Hat tool input schema with SHA-256 provenance tracking.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'fromHat', label: 'Source Hat', type: 'string', required: true, description: 'red, blue, black, or white' },
      { name: 'toHat', label: 'Target Hat', type: 'string', required: true, description: 'red, blue, black, or white' },
      { name: 'payload', label: 'Payload', type: 'json', required: true, description: 'Structured output to transform' },
    ],
    defaultPreset: {
      fromHat: 'white',
      toHat: 'blue',
      targetToolId: 'blue-decision-ledger',
      payload: { verifiedFacts: 3, scope: '127.0.0.1' },
      note: 'Promote verified White Hat facts into Blue Hat Decision Ledger',
    },
  },
  {
    id: 'shared-artifact-diff',
    name: 'Artifact & Config Diff',
    hat: 'shared',
    category: 'utility',
    description: 'Compare two structured artifacts or configurations line-by-line and key-by-key across Hat runs.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'before', label: 'Baseline Artifact', type: 'json', required: true, description: 'Baseline string or JSON object' },
      { name: 'after', label: 'Candidate Artifact', type: 'json', required: true, description: 'Candidate string or JSON object' },
    ],
    defaultPreset: {
      beforeLabel: 'pre-hardening',
      afterLabel: 'post-hardening',
      before: { bind: '0.0.0.0', authRequired: false },
      after: { bind: '127.0.0.1', authRequired: true },
    },
  },
  {
    id: 'shared-snapshot-manager',
    name: 'Workspace Snapshot Manager',
    hat: 'shared',
    category: 'utility',
    description: 'Create, verify, and restore versioned v2 workspace snapshots with SHA-256 integrity verification.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'action', label: 'Action', type: 'string', required: false, description: 'create, verify, or restore' },
      { name: 'activeHat', label: 'Active Hat', type: 'string', required: false, description: 'red, blue, black, or white' },
    ],
    defaultPreset: {
      action: 'create',
      label: 'four-hat-checkpoint',
      activeHat: 'blue',
      workspaceState: {
        activeHat: 'blue',
        toolDrafts: { 'blue-workflow-sequencer': { workflowName: 'Checkpoint Alpha' } },
      },
    },
  },
  {
    id: 'shared-batch-runner',
    name: 'Cross-Hat Batch Runner',
    hat: 'shared',
    category: 'utility',
    description: 'Execute a batch of deterministic Hat tool jobs sequentially with aggregated status counters.',
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    parameters: [
      { name: 'batchName', label: 'Batch Name', type: 'string', required: false, description: 'Name of the batch run' },
      { name: 'jobs', label: 'Batch Jobs (JSON)', type: 'json', required: true, description: 'Array of cross-Hat job specifications' },
    ],
    defaultPreset: {
      batchName: 'Four-Hat Smoke Verification Batch',
      stopOnError: true,
      jobs: [
        { id: 'job-white', hat: 'white', toolId: 'white-data-inspector', payloadSummary: 'Validate telemetry schema' },
        { id: 'job-black', hat: 'black', toolId: 'black-policy-validator', payloadSummary: 'Audit loopback policy' },
        { id: 'job-blue', hat: 'blue', toolId: 'blue-decision-ledger', payloadSummary: 'Record batch sign-off' },
      ],
    },
  },
];

export function listRegisteredHatTools(hatFilter?: ToolHatScope): readonly HatToolRegistration[] {
  if (!hatFilter) return HAT_TOOL_REGISTRY;
  return HAT_TOOL_REGISTRY.filter(t => t.hat === hatFilter);
}

export function getRegisteredHatTool(toolId: string): HatToolRegistration | undefined {
  return HAT_TOOL_REGISTRY.find(t => t.id === toolId);
}

/**
 * Execute any registered Hat tool by ID inside the `runGuardedTool` boundary
 * (prototype-pollution sanitization, 2 MiB payload cap, AbortController timeout).
 */
export async function executeRegisteredHatTool(
  toolId: string,
  rawInput: unknown = {},
  signal?: AbortSignal,
): Promise<GuardedToolEnvelope<unknown>> {
  const reg = getRegisteredHatTool(toolId);
  const hatScope: ToolHatScope = reg?.hat ?? 'shared';
  const timeoutMs = reg?.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;

  return runGuardedTool({
    toolId,
    hat: hatScope,
    input: rawInput,
    timeoutMs,
    signal,
    handler: (sanitizedInput) => {
      const obj = (typeof sanitizedInput === 'object' && sanitizedInput !== null)
        ? (sanitizedInput as Record<string, unknown>)
        : {};

      switch (toolId) {
        case 'blue-workflow-sequencer':
          return runBlueWorkflowSequencer(obj as BlueWorkflowSequencerInput);
        case 'blue-decision-ledger':
          return runBlueDecisionLedger(obj as BlueDecisionLedgerInput);
        case 'blue-execution-monitor':
          return runBlueExecutionMonitor(obj as BlueExecutionMonitorInput);
        case 'white-data-inspector':
          return runWhiteDataInspector(obj as WhiteDataInspectorInput);
        case 'white-evidence-collector':
          return runWhiteEvidenceCollector(obj as WhiteEvidenceCollectorInput);
        case 'white-gap-analyzer':
          return runWhiteGapAnalyzer(obj as WhiteGapAnalyzerInput);
        case 'black-risk-analyzer':
          return runBlackRiskAnalyzer(obj as BlackRiskAnalyzerInput);
        case 'black-policy-validator':
          return runBlackPolicyValidator(obj as BlackPolicyValidatorInput);
        case 'black-stress-prober':
          return runBlackStressProber(obj as BlackStressProberInput);
        case 'shared-context-transform':
          return runContextTransformTool(obj as ContextTransformInput);
        case 'shared-artifact-diff':
          return runArtifactDiffTool(obj as ArtifactDiffInput);
        case 'shared-snapshot-manager':
          return runSnapshotManagerTool(obj as SnapshotManagerInput);
        case 'shared-batch-runner':
          return runBatchRunnerTool(obj as BatchRunnerInput);
        case 'red-surface-validator': {
          const target = typeof obj.target === 'string' ? obj.target.trim() : '';
          const hypothesis = typeof obj.hypothesis === 'string' ? obj.hypothesis.trim() : 'Verify target surface controls';
          if (!target) {
            return {
              state: 'empty',
              target: '',
              hypothesis,
              summary: 'Specify an authorized target to structure Red Hat surface validation.',
            };
          }
          return {
            state: 'success',
            target,
            hypothesis,
            status: 'scoped-hypothesis-ready',
            handoffTargets: ['white-gap-analyzer', 'black-risk-analyzer', 'blue-workflow-sequencer'],
            summary: `Red Hat hypothesis "${hypothesis}" scoped for ${target}; ready for White/Black/Blue verification.`,
          };
        }
        default:
          throw new Error(`Unknown Hat tool "${toolId}". Available tools: ${HAT_TOOL_REGISTRY.map(t => t.id).join(', ')}`);
      }
    },
  });
}

// =============================================================================
// COMPOSABLE SKILLS ENGINE
// =============================================================================

export interface ComposableSkillStepSpec {
  stepId: string;
  hat: HatDomain;
  toolId: string;
  description: string;
}

export interface ComposableSkillDefinition {
  id: string;
  name: string;
  primaryHat: HatDomain;
  involvedHats: readonly HatDomain[];
  description: string;
  tags: readonly string[];
  steps: readonly ComposableSkillStepSpec[];
  defaultParams: Record<string, unknown>;
}

export interface ComposableSkillStepOutput {
  stepIndex: number;
  stepId: string;
  hat: HatDomain;
  toolId: string;
  status: string;
  durationMs: number;
  output: unknown;
}

export interface ComposableSkillRunResult {
  state: 'empty' | 'error' | 'success';
  skillId: string;
  skillName: string;
  involvedHats: readonly HatDomain[];
  stepsCompleted: number;
  totalSteps: number;
  stepOutputs: readonly ComposableSkillStepOutput[];
  synthesisSummary: string;
}

export const SKILL_CATALOG: readonly ComposableSkillDefinition[] = [
  {
    id: 'skill-blue-incident-sequencer',
    name: 'Blue Hat Incident & Hardening Sequencer',
    primaryHat: 'blue',
    involvedHats: ['white', 'blue', 'black'],
    description: 'Composes White Hat Data Inspector, White Evidence Collector, Blue Workflow Sequencer, and Blue Decision Ledger into an end-to-end containment workflow.',
    tags: ['blue', 'orchestration', 'd3fend', 'ledger'],
    steps: [
      { stepId: 'inspect-telemetry', hat: 'white', toolId: 'white-data-inspector', description: 'Inspect structured telemetry records' },
      { stepId: 'collect-evidence', hat: 'white', toolId: 'white-evidence-collector', description: 'Verify artifact provenance and confidence' },
      { stepId: 'sequence-pipeline', hat: 'blue', toolId: 'blue-workflow-sequencer', description: 'Run multi-step D3FEND containment workflow' },
      { stepId: 'record-decision', hat: 'blue', toolId: 'blue-decision-ledger', description: 'Commit auditable decision ledger entry' },
    ],
    defaultParams: {
      objective: 'Contain credential exposure and verify D3FEND detector standing',
    },
  },
  {
    id: 'skill-white-roe-gap-verification',
    name: 'White Hat Provenance & Gap Verification',
    primaryHat: 'white',
    involvedHats: ['white', 'blue'],
    description: 'Chains Structured Data Inspector, Information Gap Analyzer, and Evidence Collector to prove engagement readiness and surface missing variables.',
    tags: ['white', 'roe', 'evidence', 'gaps'],
    steps: [
      { stepId: 'inspect-scope-data', hat: 'white', toolId: 'white-data-inspector', description: 'Parse and validate scope dataset' },
      { stepId: 'analyze-gaps', hat: 'white', toolId: 'white-gap-analyzer', description: 'Identify missing variables and unverified assumptions' },
      { stepId: 'tag-facts', hat: 'white', toolId: 'white-evidence-collector', description: 'Tag verified facts with SHA-256 provenance' },
    ],
    defaultParams: {
      objective: 'Verify all ROE scope variables and evidence hashes before execution',
    },
  },
  {
    id: 'skill-black-predeploy-stress-audit',
    name: 'Black Hat Pre-Deployment Risk & Stress Audit',
    primaryHat: 'black',
    involvedHats: ['black', 'blue'],
    description: 'Executes Rule & Policy Validator, Risk & Failure Mode Analyzer, and Stress & Edge Case Prober, then hands off remediation items to Blue Hat.',
    tags: ['black', 'risk', 'policy', 'stress-test'],
    steps: [
      { stepId: 'validate-policy', hat: 'black', toolId: 'black-policy-validator', description: 'Run deterministic security & boundary policy checks' },
      { stepId: 'analyze-failure-modes', hat: 'black', toolId: 'black-risk-analyzer', description: 'Compute severity × likelihood failure matrix' },
      { stepId: 'probe-edge-cases', hat: 'black', toolId: 'black-stress-prober', description: 'Generate adversarial input & dependency failure probes' },
      { stepId: 'handoff-ledger', hat: 'blue', toolId: 'blue-decision-ledger', description: 'Record prioritized remediation handoff in Blue Hat Ledger' },
    ],
    defaultParams: {
      artifactName: 'production-desktop-mobile-bundle.json',
    },
  },
  {
    id: 'skill-purple-four-hat-synthesis',
    name: 'Purple Team Full Four-Hat Synthesis Pipeline',
    primaryHat: 'blue',
    involvedHats: ['red', 'white', 'black', 'blue'],
    description: 'Executes a complete 4-Hat loop: Red surface hypothesis → White gap & fact inspection → Black risk & policy audit → Blue workflow & decision ledger.',
    tags: ['purple', 'four-hats', 'synthesis', 'full-cycle'],
    steps: [
      { stepId: 'red-hypothesis', hat: 'red', toolId: 'red-surface-validator', description: 'Scope Red Hat surface hypothesis' },
      { stepId: 'white-gap-check', hat: 'white', toolId: 'white-gap-analyzer', description: 'Verify knowns vs. unknowns in White Hat' },
      { stepId: 'black-risk-check', hat: 'black', toolId: 'black-risk-analyzer', description: 'Evaluate failure modes in Black Hat' },
      { stepId: 'blue-ledger-closeout', hat: 'blue', toolId: 'blue-decision-ledger', description: 'Synthesize 4-Hat decision ledger in Blue Hat' },
    ],
    defaultParams: {
      target: '127.0.0.1:3333',
      objective: 'Full 4-Hat verification across Red, White, Black, and Blue perspectives',
    },
  },
];

export function listComposableSkills(hatFilter?: HatDomain): readonly ComposableSkillDefinition[] {
  if (!hatFilter) return SKILL_CATALOG;
  return SKILL_CATALOG.filter(s => s.primaryHat === hatFilter || s.involvedHats.includes(hatFilter));
}

export function getComposableSkill(skillId: string): ComposableSkillDefinition | undefined {
  return SKILL_CATALOG.find(s => s.id === skillId);
}

/**
 * Execute a composable multi-Hat Skill by chaining its constituent Hat tools
 * inside a guarded execution boundary.
 */
export async function runComposableSkill(
  skillId: string,
  rawParams: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<GuardedToolEnvelope<ComposableSkillRunResult>> {
  const skill = getComposableSkill(skillId);
  if (!skill) {
    return {
      ok: false,
      status: 'error',
      toolId: skillId,
      hat: 'shared',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      inputBytes: 0,
      outputBytes: 0,
      sanitizedKeysStripped: 0,
      dangerousPatternsDetected: [],
      error: {
        code: 'UNKNOWN_SKILL',
        message: `Unknown composable skill "${skillId}". Available skills: ${SKILL_CATALOG.map(s => s.id).join(', ')}`,
        recoverable: true,
        suggestedHat: 'blue',
      },
    };
  }

  return runGuardedTool({
    toolId: skill.id,
    hat: skill.primaryHat,
    input: rawParams,
    timeoutMs: DEFAULT_SKILL_TIMEOUT_MS,
    signal,
    handler: async (sanitizedParams, innerSignal) => {
      const callerParams =
        typeof sanitizedParams === 'object' && sanitizedParams !== null ? sanitizeInput(sanitizedParams) : {};
      const mergedParams = {
        ...skill.defaultParams,
        ...callerParams,
      };

      const stepOutputs: ComposableSkillStepOutput[] = [];
      const carriedContext: Record<string, unknown> = {};
      let stepsCompleted = 0;

      for (let i = 0; i < skill.steps.length; i += 1) {
        const step = skill.steps[i];
        const toolReg = getRegisteredHatTool(step.toolId);
        const stepInput = {
          ...(toolReg?.defaultPreset ?? {}),
          ...(step.toolId === 'white-data-inspector'
            ? {
                includeAllRecords: true,
                ...(callerParams.rawPayload !== undefined && callerParams.requiredFields === undefined
                  ? { requiredFields: [] }
                  : {}),
              }
            : {}),
          ...carriedContext,
          ...mergedParams,
          ...(step.toolId === 'white-data-inspector' ? { includeAllRecords: true } : {}),
        };

        const stepEnvelope = await executeRegisteredHatTool(step.toolId, stepInput, innerSignal);
        const stepDataRecord =
          stepEnvelope.data && typeof stepEnvelope.data === 'object'
            ? (stepEnvelope.data as Record<string, unknown>)
            : null;
        const stepState = typeof stepDataRecord?.state === 'string' ? stepDataRecord.state : 'success';
        const stepSucceeded = stepEnvelope.ok && stepState === 'success';

        stepOutputs.push({
          stepIndex: i,
          stepId: step.stepId,
          hat: step.hat,
          toolId: step.toolId,
          status: stepSucceeded ? 'success' : (stepEnvelope.ok ? stepState : stepEnvelope.status),
          durationMs: stepEnvelope.durationMs,
          output: stepEnvelope.data ?? stepEnvelope.error,
        });

        if (!stepSucceeded) {
          for (let j = i + 1; j < skill.steps.length; j += 1) {
            const remStep = skill.steps[j];
            stepOutputs.push({
              stepIndex: j,
              stepId: remStep.stepId,
              hat: remStep.hat,
              toolId: remStep.toolId,
              status: 'skipped',
              durationMs: 0,
              output: {
                state: 'error',
                message: `Skipped because prerequisite step "${step.stepId}" (${step.toolId}) returned ${stepEnvelope.ok ? stepState : stepEnvelope.status}.`,
              },
            });
          }
          break;
        }

        stepsCompleted += 1;

        if (
          step.toolId === 'white-data-inspector'
          && (Array.isArray(stepDataRecord?.allFilteredRecords) || Array.isArray(stepDataRecord?.records))
        ) {
          const allRecords = (
            Array.isArray(stepDataRecord?.allFilteredRecords)
              ? stepDataRecord.allFilteredRecords
              : stepDataRecord.records
          ) as Array<Record<string, unknown>>;
          if (stepDataRecord && 'allFilteredRecords' in stepDataRecord) {
            delete stepDataRecord.allFilteredRecords;
          }

          const hasRecordEvidence = (rec: Record<string, unknown>): boolean => {
            const hasArtifact = typeof rec.artifactId === 'string' && rec.artifactId.trim().length > 0;
            const hasSha = typeof rec.sha256 === 'string' && rec.sha256.trim().length > 0;
            const hasCorroboration =
              Array.isArray(rec.corroboratedBy)
              && rec.corroboratedBy.some((c) => typeof c === 'string' && c.trim().length > 0);
            return hasArtifact && hasSha && hasCorroboration;
          };

          const derivedFacts = allRecords.map((rec, idx) => ({
            id: typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `inspected-fact-${idx + 1}`,
            claim: typeof rec.claim === 'string' && rec.claim.trim() ? rec.claim.trim() : JSON.stringify(rec),
            source: typeof rec.source === 'string' && rec.source.trim() ? rec.source.trim() : 'white-data-inspector',
            ...(typeof rec.artifactId === 'string' && rec.artifactId.trim() ? { artifactId: rec.artifactId.trim() } : {}),
            ...(typeof rec.sha256 === 'string' && rec.sha256.trim() ? { sha256: rec.sha256.trim() } : {}),
            ...(Array.isArray(rec.corroboratedBy)
              ? { corroboratedBy: rec.corroboratedBy.filter((c): c is string => typeof c === 'string' && c.trim().length > 0) }
              : {}),
            ...(Array.isArray(rec.contradictedBy)
              ? { contradictedBy: rec.contradictedBy.filter((c): c is string => typeof c === 'string' && c.trim().length > 0) }
              : {}),
          }));
          const derivedKnownFacts: Array<{ variable: string; value: string; verified: boolean; source: string }> = [];
          const seenVars = new Set<string>();
          for (const rec of allRecords) {
            const recordVerified = hasRecordEvidence(rec);
            for (const [k, v] of Object.entries(rec)) {
              if (!seenVars.has(k)) {
                seenVars.add(k);
                derivedKnownFacts.push({
                  variable: k,
                  value: typeof v === 'string' ? v : JSON.stringify(v),
                  verified: recordVerified && v !== null && v !== undefined && v !== '',
                  source: 'white-data-inspector',
                });
              }
            }
          }
          if (derivedFacts.length > 0 && callerParams.facts === undefined) {
            carriedContext.facts = derivedFacts;
          }
          if (derivedKnownFacts.length > 0 && callerParams.knownFacts === undefined) {
            carriedContext.knownFacts = derivedKnownFacts;
          }
        } else if (step.toolId === 'white-evidence-collector' && Array.isArray(stepDataRecord?.items)) {
          const items = stepDataRecord.items as Array<Record<string, unknown>>;
          if (items.length > 0 && callerParams.decisions === undefined) {
            carriedContext.decisions = items.map((tf, idx) => {
              const confidence = typeof tf.confidenceLevel === 'string' ? tf.confidenceLevel : 'unverified';
              const status: 'accepted' | 'deferred' | 'rejected' =
                confidence === 'contradicted'
                  ? 'rejected'
                  : confidence === 'verified' || confidence === 'corroborated'
                    ? 'accepted'
                    : 'deferred';
              const artifactId = typeof tf.artifactId === 'string' && tf.artifactId.trim() ? tf.artifactId.trim() : null;
              const corroboratedBy = Array.isArray(tf.corroboratedBy)
                ? tf.corroboratedBy.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
                : [];
              const evidenceRefs: string[] = Array.from(
                new Set(artifactId ? [artifactId, ...corroboratedBy] : corroboratedBy),
              );
              const evidenceHash = typeof tf.sha256 === 'string' && tf.sha256.trim() ? tf.sha256.trim() : undefined;
              return {
                id: `dec-ev-${idx + 1}`,
                fromHat: 'white',
                toHat: 'blue',
                summary: typeof tf.claim === 'string' ? tf.claim : `Fact ${idx + 1}`,
                rationale: `Confidence ${confidence} (${String(tf.sha256 ?? '').slice(0, 16)})`,
                evidenceRefs,
                ...(evidenceHash ? { evidenceHash } : {}),
                status,
              };
            });
          }
        } else if (step.toolId === 'black-policy-validator' && Array.isArray(stepDataRecord?.checks)) {
          const checks = stepDataRecord.checks as Array<Record<string, unknown>>;
          const failedChecks = checks.filter((c) => c.passed === false);
          if (failedChecks.length > 0 && callerParams.assumptions === undefined) {
            carriedContext.assumptions = failedChecks.map((c) => `${String(c.ruleId)}: ${String(c.evidence)}`);
          }
        } else if (step.toolId === 'black-risk-analyzer' && Array.isArray(stepDataRecord?.findings)) {
          const findings = stepDataRecord.findings as Array<Record<string, unknown>>;
          if (findings.length > 0 && callerParams.decisions === undefined) {
            carriedContext.decisions = findings.map((f, idx) => ({
              id: `dec-risk-${idx + 1}`,
              fromHat: 'black',
              toHat: 'blue',
              summary: typeof f.failureMode === 'string' ? f.failureMode : `Risk finding ${idx + 1}`,
              rationale: typeof f.mitigation === 'string' ? f.mitigation : 'Apply Black Hat mitigation',
              evidenceRefs: [typeof f.id === 'string' ? f.id : `risk-${idx + 1}`],
            }));
          }
        } else if (step.toolId === 'red-findings-correlator' && Array.isArray(stepDataRecord?.correlated)) {
          const correlated = stepDataRecord.correlated as Array<Record<string, unknown>>;
          if (correlated.length > 0) {
            if (callerParams.facts === undefined) {
              carriedContext.facts = correlated.map((c, idx) => ({
                id: typeof c.id === 'string' ? c.id : `red-fact-${idx + 1}`,
                claim: `${String(c.title ?? c.id)} on ${String(c.target ?? 'target')}`,
                source: 'red-findings-correlator',
                artifactId: typeof c.id === 'string' ? c.id : `red-${idx + 1}`,
                corroboratedBy: ['red-findings-correlator'],
              }));
            }
            if (callerParams.components === undefined) {
              carriedContext.components = correlated.map((c) => ({
                name: typeof c.target === 'string' ? c.target : String(c.id ?? 'target-component'),
                category: 'network',
                singlePointOfFailure: c.severity === 'critical' || c.severity === 'high',
                handlesSecrets: true,
                externalDependency: false,
                hasFallback: false,
              }));
            }
          }
        }
      }

      const allSucceeded = stepsCompleted === skill.steps.length;
      return {
        state: allSucceeded ? 'success' : 'error',
        skillId: skill.id,
        skillName: skill.name,
        involvedHats: skill.involvedHats,
        stepsCompleted,
        totalSteps: skill.steps.length,
        stepOutputs,
        synthesisSummary: `Skill "${skill.name}" completed ${stepsCompleted}/${skill.steps.length} step(s) across [${skill.involvedHats.map(h => h.toUpperCase()).join(' → ')}].`,
      };
    },
  });
}

// =============================================================================
// SPECIALIST WORKFLOW CUSTOM TOOLS FOR OPERATOR DISPATCH
// =============================================================================

interface SpecialistEngineEntry {
  name: string;
  description: string;
  run: (params: Record<string, unknown>) => unknown | Promise<unknown>;
}

const SPECIALIST_WORKFLOW_ENTRIES: readonly SpecialistEngineEntry[] = [
  {
    name: 'runBlueCoverageStage',
    description: 'Run the artifact-bound Blue coverage stage for one mission family.',
    run: (p) => runBlueCoverageStage(p as unknown as BlueCoverageStageInput),
  },
  {
    name: 'runBlueDetectionStage',
    description: 'Run the artifact-bound Blue detection stage and emit Sigma rulepack.',
    run: (p) => runBlueDetectionStage(p as unknown as BlueDetectionStageInput),
  },
  {
    name: 'runBlueDetectorStage',
    description: 'Run the offline Blue detector validation stage against supplied matching/non-matching evidence.',
    run: (p) => runBlueDetectorStage(p as unknown as BlueDetectorStageInput),
  },
  {
    name: 'runBlueRetestStage',
    description: 'Run the Blue hardening retest stage with item-linked baseline and retest evidence IDs.',
    run: (p) => runBlueRetestStage(p as unknown as BlueRetestStageInput),
  },
  {
    name: 'runBlueCoverageAcrossFamilies',
    description: 'Run Blue coverage across multiple mission families in isolation.',
    run: (p) => runBlueCoverageAcrossFamilies(p as unknown as BlueCoverageStageInput),
  },
  {
    name: 'blueInputHash',
    description: 'Compute deterministic SHA-256 input digest for Blue stage bindings.',
    run: (p) => ({ sha256: blueInputHash(typeof p.text === 'string' ? p.text : JSON.stringify(p)) }),
  },
  {
    name: 'coverageGaps',
    description: 'Evaluate D3FEND countermeasure coverage gaps for findings and telemetry declarations.',
    run: (p) => coverageGaps(
      (Array.isArray(p.findings) ? p.findings : []) as CoverageFinding[],
      (Array.isArray(p.telemetry) ? p.telemetry : []) as TelemetryDeclaration[],
      p.observed as ObservedArtifactIds | undefined,
    ),
  },
  {
    name: 'detectionGaps',
    description: 'Evaluate telemetry detection gaps per finding.',
    run: (p) => detectionGaps(
      (Array.isArray(p.findings) ? p.findings : []) as RedFindingShape[],
      (Array.isArray(p.telemetry) ? p.telemetry : undefined) as TelemetrySourceShape[] | undefined,
      p.observed as ObservedArtifactIds | undefined,
    ),
  },
  {
    name: 'hardeningPlan',
    description: 'Group findings into severity-tiered Blue hardening work items.',
    run: (p) => hardeningPlan((Array.isArray(p.findings) ? p.findings : []) as RedFindingShape[]),
  },
  {
    name: 'evaluateHardeningRetest',
    description: 'Resolve a hardening retest outcome from baseline and retest evidence IDs.',
    run: (p) => ({ outcome: evaluateHardeningRetest(p) }),
  },
  {
    name: 'applyHardeningRetest',
    description: 'Link baseline and retest evidence IDs onto a hardening item and resolve its retest outcome.',
    run: (p) => applyHardeningRetest(
      (p.item ?? p) as unknown as HardeningItem,
      (p.verdict ?? p) as { baselineEvidenceIds?: unknown; retestEvidenceIds?: unknown; retestPassed?: unknown },
    ),
  },
  {
    name: 'validateDetectorStanding',
    description: 'Validate a Sigma or YARA detector offline against matching and non-matching evidence excerpts.',
    run: (p) => validateDetectorStanding(p as unknown as DetectorValidationInput),
  },
  {
    name: 'sigmaRulepack',
    description: 'Generate deterministic Sigma YAML rules keyed to uncovered D3FEND countermeasures.',
    run: (p) => sigmaRulepack(
      (Array.isArray(p.findings) ? p.findings : []) as RedFindingShape[],
      (Array.isArray(p.gaps) ? p.gaps : []) as CoverageGap[],
      p.options as SigmaRuleOptions | undefined,
    ),
  },
  {
    name: 'sigmaRuleForGap',
    description: 'Generate a single Sigma rule for an uncovered coverage gap.',
    run: (p) => sigmaRuleForGap(
      p.finding as RedFindingShape | undefined,
      (p.gap ?? p) as unknown as CoverageGap,
      p.options as SigmaRuleOptions | undefined,
    ),
  },
  {
    name: 'sentinelDetectorMap',
    description: 'Map findings to telemetry via detectionGaps and produce Sentinel detector engineering specifications.',
    run: (p) => sentinelDetectorMap(
      (Array.isArray(p.findings) ? p.findings : []) as RedFindingShape[],
      (Array.isArray(p.telemetry) ? p.telemetry : undefined) as TelemetrySourceShape[] | undefined,
      p.stage as SentinelStageBinding | undefined,
    ),
  },
  {
    name: 'wardenHardeningReview',
    description: 'Audit hardening plan items and optional linked retest outcomes.',
    run: (p) => wardenHardeningReview(
      (Array.isArray(p.findings) ? p.findings : []) as RedFindingShape[],
      p.retest as {
        runId: string;
        missionId: string;
        links: Array<{ itemIndex: number; baselineEvidenceIds: string[]; retestEvidenceIds: string[]; retestPassed: boolean }>;
      } | undefined,
    ),
  },
  {
    name: 'runBlackWorkflow',
    description: 'Run the Black staged OPSEC, noise budget, and exfil cost workflow with refusal boundary.',
    run: (p) => runBlackWorkflow(p as BlackWorkflowInput),
  },
  {
    name: 'hashBlackInput',
    description: 'Compute deterministic FNV-1a digest for Black workflow input.',
    run: (p) => ({ inputHash: hashBlackInput(p as BlackWorkflowInput) }),
  },
  {
    name: 'exfilCostModel',
    description: 'Model detection-surface cost across planned exfiltration paths.',
    run: (p) => exfilCostModel({
      paths: (Array.isArray(p.paths) ? p.paths : []) as Array<ExfilPath | string>,
      egress: Array.isArray(p.egress) ? p.egress.map(String) : undefined,
      budget: typeof p.budget === 'number' ? p.budget : undefined,
      routeEvidence: Array.isArray(p.routeEvidence) ? (p.routeEvidence as RouteEvidence[]) : undefined,
    }),
  },
  {
    name: 'structuredNoiseBudget',
    description: 'Score planned actions against ATT&CK tactic-weighted noise budget.',
    run: (p) => structuredNoiseBudget({
      actions: Array.isArray(p.actions) ? p.actions.map(String) : [],
      budget: typeof p.budget === 'number' ? p.budget : undefined,
      egress: Array.isArray(p.egress) ? p.egress.map(String) : undefined,
    }),
  },
  {
    name: 'matchVocabulary',
    description: 'Match an action string against the vendored ATT&CK noise vocabulary.',
    run: (p) => matchVocabulary(typeof p.action === 'string' ? p.action : String(p.command ?? '')),
  },
  {
    name: 'opsecReview',
    description: 'Review planned actions and egress declarations against phase-keyed OPSEC checklists.',
    run: (p) => opsecReview({
      actions: Array.isArray(p.actions) ? p.actions.map(String) : undefined,
      egress: Array.isArray(p.egress) ? p.egress.map(String) : undefined,
    }),
  },
  {
    name: 'opsecChecklist',
    description: 'Retrieve the OPSEC checklist for an ATT&CK tactic phase.',
    run: (p) => opsecChecklist((typeof p.phase === 'string' ? p.phase : 'reconnaissance') as OpsecPhase),
  },
  {
    name: 'noiseBudget',
    description: 'Score a mission plan noise budget.',
    run: (p) => noiseBudget({
      actions: Array.isArray(p.actions) ? p.actions.map(String) : [],
      egress: Array.isArray(p.egress) ? p.egress.map(String) : undefined,
    }),
  },
  {
    name: 'coverAudit',
    description: 'Perform awareness-only cover and residue audit for a planned or executed command.',
    run: (p) => coverAudit({
      command: typeof p.command === 'string' ? p.command : String(p.action ?? ''),
      artifacts: Array.isArray(p.artifacts) ? p.artifacts.map(String) : undefined,
    }),
  },
  {
    name: 'specterCoverReview',
    description: 'Critique a plan for per-action cover, noise budget, and realism flags.',
    run: (p) => specterCoverReview({
      actions: Array.isArray(p.actions) ? p.actions.map(String) : [],
      egress: Array.isArray(p.egress) ? p.egress.map(String) : undefined,
    }),
  },
  {
    name: 'wraithExfilSim',
    description: 'Simulate exfiltration paths as analysis with cost tiers and route standing.',
    run: (p) => wraithExfilSim({
      paths: (Array.isArray(p.paths) ? p.paths : []) as ExfilPathShape[],
      egress: Array.isArray(p.egress) ? p.egress.map(String) : undefined,
      routeEvidence: Array.isArray(p.routeEvidence) ? (p.routeEvidence as RouteEvidence[]) : undefined,
    }),
  },
  {
    name: 'parseRoe',
    description: 'Parse operator ROE text into a structured RoeSpec with resolved/unresolved line accounting.',
    run: (p) => parseRoe(typeof p.roeText === 'string' ? p.roeText : String(p.text ?? '')),
  },
  {
    name: 'stageRoeAudit',
    description: 'Run the staged White ROE gate and audit actions against parsed ROE scope and approval receipts.',
    run: (p) => stageRoeAudit(
      typeof p.roeText === 'string' ? p.roeText : String(p.text ?? ''),
      (Array.isArray(p.actions) ? p.actions : []) as ApprovalBearingAction[],
      p.meta as RoeStageMeta | undefined,
    ),
  },
  {
    name: 'roeAudit',
    description: 'Audit actions against a structured RoeSpec.',
    run: (p) => roeAudit(
      (Array.isArray(p.actions) ? p.actions : []) as AuditedAction[],
      (p.roe ?? {}) as RoeSpec,
    ),
  },
  {
    name: 'adjudicateEvidence',
    description: 'Adjudicate evidence entries against the platform provenance ranking.',
    run: (p) => adjudicateEvidence((Array.isArray(p.entries) ? p.entries : []) as EvidenceEntryShape[]),
  },
  {
    name: 'pairDisputeRulings',
    description: 'Pair opposed Red and Blue dispute claims per action against ROE verdicts.',
    run: (p) => pairDisputeRulings(
      (Array.isArray(p.claims) ? p.claims : []) as DisputeClaim[],
      (Array.isArray(p.verdicts) ? p.verdicts : []) as RoeVerdict[],
    ),
  },
  {
    name: 'auditEvidenceChain',
    description: 'Validate receipt-ledger evidence chain links and provenance strength.',
    run: (p) => auditEvidenceChain((Array.isArray(p.entries) ? p.entries : []) as LedgerEvidenceShape[]),
  },
  {
    name: 'resolveLedgerStrength',
    description: 'Resolve the provenance strength of a ledger evidence entry.',
    run: (p) => ({ strength: resolveLedgerStrength((p.entry ?? p) as LedgerEvidenceShape) }),
  },
  {
    name: 'auditReport',
    description: 'Audit findings-to-evidence coverage, remediation completeness, and unclaimed evidence.',
    run: (p) => auditReport(
      (Array.isArray(p.findings) ? p.findings : []) as FindingShape[],
      (Array.isArray(p.evidence) ? p.evidence : Array.isArray(p.entries) ? p.entries : []) as LedgerEvidenceShape[],
    ),
  },
  {
    name: 'aggregateEvidenceStanding',
    description: 'Compute aggregate sufficiency standing and score across findings and evidence.',
    run: (p) => aggregateEvidenceStanding(
      (Array.isArray(p.findings) ? p.findings : []) as FindingShape[],
      (Array.isArray(p.evidence) ? p.evidence : Array.isArray(p.entries) ? p.entries : []) as LedgerEvidenceShape[],
      p.options as { requiredFindingIds?: string[]; disputes?: PairedDisputeRuling[] } | undefined,
    ),
  },
  {
    name: 'arbiterDispute',
    description: 'Adjudicate actions via roeAudit and pair opposed Red/Blue dispute claims.',
    run: (p) => arbiterDispute({
      actions: (Array.isArray(p.actions) ? p.actions : []) as AuditedAction[],
      roe: (p.roe ?? {}) as RoeSpec,
      claims: Array.isArray(p.claims) ? (p.claims as DisputeClaim[]) : undefined,
    }),
  },
  {
    name: 'auditorScore',
    description: 'Review evidence entries, label provenance confidence, and compute Auditor readiness score.',
    run: (p) => auditorScore((Array.isArray(p.entries) ? p.entries : []) as EvidenceEntryShape[]),
  },
];

/**
 * Mint callable CustomTool instances for specialist workflow/engine functions and
 * registered 4-Hat tools permitted by `permittedNames`, skipping any already in `alreadyRegistered`.
 */
export function buildSpecialistWorkflowTools(
  permittedNames: ReadonlySet<string>,
  alreadyRegistered: ReadonlySet<string> = new Set(),
): CustomTool[] {
  const tools: CustomTool[] = [];

  for (const entry of SPECIALIST_WORKFLOW_ENTRIES) {
    if (!permittedNames.has(entry.name) || alreadyRegistered.has(entry.name)) continue;
    tools.push({
      name: entry.name,
      description: entry.description,
      category: 'custom',
      riskTier: 'passive',
      parameters: [
        {
          name: 'input',
          type: 'object',
          description: `Structured parameters for ${entry.name}`,
          required: false,
        },
      ],
      handler: async (context: ToolContext): Promise<ToolResult> => {
        const rawParams = context.parameters ?? {};
        const nested = rawParams.input;
        const effectiveParams =
          nested && typeof nested === 'object' && !Array.isArray(nested)
            ? { ...rawParams, ...(nested as Record<string, unknown>) }
            : rawParams;
        const data = await entry.run(effectiveParams);
        return {
          success: true,
          output: JSON.stringify(data),
        };
      },
    });
  }

  for (const reg of HAT_TOOL_REGISTRY) {
    if (!permittedNames.has(reg.id) || alreadyRegistered.has(reg.id)) continue;
    tools.push({
      name: reg.id,
      description: reg.description,
      category: 'custom',
      riskTier: 'passive',
      parameters: reg.parameters.map((param) => ({
        name: param.name,
        type: param.type === 'json' ? 'object' : param.type,
        description: param.description,
        required: param.required,
      })),
      handler: async (context: ToolContext): Promise<ToolResult> => {
        const envelope = await executeRegisteredHatTool(reg.id, context.parameters ?? {});
        return {
          success: envelope.ok,
          output: JSON.stringify(envelope),
          ...(envelope.ok ? {} : { error: envelope.error?.message ?? 'Hat tool execution failed' }),
        };
      },
    });
  }

  return tools;
}
