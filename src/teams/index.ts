/**
 * T3MP3ST Dark Purple Teams — registry, tool grants, and mission-family mapping.
 *
 * The three team archetypes are operator-level doctrines (spawnable operators in the
 * OperatorArchetype union); "purple" synthesis is orchestrator-level and lives in
 * ./purple.ts, never in the spawnable union.
 *
 * ARSENAL GRANTS DECISION — why grants live here and not in src/arsenal/catalog.ts:
 * the catalog is a flat per-binary adapter table whose axes are category/risk/mission
 * family; it has no per-consumer grant concept, and bolting team semantics onto every
 * adapter entry would couple the arsenal to orchestration concerns. Instead this module
 * grants EXISTING catalog ids per team, filtered by the catalog's own `risk` tiers:
 *
 * - black  → routing/noise-grade: passive mapping + resolver-pinned DNS tools, plus
 *            curl/httpx ONLY as egress/proxy verification probes (justified: verifying
 *            the approved route is the black team's core job; noisy active scanners
 *            like nmap/nuclei/ffuf are deliberately NOT granted). Black additionally
 *            holds emulation-data ids of its own — ATT&CK Navigator layer data,
 *            Caldera adversary-emulation plan parsing, and import-only analysis
 *            packs (attack-flow, beacon-cadence, dns-tunnel-model, cover-story,
 *            egress-ledger, ja3-catalog, noise-vocabulary, channel-cost-table,
 *            opsec-checklist-pack, callback-budget, stealth-route-pack,
 *            exfil-path-pack) — analysis-only, never a live probe; still nothing
 *            noisy, and still strictly disjoint from blue's and white's grant sets
 *            (the passive DNS lookups dig/whois belong to the inspector teams only).
 * - blue   → read/inspect-grade only: local_read + passive ids. No active, intrusive,
 *            credential, or dangerous tools — the blue team never touches the target.
 *            Blue additionally holds detection-grade catalog ids of its own (rule
 *            validation/authoring via sigma-cli, plus vendored detection data packs:
 *            atomic-red-team atomics, osquery, suricata, velociraptor, D3FEND) and
 *            local static-analysis ids (slither, mythril, echidna, foundry-forge,
 *            solhint, radare2, ghidra, objdump, readelf, apktool, jadx, apkleaks,
 *            mobsfscan, class-dump) — validation and authoring surface only, still
 *            nothing that touches the target. radamsa and afl-fuzz stay off the grant.
 * - white  → read/inspect-grade only (same risk tiers as blue; overlap with blue is
 *            justified: both teams are read-only inspectors of evidence artifacts,
 *            with different purposes — control verification vs adjudication).
 *            White additionally holds governance frameworks of its own (NIST SP
 *            800-115 / PTES / OSSTMM, plus OWASP ASVS, OWASP WSTG, CIS Controls,
 *            CWE, CVSS, NIST CSF, and MITRE ATLAS — import-only adjudication
 *            references, never authorization to test) and may overlap blue on
 *            shared local_read static-analysis ids; still read-only inspectors,
 *            and still disjoint from black's grants.
 *
 * If a future team needs a tool id that does not exist in the catalog, grant the
 * closest existing id and note it here rather than inventing ids.
 */

import type { OperatorArchetype } from '../types/index.js';
import type { MissionFamily } from '../resources/index.js';

export type TeamArchetype = 'black' | 'blue' | 'white';

/** The spawnable team archetypes. Purple is orchestrator-level and deliberately absent. */
export const TEAM_ARCHETYPES: readonly ['black', 'blue', 'white'] = ['black', 'blue', 'white'] as const;

// Grant sets — every id must exist in src/arsenal/catalog.ts TOOL_ADAPTERS.
// dig/whois are granted ONLY to the inspector teams (blue/white); black does its
// resolver-pinned DNS work through host/dnsx so black stays disjoint from both.
const BLACK_TOOLS = [
  'host', 'subfinder', 'amass', 'dnsx', 'waybackurls', 'wafw00f', 'curl', 'httpx',
  'attack-navigator', 'caldera', 'attack-flow', 'beacon-cadence', 'dns-tunnel-model',
  'cover-story', 'egress-ledger', 'ja3-catalog', 'noise-vocabulary', 'channel-cost-table',
  'opsec-checklist-pack', 'callback-budget', 'stealth-route-pack', 'exfil-path-pack',
] as const;

const BLUE_TOOLS = [
  'file', 'yara', 'exiftool', 'strings', 'checksec', 'openssl', 'gitleaks', 'trufflehog',
  'trivy', 'syft', 'grype', 'osv-scanner', 'checkov', 'semgrep', 'dig', 'whois',
  'sigma', 'atomic-red-team', 'osquery', 'suricata', 'velociraptor', 'd3fend',
  'slither', 'mythril', 'echidna', 'foundry-forge', 'solhint', 'radare2', 'ghidra',
  'objdump', 'readelf', 'apktool', 'jadx', 'apkleaks', 'mobsfscan', 'class-dump',
] as const;

