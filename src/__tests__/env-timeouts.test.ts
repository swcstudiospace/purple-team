import { describe, expect, it } from 'vitest';
import { readPositiveTimeoutEnv } from '../config/env-timeouts.js';

const NAME = 'T3MP3ST_TEST_TIMEOUT_MS';

describe('readPositiveTimeoutEnv', () => {
  it('returns undefined when the variable is unset', () => {
    expect(readPositiveTimeoutEnv(NAME, {})).toBeUndefined();
  });

  it('treats blank values as unset', () => {
    expect(readPositiveTimeoutEnv(NAME, { [NAME]: '' })).toBeUndefined();
    expect(readPositiveTimeoutEnv(NAME, { [NAME]: '   ' })).toBeUndefined();
  });

  it('rejects non-numeric, zero and negative values', () => {
    for (const raw of ['soon', '0', '-5']) {
      expect(readPositiveTimeoutEnv(NAME, { [NAME]: raw })).toBeUndefined();
    }
  });

  it('returns the parsed value for positive numbers', () => {
    expect(readPositiveTimeoutEnv(NAME, { [NAME]: '1500' })).toBe(1500);
    expect(readPositiveTimeoutEnv(NAME, { [NAME]: '0.5' })).toBe(0.5);
  });
});
