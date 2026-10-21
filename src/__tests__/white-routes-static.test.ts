import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');
// Phase 39: server.ts keeps the ROE route literals and delegates; the handler
// bodies live in roe-routes.ts over the append-only ledger (roe-ledger.ts).
const roeRoutesSource = readFileSync(join(process.cwd(), 'src/teams/white/roe-routes.ts'), 'utf8');

const WHITE_ROUTES = ['/api/teams/white/roe', '/api/teams/white/evidence', '/api/teams/white/report-audit'];
// /roe reads and appends the per-mission ROE ledger through roe-routes.ts.
// /evidence and /report-audit read the ledgers. No other store may source a white audit.
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

/** One ROE handler body in roe-routes.ts, from its declaration to the next handler or the return. */
function roeHandler(name: string): string {
  const start = roeRoutesSource.indexOf(`async function ${name}(`);
  expect(start, `missing ROE handler ${name}`).toBeGreaterThanOrEqual(0);
  const tail = roeRoutesSource.slice(start + 1);
  const ends = ['\n  async function ', '\n  return {'].map((marker) => tail.indexOf(marker)).filter((at) => at >= 0);
  const end = ends.length > 0 ? start + 1 + Math.min(...ends) : roeRoutesSource.length;
  return roeRoutesSource.slice(start, end);
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
    for (const route of LEDGER_SOURCED_ROUTES) {
      expect(routeBlock(route), `${route} must not answer 500`).not.toContain('res.status(500');
    }
    for (const handler of ['putRoe', 'getRoe', 'getRoeRevisions', 'getRoeRevision']) {
      expect(roeHandler(handler), `roe ${handler} must not answer 500`).not.toContain('res.status(500');
    }
  });

  it('white route blocks consume the landed white v2 engine exports', () => {
    expect(roeHandler('getRoe')).toContain('parseRoe(');
    expect(roeHandler('getRoe'), 'roe GET derives verdicts through roeAudit').toContain('roeAudit(');
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

  it('only the ROE PUT appends to the ROE ledger, and the roe GET never writes', () => {
    expect(roeRoutesSource.split('store.append(').length - 1, 'exactly one append site in the ROE routes').toBe(1);
    expect(roeHandler('putRoe'), 'the PUT is the append site').toContain('store.append(');
    const getBlock = roeHandler('getRoe');
    expect(getBlock, 'a read-only audit must never append').not.toContain('append(');
    expect(getBlock, 'no store mutation from a read-only audit').not.toContain('missionDrafts.set');
    expect(roeRoutesSource, 'the empty state must be named, not hidden').toContain('no ROE text on record');
  });

  it('the PUT response stamps revision identity', () => {
    expect(roeHandler('putRoe'), 'the PUT response must carry the stamped revision').toContain('revision: line.revision');
  });

  it('the roe GET gates verdicts behind the ok check', () => {
    const getBlock = roeHandler('getRoe');
    expect(getBlock, 'the ok gate must precede verdict construction').toContain('parse.ok');
    expect(getBlock.slice(getBlock.indexOf('parse.ok')), 'verdicts are built only after the ok gate').toContain('roeAudit(');
  });

  it('the roe PUT refuses an empty-string text body with 400 and caps oversize text with 413', () => {
    const putBlock = roeHandler('putRoe');
    expect(putBlock, 'empty-string text must be refused').toContain('text must be a non-empty string');
    expect(putBlock, 'empty-string text answers 400').toContain('res.status(400)');
    expect(putBlock, 'oversize text answers 413').toContain('res.status(413)');
  });

  it('a corrupt ledger falls to the cannot-derive report with no verdicts member', () => {
    const getBlock = roeHandler('getRoe');
    const corruptAt = getBlock.indexOf("status: 'corrupt'");
    expect(corruptAt, 'the GET block must name the corrupt ledger state').toBeGreaterThanOrEqual(0);
    const corruptBranch = getBlock.slice(corruptAt, getBlock.indexOf('return;', corruptAt));
    expect(corruptBranch, 'the corrupt branch must answer the cannot-derive report').toContain('cannotDerive(');
    expect(corruptBranch, 'the corrupt branch must never yield verdicts').not.toContain('verdicts');
  });

  it('every roe emission path is redaction-wrapped', () => {
    const putBlock = roeHandler('putRoe');
    expect(putBlock, 'the PUT success emission must be redaction-wrapped').toContain('res.json(redactSecrets({');
    const getBlock = roeHandler('getRoe');
    const emitted = getBlock.split('.json(').length - 1;
    const wrapped = getBlock.split('.json(redactSecrets(').length - 1;
    expect(wrapped, 'every GET emission path must be redaction-wrapped').toBe(emitted);
    expect(emitted, 'the GET must have emission paths to wrap').toBeGreaterThan(0);
  });
});
