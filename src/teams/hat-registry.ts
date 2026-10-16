/**
 * Four-hat directory — red, blue, black, white. Purple stays orchestrator-level
 * and is not an entry. Specialist ids point at existing prompt and workflow
 * modules; this file grants nothing and spawns nothing.
 *
 * grantCount() is lazy: hat-registry and teams/index import each other, so the
 * parent lengths are read when called, not at module init.
 */

import { teamToolGrants } from './index.js';
import { hatToolGrants, type HatArchetype } from './hats.js';

export type HatDirectoryId = 'red' | 'blue' | 'black' | 'white';

export interface HatDirectoryEntry {
  id: HatDirectoryId;
  label: string;
  /** One-line doctrine. Not a procedure. */
  doctrine: string;
  promptModule: string;
  workflowModule: string;
  specialists: readonly string[];
  /**
   * Parent catalog-grant length. Null for red: red uses builtin operator
   * defaultTools, not teamToolGrants.
   */
  readonly grantCount: number | null;
  /** Present when grantCount is null. */
  note?: string;
}

const RED_GRANT_NOTE = 'red uses builtin operator defaultTools, not teamToolGrants';

export const HAT_DIRECTORY: readonly HatDirectoryEntry[] = [
  {
    id: 'red',
    label: 'Red',
    doctrine: 'Scope-receipt offensive research through builtin operator defaultTools, not teamToolGrants.',
    promptModule: 'src/prompts/index.ts',
    workflowModule: 'src/operators/index.ts',
    specialists: ['recon', 'scanner', 'exploiter', 'infiltrator', 'exfiltrator', 'ghost', 'coordinator', 'analyst'],
    grantCount: null,
    note: RED_GRANT_NOTE,
  },
  {
    id: 'blue',
    label: 'Blue',
    doctrine: 'Read-only detection and hardening of supplied artifacts; never touches the target.',
    promptModule: 'src/prompts/blue.ts',
    workflowModule: 'src/teams/blue/workflow.ts',
    specialists: ['sentinel', 'warden'],
    get grantCount(): number | null {
      return teamToolGrants('blue').length;
    },
  },
  {
    id: 'black',
    label: 'Black',
    doctrine: 'Analysis-only tradecraft review of supplied plans; never a live probe.',
    promptModule: 'src/prompts/black.ts',
    workflowModule: 'src/teams/black/workflow.ts',
    specialists: ['specter', 'wraith'],
    get grantCount(): number | null {
      return teamToolGrants('black').length;
    },
  },
  {
    id: 'white',
    label: 'White',
    doctrine: 'Adjudication reference over ROE and evidence; never authorization to test.',
    promptModule: 'src/prompts/white.ts',
    workflowModule: 'src/teams/white/workflow.ts',
    specialists: ['arbiter', 'auditor'],
    get grantCount(): number | null {
      return teamToolGrants('white').length;
    },
  },
];

/**
 * Parent lengths come from teamToolGrants. Specialist lengths come from
 * hatToolGrants. Red is null: red uses builtin operator defaultTools, not
 * teamToolGrants.
 */
export function grantCount(id: HatDirectoryId | HatArchetype): number | null {
  const entry = HAT_DIRECTORY.find(item => item.id === id);
  if (entry) return entry.grantCount;
  return hatToolGrants(id as HatArchetype).length;
}
