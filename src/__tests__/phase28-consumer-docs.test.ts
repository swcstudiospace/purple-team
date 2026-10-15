import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const api = readFileSync(join(process.cwd(), 'docs/API_REFERENCE.md'), 'utf8');
const mcp = readFileSync(join(process.cwd(), 'docs/MCP_GUIDE.md'), 'utf8');

describe('phase28 consumer docs staged contracts', () => {
  it('pins the three staged routes in the API reference', () => {
    expect(api).toContain('/api/teams/blue/coverage');
    expect(api).toContain('/api/teams/black/workflow');
    expect(api).toContain('/api/teams/white/stage');
  });

  it('pins the three staged proxy tools in the MCP guide', () => {
    expect(mcp).toContain('tempest_blue_coverage');
    expect(mcp).toContain('tempest_black_workflow');
    expect(mcp).toContain('tempest_white_stage');
  });

  it('uses fail-closed wording in both guides', () => {
    for (const doc of [api, mcp]) {
      expect(doc).toContain('insufficient-evidence');
      expect(doc).toContain('not a clean bill');
      expect(doc).toContain('roe-scope-empty');
    }
    expect(api).toContain('Does not mint a receipt');
    expect(mcp).toContain('An approved flag alone is not a receipt');
  });

  it('does not promise auto-dispatch', () => {
    expect(api).not.toContain('auto-dispatch');
    expect(mcp).not.toContain('auto-dispatch');
  });
});
