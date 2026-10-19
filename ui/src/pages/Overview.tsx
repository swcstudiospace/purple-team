import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  getJson,
  type FindingRecord,
  type FindingSeverity,
  type FindingsResponse,
  type HealthResponse,
  type LlmStatusResponse,
  type LocalAgentsDetectResponse,
  type MissionStatusResponse,
  type OAuthStatus,
  type OAuthStatusResponse,
} from '../api/client';
import './overview.css';

type Resource<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

type Settled<T> = { runId: number; result: Exclude<Resource<T>, { status: 'loading' }> };

const SEVERITY_ORDER: readonly FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * Fetches one GET route. Each card owns its own result, so a failing route never
 * blanks the page. Results are tagged with the run that produced them: a Refresh
 * (new runId) reads as loading until its own request settles, and stale responses
 * are dropped.
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
            result: { status: 'error', message: err instanceof Error ? err.message : 'Unexpected error' },
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

function formatTime(value: number | string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function countBySeverity(findings: FindingRecord[]): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) {
    if (finding.severity in counts) counts[finding.severity] += 1;
  }
  return counts;
}

function Badge({ tone, children }: { tone: 'on' | 'off'; children: ReactNode }) {
  return <span className={`overview-badge overview-badge--${tone}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overview-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="overview-stat">
      <dt className="overview-stat__label">{label}</dt>
      <dd className="overview-stat__value">{value}</dd>
    </div>
  );
}

interface CardProps<T> {
  title: string;
  resource: Resource<T>;
  isEmpty: (data: T) => boolean;
  emptyText: string;
  children: (data: T) => ReactNode;
}

function Card<T>({ title, resource, isEmpty, emptyText, children }: CardProps<T>) {
  const headingId = useId();

  let body: ReactNode;
  if (resource.status === 'loading') {
    body = (
      <>
        <span className="overview-sr-only">Loading {title}</span>
        <div className="overview-skeleton" aria-hidden="true">
          <span className="overview-skeleton__line overview-skeleton__line--wide" />
          <span className="overview-skeleton__line" />
          <span className="overview-skeleton__line overview-skeleton__line--short" />
        </div>
      </>
    );
  } else if (resource.status === 'error') {
    body = (
      <p className="overview-card__error" role="alert">
        Could not load {title}: {resource.message}
      </p>
    );
  } else if (isEmpty(resource.data)) {
    body = <p className="overview-card__empty">{emptyText}</p>;
  } else {
    body = children(resource.data);
  }

  return (
    <section className="overview-card" aria-labelledby={headingId} aria-busy={resource.status === 'loading'}>
      <h2 id={headingId} className="overview-card__title">
        {title}
      </h2>
      {body}
    </section>
  );
}

export default function Overview() {
  const [runId, setRunId] = useState(0);
  const health = useResource<HealthResponse>('/api/health', runId);
  const llm = useResource<LlmStatusResponse>('/api/llm/status', runId);
  const oauth = useResource<OAuthStatusResponse>('/api/oauth/status', runId);
  const agents = useResource<LocalAgentsDetectResponse>('/api/agents/local/detect', runId);
  const mission = useResource<MissionStatusResponse>('/api/mission/status', runId);
  const findings = useResource<FindingsResponse>('/api/findings?status=open', runId);

  return (
    <section className="overview" aria-labelledby="overview-heading">
      <header className="overview__header">
        <div>
          <h2 id="overview-heading" className="overview__title">
            Live status
          </h2>
          <p className="overview__subtitle">Read directly from this server. Each card loads on its own.</p>
        </div>
        <button type="button" className="overview__refresh" onClick={() => setRunId(n => n + 1)}>
          Refresh
        </button>
      </header>

      <div className="overview__grid">
        <Card
          title="Backend"
          resource={health}
          isEmpty={d => typeof d.ok !== 'boolean'}
          emptyText="The health endpoint returned no status fields."
        >
          {d => (
            <dl className="overview-fields">
              <Field label="Status">
                <Badge tone={d.ok ? 'on' : 'off'}>{d.ok ? 'Responding' : 'Degraded'}</Badge>
              </Field>
              <Field label="Version">
                <span className="overview-mono">{d.version}</span>
              </Field>
              <Field label="API">
                <span className="overview-mono">{d.apiVersion}</span>
              </Field>
              <Field label="Storage">{d.storage.ok ? d.storage.driver : 'Unavailable'}</Field>
              <Field label="Mission">
                <Badge tone={d.mission.active ? 'on' : 'off'}>{d.mission.active ? 'Running' : 'Idle'}</Badge>
              </Field>
              <Field label="Checked">
                <span className="overview-mono">{formatTime(d.timestamp)}</span>
              </Field>
            </dl>
          )}
        </Card>

        <Card
          title="LLM provider"
          resource={llm}
          isEmpty={d => !d.provider}
          emptyText="No LLM provider is configured."
        >
          {d => (
            <dl className="overview-fields">
              <Field label="Provider">
                <span className="overview-mono">{d.provider}</span>
              </Field>
              <Field label="Model">
                <span className="overview-mono">{d.model || 'Not set'}</span>
              </Field>
              <Field label="Connection">
                <Badge tone={d.connected ? 'on' : 'off'}>{d.connected ? 'Connected' : 'Not connected'}</Badge>
              </Field>
              <Field label="Setup">
                <Badge tone={d.configured ? 'on' : 'off'}>{d.configured ? 'Configured' : 'Missing'}</Badge>
              </Field>
            </dl>
          )}
        </Card>

        <Card
          title="Subscriptions"
          resource={oauth}
          isEmpty={d => Object.keys(d).length === 0}
          emptyText="No subscription providers are reported."
        >
          {d => (
            <ul className="overview-list">
              {Object.entries<OAuthStatus>(d).map(([vendor, status]) => (
                <li key={vendor} className="overview-list__item">
                  <span>
                    {status.label}
                    {status.tier && <span className="overview-mono"> {status.tier}</span>}
                  </span>
                  <span className="overview-list__meta">
                    <Badge tone={status.connected && !status.needsReauth ? 'on' : 'off'}>
                      {status.needsReauth ? 'Re-auth needed' : status.connected ? 'Connected' : 'Not connected'}
                    </Badge>
                    {status.connected && !status.needsReauth && status.expiresAt !== undefined && (
                      <span className="overview-mono">Expires {formatTime(status.expiresAt)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Local agents"
          resource={agents}
          isEmpty={d => d.agents.length === 0}
          emptyText="No local agent CLIs were detected."
        >
          {d => (
            <>
              <dl className="overview-stats">
                <Stat label="Detected" value={d.agents.filter(a => a.installed).length} />
                <Stat label="Authed" value={d.agents.filter(a => a.authed).length} />
                <Stat label="Ready" value={d.agents.filter(a => a.ready).length} />
                <Stat label="Connected" value={d.connected.length} />
              </dl>
              <ul className="overview-list">
                {d.agents.map(agent => (
                  <li key={agent.id} className="overview-list__item">
                    <span>
                      {agent.label}
                      {agent.version && <span className="overview-mono"> {agent.version}</span>}
                    </span>
                    <Badge tone={agent.ready ? 'on' : 'off'}>
                      {agent.ready ? 'Ready' : agent.installed ? 'Not signed in' : 'Not installed'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card
          title="Mission"
          resource={mission}
          isEmpty={d => !d.active && !d.mission}
          emptyText="No mission is active."
        >
          {d => {
            const summary = d.operators?.summary;
            return (
              <dl className="overview-fields">
                <Field label="State">
                  <Badge tone={d.active && !d.paused ? 'on' : 'off'}>
                    {d.paused ? 'Paused' : d.active ? 'Running' : 'Idle'}
                  </Badge>
                </Field>
                <Field label="Mission">{d.mission ? d.mission.name : 'None loaded'}</Field>
                {d.mission && <Field label="Status">{d.mission.status}</Field>}
                {d.mission && (
                  <Field label="Phase">
                    <span className="overview-mono">{d.mission.currentPhase}</span>
                  </Field>
                )}
                <Field label="Operators">
                  {summary ? (
                    <span className="overview-count">
                      {summary.total} total · {summary.busy} busy · {summary.available} available
                    </span>
                  ) : (
                    'Not reported'
                  )}
                </Field>
                {d.stallReason && <Field label="Stall reason">{d.stallReason}</Field>}
              </dl>
            );
          }}
        </Card>

        <Card
          title="Open findings"
          resource={findings}
          isEmpty={d => d.findings.length === 0}
          emptyText="No open findings."
        >
          {d => {
            const counts = countBySeverity(d.findings);
            return (
              <>
                <dl className="overview-stats">
                  <Stat label="Open" value={d.findings.length} />
                </dl>
                <dl className="overview-stats overview-stats--severity">
                  {SEVERITY_ORDER.map(severity => (
                    <Stat key={severity} label={severity} value={counts[severity]} />
                  ))}
                </dl>
              </>
            );
          }}
        </Card>
      </div>
    </section>
  );
}
