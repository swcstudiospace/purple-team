import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ApiError,
  completePkceOAuth,
  connectGitHubPat,
  fetchProviderModels,
  getJson,
  postJson,
  logoutGitHubDevice,
  logoutVendorOAuth,
  pollGitHubDeviceFlow,
  pollXaiOAuth,
  startGitHubDeviceFlow,
  startPkceOAuth,
  startXaiOAuth,
  type GitHubDeviceStatus,
  type GitHubStartResponse,
  type GitHubStatus,
  type LlmStatusResponse,
  type ModelsResponse,
  type OAuthStatus,
  type OAuthStatusResponse,
  type OAuthVendor,
} from '../api/client';
import './settings.css';

/**
 * Device-code polls are clamped to >= 2s — docs/settings.html clamps its
 * SuperGrok poll the same way, so a bad `interval` cannot hot-loop the API.
 */
const MIN_POLL_MS = 2000;

/** Shared with docs/settings.html so both UIs see the same provider config. */
const STATE_STORAGE_KEY = 't3mp3st_state_v1';

type StoredSettings = Record<string, string>;

const UAC_PROVIDERS: ReadonlyArray<{ id: string; label: string; base: string }> = [
  { id: 'openrouter', label: 'OpenRouter · OpenAI-compatible', base: 'https://openrouter.ai/api/v1' },
  { id: 'venice', label: 'Venice · OpenAI-compatible', base: 'https://api.venice.ai/api/v1' },
  { id: 'openai', label: 'OpenAI · OpenAI-compatible', base: 'https://api.openai.com/v1' },
  { id: 'nanogpt', label: 'NanoGPT · OpenAI-compatible', base: 'https://nano-gpt.com/api/v1' },
  { id: 'novita', label: 'Novita AI · OpenAI-compatible', base: 'https://api.novita.ai/openai/v1' },
  { id: 'zai', label: 'Z.ai (GLM API) · OpenAI-compatible', base: 'https://api.z.ai/api/paas/v4' },
  { id: 'xai', label: 'xAI Grok · SuperGrok OAuth or API key', base: 'https://api.x.ai/v1' },
  { id: 'anthropic', label: 'Claude · Anthropic Messages API', base: 'https://api.anthropic.com' },
];

/** GET /api/llm/options — server default the app actually runs. */
interface LlmProviderOption {
  id: string;
  label: string;
  streamable: boolean;
  connected: boolean;
  models: string[];
  note?: string;
}

interface LlmOptionsResponse {
  active: { provider: string; model: string };
  providers: LlmProviderOption[];
}

/** Connected subscriptions, or a provider the server already has a model list for. */
function selectableLlmProviders(options: LlmOptionsResponse): LlmProviderOption[] {
  return options.providers.filter(
    provider =>
      provider.connected ||
      provider.models.length > 0 ||
      provider.id === options.active.provider,
  );
}

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
    if (!active) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function formatTime(value: number | string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

/** m:ss remaining (device codes / token expiry) — padded, so digits do not jump. */
function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

function readStoredSettings(): StoredSettings {
  try {
    const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
    const parsed = raw === null ? null : (JSON.parse(raw) as { settings?: StoredSettings });
    return parsed?.settings ?? {};
  } catch {
    return {};
  }
}

/** Preserves foreign top-level keys the static pages keep under the same root. */
function writeStoredSettings(settings: StoredSettings): void {
  try {
    const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
    let root: Record<string, unknown> = {};
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object') root = parsed as Record<string, unknown>;
    }
    root.settings = settings;
    window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(root));
  } catch {
    // Storage unavailable — the server-side config still applies.
  }
}

function Badge({ tone, children }: { tone: 'on' | 'off' | 'warn'; children: ReactNode }) {
  return <span className={`settings-badge settings-badge--${tone}`}>{children}</span>;
}

