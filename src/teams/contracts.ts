/**
 * Phase 26 runtime contracts — Red workflow inventory, bounded inline artifact
 * binding, server-computed artifact hashes, and per-run role allowlists.
 *
 * This module is model/transform only: pure helpers plus the inventory table.
 * It owns no routes, no stores, and no schedulers. Grant tables stay in
 * src/teams/index.ts (teamToolGrants) and src/teams/hats.ts (hatToolGrants);
 * this module only resolves them per run.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { OperatorArchetype } from '../types/index.js';
import { teamToolGrants } from './index.js';
import { hatToolGrants, hatTeam, type HatArchetype } from './hats.js';

// =============================================================================
// DISCIPLINES
// =============================================================================

/** The only product disciplines. Purple is synthesis-only and never spawns. */
export const DISCIPLINES = ['red', 'blue', 'black', 'white'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

/** The eight Red operator archetypes (the Red discipline's workflows). */
export const RED_ARCHETYPES: readonly OperatorArchetype[] = [
  'recon', 'scanner', 'exploiter', 'infiltrator',
  'exfiltrator', 'ghost', 'coordinator', 'analyst',
] as const;

/** All seventeen spawnable roles: eight Red + three teams + six hats. */
export const SPAWNABLE_ARCHETYPES: readonly OperatorArchetype[] = [
  ...RED_ARCHETYPES,
  'black', 'blue', 'white',
  'specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor',
] as const;

function isHat(role: string): role is HatArchetype {
  return role === 'specter' || role === 'wraith' || role === 'sentinel'
    || role === 'warden' || role === 'arbiter' || role === 'auditor';
}

/** Which discipline a spawnable role belongs to. Throws for unknown roles. */
export function disciplineOf(role: OperatorArchetype): Discipline {
  if ((RED_ARCHETYPES as readonly string[]).includes(role)) return 'red';
  if (role === 'black' || role === 'blue' || role === 'white') return role;
  if (isHat(role)) {
    const parent = hatTeam[role];
    if (parent === 'black' || parent === 'blue' || parent === 'white') return parent;
  }
  throw new Error(`disciplineOf: "${role}" is not a spawnable role (purple never spawns)`);
}

// =============================================================================
// RED WORKFLOW INVENTORY (AC-FH-001)
// =============================================================================

export interface RedWorkflowInventoryRow {
  workflow: string;
  operatorProfile: string;
  prompt: string;
  api: string;
  lifecycle: string;
  note?: string;
}

/**
 * The eight Red workflows. Every row cites a real source path; items with no
 * implementation carry an explicit `unavailable` label instead of a path.
 */
export const RED_WORKFLOW_INVENTORY: readonly RedWorkflowInventoryRow[] = [
  {
    workflow: 'recon',
    operatorProfile: 'src/operators/index.ts (recon defaultTools)',
    prompt: 'src/prompts/index.ts (reconWorkflow)',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
  {
    workflow: 'scanner',
    operatorProfile: 'src/operators/index.ts (scanner defaultTools)',
    prompt: 'src/prompts/index.ts (vulnScanWorkflow)',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
  {
    workflow: 'exploiter',
    operatorProfile: 'src/operators/index.ts (exploiter defaultTools)',
    prompt: 'src/prompts/index.ts (exploitWorkflow)',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
  {
    workflow: 'infiltrator',
    operatorProfile: 'src/operators/index.ts (infiltrator defaultTools)',
    prompt: 'unavailable: no dedicated infiltrator workflow prompt in src/prompts/index.ts',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
  {
    workflow: 'exfiltrator',
    operatorProfile: 'src/operators/index.ts (exfiltrator defaultTools)',
    prompt: 'unavailable: no dedicated exfiltrator workflow prompt in src/prompts/index.ts',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
  {
    workflow: 'ghost',
    operatorProfile: 'src/operators/index.ts (ghost defaultTools)',
    prompt: 'unavailable: no dedicated ghost workflow prompt in src/prompts/index.ts',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
  {
    workflow: 'coordinator',
    operatorProfile: 'src/operators/index.ts (coordinator defaultTools)',
    prompt: 'unavailable: no dedicated coordinator workflow prompt in src/prompts/index.ts',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
  {
    workflow: 'analyst',
    operatorProfile: 'src/operators/index.ts (analyst defaultTools)',
    prompt: 'unavailable: no dedicated analyst workflow prompt in src/prompts/index.ts',
    api: 'src/server.ts (POST /api/mission/start)',
    lifecycle: 'src/index.ts (TempestCommand start/tick)',
  },
];

// =============================================================================
// BOUNDED INLINE ARTIFACT CONTRACT
// =============================================================================

/** Single inline artifact element: text/plain, utf8, one element, 64 KiB cap. */
export const INLINE_ARTIFACT_MEDIA_TYPE = 'text/plain' as const;
export const INLINE_ARTIFACT_ENCODING = 'utf8' as const;
export const INLINE_ARTIFACT_MAX_ITEMS = 1 as const;
export const INLINE_ARTIFACT_MAX_BYTES: number = 64 * 1024;

export interface InlineArtifactInput {
  /** Caller-supplied id is a label only — the server mints the binding id. */
  id?: unknown;
  mediaType?: unknown;
  encoding?: unknown;
  data?: unknown;
}

export interface BoundInlineArtifact {
  /** Server-issued binding id. */
  artifactId: string;
  /** Caller-supplied id, kept as a label only. */
  label?: string;
  mediaType: typeof INLINE_ARTIFACT_MEDIA_TYPE;
  encoding: typeof INLINE_ARTIFACT_ENCODING;
  byteLength: number;
  /** Server-computed sha256 over the submitted bytes: four 16-hex groups. */
  hash: string;
}

export class ArtifactValidationError extends Error {
  readonly status: 400 | 413;
  constructor(message: string, status: 400 | 413 = 400) {
    super(message);
    this.name = 'ArtifactValidationError';
    this.status = status;
  }
}

/**
 * Server-side sha256 over the submitted bytes. Emitted as four 16-hex groups
 * joined by hyphens — never a bare 64-char hex string.
 */
export function artifactHash(data: string): string {
  const hex = createHash('sha256').update(data, 'utf8').digest('hex');
  return `${hex.slice(0, 16)}-${hex.slice(16, 32)}-${hex.slice(32, 48)}-${hex.slice(48, 64)}`;
}

/**
 * Validate one inline artifact element and bind it with a server-issued id.
 * The caller id is kept as a label only. Throws ArtifactValidationError
 * (400 for shape violations, 413 for over-cap bytes) before any mission work.
 */
export function bindInlineArtifact(input: InlineArtifactInput): BoundInlineArtifact {
  if (typeof input !== 'object' || input === null) {
    throw new ArtifactValidationError('inline artifact must be an object');
  }
  if (input.mediaType !== INLINE_ARTIFACT_MEDIA_TYPE) {
    throw new ArtifactValidationError(
      `inline artifact mediaType must be "${INLINE_ARTIFACT_MEDIA_TYPE}"`,
    );
  }
  if (input.encoding !== INLINE_ARTIFACT_ENCODING) {
    throw new ArtifactValidationError(
      `inline artifact encoding must be "${INLINE_ARTIFACT_ENCODING}"`,
    );
  }
  if (typeof input.data !== 'string' || !input.data) {
    throw new ArtifactValidationError('inline artifact data must be a nonempty string');
  }
  const byteLength = Buffer.byteLength(input.data, 'utf8');
  if (byteLength > INLINE_ARTIFACT_MAX_BYTES) {
    throw new ArtifactValidationError(
      `inline artifact exceeds the ${INLINE_ARTIFACT_MAX_BYTES / 1024} KiB cap`,
      413,
    );
  }
  return {
    artifactId: randomUUID(),
    label: typeof input.id === 'string' && input.id ? input.id : undefined,
    mediaType: INLINE_ARTIFACT_MEDIA_TYPE,
    encoding: INLINE_ARTIFACT_ENCODING,
    byteLength,
    hash: artifactHash(input.data),
  };
}

/** Validate the optional inlineArtifacts envelope (at most one element). */
export function bindInlineArtifacts(input: unknown): BoundInlineArtifact | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) {
    throw new ArtifactValidationError('inlineArtifacts must be an array');
  }
  if (input.length > INLINE_ARTIFACT_MAX_ITEMS) {
    throw new ArtifactValidationError(
      `inlineArtifacts accepts at most ${INLINE_ARTIFACT_MAX_ITEMS} element`,
    );
  }
  if (input.length === 0) return undefined;
  return bindInlineArtifact(input[0] as InlineArtifactInput);
}

// =============================================================================
// PER-RUN ROLE ALLOWLIST (authority)
// =============================================================================

/**
 * Resolve the frozen per-run tool allowlist for a role.
 *
 * - Red roles freeze the operator's curated defaultTools (passed in).
 * - Black and the hats freeze their catalog grant tables.
 * - Blue, White, and their hats freeze their catalog grant tables — never the
 *   operator defaultTools, which carry probe-grade http_request/curl_request.
 * - Unknown roles (including purple) throw; callers catch that as deny-all.
 */
const CATALOG_TO_ADAPTER_NAMES: Readonly<Record<string, readonly string[]>> = {
  dig: ['dns_lookup'],
  curl: ['curl_request', 'http_request'],
  nmap: ['port_scanner', 'nmap_scanner'],
};

function expandCatalogGrantsToToolNames(grants: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of grants) {
    out.add(id);
    out.add(`${id.replace(/[^a-z0-9]+/gi, '_')}_tool`);
    const extra = CATALOG_TO_ADAPTER_NAMES[id];
    if (extra) {
      for (const alias of extra) out.add(alias);
    }
  }
  return [...out];
}

export function resolveRunAllowlist(
  role: OperatorArchetype,
  redDefaultTools: readonly string[] = [],
): string[] {
  if ((RED_ARCHETYPES as readonly string[]).includes(role)) {
    return expandCatalogGrantsToToolNames(redDefaultTools);
  }
  if (role === 'black' || role === 'blue' || role === 'white') {
    return expandCatalogGrantsToToolNames(teamToolGrants(role));
  }
  if (isHat(role)) {
    return expandCatalogGrantsToToolNames(hatToolGrants(role));
  }
  throw new Error(`resolveRunAllowlist: "${role}" is not a spawnable role (purple never spawns)`);
}

// =============================================================================
// STRUCTURED START VALIDATION
// =============================================================================

/** Legacy versus structured discriminator: any of these keys flips the branch. */
export function isStructuredStart(body: Record<string, unknown>): boolean {
  return body.roleInputs !== undefined || body.family !== undefined || body.targetContext !== undefined;
}

export class StructuredStartError extends Error {
  readonly status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = 'StructuredStartError';
  }
}

export interface StructuredRoleInput {
  archetype?: unknown;
}

export interface StructuredStartBody {
  objective?: unknown;
  operators?: unknown;
  roleInputs?: unknown;
  targetContext?: unknown;
  family?: unknown;
}

export interface ValidatedStructuredStart {
  /** Attributable run id minted at validation time and retained by the run. */
  runId: string;
  objective: string;
  /** Unique roles in the 17-role union, in request order. Spawn alone is not success. */
  roles: OperatorArchetype[];
  artifactOnly: boolean;
}

function rolesFromBody(body: StructuredStartBody): unknown[] {
  if (Array.isArray(body.roleInputs)) {
    return body.roleInputs.map((entry) =>
      typeof entry === 'string' ? entry : (entry as StructuredRoleInput)?.archetype,
    );
  }
  if (Array.isArray(body.operators)) return body.operators;
  return [];
}

/**
 * Validate a structured launch before any mission state is created.
 * Throws StructuredStartError (400, naming the offending role) on failure.
 * Never throws for legacy bodies — gate with isStructuredStart first.
 */
export function validateStructuredStart(body: StructuredStartBody): ValidatedStructuredStart {
  if (typeof body.objective !== 'string' || !body.objective.trim()) {
    throw new StructuredStartError('structured start requires a nonempty string objective');
  }
  const rawRoles = rolesFromBody(body);
  if (rawRoles.length === 0) {
    throw new StructuredStartError('structured start requires nonempty operators');
  }
  const seen = new Set<string>();
  const roles: OperatorArchetype[] = [];
  for (const raw of rawRoles) {
    const role = String(raw);
    if (!(SPAWNABLE_ARCHETYPES as readonly string[]).includes(role)) {
      throw new StructuredStartError(`unknown role "${role}" — expected one of the 17 spawnable roles`);
    }
    if (seen.has(role)) {
      throw new StructuredStartError(`duplicate role "${role}" — roles must be unique`);
    }
    seen.add(role);
    roles.push(role as OperatorArchetype);
  }
  const kind = (body.targetContext as { kind?: unknown } | undefined)?.kind;
  return {
    runId: randomUUID(),
    objective: (body.objective as string).trim(),
    roles,
    artifactOnly: kind === 'artifacts',
  };
}
