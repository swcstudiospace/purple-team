import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

const WHITE_ROUTES = ['/api/teams/white/roe', '/api/teams/white/evidence', '/api/teams/white/report-audit'];
// /roe reads the sanctioned single-slot roeRecords store (written by PUT,
// read by GET). /evidence and /report-audit read the ledgers. No other
// store may source a white audit.
const LEDGER_SOURCED_ROUTES = ['/api/teams/white/evidence', '/api/teams/white/report-audit'];

function quotedPathCount(path: string): number {
  return serverSource.split(`'${path}'`).length - 1;
}

function verbPathCount(verb: string, path: string): number {
  return serverSource.split(`app.${verb}('${path}'`).length - 1;
}

function routeBlock(path: string, verb = 'get'): string {
  const marker = `app.${verb}('${path}'`;
  const start = serverSource.indexOf(marker);
  expect(start, `missing route registration ${marker}`).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\n});', start);
  expect(end, `unterminated route block for ${path}`).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe('white adjudication routes (source pins)', () => {
  it('registers each white route exactly once per verb', () => {
    expect(verbPathCount('get', '/api/teams/white/roe'), 'roe GET must be registered exactly once').toBe(1);
    expect(verbPathCount('put', '/api/teams/white/roe'), 'roe PUT must be registered exactly once').toBe(1);
    for (const route of ['/api/teams/white/evidence', '/api/teams/white/report-audit']) {
      expect(quotedPathCount(route), `${route} must be registered exactly once`).toBe(1);
    }
  });

  it('exposes the white audits as GET plus the sanctioned PUT, never POST', () => {
    for (const route of WHITE_ROUTES) {
      expect(serverSource, `${route} must be a GET route`).toContain(`app.get('${route}'`);
      expect(serverSource, `${route} must not be a POST route`).not.toContain(`app.post('${route}'`);
    }
    expect(serverSource, 'roe must be a PUT route').toContain(`app.put('/api/teams/white/roe'`);
  });

  it('never answers 500 from a white route block (empty state stays a 200 honest report)', () => {
    for (const route of WHITE_ROUTES) {
      expect(routeBlock(route), `${route} must not answer 500`).not.toContain('res.status(500');
    }
    expect(routeBlock('/api/teams/white/roe', 'put'), 'roe PUT must not answer 500').not.toContain('res.status(500');
  });

  it('white route blocks consume the landed white v2 engine exports', () => {
    expect(routeBlock('/api/teams/white/roe')).toContain('parseRoe(');
    expect(routeBlock('/api/teams/white/roe'), 'roe GET derives verdicts through roeAudit').toContain('roeAudit(');
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

  it('the roe PUT owns the sanctioned store and the roe GET never mutates it', () => {
    expect(serverSource, 'the sanctioned ROE store must exist').toContain('roeRecords');
    const putBlock = routeBlock('/api/teams/white/roe', 'put');
    const getBlock = routeBlock('/api/teams/white/roe');
    expect(putBlock, 'only the PUT block may write the sanctioned store').toContain('roeRecords.set');
    expect(getBlock, 'a read-only audit must never write the store').not.toContain('roeRecords.set');
    expect(getBlock, 'no second ROE store may be invented').not.toContain('roeLedger');
    expect(getBlock, 'no store mutation from a read-only audit').not.toContain('missionDrafts.set');
    expect(getBlock, 'the empty state must be named, not hidden').toContain('no ROE text on record');
  });

  it('the stored record carries revision identity', () => {
    expect(routeBlock('/api/teams/white/roe', 'put'), 'the record construction must stamp revision').toContain('revision:');
  });

  it('the roe GET gates verdicts behind the ok check', () => {
    const getBlock = routeBlock('/api/teams/white/roe');
    expect(getBlock, 'the ok gate must precede verdict construction').toContain('parse.ok');
    expect(getBlock.slice(getBlock.indexOf('parse.ok')), 'verdicts are built only after the ok gate').toContain('roeAudit(');
  });

  it('the roe PUT refuses an empty-string text body with 400 and caps oversize text with 413', () => {
    const putBlock = routeBlock('/api/teams/white/roe', 'put');
    expect(putBlock, 'empty-string text must be refused').toContain('text must be a non-empty string');
    expect(putBlock, 'empty-string text answers 400').toContain('res.status(400)');
    expect(putBlock, 'oversize text answers 413').toContain('res.status(413)');
  });

  it('a hash-mismatched record falls to the cannot-derive report with no verdicts member', () => {
    const getBlock = routeBlock('/api/teams/white/roe');
    const mismatchAt = getBlock.indexOf('recomputed !== record.textHash');
    expect(mismatchAt, 'the GET block must recompute-and-compare the text hash').toBeGreaterThanOrEqual(0);
    const mismatchBranch = getBlock.slice(mismatchAt, getBlock.indexOf('return;', mismatchAt));
    expect(mismatchBranch, 'the mismatch branch must name the empty state').toContain('no ROE text on record');
    expect(mismatchBranch, 'the mismatch branch must never yield verdicts').not.toContain('verdicts');
  });

  it('every roe emission path is redaction-wrapped', () => {
    const putEmissions = routeBlock('/api/teams/white/roe', 'put').split('redactSecrets(').length - 1;
    expect(putEmissions, 'the PUT success emission must be redaction-wrapped').toBe(1);
    const getEmissions = routeBlock('/api/teams/white/roe').split('redactSecrets(').length - 1;
    expect(getEmissions, 'all four GET emission paths must be redaction-wrapped').toBe(4);
  });
});
