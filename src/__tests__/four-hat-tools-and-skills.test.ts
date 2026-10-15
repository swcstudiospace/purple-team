import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_TOOL_PAYLOAD_BYTES,
  sanitizePayload,
  sanitizeInput,
  escapeHtml,
  checkPayloadCap,
  migrateWorkspaceState,
  runGuardedTool,
  BLUE_STARTER_TEMPLATES,
  runBlueWorkflowSequencer,
  runBlueDecisionLedger,
  runBlueExecutionMonitor,
  runWhiteDataInspector,
  runWhiteEvidenceCollector,
  runWhiteGapAnalyzer,
  BLACK_BASELINE_PROFILES,
  runBlackRiskAnalyzer,
  runBlackPolicyValidator,
  runBlackStressProber,
  runContextTransformTool,
  runArtifactDiffTool,
  runSnapshotManagerTool,
  runBatchRunnerTool,
  HAT_TOOL_REGISTRY,
  SKILL_CATALOG,
  listRegisteredHatTools,
  getRegisteredHatTool,
  executeRegisteredHatTool,
  listComposableSkills,
  getComposableSkill,
  runComposableSkill,
} from '../teams/index.js';
import { synthesize } from '../teams/purple.js';
import { exfilCostModel } from '../teams/black/exfil.js';

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

describe('Wave 2: Security Guardrails, Sanitization, Payload Caps & State Migration', () => {
  it('strips prototype-pollution keys and detects dangerous XSS/script patterns', () => {
    const raw = JSON.parse(
      '{"safe":"ok","__proto__":{"polluted":true},"nested":{"constructor":"bad","prototype":"bad","xss":"<script>alert(1)</script>"}}',
    ) as Record<string, unknown>;
    const res = sanitizePayload(raw);
    expect(res.strippedKeys).toBe(3);
    expect(res.dangerousPatterns.length).toBeGreaterThan(0);
    expect(Object.prototype.hasOwnProperty.call(res.value, '__proto__')).toBe(false);
    const nested = res.value.nested as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(nested, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(nested, 'prototype')).toBe(false);
    expect(sanitizeInput(raw).safe).toBe('ok');
  });

  it('escapes HTML entities deterministically', () => {
    expect(escapeHtml('<img src=x onerror="alert(\'xss\')">&')).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;',
    );
  });

  it('enforces payload size caps and rejects oversized inputs cleanly', () => {
    expect(MAX_TOOL_PAYLOAD_BYTES).toBe(2 * 1024 * 1024);
    const small = checkPayloadCap({ hello: 'world' }, 1024);
    expect(small.ok).toBe(true);

    const huge = checkPayloadCap({ blob: 'x'.repeat(2048) }, 512);
    expect(huge.ok).toBe(false);
    if (!huge.ok) {
      expect(huge.reason).toBe('payload-cap-exceeded');
      expect(huge.byteLength).toBeGreaterThan(512);
    }
  });

  it('migrates v1 workspace state and corrupt payloads to v2 schema without data loss', () => {
    const v1 = {
      version: 1,
      hat: 'white',
      drafts: { 'white-gap-analyzer': { requiredVariables: ['mfa'] } },
      pinnedOutputs: [
        {
          id: 'pin-1',
          hat: 'white',
          toolId: 'white-gap-analyzer',
          title: 'Gap Report',
          summary: 'Summary',
          data: { completenessScore: 80 },
        },
      ],
    };
    const migrated = migrateWorkspaceState(v1);
    expect(migrated.version).toBe(2);
    expect(migrated.activeHat).toBe('white');
    expect(migrated.toolDrafts['white-gap-analyzer']).toEqual({ requiredVariables: ['mfa'] });
    expect(migrated.pinnedOutputs).toHaveLength(1);

    const fromNull = migrateWorkspaceState(null);
    expect(fromNull.version).toBe(2);
    expect(fromNull.activeHat).toBe('blue');
  });

  it('isolates tool timeouts, cancellations, and runtime errors via runGuardedTool', async () => {
    const okRun = await runGuardedTool({
      toolId: 'test-ok',
      hat: 'blue',
      input: { a: 1 },
      handler: (input) => ({ state: 'success', echoed: input.a }),
    });
    expect(okRun.ok).toBe(true);
    expect(okRun.status).toBe('success');

    const timeoutRun = await runGuardedTool({
      toolId: 'test-timeout',
      hat: 'black',
      input: {},
      timeoutMs: 25,
      handler: async () => {
        const { promise, resolve } = Promise.withResolvers<{ state: string }>();
        setTimeout(() => resolve({ state: 'success' }), 200);
        return promise;
      },
    });
    expect(timeoutRun.ok).toBe(false);
    expect(timeoutRun.status).toBe('timeout');
    expect(timeoutRun.error?.code).toBe('TOOL_TIMEOUT');

    const controller = new AbortController();
    controller.abort();
    const cancelledRun = await runGuardedTool({
      toolId: 'test-cancel',
      hat: 'white',
      input: {},
      signal: controller.signal,
      handler: () => ({ state: 'success' }),
    });
    expect(cancelledRun.ok).toBe(false);
    expect(cancelledRun.status).toBe('cancelled');
    expect(cancelledRun.error?.code).toBe('TOOL_CANCELLED');
  });
});

