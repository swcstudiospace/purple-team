import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ApiError,
  completeGitHubConnect,
  getJson,
  listGitHubRepositories,
  resolveGitHubRepository,
  type GitHubRepoSummary,
  type GitHubResolveResponse,
  type GitHubStatus,
  type GitHubStartResponse,
  type GitHubActionResult,
  type GitHubVisibility,
} from '../api/client';
import { useSelectedRepo, type SelectedRepo } from '../stores/github';
import './github.css';

/** Server pending-flow TTL (src/github FLOW_TTL_MS precedent) — 15 minutes. */
const FLOW_TTL_MS = 15 * 60 * 1000;

type Resource<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

type Settled<T> = { runId: number; result: Exclude<Resource<T>, { status: 'loading' }> };

/**
 * Fetches one GET route, tagged with the run that produced it: a Refresh (new
 * runId) reads as loading until its own request settles, and stale responses
 * are dropped. Copy of the Overview pattern (Overview.tsx is module-local and
 * not to be modified).
 */
function useResource<T>(path: string, runId: number): Resource<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<T>(path).then(
      data => {
        if (!cancelled) setSettled({ runId, result: { status: 'ready', data } });
      },
      (err: unknown) => {
        if (!cancelled) {
          setSettled({
            runId,
            result: { status: 'error', message: errorMessage(err) },
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, runId]);

  return settled !== null && settled.runId === runId ? settled.result : { status: 'loading' };
}

/** Ticking clock, re-rendered every second while `active` (countdowns). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function formatTime(value: number | string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

/** m:ss remaining (consent TTL) — padded, so the digits do not jump. */
function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

type FlowState =
  | { kind: 'idle' }
  | { kind: 'pending'; startedAt: number; authorizeUrl: string }
  | { kind: 'denied' };

/** The eight account-card states of the §5.6 matrix, plus the initial load. */
type AccountView =
  | 'loading'
  | 'not-configured'
  | 'signed-out'
  | 'consent-pending'
  | 'consent-denied'
  | 'connected'
  | 'token-expired'
  | 'network-error'
  | 'disconnected';

function deriveAccountView(
  status: Resource<GitHubStatus>,
  flow: FlowState,
  authBroken: boolean,
): AccountView {
  if (status.status === 'loading') return 'loading';
  if (status.status === 'error') return 'network-error';
  if (authBroken) return 'token-expired';
  const data = status.data;
  if (!data.configured) return 'not-configured';
  // A pending/denied flow only wins while the account is still signed out;
  // once the callback or paste path lands, `connected` takes over.
  if (flow.kind === 'pending' && !data.connected) return 'consent-pending';
  if (flow.kind === 'denied' && !data.connected) return 'consent-denied';
  if (data.connected) return 'connected';
  return 'signed-out';
}

type ResolveState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: GitHubResolveResponse }
  | { kind: 'error'; code?: string; message: string; retryAt?: number };

function Badge({ tone, children }: { tone: 'on' | 'off'; children: ReactNode }) {
  return <span className={`github-badge github-badge--${tone}`}>{children}</span>;
}

function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'error' | 'neutral'; children: ReactNode }) {
  return <span className={`github-chip github-chip--${tone}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="github-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CardSkeleton({ title }: { title: string }) {
  return (
    <>
      <span className="github-sr-only">Loading {title}</span>
      <div className="github-skeleton" aria-hidden="true">
        <span className="github-skeleton__line" />
        <span className="github-skeleton__line github-skeleton__line--short" />
      </div>
    </>
  );
}

function visibilityBadge(visibility: GitHubVisibility): ReactNode {
  if (visibility === 'public') return <Badge tone="on">public</Badge>;
  return <Badge tone="off">{visibility}</Badge>;
}

interface AccountCardProps {
  view: AccountView;
  status: Resource<GitHubStatus>;
  flow: FlowState;
  now: number;
  busy: boolean;
  notice: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onFlowReset: () => void;
  onRefresh: () => void;
  onPasteComplete: (code: string) => Promise<void>;
  pasteBusy: boolean;
  pasteError: string | null;
}

function AccountCard({
  view,
  status,
  flow,
  now,
  busy,
  notice,
  onConnect,
  onDisconnect,
  onFlowReset,
  onRefresh,
  onPasteComplete,
  pasteBusy,
  pasteError,
}: AccountCardProps) {
  const headingId = useId();
  const pasteInputId = useId();
  const [pasteValue, setPasteValue] = useState('');
  const [copied, setCopied] = useState(false);
  const data = status.status === 'ready' ? status.data : null;

  const submitPaste = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = pasteValue.trim();
    if (!value || pasteBusy) return;
    void onPasteComplete(value);
  };

  const copyRedirectUri = async () => {
    const uri = data?.redirectUri;
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  let body: ReactNode;
  if (view === 'loading') {
    body = <CardSkeleton title="GitHub account" />;
  } else if (view === 'network-error') {
    body = (
      <>
        <p className="github-card__error" role="alert">
          Could not load GitHub status: {status.status === 'error' ? status.message : 'Unexpected error'}
        </p>
        <div>
          <button type="button" className="github-btn" onClick={onRefresh}>
            Retry
          </button>
        </div>
      </>
    );
  } else if (view === 'not-configured') {
    body = (
      <div className="github-setup">
        <p className="github-hint">
          GitHub OAuth is not configured. Register a user-owned OAuth App to connect an account —
          until then, public repositories can still be resolved by URL anonymously.
        </p>
        {data?.redirectUri && (
          <div className="github-setup__redirect">
            <span className="github-sr-only" id={`${headingId}-redirect-label`}>
              Callback URL to register
            </span>
            <code className="github-setup__url" aria-labelledby={`${headingId}-redirect-label`}>
              {data.redirectUri}
            </code>
            <button type="button" className="github-btn github-btn--sm" onClick={() => void copyRedirectUri()}>
              Copy
            </button>
            <span role="status">{copied ? 'Copied.' : ''}</span>
          </div>
        )}
        <p className="github-hint">
          Set <code className="github-mono">T3MP3ST_GITHUB_OAUTH_CLIENT_ID</code> and{' '}
          <code className="github-mono">T3MP3ST_GITHUB_OAUTH_CLIENT_SECRET</code>, then register the
          callback URL above at{' '}
          <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer">
            github.com/settings/developers
          </a>
          .
        </p>
      </div>
    );
  } else if (view === 'connected') {
    const login = data?.login ?? 'unknown';
    body = (
      <>
        <div className="github-account">
          {data?.avatarUrl ? (
            <img className="github-account__avatar" src={data.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="github-account__avatar github-account__avatar--placeholder" aria-hidden="true">
              GH
            </span>
          )}
          <div className="github-account__identity">
            <span className="github-account__handle">@{login}</span>
            <span className="github-account__meta">
              {data?.scopes && data.scopes.length > 0 ? data.scopes.join(' · ') : 'scopes unknown'}
            </span>
          </div>
          <div className="github-account__actions">
            <Badge tone="on">connected</Badge>
            <button type="button" className="github-btn github-btn--danger" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </button>
          </div>
        </div>
        {data?.expiresAt !== undefined && (
          <dl className="github-fields">
            <Field label="Session expires">
              <span className="github-mono">{formatTime(data.expiresAt)}</span>
            </Field>
          </dl>
        )}
      </>
    );
  } else if (view === 'token-expired') {
    body = (
      <>
        <p className="github-card__error" role="alert">
          Session expired — reconnect to continue.
        </p>
        <div>
          <button type="button" className="github-btn github-btn--primary" onClick={onConnect} disabled={busy}>
            Reconnect
          </button>
        </div>
      </>
    );
  } else if (view === 'consent-pending') {
    const startedAt = flow.kind === 'pending' ? flow.startedAt : Date.now();
    const authorizeUrl = flow.kind === 'pending' ? flow.authorizeUrl : '';
    const msLeft = startedAt + FLOW_TTL_MS - now;
    body = (
      <>
        <p className="github-hint">
          {msLeft > 0
            ? 'Complete the sign-in in the GitHub tab.'
            : 'Sign-in link expired — start again.'}
        </p>
        <p className="github-hint">
          <span className="github-sr-only">Time left: </span>
          <span className="github-countdown">
            {msLeft > 0 ? formatCountdown(msLeft) : '0:00'}
          </span>{' '}
          ·{' '}
          <a href={authorizeUrl} target="_blank" rel="noreferrer">
            Reopen the authorization tab
          </a>{' '}
          ·{' '}
          <button type="button" className="github-btn github-btn--sm" onClick={onFlowReset}>
            Connection cancelled
          </button>
        </p>
        <form className="github-form" onSubmit={submitPaste}>
          <label className="github-label" htmlFor={pasteInputId}>
            Paste fallback — the code from the callback URL, or the whole URL
          </label>
          <div className="github-form__row">
            <input
              id={pasteInputId}
              className="github-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="gho_… or https://…/api/oauth/github/callback?code=…"
              value={pasteValue}
              onChange={event => setPasteValue(event.target.value)}
              disabled={pasteBusy}
            />
            <button type="submit" className="github-btn" disabled={pasteBusy || !pasteValue.trim()}>
              {pasteBusy ? 'Completing…' : 'Complete sign-in'}
            </button>
          </div>
          {pasteError && (
            <p className="github-field-error" role="alert">
              {pasteError}
            </p>
          )}
        </form>
      </>
    );
  } else if (view === 'consent-denied') {
    body = (
      <>
        <p className="github-hint">Connection cancelled — GitHub reported the request as denied.</p>
        <div>
          <button type="button" className="github-btn github-btn--primary" onClick={onConnect} disabled={busy}>
            Retry connect
          </button>
        </div>
      </>
    );
  } else {
    // signed-out | disconnected — the matrix renders these identically apart
    // from a transient note after a successful disconnect.
    body = (
      <>
        {view === 'disconnected' && (
          <p className="github-hint" role="status">
            Disconnected.
          </p>
        )}
        <div className="github-account">
          <div className="github-account__identity">
            <span className="github-account__handle">Not connected</span>
            <span className="github-account__meta">Anonymous — public repositories only</span>
          </div>
          <div className="github-account__actions">
            <Badge tone="off">anonymous</Badge>
            <button type="button" className="github-btn github-btn--primary" onClick={onConnect} disabled={busy}>
              Connect GitHub account
            </button>
          </div>
        </div>
        <p className="github-scope-warning">
          The <code className="github-mono">repo</code> scope grants read <strong>and write</strong>{' '}
          access to all repositories you can access, plus{' '}
          <code className="github-mono">read:user</code> for your profile. Disconnect revokes the
          whole grant.
        </p>
      </>
    );
  }

  return (
    <section className="github-card" aria-labelledby={headingId} aria-busy={view === 'loading'}>
      <h2 id={headingId} className="github-card__title">
        GitHub account
      </h2>
      {notice && (
        <p className="github-hint" role="status">
          {notice}
        </p>
      )}
      {body}
    </section>
  );
}

interface ResolveCardProps {
  connected: boolean;
  rateLimited: boolean;
  retryAt: number | null;
  onResolve: (url: string) => Promise<void>;
  onConnect: () => void;
  resolveState: ResolveState;
  selected: SelectedRepo | null;
  onSelect: (repo: SelectedRepo) => void;
  onClearSelection: () => void;
}

function ResolveCard({
  connected,
  rateLimited,
  retryAt,
  onResolve,
  onConnect,
  resolveState,
  selected,
  onSelect,
  onClearSelection,
}: ResolveCardProps) {
  const headingId = useId();
  const inputId = useId();
  const refInputId = useId();
  const [urlValue, setUrlValue] = useState('');
  const [refValue, setRefValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const success = resolveState.kind === 'success' ? resolveState.data : null;
  const isSelected =
    success !== null && selected !== null && selected.owner === success.owner && selected.repo === success.repo;

  // Prefill the ref input with the resolved ref on every new success.
  useEffect(() => {
    if (success !== null) setRefValue(success.ref);
  }, [success]);

  // §5.6: an invalid-url error re-focuses the input.
  useEffect(() => {
    if (resolveState.kind === 'error' && resolveState.code === 'invalid-url') {
      inputRef.current?.focus();
    }
  }, [resolveState]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (resolveState.kind === 'loading' || rateLimited) return;
    void onResolve(urlValue);
  };

  let statusArea: ReactNode;
  if (resolveState.kind === 'idle') {
    statusArea = <Chip tone="neutral">idle</Chip>;
  } else if (resolveState.kind === 'loading') {
    statusArea = <Chip tone="neutral">resolving…</Chip>;
  } else if (resolveState.kind === 'success') {
    statusArea = (
      <Chip tone="ok">
        resolved · {resolveState.data.accessible === 'token' ? 'via account' : 'anonymous'}
      </Chip>
    );
  } else {
    const { code } = resolveState;
    if (code === 'rate-limited') {
      statusArea = <Chip tone="warn">rate limited</Chip>;
    } else if (code === 'invalid-url') {
      statusArea = <Chip tone="error">invalid URL</Chip>;
    } else if (code === 'token-expired') {
      statusArea = <Chip tone="error">session expired</Chip>;
    } else if (code === 'repo-not-found-or-private') {
      statusArea = <Chip tone="warn">not found — private?</Chip>;
    } else if (code === 'repo-not-found') {
      statusArea = <Chip tone="error">not found</Chip>;
    } else {
      statusArea = <Chip tone="error">error</Chip>;
    }
  }

  return (
    <section className="github-card" aria-labelledby={headingId}>
      <h2 id={headingId} className="github-card__title">
        Connect by URL
      </h2>
      <form className="github-form" onSubmit={submit}>
        <label className="github-label" htmlFor={inputId}>
          GitHub repository URL, or owner/repo
        </label>
        <div className="github-form__row">
          <input
            id={inputId}
            ref={inputRef}
            className="github-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://github.com/owner/repo"
            value={urlValue}
            onChange={event => setUrlValue(event.target.value)}
            disabled={resolveState.kind === 'loading'}
            aria-describedby={`${headingId}-status`}
          />
          <button
            type="submit"
            className="github-btn github-btn--primary"
            disabled={resolveState.kind === 'loading' || rateLimited || !urlValue.trim()}
          >
            {resolveState.kind === 'loading' ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
        <div id={`${headingId}-status`} role="status" aria-live="polite">
          {statusArea}
        </div>
      </form>

      {resolveState.kind === 'error' && (
        <div>
          {resolveState.code === 'invalid-url' && (
            <p className="github-field-error" role="alert">
              {resolveState.message} — expected github.com/owner/repo, owner/repo, or a /tree/&lt;ref&gt;
              URL.
            </p>
          )}
          {resolveState.code === 'repo-not-found' && (
            <p className="github-card__error" role="alert">
              Repository not found (or your account has no access).
            </p>
          )}
          {resolveState.code === 'repo-not-found-or-private' && (
            <>
              <p className="github-card__error" role="alert">
                {resolveState.message}
              </p>
              {!connected && (
                <p className="github-hint">
                  <button type="button" className="github-btn github-btn--sm" onClick={onConnect}>
                    Connect a GitHub account
                  </button>{' '}
                  to reach private repositories.
                </p>
              )}
            </>
          )}
          {resolveState.code === 'rate-limited' && retryAt !== null && (
            <p className="github-hint">
              Rate limited — retry at <span className="github-mono">{formatTime(retryAt)}</span>{' '}
              (anonymous requests are capped; a connected account gets 5,000/hour).
            </p>
          )}
          {resolveState.code === 'token-expired' && (
            <p className="github-hint">Session expired — reconnect from the account card above.</p>
          )}
          {!resolveState.code && (
            <p className="github-card__error" role="alert">
              {resolveState.message}
            </p>
          )}
        </div>
      )}

      {success !== null && (
        <div className="github-resolved">
          <div className="github-resolved__head">
            <a
              className="github-resolved__name"
              href={success.htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              {success.fullName}
            </a>
            {visibilityBadge(success.visibility)}
            {isSelected && <Chip tone="ok">selected for next run</Chip>}
          </div>
          {success.pushedAt && (
            <p className="github-resolved__meta">Last push {formatTime(success.pushedAt)}</p>
          )}
          <div className="github-form__row">
            <label className="github-label" htmlFor={refInputId}>
              Ref (branch, tag, or commit)
            </label>
            <input
              id={refInputId}
              className="github-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={refValue}
              onChange={event => setRefValue(event.target.value)}
            />
            <button
              type="button"
              className="github-btn github-btn--primary"
              onClick={() =>
                onSelect({
                  owner: success.owner,
                  repo: success.repo,
                  ref: refValue.trim() || success.ref,
                  visibility: success.visibility,
                  fullName: success.fullName,
                })
              }
            >
              Use in Purple Team run
            </button>
            {isSelected && (
              <button type="button" className="github-btn github-btn--sm" onClick={onClearSelection}>
                Clear
              </button>
            )}
          </div>
          <p className="github-hint">
            Defaults to <code className="github-mono">{success.ref}</code>
            {success.ref !== success.defaultBranch && <> (branch {success.defaultBranch} is default)</>}.
          </p>
        </div>
      )}

      {resolveState.kind === 'idle' && (
        <p className="github-card__empty">
          Paste a GitHub URL or connect to browse. Public repositories resolve without an account.
        </p>
      )}
    </section>
  );
}

interface RepositoriesCardProps {
  enabled: boolean;
  configured: boolean;
  authBroken: boolean;
  statusLoading: boolean;
  onConnect: () => void;
  onTokenExpired: () => void;
  onRateLimited: (retryAt: number) => void;
  rateLimited: boolean;
  retryAt: number | null;
  selected: SelectedRepo | null;
  onSelect: (repo: SelectedRepo) => void;
  onClearSelection: () => void;
}

function RepositoriesCard({
  enabled,
  configured,
  authBroken,
  statusLoading,
  onConnect,
  onTokenExpired,
  onRateLimited,
  rateLimited,
  retryAt,
  selected,
  onSelect,
  onClearSelection,
}: RepositoriesCardProps) {
  const headingId = useId();
  const searchId = useId();
  const visibilityId = useId();
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [runId, setRunId] = useState(0);
  const [loaded, setLoaded] = useState<GitHubRepoSummary[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    if (page > 1) setLoadingMore(true);
    listGitHubRepositories({ page, perPage: 30, visibility }).then(
      res => {
        if (cancelled) return;
        setLoaded(prev => (page === 1 ? res.repositories : [...prev, ...res.repositories]));
        setHasNext(res.hasNext);
        setError(null);
        setLoading(false);
        setLoadingMore(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        const api = err instanceof ApiError ? err : undefined;
        if (api?.code === 'token-expired') onTokenExpired();
        if (api?.retryAt !== undefined) onRateLimited(api.retryAt);
        setError({ message: errorMessage(err), code: api?.code });
        setLoading(false);
        setLoadingMore(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, page, visibility, runId, onTokenExpired, onRateLimited]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return loaded;
    return loaded.filter(
      repo =>
        repo.fullName.toLowerCase().includes(normalizedQuery) ||
        (repo.description ?? '').toLowerCase().includes(normalizedQuery),
    );
  }, [loaded, normalizedQuery]);

  const changeVisibility = (next: 'all' | 'public' | 'private') => {
    setVisibility(next);
    setPage(1);
    setLoaded([]);
  };

  const retry = () => {
    setPage(1);
    setLoaded([]);
    setRunId(n => n + 1);
  };

  let body: ReactNode;
  if (statusLoading) {
    body = <CardSkeleton title="Repositories" />;
  } else if (!enabled) {
    body = authBroken ? (
      <p className="github-card__empty">Session expired — reconnect above to list repositories.</p>
    ) : configured ? (
      <>
        <p className="github-card__empty">Connect a GitHub account to list repositories.</p>
        <div>
          <button type="button" className="github-btn github-btn--primary" onClick={onConnect}>
            Connect GitHub account
          </button>
        </div>
      </>
    ) : (
      <p className="github-card__empty">
        Repository browsing needs a connected account. Set up GitHub OAuth above, or resolve a public
        repository by URL.
      </p>
    );
  } else if (error !== null && error.code === 'auth-required') {
    body = (
      <>
        <p className="github-card__empty">Connect a GitHub account to list repositories.</p>
        <div>
          <button type="button" className="github-btn github-btn--primary" onClick={onConnect}>
            Connect GitHub account
          </button>
        </div>
      </>
    );
  } else if (error !== null && loaded.length === 0) {
    body = (
      <>
        <p className="github-card__error" role="alert">
          Could not load repositories: {error.code === 'rate-limited' ? 'rate limited — ' : ''}
          {error.message}
        </p>
        {error.code === 'rate-limited' && retryAt !== null && (
          <p className="github-hint">
            Retry at <span className="github-mono">{formatTime(retryAt)}</span>.
          </p>
        )}
        {error.code !== 'rate-limited' && (
          <div>
            <button type="button" className="github-btn" onClick={retry}>
              Retry
            </button>
          </div>
        )}
      </>
    );
  } else if (loading && loaded.length === 0) {
    body = <CardSkeleton title="Repositories" />;
  } else if (loaded.length === 0) {
    body = (
      <p className="github-card__empty">
        No repositories {visibility === 'all' ? '' : `marked ${visibility} `}
        found for your account.
      </p>
    );
  } else if (filtered.length === 0) {
    body = <p className="github-card__empty">No repositories match “{query.trim()}”.</p>;
  } else {
    body = (
      <>
        <ul className="github-list">
          {filtered.map(repo => {
            const isSelected =
              selected !== null && selected.owner === repo.owner && selected.repo === repo.repo;
            return (
              <li className="github-list__item" key={repo.fullName}>
                <div className="github-list__main">
                  <a className="github-list__name" href={repo.htmlUrl} target="_blank" rel="noreferrer">
                    {repo.fullName}
                  </a>
                  {repo.description && <span className="github-list__desc">{repo.description}</span>}
                  <span className="github-list__meta">
                    {visibilityBadge(repo.visibility)} · default{' '}
                    <code className="github-mono">{repo.defaultBranch}</code>
                    {repo.pushedAt && <> · pushed {formatTime(repo.pushedAt)}</>}
                  </span>
                </div>
                <div className="github-list__actions">
                  {isSelected ? (
                    <>
                      <span className="github-selected-note">Selected</span>
                      <button type="button" className="github-btn github-btn--sm" onClick={onClearSelection}>
                        Clear
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="github-btn github-btn--sm"
                      onClick={() =>
                        onSelect({
                          owner: repo.owner,
                          repo: repo.repo,
                          ref: repo.defaultBranch,
                          visibility: repo.visibility,
                          fullName: repo.fullName,
                        })
                      }
                    >
                      Select
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="github-repos__footer">
          {hasNext ? (
            <button
              type="button"
              className="github-btn"
              onClick={() => setPage(p => p + 1)}
              disabled={loadingMore || rateLimited}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : (
            <span className="github-hint">End of list</span>
          )}
          {error !== null && loaded.length > 0 && !loadingMore && (
            <p className="github-card__error" role="alert">
              Could not load more: {error.message}
            </p>
          )}
          <span className="github-hint" aria-live="polite">
            {loadingMore ? `Loading page ${page + 1}…` : `${filtered.length} shown`}
          </span>
        </div>
      </>
    );
  }

  return (
    <section className="github-card" aria-labelledby={headingId} aria-busy={loading && enabled}>
      <h2 id={headingId} className="github-card__title">
        Repositories
      </h2>
      {enabled && (
        <div className="github-repos__toolbar">
          <label className="github-sr-only" htmlFor={searchId}>
            Search repositories
          </label>
          <input
            id={searchId}
            className="github-input"
            type="search"
            placeholder="Search loaded repositories…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <label className="github-sr-only" htmlFor={visibilityId}>
            Filter by visibility
          </label>
          <select
            id={visibilityId}
            className="github-select"
            value={visibility}
            onChange={event => changeVisibility(event.target.value as 'all' | 'public' | 'private')}
          >
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
      )}
      {body}
    </section>
  );
}

export default function GitHub() {
  const [statusRunId, setStatusRunId] = useState(0);
  const status = useResource<GitHubStatus>('/api/oauth/github/status', statusRunId);
  const [flow, setFlow] = useState<FlowState>({ kind: 'idle' });
  const [authBroken, setAuthBroken] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolveState, setResolveState] = useState<ResolveState>({ kind: 'idle' });
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const { selected, select, clear } = useSelectedRepo();

  const connected = status.status === 'ready' && status.data.connected;
  const rateLimited = retryAt !== null && retryAt > Date.now();
  const now = useNow(flow.kind === 'pending' || rateLimited);

  const refreshStatus = useCallback(() => setStatusRunId(n => n + 1), []);

  // Stable identity: the repositories effect depends on this callback.
  const handleTokenExpired = useCallback(() => setAuthBroken(true), []);

  // Clear a stale rate-limit marker once it has passed.
  useEffect(() => {
    if (retryAt !== null && retryAt <= now) setRetryAt(null);
  }, [retryAt, now]);

  const connect = useCallback(async () => {
    setConnectBusy(true);
    setNotice(null);
    setPasteError(null);
    setDisconnected(false);
    try {
      const start = await getJson<GitHubStartResponse>('/api/oauth/github/start');
      window.open(start.authorizeUrl, '_blank', 'noopener,noreferrer');
      setFlow({ kind: 'pending', startedAt: Date.now(), authorizeUrl: start.authorizeUrl });
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setConnectBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setDisconnectBusy(true);
    setNotice(null);
    try {
      await getJson<GitHubActionResult>('/api/oauth/github/logout', { method: 'POST' });
      setDisconnected(true);
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setDisconnectBusy(false);
      setAuthBroken(false);
      setFlow({ kind: 'idle' });
      refreshStatus();
    }
  }, [refreshStatus]);

  const pasteComplete = useCallback(
    async (code: string) => {
      setPasteBusy(true);
      setPasteError(null);
      setNotice(null);
      try {
        await completeGitHubConnect(code);
        setFlow({ kind: 'idle' });
        setAuthBroken(false);
        setDisconnected(false);
        refreshStatus();
      } catch (err) {
        const message = errorMessage(err);
        if (/denied|cancel/i.test(message)) {
          setFlow({ kind: 'denied' });
        } else {
          setPasteError(message);
        }
      } finally {
        setPasteBusy(false);
      }
    },
    [refreshStatus],
  );

  const resolve = useCallback(
    async (url: string) => {
      const value = url.trim();
      if (!value) {
        setResolveState({
          kind: 'error',
          code: 'invalid-url',
          message: 'Enter a GitHub repository URL.',
        });
        return;
      }
      setResolveState({ kind: 'loading' });
      try {
        const data = await resolveGitHubRepository(value);
        setResolveState({ kind: 'success', data });
      } catch (err) {
        const api = err instanceof ApiError ? err : undefined;
        if (api?.code === 'token-expired') setAuthBroken(true);
        if (api?.retryAt !== undefined) setRetryAt(api.retryAt);
        setResolveState({
          kind: 'error',
          code: api?.code,
          message: errorMessage(err),
          retryAt: api?.retryAt,
        });
      }
    },
    [],
  );

  const view = deriveAccountView(status, flow, authBroken);
  const shownView: AccountView = view === 'signed-out' && disconnected ? 'disconnected' : view;

  return (
    <div className="github">
      <AccountCard
        view={shownView}
        status={status}
        flow={flow}
        now={now}
        busy={connectBusy || disconnectBusy}
        notice={notice}
        onConnect={() => void connect()}
        onDisconnect={() => void disconnect()}
        onFlowReset={() => setFlow({ kind: 'denied' })}
        onRefresh={refreshStatus}
        onPasteComplete={pasteComplete}
        pasteBusy={pasteBusy}
        pasteError={pasteError}
      />
      <ResolveCard
        connected={connected}
        rateLimited={rateLimited}
        retryAt={retryAt}
        onResolve={resolve}
        onConnect={() => void connect()}
        resolveState={resolveState}
        selected={selected}
        onSelect={select}
        onClearSelection={clear}
      />
      <RepositoriesCard
        enabled={
          status.status === 'ready' && status.data.configured && status.data.connected && !authBroken
        }
        configured={status.status === 'ready' && status.data.configured}
        authBroken={authBroken}
        statusLoading={status.status === 'loading'}
        onConnect={() => void connect()}
        onTokenExpired={handleTokenExpired}
        onRateLimited={setRetryAt}
        rateLimited={rateLimited}
        retryAt={retryAt}
        selected={selected}
        onSelect={select}
        onClearSelection={clear}
      />
    </div>
  );
}
