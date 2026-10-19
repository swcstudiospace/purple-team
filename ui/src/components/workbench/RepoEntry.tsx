/**
 * Repo entry screen (Agent Panel start state): "Select a repository or paste
 * a repository URL". Two modes share one card — (A) the connected account's
 * repository list (GET /api/github/repositories, client-side search,
 * visibility filter, Load more) and (B) a paste-URL box with live parse and a
 * resolve-backed preview card (GET /api/github/resolve). Either path hands a
 * full run target (SelectedRepo + optional resolution) to the workbench,
 * which mounts RepoRunConfig for the configure/launch step.
 *
 * A URL pasted anywhere in the UI (composer onPaste) arrives as `prefillUrl`
 * through the useSelectedRepo paste slice: the paste mode opens prefilled,
 * focused, and already resolving.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { parseRepoTarget } from '../../../../src/recon/repo-url';
import {
  ApiError,
  listGitHubRepositories,
  resolveGitHubRepository,
  type GitHubRepoSummary,
  type GitHubResolveResponse,
} from '../../api/client';
import type { SelectedRepo } from '../../stores/github';
import '../agent-panel.css';

/** Everything the configure step needs, in store-ready form. */
export interface RepoEntryTarget {
  selected: SelectedRepo;
  resolution: GitHubResolveResponse | null;
}

interface RepoEntryProps {
  /** GitHub URL captured by a paste anywhere; consumed once on arrival. */
  prefillUrl: string | null;
  /** Target chosen (list row or resolved paste) → workbench attaches it. */
  onTarget: (target: RepoEntryTarget) => void;
  /** "Chat without a repository" — hide the entry for this thread. */
  onSkip: () => void;
}

const PAGE_SIZE = 30;

/** Row-shape → run target (default branch; the configure step edits the ref). */
function targetFromSummary(repo: GitHubRepoSummary): RepoEntryTarget {
  return {
    selected: {
      owner: repo.owner,
      repo: repo.repo,
      ref: repo.defaultBranch,
      visibility: repo.visibility,
      fullName: repo.fullName,
    },
    resolution: null,
  };
}

