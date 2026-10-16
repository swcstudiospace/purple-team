import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(join(process.cwd(), 'docs/defend.html'), 'utf8');

describe('defend artifact form', () => {
  it('posts labeled staged reviews and announces the result', () => {
    expect(html).toContain('id="coverageBind"');
    expect(html).toContain('id="blackReview"');
    expect(html).toContain('id="whiteStage"');
    expect(html).toContain('for="coverageFinding"');
    expect(html).toContain('for="blackActions"');
    expect(html).toContain('for="whiteRoe"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Shell.apiPost('/api/teams/blue/coverage'");
    expect(html).toContain("Shell.apiPost('/api/teams/black/workflow'");
    expect(html).toContain("Shell.apiPost('/api/teams/white/stage'");
    expect(html).not.toContain('id list alone is coverage');
  });
});
