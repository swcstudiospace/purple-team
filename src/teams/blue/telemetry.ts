/**
 * Blue telemetry source registry — the v2 telemetry model for the coverage
 * scorer (./coverage.ts).
 *
 * Real coveredIds semantics: a registry entry's coveredIds are D3FEND
 * countermeasure ids from the vendored ontology (./d3fend.ts), not free text.
 * An entry says "a deployment running this telemetry source provides detection
 * signal for these countermeasures". Registry ids that do not resolve in
 * D3FEND_BY_ID throw at module load — the registry must never drift from the
 * ontology the way free-text recommendations did.
 *
 * Pure data + pure functions: no I/O, no LLM, no persistence.
 */

import type { TelemetrySourceShape } from '../blue.js';
import { D3FEND_BY_ID } from './d3fend.js';

/** One telemetry source archetype and the D3FEND countermeasures it provides signal for. */
export interface TelemetrySourceSpec {
  /** Stable registry slug, e.g. "edr-process-telemetry". */
  source: string;
  /** Human-readable name. */
  label: string;
  /** What the source actually collects, in one honest sentence. */
  description: string;
  /** D3FEND countermeasure ids this source provides detection signal for (the registry's real coveredIds). */
  coveredIds: readonly string[];
}

/** Curated registry of common enterprise telemetry sources, ontology-validated. */
export const TELEMETRY_REGISTRY: readonly TelemetrySourceSpec[] = [
  {
    source: 'edr-process-telemetry',
    label: 'EDR process telemetry',
    description: 'Endpoint agent recording process spawn events, command lines, lineage, and system-call activity.',
    coveredIds: ['D3-PA', 'D3-PSA', 'D3-PLA', 'D3-SCA', 'D3-SEA', 'D3-FAPA', 'D3-PSMD'],
  },
  {
    source: 'edr-file-telemetry',
    label: 'EDR file telemetry',
    description: 'Endpoint agent recording file creates, writes, and hashable artifacts on managed hosts.',
    coveredIds: ['D3-FA', 'D3-FH', 'D3-FIM', 'D3-FCOA'],
  },
  {
    source: 'siem-correlation',
    label: 'SIEM correlation rules',
    description: 'Centralized rule engine correlating authentication, session, and access events across sources.',
    coveredIds: ['D3-ANET', 'D3-AZET', 'D3-WSAA', 'D3-SDA', 'D3-UGLPA', 'D3-CCSA', 'D3-RAPA', 'D3-JFAPA'],
  },
  {
    source: 'network-flow-analysis',
    label: 'Network flow analysis',
    description: 'Netflow or packet-metadata analysis over east-west and egress traffic.',
    coveredIds: ['D3-NTA', 'D3-NTSA', 'D3-PMAD', 'D3-CAA', 'D3-ISVA', 'D3-RPA', 'D3-ANAA'],
  },
  {
    source: 'dns-query-logging',
    label: 'DNS query logging',
    description: 'Resolver or passive-DNS logging of queried names and returned records.',
    coveredIds: ['D3-DNSTA', 'D3-DNRA', 'D3-HD'],
  },
  {
    source: 'web-access-logging',
    label: 'Web access logging',
    description: 'HTTP access logs capturing request paths, parameters, and client-server payload patterns.',
    coveredIds: ['D3-APCA', 'D3-CSPP', 'D3-UA', 'D3-WSAA'],
  },
  {
    source: 'waf-detection',
    label: 'WAF detection log',
    description: 'Web application firewall inspection events for injection and payload anomalies.',
    coveredIds: ['D3-DQSA', 'D3-CSPP'],
  },
  {
    source: 'file-integrity-monitoring',
    label: 'File integrity monitoring',
    description: 'FIM agent watching system files, init configs, scheduled jobs, and service binaries for tampering.',
    coveredIds: ['D3-FIM', 'D3-SFA', 'D3-SICA', 'D3-USICA', 'D3-SJA', 'D3-SDM', 'D3-SBV'],
  },
  {
    source: 'identity-provider-logging',
    label: 'Identity provider logging',
    description: 'Directory or IdP audit stream of account changes and authentication events.',
    coveredIds: ['D3-DAM', 'D3-LAM', 'D3-ANET', 'D3-AZET', 'D3-SDA', 'D3-CCSA'],
  },
  {
    source: 'threat-intel-enrichment',
    label: 'Threat intelligence enrichment',
    description: 'Reputation lookups matching observed identifiers (domains, IPs, hashes, URLs) against intel feeds.',
    coveredIds: ['D3-IRA', 'D3-IPRA', 'D3-FHRA', 'D3-DNRA', 'D3-IAA', 'D3-UA'],
  },
  {
    source: 'deception-grid',
    label: 'Deception grid (canaries and honeypots)',
    description: 'Decoy credentials, files, and network resources that fire when touched.',
    coveredIds: ['D3-IHN', 'D3-DUC', 'D3-DF', 'D3-DNR', 'D3-DST'],
  },
  {
    source: 'email-gateway-logging',
    label: 'Email gateway logging',
    description: 'Mail-gateway verdicts and metadata for inbound messages and senders.',
    coveredIds: ['D3-SRA', 'D3-SMRA', 'D3-MA'],
  },
];

/** Throw at module load if the registry cites a D3FEND id the vendored ontology does not contain. */
function assertRegistryIdsResolve(): void {
  const unknown: string[] = [];
  for (const spec of TELEMETRY_REGISTRY) {
    for (const id of spec.coveredIds) {
      if (!D3FEND_BY_ID[id]) unknown.push(`${spec.source}: ${id}`);
    }
  }
  if (unknown.length > 0) {
    throw new Error(`telemetry registry cites D3FEND ids missing from the vendored ontology: ${unknown.join(', ')}`);
  }
}
assertRegistryIdsResolve();

/** Registry slug → spec lookup. */
export const TELEMETRY_BY_SOURCE: Readonly<Record<string, TelemetrySourceSpec>> = Object.fromEntries(
  TELEMETRY_REGISTRY.map(spec => [spec.source, spec]),
);

/** Registry entries as plain telemetry sources (the coveredIds semantics blue.ts's shapes already speak). */
export function registryTelemetry(): TelemetrySourceShape[] {
  return TELEMETRY_REGISTRY.map(spec => ({
    source: spec.source,
    coveredIds: [...spec.coveredIds],
  }));
}
