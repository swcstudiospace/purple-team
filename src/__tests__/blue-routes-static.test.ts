import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

const BLUE_ROUTES = ['/api/teams/blue/gaps', '/api/teams/blue/hardening', '/api/teams/blue/rules'];

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

describe('blue detection pipeline routes (source pins)', () => {
  it('registers each blue route exactly once', () => {
    for (const route of BLUE_ROUTES) {
      expect(quotedPathCount(route), `${route} must be registered exactly once`).toBe(1);
    }
  });

  it('exposes the blue pipeline only as read-only GET routes', () => {
    for (const route of BLUE_ROUTES) {
      expect(serverSource, `${route} must be a GET route`).toContain(`app.get('${route}'`);
      expect(serverSource, `${route} must not be a POST route`).not.toContain(`app.post('${route}'`);
    }
  });

  it('never answers 500 from a blue route block (empty ledger stays a 200 empty report)', () => {
    for (const route of BLUE_ROUTES) {
      expect(routeBlock(route), `${route} must not answer 500`).not.toContain('res.status(500');
    }
  });

  it('blue route blocks consume the landed blue pipeline exports', () => {
    const gapsBlock = routeBlock('/api/teams/blue/gaps');
    expect(gapsBlock).toContain('coverageGaps(');
    expect(gapsBlock).toContain('registryTelemetry()');
    expect(routeBlock('/api/teams/blue/hardening')).toContain('hardeningPlan(');
    const rulesBlock = routeBlock('/api/teams/blue/rules');
    expect(rulesBlock).toContain('sigmaRulepack(');
    expect(rulesBlock).toContain('coverageGaps(');
  });

  it('blue routes read the findings ledger read-only with no second findings store', () => {
    for (const route of BLUE_ROUTES) {
      const block = routeBlock(route);
      expect(block, `${route} must source findings from the ledger`).toContain('findingsLedger.values()');
      expect(block, `${route} must never mutate the ledger`).not.toContain('findingsLedger.set');
    }
  });
});
