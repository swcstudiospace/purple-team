import { useEffect, useState, type MouseEvent } from 'react';
import Overview from './pages/Overview';
import Reports from './pages/Reports';
import AgentPanel from './components/AgentPanel';

type SectionId = 'overview' | 'agent-panel' | 'reports';

const NAV_ITEMS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'agent-panel', label: 'Agent Panel' },
  { id: 'reports', label: 'Reports' },
];

// Four Hats and Settings are still served by the static pages under /ui until
// they are migrated; linking to them keeps one source of truth per screen.
const STATIC_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/ui/hats.html', label: 'Four Hats (static)' },
  { href: '/ui/settings.html', label: 'Settings (static)' },
];

function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#/, '');
  return NAV_ITEMS.some((item) => item.id === id) ? (id as SectionId) : 'overview';
}

export default function App() {
  const [active, setActive] = useState<SectionId>(() => sectionFromHash(window.location.hash));

  // The URL hash is the source of truth for the section, so deep links and
  // browser back/forward work.
  useEffect(() => {
    const onHash = () => setActive(sectionFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (id: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (window.location.hash !== `#${id}`) window.location.hash = id;
    setActive(id);
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
          {STATIC_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="rail-link">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="content" aria-labelledby="section-title">
        <h1 id="section-title" className="section-title">
          {current.label}
        </h1>

        {active === 'overview' && <Overview />}
        {active === 'agent-panel' && <AgentPanel />}
        {active === 'reports' && <Reports />}
      </main>
    </div>
  );
}
