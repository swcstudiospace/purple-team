/**
 * Black Hat Component Tools — Risk & Failure Mode Analyzer, Rule & Policy
 * Validator, and Stress & Edge Case Prober.
 *
 * Strictly analysis-only (`effects: []`): evaluates failure modes, deterministic
 * policy checks, and adversarial resilience probes with severity rankings
 * (`Critical`, `High`, `Medium`, `Low`, `Info`) and direct Blue Hat handoff.
 *
 * Refs SPE-14019, SPE-14036
 */

export type BlackFindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface BlackRiskComponentInput {
  id?: string;
  name: string;
  category?: 'egress' | 'auth' | 'telemetry' | 'storage' | 'workflow' | 'network';
  singlePointOfFailure?: boolean;
  externalDependency?: boolean;
  handlesSecrets?: boolean;
  noiseLevel?: 'low' | 'medium' | 'high';
  hasFallback?: boolean;
}

export interface BlackRiskAnalyzerInput {
  planName?: string;
  components?: readonly BlackRiskComponentInput[];
  assumptions?: readonly string[];
}

export interface BlackRiskFinding {
  id: string;
  component: string;
  failureMode: string;
  severity: BlackFindingSeverity;
  likelihood: 'high' | 'medium' | 'low';
  riskScore: number;
  mitigation: string;
  blueHatHandoff: {
    targetTool: string;
    action: string;
  };
}

export interface BlackBaselineProfile {
  id: string;
  name: string;
  description: string;
}

export interface BlackRiskAnalyzerResult {
  state: 'empty' | 'error' | 'success';
  planName: string;
  effects: readonly [];
  severityCounts: Record<BlackFindingSeverity, number>;
  findings: readonly BlackRiskFinding[];
  overallRiskTier: 'critical' | 'high' | 'medium' | 'low';
  baselineProfiles: readonly BlackBaselineProfile[];
}

export const BLACK_BASELINE_PROFILES: readonly BlackBaselineProfile[] = [
  {
    id: 'stealth-egress-resilience',
    name: 'Stealth Egress & Relay Resilience Profile',
    description: 'Audit egress relays, DNS resolvers, and beacon channels for single-point failure and high-noise signatures.',
  },
  {
    id: 'zero-trust-control-plane',
    name: 'Zero-Trust Control Plane & Credential Boundary',
    description: 'Inspect authentication, bearer token storage, and loopback sidecar boundaries for credential exposure.',
  },
  {
    id: 'multi-hat-pipeline-audit',
    name: 'Multi-Hat Workflow & Assumption Stress Audit',
    description: 'Evaluate cross-Hat orchestration steps for cascading dependency failures and unverified ROE assumptions.',
  },
];

