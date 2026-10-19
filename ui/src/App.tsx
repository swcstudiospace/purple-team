import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import Overview from './pages/Overview';
import GitHub from './pages/GitHub';
import Reports from './pages/Reports';
import AgentPanel from './components/AgentPanel';
import { escapeGuard } from './components/workbench/focus';
import { readPrefs, savePrefs, type RailState } from './components/workbench/prefs';

type SectionId = 'overview' | 'github' | 'agent-panel' | 'reports';

const NAV_ITEMS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'github', label: 'GitHub' },
  { id: 'agent-panel', label: 'Agent Panel' },
  { id: 'reports', label: 'Reports' },
];

// `#generative-ui` deep links land on the merged agent panel (phase 36 §6.2);
// the hash is rewritten with replace so history stays clean.
const LEGACY_SECTION_REDIRECTS: Record<string, SectionId> = {
  'generative-ui': 'agent-panel',
};

// Four Hats and Settings are still served by the static pages under /ui until
// they are migrated; linking to them keeps one source of truth per screen.
const STATIC_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/ui/hats.html', label: 'Four Hats (static)' },
  { href: '/ui/settings.html', label: 'Settings (static)' },
];

function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#/, '');
  if (Object.hasOwn(LEGACY_SECTION_REDIRECTS, id)) return LEGACY_SECTION_REDIRECTS[id];
  return NAV_ITEMS.some(item => item.id === id) ? (id as SectionId) : 'overview';
}

/** Resolves the active section and rewrites legacy hashes in place. */
function normalizeHash(): SectionId {
  const id = window.location.hash.replace(/^#/, '');
  const mapped: SectionId | undefined = LEGACY_SECTION_REDIRECTS[id];
  if (mapped !== undefined && mapped !== id) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + `#${mapped}`);
  }
  return sectionFromHash(window.location.hash);
}

export default function App() {
  const [active, setActive] = useState<SectionId>(() => normalizeHash());
  const [railState, setRailState] = useState<RailState>(() => readPrefs().railState);

  const railId = 'app-rail';
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const preFocusRailRef = useRef<RailState>('expanded');
  const firstSectionChange = useRef(true);

  const isWorkbench = active === 'agent-panel';

  const applyRailState = useCallback((next: RailState) => {
    if (next !== 'hidden') preFocusRailRef.current = next;
    setRailState(next);
    savePrefs({ railState: next, focusMode: next === 'hidden' });
  }, []);

  const exitFocusMode = useCallback(() => {
    applyRailState(preFocusRailRef.current);
  }, [applyRailState]);

  // The URL hash is the source of truth for the section, so deep links and
  // browser back/forward work. Legacy hashes are rewritten, not pushed.
  useEffect(() => {
    const onHash = () => setActive(normalizeHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Section switches move focus to the section title (phase 36 §7).
  useEffect(() => {
    if (firstSectionChange.current) {
      firstSectionChange.current = false;
      return;
    }
    document.getElementById('section-title')?.focus();
  }, [active]);

  // Escape exits focus mode only when no palette, pending confirm, or dialog
  // owns it first (§2.2); those consumers consume the event before this and
  // keep escapeGuard current.
  useEffect(() => {
    if (!isWorkbench || railState !== 'hidden') return undefined;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if ((event as globalThis.KeyboardEvent & { isComposing?: boolean }).isComposing) return;
      if (escapeGuard.paletteOpen || escapeGuard.confirmPending || escapeGuard.dialogOpen) return;
      event.preventDefault();
      exitFocusMode();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isWorkbench, railState, exitFocusMode]);

  // Alt+1..4 jump between rail sections; ignored while composing (§2.2).
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if ((event as globalThis.KeyboardEvent & { isComposing?: boolean }).isComposing) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
        return;
      }
      const item = NAV_ITEMS[Number(event.key) - 1];
      if (item === undefined) return;
      event.preventDefault();
      if (window.location.hash !== `#${item.id}`) window.location.hash = item.id;
      else setActive(item.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navigate = (id: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (window.location.hash !== `#${id}`) window.location.hash = id;
    setActive(id);
  };

  // Roving arrow keys on the rail while the workbench owns the shell (§2.2).
  const handleRailKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const count = linkRefs.current.length;
    if (count === 0) return;
    const current = linkRefs.current.findIndex(link => link === document.activeElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (current + 1 + count) % count;
    else if (event.key === 'ArrowUp') next = (current <= 0 ? count : current) - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    if (next === null) return;
    event.preventDefault();
    linkRefs.current[next]?.focus();
  };

  const current = NAV_ITEMS.find(item => item.id === active) ?? NAV_ITEMS[0];
  const collapsed = isWorkbench && railState === 'collapsed';
  const railHidden = isWorkbench && railState === 'hidden';
  const shellClass = isWorkbench ? 'shell shell--workbench' : 'shell';
  const railClass = isWorkbench ? `rail rail--${railState}` : 'rail';

  const railLinks = (
    <ul className="rail-links">
      {NAV_ITEMS.map((item, index) => (
        <li key={item.id}>
          <a
            ref={el => {
              linkRefs.current[index] = el;
            }}
            href={`#${item.id}`}
            className="rail-link"
            aria-current={active === item.id ? 'page' : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? item.label : undefined}
            onClick={navigate(item.id)}
          >
            {collapsed ? <span className="rail-icon" aria-hidden="true">{item.label.charAt(0)}</span> : item.label}
          </a>
        </li>
      ))}
      {STATIC_LINKS.map((link, index) => (
        <li key={link.href}>
          <a
            ref={el => {
              linkRefs.current[NAV_ITEMS.length + index] = el;
            }}
            href={link.href}
            className="rail-link"
            aria-label={collapsed ? link.label : undefined}
            title={collapsed ? link.label : undefined}
          >
            {collapsed ? <span className="rail-icon" aria-hidden="true">{link.label.charAt(0)}</span> : link.label}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={shellClass}>
      <nav
        className={railClass}
        aria-label="Primary"
        id={railId}
        onKeyDown={isWorkbench ? handleRailKeyDown : undefined}
      >
        <div className="brand">{collapsed ? 'PT' : 'Purple Team'}</div>
        {railLinks}
        {isWorkbench && !railHidden && (
          <div className="rail-foot">
            <button
              type="button"
              className="rail-toggle"
              aria-expanded={railState === 'expanded'}
              aria-controls={railId}
              title={railState === 'expanded' ? 'Collapse rail to icons' : 'Expand rail'}
              onClick={() => applyRailState(railState === 'expanded' ? 'collapsed' : 'expanded')}
            >
              {railState === 'expanded' ? '‹ Collapse' : '› Expand'}
            </button>
            {railState !== 'hidden' && (
              <button
                type="button"
                className="rail-toggle"
                title="Hide the rail for focus mode (Esc exits)"
                onClick={() => applyRailState('hidden')}
              >
                ◎ Focus
              </button>
            )}
          </div>
        )}
      </nav>

      <main className={isWorkbench ? 'content content--workbench' : 'content'} aria-labelledby="section-title">
        <h1
          id="section-title"
          className={isWorkbench ? 'section-title section-title--workbench' : 'section-title'}
          tabIndex={-1}
        >
          {current.label}
        </h1>

        {active === 'overview' && <Overview />}
        {active === 'github' && <GitHub />}
        {active === 'agent-panel' && <AgentPanel focusMode={railHidden} onExitFocusMode={exitFocusMode} />}
        {active === 'reports' && <Reports />}
      </main>
    </div>
  );
}
