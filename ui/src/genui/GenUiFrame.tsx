/**
 * GenUiFrame — renders generated OpenUI Lang inside a message, in a sandboxed
 * iframe (phase 36 §6.1). The frame document is the second Vite entry
 * (/app/genui.html) so everything stays self-hosted under /app/assets — no
 * data:/blob: URL, no external origin.
 *
 * Security posture: sandbox="allow-scripts" ONLY (opaque origin — the frame
 * cannot read the app's localStorage, cookies, or DOM), no allow-forms /
 * allow-popups / allow-top-navigation, referrerPolicy="no-referrer", and the
 * frame document carries its own CSP with connect-src 'none' (genui.html).
 * Inbound messages must validate: opaque origin ("null"), matching
 * contentWindow, and the frameProtocol allowlist — anything else is dropped
 * silently. If genui-ready does not arrive within 3s, or genui-error fires,
 * the raw OpenUI Lang source renders in a <pre> instead — the thread never
 * blanks.
 */

import { useEffect, useRef, useState } from 'react';
import { MIN_FRAME_HEIGHT_PX, OPAQUE_ORIGIN, clampFrameHeight, parseFrameMessage } from './frameProtocol';
import './genui-inline.css';

const READY_TIMEOUT_MS = 3000;
const MAX_ACTIONS = 20;
const FRAME_SRC = `/app/genui.html?origin=${encodeURIComponent(window.location.origin)}`;

/** Type guard for a stored `data-genui` part payload (persisted threads reload unvalidated). */
export function isGenUiData(data: unknown): data is { source: string; streaming: boolean } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>).source === 'string' &&
    typeof (data as Record<string, unknown>).streaming === 'boolean'
  );
}

interface GenUiFrameProps {
  /** Raw OpenUI Lang source. */
  source: string;
  /** True while chunks still stream into the source. */
  streaming: boolean;
  /** Accessible name for the iframe. */
  title?: string;
}

export function GenUiFrame({ source, streaming, title = 'Generated UI preview (sandboxed)' }: GenUiFrameProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [height, setHeight] = useState(MIN_FRAME_HEIGHT_PX);
  const [actions, setActions] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 3s raw-text fallback (§6.1): a frame that never reports ready is replaced.
  useEffect(() => {
    if (ready || failed !== null) return undefined;
    const timer = window.setTimeout(() => {
      setFailed('The sandbox did not respond in time; the raw OpenUI Lang source is shown instead.');
    }, READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [ready, failed]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== OPAQUE_ORIGIN) return;
      const frame = iframeRef.current;
      if (frame === null || event.source !== frame.contentWindow) return;
      const message = parseFrameMessage(event.data);
      if (message === null) return;
      if (message.type === 'genui-ready') {
        setReady(true);
      } else if (message.type === 'genui-height') {
        setHeight(clampFrameHeight(message.px));
      } else if (message.type === 'genui-action') {
        setActions(previous => [...previous.slice(-(MAX_ACTIONS - 1)), message.message]);
      } else {
        setFailed(`The generated UI failed: ${message.message}`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Source pushes: on ready, and again for every streamed chunk. The target
  // window's origin is opaque, so no concrete targetOrigin can match — the
  // frame validates source and origin on its side (frameProtocol header).
  useEffect(() => {
    if (!ready || failed !== null) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'genui-source', source, streaming }, '*');
  }, [ready, failed, source, streaming]);

  return (
    <span className="genui-inline">
      {failed !== null ? (
        <span className="genui-inline-fallback">
          <span className="genui-inline-fallback-note">{failed}</span>
          <pre>{source}</pre>
        </span>
      ) : (
        <iframe
          ref={iframeRef}
          className="genui-inline-frame"
          src={FRAME_SRC}
          title={title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{ height: `${height}px` }}
        />
      )}
      {actions.length > 0 && (
        <ul className="genui-inline-actions" aria-label="Generated UI actions">
          {actions.map((action, index) => (
            <li key={`${index}-${action}`}>{action}</li>
          ))}
        </ul>
      )}
    </span>
  );
}
