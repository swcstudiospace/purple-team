import { useState, type FormEvent, type MouseEvent } from 'react';

type SectionId = 'overview' | 'four-hats' | 'settings' | 'agent-panel';

const NAV_ITEMS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'four-hats', label: 'Four Hats' },
  { id: 'settings', label: 'Settings' },
  { id: 'agent-panel', label: 'Agent Panel' },
];

const HATS = ['Red', 'Blue', 'White', 'Black'] as const;

export default function App() {
  const [active, setActive] = useState<SectionId>('overview');
  const [draft, setDraft] = useState('');

  const navigate = (id: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setActive(id);
  };

  const onComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const current = NAV_ITEMS.find((item) => item.id === active) ?? NAV_ITEMS[0];

  return (
    <div className="shell">
      <nav className="rail" aria-label="Primary">
        <div className="brand">Purple Team</div>
        <ul className="rail-links">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="rail-link"
                aria-current={active === item.id ? 'page' : undefined}
                onClick={navigate(item.id)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="content" aria-labelledby="section-title">
        <h1 id="section-title" className="section-title">
          {current.label}
        </h1>

        {active === 'overview' && (
          <section aria-label="Overview">
            <p className="muted">Overview content will appear here.</p>
          </section>
        )}

        {active === 'four-hats' && (
          <section aria-label="Four Hats">
            <ul className="hat-list">
              {HATS.map((hat) => (
                <li key={hat} className="hat-card">
                  {hat} hat
                </li>
              ))}
            </ul>
          </section>
        )}

        {active === 'settings' && (
          <section aria-label="Settings">
            <p className="muted">Settings are not available in this shell yet.</p>
          </section>
        )}

        {active === 'agent-panel' && (
          <section className="agent-panel" aria-label="Agent Panel">
            <p className="muted">
              The agent is wired in the next phase. Nothing you type here is sent yet.
            </p>
            <form className="composer" onSubmit={onComposerSubmit}>
              <label htmlFor="composer-input" className="visually-hidden">
                Message the agent
              </label>
              <textarea
                id="composer-input"
                rows={3}
                value={draft}
                placeholder="Message the agent"
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="composer-actions">
                <button type="submit" className="send" disabled>
                  Send
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
