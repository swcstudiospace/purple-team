/**
 * Black exfil cost model — what each exfiltration path costs the operator in
 * detection surface. Pure functions, no I/O.
 *
 * Channels map to vendored ATT&CK techniques (./attack-data.ts); costs are
 * arithmetic over a disclosed table: channel base + volume blocks + penalties.
 * This is ANALYSIS of planned egress — it never moves a byte. It complements
 * wraithExfilSim() in ../hats.ts (which enforces the v1 noise budget): the v2
 * model answers "what does this channel family cost per the ATT&CK-keyed
 * doctrine tables", so the two surfaces share shapes but no code.
 */

import { ATTACK_BY_ID, attackLabel } from './attack-data.js';

/** One planned exfil path. Structurally compatible with hats' ExfilPathShape. */
export interface ExfilPath {
  id: string;
  /** Channel key from EXFIL_CHANNELS (unknown keys model as the C2 channel). */
  channel?: string;
  /** Estimated volume in megabytes. */
  volumeMb?: number;
  /** Whether the channel encrypts in transit; overrides the channel default. */
  encrypted?: boolean;
}

/** Costed path with its resolved technique and the arithmetic behind the tier. */
export interface ExfilPathCost {
  pathId: string;
  /** Resolved channel key (unknown input channels resolve to "unspecified"). */
  channel: string;
  /** Vendored technique the channel family maps to. */
  techniqueId: string;
  techniqueName: string;
  baseCost: number;
  /** ceil(volumeMb / VOLUME_BLOCK_MB) — one point per 100MB block. */
  volumeCost: number;
  /** Cleartext penalty (+CLEARTXT_PENALTY) or 0. */
  penalty: number;
  totalCost: number;
  tier: 'low' | 'medium' | 'high';
  /** Whether the path is analyzable inside the noise budget at all. */
  feasible: boolean;
  /** Deterministic pressure notes (controls that should fire, gaps exposed). */
  notes: readonly string[];
}

/** Whole-run egress cost report. */
export interface ExfilCostReport {
  paths: readonly ExfilPathCost[];
  totalVolumeMb: number;
  totalCost: number;
  budget: number;
  within: boolean;
}

/** Channel keys the model knows, in table order (for docs and route validation). */
export const EXFIL_CHANNELS: readonly string[] = [
  'c2-channel',
  'api-response',
  'web-service-upload',
  'cloud-storage-put',
  'code-repo-push',
  'cloud-account-sync',
  'scheduled-transfer',
  'automated-beacon',
  'dns-tunnel',
  'icmp-tunnel',
  'raw-socket',
  'raw-socket-tls',
  'raw-socket-asym',
];

/** Default spend budget for a whole exfil run (points). */
export const EXFIL_BUDGET_DEFAULT = 10;

/** Volume points are charged per this many megabytes (ceil). */
const VOLUME_BLOCK_MB = 100;

/** Penalty for moving cleartext through egress inspection. */
const CLEARTXT_PENALTY = 2;

/** Tier thresholds in points (total cost per path). */
const HIGH_TIER_AT = 8;
const MEDIUM_TIER_AT = 4;

/**
 * Channel profiles: ATT&CK technique, base cost (channel setup noise), and the
 * encryption the channel normally carries. Tunneling costs most per setup —
 * volumetric DNS/ICMP tunnels are the loudest quiet-looking channel there is.
 */
const CHANNEL_PROFILES: Readonly<Record<string, { techniqueId: string; base: number; encryptedByDefault: boolean }>> = {
  'c2-channel': { techniqueId: 'T1041', base: 2, encryptedByDefault: true },
  'api-response': { techniqueId: 'T1041', base: 2, encryptedByDefault: true },
  'web-service-upload': { techniqueId: 'T1567', base: 2, encryptedByDefault: true },
  'cloud-storage-put': { techniqueId: 'T1567.002', base: 3, encryptedByDefault: true },
  'code-repo-push': { techniqueId: 'T1567.001', base: 3, encryptedByDefault: true },
  'cloud-account-sync': { techniqueId: 'T1537', base: 4, encryptedByDefault: true },
  'scheduled-transfer': { techniqueId: 'T1029', base: 1, encryptedByDefault: true },
  'automated-beacon': { techniqueId: 'T1020', base: 5, encryptedByDefault: true },
  'dns-tunnel': { techniqueId: 'T1048.003', base: 6, encryptedByDefault: false },
  'icmp-tunnel': { techniqueId: 'T1048.003', base: 6, encryptedByDefault: false },
  'raw-socket': { techniqueId: 'T1048.003', base: 4, encryptedByDefault: false },
  'raw-socket-tls': { techniqueId: 'T1048.001', base: 4, encryptedByDefault: true },
  'raw-socket-asym': { techniqueId: 'T1048.002', base: 4, encryptedByDefault: true },
};

