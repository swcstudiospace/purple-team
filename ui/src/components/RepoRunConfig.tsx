import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { parseRepoTarget, type ParsedRepoTarget } from '../../../src/recon/repo-url';
import { useSelectedRepo } from '../stores/github';
import { newClientRunId, startedRunIds, useConversationsStore } from '../stores/conversations';
import './repo-run-config.css';
/**
 * Hunt run configuration.
 *
 * Target is either a github.com URL or a local folder, never both. Ref and
 * subpath are editors over the URL (35-CONTEXT §6.1): URL mode posts `repoUrl`
 * and omits `repoPath`; local mode posts `repoPath` and omits `repoUrl`.
 * URL validation uses the same shared parser the server re-validates with.
 *
 * Operators are spawnable roles only (src/teams/contracts.ts). Red, Blue,
 * White, and Black are hats: the Red header toggles the eight Red roles and
 * never posts the discipline id "red".
 *
 * Launch posts objective, operators, targetContext { kind: 'artifacts' }, the
 * one repo source, optional mission name, and provider/model when
 * GET /api/llm/options loaded. A 404 hides that row and omits those fields.
 */

export interface RepoRunStarted {
  /** Canonical owner/repo@ref[/subpath] for a GitHub URL run, or the local folder path. */
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

/** Spawnable roles only. Group names are hats, never operator ids — Red has no 'red' role. */
const OPERATOR_GROUPS: ReadonlyArray<{ group: string; doctrine: string; roles: readonly string[] }> = [
  {
    group: 'Red',
    doctrine: 'Red offensive research',
    roles: ['recon', 'scanner', 'exploiter', 'infiltrator', 'exfiltrator', 'ghost', 'coordinator', 'analyst'],
  },
  {
    group: 'Blue',
    doctrine: 'Blue defensive coverage',
    roles: ['blue', 'sentinel', 'warden'],
  },
  {
    group: 'White',
    doctrine: 'White ROE and evidence',
    roles: ['white', 'arbiter', 'auditor'],
  },
  {
    group: 'Black',
    doctrine: 'Black harden the codebase (opsec, risk, cover, stress)',
    roles: ['black', 'specter', 'wraith'],
  },
];

const DEFAULT_ROLES: readonly string[] = ['scanner', 'auditor'];

/** Datalist suggestions for the Operators field: exactly the operator ids HEAD's AgentPanel launches. */
const ROLE_SUGGESTIONS: readonly string[] = [
  'scanner', 'recon', 'exploiter', // Red
  'blue', 'sentinel', // Blue
  'white', 'auditor', // White
  'black', 'specter', // Black
];

/** One branch row from GET /api/github/branches (fed to the ref datalist). */
interface BranchSummary {
  name: string;
}

interface LlmProviderOption {
  id: string;
  label: string;
  models: readonly string[];
}

interface LlmOptions {
  active: { provider: string; model: string };
  providers: readonly LlmProviderOption[];
}

interface MissionStartBody {
  objective: string;
  operators: string[];
  targetContext: { kind: 'artifacts' };
  name?: string;
  repoUrl?: string;
  repoPath?: string;
  provider?: string;
  model?: string;
  clientRunId?: string;
}

type TargetMode = 'url' | 'local';

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

function parseLlmOptions(body: unknown): LlmOptions | null {
  if (body === null || typeof body !== 'object') return null;
  if (!('active' in body) || !('providers' in body) || !Array.isArray(body.providers)) return null;
  const activeRaw = body.active;
  if (activeRaw === null || typeof activeRaw !== 'object') return null;
  if (!('provider' in activeRaw) || typeof activeRaw.provider !== 'string') return null;
  if (!('model' in activeRaw) || typeof activeRaw.model !== 'string') return null;
  const providers: LlmProviderOption[] = [];
  for (const item of body.providers) {
    if (item === null || typeof item !== 'object') continue;
    if (!('id' in item) || typeof item.id !== 'string' || item.id === '') continue;
    if (!('models' in item) || !Array.isArray(item.models)) continue;
    const models: string[] = [];
    let modelsOk = true;
    for (const model of item.models) {
      if (typeof model !== 'string' || model === '') {
        modelsOk = false;
        break;
      }
      models.push(model);
    }
    if (!modelsOk) continue;
    const label = 'label' in item && typeof item.label === 'string' && item.label !== '' ? item.label : item.id;
    providers.push({ id: item.id, label, models });
  }
  if (providers.length === 0) return null;
  return { active: { provider: activeRaw.provider, model: activeRaw.model }, providers };
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
  const rolesListId = useId();
  const pathId = useId();
  const providerFieldId = useId();
  const modelFieldId = useId();
  const targetModeName = useId();

  const [targetMode, setTargetMode] = useState<TargetMode>('url');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoPath, setRepoPath] = useState('');
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
  const [llmOptions, setLlmOptions] = useState<LlmOptions | null>(null);
  const [providerId, setProviderId] = useState('');
  const [modelId, setModelId] = useState('');
  const { selected, threadId: ownerThreadId } = useSelectedRepo();
  const llmChoiceRef = useRef<{ provider: string; model: string } | null>(null);
  const llmLoadRef = useRef<Promise<void>>(Promise.resolve());

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

