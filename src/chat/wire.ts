import type { UIMessage } from 'ai';

/** Client-side history cap, kept under the server's `/api/chat` limits (60 messages, 64000 characters). */
export const MAX_HISTORY_MESSAGES = 40;
export const MAX_HISTORY_CHARS = 48000;

function textLength(message: UIMessage): number {
  let total = 0;
  for (const part of message.parts) {
    if (part.type === 'text') total += part.text.length;
  }
  return total;
}

/**
 * Returns the most recent contiguous messages that fit both history limits, dropping the oldest first.
 * Does not modify the input. May return an empty list if the newest message alone exceeds the character cap.
 */
export function trimHistory(messages: UIMessage[]): UIMessage[] {
  const kept: UIMessage[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && kept.length < MAX_HISTORY_MESSAGES; i--) {
    const size = textLength(messages[i]);
    if (chars + size > MAX_HISTORY_CHARS) break;
    chars += size;
    kept.unshift(messages[i]);
  }
  return kept;
}

/**
 * Strips every non-text part (`data-purple-run`, `data-genui`, `step-start`, …)
 * and drops messages left with no text parts. The server forwards whatever it
 * receives to `convertToModelMessages`, which rejects unknown part types — a
 * thread containing a run card would 400 on the next send without this.
 * Applied after `trimHistory`, so the 40 msgs / 48k chars client window stays a
 * strict subset of the server's 60 / 64k.
 */
export function toWireMessages(messages: UIMessage[]): UIMessage[] {
  const wire: UIMessage[] = [];
  for (const message of messages) {
    const parts = message.parts.filter(part => part.type === 'text');
    if (parts.length === 0) continue;
    wire.push(parts.length === message.parts.length ? message : { ...message, parts });
  }
  return wire;
}
