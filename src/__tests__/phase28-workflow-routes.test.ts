import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runBlueCoverageStage } from '../teams/blue/workflow.js';
import { runBlackWorkflow } from '../teams/black/workflow.js';
import { stageRoeAudit } from '../teams/white/workflow.js';

// Route-contract pins for the phase 28 POST team routes.
//
// server.ts starts listening on import, so (like blue/black/white-routes-static
// tests) the route half of this file asserts against the server source instead
// of importing the app or hitting handlers over HTTP. The workflow half below
// imports the pure phase 27 functions directly and exercises the exact
// pass-through semantics the routes promise.

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

const POST_ROUTES = [
  '/api/teams/blue/coverage',
  '/api/teams/black/workflow',
  '/api/teams/white/stage',
];

function quotedPathCount(path: string): number {
  return serverSource.split(`'${path}'`).length - 1;
}

function routeBlock(path: string): string {
  const marker = `app.post('${path}'`;
  const start = serverSource.indexOf(marker);
  expect(start, `missing route registration ${marker}`).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\n});', start);
  expect(end, `unterminated route block for ${path}`).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe('phase 28 workflow routes (source pins)', () => {
  it('registers each workflow route exactly once as POST', () => {
    for (const route of POST_ROUTES) {
      expect(quotedPathCount(route), `${route} must be registered exactly once`).toBe(1);
      expect(serverSource, `${route} must be a POST route`).toContain(`app.post('${route}'`);
    }
  });

  it('leaves the existing team GET handlers untouched', () => {
    for (const route of [
      '/api/teams/blue/gaps',
      '/api/teams/blue/hardening',
      '/api/teams/blue/rules',
      '/api/teams/black/cover',
      '/api/teams/black/exfil',
      '/api/teams/black/noise',
      '/api/teams/white/roe',
      '/api/teams/white/evidence',
      '/api/teams/white/report-audit',
    ]) {
      expect(serverSource, `${route} GET handler must still exist`).toContain(`app.get('${route}'`);
    }
  });

  it('imports the three phase 27 workflow entry points', () => {
    expect(serverSource).toContain('runBlueCoverageStage');
    expect(serverSource).toContain("from './teams/blue/workflow.js'");
    expect(serverSource).toContain('runBlackWorkflow');
    expect(serverSource).toContain("from './teams/black/workflow.js'");
    expect(serverSource).toContain('stageRoeAudit');
    expect(serverSource).toContain("from './teams/white/workflow.js'");
  });

  it('blue coverage passes the body through and answers validation throws with 400', () => {
    const block = routeBlock('/api/teams/blue/coverage');
    expect(block).toContain('runBlueCoverageStage(req.body)');
    expect(block).toContain('res.status(400)');
    expect(block).toContain('redactSecrets(');
    expect(block, 'missing artifacts must fail closed in the workflow, never map to covered here')
      .not.toContain('covered');
  });

  it('black workflow passes caller paths through untouched', () => {
    const block = routeBlock('/api/teams/black/workflow');
    expect(block).toContain('runBlackWorkflow(');
    expect(block, 'must not substitute an empty path array').not.toContain('paths: []');
    expect(block, 'must not default paths').not.toContain('?? []');
  });

  it('white stage calls stageRoeAudit(roeText, actions, meta) with no receipt mint', () => {
    const block = routeBlock('/api/teams/white/stage');
    expect(block).toContain('stageRoeAudit(body.roeText, body.actions, body.meta)');
    for (const route of POST_ROUTES) {
      expect(routeBlock(route), `${route} must not mint receipts`).not.toContain('recordReceipt');
    }
    expect(serverSource.split('recordReceipt(').length - 1, 'no new recordReceipt call sites (definition + ROE PUT writer only)').toBe(2);
  });
});

describe('phase 28 workflow pass-through semantics', () => {
  it('blue coverage fails closed without artifacts, never covered', () => {
    const result = runBlueCoverageStage({
      runId: 'run_1',
      missionId: 'm_1',
      family: 'web_api',
      artifactIds: [],
      artifactBytes: '',
      findings: [],
      telemetry: [],
    });
    expect(result.status).toBe('insufficient-evidence');
    expect(result.status).not.toBe('complete');
  });

  it('blue coverage throws a validation error on an unknown family', () => {
    expect(() =>
      runBlueCoverageStage({
        runId: 'run_1',
        missionId: 'm_1',
        family: 'nope',
        artifactIds: [],
        artifactBytes: '',
        findings: [],
        telemetry: [],
      }),
    ).toThrow();
  });

  it('black workflow analyzes caller-supplied paths instead of an empty default', () => {
    const withPaths = runBlackWorkflow({
      actions: ['review login flow'],
      paths: [{ id: 'p1', channel: 'dns-tunnel', volumeMb: 1 }],
    });
    const withoutPaths = runBlackWorkflow({ actions: ['review login flow'] });
    expect(withPaths.outcome).toBe('complete');
    expect(withPaths.evidence?.refs.some((ref) => ref.includes('p1'))).toBe(true);
    expect(withPaths.reason).not.toBe(withoutPaths.reason);
  });

  it('white stage echoes caller meta without minting stamps', () => {
    const roeText = [
      'ROE for test scope',
      'Allowed targets: example.com',
      'Forbidden: everything else',
    ].join('\n');
    const result = stageRoeAudit(roeText, [], { revision: 'r1', textHash: 'h1' });
    if (result.ok) {
      expect(result.revision).toBe('r1');
      expect(result.textHash).toBe('h1');
    }
  });
});