function Chip({ tone, children }: { tone: 'neutral' | 'ok' | 'warn' | 'error'; children: ReactNode }) {
  return <span className={`settings-chip settings-chip--${tone}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CardSkeleton({ title }: { title: string }) {
  return (
    <>
      <span className="settings-sr-only">Loading {title}</span>
      <div className="settings-skeleton" aria-hidden="true">
        <span className="settings-skeleton__line" />
        <span className="settings-skeleton__line settings-skeleton__line--short" />
      </div>
    </>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <button type="button" className="settings-btn settings-btn--sm" onClick={() => void copy()}>
        Copy
      </button>
      <span role="status">{copied ? 'Copied.' : ''}</span>
    </>
  );
}

/** Disclosure row for the developer-facing fallbacks; closed by default. */
function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="settings-collapsible">
      <button
        type="button"
        className="settings-collapsible__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(prev => !prev)}
      >
        {title}
      </button>
      {open && (
        <div id={panelId} className="settings-collapsible__panel">
          {children}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// GitHub account (hero). Device-code flow with a PAT paste fallback; the
// custom-OAuth-app guidance only surfaces when the server has no app
// configured (503 from the PKCE start route — the same signal the GitHub
// page keys its setup card on).
// -----------------------------------------------------------------------------

type DeviceFlow =
  | { kind: 'idle' }
  | { kind: 'pending'; flowId: string; userCode: string; verificationUri: string; expiresAt: number }
  | { kind: 'failed'; message: string };

function GitHubCard() {
  const headingId = useId();
  const patInputId = useId();
  const callbackLabelId = useId();
  const [statusRunId, setStatusRunId] = useState(0);
  const status = useResource<GitHubDeviceStatus>('/api/oauth/github/status', statusRunId);
  const [device, setDevice] = useState<DeviceFlow>({ kind: 'idle' });
  const [startBusy, setStartBusy] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [patValue, setPatValue] = useState('');
  const [patBusy, setPatBusy] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [customApp, setCustomApp] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState(() => `${window.location.origin}/api/oauth/github/callback`);
  const timerRef = useRef<number | null>(null);

  const data = status.status === 'ready' ? status.data : null;
  const connected = data !== null && data.connected;
  const now = useNow(
    device.kind === 'pending' || (data !== null && data.connected && data.expiresAt !== undefined),
  );

  function clearDevicePoll(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Leaving the section abandons the flow: the pending poll dies with it.
  useEffect(() => clearDevicePoll, []);

  function armDevicePoll(flowId: string, intervalSec: number, expiresAt: number): void {
    clearDevicePoll();
    timerRef.current = window.setTimeout(
      () => void pollDeviceFlow(flowId, intervalSec, expiresAt),
      Math.max(MIN_POLL_MS, intervalSec * 1000),
    );
  }

  async function pollDeviceFlow(flowId: string, intervalSec: number, expiresAt: number): Promise<void> {
    if (Date.now() >= expiresAt) {
      setDevice({ kind: 'failed', message: 'The sign-in code expired — start again.' });
      return;
    }
    try {
      const poll = await pollGitHubDeviceFlow(flowId);
      if (poll.status === 'connected') {
        setDevice({ kind: 'idle' });
        setStatusRunId(runId => runId + 1);
        return;
      }
      armDevicePoll(flowId, poll.interval > 0 ? poll.interval : intervalSec, expiresAt);
    } catch (err) {
      const api = err instanceof ApiError ? err : undefined;
      if (api === undefined || api.status === 0) {
        // Transient network failure — keep waiting while the code is live.
        armDevicePoll(flowId, intervalSec, expiresAt);
        return;
      }
      // flow-expired / access-denied and any other terminal route error.
      setDevice({ kind: 'failed', message: api.message });
    }
  }

  async function startDeviceFlow(): Promise<void> {
    clearDevicePoll();
    setStartBusy(true);
    setNotice(null);
    try {
      const start = await startGitHubDeviceFlow();
      const expiresAt = Date.now() + start.expiresIn * 1000;
      setDevice({
        kind: 'pending',
        flowId: start.flowId,
        userCode: start.userCode,
        verificationUri: start.verificationUri,
        expiresAt,
      });
      armDevicePoll(start.flowId, start.interval, expiresAt);
    } catch (err) {
      setDevice({ kind: 'idle' });
      setNotice(errorMessage(err));
    } finally {
      setStartBusy(false);
    }
  }

  async function disconnect(): Promise<void> {
    setDisconnectBusy(true);
    setNotice(null);
    try {
      await logoutGitHubDevice();
      clearDevicePoll();
      setDevice({ kind: 'idle' });
      setNotice('Disconnected.');
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setDisconnectBusy(false);
      setStatusRunId(runId => runId + 1);
    }
  }

  const submitPat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = patValue.trim();
    if (!token || patBusy) return;
    void connectPat(token);
  };

  async function connectPat(token: string): Promise<void> {
    setPatBusy(true);
    setPatError(null);
    setNotice(null);
    try {
      await connectGitHubPat(token);
      setPatValue('');
      setNotice('Connected with a personal access token.');
      setStatusRunId(runId => runId + 1);
    } catch (err) {
      setPatError(errorMessage(err));
    } finally {
      setPatBusy(false);
    }
  }

  useEffect(() => {
    if (status.status !== 'ready' || status.data.connected) return undefined;
    let cancelled = false;
    getJson<GitHubStartResponse>('/api/oauth/github/start').then(
      () => undefined,
      (err: unknown) => {
        if (cancelled || !(err instanceof ApiError) || err.status !== 503) return;
        setCustomApp(true);
        // The canonical callback URL comes from the legacy status projection
        // (env-override aware); the browsing origin is already the fallback.
        getJson<GitHubStatus>('/api/oauth/github/status').then(
          legacy => {
            if (!cancelled && legacy.redirectUri !== undefined) setCallbackUrl(legacy.redirectUri);
          },
          () => undefined,
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [status]);

  let body: ReactNode;
  if (status.status === 'loading') {
    body = <CardSkeleton title="GitHub account" />;
  } else if (status.status === 'error') {
    body = (
      <>
        <p className="settings-card__error" role="alert">
          Could not load GitHub status: {status.message}
        </p>
        <div>
          <button type="button" className="settings-btn" onClick={() => setStatusRunId(n => n + 1)}>
            Retry
          </button>
        </div>
      </>
    );
  } else if (connected) {
    const login = data?.login ?? 'unknown';
    const expiresAt = data?.expiresAt;
    const grantExpiresAt = data?.refreshTokenExpiresAt;
    body = (
      <>
        <div className="settings-account">
          {data?.avatarUrl ? (
            <img
              className="settings-account__avatar"
              src={data.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="settings-account__avatar settings-account__avatar--placeholder"
              aria-hidden="true"
            >
              GH
            </span>
          )}
          <div className="settings-account__identity">
            <span className="settings-account__handle">@{login}</span>
            <span className="settings-account__meta">GitHub account</span>
          </div>
          <div className="settings-account__actions">
            <Badge tone="on">connected</Badge>
            <button
              type="button"
              className="settings-btn settings-btn--danger"
              onClick={() => void disconnect()}
              disabled={disconnectBusy}
            >
              {disconnectBusy ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>
        {data?.scopes && data.scopes.length > 0 && (
          <div className="settings-scopes">
            <span className="settings-sr-only">Granted scopes</span>
            {data.scopes.map(scope => (
              <Chip key={scope} tone="neutral">
                {scope}
              </Chip>
            ))}
          </div>
        )}
        {(expiresAt !== undefined || grantExpiresAt !== undefined) && (
          <dl className="settings-fields">
            {expiresAt !== undefined && (
              <Field label="Session expires">
                <span className="settings-mono">{formatTime(expiresAt)}</span>{' '}
                <span className="settings-countdown">({formatCountdown(expiresAt - now)} left)</span>
              </Field>
            )}
            {grantExpiresAt !== undefined && (
              <Field label="Grant expires">
                <span className="settings-mono">{formatTime(grantExpiresAt)}</span>
              </Field>
            )}
          </dl>
        )}
      </>
    );
  } else {
    body = (
      <>
        {device.kind === 'pending' ? (
          <div className="settings-device">
            <p className="settings-hint">
              Enter this code at <span className="settings-mono">github.com/login/device</span>:
            </p>
            <div className="settings-device__code-row">
              <code className="settings-device__code">{device.userCode}</code>
              <CopyButton value={device.userCode} />
            </div>
            <p className="settings-hint">
              <span className="settings-countdown">{formatCountdown(device.expiresAt - now)}</span> left
              · waiting for approval
            </p>
            <div className="settings-form__row">
              <button
                type="button"
                className="settings-btn settings-btn--primary"
                onClick={() => window.open(device.verificationUri, '_blank', 'noopener,noreferrer')}
              >
                Open github.com/login/device
              </button>
            </div>
          </div>
        ) : (
          <>
            {device.kind === 'failed' && (
              <p className="settings-card__error" role="alert">
                {device.message}
              </p>
            )}
            <div className="settings-form__row">
              <button
                type="button"
                className="settings-btn settings-btn--primary"
                onClick={() => void startDeviceFlow()}
                disabled={startBusy}
              >
                {device.kind === 'failed' ? 'Start again' : startBusy ? 'Starting…' : 'Sign in with GitHub'}
              </button>
            </div>
          </>
        )}
        <Collapsible title="Advanced: paste a personal access token">
          <form className="settings-form" onSubmit={submitPat}>
            <label className="settings-label" htmlFor={patInputId}>
              Personal access token — classic <span className="settings-mono">ghp_…</span> or
              fine-grained <span className="settings-mono">github_pat_…</span>
            </label>
            <div className="settings-form__row">
              <input
                id={patInputId}
                className="settings-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="github_pat_…"
                value={patValue}
                onChange={event => setPatValue(event.target.value)}
                disabled={patBusy}
              />
              <button type="submit" className="settings-btn" disabled={patBusy || !patValue.trim()}>
                {patBusy ? 'Connecting…' : 'Connect token'}
              </button>
            </div>
            {patError && (
              <p className="settings-field-error" role="alert">
                {patError}
              </p>
            )}
            <p className="settings-hint">
              Needs the <code className="settings-mono">repo</code> and{' '}
              <code className="settings-mono">read:user</code> scopes. Sent to the server once — the
              browser keeps nothing.
            </p>
          </form>
        </Collapsible>
        {customApp && (
          <Collapsible title="Advanced: use a custom OAuth app">
            <p className="settings-hint">
              Register a user-owned OAuth App, set{' '}
              <code className="settings-mono">T3MP3ST_GITHUB_OAUTH_CLIENT_ID</code> and{' '}
              <code className="settings-mono">T3MP3ST_GITHUB_OAUTH_CLIENT_SECRET</code>, and register
              the callback URL below at{' '}
              <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer">
                github.com/settings/developers
              </a>
              .
            </p>
            <div className="settings-setup__redirect">
              <span className="settings-sr-only" id={callbackLabelId}>
                Callback URL to register
              </span>
              <code className="settings-setup__url" aria-labelledby={callbackLabelId}>
                {callbackUrl}
              </code>
              <CopyButton value={callbackUrl} />
            </div>
          </Collapsible>
        )}
        <p className="settings-scope-warning">
          The <code className="settings-mono">repo</code> scope grants read <strong>and write</strong>{' '}
          access to all repositories you can access, plus{' '}
          <code className="settings-mono">read:user</code> for your profile. Disconnect revokes the
          whole grant.
        </p>
      </>
    );
  }

  return (
    <section className="settings-card" aria-labelledby={headingId} aria-busy={status.status === 'loading'}>
      <h2 id={headingId} className="settings-card__title">
        GitHub account
      </h2>
      {notice && (
        <p className="settings-hint" role="status">
          {notice}
        </p>
      )}
      {body}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Subscription sign-in. Same endpoints docs/settings.html drives: xai is an
// RFC 8628 device code polled until authorized/denied/expired; openai and
// claude are PKCE flows completed by pasting the callback code.
// -----------------------------------------------------------------------------

type OAuthState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: OAuthStatusResponse };

type VendorFlow =
  | { kind: 'idle' }
  | { kind: 'device-pending'; flowId: string; userCode: string; uri: string; expiresAt: number }
  | { kind: 'awaiting-code'; flowId: string; authorizeUrl: string; error?: string }
  | { kind: 'failed'; message: string };

function useOAuthStatus(): { state: OAuthState; apply: (next: OAuthStatusResponse) => void } {
  const [state, setState] = useState<OAuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getJson<OAuthStatusResponse>('/api/oauth/status').then(
      oauth => {
        if (!cancelled) setState({ status: 'ready', data: oauth });
      },
      (err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function apply(next: OAuthStatusResponse): void {
    setState({ status: 'ready', data: next });
  }

  return { state, apply };
}

const VENDOR_CARDS: ReadonlyArray<{
  id: OAuthVendor;
  name: string;
  desc: string;
  signIn: string;
  connectedNote: string;
}> = [
  {
    id: 'xai',
    name: 'Super Grok Heavy',
    desc: 'Device-code login. Bills against SuperGrok / Super Grok Heavy.',
    signIn: 'Sign in with SuperGrok',
    connectedNote: 'Super Grok Heavy models are available.',
  },
  {
    id: 'openai',
    name: 'ChatGPT Plan',
    desc: 'Browser PKCE against ChatGPT. Bills against your ChatGPT Plan.',
    signIn: 'Sign in with ChatGPT',
    connectedNote: 'ChatGPT Plan models run on your subscription.',
  },
  {
    id: 'claude',
    name: 'Claude Pro/Max',
    desc: 'Browser PKCE against your Claude Pro/Max plan. Bills against your subscription.',
    signIn: 'Sign in with Claude',
    connectedNote: 'Claude Pro/Max models run on your subscription.',
  },
];

interface VendorCardProps {
  card: (typeof VENDOR_CARDS)[number];
  info: OAuthStatus | undefined;
  flow: VendorFlow;
  busy: boolean;
  code: string;
  now: number;
  onCodeChange: (value: string) => void;
  onSignIn: () => void;
  onComplete: () => void;
  onSignOut: () => void;
}

function VendorCard({
  card,
  info,
  flow,
  busy,
  code,
  now,
  onCodeChange,
  onSignIn,
  onComplete,
  onSignOut,
}: VendorCardProps) {
  const headingId = useId();
  const codeInputId = useId();
  const connected = info?.connected ?? false;
  const expired = info?.needsReauth ?? false;

  let badge: ReactNode;
  if (expired) badge = <Badge tone="warn">expired — sign in again</Badge>;
  else if (connected) badge = <Badge tone="on">connected</Badge>;
  else badge = <Badge tone="off">offline</Badge>;

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim() || busy) return;
    onComplete();
  };

  let body: ReactNode;
  if (flow.kind === 'device-pending') {
    body = (
      <>
        <p className="settings-hint">
          Open the verification page and enter the code — approval is polled automatically.
        </p>
        <div className="settings-device__code-row">
          <code className="settings-provider-card__code">{flow.userCode}</code>
          <CopyButton value={flow.userCode} />
        </div>
        <p className="settings-hint">
          <span className="settings-countdown">{formatCountdown(flow.expiresAt - now)}</span> left
        </p>
        <div className="settings-provider-card__row">
          <button
            type="button"
            className="settings-btn settings-btn--sm settings-btn--primary"
            onClick={() => window.open(flow.uri, '_blank', 'noopener,noreferrer')}
          >
            Open verification page
          </button>
        </div>
      </>
    );
  } else if (flow.kind === 'awaiting-code') {
    body = (
      <form className="settings-form" onSubmit={submitCode}>
        {card.id === 'claude' ? (
          <p className="settings-hint">
            The browser will return to this machine&apos;s /callback. This page checks until Claude is
            connected, so you do not have to paste a code. If Anthropic shows an error page, the old
            code=true URL is no longer sent.
          </p>
        ) : null}
        <label className="settings-label" htmlFor={codeInputId}>
          {card.id === 'claude'
            ? 'Paste the callback code only if the browser does not return'
            : 'Authorize in the browser, then paste the callback code'}
          {card.id === 'claude' ? ' (the code expires in 15 minutes)' : ''}:
        </label>
        <a className="settings-mono" href={flow.authorizeUrl} target="_blank" rel="noreferrer">
          Reopen the authorization tab
        </a>
        <div className="settings-form__row">
          <input
            id={codeInputId}
            className="settings-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="code#state"
            value={code}
            onChange={event => onCodeChange(event.target.value)}
            disabled={busy}
          />
          <button type="submit" className="settings-btn settings-btn--sm" disabled={busy || !code.trim()}>
            {busy ? 'Completing…' : 'Complete sign-in'}
          </button>
        </div>
        {flow.error && (
          <p className="settings-field-error" role="alert">
            {flow.error}
          </p>
        )}
      </form>
    );
  } else if (flow.kind === 'failed') {
    body = (
      <>
        <p className="settings-field-error" role="alert">
          {flow.message}
        </p>
        <div className="settings-provider-card__row">
          <button
            type="button"
            className="settings-btn settings-btn--sm settings-btn--primary"
            onClick={onSignIn}
            disabled={busy}
          >
            Try again
          </button>
        </div>
      </>
    );
  } else if (expired) {
    body = (
      <p className="settings-hint">
        Sign-in expired — sign in with {card.name} again to reconnect your plan.
      </p>
    );
  } else if (connected) {
    const parts = ['Signed in'];
    if (info?.tier !== undefined) parts.push(info.tier);
    if (info?.expiresAt !== undefined) parts.push(`expires ${formatTime(info.expiresAt)}`);
    body = (
      <p className="settings-hint">
        {parts.join(' · ')}. {card.connectedNote}
      </p>
    );
  } else {
    body = (
      <p className="settings-hint">
        {card.id === 'xai' ? 'Sign in to unlock grok-4-heavy models.' : 'Sign in, then paste the callback code.'}
      </p>
    );
  }

  return (
    <div className="settings-provider-card" aria-labelledby={headingId}>
      <div className="settings-provider-card__head">
        <h3 id={headingId} className="settings-provider-card__name">
          {card.name}
        </h3>
        {badge}
      </div>
      <p className="settings-provider-card__desc">{card.desc}</p>
      <div className="settings-provider-card__body">{body}</div>
      <div className="settings-provider-card__row">
        <button
          type="button"
          className="settings-btn settings-btn--sm settings-btn--primary"
          onClick={onSignIn}
          disabled={busy || flow.kind === 'device-pending' || flow.kind === 'awaiting-code'}
        >
          {card.signIn}
        </button>
        <button type="button" className="settings-btn settings-btn--sm" onClick={onSignOut} disabled={busy}>
          Sign out
        </button>
      </div>
    </div>
  );
}

function LlmSection({ oauth }: { oauth: { state: OAuthState; apply: (next: OAuthStatusResponse) => void } }) {
  const headingId = useId();
  const [flows, setFlows] = useState<Record<OAuthVendor, VendorFlow>>({
    xai: { kind: 'idle' },
    openai: { kind: 'idle' },
    claude: { kind: 'idle' },
  });
  const [codeValues, setCodeValues] = useState<Record<OAuthVendor, string>>({
    xai: '',
    openai: '',
    claude: '',
  });
  const [busyVendor, setBusyVendor] = useState<OAuthVendor | null>(null);
  const timerRef = useRef<number | null>(null);
  const now = useNow(flows.xai.kind === 'device-pending');

  function setFlow(vendor: OAuthVendor, next: VendorFlow): void {
    setFlows(prev => {
      const copy: Record<OAuthVendor, VendorFlow> = { ...prev };
      copy[vendor] = next;
      return copy;
    });
  }

  function setCode(vendor: OAuthVendor, value: string): void {
    setCodeValues(prev => {
      const copy: Record<OAuthVendor, string> = { ...prev };
      copy[vendor] = value;
      return copy;
    });
  }

  function clearXaiPoll(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Leaving the section abandons the SuperGrok poll.
  useEffect(() => clearXaiPoll, []);

  // Loopback /callback completes Claude without a paste. Poll until connected.
  const claudeAwaiting = flows.claude.kind === 'awaiting-code';
  const applyOAuthRef = useRef(oauth.apply);
  applyOAuthRef.current = oauth.apply;
  useEffect(() => {
    if (!claudeAwaiting) return undefined;
    let cancelled = false;
    const poll = window.setInterval(() => {
      getJson<OAuthStatusResponse>('/api/oauth/status').then(
        status => {
          if (cancelled || !status.claude?.connected) return;
          setFlows(prev => ({ ...prev, claude: { kind: 'idle' } }));
          setCodeValues(prev => ({ ...prev, claude: '' }));
          applyOAuthRef.current(status);
        },
        () => undefined,
      );
    }, MIN_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [claudeAwaiting]);

  function armXaiPoll(flowId: string, intervalSec: number, expiresAt: number): void {
    clearXaiPoll();
    timerRef.current = window.setTimeout(
      () => void pollXaiFlow(flowId, intervalSec, expiresAt),
      Math.max(MIN_POLL_MS, intervalSec * 1000),
    );
  }

  async function pollXaiFlow(flowId: string, intervalSec: number, expiresAt: number): Promise<void> {
    if (Date.now() >= expiresAt) {
      setFlow('xai', { kind: 'failed', message: 'Timed out — start again.' });
      return;
    }
    try {
      const poll = await pollXaiOAuth(flowId);
      if (poll.status === 'authorized') {
        setFlow('xai', { kind: 'idle' });
        oauth.apply(poll.oauth);
        return;
      }
      if (poll.status === 'denied' || poll.status === 'expired') {
        setFlow('xai', { kind: 'failed', message: poll.error ?? poll.status });
        return;
      }
      armXaiPoll(
        flowId,
        poll.interval !== undefined && poll.interval > 0 ? poll.interval : intervalSec,
        expiresAt,
      );
    } catch (err) {
      const api = err instanceof ApiError ? err : undefined;
      if (api === undefined || api.status === 0) {
        armXaiPoll(flowId, intervalSec, expiresAt);
        return;
      }
      setFlow('xai', { kind: 'failed', message: api.message });
    }
  }

  async function signIn(vendor: OAuthVendor): Promise<void> {
    setBusyVendor(vendor);
    try {
      if (vendor === 'xai') {
        clearXaiPoll();
        const start = await startXaiOAuth();
        const expiresAt = Date.now() + start.expiresIn * 1000;
        setFlow('xai', {
          kind: 'device-pending',
          flowId: start.flowId,
          userCode: start.userCode,
          uri: start.verificationUriComplete ?? start.verificationUri,
          expiresAt,
        });
        armXaiPoll(start.flowId, start.interval, expiresAt);
      } else {
        const start = await startPkceOAuth(vendor);
        window.open(start.authorizeUrl, '_blank', 'noopener,noreferrer');
        setFlow(vendor, { kind: 'awaiting-code', flowId: start.flowId, authorizeUrl: start.authorizeUrl });
      }
    } catch (err) {
      setFlow(vendor, { kind: 'failed', message: errorMessage(err) });
    } finally {
      setBusyVendor(null);
    }
  }

  async function complete(vendor: OAuthVendor, code: string): Promise<void> {
    if (vendor === 'xai') return; // device flow — no code to paste
    const flow = flows[vendor];
    if (flow.kind !== 'awaiting-code') return;
    setBusyVendor(vendor);
    try {
      const result = await completePkceOAuth(vendor, flow.flowId, code);
      setFlow(vendor, { kind: 'idle' });
      setCode(vendor, '');
      oauth.apply(result.oauth);
    } catch (err) {
      // The flow stays live — the pasted code can be retried (settings.html
      // keeps the input too).
      setFlow(vendor, {
        kind: 'awaiting-code',
        flowId: flow.flowId,
        authorizeUrl: flow.authorizeUrl,
        error: errorMessage(err),
      });
    } finally {
      setBusyVendor(null);
    }
  }

  async function signOut(vendor: OAuthVendor): Promise<void> {
    setBusyVendor(vendor);
    try {
      const result = await logoutVendorOAuth(vendor);
      if (vendor === 'xai') clearXaiPoll();
      setFlow(vendor, { kind: 'idle' });
      oauth.apply(result.oauth);
    } catch (err) {
      setFlow(vendor, { kind: 'failed', message: errorMessage(err) });
    } finally {
      setBusyVendor(null);
    }
  }

  const oauthData = oauth.state.status === 'ready' ? oauth.state.data : null;

  return (
    <section className="settings-card" aria-labelledby={headingId} aria-busy={oauth.state.status === 'loading'}>
      <h2 id={headingId} className="settings-card__title">
        Subscription sign-in
      </h2>
      <p className="settings-hint">
        Use your Super Grok Heavy, ChatGPT Plan, or Claude Pro/Max subscription instead of API keys.
        Tokens stay on the server.
      </p>
      {oauth.state.status === 'error' && (
        <p className="settings-card__error" role="alert">
          Could not load sign-in status: {oauth.state.message}
        </p>
      )}
      <div className="settings-provider-grid">
        {VENDOR_CARDS.map(card => (
          <VendorCard
            key={card.id}
            card={card}
            info={oauthData?.[card.id]}
            flow={flows[card.id]}
            busy={busyVendor === card.id}
            code={codeValues[card.id]}
            now={now}
            onCodeChange={value => setCode(card.id, value)}
            onSignIn={() => void signIn(card.id)}
            onComplete={() => {
              if (card.id !== 'xai') void complete(card.id, codeValues[card.id]);
            }}
            onSignOut={() => void signOut(card.id)}
          />
        ))}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Configuration. Universal API provider config + model selection, mirroring
// the routes docs/settings.html drives: POST /api/models for the live model
// list, GET /api/llm/status for the model line, and the shared
// t3mp3st_state_v1 localStorage document for provider/key/baseUrl/model.
// -----------------------------------------------------------------------------

function ProviderModelForm({
  options,
  providerId,
  modelId,
  provider,
  model,
  busy,
  error,
  note,
  onProviderChange,
  onModelChange,
  onSubmit,
}: {
  options: LlmOptionsResponse;
  providerId: string;
  modelId: string;
  provider: string;
  model: string;
  busy: boolean;
  error: string | null;
  note: string | null;
  onProviderChange: (id: string) => void;
  onModelChange: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const choices = selectableLlmProviders(options);
  const selected = choices.find(entry => entry.id === provider);
  const models = selected?.models ?? [];
  const active = options.active;

  return (
    <form className="settings-form__grid" onSubmit={onSubmit}>
      <p className="settings-mono">
        Active: {active.provider || 'none'} · {active.model || 'none'}
      </p>
      {choices.length === 0 ? (
        <p className="settings-hint">No connected or configured providers yet. Sign in above, then retry.</p>
      ) : (
        <div className="settings-form__row">
          <div className="settings-form settings-form--field">
            <label className="settings-label" htmlFor={providerId}>
              Provider
            </label>
            <select
              id={providerId}
              className="settings-select"
              value={choices.some(entry => entry.id === provider) ? provider : ''}
              onChange={event => onProviderChange(event.target.value)}
              disabled={busy}
            >
              <option value="">Select a provider</option>
              {choices.map(entry => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                  {entry.streamable ? ' · streams' : ' · no stream'}
                  {entry.connected ? '' : ' · configured'}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-form settings-form--field">
            <label className="settings-label" htmlFor={modelId}>
              Model
            </label>
            <select
              id={modelId}
              className="settings-select"
              value={models.includes(model) ? model : ''}
              onChange={event => onModelChange(event.target.value)}
              disabled={busy || models.length === 0}
            >
              <option value="">{models.length === 0 ? 'No models listed' : 'Select a model'}</option>
              {models.map(id => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {selected && (
        <p className="settings-hint">
          {selected.streamable
            ? `${selected.label} streams responses.`
            : `${selected.label} does not stream.`}
          {selected.note ? ` ${selected.note}` : ''}
        </p>
      )}
      <div className="settings-form__row">
        <button
          type="submit"
          className="settings-btn settings-btn--primary"
          disabled={busy || provider === '' || model === '' || !models.includes(model)}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {note && (
          <span role="status" className="settings-hint">
            {note}
          </span>
        )}
      </div>
      {error && (
        <p className="settings-field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function ConfigSection({ oauth }: { oauth: { state: OAuthState } }) {
  const defaultHeadingId = useId();
  const defaultProviderId = useId();
  const defaultModelId = useId();
  const universalId = useId();
  const modelStatusId = useId();
  const dataId = useId();
  const providerId = useId();
  const baseUrlId = useId();
  const apiKeyId = useId();
  const modelId = useId();
  const maxTokensId = useId();
  const [stored, setStored] = useState<StoredSettings>(readStoredSettings);
  const [provider, setProvider] = useState(() => stored.activeProvider || 'openrouter');
  const [baseUrl, setBaseUrl] = useState(() => stored.baseUrl || '');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(() => stored.selectedModel || '');
  const [maxTokens, setMaxTokens] = useState(() => stored.maxContextTokens || '');
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [configNote, setConfigNote] = useState<string | null>(null);
  const [dataNote, setDataNote] = useState<string | null>(null);
  const [llmRunId, setLlmRunId] = useState(0);
  const llm = useResource<LlmStatusResponse>('/api/llm/status', llmRunId);
  const [llmOptions, setLlmOptions] = useState<Resource<LlmOptionsResponse>>({ status: 'loading' });
  const [defaultProvider, setDefaultProvider] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultBusy, setDefaultBusy] = useState(false);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [defaultNote, setDefaultNote] = useState<string | null>(null);
  const [optionsRun, setOptionsRun] = useState(0);

  const subscriptionKey =
    oauth.state.status === 'ready'
      ? `${String(oauth.state.data.claude.connected)}:${String(oauth.state.data.openai.connected)}:${String(oauth.state.data.xai.connected)}`
      : oauth.state.status;

  useEffect(() => {
    let cancelled = false;
    setLlmOptions(prev => (prev.status === 'ready' ? prev : { status: 'loading' }));
    getJson<LlmOptionsResponse>('/api/llm/options').then(
      data => {
        if (cancelled) return;
        setLlmOptions({ status: 'ready', data });
        const list = selectableLlmProviders(data);
        setDefaultProvider(prev => {
          const still = prev !== '' && list.some(entry => entry.id === prev);
          const nextId = still
            ? prev
            : (list.find(entry => entry.id === data.active.provider)?.id ?? list[0]?.id ?? '');
          const entry = list.find(item => item.id === nextId);
          const models = entry?.models ?? [];
          setDefaultModel(prevModel => {
            if (still && models.includes(prevModel)) return prevModel;
            if (nextId === data.active.provider && models.includes(data.active.model)) return data.active.model;
            return models[0] ?? '';
          });
          return nextId;
        });
      },
      (err: unknown) => {
        if (!cancelled) setLlmOptions({ status: 'error', message: errorMessage(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [subscriptionKey, optionsRun]);

  function onDefaultProviderChange(id: string): void {
    setDefaultProvider(id);
    setDefaultNote(null);
    if (llmOptions.status !== 'ready') return;
    const entry = selectableLlmProviders(llmOptions.data).find(item => item.id === id);
    const models = entry?.models ?? [];
    setDefaultModel(prev => (models.includes(prev) ? prev : (models[0] ?? '')));
  }

  async function saveDefault(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (defaultProvider === '' || defaultModel === '') return;
    setDefaultBusy(true);
    setDefaultError(null);
    try {
      await postJson('/api/llm/default', { provider: defaultProvider, model: defaultModel });
      const data = await getJson<LlmOptionsResponse>('/api/llm/options');
      setLlmOptions({ status: 'ready', data });
      setDefaultProvider(data.active.provider);
      setDefaultModel(data.active.model);
      setDefaultNote(`Saved ${data.active.provider} · ${data.active.model}`);
    } catch (err) {
      setDefaultError(errorMessage(err));
    } finally {
      setDefaultBusy(false);
    }
  }

  const providerBase = UAC_PROVIDERS.find(entry => entry.id === provider)?.base ?? '';

  async function fetchModels(): Promise<void> {
    setModelsBusy(true);
    setModelsError(null);
    try {
      const key = apiKey || stored[`${provider}Key`] || '';
      const base = baseUrl || providerBase;
      const listing = await fetchProviderModels({ provider, apiKey: key, baseUrl: base });
      setModels(listing);
      if (model !== '' && !listing.models.some(entry => entry.id === model)) setModel('');
    } catch (err) {
      setModelsError(errorMessage(err));
    } finally {
      setModelsBusy(false);
    }
  }

  const saveConfig = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: StoredSettings = { ...stored };
    next.activeProvider = provider;
    if (apiKey !== '') next[`${provider}Key`] = apiKey;
    next.baseUrl = baseUrl;
    next.selectedModel = model || stored.selectedModel || '';
    next.maxContextTokens = maxTokens;
    writeStoredSettings(next);
    setStored(next);
    setConfigNote('Provider config saved');
  };

  function clearAllData(): void {
    try {
      window.localStorage.clear();
    } catch {
      // Storage unavailable — nothing to clear.
    }
    setStored({});
    setProvider('openrouter');
    setBaseUrl('');
    setApiKey('');
    setModel('');
    setMaxTokens('');
    setDataNote('All local data cleared');
  }

  const modelValue = models !== null && models.models.some(entry => entry.id === model) ? model : '';
  const modelOptions = models?.models ?? [];

  let modelHint: ReactNode = null;
  if (modelsError !== null) {
    modelHint = <span className="settings-model-hint">Fetch failed: {modelsError}</span>;
  } else if (models !== null) {
    const count = models.models.length;
    const when = models.fetchedAt !== null ? formatTime(models.fetchedAt) : '';
    if (models.source === 'unavailable') {
      modelHint = (
        <span className="settings-model-hint">
          {models.note ?? 'No model list available for this provider.'}
        </span>
      );
    } else if (models.source === 'stale') {
      modelHint = (
        <span className="settings-model-hint">
          {count} model(s) · cached {when}
          {models.note ? ` · ${models.note}` : ''}
        </span>
      );
    } else {
      modelHint = (
        <span className="settings-model-hint">
          {count} model(s) · live from provider · fetched {when}
        </span>
      );
    }
  }

  let modelBody: ReactNode;
  if (llm.status === 'loading') {
    modelBody = <CardSkeleton title="Model status" />;
  } else if (llm.status === 'error') {
    modelBody = (
      <>
        <p className="settings-card__error" role="alert">
          Model status unavailable: {llm.message}
        </p>
        <div>
          <button type="button" className="settings-btn" onClick={() => setLlmRunId(n => n + 1)}>
            Retry
          </button>
        </div>
      </>
    );
  } else {
    const subscriptions: string[] = [];
    const oauthData = oauth.state.status === 'ready' ? oauth.state.data : null;
    if (oauthData?.xai.connected) subscriptions.push('Super Grok Heavy');
    if (oauthData?.openai.connected) subscriptions.push('ChatGPT Plan');
    if (oauthData?.claude.connected) {
      subscriptions.push(
        oauthData.claude.tier ? `Claude ${oauthData.claude.tier}` : 'Claude Pro/Max',
      );
    }
    const line =
      `LLM connected: ${String(llm.data.connected)}` +
      (llm.data.provider ? ` · provider ${llm.data.provider}` : '') +
      (llm.data.model ? ` · model ${llm.data.model}` : '') +
      (subscriptions.length > 0 ? ` · subscriptions: ${subscriptions.join(', ')}` : '');
    modelBody = <p className="settings-mono">{line}</p>;
  }

  return (
    <>
      <section className="settings-card" aria-labelledby={defaultHeadingId} aria-busy={llmOptions.status === 'loading'}>
        <h2 id={defaultHeadingId} className="settings-card__title">
          Provider and model
        </h2>
        <p className="settings-hint">
          Server default used by the app. Connected providers, including Anthropic when Claude is
          signed in, can be selected. Streaming is marked on each provider.
        </p>
        {llmOptions.status === 'loading' && <CardSkeleton title="Provider and model" />}
        {llmOptions.status === 'error' && (
          <>
            <p className="settings-card__error" role="alert">
              Could not load providers: {llmOptions.message}
            </p>
            <div>
              <button type="button" className="settings-btn" onClick={() => setOptionsRun(n => n + 1)}>
                Retry
              </button>
            </div>
          </>
        )}
        {llmOptions.status === 'ready' && (
          <ProviderModelForm
            options={llmOptions.data}
            providerId={defaultProviderId}
            modelId={defaultModelId}
            provider={defaultProvider}
            model={defaultModel}
            busy={defaultBusy}
            error={defaultError}
            note={defaultNote}
            onProviderChange={onDefaultProviderChange}
            onModelChange={value => {
              setDefaultModel(value);
              setDefaultNote(null);
            }}
            onSubmit={event => void saveDefault(event)}
          />
        )}
      </section>

      <section className="settings-card" aria-labelledby={universalId}>
        <h2 id={universalId} className="settings-card__title">
          Universal API config
        </h2>
        <p className="settings-hint">
          One place for provider, key, base URL, model, and context cap. Stored in this browser only.
        </p>
        <form className="settings-form__grid" onSubmit={saveConfig}>
          <div className="settings-form__row">
            <div className="settings-form settings-form--field">
              <label className="settings-label" htmlFor={providerId}>
                API Provider
              </label>
              <select
                id={providerId}
                className="settings-select"
                value={provider}
                onChange={event => setProvider(event.target.value)}
              >
                {UAC_PROVIDERS.map(entry => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-form settings-form--field">
              <label className="settings-label" htmlFor={baseUrlId}>
                Base URL (optional)
              </label>
              <input
                id={baseUrlId}
                className="settings-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={providerBase}
                value={baseUrl}
                onChange={event => setBaseUrl(event.target.value)}
              />
            </div>
          </div>
          <div className="settings-form__row">
            <div className="settings-form settings-form--field">
              <label className="settings-label" htmlFor={apiKeyId}>
                API Key
              </label>
              <div className="settings-key-row">
                <input
                  id={apiKeyId}
                  className="settings-input"
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={event => setApiKey(event.target.value)}
                />
                <button
                  type="button"
                  className="settings-btn settings-btn--sm"
                  onClick={() => setShowKey(prev => !prev)}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="settings-form settings-form--field">
              <label className="settings-label" htmlFor={modelId}>
                Model
              </label>
              <div className="settings-key-row">
                <select
                  id={modelId}
                  className="settings-select"
                  value={modelValue}
                  onChange={event => setModel(event.target.value)}
                  disabled={models === null || models.source === 'unavailable'}
                >
                  <option value="">Select a model after connecting</option>
                  {modelOptions.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="settings-btn settings-btn--sm"
                  onClick={() => void fetchModels()}
                  disabled={modelsBusy}
                >
                  {modelsBusy ? 'Fetching…' : 'Fetch models'}
                </button>
              </div>
              {models?.source === 'stale' && <Chip tone="warn">Stale cache. Retry refresh.</Chip>}
              {modelHint}
            </div>
          </div>
          <div className="settings-form settings-form--field">
            <label className="settings-label" htmlFor={maxTokensId}>
              Max Context Tokens (optional)
            </label>
            <input
              id={maxTokensId}
              className="settings-input"
              type="number"
              min={0}
              step={1000}
              placeholder="e.g. 200000"
              value={maxTokens}
              onChange={event => setMaxTokens(event.target.value)}
            />
          </div>
          <div className="settings-form__row">
            <button type="submit" className="settings-btn settings-btn--primary">
              Save config
            </button>
            {configNote && (
              <span role="status" className="settings-hint">
                {configNote}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="settings-card" aria-labelledby={modelStatusId}>
        <h2 id={modelStatusId} className="settings-card__title">
          Model selection
        </h2>
        {modelBody}
      </section>

      <section className="settings-card" aria-labelledby={dataId}>
        <h2 id={dataId} className="settings-card__title">
          Data
        </h2>
        <p className="settings-hint">
          Clears every locally stored setting and preference in this browser. Server-side connections
          are untouched.
        </p>
        <div className="settings-form__row">
          <button type="button" className="settings-btn settings-btn--danger" onClick={clearAllData}>
            Clear all data
          </button>
          {dataNote && (
            <span role="status" className="settings-hint">
              {dataNote}
            </span>
          )}
        </div>
      </section>
    </>
  );
}

export default function Settings() {
  const oauth = useOAuthStatus();
  return (
    <div className="settings">
      <GitHubCard />
      <LlmSection oauth={oauth} />
      <ConfigSection oauth={oauth} />
    </div>
  );
}