function emptySeverityCounts(): Record<BlackFindingSeverity, number> {
  return { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
}

const SEVERITY_ORDER: Record<BlackFindingSeverity, number> = {
  Critical: 5,
  High: 4,
  Medium: 3,
  Low: 2,
  Info: 1,
};

/**
 * Black Hat Tool 1: Risk & Failure Mode Analyzer (`runBlackRiskAnalyzer`).
 * Evaluates plans, components, and assumptions against failure modes, producing
 * prioritized severity × likelihood matrices and Blue Hat mitigation handoffs.
 */
export function runBlackRiskAnalyzer(
  input: BlackRiskAnalyzerInput = {},
): BlackRiskAnalyzerResult {
  const planName = (input.planName ?? '').trim() || 'Black Hat Failure-Mode Assessment';
  const components = input.components ?? [];
  const assumptions = (input.assumptions ?? []).map(a => a.trim()).filter(Boolean);
  const severityCounts = emptySeverityCounts();

  if (components.length === 0 && assumptions.length === 0) {
    return {
      state: 'empty',
      planName,
      effects: [],
      severityCounts,
      findings: [],
      overallRiskTier: 'low',
      baselineProfiles: BLACK_BASELINE_PROFILES,
    };
  }

  const findings: BlackRiskFinding[] = [];

  for (let i = 0; i < components.length; i += 1) {
    const comp = components[i];
    const name = (comp.name ?? '').trim() || `component-${i + 1}`;
    const hasFallback = comp.hasFallback === true;

    if (comp.singlePointOfFailure && !hasFallback) {
      const severity: BlackFindingSeverity = comp.handlesSecrets ? 'Critical' : 'High';
      severityCounts[severity] += 1;
      findings.push({
        id: `risk-spof-${i + 1}`,
        component: name,
        failureMode: `Single point of failure on "${name}" (${comp.category ?? 'workflow'}) with no configured fallback path.`,
        severity,
        likelihood: 'high',
        riskScore: severity === 'Critical' ? 95 : 82,
        mitigation: `Add redundant fallback routing and checkpoint recovery for "${name}" before mission execution.`,
        blueHatHandoff: {
          targetTool: 'blue-workflow-sequencer',
          action: `Add conditional fallback step and checkpoint guard around "${name}".`,
        },
      });
    }

    if (comp.handlesSecrets) {
      const severity: BlackFindingSeverity = comp.externalDependency ? 'Critical' : 'High';
      severityCounts[severity] += 1;
      findings.push({
        id: `risk-sec-${i + 1}`,
        component: name,
        failureMode: `Component "${name}" processes sensitive credentials/tokens${comp.externalDependency ? ' across an external dependency boundary' : ''}.`,
        severity,
        likelihood: comp.externalDependency ? 'high' : 'medium',
        riskScore: severity === 'Critical' ? 92 : 76,
        mitigation: `Bind credentials strictly by origin, enforce secret redaction, and isolate "${name}" from untrusted payloads.`,
        blueHatHandoff: {
          targetTool: 'hardeningPlan',
          action: `Create credential-isolation hardening item and verify secret redaction on "${name}".`,
        },
      });
    }

    if (comp.noiseLevel === 'high') {
      severityCounts.Medium += 1;
      findings.push({
        id: `risk-noise-${i + 1}`,
        component: name,
        failureMode: `High operational noise profile on "${name}" increases SIEM/EDR detection likelihood.`,
        severity: 'Medium',
        likelihood: 'high',
        riskScore: 64,
        mitigation: `Replace high-noise operations in "${name}" with passive/local inspection or jittered cadence.`,
        blueHatHandoff: {
          targetTool: 'coverageGaps',
          action: `Verify Blue Hat telemetry rules trigger on "${name}" high-noise pattern.`,
        },
      });
    }

    if (comp.externalDependency && hasFallback) {
      severityCounts.Low += 1;
      findings.push({
        id: `risk-ext-${i + 1}`,
        component: name,
        failureMode: `External dependency "${name}" may experience latency or intermittent outage (fallback present).`,
        severity: 'Low',
        likelihood: 'medium',
        riskScore: 35,
        mitigation: `Enforce AbortController timeout and verify automatic switchover to fallback for "${name}".`,
        blueHatHandoff: {
          targetTool: 'blue-execution-monitor',
          action: `Monitor execution latency and retry budget for "${name}".`,
        },
      });
    }
  }

  for (let i = 0; i < assumptions.length; i += 1) {
    const assump = assumptions[i];
    severityCounts.Medium += 1;
    findings.push({
      id: `risk-assump-${i + 1}`,
      component: 'Operational Assumption',
      failureMode: `Unverified assumption: "${assump}" could invalidate scope or resilience guarantees if false.`,
      severity: 'Medium',
      likelihood: 'medium',
      riskScore: 58,
      mitigation: `Route assumption "${assump}" to White Hat Information Gap Analyzer for empirical verification.`,
      blueHatHandoff: {
        targetTool: 'blue-decision-ledger',
        action: `Record assumption "${assump}" as deferred until White Hat verification completes.`,
      },
    });
  }

  if (findings.length === 0) {
    severityCounts.Info += 1;
    findings.push({
      id: 'risk-baseline-info',
      component: planName,
      failureMode: 'No acute SPOF, credential boundary, or high-noise failure modes flagged in supplied components.',
      severity: 'Info',
      likelihood: 'low',
      riskScore: 10,
      mitigation: 'Maintain standard execution timeouts and periodic ROE verification.',
      blueHatHandoff: {
        targetTool: 'blue-decision-ledger',
        action: 'Log baseline risk clearance in session decision ledger.',
      },
    });
  }

  findings.sort((a, b) => b.riskScore - a.riskScore || SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  const overallRiskTier: 'critical' | 'high' | 'medium' | 'low' = severityCounts.Critical > 0
    ? 'critical'
    : severityCounts.High > 0
      ? 'high'
      : severityCounts.Medium > 0
        ? 'medium'
        : 'low';

  return {
    state: 'success',
    planName,
    effects: [],
    severityCounts,
    findings,
    overallRiskTier,
    baselineProfiles: BLACK_BASELINE_PROFILES,
  };
}

// =============================================================================
// 2. RULE & POLICY VALIDATOR
// =============================================================================

export interface BlackPolicyValidatorInput {
  artifactName?: string;
  rawConfig?: string | Record<string, unknown>;
  policyProfile?: 'strict-opsec' | 'roe-boundary' | 'zero-trust-config' | 'all';
  allowedHosts?: readonly string[];
  maxTimeoutMs?: number;
  requireEncryption?: boolean;
}

export interface BlackPolicyCheckResult {
  ruleId: string;
  title: string;
  category: 'security' | 'boundary' | 'regression' | 'compliance';
  passed: boolean;
  severity: BlackFindingSeverity;
  finding: string;
  remediation: string;
}

export interface BlackPolicyValidatorResult {
  state: 'empty' | 'error' | 'success';
  artifactName: string;
  policyProfile: string;
  effects: readonly [];
  passedCount: number;
  failedCount: number;
  severityCounts: Record<BlackFindingSeverity, number>;
  checks: readonly BlackPolicyCheckResult[];
  blueHatHandoff: {
    recommendedTool: string;
    summary: string;
    failedRuleIds: readonly string[];
  };
}

/**
 * Black Hat Tool 2: Rule & Policy Validator (`runBlackPolicyValidator`).
 * Runs deterministic security, boundary, regression, and compliance checks.
 * Gracefully reports unparseable artifacts as a Critical finding without crashing.
 */
export function runBlackPolicyValidator(
  input: BlackPolicyValidatorInput = {},
): BlackPolicyValidatorResult {
  const artifactName = (input.artifactName ?? '').trim() || 'workspace-config';
  const policyProfile = input.policyProfile ?? 'all';
  const severityCounts = emptySeverityCounts();
  const raw = input.rawConfig;

  if (
    raw === undefined
    || raw === null
    || (typeof raw === 'string' && raw.trim().length === 0)
    || (typeof raw === 'object' && Object.keys(raw).length === 0)
  ) {
    return {
      state: 'empty',
      artifactName,
      policyProfile,
      effects: [],
      passedCount: 0,
      failedCount: 0,
      severityCounts,
      checks: [],
      blueHatHandoff: {
        recommendedTool: 'blue-workflow-sequencer',
        summary: 'Supply a configuration object or policy artifact to run deterministic validation checks.',
        failedRuleIds: [],
      },
    };
  }

  let serialized = '';
  if (typeof raw === 'string') {
    serialized = raw.trim();
    if (serialized.startsWith('{') || serialized.startsWith('[')) {
      try {
        JSON.parse(serialized);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        severityCounts.Critical += 1;
        const parseCheck: BlackPolicyCheckResult = {
          ruleId: 'POL-PARSE-001',
          title: 'Artifact Structural Integrity',
          category: 'boundary',
          passed: false,
          severity: 'Critical',
          finding: `Target artifact "${artifactName}" is unparseable JSON (${msg}). Treating corrupt configuration as a critical blocker.`,
          remediation: 'Repair syntax errors in White Hat Structured Data Inspector before deploying or executing.',
        };
        return {
          state: 'error',
          artifactName,
          policyProfile,
          effects: [],
          passedCount: 0,
          failedCount: 1,
          severityCounts,
          checks: [parseCheck],
          blueHatHandoff: {
            recommendedTool: 'white-data-inspector',
            summary: `Artifact "${artifactName}" failed structural parsing (POL-PARSE-001).`,
            failedRuleIds: ['POL-PARSE-001'],
          },
        };
      }
    }
  } else {
    serialized = JSON.stringify(raw);
  }

  const checks: BlackPolicyCheckResult[] = [];
  const recordCheck = (check: BlackPolicyCheckResult): void => {
    checks.push(check);
    if (!check.passed) {
      severityCounts[check.severity] += 1;
    } else {
      severityCounts.Info += 1;
    }
  };

  // Rule 1: Secret / credential exposure
  const hasSecretLeak = /(?:api[_-]?key|secret|bearer|password|token)\s*["':=]\s*["']?(?:sk-[a-zA-Z0-9]{8,}|ghp_[a-zA-Z0-9]{8,}|xai-[a-zA-Z0-9]{8,}|[A-Za-z0-9+/=]{24,})/i.test(serialized);
  recordCheck({
    ruleId: 'POL-SEC-001',
    title: 'No Hardcoded Secrets or Bearer Tokens',
    category: 'security',
    passed: !hasSecretLeak,
    severity: 'Critical',
    finding: hasSecretLeak
      ? 'Detected inline credential/token pattern in configuration artifact.'
      : 'No hardcoded API keys or bearer tokens detected.',
    remediation: 'Move credentials to environment variables or localStorage-scoped operator vault and redact artifacts.',
  });

  // Rule 2: Wildcard bind / permissive origin exposure
  const hasWildcardExposure = /\b0\.0\.0\.0\b|["']\*["']\s*(?:,\s*)?\/\/\s*cors|Access-Control-Allow-Origin["':\s]+\*/i.test(serialized);
  recordCheck({
    ruleId: 'POL-SEC-002',
    title: 'Loopback & Origin Pinning',
    category: 'security',
    passed: !hasWildcardExposure,
    severity: 'High',
    finding: hasWildcardExposure
      ? 'Configuration references wildcard 0.0.0.0 bind or unrestricted CORS origin.'
      : 'Bind and origin settings remain loopback-restricted.',
    remediation: 'Pin server bind to 127.0.0.1 or require explicit bearer authentication when non-loopback is used.',
  });

  // Rule 3: Transport encryption (cleartext HTTP to non-loopback)
  const requireEncryption = input.requireEncryption ?? true;
  const cleartextMatch = serialized.match(/http:\/\/(?!127\.0\.0\.1|localhost|\[::1\])([a-zA-Z0-9.-]+)/i);
  const failedEncryption = requireEncryption && cleartextMatch !== null;
  recordCheck({
    ruleId: 'POL-SEC-003',
    title: 'Encrypted External Transport (HTTPS/TLS)',
    category: 'security',
    passed: !failedEncryption,
    severity: 'High',
    finding: failedEncryption
      ? `Cleartext HTTP endpoint detected for non-loopback host "${cleartextMatch?.[1] ?? 'external'}".`
      : 'All external endpoints use encrypted transport or loopback.',
    remediation: 'Upgrade external URLs to https:// or tunnel over an encrypted relay.',
  });

  // Rule 4: Prototype pollution / unsafe eval vectors
  const hasUnsafeProto = /__proto__|prototype\s*\[|\beval\s*\(|\bnew\s+Function\s*\(/i.test(serialized);
  recordCheck({
    ruleId: 'POL-BND-004',
    title: 'Prototype-Pollution & Dynamic Code Guard',
    category: 'boundary',
    passed: !hasUnsafeProto,
    severity: 'Critical',
    finding: hasUnsafeProto
      ? 'Artifact contains __proto__, prototype mutation, or dynamic code evaluation strings.'
      : 'No prototype pollution keys or dynamic code evaluation patterns present.',
    remediation: 'Sanitize inputs with sanitizePayload() and strip __proto__/constructor/prototype keys at the boundary.',
  });

  // Rule 5: Destructive / out-of-policy operations
  const hasDestructiveOp = /\b(?:rm\s+-rf|wipe|shred|drop\s+table|destroy\s+evidence|clear\s+event\s+logs)\b/i.test(serialized);
  recordCheck({
    ruleId: 'POL-CMP-005',
    title: 'Non-Destructive Analysis Compliance',
    category: 'compliance',
    passed: !hasDestructiveOp,
    severity: 'Critical',
    finding: hasDestructiveOp
      ? 'Artifact contains destructive concealment or data-wiping command patterns.'
      : 'Artifact complies with non-destructive analysis-only policy.',
    remediation: 'Remove destructive operations and replace with read-only evidence preservation.',
  });

  // Rule 6: Host allow-list scope check
  const allowedHosts = (input.allowedHosts ?? []).map(h => h.trim().toLowerCase()).filter(Boolean);
  if (allowedHosts.length > 0) {
    const hostRefs = [...serialized.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/gi)].map(m => m[1].toLowerCase());
    const outOfScopeHosts = hostRefs.filter(h => !allowedHosts.includes(h) && h !== '127.0.0.1' && h !== 'localhost');
    recordCheck({
      ruleId: 'POL-CMP-006',
      title: 'ROE Allowed-Host Scope Enforcement',
      category: 'compliance',
      passed: outOfScopeHosts.length === 0,
      severity: 'High',
      finding: outOfScopeHosts.length > 0
        ? `Referenced host(s) [${[...new Set(outOfScopeHosts)].join(', ')}] are outside the ROE allow-list.`
        : `All referenced hosts comply with ROE allow-list (${allowedHosts.join(', ')}).`,
      remediation: 'Remove out-of-scope target hosts or obtain a signed White Hat ROE amendment receipt.',
    });
  }

  const passedCount = checks.filter(c => c.passed).length;
  const failedChecks = checks.filter(c => !c.passed);
  const failedCount = failedChecks.length;

  return {
    state: 'success',
    artifactName,
    policyProfile,
    effects: [],
    passedCount,
    failedCount,
    severityCounts,
    checks,
    blueHatHandoff: {
      recommendedTool: failedCount > 0 ? 'hardeningPlan' : 'blue-decision-ledger',
      summary: failedCount > 0
        ? `${failedCount} policy check(s) failed on "${artifactName}" (${failedChecks.map(c => c.ruleId).join(', ')}); hand off to Blue Hat hardening.`
        : `All ${passedCount} policy checks passed on "${artifactName}".`,
      failedRuleIds: failedChecks.map(c => c.ruleId),
    },
  };
}

// =============================================================================
// 3. STRESS & EDGE CASE PROBER
// =============================================================================

export interface BlackStressFieldInput {
  name: string;
  type: 'string' | 'number' | 'json' | 'url' | 'path' | 'array';
  maxLength?: number;
  required?: boolean;
}

export interface BlackStressProberInput {
  targetComponent?: string;
  inputFields?: readonly BlackStressFieldInput[];
  dependencies?: readonly string[];
}

export interface BlackStressScenario {
  id: string;
  target: string;
  category: 'boundary' | 'adversarial_input' | 'dependency_failure' | 'resource_exhaustion';
  title: string;
  sampleProbe: string;
  failureHypothesis: string;
  severityIfUnhandled: 'Critical' | 'High' | 'Medium' | 'Low';
  expectedGuardrail: string;
}

export interface BlackStressProberResult {
  state: 'empty' | 'error' | 'success';
  targetComponent: string;
  effects: readonly [];
  scenarios: readonly BlackStressScenario[];
  severityCounts: Record<BlackFindingSeverity, number>;
  blueHatHandoff: {
    targetTool: string;
    checklist: readonly string[];
  };
}

/**
 * Black Hat Tool 3: Stress & Edge Case Prober (`runBlackStressProber`).
 * Generates deterministic boundary cases, adversarial input probes, and
 * dependency failure scenarios to verify resilience before execution.
 */
export function runBlackStressProber(
  input: BlackStressProberInput = {},
): BlackStressProberResult {
  const targetComponent = (input.targetComponent ?? '').trim();
  const inputFields = input.inputFields ?? [];
  const dependencies = (input.dependencies ?? []).map(d => d.trim()).filter(Boolean);
  const severityCounts = emptySeverityCounts();

  if (!targetComponent && inputFields.length === 0 && dependencies.length === 0) {
    return {
      state: 'empty',
      targetComponent: 'Unspecified Target Component',
      effects: [],
      scenarios: [],
      severityCounts,
      blueHatHandoff: {
        targetTool: 'blue-workflow-sequencer',
        checklist: [],
      },
    };
  }

  const resolvedTarget = targetComponent || 'Hat Tool Execution Boundary';
  const scenarios: BlackStressScenario[] = [];
  const addScenario = (s: BlackStressScenario): void => {
    scenarios.push(s);
    severityCounts[s.severityIfUnhandled] += 1;
  };

  // Always include baseline prototype-pollution & payload-cap stress probes
  addScenario({
    id: 'probe-proto-001',
    target: resolvedTarget,
    category: 'adversarial_input',
    title: 'Prototype Pollution Key Injection',
    sampleProbe: '{"__proto__":{"polluted":true},"constructor":{"prototype":{"isAdmin":true}}}',
    failureHypothesis: 'Unsanitized JSON merge mutates Object.prototype across shared workspace state.',
    severityIfUnhandled: 'Critical',
    expectedGuardrail: 'sanitizePayload() strips __proto__, constructor, and prototype keys before tool execution.',
  });

  addScenario({
    id: 'probe-cap-002',
    target: resolvedTarget,
    category: 'resource_exhaustion',
    title: 'Oversized Payload Cap Breach (>2 MiB)',
    sampleProbe: '{"data":"<2.1MB repeating UTF-8 stream>"}',
    failureHypothesis: 'Large payload blocks event loop or exhausts memory during synchronous JSON serialization.',
    severityIfUnhandled: 'High',
    expectedGuardrail: 'checkPayloadCap() rejects payloads > 2 MiB with PAYLOAD_CAP_EXCEEDED before handler runs.',
  });

  for (let i = 0; i < inputFields.length; i += 1) {
    const field = inputFields[i];
    const fieldName = (field.name ?? '').trim() || `field_${i + 1}`;
    if (field.type === 'path') {
      addScenario({
        id: `probe-path-${i + 1}`,
        target: `${resolvedTarget}.${fieldName}`,
        category: 'adversarial_input',
        title: `Path Traversal & Null-Byte Probe on "${fieldName}"`,
        sampleProbe: `../../../../etc/passwd\\u0000.json`,
        failureHypothesis: `Path resolver escapes workspace root when reading "${fieldName}".`,
        severityIfUnhandled: 'Critical',
        expectedGuardrail: 'Canonicalize path with path.resolve() and verify prefix stays inside authorized root.',
      });
    } else if (field.type === 'url') {
      addScenario({
        id: `probe-url-${i + 1}`,
        target: `${resolvedTarget}.${fieldName}`,
        category: 'adversarial_input',
        title: `SSRF & Metadata Loopback Probe on "${fieldName}"`,
        sampleProbe: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        failureHypothesis: `URL fetcher accesses cloud metadata or unapproved internal host via "${fieldName}".`,
        severityIfUnhandled: 'Critical',
        expectedGuardrail: 'Enforce ROE host allow-list and block link-local/private IP ranges.',
      });
    } else if (field.type === 'number') {
      addScenario({
        id: `probe-num-${i + 1}`,
        target: `${resolvedTarget}.${fieldName}`,
        category: 'boundary',
        title: `Numeric Boundary & NaN/Infinity Probe on "${fieldName}"`,
        sampleProbe: '{"value": -9007199254740991, "alt": "NaN"}',
        failureHypothesis: `Unbounded negative or non-finite number causes slice/pagination underflow in "${fieldName}".`,
        severityIfUnhandled: 'Medium',
        expectedGuardrail: 'Clamp numeric inputs with Number.isFinite() and explicit min/max bounds.',
      });
    } else {
      addScenario({
        id: `probe-str-${i + 1}`,
        target: `${resolvedTarget}.${fieldName}`,
        category: 'boundary',
        title: `Empty, Whitespace & Script-Tag Boundary on "${fieldName}"`,
        sampleProbe: '   <script>alert(1)</script>   ',
        failureHypothesis: `Unescaped string in "${fieldName}" triggers DOM injection or bypasses non-empty check.`,
        severityIfUnhandled: 'High',
        expectedGuardrail: 'Trim strings at boundary and escape HTML via escapeHtml() before rendering.',
      });
    }
  }

  for (let i = 0; i < dependencies.length; i += 1) {
    const dep = dependencies[i];
    addScenario({
      id: `probe-dep-${i + 1}`,
      target: `${resolvedTarget} → ${dep}`,
      category: 'dependency_failure',
      title: `Dependency Timeout & Hanging Socket on "${dep}"`,
      sampleProbe: `simulate_timeout(${dep}, 30000ms)`,
      failureHypothesis: `Unresponsive dependency "${dep}" hangs caller indefinitely and starves worker queue.`,
      severityIfUnhandled: 'High',
      expectedGuardrail: `Wrap "${dep}" call in runGuardedTool() with AbortController timeout and recoverable fallback card.`,
    });
  }

  const checklist = scenarios.map(
    s => `[${s.severityIfUnhandled}] ${s.id} (${s.target}): ${s.expectedGuardrail}`,
  );

  return {
    state: 'success',
    targetComponent: resolvedTarget,
    effects: [],
    scenarios,
    severityCounts,
    blueHatHandoff: {
      targetTool: 'wardenHardeningReview',
      checklist,
    },
  };
}