describe('Wave 2: Blue Hat Tools (Workflow Sequencer, Decision Ledger, Execution Monitor)', () => {
  it('runs Blue Workflow Sequencer across starter templates, empty state, and step fault isolation', () => {
    expect(BLUE_STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(3);

    const empty = runBlueWorkflowSequencer({});
    expect(empty.state).toBe('empty');
    expect(empty.starterTemplates.length).toBeGreaterThanOrEqual(3);

    const templateRun = runBlueWorkflowSequencer({
      workflowName: 'Edge Triage',
      objective: 'Verify edge gateway anomaly',
      steps: BLUE_STARTER_TEMPLATES[0].steps,
    });
    expect(templateRun.state).toBe('success');
    expect(templateRun.timeline.length).toBe(4);
    expect(templateRun.timeline.some((s) => (s.checkpointHash ?? '').startsWith('chk-'))).toBe(true);
    expect(templateRun.nextHatHandoff?.targetHat).toBeDefined();

    const faultRun = runBlueWorkflowSequencer({
      objective: 'Test step fault isolation',
      steps: [
        { id: 's1', label: 'Step 1', hat: 'white', toolId: 'white-data-inspector' },
        { id: 's2', label: 'Step 2', hat: 'black', toolId: 'black-risk-analyzer', simulateFailure: true },
        { id: 's3', label: 'Step 3', hat: 'blue', toolId: 'blue-decision-ledger' },
      ],
    });
    expect(faultRun.state).toBe('error');
    expect(faultRun.failedStep?.toolId).toBe('black-risk-analyzer');
    expect(faultRun.failedStep?.retryFromStep).toBe(1);
    expect(faultRun.timeline[0].status).toBe('completed');
    expect(faultRun.timeline[1].status).toBe('failed');
  });

  it('runs Blue Decision Ledger with rationale digests, unbacked detection, and Markdown/JSON export', () => {
    const empty = runBlueDecisionLedger({});
    expect(empty.state).toBe('empty');

    const ledger = runBlueDecisionLedger({
      sessionId: 'sess-01',
      objective: 'Harden token endpoint',
      constraints: ['Zero downtime'],
      decisions: [
        {
          fromHat: 'white',
          toHat: 'black',
          summary: 'Confirmed missing MFA claim check',
          rationale: 'Observed 200 OK without mfa field in JSONL',
          evidenceRefs: ['ev-1'],
        },
        {
          fromHat: 'black',
          toHat: 'blue',
          summary: 'Unbacked speculative change',
          rationale: '',
          evidenceRefs: [],
        },
      ],
    });
    expect(ledger.state).toBe('success');
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.unbackedDecisionCount).toBe(1);
    expect(ledger.exportMarkdown).toContain('# Blue Hat Session & Decision Ledger');
    expect((JSON.parse(ledger.exportJson) as { sessionId: string }).sessionId).toBe('sess-01');
  });

  it('runs Blue Execution Monitor across multi-Hat tasks and budget limits', () => {
    const empty = runBlueExecutionMonitor({});
    expect(empty.state).toBe('empty');

    const mon = runBlueExecutionMonitor({
      budgetLimitMs: 1000,
      maxConcurrency: 2,
      tasks: [
        { id: 't1', hat: 'white', toolId: 'white-data-inspector', status: 'completed', elapsedMs: 400 },
        { id: 't2', hat: 'black', toolId: 'black-risk-analyzer', status: 'failed', elapsedMs: 500 },
        { id: 't3', hat: 'blue', toolId: 'blue-decision-ledger', status: 'queued', elapsedMs: 0 },
      ],
    });
    expect(mon.state).toBe('success');
    expect(mon.budgetUtilizationPct).toBe(90);
    expect(mon.withinBudget).toBe(true);
    expect(mon.perHatStats.black.failed).toBe(1);
  });
});

