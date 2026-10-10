import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Phase-6 hats integration contract: the six specialist hats
// (specter/wraith → black, sentinel/warden → blue, arbiter/auditor → white)
// are spawnable operators in the server. These tests pin the WIRING — that the
// server imports the hats module as the single source of truth, that
// VALID_ARCHETYPES covers the hats via HAT_ARCHETYPES, that laneToolGrants
// delegates the six hats' kits to hatToolGrants(), and that the purple
// synthesis route is unchanged — not the hats module's own text (that is
// pinned by hats-modules.test.ts / hats-archetypes.test.ts).

const server = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');
const hats = readFileSync(join(process.cwd(), 'src/teams/hats.ts'), 'utf8');

function block(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `missing start marker ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end, `missing end marker ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Specialist hats server integration', () => {
  it('server imports the hats module (single source of truth), never the reverse', () => {
    expect(server).toContain("from './teams/hats.js'");
    // Dependency direction: server → teams only. The hats module must not reach
    // back into the server (it stays pure, no server state, no I/O).
    expect(hats).not.toMatch(/from ['"]\.\.\/server(\.js)?['"]/);
  });

  it('VALID_ARCHETYPES covers the six hats via HAT_ARCHETYPES', () => {
    const valid = block(
      server,
      'const VALID_ARCHETYPES: OperatorArchetype[]',
      '\n\n',
    );

    // Delegated coverage, not a drifted literal copy: the server spreads the
    // hats module's ids, so the archetype list stays the hats module's to own.
    expect(valid).toContain('...HAT_ARCHETYPES');
    // The pre-existing team spread stays — hats are additive, not a replacement.
    expect(valid).toContain('...TEAM_ARCHETYPES');

    // The hats module (single source of truth, read like the other static pins)
    // must export all six hat ids in HAT_ARCHETYPES.
    const hatArchetypes = block(
      hats,
      'export const HAT_ARCHETYPES',
      '\n\n',
    );

    for (const archetype of ['specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor']) {
      expect(hatArchetypes, `HAT_ARCHETYPES missing hat archetype "${archetype}"`).toContain(`'${archetype}'`);
    }
  });

  it('laneToolGrants delegates the hat kits to hatToolGrants()', () => {
    const grants = block(server, 'function laneToolGrants(', 'function operationModeForDraft(');

    expect(grants).toContain('hatToolGrants(operator'); // delegation call
    for (const archetype of ['specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor']) {
      expect(grants).toContain(`case '${archetype}'`);
    }
    // Pre-existing archetypes keep the catalog-slice behavior: no hat case may
    // divert recon/scanner/ghost/analyst/coordinator from their kit derivation,
    // and the team delegation stays intact.
    expect(grants).toContain("case 'analyst': default: domain = ranked; break;");
    expect(grants).toContain('teamToolGrants(operator)');
  });

  it('exposes the hats grant table alongside the team grant table', () => {
    const route = block(
      server,
      "app.get('/api/teams/tool-grants'",
      '\n\n',
    );

    // The response projects both tables: the three parent teams via
    // teamToolGrants() and the six hats via hatToolGrants().
    expect(route).toContain('teamToolGrants(');
    expect(route).toContain('hatToolGrants(hat)');
    expect(route).toContain('HAT_ARCHETYPES');
    // Pre-existing team projection stays intact.
    expect(route).toContain('TEAM_ARCHETYPES');
  });

  it('hat lanes ride their parent team families, purple route unchanged', () => {
    const lanes = block(server, 'function familyOperators(', 'function laneToolGrants(');

    expect(lanes).toContain('hatTeam[hat]');
    expect(lanes).toContain('HAT_ARCHETYPES');

    // The purple synthesis route still exists (hats are additive lanes only).
    expect(server).toContain("app.post('/api/teams/purple/synthesize'");
  });
});
