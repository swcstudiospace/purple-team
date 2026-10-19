import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { parseRepoTarget, type ParsedRepoTarget } from '../../../src/recon/repo-url';
import { useSelectedRepo } from '../stores/github';
import './repo-run-config.css';
/**
 * Repo-URL run configuration (phase 35, SPE-15992).
 *
 * The pasted URL is the single source of truth for ref + scope (35-CONTEXT
 * §6.1: "the URL IS the ref/branch + scope selector — no separate selector
 * fields"). The ref and subpath controls below are friendly editors over that
 * URL: every change recomposes it from the last successfully parsed target, so
 * exactly one argument (`repoUrl`) ever leaves the form. Validation runs
 * client-side through the SAME shared module the server re-validates with
 * (imported here exactly like AgentPanel imports ui-commands).
 *
 * Launch posts the structured mission-start shape — objective, operators,
 * targetContext { kind: 'artifacts' } (a repo run analyzes supplied source, it
 * does not probe a live host) — plus repoUrl.
 */

export interface RepoRunStarted {
  /** Canonical owner/repo@ref[/subpath] label from the shared validator. */
  label: string;
  runId?: string;
  missionName?: string;
}

export interface RepoRunConfigProps {
  onStarted?: (result: RepoRunStarted) => void;
  /**
   * Owning conversation id: when provided, the store target only prefills
   * when it is attached to THIS conversation (a target launched in another
   * thread must not leak in). Undefined = unscoped (non-workbench mounts).
   */
  threadId?: string;
}

/** The 17 spawnable roles (src/teams/contracts.ts), grouped by discipline with doctrine copy from src/teams/hat-registry.ts. */
const OPERATOR_GROUPS: ReadonlyArray<{ group: string; doctrine: string; roles: readonly string[] }> = [
  {
    group: 'Red',
    doctrine: 'Offensive research operators (builtin operator tools).',
    roles: ['red', 'recon', 'exploiter'],
  },
  {
    group: 'Blue',
    doctrine: 'Defensive coverage and D3FEND mapping.',
    roles: ['blue', 'sentinel', 'warden'],
  },
  {
    group: 'White',
    doctrine: 'Adjudication reference over ROE and evidence.',
    roles: ['white', 'arbiter', 'auditor'],
  },
];

const DEFAULT_ROLES: readonly string[] = ['scanner', 'auditor'];

/** One branch row from GET /api/github/branches (fed to the ref datalist). */
interface BranchSummary {
  name: string;
}

const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g;

/** Prefer the server's plain `error: string` body field (AgentPanel serverErrorMessage precedent). */
function serverError(body: unknown, response: Response): string {
  if (body !== null && typeof body === 'object' && 'error' in body) {
    const message = body.error; // unknown, narrowed by the `in` guard
    if (typeof message === 'string' && message.trim() !== '') {
      return message.replace(SECRET_VALUE, '[redacted]');
    }
  }
  return `Request failed with HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`;
}

/** Recompose the canonical URL form from a parsed target plus control values (ref '' → default branch). */
function composeUrl(base: ParsedRepoTarget, ref: string, subpath: string, wholeRepo: boolean): string {
  const effectiveRef = ref.trim();
  const effectiveSubpath = wholeRepo ? '' : subpath.trim().replace(/^\/+/, '');
  if (effectiveRef === '' && effectiveSubpath === '') return `https://github.com/${base.owner}/${base.repo}`;
  const refSegment = effectiveRef === '' ? 'HEAD' : effectiveRef;
  return `https://github.com/${base.owner}/${base.repo}/tree/${refSegment}${effectiveSubpath === '' ? '' : `/${effectiveSubpath}`}`;
}