describe('Wave 2: White Hat Tools (Data Inspector, Evidence Collector, Gap Analyzer)', () => {
  it('parses JSON, JSONL, and key=value logs and preserves raw input on malformed JSON', () => {
    const empty = runWhiteDataInspector({});
    expect(empty.state).toBe('empty');

    const jsonl = runWhiteDataInspector({
      format: 'jsonl',
      rawPayload: '{"service":"api","status":200}\n{"service":"auth","status":401}',
    });
    expect(jsonl.state).toBe('success');
    expect(jsonl.totalRecords).toBe(2);
    expect(jsonl.schemaSummary.map((f) => f.field)).toContain('service');

    const kv = runWhiteDataInspector({
      format: 'kv_log',
      rawPayload: 'src=10.0.0.1 dst=10.0.0.2 action=BLOCK\nsrc=10.0.0.3 dst=10.0.0.2 action=ALLOW',
    });
    expect(kv.state).toBe('success');
    expect(kv.totalRecords).toBe(2);

    const malformed = runWhiteDataInspector({
      format: 'json',
      rawPayload: '{"broken": [1, 2, }',
    });
    expect(malformed.state).toBe('error');
    expect(malformed.rawInputPreserved).toBe('{"broken": [1, 2, }');
    expect(malformed.diagnostics.length).toBeGreaterThan(0);
  });

  it('scores evidence confidence tiers and SHA-256 provenance deterministically', () => {
    const empty = runWhiteEvidenceCollector({});
    expect(empty.state).toBe('empty');

    const col = runWhiteEvidenceCollector({
      facts: [
        {
          claim: 'Verified TLS 1.3 config',
          source: 'nginx.conf',
          artifactId: 'art-1',
          sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          corroboratedBy: ['auditor-1'],
        },
        {
          claim: 'Contradicted firewall claim',
          source: 'fw.log',
          contradictedBy: ['pcap-capture'],
        },
        {
          claim: 'Unverified verbal note',
          source: 'notes.txt',
        },
      ],
    });
    expect(col.state).toBe('success');
    expect(col.summaryCounts.verified).toBe(1);
    expect(col.summaryCounts.contradicted).toBe(1);
    expect(col.summaryCounts.unverified).toBe(1);
  });

  it('identifies missing variables and unverified assumptions in White Gap Analyzer', () => {
    const empty = runWhiteGapAnalyzer({});
    expect(empty.state).toBe('empty');

    const gaps = runWhiteGapAnalyzer({
      knownFacts: [
        { variable: 'scope', value: 'api.internal', verified: true },
        { variable: 'mfa', value: 'optional', verified: false },
      ],
      requiredVariables: ['scope', 'mfa', 'rate_limit'],
      assumptions: [{ statement: 'All endpoints enforce rate_limit', verified: false, criticality: 'high' }],
    });
    expect(gaps.state).toBe('success');
    expect(gaps.missingVariables).toContain('rate_limit');
    expect(gaps.unverifiedVariables).toContain('mfa');
    expect(gaps.resolutionQueries.some((q) => q.priority === 'P1')).toBe(true);
  });
});

