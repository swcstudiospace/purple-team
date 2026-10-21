import { describe, expect, it } from 'vitest';
import {
  clampFrameHeight,
  parseFrameMessage,
  parseParentMessage,
} from '../genui/frameProtocol';

describe('parseFrameMessage (frame → parent allowlist)', () => {
  it.each([
    [{ type: 'genui-ready' }],
    [{ type: 'genui-action', message: 'Run the scan' }],
    [{ type: 'genui-height', px: 320 }],
    [{ type: 'genui-error', message: 'Unparseable source' }],
  ])('accepts allowlisted message %j unchanged', input => {
    expect(parseFrameMessage(input)).toEqual(input);
  });

  it('rejects unknown types and parent-only types', () => {
    expect(parseFrameMessage({ type: 'genui-eval', code: 'alert(1)' })).toBeNull();
    expect(parseFrameMessage({ type: 'genui-source', source: 'x', streaming: false })).toBeNull();
  });

  it.each([null, undefined, 42, true, 'genui-ready', ['genui-ready']])('rejects non-object payload %j', input => {
    expect(parseFrameMessage(input)).toBeNull();
  });

  it('rejects an action with an empty message and accepts one at the 2000-character limit', () => {
    expect(parseFrameMessage({ type: 'genui-action', message: '' })).toBeNull();
    expect(parseFrameMessage({ type: 'genui-action', message: 'a'.repeat(2000) })).not.toBeNull();
    expect(parseFrameMessage({ type: 'genui-action', message: 'a'.repeat(2001) })).toBeNull();
  });

  it('rejects an error message that is missing or empty', () => {
    expect(parseFrameMessage({ type: 'genui-error' })).toBeNull();
    expect(parseFrameMessage({ type: 'genui-error', message: '' })).toBeNull();
  });

  it('rejects non-finite or sub-pixel height values', () => {
    expect(parseFrameMessage({ type: 'genui-height', px: Number.NaN })).toBeNull();
    expect(parseFrameMessage({ type: 'genui-height', px: Number.POSITIVE_INFINITY })).toBeNull();
    expect(parseFrameMessage({ type: 'genui-height', px: 0 })).toBeNull();
    expect(parseFrameMessage({ type: 'genui-height', px: 'tall' })).toBeNull();
  });

  it('passes an oversized height through the schema, then clamps it to 2000', () => {
    const parsed = parseFrameMessage({ type: 'genui-height', px: 5000 });
    expect(parsed?.type).toBe('genui-height');
    expect(parsed?.type === 'genui-height' ? clampFrameHeight(parsed.px) : null).toBe(2000);
  });
});

describe('parseParentMessage (parent → frame allowlist)', () => {
  it('accepts a genui-source message with a boolean streaming flag', () => {
    const input = { type: 'genui-source', source: '<Card />', streaming: true };
    expect(parseParentMessage(input)).toEqual(input);
  });

  it('rejects frame → parent types and malformed source messages', () => {
    expect(parseParentMessage({ type: 'genui-ready' })).toBeNull();
    expect(parseParentMessage({ type: 'genui-source', source: 'x', streaming: 'yes' })).toBeNull();
    expect(parseParentMessage({ type: 'genui-source', source: 'x' })).toBeNull();
    expect(parseParentMessage(null)).toBeNull();
  });

  it('accepts source at the 2,000,000-character limit and rejects one more', () => {
    expect(parseParentMessage({ type: 'genui-source', source: 'a'.repeat(2_000_000), streaming: false })).not.toBeNull();
    expect(parseParentMessage({ type: 'genui-source', source: 'a'.repeat(2_000_001), streaming: false })).toBeNull();
  });
});

describe('clampFrameHeight', () => {
  it('clamps below the 60px floor and above the 2000px ceiling', () => {
    expect(clampFrameHeight(1)).toBe(60);
    expect(clampFrameHeight(-500)).toBe(60);
    expect(clampFrameHeight(2001)).toBe(2000);
    expect(clampFrameHeight(1_000_000)).toBe(2000);
  });

  it('keeps the boundaries and in-range values, rounded to whole pixels', () => {
    expect(clampFrameHeight(60)).toBe(60);
    expect(clampFrameHeight(2000)).toBe(2000);
    expect(clampFrameHeight(300.4)).toBe(300);
    expect(clampFrameHeight(300.6)).toBe(301);
  });

  it('rounds a fraction just under a bound before clamping', () => {
    expect(clampFrameHeight(59.4)).toBe(60);
    expect(clampFrameHeight(1999.6)).toBe(2000);
  });

  it('falls back to the 60px floor for non-finite input', () => {
    expect(clampFrameHeight(Number.NaN)).toBe(60);
    expect(clampFrameHeight(Number.POSITIVE_INFINITY)).toBe(60);
    expect(clampFrameHeight(Number.NEGATIVE_INFINITY)).toBe(60);
  });
});