  // Provider/model row. 404 (or any failure) hides the row; launch then omits
  // provider and model so a missing route cannot block a hunt.
  useEffect(() => {
    const controller = new AbortController();
    llmLoadRef.current = (async () => {
      try {
        const response = await fetch('/api/llm/options', {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (controller.signal.aborted || response.status === 404 || !response.ok) return;
        const options = parseLlmOptions(await response.json());
        if (options === null || controller.signal.aborted) return;
        const provider = options.providers.find(item => item.id === options.active.provider) ?? options.providers[0];
        if (provider === undefined) return;
        const model = provider.id === options.active.provider && options.active.model !== ''
          ? options.active.model
          : options.active.model !== '' && provider.models.includes(options.active.model)
            ? options.active.model
            : (provider.models[0] ?? '');
        if (model === '' || controller.signal.aborted) return;
        setLlmOptions(options);
        setProviderId(provider.id);
        setModelId(model);
        llmChoiceRef.current = { provider: provider.id, model };
      } catch {
        // 404, abort, or network: hide the row and launch without provider/model.
      }
    })();
    return () => controller.abort();
  }, []);

  // Reject snippets (non github URL code pastes). Purple accepts URLs, rejects snippets, inline error.
  // Inlined to follow no-tiny-fn. Security: parse already validates no creds, https github etc.
  const isSnippet = repoUrl.trim() !== '' && !repoUrl.includes('github.com') &&
    (repoUrl.split('\n').length > 1 || /function |^import |^class |^def |^package |^const |^let /.test(repoUrl) || repoUrl.length > 150);
  const effectiveParsed = isSnippet
    ? { ok: false as const, fault: 'snippet-rejected' as const, message: 'Snippets rejected — Purple Team input accepts GitHub URLs only (https://github.com/owner/repo or /tree/ref). Paste a repo URL or use GitHub page to select.' }
    : parsed;

  const sourceReady = targetMode === 'local'
    ? repoPath.trim() !== ''
    : effectiveParsed.ok && !isSnippet;
  const canLaunch = sourceReady && objective.trim() !== '' && selectedRoles.length > 0 && !submitting;

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
    if (role === 'red') return;
    setSelectedRoles(previous =>
      checked
        ? (previous.includes(role) ? previous : [...previous, role])
        : previous.filter(item => item !== role),
    );
  }

  /** Header toggles that hat's spawnable roles. The hat name is never an operator id. */
  function handleGroupToggle(roles: readonly string[]): void {
    const ids = roles.filter(role => role !== 'red');
    setSelectedRoles(previous => {
      const kept = previous.filter(role => role !== 'red');
      const allOn = ids.length > 0 && ids.every(role => kept.includes(role));
      if (allOn) return kept.filter(role => !ids.includes(role));
      const next = [...kept];
      for (const role of ids) {
        if (!next.includes(role)) next.push(role);
      }
      return next;
    });
  }

  function handleProviderChange(nextId: string): void {
    setProviderId(nextId);
    if (llmOptions === null) {
      llmChoiceRef.current = null;
      return;
    }
    const provider = llmOptions.providers.find(item => item.id === nextId);
    if (provider === undefined) {
      setModelId('');
      llmChoiceRef.current = null;
      return;
    }
    const preferred = provider.id === llmOptions.active.provider ? llmOptions.active.model : '';
    const models = preferred !== '' && !provider.models.includes(preferred)
      ? [preferred, ...provider.models]
      : provider.models;
    const nextModel = models.includes(modelId) ? modelId : (models[0] ?? '');
    setModelId(nextModel);
    llmChoiceRef.current = nextModel !== '' ? { provider: nextId, model: nextModel } : null;
  }

  function handleModelChange(nextModel: string): void {
    setModelId(nextModel);
    llmChoiceRef.current = providerId !== '' && nextModel !== ''
      ? { provider: providerId, model: nextModel }
      : null;
  }

  async function handleLaunch(): Promise<void> {
    if (submitting) return;
    if (targetMode === 'url') {
      if (isSnippet) {
        setError('Snippets not supported. Use GitHub repository URL.');
        return;
      }
      if (!effectiveParsed.ok) return;
    } else if (repoPath.trim() === '') {
      return;
    }
    const operators = selectedRoles.filter(role => role !== 'red');
    if (objective.trim() === '' || operators.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setSubmitting(true);
    setError(null);
    setStarted(null);
    const mode = targetMode;
    const objectiveText = objective.trim();
    const name = missionName.trim();
    const path = repoPath.trim();
    const url = repoUrl;
    const label = mode === 'url' && effectiveParsed.ok ? effectiveParsed.value.canonical : path;
    try {
      await llmLoadRef.current;
      if (controller.signal.aborted) return;
      const payload: MissionStartBody = {
        objective: objectiveText,
        operators,
        targetContext: { kind: 'artifacts' },
      };
      if (name !== '') payload.name = name;
      if (mode === 'local') payload.repoPath = path;
      else payload.repoUrl = url;
      const choice = llmChoiceRef.current;
      if (choice !== null) {
        payload.provider = choice.provider;
        payload.model = choice.model;
      }
      const clientRunId = newClientRunId();
      payload.clientRunId = clientRunId;
      if (threadId !== undefined) useConversationsStore.getState().recordRunOwners(threadId, [clientRunId]);
      const response = await fetch('/api/mission/start', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      if (threadId !== undefined) useConversationsStore.getState().recordRunOwners(threadId, startedRunIds(body));
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

  const selectedProvider = llmOptions?.providers.find(item => item.id === providerId) ?? null;
  const shownModels = selectedProvider === null
    ? []
    : modelId !== '' && !selectedProvider.models.includes(modelId)
      ? [modelId, ...selectedProvider.models]
      : selectedProvider.models;

  return (
    <div className="repo-run-config">
      <p className="rrc-subtitle">
        <strong>How to run a hunt:</strong> pick a repository or local folder, choose hats, set an objective, Launch. Red/Blue/White/Black are hats, not a single role named red.
      </p>
      <form
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0 }}
        onSubmit={event => {
          event.preventDefault();
          void handleLaunch();
        }}
      >
        <header className="rrc-header">
          <h2 className="rrc-title">Repository hunt</h2>
          <p className="rrc-subtitle">
            The source is security-ranked and handed to every operator as white-box context — the mission itself is unchanged.
            URLs and local folders only; snippets rejected inline.
          </p>
        </header>

        {targetInScope && selected !== null && (
          <p className="rrc-hint" role="status">Linked from GitHub (success state): {selected.fullName}. Fallback: public URLs work anonymously.</p>
        )}

        <fieldset className="rrc-field rrc-scope">
          <legend className="rrc-label">Target</legend>
          <div className="rrc-radios">
            <label className="rrc-radio">
              <input
                type="radio"
                name={`${targetModeName}-target`}
                checked={targetMode === 'url'}
                onChange={() => setTargetMode('url')}
              />
              GitHub URL
            </label>
            <label className="rrc-radio">
              <input
                type="radio"
                name={`${targetModeName}-target`}
                checked={targetMode === 'local'}
                onChange={() => setTargetMode('local')}
              />
              Local folder
            </label>
          </div>
          <p className="rrc-hint">
            GitHub URL and local folder are mutually exclusive — one repo source per run. URL mode sends repoUrl and does not send repoPath. Local folder mode sends repoPath and does not send repoUrl.
          </p>
        </fieldset>

        {targetMode === 'url' ? (
          <div className="rrc-field">
            <label className="rrc-label" htmlFor={urlId}>Repository URL</label>
            <input
              id={urlId}
              className="rrc-input"
              type="url"
              value={repoUrl}
              spellCheck={false}
              autoComplete="off"
              placeholder="https://github.com/owner/repo (or paste a repo URL anywhere)"
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
        ) : (
          <div className="rrc-field">
            <label className="rrc-label" htmlFor={pathId}>Local folder</label>
            <input
              id={pathId}
              className="rrc-input"
              type="text"
              value={repoPath}
              spellCheck={false}
              autoComplete="off"
              placeholder="/home/you/repos/your-repo"
              aria-describedby={`${pathId}-hint`}
              onChange={event => setRepoPath(event.target.value)}
            />
            <p className="rrc-hint" id={`${pathId}-hint`}>
              Absolute path on this machine. Mutually exclusive with a GitHub URL — this mode sends repoPath only.
            </p>
          </div>
        )}

        {targetMode === 'url' && (
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
                placeholder="e.g. main, release/1.4, v2.0.1"
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
                placeholder="e.g. src/api or services/auth"
                aria-label="Subdirectory path within the repository"
                onChange={event => handleSubpathChange(event.target.value)}
              />
              <p className="rrc-hint">Narrowing to a subdirectory keeps large repositories under the download caps.</p>
            </fieldset>
          </div>
        )}

        <div className="rrc-field">
          <label className="rrc-label" htmlFor={objectiveId}>Objective</label>
          <textarea
            id={objectiveId}
            className="rrc-textarea"
            value={objective}
            rows={3}
            placeholder="e.g. Find auth bypasses in the login flow and map which detections would catch them"
            onChange={event => setObjective(event.target.value)}
          />
          <p className="rrc-hint">
            Tip: name a specific surface and the outcome you want — the hats tailor operators to the objective.
          </p>
        </div>

        <fieldset className="rrc-field rrc-roles" id={rolesId}>
          <legend className="rrc-label">Operators</legend>
          <p className="rrc-hint">Hats select roles. The header button toggles that hat&apos;s roles and never posts a role named red.</p>
          <datalist id={rolesListId}>
            {ROLE_SUGGESTIONS.map(role => (
              <option key={role} value={role} />
            ))}
          </datalist>
          <div className="rrc-roles-groups">
            {OPERATOR_GROUPS.map(group => {
              const allSelected = group.roles.every(role => selectedRoles.includes(role));
              return (
                <div className="rrc-roles-group" key={group.group}>
                  <div className="rrc-roles-group-title">
                    <button
                      type="button"
                      className="rrc-roles-group-name"
                      aria-pressed={allSelected}
                      aria-label={`Toggle all ${group.group} roles`}
                      style={{
                        background: 'transparent',
                        color: 'inherit',
                        border: '1px solid var(--border)',
                        borderRadius: 999,
                        padding: '1px 8px',
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                      onClick={() => handleGroupToggle(group.roles)}
                    >
                      {group.group}
                    </button>
                    <span className="rrc-roles-group-doctrine">{group.doctrine}</span>
                  </div>
                  <div className="rrc-role-grid">
                    {group.roles.map(role => (
                      <label className="rrc-role" key={role}>
                        <input
                          type="checkbox"
                          value={role}
                          checked={selectedRoles.includes(role)}
                          onChange={event => handleRoleToggle(role, event.target.checked)}
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        {llmOptions !== null && (
          <div className="rrc-controls-row">
            <div className="rrc-field">
              <label className="rrc-label" htmlFor={providerFieldId}>Provider</label>
              <select
                id={providerFieldId}
                className="rrc-input"
                value={providerId}
                onChange={event => handleProviderChange(event.target.value)}
              >
                {llmOptions.providers.map(provider => (
                  <option key={provider.id} value={provider.id}>{provider.label}</option>
                ))}
              </select>
            </div>
            <div className="rrc-field">
              <label className="rrc-label" htmlFor={modelFieldId}>Model</label>
              <select
                id={modelFieldId}
                className="rrc-input"
                value={modelId}
                onChange={event => handleModelChange(event.target.value)}
              >
                {shownModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <p className="rrc-hint">Included in the launch body. Defaults to the active provider and model.</p>
            </div>
          </div>
        )}

        <div className="rrc-field">
          <label className="rrc-label" htmlFor={nameId}>Mission name (optional)</label>
          <input
            id={nameId}
            className="rrc-input"
            type="text"
            value={missionName}
            autoComplete="off"
            placeholder="e.g. Login-flow auth bypass hunt"
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
    </div>
  );
}
