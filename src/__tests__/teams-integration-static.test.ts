import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Wave-B integration contract (SPE-9601): the Dark Purple team archetypes are
// spawnable operators in the server. These tests pin the WIRING — that the server
// imports the teams module as the single source of truth, that VALID_ARCHETYPES
// covers black/blue/white, that laneToolGrants delegates the three teams' kits to
// teamToolGrants(), and that the purple synthesis route exists and reads the
// findings ledger READ-ONLY — not the teams module's own text (that is pinned by
// teams-modules.test.ts / teams-archetypes.test.ts).

const server = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');
const teamsIndex = readFileSync(join(process.cwd(), 'src/teams/index.ts'), 'utf8');
const teamsPurple = readFileSync(join(process.cwd(), 'src/teams/purple.ts'), 'utf8');

function block(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `missing start marker ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end, `missing end marker ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Dark Purple teams server integration', () => {
  it('server imports the teams module (single source of truth), never the reverse', () => {
    expect(server).toContain("from './teams/index.js'");
    expect(server).toContain("from './teams/purple-synthesize-routes.js'");
    // Dependency direction: server → teams only. The teams modules must not reach
    // back into the server (they stay pure, no server state, no I/O).
    expect(teamsIndex).not.toMatch(/from ['"]\.\.\/server(\.js)?['"]/);
    expect(teamsPurple).not.toMatch(/from ['"]\.\.\/server(\.js)?['"]/);
  });

  it('VALID_ARCHETYPES covers black, blue, and white via TEAM_ARCHETYPES', () => {
    const valid = block(
      server,
      'const VALID_ARCHETYPES: OperatorArchetype[]',
      '\n\n',
    );

    // Delegated coverage, not a drifted literal copy: the server spreads the
    // teams module's ids, so the archetype list stays the teams module's to own.
    expect(valid).toContain('...TEAM_ARCHETYPES');

    // The teams module (single source of truth, read like the other static pins)
    // must export all three team ids in TEAM_ARCHETYPES.
    const teamArchetypes = block(
      teamsIndex,
      'export const TEAM_ARCHETYPES',
      '\n\n',
    );

    for (const archetype of ['black', 'blue', 'white']) {
      expect(teamArchetypes, `TEAM_ARCHETYPES missing team archetype "${archetype}"`).toContain(`'${archetype}'`);
    }
  });

  it('laneToolGrants delegates the team kits to teamToolGrants()', () => {
    const grants = block(server, 'function laneToolGrants(', 'function operationModeForDraft(');

    expect(grants).toContain('teamToolGrants(operator)'); // delegation call
    for (const archetype of ['black', 'blue', 'white']) {
      expect(grants).toContain(`case '${archetype}'`);
    }
    // Pre-existing archetypes keep the catalog-slice behavior: no team case may
    // divert recon/scanner/ghost/analyst/coordinator from their kit derivation.
    expect(grants).toContain("case 'analyst': default: domain = ranked; break;");
  });

  it('exposes the team grant table and the purple synthesis route', () => {
    expect(server).toContain("app.get('/api/teams/tool-grants'");
    expect(server).toContain("app.post('/api/teams/purple/synthesize'");
  });

  it('purple synthesis routes: server delegates, handler is 201 with DarkPurpleSynthesis + verdictSource + counts event', () => {
    const route = readFileSync(join(process.cwd(), 'src/teams/purple-synthesize-routes.ts'), 'utf8');
    // The literals stay in server.ts; the handler bodies moved to the purple route module.
    expect(server).toContain("app.get('/api/teams/purple/synthesize', purpleSynthesizeRoutes.getSynthesis);");
    expect(server).toContain("app.post('/api/teams/purple/synthesize', purpleSynthesizeRoutes.postSynthesis);");

    expect(route).toContain('synthesize({');
    expect(route).toContain('res.status(201).json(redactSecrets({ ...synthesis, verdictSource }))');
    // The counts event reaches the SSE stream + state event log.
    expect(route).toContain("emitContractEvent('purple.synthesis', {");
    expect(route).toContain('unresolved: synthesis.unresolved.length');
    expect(route).toContain('nextMissions: synthesis.nextMissions.length');
    // Non-array inputs are rejected, never coerced. verdicts is optional; when present it must be an array.
    expect(route).toMatch(/!Array\.isArray\(findingsInput\)/);
    expect(route).toMatch(/!Array\.isArray\(detections\)/);
    expect(route).toMatch(/!Array\.isArray\(rawVerdicts\)/);
    expect(route).toMatch(/400/);
  });

  it('purple synthesis reads the findings ledger READ-ONLY (merge, never mutate)', () => {
    const route = readFileSync(join(process.cwd(), 'src/teams/purple-synthesize-routes.ts'), 'utf8');
    expect(server).toContain('findings: findingsLedger,');
    expect(route).toContain('findings.get(');
    expect(route).not.toMatch(/findings\.set\(/);
    expect(route).not.toMatch(/findings\.delete\(/);
  });
});
