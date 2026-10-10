import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

const WHITE_ROUTES = ['/api/teams/white/roe', '/api/teams/white/evidence', '/api/teams/white/report-audit'];
// Routes that read a ledger store. /roe reads no store today: no field of
// MissionDraft carries ROE text and no second store may be invented.
const LEDGER_SOURCED_ROUTES = ['/api/teams/white/evidence', '/api/teams/white/report-audit'];

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

describe('white adjudication routes (source pins)', () => {
  it('registers each white route exactly once', () => {
    for (const route of WHITE_ROUTES) {
      expect(quotedPathCount(route), `${route} must be registered exactly once`).toBe(1);
    }
  });

  it('exposes the white audits only as read-only GET routes', () => {
    for (const route of WHITE_ROUTES) {
      expect(serverSource, `${route} must be a GET route`).toContain(`app.get('${route}'`);
      expect(serverSource, `${route} must not be a POST route`).not.toContain(`app.post('${route}'`);
    }
  });

  it('never answers 500 from a white route block (empty state stays a 200 honest report)', () => {
    for (const route of WHITE_ROUTES) {
      expect(routeBlock(route), `${route} must not answer 500`).not.toContain('res.status(500');
    }
  });

  it('white route blocks consume the landed white v2 engine exports', () => {
    expect(routeBlock('/api/teams/white/roe')).toContain('parseRoe(');
    expect(routeBlock('/api/teams/white/evidence')).toContain('auditEvidenceChain(');
    expect(routeBlock('/api/teams/white/report-audit')).toContain('auditReport(');
  });

  it('ledger-sourced white routes read the ledgers read-only with no second store', () => {
    expect(routeBlock('/api/teams/white/evidence')).toContain('evidenceLedger.values()');
    const reportBlock = routeBlock('/api/teams/white/report-audit');
    expect(reportBlock).toContain('findingsLedger.values()');
    expect(reportBlock).toContain('evidenceLedger.values()');
    for (const route of LEDGER_SOURCED_ROUTES) {
      const block = routeBlock(route);
      expect(block, `${route} must never mutate the evidence ledger`).not.toContain('evidenceLedger.set');
      expect(block, `${route} must never mutate the findings ledger`).not.toContain('findingsLedger.set');
    }
  });

  it('the roe route invents no ROE store (honest zeroed parse until a text source exists)', () => {
    const block = routeBlock('/api/teams/white/roe');
    expect(block, 'no second ROE store may be invented').not.toContain('roeLedger');
    expect(block, 'no store mutation from a read-only audit').not.toContain('missionDrafts.set');
    expect(block, 'the empty state must be named, not hidden').toContain('no ROE text on record');
  });
});
