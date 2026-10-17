import { describe, expect, it } from 'vitest';
import { resolveProviderModels } from '../config/provider-models';

const jsonResponse = (body: unknown) => async () => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => '',
});

describe('keyless model listing', () => {
  it('lists the public OpenRouter catalog without an API key', async () => {
    const result = await resolveProviderModels('openrouter', {
      fetchImpl: jsonResponse({ data: [{ id: 'openrouter/model-a' }] }),
      refresh: true,
    });

    expect(result.source).toBe('live');
    expect(result.models.map((m) => m.id)).toEqual(['openrouter/model-a']);
  });

  it('still reports unavailable for a keyed provider that has no key', async () => {
    const result = await resolveProviderModels('anthropic', {
      fetchImpl: jsonResponse({ data: [{ id: 'should-not-be-fetched' }] }),
      refresh: true,
    });

    expect(result.source).toBe('unavailable');
    expect(result.models).toEqual([]);
  });
});