/** Resolve payload → run target, keeping an explicit ref when the URL had one. */
function targetFromResolution(res: GitHubResolveResponse): RepoEntryTarget {
  const ref = typeof res.ref === 'string' && res.ref !== '' && res.ref !== 'HEAD' ? res.ref : res.defaultBranch;
  return {
    selected: {
      owner: res.owner,
      repo: res.repo,
      ref,
      visibility: res.visibility,
      fullName: res.fullName,
    },
    resolution: res,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'GitHub is unreachable right now.';
}

/** Compact "Oct 12, 2026" for the preview card; empty for missing dates. */
function formatPushed(pushedAt?: string): string {
  if (pushedAt === undefined || pushedAt === '') return '';
  const date = new Date(pushedAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export function RepoEntry({ prefillUrl, onTarget, onSkip }: RepoEntryProps) {
  const pasteId = useId();
  const searchId = useId();

  const [mode, setMode] = useState<'github' | 'paste'>('github');

  // Mode A — the connected account's repositories.
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<{ message: string; code?: string } | null>(null);

  // Mode B — paste + resolve.
  const [pasteUrl, setPasteUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState<GitHubResolveResponse | null>(null);
  const [resolveError, setResolveError] = useState<{ message: string; code?: string } | null>(null);

  const pasteInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (page > 1) setLoadingMore(true);
    listGitHubRepositories({ page, perPage: PAGE_SIZE, visibility }).then(
      res => {
        if (cancelled) return;
        setRepos(prev => (page === 1 ? res.repositories : [...prev, ...res.repositories]));
        setHasNext(res.hasNext);
        setListError(null);
        setLoading(false);
        setLoadingMore(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        const api = err instanceof ApiError ? err : undefined;
        setListError({ message: errorMessage(err), code: api?.code });
        setLoading(false);
        setLoadingMore(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [page, visibility]);

  const parsed = useMemo(() => parseRepoTarget(pasteUrl), [pasteUrl]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return repos;
    return repos.filter(
      repo =>
        repo.fullName.toLowerCase().includes(normalizedQuery) ||
        (repo.description ?? '').toLowerCase().includes(normalizedQuery),
    );
  }, [repos, normalizedQuery]);

  function changeVisibility(next: 'all' | 'public' | 'private'): void {
    setVisibility(next);
    setPage(1);
    setRepos([]);
  }

  async function resolveUrl(url: string): Promise<void> {
    if (resolving) return;
    if (!parseRepoTarget(url).ok) return;
    setResolving(true);
    setResolveError(null);
    try {
      const res = await resolveGitHubRepository(url);
      setResolution(res);
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : undefined;
      setResolution(null);
      setResolveError({ message: errorMessage(err), code: api?.code });
    } finally {
      setResolving(false);
    }
  }

  // Paste prefill (from any composer): open the paste mode prefilled and
  // resolving. Consumed exactly once per URL.
  const prefillHandled = useRef<string | null>(null);
  useEffect(() => {
    if (prefillUrl === null || prefillHandled.current === prefillUrl) return;
    prefillHandled.current = prefillUrl;
    setMode('paste');
    setPasteUrl(prefillUrl);
    void resolveUrl(prefillUrl);
  }, [prefillUrl]);

  // Programmatic focus only (no autofocus attribute): the paste input wins
  // when a prefill arrived — it mounts one render after the mode switch, so
  // focusing rides this effect rather than the prefill handler.
  useEffect(() => {
    if (mode === 'paste' && prefillUrl !== null) pasteInputRef.current?.focus();
  }, [mode, prefillUrl]);

  useEffect(() => {
    if (prefillUrl === null && mode === 'github') searchInputRef.current?.focus();
  }, [prefillUrl, mode]);

  let listBody: ReactNode;
  if (listError !== null && listError.code === 'auth-required') {
    listBody = (
      <>
        <p className="apx-entry-note">Connect a GitHub account to list your repositories.</p>
        <a className="apx-entry-primary apx-entry-connect" href="#settings">
          Connect GitHub
        </a>
      </>
    );
  } else if (loading && repos.length === 0) {
    listBody = (
      <p className="apx-entry-note">
        <span className="ap-spinner" aria-hidden={true} /> Loading repositories…
      </p>
    );
  } else if (listError !== null && repos.length === 0) {
    listBody = (
      <>
        <p className="apx-entry-error" role="alert">Could not load repositories: {listError.message}</p>
        <button
          type="button"
          className="apx-entry-secondary"
          onClick={() => {
            setPage(1);
            setRepos([]);
            setLoading(true);
          }}
        >
          Retry
        </button>
      </>
    );
  } else if (filtered.length === 0) {
    listBody = (
      <p className="apx-entry-note">
        {normalizedQuery === ''
          ? 'No repositories found for this filter.'
          : `No repositories match “${query.trim()}”.`}
      </p>
    );
  } else {
    listBody = (
      <>
        <ul className="apx-repo-list" aria-label="Your GitHub repositories">
          {filtered.map(repo => (
            <li key={repo.fullName}>
              <button type="button" className="apx-repo-item" onClick={() => onTarget(targetFromSummary(repo))}>
                <span className="apx-repo-item-name">
                  <span className="apx-repo-item-fullname">{repo.fullName}</span>
                  <span className={`apx-badge apx-badge--${repo.private ? 'private' : 'public'}`}>
                    {repo.private ? 'Private' : 'Public'}
                  </span>
                </span>
                {repo.description !== undefined && repo.description !== '' && (
                  <span className="apx-repo-item-desc">{repo.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {hasNext && (
          <button
            type="button"
            className="apx-entry-more"
            disabled={loadingMore}
            onClick={() => setPage(prev => prev + 1)}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    );
  }

  return (
    <div className="apx-entry" role="dialog" aria-modal="true" aria-label="Select a repository">
      <div className="apx-entry-card">
        <header className="apx-entry-header">
          <h2 className="apx-entry-title">Select a repository</h2>
          <p className="apx-entry-subtitle">
            Select a repository or paste a repository URL — it attaches to this conversation as the run target.
          </p>
        </header>

        <div className="apx-entry-modes" role="group" aria-label="Repository source">
          <button
            type="button"
            className="apx-entry-mode"
            aria-pressed={mode === 'github'}
            onClick={() => setMode('github')}
          >
            From your GitHub
          </button>
          <button
            type="button"
            className="apx-entry-mode"
            aria-pressed={mode === 'paste'}
            onClick={() => {
              setMode('paste');
              pasteInputRef.current?.focus();
            }}
          >
            Paste repository URL
          </button>
        </div>

        {mode === 'github' ? (
          <div className="apx-entry-list">
            <div className="apx-entry-toolbar">
              <input
                ref={searchInputRef}
                id={searchId}
                className="apx-entry-search"
                type="search"
                value={query}
                spellCheck={false}
                autoComplete="off"
                placeholder="Search owner/repo or description"
                aria-label="Search your repositories"
                onChange={event => setQuery(event.target.value)}
              />
              <div className="apx-entry-visibility" role="group" aria-label="Visibility filter">
                {(['all', 'public', 'private'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={visibility === option}
                    onClick={() => changeVisibility(option)}
                  >
                    {option === 'all' ? 'All' : option === 'public' ? 'Public' : 'Private'}
                  </button>
                ))}
              </div>
            </div>
            {listError !== null && repos.length > 0 && (
              <p className="apx-entry-error" role="alert">Could not load more: {listError.message}</p>
            )}
            {listBody}
          </div>
        ) : (
          <form
            className="apx-entry-paste"
            onSubmit={event => {
              event.preventDefault();
              void resolveUrl(pasteUrl);
            }}
          >
            <label className="apx-entry-label" htmlFor={pasteId}>Repository URL</label>
            <div className="apx-entry-paste-row">
              <input
                ref={pasteInputRef}
                id={pasteId}
                className="apx-entry-input"
                type="url"
                value={pasteUrl}
                spellCheck={false}
                autoComplete="off"
                placeholder="https://github.com/owner/repo"
                aria-describedby={`${pasteId}-feedback`}
                onChange={event => {
                  setPasteUrl(event.target.value);
                  setResolution(null);
                  setResolveError(null);
                }}
                onBlur={() => {
                  if (parsed.ok) void resolveUrl(pasteUrl);
                }}
              />
              <button type="submit" className="apx-entry-secondary" disabled={!parsed.ok || resolving}>
                {resolving ? 'Resolving…' : 'Resolve'}
              </button>
            </div>
            {pasteUrl.trim() !== '' && !parsed.ok && (
              <p className="apx-entry-error" id={`${pasteId}-feedback`} role="alert">{parsed.message}</p>
            )}
            {parsed.ok && resolution === null && !resolving && resolveError === null && (
              <p className="apx-entry-note" id={`${pasteId}-feedback`}>
                Scope: <code>{parsed.value.canonical}</code>
                {parsed.value.ref === 'HEAD' ? ' (default branch, resolved automatically)' : ''}
              </p>
            )}
            {resolving && (
              <p className="apx-entry-note" id={`${pasteId}-feedback`}>
                <span className="ap-spinner" aria-hidden={true} /> Resolving repository…
              </p>
            )}
            {resolveError !== null && (
              <div className="apx-entry-error-group" role="alert">
                <p className="apx-entry-error">{resolveError.message}</p>
                {resolveError.code === 'repo-not-found-or-private' && (
                  <p className="apx-entry-hint">
                    The repository is private or was not found with anonymous access.{' '}
                    <a href="#settings">Connect GitHub</a> to reach private repositories.
                  </p>
                )}
              </div>
            )}
            {resolution !== null && (
              <div className="apx-repo-preview">
                <p className="apx-repo-preview-title">
                  <code>{resolution.fullName}</code>
                  <span className={`apx-badge apx-badge--${resolution.private ? 'private' : 'public'}`}>
                    {resolution.private ? 'Private' : 'Public'}
                  </span>
                  {resolution.accessible === 'anonymous' && (
                    <span className="apx-badge">anonymous</span>
                  )}
                </p>
                <p className="apx-repo-preview-meta">
                  Default branch {resolution.defaultBranch}
                  {resolution.ref !== '' && resolution.ref !== 'HEAD' ? ` · ref ${resolution.ref}` : ''}
                  {formatPushed(resolution.pushedAt) !== '' ? ` · pushed ${formatPushed(resolution.pushedAt)}` : ''}
                </p>
                <button
                  type="button"
                  className="apx-entry-primary"
                  onClick={() => onTarget(targetFromResolution(resolution))}
                >
                  Configure run
                </button>
              </div>
            )}
          </form>
        )}

        <footer className="apx-entry-footer">
          <button type="button" className="apx-entry-skip" onClick={onSkip}>
            Chat without a repository
          </button>
        </footer>
      </div>
    </div>
  );
}
