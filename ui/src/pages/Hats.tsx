import { useId, useState, useSyncExternalStore } from 'react';
import { getChatModelChoice } from '../components/ChatStream';
import { useSelectedRepo, type SelectedRepo } from '../stores/github';
import { HATS, redactString, repoSource } from './hats-data';
import '../components/hats.css';

/** Chip body for an attached repo: owner/repo@ref, the resolved default branch when ref is empty, or the local path. */
function repoChip(selected: SelectedRepo, defaultBranch: string | null): string {
  const local = selected.repoPath?.trim() ?? '';
  const base = local !== '' ? local : `${selected.owner}/${selected.repo}`;
  const ref = selected.ref !== '' ? selected.ref : (defaultBranch ?? '');
  return ref === '' ? base : `${base}@${ref}`;
}

interface HatNotice {
  tone: 'ok' | 'error';
  text: string;
}

/** Success line: the mission name from the response body, else the generic started line. */
function successNotice(label: string, text: string): HatNotice {
  const trimmed = text.trim();
  if (trimmed !== '') {
    try {
      const body = JSON.parse(trimmed) as { missionName?: unknown };
      if (typeof body.missionName === 'string' && body.missionName !== '') {
        return { tone: 'ok', text: `Started: ${body.missionName}` };
      }
    } catch {
      // Non-JSON success body — fall through to the generic line.
    }
  }
  return { tone: 'ok', text: `${label} started.` };
}

/** Failure line: HTTP status plus the redacted server error, truncated to 240 chars. */
function failureNotice(status: number, text: string): HatNotice {
  const trimmed = text.trim();
  if (trimmed === '') return { tone: 'error', text: `Hat run failed (HTTP ${status}).` };
  let error = trimmed;
  try {
    const body = JSON.parse(trimmed) as { error?: unknown };
    if (typeof body.error === 'string' && body.error !== '') error = body.error;
  } catch {
    // Plain-text body — redact it whole.
  }
  return { tone: 'error', text: `Hat run failed (HTTP ${status}): ${redactString(error).slice(0, 240)}` };
}

/**
 * One launch lock for the whole page: while any hat's launch is in flight every
 * hat button stays disabled. It lives at module scope so a remount during a
 * request cannot start a second mission beside the first.
 */
let launchInFlight = false;
const launchListeners = new Set<() => void>();

function subscribeLaunch(listener: () => void): () => void {
  launchListeners.add(listener);
  return () => {
    launchListeners.delete(listener);
  };
}

function setLaunchInFlight(value: boolean): void {
  launchInFlight = value;
  for (const listener of launchListeners) listener();
}

/** Takes the page-wide launch lock; false when another hat launch already holds it. */
function acquireLaunchLock(): boolean {
  if (launchInFlight) return false;
  setLaunchInFlight(true);
  return true;
}

interface HatCardProps {
  hat: (typeof HATS)[number];
  repo: SelectedRepo | null;
  defaultBranch: string | null;
}

function HatCard({ hat, repo, defaultBranch }: HatCardProps) {
  const [objective, setObjective] = useState<string>(hat.objective);
  const [running, setRunning] = useState(false);
  const locked = useSyncExternalStore(subscribeLaunch, () => launchInFlight);
  const [notice, setNotice] = useState<HatNotice | null>(null);
  const objectiveId = useId();

  // Mirrors the chat panel's launchHat: same route, same payload shape, redacted failures.
  async function run(): Promise<void> {
    if (repo === null) return;
    const trimmed = objective.trim();
    const choice = getChatModelChoice();
    if (!acquireLaunchLock()) return;
    setRunning(true);
    setNotice(null);
    try {
      const response = await fetch('/api/mission/start', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${hat.label} team`,
          operators: [...hat.operators],
          objective: trimmed === '' ? hat.objective : trimmed,
          targetContext: { kind: 'artifacts' },
          ...repoSource(repo),
          ...(choice === null ? {} : { provider: choice.provider, model: choice.model }),
        }),
      });
      const text = await response.text();
      setNotice(response.ok ? successNotice(hat.label, text) : failureNotice(response.status, text));
    } catch (err: unknown) {
      setNotice({ tone: 'error', text: err instanceof Error ? redactString(err.message) : 'Network error' });
    } finally {
      setRunning(false);
      setLaunchInFlight(false);
    }
  }

  return (
    <article className="hats-card">
      <header className="hats-card__head">
        <h3 className="hats-card__title">{hat.label}</h3>
        {repo !== null ? (
          <span className="hats-chip">{repoChip(repo, defaultBranch)}</span>
        ) : (
          <span className="hats-chip hats-chip--attach">
            Attach a repository in the <a href="#github">GitHub tab</a>
          </span>
        )}
      </header>
      <p className="hats-card__doctrine">{hat.doctrine}</p>
      <ul className="hats-operators" aria-label={`${hat.label} operators`}>
        {hat.operators.map(operator => (
          <li key={operator} className="hats-operator-pill">
            {operator}
          </li>
        ))}
      </ul>
      <label className="hats-label" htmlFor={objectiveId}>
        Objective
      </label>
      <input
        id={objectiveId}
        className="hats-input"
        value={objective}
        onChange={event => setObjective(event.target.value)}
      />
      <button type="button" className="hats-btn" disabled={repo === null || locked} onClick={() => void run()}>
        {running ? 'Running…' : 'Run'}
      </button>
      {notice !== null && (
        <p className={`hats-status hats-status--${notice.tone}`} role="status">
          {notice.text}
        </p>
      )}
    </article>
  );
}

export default function Hats() {
  const headingId = useId();
  const { selected, resolution } = useSelectedRepo();
  // The resolution payload belongs to the selection only when it describes the same repo.
  const defaultBranch =
    resolution !== null && selected !== null && resolution.fullName === selected.fullName
      ? resolution.defaultBranch
      : null;

  return (
    <section className="hats" aria-labelledby={headingId}>
      <header className="hats-header">
        <h2 id={headingId} className="hats-title">
          4 Hats
        </h2>
        <p className="hats-subtitle">
          Each hat runs against the repository attached in the GitHub tab: red hunts exploitable
          weaknesses, blue maps detection coverage, white adjudicates evidence and rules of
          engagement, and black reviews tradecraft.
        </p>
      </header>
      <div className="hats-grid">
        {HATS.map(hat => (
          <HatCard key={hat.id} hat={hat} repo={selected} defaultBranch={defaultBranch} />
        ))}
      </div>
    </section>
  );
}
