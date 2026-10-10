import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

const BLACK_ROUTES = ['/api/teams/black/cover', '/api/teams/black/exfil', '/api/teams/black/noise'];
// Routes that read the plan store (exfil costs no paths today, so it stays store-free).
const PLAN_SOURCED_ROUTES = ['/api/teams/black/cover', '/api/teams/black/noise'];

function quotedPathCount(path: string): number {
  return serverSource.split(`'${path}'`).length - 1;
}

function routeBlock(path: string): string {
  const marker = `app.get('${path}'`;
  const start = serverSource.indexOf(marker);
  expect(start, `missing route registration ${marker}`).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\n});', start);
  expect(end, `unterminated route block for ${path}`).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe('black review routes (source pins)', () => {
  it('registers each black route exactly once', () => {
    for (const route of BLACK_ROUTES) {
      expect(quotedPathCount(route), `${route} must be registered exactly once`).toBe(1);
    }
  });

  it('exposes the black reviews only as read-only GET routes', () => {
    for (const route of BLACK_ROUTES) {
      expect(serverSource, `${route} must be a GET route`).toContain(`app.get('${route}'`);
      expect(serverSource, `${route} must not be a POST route`).not.toContain(`app.post('${route}'`);
    }
  });

  it('never answers 500 from a black route block (no plan stays a 200 zeroed report)', () => {
    for (const route of BLACK_ROUTES) {
      expect(routeBlock(route), `${route} must not answer 500`).not.toContain('res.status(500');
    }
  });

  it('black route blocks consume the landed black v2 engine exports', () => {
    expect(routeBlock('/api/teams/black/cover')).toContain('opsecReview(');
    expect(routeBlock('/api/teams/black/exfil')).toContain('exfilCostModel(');
    expect(routeBlock('/api/teams/black/noise')).toContain('structuredNoiseBudget(');
  });

  it('plan-sourced black routes read the mission-draft store read-only with no second store', () => {
    for (const route of PLAN_SOURCED_ROUTES) {
      const block = routeBlock(route);
      expect(block, `${route} must source its plan from missionDrafts`).toContain('missionDrafts.values()');
      expect(block, `${route} must never mutate the plan store`).not.toContain('missionDrafts.set');
    }
  });
});
