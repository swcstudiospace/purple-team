import { Suspense, lazy, memo } from 'react';
import type { UIMessage } from 'ai';
import { GenUiFrame, isGenUiData } from '../../genui/GenUiFrame';
import { RunCard, isPurpleRunData } from './run-card';

// Markdown + highlight.js ride a lazy chunk: other sections pay nothing for
// them on first paint, and only the streaming message re-parses per chunk.
const MarkdownView = lazy(() => import('./markdown'));

const ROLE_LABEL: Record<string, string> = {
  user: 'You',
  assistant: 'Model',
};

/** One fenced ```openui block extracted from an assistant text part (§6.1). */
type OpenUiSegment = { kind: 'text'; text: string } | { kind: 'genui'; source: string };

const OPENUI_FENCE = /```openui[^\n]*\n([\s\S]*?)(?:```|$)/g;

/**
 * Splits an assistant text part into prose and OpenUI Lang fences. An
 * unterminated fence (still streaming) is treated as open and rendered from
 * whatever has arrived — the frame's error boundary retries as chunks land.
 */
export function splitOpenUiSegments(text: string): OpenUiSegment[] {
  if (!text.includes('```openui')) return [{ kind: 'text', text }];
  const segments: OpenUiSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(OPENUI_FENCE)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, start) });
    segments.push({ kind: 'genui', source: match[1] ?? '' });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

interface MessageItemProps {
  message: UIMessage;
  /** Shown only on the last assistant message with text, while idle. */
  showRegenerate: boolean;
  onRegenerate: () => void;
  onCancelRun: (runId: string) => void;
}

/**
 * One thread message. Text parts render as sanitized markdown for assistant
 * messages (plain pre-wrap for user echoes), `data-purple-run` parts render
 * the inline run card, `data-genui` parts render the sandboxed GenUi frame,
 * everything else renders nothing. Memoized: settled messages keep object
 * identity, so re-renders stay scoped to what changed.
 */
export const MessageItem = memo(function MessageItem({
  message,
  showRegenerate,
  onRegenerate,
  onCancelRun,
}: MessageItemProps) {
  const isUser = message.role === 'user';
  return (
    <li className={`chat-stream-msg chat-stream-msg--${message.role}`}>
      <span className="chat-stream-role">{ROLE_LABEL[message.role] ?? message.role}</span>
      <div className={isUser ? 'chat-stream-text' : 'chat-md-body'}>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            if (part.text === '') return null;
            if (isUser) {
              return <p key={index}>{part.text}</p>;
            }
            const segments = splitOpenUiSegments(part.text);
            return segments.map((segment, segmentIndex) => {
              if (segment.kind === 'genui') {
                return (
                  <GenUiFrame
                    key={`${index}-${segmentIndex}`}
                    source={segment.source}
                    streaming={part.state === 'streaming'}
                  />
                );
              }
              if (segment.text === '') return null;
              return (
                <Suspense key={`${index}-${segmentIndex}`} fallback={<p className="chat-md chat-md-fallback">{segment.text}</p>}>
                  <MarkdownView text={segment.text} />
                </Suspense>
              );
            });
          }
          if (part.type === 'data-purple-run') {
            return isPurpleRunData(part.data) ? (
              <RunCard key={index} data={part.data} onCancelRun={onCancelRun} />
            ) : null;
          }
          if (part.type === 'data-genui') {
            return isGenUiData(part.data) ? (
              <GenUiFrame
                key={index}
                source={part.data.source}
                streaming={part.data.streaming}
              />
            ) : null;
          }
          return null;
        })}
      </div>
      {showRegenerate && (
        <button type="button" className="chat-regenerate" onClick={onRegenerate}>
          Regenerate
        </button>
      )}
    </li>
  );
});