const WHITE_TOOLS = [
  'file', 'yara', 'exiftool', 'strings', 'binwalk', 'openssl', 'gitleaks', 'dig', 'whois',
  'nist-800-115', 'ptes', 'osstmm', 'checksec', 'semgrep', 'trivy', 'radare2', 'objdump',
  'readelf', 'jadx', 'ghidra', 'slither', 'solhint', 'owasp-asvs', 'owasp-wstg',
  'cis-controls', 'cwe', 'cvss', 'nist-csf', 'mitre-atlas',
] as const;

/**
 * Tool grants per team archetype. Unknown archetypes (including 'purple', which is
 * not an operator) throw — grants only exist for spawnable team operators.
 */
export function teamToolGrants(archetype: OperatorArchetype): string[] {
  switch (archetype) {
    case 'black': return [...BLACK_TOOLS];
    case 'blue': return [...BLUE_TOOLS];
    case 'white': return [...WHITE_TOOLS];
    default:
      throw new Error(`teamToolGrants: "${archetype}" is not a team archetype (expected one of ${TEAM_ARCHETYPES.join(', ')})`);
  }
}

/**
 * Which mission families each team supports:
 * - black  — the externally-visible offensive families where stealth discipline changes the outcome.
 * - blue   — the families with runtime/telemetry surfaces to defend, plus reporting.
 * - white  — every family: ROE compliance and evidence adjudication apply to all of them.
 */
export const FAMILY_TEAM_MAPPING: Record<TeamArchetype, MissionFamily[]> = {
  black: ['web_api', 'cloud_infra', 'ai_red_team', 'agent_warfare'],
  blue: ['web_api', 'cloud_infra', 'code_supply_chain', 'crypto_secrets', 'reporting_remediation', 'ai_red_team', 'agent_warfare'],
  white: ['web_api', 'ai_red_team', 'cloud_infra', 'smart_contract', 'code_supply_chain', 'crypto_secrets', 'reverse_binary', 'agent_warfare', 'social_osint', 'reporting_remediation'],
};

// Specialized team hats (specter/wraith → black, sentinel/warden → blue,
// arbiter/auditor → white). Additive re-export only; parent grants unchanged.
export { HAT_ARCHETYPES, hatTeam, hatToolGrants } from './hats.js';
export { specterCoverReview, wraithExfilSim, sentinelDetectorMap } from './hats.js';
export { wardenHardeningReview, arbiterDispute, auditorScore } from './hats.js';
export type { HatArchetype } from './hats.js';
export { HAT_DIRECTORY, grantCount } from './hat-registry.js';
export type { HatDirectoryEntry, HatDirectoryId } from './hat-registry.js';
export {
  MAX_TOOL_PAYLOAD_BYTES,
  DEFAULT_TOOL_TIMEOUT_MS,
  DEFAULT_SKILL_TIMEOUT_MS,
  DANGEROUS_KEYS,
  sanitizePayload,
  sanitizeInput,
  escapeHtml,
  checkPayloadCap,
  migrateWorkspaceState,
  runGuardedTool,
} from './guardrails.js';
export type {
  HatDomain,
  ToolHatScope,
  GuardedToolStatus,
  GuardedToolEnvelope,
  MigratedWorkspaceState,
} from './guardrails.js';
export {
  BLUE_STARTER_TEMPLATES,
  runBlueWorkflowSequencer,
  runBlueDecisionLedger,
  runBlueExecutionMonitor,
} from './blue/tools.js';
export type {
  BlueWorkflowSequencerInput,
  BlueWorkflowSequencerResult,
  BlueDecisionLedgerInput,
  BlueDecisionLedgerResult,
  BlueExecutionMonitorInput,
  BlueExecutionMonitorResult,
} from './blue/tools.js';
export {
  runWhiteDataInspector,
  runWhiteEvidenceCollector,
  runWhiteGapAnalyzer,
} from './white/tools.js';
export type {
  WhiteDataInspectorInput,
  WhiteDataInspectorResult,
  WhiteEvidenceCollectorInput,
  WhiteEvidenceCollectorResult,
  WhiteGapAnalyzerInput,
  WhiteGapAnalyzerResult,
} from './white/tools.js';
export {
  BLACK_BASELINE_PROFILES,
  runBlackRiskAnalyzer,
  runBlackPolicyValidator,
  runBlackStressProber,
} from './black/tools.js';
export type {
  BlackRiskAnalyzerInput,
  BlackRiskAnalyzerResult,
  BlackPolicyValidatorInput,
  BlackPolicyValidatorResult,
  BlackStressProberInput,
  BlackStressProberResult,
} from './black/tools.js';
export {
  runContextTransformTool,
  runArtifactDiffTool,
  runSnapshotManagerTool,
  runBatchRunnerTool,
} from './extra-tools.js';
export {
  HAT_TOOL_REGISTRY,
  SKILL_CATALOG,
  listRegisteredHatTools,
  getRegisteredHatTool,
  executeRegisteredHatTool,
  listComposableSkills,
  getComposableSkill,
  runComposableSkill,
  buildSpecialistWorkflowTools,
} from './skills.js';
export type {
  HatToolRegistration,
  ComposableSkillDefinition,
  ComposableSkillRunResult,
} from './skills.js';
