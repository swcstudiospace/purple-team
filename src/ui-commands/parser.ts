import type { CommandSpec } from './registry';

export type ParseResult =
  | { kind: 'text'; text: string }
  | { kind: 'palette'; query: string }
  | { kind: 'command'; spec: CommandSpec; args: Record<string, string>; missing: string[] }
  | { kind: 'unknown'; name: string };

interface Token {
  text: string;
  named: { key: string; value: string } | null;
}

const NAMED = /^([A-Za-z_][A-Za-z0-9_-]*)=([\s\S]*)$/;

/**
 * Splits the argument tail on whitespace. Single or double quotes group a
 * value (`key="a b"`, `'[{"x":1}]'`); the quotes are stripped and there are
 * no escape sequences. An unterminated quote consumes the rest of the input.
 */
function tokenize(tail: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let hasToken = false;
  let quote: '"' | "'" | null = null;

  const flush = (): void => {
    if (!hasToken) return;
    const text = current.trim();
    const match = NAMED.exec(text);
    tokens.push({
      text,
      named: match ? { key: match[1], value: match[2].trim() } : null,
    });
    current = '';
    hasToken = false;
  };

  for (const ch of tail) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
      continue;
    }
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    current += ch;
    hasToken = true;
  }
  flush();
  return tokens;
}

function resolveCommand(name: string, commands: readonly CommandSpec[]): CommandSpec | undefined {
  const wanted = name.toLowerCase();
  return commands.find(
    spec => spec.name.toLowerCase() === wanted || spec.aliases.some(alias => alias.toLowerCase() === wanted),
  );
}

/**
 * Classifies composer input.
 * - Not starting with `/` (after leading whitespace): text.
 * - `/` with no whitespace yet: palette, query is the text after the slash.
 * - `/name ...` with a known name or alias: command. `key=value` tokens bind
 *   by name; other tokens fill the remaining args in declared order.
 * - `/name ...` with an unknown name: unknown.
 */
export function parseComposerInput(input: string, commands: readonly CommandSpec[]): ParseResult {
  const trimmedStart = input.replace(/^\s+/, '');
  if (!trimmedStart.startsWith('/')) {
    return { kind: 'text', text: input.trim() };
  }

  const body = trimmedStart.slice(1);
  const firstSpace = body.search(/\s/);
  if (firstSpace === -1) {
    return { kind: 'palette', query: body };
  }

  const name = body.slice(0, firstSpace);
  const spec = resolveCommand(name, commands);
  if (!spec) {
    return { kind: 'unknown', name };
  }

  const args: Record<string, string> = {};
  const positional: string[] = [];
  for (const token of tokenize(body.slice(firstSpace))) {
    if (token.named) {
      args[token.named.key] = token.named.value;
    } else {
      positional.push(token.text);
    }
  }

  const open = spec.args.filter(arg => args[arg.name] === undefined);
  const filledCount = Math.min(open.length, positional.length);
  for (let index = 0; index < filledCount; index += 1) {
    args[open[index].name] = positional[index];
  }
  if (positional.length > open.length && filledCount > 0) {
    const last = open[filledCount - 1].name;
    args[last] = [args[last], ...positional.slice(open.length)].join(' ');
  }

  const missing = spec.args
    .filter(arg => arg.required && !(args[arg.name] ?? '').trim())
    .map(arg => arg.name);

  return { kind: 'command', spec, args, missing };
}

/** Case-insensitive substring match on name, aliases, and summary, in registry order. */
export function filterCommands(query: string, commands: readonly CommandSpec[]): CommandSpec[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...commands];
  return commands.filter(spec =>
    spec.name.toLowerCase().includes(needle) ||
    spec.aliases.some(alias => alias.toLowerCase().includes(needle)) ||
    spec.summary.toLowerCase().includes(needle),
  );
}
