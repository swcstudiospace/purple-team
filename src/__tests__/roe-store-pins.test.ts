import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

describe('roe store wiring (source pins)', () => {
  it('declares the sanctioned single-slot roeRecords map', () => {
    expect(serverSource).toContain('const roeRecords = new Map<string, RoeRecord>()');
  });

  it('snapshots the slot for persistence', () => {
    expect(serverSource).toContain('roeRecords: [...roeRecords.values()]');
  });

  it('restores the slot through the fail-closed replaceMapContents path', () => {
    expect(serverSource).toContain('replaceMapContents(roeRecords, state.roeRecords)');
  });

  it('keys the single slot on the latest string', () => {
    expect(serverSource).toContain(`roeRecords.get('latest')`);
    expect(serverSource).toContain(`roeRecords.set('latest'`);
    expect(serverSource).toContain(`id: 'latest'`);
  });

  it('stamps the text hash as a 16-char sha256 slice below the redaction floor', () => {
    expect(serverSource).toContain(
      `textHash: createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)`,
    );
  });

  it('the GET guard rejects element-corrupt stored actions (null element → 200 cannot-derive)', () => {
    expect(serverSource).toContain('const actionsOk =');
    expect(serverSource).toContain(`!(storedActions as unknown[]).some((a) => !a || typeof a !== 'object' || Array.isArray(a))`);
    expect(serverSource).toContain('!actionsOk');
  });

  it('restored revision/timestamps coerce fail-closed (non-numeric revision → 200 cannot-derive)', () => {
    expect(serverSource).toContain('const prevRevision =');
    expect(serverSource).toContain('Number.isFinite');
    expect(serverSource).toContain('const revisionOk =');
    expect(serverSource).toContain('const timestampsOk =');
    expect(serverSource).toContain('!revisionOk || !timestampsOk');
  });
});