export default function RepoRunConfig({ onStarted, threadId }: RepoRunConfigProps) {
  const urlId = useId();
  const refId = useId();
  const scopeId = useId();
  const subpathId = useId();
  const objectiveId = useId();
  const nameId = useId();
  const rolesId = useId();
  const branchListId = useId();

  const [repoUrl, setRepoUrl] = useState('');
  const [refText, setRefText] = useState('');
  const [subpathText, setSubpathText] = useState('');
  const [wholeRepo, setWholeRepo] = useState(true);
  const [objective, setObjective] = useState('');
  const [missionName, setMissionName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<readonly string[]>(DEFAULT_ROLES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<RepoRunStarted | null>(null);
  const [branches, setBranches] = useState<readonly BranchSummary[]>([]);
  const [branchDefault, setBranchDefault] = useState<string | null>(null);
  const { selected, threadId: ownerThreadId } = useSelectedRepo();

  // Link to GitHub: prefill URL from the selected store target, but only when
  // it belongs to this conversation (or no conversation scope was given).
  const targetInScope = selected !== null && (threadId === undefined || ownerThreadId === threadId);
  const didPrefill = useRef(false);
  useEffect(() => {
    if (selected === null || !targetInScope || didPrefill.current || repoUrl.trim() !== '') return;
    const refPart = selected.ref && selected.ref !== 'HEAD' ? `/tree/${selected.ref}` : '';
    setRepoUrl(`https://github.com/${selected.owner}/${selected.repo}${refPart}`);
    didPrefill.current = true;
  }, [selected, targetInScope]);

  const parsed = useMemo(() => parseRepoTarget(repoUrl), [repoUrl]);

  // Compose base: the most recent VALID target. Controls stay usable (and can
  // repair a URL they just broke mid-edit) instead of locking on a fault.
  const lastGoodRef = useRef<ParsedRepoTarget | null>(null);
  if (parsed.ok) lastGoodRef.current = parsed.value;

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const controlsAvailable = lastGoodRef.current !== null;

  // Branch picker: datalist suggestions for the ref input, fetched per
  // owner/repo from GET /api/github/branches. Best-effort — a failure (route
  // missing, auth gap) leaves the free-text ref control fully usable.
  const branchOwnerRepo = parsed.ok ? `${parsed.value.owner}/${parsed.value.repo}` : null;
  useEffect(() => {
    if (branchOwnerRepo === null) {
      setBranches([]);
      setBranchDefault(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const [owner, repo] = branchOwnerRepo.split('/');
    fetch(`/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(response => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (cancelled || body === null || typeof body !== 'object') return;
        if (!('branches' in body) || !Array.isArray(body.branches)) return;
        const list: BranchSummary[] = [];
        for (const branch of body.branches) {
          if (branch !== null && typeof branch === 'object' && 'name' in branch && typeof branch.name === 'string') {
            list.push({ name: branch.name });
          }
        }
        setBranches(list);
        if ('defaultBranch' in body && typeof body.defaultBranch === 'string' && body.defaultBranch !== '') {
          setBranchDefault(body.defaultBranch);
        }
      })
      .catch(() => {
        // Optional suggestions only; never block the form.
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [branchOwnerRepo]);

  // Reject snippets (non github URL code pastes). Purple accepts URLs, rejects snippets, inline error.
  // Inlined to follow no-tiny-fn. Security: parse already validates no creds, https github etc.
  const isSnippet = repoUrl.trim() !== '' && !repoUrl.includes('github.com') &&
    (repoUrl.split('\n').length > 1 || /function |^import |^class |^def |^package |^const |^let /.test(repoUrl) || repoUrl.length > 150);
  const effectiveParsed = isSnippet
    ? { ok: false as const, fault: 'snippet-rejected' as const, message: 'Snippets rejected — Purple Team input accepts GitHub URLs only (https://github.com/owner/repo or /tree/ref). Paste a repo URL or use GitHub page to select.' }
    : parsed;

  const canLaunch = effectiveParsed.ok && objective.trim() !== '' && selectedRoles.length > 0 && !submitting && !isSnippet;


  function handleUrlChange(value: string): void {
    setRepoUrl(value);
    const next = parseRepoTarget(value);
    if (next.ok) {
      setRefText(next.value.ref === 'HEAD' ? '' : next.value.ref);
      setSubpathText(next.value.subpath);
      setWholeRepo(next.value.subpath === '');
    }
  }

  function recompose(changes: { ref?: string; subpath?: string; whole?: boolean }): void {
    const base = lastGoodRef.current;
    if (base === null) return;
    const nextRef = changes.ref !== undefined ? changes.ref : refText;
    const nextSubpath = changes.subpath !== undefined ? changes.subpath : subpathText;
    const nextWhole = changes.whole !== undefined ? changes.whole : wholeRepo;
    setRepoUrl(composeUrl(base, nextRef, nextSubpath, nextWhole));
  }

  function handleRefChange(value: string): void {
    setRefText(value);
    recompose({ ref: value });
  }

  function handleSubpathChange(value: string): void {
    setSubpathText(value);
    recompose({ subpath: value });
  }

  function handleScopeChange(whole: boolean): void {
    setWholeRepo(whole);
    recompose({ whole });
  }

  function handleRoleToggle(role: string, checked: boolean): void {
    setSelectedRoles(previous =>
      checked
        ? [...previous, role]
        : previous.filter(item => item !== role),
    );
  }
  async function handleLaunch(): Promise<void> {
    if (!effectiveParsed.ok || submitting || isSnippet) {
      if (isSnippet) setError('Snippets not supported. Use GitHub repository URL.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setSubmitting(true);
    setError(null);
    setStarted(null);
    const label = effectiveParsed.value.canonical;
    try {
      const response = await fetch('/api/mission/start', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: objective.trim(),
          operators: selectedRoles,
          targetContext: { kind: 'artifacts' },
          repoUrl,
          ...(missionName.trim() !== '' ? { name: missionName.trim() } : {}),
        }),
        signal: controller.signal,
      });
      let body: unknown = null;
      try {
        body = JSON.parse(await response.text());
      } catch {
        body = null;
      }
      if (!response.ok) {
        setError(serverError(body, response));
        return;
      }
      const summary: RepoRunStarted = { label };
      if (body !== null && typeof body === 'object') {
        const record = body;
        if ('runId' in record && typeof record.runId === 'string') summary.runId = record.runId;
        if ('missionName' in record && typeof record.missionName === 'string') summary.missionName = record.missionName;
      }
      setStarted(summary);
      onStarted?.(summary);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message.replace(SECRET_VALUE, '[redacted]') : 'Request failed.');
      }
    } finally {
      setSubmitting(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  return (
    <form
      className="repo-run-config"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        void handleLaunch();
      }}
    >
      <header className="rrc-header">
        <h2 className="rrc-title">Repository hunt</h2>
        <p className="rrc-subtitle">
          Paste a github.com repository URL. The fetched source is security-ranked and handed to every operator as
          white-box context — the mission itself is unchanged. URLs only; snippets rejected inline.
        </p>
      </header>

      {targetInScope && selected !== null && (
        <p className="rrc-hint" role="status">Linked from GitHub (success state): {selected.fullName}. Fallback: public URLs work anonymously.</p>
      )}

      <div className="rrc-field">
        <label className="rrc-label" htmlFor={urlId}>Repository URL</label>
        <input
          id={urlId}
          className="rrc-input"
          type="url"
          value={repoUrl}
          spellCheck={false}
          autoComplete="off"
          placeholder="https://github.com/owner/repo"
          aria-describedby={`${urlId}-feedback`}
          onChange={event => handleUrlChange(event.target.value)}
        />
        {!effectiveParsed.ok ? (
          <p className="rrc-feedback rrc-feedback--error" id={`${urlId}-feedback`} role="alert">
            <span className="rrc-fault-pill">{isSnippet ? 'snippet-rejected' : effectiveParsed.fault}</span> {effectiveParsed.message}
          </p>
        ) : (
          <p className="rrc-feedback rrc-feedback--ok" id={`${urlId}-feedback`}>
            Scope: <code>{effectiveParsed.value.canonical}</code>
            {effectiveParsed.value.ref === 'HEAD' ? ' (default branch, resolved automatically)' : ''}
          </p>
        )}
      </div>

      <div className="rrc-controls-row">
        <div className="rrc-field rrc-field--branch">
          <label className="rrc-label" htmlFor={refId}>Branch / tag / commit</label>
          <input
            id={refId}
            className="rrc-input"
            type="text"
            value={refText}
            disabled={!controlsAvailable}
            spellCheck={false}
            autoComplete="off"
            placeholder="default branch (auto)"
            list={branchListId}
            onChange={event => handleRefChange(event.target.value)}
          />
          <datalist id={branchListId}>
            {branches.map(branch => (
              <option key={branch.name} value={branch.name} />
            ))}
          </datalist>
          <p className="rrc-hint">
            Leave empty to run the repository&apos;s default branch
            {branchDefault !== null ? (
              <>
                {' '}
                (<code>{branchDefault}</code>)
              </>
            ) : (
              ''
            )}{' '}
            (resolved automatically). Free-text branch, tag, or commit
            {branches.length > 0 ? `, or pick from the ${branches.length} fetched branches` : ''}.
          </p>
        </div>

        <fieldset className="rrc-field rrc-scope">
          <legend className="rrc-label">Scope</legend>
          <div className="rrc-radios">
            <label className="rrc-radio">
              <input
                type="radio"
                name={`${scopeId}-scope`}
                checked={wholeRepo}
                disabled={!controlsAvailable}
                onChange={() => handleScopeChange(true)}
              />
              Whole repository
            </label>
            <label className="rrc-radio">
              <input
                type="radio"
                name={`${scopeId}-scope`}
                checked={!wholeRepo}
                disabled={!controlsAvailable}
                onChange={() => handleScopeChange(false)}
              />
              Subdirectory
            </label>
          </div>
          <input
            id={subpathId}
            className="rrc-input"
            type="text"
            value={subpathText}
            disabled={!controlsAvailable || wholeRepo}
            spellCheck={false}
            autoComplete="off"
            placeholder="src/"
            aria-label="Subdirectory path within the repository"
            onChange={event => handleSubpathChange(event.target.value)}
          />
          <p className="rrc-hint">Narrowing to a subdirectory keeps large repositories under the download caps.</p>
        </fieldset>
      </div>

      <div className="rrc-field">
        <label className="rrc-label" htmlFor={objectiveId}>Objective</label>
        <textarea
          id={objectiveId}
          className="rrc-textarea"
          value={objective}
          rows={3}
          placeholder="Assess this repository for exploitable weaknesses and hardening gaps."
          onChange={event => setObjective(event.target.value)}
        />
      </div>

      <fieldset className="rrc-field rrc-roles" id={rolesId}>
        <legend className="rrc-label">Operators</legend>
        <div className="rrc-roles-groups">
          {OPERATOR_GROUPS.map(group => (
            <div className="rrc-roles-group" key={group.group}>
              <p className="rrc-roles-group-title">
                <span className="rrc-roles-group-name">{group.group}</span>
                <span className="rrc-roles-group-doctrine">{group.doctrine}</span>
              </p>
              <div className="rrc-role-grid">
                {group.roles.map(role => (
                  <label className="rrc-role" key={role}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={event => handleRoleToggle(role, event.target.checked)}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="rrc-field">
        <label className="rrc-label" htmlFor={nameId}>Mission name (optional)</label>
        <input
          id={nameId}
          className="rrc-input"
          type="text"
          value={missionName}
          autoComplete="off"
          placeholder="Operation …"
          onChange={event => setMissionName(event.target.value)}
        />
      </div>

      {error !== null && (
        <p className="rrc-error" role="alert">{error}</p>
      )}
      {started !== null && (
        <p className="rrc-started">
          Mission started for <code>{started.label}</code>
          {started.runId !== undefined ? <> — run <code>{started.runId}</code></> : null}.
        </p>
      )}

      <div className="rrc-launch-row">
        <button type="submit" className="rrc-launch" disabled={!canLaunch}>
          {submitting ? <span className="rrc-spinner" aria-hidden="true" /> : null}
          {submitting ? 'Starting…' : 'Launch repo hunt'}
        </button>
        <p className="rrc-hint">
          Public repositories work out of the box (anonymous fallback). Private need connected GitHub (repo scope) — connect via GitHub section. States: empty (paste), error (inline for bad/snippet), success (parsed + enabled launch).
        </p>
      </div>

      <footer className="rrc-caveat">
        Source ingest analyzes Python, JavaScript, TypeScript, TSX, Go, Java, C, and C++ — a language without a
        bundled grammar is invisible to it. Vendored and build directories, lockfiles, minified, oversized, and binary
        files are skipped. Downloads are capped (64 MiB and 5,000 files by default) — narrow the scope if the run
        reports an oversized repository.
      </footer>
    </form>
  );
}
