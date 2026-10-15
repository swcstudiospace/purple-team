import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(join(process.cwd(), 'docs/operators.html'), 'utf8');

describe('operators staged consumers', () => {
  it('posts labeled staged reviews and announces the result', () => {
    expect(html).toContain('id="opBlueStage"');
    expect(html).toContain('id="opBlackReview"');
    expect(html).toContain('id="opWhiteStage"');
    expect(html).toContain('for="opBlueFinding"');
    expect(html).toContain('for="opBlackActions"');
    expect(html).toContain('for="opWhiteRoe"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Shell.apiPost('/api/teams/blue/coverage'");
    expect(html).toContain("Shell.apiPost('/api/teams/black/workflow'");
    expect(html).toContain("Shell.apiPost('/api/teams/white/stage'");
    expect(html).toContain('Shell.escHtml');
    expect(html).toContain('artifactBytes');
    expect(html).toContain('not a clean bill');
    expect(html).toContain('out of scope');
    expect(html).toContain('An approved flag alone is not a receipt.');
    expect(html).not.toContain('id list alone is coverage');
  });
});

const arsenal = readFileSync(join(process.cwd(), 'docs/arsenal.html'), 'utf8');
const overview = readFileSync(join(process.cwd(), 'docs/overview.html'), 'utf8');
const index = readFileSync(join(process.cwd(), 'docs/index.html'), 'utf8');

describe('arsenal staged coverage', () => {
  it('scores the selected family through the staged blue route', () => {
    expect(arsenal).toContain('id="arsenalCoverage"');
    expect(arsenal).toContain('for="arsenalCoverageFinding"');
    expect(arsenal).toContain('id="familySel"');
    expect(arsenal).toContain('aria-live="polite"');
    expect(arsenal).toContain("Shell.apiPost('/api/teams/blue/coverage'");
    expect(arsenal).toContain('artifactBytes');
    expect(arsenal).toContain('Shell.escHtml');
    expect(arsenal).toContain('fail-closed');
  });
});

describe('overview staged reach', () => {
  it('reaches all three staged routes from the existing entry', () => {
    expect(overview).toBe(index);
    expect(overview).toContain('id="overviewStage"');
    expect(overview).toContain('for="overviewStageHat"');
    expect(overview).toContain('id="huntBtn"');
    expect(overview).toContain("Shell.apiPost('/api/teams/blue/coverage'");
    expect(overview).toContain("Shell.apiPost('/api/teams/black/workflow'");
    expect(overview).toContain("Shell.apiPost('/api/teams/white/stage'");
    expect(overview).toContain('Shell.escHtml');
    expect(overview).toContain('not a clean bill');
    expect(overview).toContain('out of scope');
    expect(overview).toContain('fail-closed');
  });
});

const mission = readFileSync(join(process.cwd(), 'docs/mission.html'), 'utf8');

describe('mission staged reviews', () => {
  it('stages black and white work with mission attribution', () => {
    expect(mission).toContain('id="missionBlackReview"');
    expect(mission).toContain('id="missionWhiteStage"');
    expect(mission).toContain('for="missionBlackActions"');
    expect(mission).toContain('for="missionWhiteRoe"');
    expect(mission).toContain('aria-live="polite"');
    expect(mission).toContain("Shell.apiPost('/api/teams/black/workflow'");
    expect(mission).toContain("Shell.apiPost('/api/teams/white/stage'");
    expect(mission).toContain('Shell.escHtml');
    expect(mission).toContain('not a clean bill');
    expect(mission).toContain('out of scope');
    expect(mission).toContain('An approved flag alone is not a receipt.');
    expect(mission).toContain('mission ');
  });
});