/** Fallback for channels outside the table: modeled as C2-channel exfiltration. */
const DEFAULT_PROFILE = { techniqueId: 'T1041', base: 2, encryptedByDefault: true };

function tierOf(cost: number): ExfilPathCost['tier'] {
  if (cost >= HIGH_TIER_AT) return 'high';
  if (cost >= MEDIUM_TIER_AT) return 'medium';
  return 'low';
}

/**
 * Cost a set of planned exfil paths. Deterministic per path:
 * cost = channel base + ceil(volumeMb/100) + cleartext penalty; tier from the
 * thresholds above; feasible = declared egress AND not high-tier.
 */
export function exfilCostModel(input: {
  paths?: readonly ExfilPath[];
  egress?: readonly string[];
  budget?: number;
}): ExfilCostReport {
  const paths = input.paths ?? [];
  const egress = input.egress ?? [];
  const budget = Math.max(1, input.budget ?? EXFIL_BUDGET_DEFAULT);
  const egressDeclared = egress.length > 0;

  let totalVolumeMb = 0;
  const costed: ExfilPathCost[] = paths.map(path => {
    const volumeMb = path.volumeMb ?? 0;
    totalVolumeMb += volumeMb;

    const channel = path.channel !== undefined && path.channel in CHANNEL_PROFILES ? path.channel : 'unspecified';
    const profile = channel === 'unspecified' ? DEFAULT_PROFILE : CHANNEL_PROFILES[channel];
    const encrypted = path.encrypted ?? profile.encryptedByDefault;

    const technique = ATTACK_BY_ID[profile.techniqueId];
    if (!technique) throw new Error(`exfil channel maps to non-vendored id "${profile.techniqueId}"`);

    const baseCost = profile.base;
    const volumeCost = Math.ceil(volumeMb / VOLUME_BLOCK_MB);
    const penalty = encrypted ? 0 : CLEARTXT_PENALTY;
    const totalCost = baseCost + volumeCost + penalty;
    const tier = tierOf(totalCost);

    const notes: string[] = [];
    if (!encrypted) {
      notes.push(`cleartext channel on "${path.id}" — DLP and egress inspection read it in flight (+${CLEARTXT_PENALTY})`);
    }
    if (volumeMb > VOLUME_BLOCK_MB) {
      notes.push(`bulk volume on "${path.id}" (${volumeMb}MB) — anomaly detection should fire before completion`);
    }
    if (channel === 'dns-tunnel' || channel === 'icmp-tunnel') {
      notes.push(`tunneling-shaped channel on "${path.id}" — DNS/ICMP inspection gap if no telemetry covers it`);
    }
    if (!egressDeclared) {
      notes.push(`no egress routing declared for "${path.id}" — path would egress uncontrolled`);
    }
    if (volumeMb === 0) {
      notes.push(`0MB declared on "${path.id}" — cost reflects channel base only; re-cost with real volume`);
    }

    return {
      pathId: path.id,
      channel,
      techniqueId: profile.techniqueId,
      techniqueName: attackLabel(profile.techniqueId),
      baseCost,
      volumeCost,
      penalty,
      totalCost,
      tier,
      feasible: egressDeclared && tier !== 'high',
      notes,
    };
  });

  const totalCost = costed.reduce((sum, path) => sum + path.totalCost, 0);
  return { paths: costed, totalVolumeMb, totalCost, budget, within: totalCost <= budget };
}
