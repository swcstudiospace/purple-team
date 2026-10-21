/**
 * GenUi sandbox frame entry (phase 36 §6.1) — the second Vite entry
 * (ui/genui.html). This bundle renders the existing OpenUI Lang `Renderer`
 * with `genUiLibrary` inside the sandboxed document: no storage access
 * (opaque origin throws on localStorage), no network (CSP connect-src
 * 'none'), no DOM access to the parent. All state arrives via validated
 * postMessage; action events go back the same way.
 */

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer } from '@openuidev/react-lang';
import GenUiErrorBoundary from './GenUiErrorBoundary';
import { genUiLibrary } from './library';
import { clampFrameHeight, parseParentMessage, type GenUiFrameToParent } from '../../../src/genui/frameProtocol';
import './genui.css';
import './frame.css';

const DETAIL_CHARS = 300;

/** App origin captured from the src URL query at bootstrap (§6.1). */
function bootstrapOrigin(): string {
  const param = new URLSearchParams(window.location.search).get('origin');
  return param !== null && param !== '' ? param : window.location.origin;
}

const PARENT_ORIGIN = bootstrapOrigin();

/** Frame→parent messages target the app origin precisely, never '*'. */
function postToParent(message: GenUiFrameToParent): void {
  window.parent.postMessage(message, PARENT_ORIGIN);
}

/** The retained error boundary, extended to report trips to the parent. */
class FrameBoundary extends GenUiErrorBoundary {
  componentDidCatch(error: unknown): void {
    const raw = error instanceof Error ? error.message : 'The generated UI failed to render.';
    postToParent({ type: 'genui-error', message: raw.slice(0, DETAIL_CHARS) });
  }
}

function GenUiFrameApp() {
  const [state, setState] = useState<{ source: string; streaming: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    postToParent({ type: 'genui-ready' });
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (event.origin !== PARENT_ORIGIN) return;
      const parsed = parseParentMessage(event.data);
      if (parsed === null) return;
      setState({ source: parsed.source, streaming: parsed.streaming });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Height auto-resize: report on mount, on content change, and on resize.
  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return undefined;
    const report = () => {
      postToParent({ type: 'genui-height', px: clampFrameHeight(element.getBoundingClientRect().height) });
    };
    const observer = new ResizeObserver(report);
    observer.observe(element);
    report();
    return () => observer.disconnect();
  }, [state]);

  return (
    <div className="genui-panel genui-frame-root" ref={rootRef}>
      {state === null || state.source === '' ? (
        <p className="genui-muted">Waiting for generated UI…</p>
      ) : (
        <FrameBoundary source={state.source}>
          <Renderer
            response={state.source}
            library={genUiLibrary}
            isStreaming={state.streaming}
            onAction={event => {
              const message = event.humanFriendlyMessage || event.type;
              postToParent({ type: 'genui-action', message: message.slice(0, 2000) });
            }}
          />
        </FrameBoundary>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('GenUi frame: missing #root element in genui.html');
}

createRoot(container).render(
  <StrictMode>
    <GenUiFrameApp />
  </StrictMode>,
);