describe('Wave 2: Black Hat Tools (Risk Analyzer, Policy Validator, Stress Prober)', () => {
  it('evaluates failure modes and ranks findings in Black Risk Analyzer', () => {
    const empty = runBlackRiskAnalyzer({});
    expect(empty.state).toBe('empty');

    const risk = runBlackRiskAnalyzer({
      planName: 'Edge Gateway',
      components: [
        {
          name: 'auth-gateway',
          category: 'auth',
          singlePointOfFailure: true,
          handlesSecrets: true,
          externalDependency: true,
          noiseLevel: 'high',
          hasFallback: false,
        },
      ],
      assumptions: ['Upstream load balancer strips spoofed headers'],
    });
    expect(risk.state).toBe('success');
    expect(risk.severityCounts.Critical).toBeGreaterThanOrEqual(1);
    expect(risk.findings[0].riskScore).toBeGreaterThanOrEqual(risk.findings[risk.findings.length - 1].riskScore);
    expect(risk.findings[0].blueHatHandoff.targetTool).toBeDefined();
  });

  it('audits policy rules and catches corrupt config JSON as a Critical finding without crashing', () => {
    expect(BLACK_BASELINE_PROFILES.length).toBeGreaterThanOrEqual(3);
    const empty = runBlackPolicyValidator({});
    expect(empty.state).toBe('empty');

    const corrupt = runBlackPolicyValidator({
      rawConfig: '{corrupt-json',
    });
    expect(corrupt.state).toBe('error');
    expect(corrupt.checks[0].ruleId).toBe('POL-PARSE-001');
    expect(corrupt.checks[0].severity).toBe('Critical');

    const compliant = runBlackPolicyValidator({
      artifactName: 'zero-trust-api',
      rawConfig: {
        bindHost: '127.0.0.1',
        tlsEnabled: true,
        timeoutMs: 15000,
      },
      allowedHosts: ['127.0.0.1'],
    });
    expect(compliant.state).toBe('success');
    expect(compliant.failedCount).toBe(0);
    expect(compliant.passedCount).toBeGreaterThan(0);
  });

  it('generates boundary, adversarial, resource, and timeout scenarios in Black Stress Prober', () => {
    const empty = runBlackStressProber({});
    expect(empty.state).toBe('empty');

    const stress = runBlackStressProber({
      targetComponent: 'POST /api/teams/tools/run',
      inputFields: [{ name: 'payload', type: 'json', required: true }],
      dependencies: ['sqlite-store'],
    });
    expect(stress.state).toBe('success');
    expect(stress.scenarios.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Wave 2: Extra Tools, Registry & Composable Skills', () => {
  it('runs Context Transformer, Artifact Diff, Snapshot Manager, and Batch Runner', () => {
    const tx = runContextTransformTool({
      fromHat: 'white',
      toHat: 'black',
      payload: { missingVariables: ['waf_version'] },
    });
    expect(tx.state).toBe('success');
    expect(tx.targetToolId).toBe('black-risk-analyzer');
    expect(tx.provenanceHash.startsWith('sha256-')).toBe(true);

    const diff = runArtifactDiffTool({
      before: '{"score": 60}\n{"status": "warn"}',
      after: '{"score": 100}\n{"status": "ok"}',
    });
    expect(diff.state).toBe('success');
    expect(diff.addedLines).toBe(2);
    expect(diff.removedLines).toBe(2);

    const snap = runSnapshotManagerTool({
      action: 'create',
      label: 'unit-test',
      activeHat: 'white',
    });
    expect(snap.state).toBe('success');
    expect(snap.integrityVerified).toBe(true);

    const verifyOk = runSnapshotManagerTool({
      action: 'verify',
      snapshotToVerify: {
        id: snap.snapshotId,
        version: 2,
        sha256: snap.sha256,
        state: snap.restoredState as Record<string, unknown>,
      },
    });
    expect(verifyOk.state).toBe('success');
    expect(verifyOk.integrityVerified).toBe(true);

    const batch = runBatchRunnerTool({
      batchName: 'Fault Isolation Batch',
      stopOnError: false,
      jobs: [
        { id: 'j1', hat: 'white', toolId: 'white-data-inspector', payloadSummary: 'Inspect logs' },
        { id: 'j2', hat: 'black', toolId: 'black-risk-analyzer', payloadSummary: 'Simulate fail', simulateError: true },
        { id: 'j3', hat: 'blue', toolId: 'blue-decision-ledger', payloadSummary: 'Record ledger' },
      ],
    });
    expect(batch.state).toBe('error');
    expect(batch.succeededJobs).toBe(2);
    expect(batch.failedJobs).toBe(1);
  });

  it('registers all 14 Hat tools and executes all 4 Composable Skills end-to-end', async () => {
    expect(HAT_TOOL_REGISTRY.length).toBe(14);
    expect(listRegisteredHatTools('blue')).toHaveLength(3);
    expect(listRegisteredHatTools('white')).toHaveLength(3);
    expect(listRegisteredHatTools('black')).toHaveLength(3);
    expect(listRegisteredHatTools('shared')).toHaveLength(4);
    expect(listRegisteredHatTools('red')).toHaveLength(1);
    expect(getRegisteredHatTool('blue-workflow-sequencer')?.hat).toBe('blue');

    for (const tool of HAT_TOOL_REGISTRY) {
      const env = await executeRegisteredHatTool(tool.id, tool.defaultPreset);
      expect(env.ok, `Tool ${tool.id} failed`).toBe(true);
      expect(env.status).toBe('success');
    }

    expect(SKILL_CATALOG.length).toBe(4);
    expect(listComposableSkills()).toHaveLength(4);
    expect(getComposableSkill('skill-purple-four-hat-synthesis')?.involvedHats).toEqual([
      'red',
      'white',
      'black',
      'blue',
    ]);

    for (const skill of SKILL_CATALOG) {
      const res = await runComposableSkill(skill.id, skill.defaultParams);
      expect(res.ok, `Skill ${skill.id} failed`).toBe(true);
      expect(res.status).toBe('success');
      expect(res.data?.stepOutputs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('enforces Greptile round-1 and round-2 hardening across sequencers, snapshots, data validation, gap analysis, policy checks, and purple synthesis', async () => {
    // 1. Unknown toolId in sequencer & batch runner fails closed with durationMs 0
    const badSeq = runBlueWorkflowSequencer({
      steps: [{ id: 's1', label: 'Unknown', hat: 'blue', toolId: 'nonexistent-tool' }],
    });
    expect(badSeq.state).toBe('error');
    expect(badSeq.timeline[0].status).toBe('failed');
    expect(badSeq.timeline[0].durationMs).toBe(0);

    const badBatch = runBatchRunnerTool({
      jobs: [{ id: 'j1', hat: 'blue', toolId: 'nonexistent-tool', payloadSummary: 'test' }],
    });
    expect(badBatch.state).toBe('error');
    expect(badBatch.failedJobs).toBe(1);
    expect(badBatch.results[0].durationMs).toBe(0);

    // 2. Snapshot restore verifies sha256 against expectedSha
    const badRestore = runSnapshotManagerTool({
      action: 'restore',
      snapshotToVerify: {
        id: 'snap-1',
        version: 2,
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
        state: { activeHat: 'blue' },
      },
    });
    expect(badRestore.state).toBe('error');
    expect(badRestore.integrityVerified).toBe(false);

    // 3. migrateWorkspaceState preserves string toolDrafts, payload on pinnedOutputs, and forwardedContext metadata
    const migrated = migrateWorkspaceState({
      version: 2,
      activeHat: 'white',
      toolDrafts: { 'white-data-inspector': '{"raw":"text"}' },
      pinnedOutputs: [{ id: 'p1', hat: 'white', toolId: 'white-data-inspector', label: 'L', pinnedAt: 'now', payload: { ok: 1 } }],
      forwardedContext: { fromHat: 'white', toHat: 'black', sourceToolId: 't1', targetToolId: 't2', payload: { x: 1 }, forwardedAt: '2026-01-01T00:00:00Z' },
    });
    expect(migrated.toolDrafts['white-data-inspector']).toBe('{"raw":"text"}');
    expect(migrated.pinnedOutputs[0].payload).toEqual({ ok: 1 });
    expect(migrated.forwardedContext?.sourceToolId).toBe('t1');
    expect(migrated.forwardedContext?.targetToolId).toBe('t2');
    expect(migrated.forwardedContext?.forwardedAt).toBe('2026-01-01T00:00:00Z');

    // 4. White Data Inspector marks required field with null value as error
    const nullField = runWhiteDataInspector({
      format: 'json',
      rawPayload: JSON.stringify([{ id: null }]),
      requiredFields: ['id'],
    });
    expect(nullField.state).toBe('error');
    expect(nullField.schemaSummary.find(f => f.field === 'id')?.missingCount).toBe(1);

    // 5. White Gap Analyzer treats omitted verified flag as unverified
    const omittedVerified = runWhiteGapAnalyzer({
      knownFacts: [{ variable: 'scope', value: 'example.com' }],
      requiredVariables: ['scope'],
    });
    expect(omittedVerified.unverifiedVariables).toContain('scope');

    // 6. Black Policy Validator detects JSON secrets and userinfo URL bypasses
    const jsonSecret = runBlackPolicyValidator({
      rawConfig: '{"apiKey":"sk-1234567890abcdefghijklmnop"}',
      allowedHosts: ['localhost'],
    });
    expect(jsonSecret.checks.find(c => c.ruleId === 'POL-SEC-001')?.passed).toBe(false);

    const userinfoBypass = runBlackPolicyValidator({
      rawConfig: { endpoint: 'http://localhost@evil.example/exfil', bindHost: '127.0.0.1', tlsEnabled: true, timeoutMs: 5000 },
      allowedHosts: ['localhost'],
    });
    expect(userinfoBypass.checks.find(c => c.ruleId === 'POL-SEC-003')?.passed).toBe(false);
    expect(userinfoBypass.checks.find(c => c.ruleId === 'POL-CMP-006')?.passed).toBe(false);

    // 7. Purple synthesis handles prototype property names on severity and findingId
    const synth = synthesize({
      findings: [
        { id: 'toString', title: 'Proto finding', severity: 'toString' },
        { id: 'constructor', title: 'Constructor finding', severity: 'constructor' },
      ],
      detections: [],
      verdicts: [],
    });
    expect(synth.coverageMatrix[0].residualRisk).toContain('high residual risk');
    expect(synth.coverageMatrix).toHaveLength(2);

    // 8. exfilCostModel normalizes string path entries without undefined pathId
    const exfil = exfilCostModel({
      paths: ['dns-tunnel', 'p2 | raw-socket | 250'],
      egress: ['egress-fw'],
    });
    expect(exfil.paths[0].pathId).toBe('dns-tunnel');
    expect(exfil.paths[0].channel).toBe('dns-tunnel');
    expect(exfil.paths[1].pathId).toBe('p2');
    expect(exfil.paths[1].channel).toBe('raw-socket');
    expect(exfil.paths[1].volumeCost).toBe(3);
    expect(exfil.totalVolumeMb).toBe(250);

    // 9. Sequencer and Batch Runner accept registered IDs shared-context-transform and red-surface-validator
    const seqReal = runBlueWorkflowSequencer({
      steps: [
        { id: 's1', hat: 'blue', toolId: 'shared-context-transform', label: 'Transform context' },
        { id: 's2', hat: 'red', toolId: 'red-surface-validator', label: 'Validate surface' },
      ],
    });
    expect(seqReal.state).toBe('success');
    expect(seqReal.timeline.every(t => t.status === 'completed')).toBe(true);

    const batchReal = runBatchRunnerTool({
      jobs: [
        { id: 'b1', hat: 'blue', toolId: 'shared-context-transform', payloadSummary: 'Transform context' },
        { id: 'b2', hat: 'red', toolId: 'red-surface-validator', payloadSummary: 'Validate surface' },
      ],
    });
    expect(batchReal.state).toBe('success');
    expect(batchReal.succeededJobs).toBe(2);

    // 10. White Data Inspector reports omittedSchemaFieldsCount when schema exceeds 500 fields
    const wideRec: Record<string, unknown> = {};
    for (let i = 0; i < 505; i += 1) {
      wideRec[`field_${String(i).padStart(4, '0')}`] = i;
    }
    const wideResult = runWhiteDataInspector({ rawPayload: [wideRec] });
    expect(wideResult.state).toBe('error');
    expect(wideResult.schemaSummary).toHaveLength(500);
    expect(wideResult.omittedSchemaFieldsCount).toBe(5);
    expect(wideResult.omittedSchemaFields).toHaveLength(5);
    expect(wideResult.diagnostics.some(d => d.message.includes('500-field bound'))).toBe(true);

    // 11. Composable Skill keeps uncorroborated imported values unverified and reads all inspector pages (>50 rows)
    const unverifiedSkill = await runComposableSkill('skill-white-roe-gap-verification', {
      rawPayload: [{ scope: 'example.com' }],
      requiredVariables: ['scope'],
      assumptions: [],
    });
    expect(unverifiedSkill.ok).toBe(true);
    const gapStepOut = unverifiedSkill.data?.stepOutputs[1].output as {
      knownVerifiedCount?: number;
      completenessScore?: number;
      unverifiedVariables?: string[];
    };
    expect(gapStepOut.knownVerifiedCount).toBe(0);
    expect(gapStepOut.completenessScore).toBe(50);
    expect(gapStepOut.unverifiedVariables).toContain('scope');

    const rows51 = Array.from({ length: 51 }, (_, idx) => ({
      id: `row-${idx + 1}`,
      host: '127.0.0.1',
      severity: 'low',
    }));
    const multiPageSkill = await runComposableSkill('skill-white-roe-gap-verification', {
      rawPayload: rows51,
    });
    expect(multiPageSkill.ok).toBe(true);
    const evStepOut = multiPageSkill.data?.stepOutputs[2].output as {
      summaryCounts?: { total?: number; unverified?: number };
    };
    expect(evStepOut.summaryCounts?.total).toBe(51);
    expect(evStepOut.summaryCounts?.unverified).toBe(51);
  });
});

describe('Wave 3: Upgraded UI Shell, Hat Theming & Desktop/Mobile Optimization Static Pins', () => {
  const root = process.cwd();
  const tokensCss = readFileSync(join(root, 'docs/assets/tokens.css'), 'utf8');
  const shellJs = readFileSync(join(root, 'docs/assets/shell.js'), 'utf8');
  const hatsHtml = readFileSync(join(root, 'docs/hats.html'), 'utf8');
  const serverTs = readFileSync(join(root, 'src/server.ts'), 'utf8');

  it('defines 4-Hat custom properties, desktop split-pane, and mobile bottom-nav in tokens.css', () => {
    for (const token of [
      '--hat-red-accent:',
      '--hat-blue-accent:',
      '--hat-black-accent:',
      '--hat-white-accent:',
      '--hat-purple-accent:',
      '.hat-badge--red',
      '.hat-badge--blue',
      '.hat-badge--black',
      '.hat-badge--white',
      '.workspace-split',
      '.mobile-bottom-nav',
      'env(safe-area-inset-bottom',
    ]) {
      expect(tokensCss).toContain(token);
    }
  });

  it('wires Command Palette, v2 workspace persistence, and capability fallbacks in shell.js', () => {
    for (const marker of [
      't3mp3st_workspace_v2',
      'openCommandPalette',
      'copyText',
      'exportArtifact',
      'shareArtifact',
      'mobile-bottom-nav',
    ]) {
      expect(shellJs).toContain(marker);
    }
  });

  it('wires interactive 4-Hat tool/skill runner and Send-to-Hat handoff in docs/hats.html and server.ts', () => {
    for (const marker of [
      'hatWorkspace',
      'toolCatalogList',
      'toolInputEditor',
      'sendToHatBtn',
      '/api/teams/tools',
      '/api/teams/skills',
      'manifest.webmanifest',
    ]) {
      expect(hatsHtml).toContain(marker);
    }
    expect(existsSync(join(root, 'docs/manifest.webmanifest'))).toBe(true);
    expect(serverTs).toContain("app.get('/api/teams/tools'");
    expect(serverTs).toContain("app.post('/api/teams/tools/run'");
    expect(serverTs).toContain("app.get('/api/teams/skills'");
    expect(serverTs).toContain("app.post('/api/teams/skills/run'");
  });
});
