import { describe, it, expect } from 'vitest';
import { filterCommands, parseComposerInput } from '../ui-commands/parser';
import { COMMANDS } from '../ui-commands/registry';

describe('parseComposerInput', () => {
  it('resolves an alias case-insensitively to its command', () => {
    const result = parseComposerInput('/SCAN target=example.com', COMMANDS);

    expect(result.kind).toBe('command');
    if (result.kind !== 'command') return;
    expect(result.spec.name).toBe('recon');
    expect(result.args.target).toBe('example.com');
    expect(result.missing).toEqual([]);
  });

  it('reports a missing required arg in missing', () => {
    const result = parseComposerInput('/coverage runId=r1 missionId=m1', COMMANDS);

    expect(result.kind).toBe('command');
    if (result.kind !== 'command') return;
    expect(result.spec.name).toBe('coverage');
    expect(result.missing).toContain('family');
    expect(result.missing).toContain('artifactBytes');
    expect(result.missing).not.toContain('runId');
    expect(result.missing).not.toContain('missionId');
  });

  it('fills unnamed positional tokens into the remaining args in declared order', () => {
    const result = parseComposerInput('/recon example.com full', COMMANDS);

    expect(result.kind).toBe('command');
    if (result.kind !== 'command') return;
    expect(result.args.target).toBe('example.com');
    expect(result.args.scan_type).toBe('full');
    expect(result.missing).toEqual([]);
  });

  it('keeps quoted values together, including spaces and JSON', () => {
    const result = parseComposerInput(`/stage roeText="authorised window" actions='[{"id":"a1"}]'`, COMMANDS);

    expect(result.kind).toBe('command');
    if (result.kind !== 'command') return;
    expect(result.args.roeText).toBe('authorised window');
    expect(result.args.actions).toBe('[{"id":"a1"}]');
    expect(result.missing).toEqual([]);
  });

  it('treats text with leading whitespace before no slash as text', () => {
    const result = parseComposerInput('   run the scan please', COMMANDS);

    expect(result.kind).toBe('text');
  });

  it('treats a leading-whitespace slash with no whitespace after it as palette', () => {
    const result = parseComposerInput('  /mission', COMMANDS);

    expect(result.kind).toBe('palette');
  });

  it('treats a bare slash as palette with an empty query', () => {
    const result = parseComposerInput('/', COMMANDS);

    expect(result).toEqual({ kind: 'palette', query: '' });
  });

  it('treats a slash with a partial name and no whitespace as palette', () => {
    const result = parseComposerInput('/cov', COMMANDS);

    expect(result).toEqual({ kind: 'palette', query: 'cov' });
  });

  it('treats an unknown name followed by arguments as unknown', () => {
    const result = parseComposerInput('/nope target=x', COMMANDS);

    expect(result).toEqual({ kind: 'unknown', name: 'nope' });
  });

  it('does not throw on malformed quoting', () => {
    expect(() => parseComposerInput(`/recon target="unterminated`, COMMANDS)).not.toThrow();
    const result = parseComposerInput(`/recon target="unterminated`, COMMANDS);
    expect(result.kind).toBe('command');
    if (result.kind !== 'command') return;
    expect(result.args.target).toBe('unterminated');
  });
});

describe('filterCommands', () => {
  it('matches a word that appears only in a command summary', () => {
    const names = filterCommands('ledger', COMMANDS).map(spec => spec.name);

    expect(names).toEqual(['findings']);
  });

  it('matches case-insensitively on aliases', () => {
    const names = filterCommands('SYNTH', COMMANDS).map(spec => spec.name);

    expect(names).toEqual(['synthesize']);
  });

  it('returns every command in registry order for an empty query', () => {
    const names = filterCommands('', COMMANDS).map(spec => spec.name);

    expect(names).toEqual(COMMANDS.map(spec => spec.name));
  });
});
