import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { redactSecrets } from '../redact.js';

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
    expect(serverSource).toContain('(storedActions as unknown[]).every((a) => isRoeActionElementValid(a))');
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

describe('roe store field validation (finding 1 pins)', () => {
  it('defines the shared element validator over the audited command/target fields', () => {
    expect(serverSource).toContain('function isRoeActionElementValid(value: unknown): boolean');
    expect(serverSource).toContain("typeof action.command !== 'string'");
    expect(serverSource).toContain("typeof action.target !== 'string'");
  });

  it('the PUT 400 gate applies the validator so target: 123 can never persist', () => {
    const putStart = serverSource.indexOf(`app.put('/api/teams/white/roe'`);
    const putBlock = serverSource.slice(putStart, serverSource.indexOf('\n});', putStart));
    expect(putBlock).toContain('isRoeActionElementValid');
    expect(putBlock).toContain('res.status(400)');
  });

  it('the GET restore ladder applies the same validator (cannot-derive on mismatch)', () => {
    const getStart = serverSource.indexOf(`app.get('/api/teams/white/roe'`);
    const getBlock = serverSource.slice(getStart, serverSource.indexOf('\n});', getStart));
    expect(getBlock).toContain('isRoeActionElementValid');
    expect(getBlock).toContain('!actionsOk');
  });
});

describe('roe actions integrity across a save/restore cycle (finding 2 pins)', () => {
  it('stamps an actionsHash at PUT over stable JSON of actions', () => {
    expect(serverSource).toContain('actionsHash: createHash');
    expect(serverSource).toContain('JSON.stringify(actions)');
  });

  it('the GET integrity gate recomputes over restored actions and cannot derive on mismatch', () => {
    expect(serverSource).toContain('JSON.stringify(record.actions)');
    expect(serverSource).toContain('recomputedActions !== record.actionsHash');
  });

  it('a ?token= action URL rewritten by the persistence redaction breaks the stamp (cannot-derive, never a flipped verdict)', () => {
    const actions = [
      { command: 'curl -s "https://app.example.com/search?q=1&token=s3cr3t-sync-token-9"', target: 'app.example.com', approved: true },
    ];
    const stamp = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex').slice(0, 16);
    const stamped = stamp(actions);
    // persistState redactSecrets-wraps the snapshot; the restore reads back the redacted copy.
    const persisted = redactSecrets({ roeRecords: [{ id: 'latest', actions }] }) as {
      roeRecords: Array<{ actions: unknown }>;
    };
    const restored = JSON.parse(JSON.stringify(persisted)) as { roeRecords: Array<{ actions: unknown }> };
    expect(JSON.stringify(restored.roeRecords[0].actions)).toContain('token=[redacted]');
    expect(JSON.stringify(restored.roeRecords[0].actions)).not.toBe(JSON.stringify(actions));
    expect(stamp(restored.roeRecords[0].actions)).not.toBe(stamped);
  });
});
