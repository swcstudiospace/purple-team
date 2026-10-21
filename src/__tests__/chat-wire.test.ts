import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  MAX_HISTORY_CHARS,
  MAX_HISTORY_MESSAGES,
  toWireMessages,
  trimHistory,
} from '../chat/wire';

function text(id: string, body: string, role: 'user' | 'assistant' = 'user'): UIMessage {
  return { id, role, parts: [{ type: 'text', text: body }] };
}

function sized(id: string, chars: number): UIMessage {
  return text(id, 'x'.repeat(chars));
}

describe('toWireMessages', () => {
  it('keeps text parts and drops data and step-start parts', () => {
    const message: UIMessage = {
      id: 'mixed',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'first' },
        { type: 'step-start' },
        { type: 'data-purple-run', id: 'run-1', data: { state: 'running' } } as unknown as UIMessage['parts'][number],
        { type: 'text', text: 'second' },
      ],
    };

    const [wire] = toWireMessages([message]);
    expect(wire.id).toBe('mixed');
    expect(wire.parts).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ]);
  });

  it('drops a message left with no text parts and keeps the rest in order', () => {
    const runOnly: UIMessage = {
      id: 'run-only',
      role: 'assistant',
      parts: [{ type: 'data-genui', id: 'g-1', data: { source: 'x' } } as unknown as UIMessage['parts'][number]],
    };
    const stepOnly: UIMessage = { id: 'step-only', role: 'assistant', parts: [{ type: 'step-start' }] };

    const wire = toWireMessages([text('before', 'hi'), runOnly, stepOnly, text('after', 'there', 'assistant')]);
    expect(wire.map(entry => entry.id)).toEqual(['before', 'after']);
  });
});

describe('trimHistory', () => {
  it(`keeps at most ${MAX_HISTORY_MESSAGES} messages, newest first retained`, () => {
    const messages = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, i) => text(`m${i}`, 'short'));

    const kept = trimHistory(messages);
    expect(kept).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(kept[0].id).toBe('m5');
    expect(kept.at(-1)?.id).toBe(`m${MAX_HISTORY_MESSAGES + 4}`);
  });

  it(`keeps at most ${MAX_HISTORY_CHARS} characters, dropping the oldest first`, () => {
    // Five 12000-character messages total 60000; the newest four fill exactly 48000.
    const messages = Array.from({ length: 5 }, (_, i) => sized(`m${i}`, 12000));

    const kept = trimHistory(messages);
    expect(kept.map(entry => entry.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    const total = kept.reduce((sum, entry) => sum + (entry.parts[0].type === 'text' ? entry.parts[0].text.length : 0), 0);
    expect(total).toBe(MAX_HISTORY_CHARS);
  });

  it('accepts a message exactly at the character cap and rejects one character more', () => {
    expect(trimHistory([sized('exact', MAX_HISTORY_CHARS)]).map(entry => entry.id)).toEqual(['exact']);
    expect(trimHistory([sized('over', MAX_HISTORY_CHARS + 1)])).toEqual([]);
  });

  it('stops at the first message that does not fit instead of skipping over it', () => {
    // "old" would fit alongside "new", but "big" is in the way, so only "new" survives.
    const messages = [sized('old', 100), sized('big', 47000), sized('new', 2000)];
    expect(trimHistory(messages).map(entry => entry.id)).toEqual(['new']);
  });

  it('does not modify the input array', () => {
    const messages = Array.from({ length: MAX_HISTORY_MESSAGES + 3 }, (_, i) => text(`m${i}`, 'x'));
    const snapshot = messages.map(entry => entry.id);

    trimHistory(messages);
    expect(messages.map(entry => entry.id)).toEqual(snapshot);
  });
});
