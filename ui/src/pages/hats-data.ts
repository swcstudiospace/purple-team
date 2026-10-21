import type { SelectedRepo } from '../stores/github';

/**
 * The four hats, verbatim from the chat panel's original table so this page
 * and the panel cannot drift apart. Each hat launches a mission via
 * POST /api/mission/start with its operator roster and objective, targeted at
 * the repo attached in the GitHub tab.
 */
export const HATS = [
  {
    id: 'red',
    label: 'Red',
    doctrine: 'Scope-receipt offensive research through builtin operator defaultTools, not teamToolGrants.',
    operators: ['scanner', 'recon', 'exploiter'],
    objective: 'Find exploitable weaknesses',
  },
  {
    id: 'blue',
    label: 'Blue',
    doctrine: 'Read-only detection and hardening of supplied artifacts; never touches the target.',
    operators: ['blue', 'sentinel'],
    objective: 'Map detection coverage',
  },
  {
    id: 'white',
    label: 'White',
    doctrine: 'Adjudication reference over ROE and evidence; never authorization to test.',
    operators: ['white', 'auditor'],
    objective: 'Adjudicate evidence and ROE',
  },
  {
    id: 'black',
    label: 'Black',
    doctrine: 'Analysis-only tradecraft review of supplied plans; never a live probe.',
    operators: ['black', 'specter'],
    objective: 'Harden this codebase',
  },
] as const;

/** Mission target for /api/mission/start: GitHub URL (with /tree/<ref> unless HEAD) or local path. */
export function repoSource(selected: SelectedRepo): { repoUrl: string } | { repoPath: string } {
  const local = selected.repoPath?.trim() ?? '';
  if (local !== '') return { repoPath: local };
  const ref = selected.ref !== '' && selected.ref !== 'HEAD' ? `/tree/${selected.ref}` : '';
  return { repoUrl: `https://github.com/${selected.owner}/${selected.repo}${ref}` };
}

/** Token-shaped secrets (sk-/ghp_/xox/AKIA) never render unredacted in notices. */
export const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g;

export function redactString(text: string): string {
  return text.replace(SECRET_VALUE, '[redacted]');
}
