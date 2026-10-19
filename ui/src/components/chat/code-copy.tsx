import { isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAnnounce } from './announce';

/**
 * Copy-to-clipboard affordance for fenced code blocks rendered by the markdown
 * message renderer. The raw code text is recovered from the highlighted React
 * children, so what lands on the clipboard is the source, not markup.
 */

interface CodeElementShape {
  className?: unknown;
  children?: ReactNode;
}

/** Recovers raw text from highlighted React children (hljs spans nest arbitrarily). */
export function codeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    let text = '';
    for (const child of node) text += codeText(child);
    return text;
  }
  if (isValidElement(node)) {
    return codeText((node.props as CodeElementShape).children);
  }
  return '';
}

/** Finds the `<code>` element react-markdown rendered inside a `<pre>`. */
function findCodeElement(node: ReactNode): CodeElementShape | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findCodeElement(child);
      if (found !== null) return found;
    }
    return null;
  }
  if (isValidElement(node)) {
    if (node.type === 'code') return node.props as CodeElementShape;
    return findCodeElement((node.props as CodeElementShape).children);
  }
  return null;
}

function CopyButton({ text }: { text: string }) {
  const announce = useAnnounce();
  const [copied, setCopied] = useState<'idle' | 'ok' | 'error'>('idle');
  const resetTimerRef = useRef<number | null>(null);
  const canCopy =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard === 'object' &&
    navigator.clipboard !== null &&
    typeof navigator.clipboard.writeText === 'function';

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  if (!canCopy) {
    return (
      <button type="button" className="chat-code-copy" disabled aria-label="Copy code unavailable">
        Copy
      </button>
    );
  }

  function settle(outcome: 'ok' | 'error'): void {
    setCopied(outcome);
    announce(outcome === 'ok' ? 'Copied code.' : 'Copy failed.');
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      setCopied('idle');
    }, 2000);
  }

  function copy(): void {
    navigator.clipboard
      .writeText(text)
      .then(() => settle('ok'))
      .catch(() => settle('error'));
  }

  const label = copied === 'ok' ? 'Copied' : copied === 'error' ? 'Copy failed' : 'Copy';
  return (
    <button
      type="button"
      className={`chat-code-copy${copied === 'ok' ? ' chat-code-copy--copied' : ''}`}
      aria-label="Copy code"
      onClick={copy}
    >
      {label}
    </button>
  );
}

/**
 * Renders one fenced block as `<figure><figcaption/><pre><code class="hljs
 * language-*">…</code></pre></figure>` plus the per-block copy button. The
 * children come from react-markdown's `pre` override; highlighted spans are
 * passed through untouched (class-based, never HTML injection). Blocks whose
 * code carries only the inline marker (no info string) fall back to the base
 * `hljs` class.
 */
export function CodeBlock({ children }: { children?: ReactNode }) {
  const codeElement = findCodeElement(children);
  const className = typeof codeElement?.className === 'string' ? codeElement.className : '';
  const isBlockClassName = className !== '' && className !== 'chat-code-inline';
  const language = /language-([\w+#.-]+)/.exec(className)?.[1];
  const raw = codeText(codeElement !== null ? codeElement.children ?? null : children);
  return (
    <figure className="chat-code">
      <figcaption className="chat-code-bar">
        <span className="chat-code-lang">{language ?? 'code'}</span>
        <CopyButton text={raw} />
      </figcaption>
      <pre className="chat-code-pre">
        <code className={isBlockClassName ? className : 'hljs'}>
          {codeElement !== null ? codeElement.children : children}
        </code>
      </pre>
    </figure>
  );
}
