import { describe, expect, it } from 'vitest';
import { purpleRunMatches } from '../chat/purple-run-match';

describe('purpleRunMatches', () => {
  it('matches an ingest card to a mission-id event through the card missionId', () => {
    const card = { runId: 'run-ingest-1', missionId: 'mission-1' };
    const missionEvent = { runId: 'mission-1' };
    expect(purpleRunMatches(card, missionEvent)).toBe(true);
  });

  it('matches a mission event that carries missionId to the card that holds that mission', () => {
    const card = { runId: 'run-ingest-1', missionId: 'mission-1' };
    const stopEvent = { runId: 'mission-1', missionId: 'mission-1' };
    expect(purpleRunMatches(card, stopEvent)).toBe(true);
  });

  it('matches a mission event carrying missionId to a card whose runId is that mission', () => {
    const card = { runId: 'mission-1' };
    const event = { runId: 'tick-run', missionId: 'mission-1' };
    expect(purpleRunMatches(card, event)).toBe(true);
  });

  it('does not match an unrelated run', () => {
    const card = { runId: 'run-ingest-2', missionId: 'mission-2' };
    const event = { runId: 'run-ingest-1', missionId: 'mission-1' };
    expect(purpleRunMatches(card, event)).toBe(false);
  });

  it('does not match a card without a missionId to an unrelated mission event', () => {
    const card = { runId: 'run-ingest-1' };
    const event = { runId: 'mission-9' };
    expect(purpleRunMatches(card, event)).toBe(false);
  });
});
