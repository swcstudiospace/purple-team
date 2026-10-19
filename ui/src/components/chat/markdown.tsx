import { memo, type JSX } from 'react';
import Markdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './code-copy';
// Self-hosted highlight.js theme: Vite bundles this into /app/assets — no runtime
// external URL, per the shell's self-hosting rule (styles.css:1).
import 'highlight.js/styles/github.css';

/** Props react-markdown hands to overridden elements: intrinsic attributes + `node`. */
type PreProps = JSX.IntrinsicElements['pre'] & ExtraProps;
type CodeProps = JSX.IntrinsicElements['code'] & ExtraProps;
type AnchorProps = JSX.IntrinsicElements['a'] & ExtraProps;

/**
 * Allows only `https:`, `mailto:`, and in-app relative URLs (incl. `#anchors`).
 * Everything else — `http:`, `javascript:`, `data:`, `vbscript:`,
 * protocol-relative `//host` — is blanked before it can reach an href/src
 * attribute. Replaces react-markdown's default transformer.
 */
export function safeUrlTransform(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '' || trimmed.startsWith('//')) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:') return trimmed;
    return '';
  } catch {
    // Not an absolute URL — an in-app relative link or fragment.
    return trimmed;
  }
}

/**
 * Sanitized markdown rendering for assistant text:
 * - no `rehype-raw`: raw HTML in model output stays inert text;
 * - GFM tables/strikethrough/task lists via remark-gfm;
 * - highlight.js spans via rehype-highlight (class-based, synchronous);
 * - fenced blocks through {@linkcode CodeBlock} with per-block copy;
 * - absolute https links open in a new tab with noopener/noreferrer.
 *
 * Memoized: settled messages keep their text string identity, so only the
 * streaming message re-parses.
 */
function MarkdownMessageBase({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={safeUrlTransform}
        components={{
          pre: ({ node: _node, children }: PreProps) => <CodeBlock>{children}</CodeBlock>,
          code: ({ node: _node, className, children, ...rest }: CodeProps) => (
            <code {...rest} className={className ?? 'chat-code-inline'}>
              {children}
            </code>
          ),
          a: ({ node: _node, href, children, ...rest }: AnchorProps) => {
            if (typeof href === 'string' && /^https:/i.test(href)) {
              return (
                <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            }
            return <a {...rest} href={href}>{children}</a>;
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

const MarkdownMessage = memo(MarkdownMessageBase);

export default MarkdownMessage;
