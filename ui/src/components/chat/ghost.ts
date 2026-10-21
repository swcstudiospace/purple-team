import { parseComposerInput } from '../../../../src/ui-commands/parser';
import type { ArgSpec, CommandSpec } from '../../../../src/ui-commands/registry';

/** What a ghost suggestion completes: command name, enum value, or arg example. */
export type GhostKind = 'command' | 'enum' | 'example';

export interface GhostSuggestion {
  ghost: string;
  kind: GhostKind;
}

/** `/` + letters/dashes with no whitespace yet — command-name territory. */
const COMMAND_NAME_DRAFT = /^\/([a-z-]*)$/i;

/** Trailing non-whitespace run: the token currently being typed. */
const TRAILING_TOKEN = /(\S+)$/;

/** `key=value` or `key=` named-argument token (mirrors the parser's NAMED rule). */
const NAMED_TOKEN = /^([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/;

/** Trailing `(…)` annotation on an enum hint option, e.g. 'shared (optional filter)'. */
const OPTION_ANNOTATION = /\s+\([^()]*\)$/;

/**
 * Pure ghost-text suggestions for the chat composer (OMP-style inline
 * autocomplete). The composer owns the at-end caret check, slash-palette
 * suppression, IME guarding, and Escape dismissal; everything here assumes
 * the caret sits at the end of the draft.
 *
 * Kinds:
 * - 'command' — draft is `/` + letters/dashes with no space yet: remainder of
 *   the best command name. A unique prefix match wins; several matches
 *   complete only their shared continuation (taken from the sorted-first
 *   name); a diverging remainder, an unmatched prefix, or a prefix that
 *   already completes a lone name returns null — the palette popover is the
 *   disambiguation UI for those.
 * - 'enum' — draft names a known command (name or alias) whose current
 *   argument — the one receiving the trailing `token`, `key=partial`, or
 *   quoted `'partial` — has a ` | `-separated hint: remainder of the first
 *   option matching the partial case-insensitively (trailing `(…)`
 *   annotations are stripped before matching). null when the hint is not an
 *   enum, no option matches, or the partial already completes the option.
 * - 'example' — draft names a known command and ends with whitespace, so the
 *   next unfilled argument starts empty: that argument's `example` verbatim.
 *
 * Returns null for: empty drafts, prose (non-command) drafts, drafts still in
 * command-name territory, unknown commands, fully bound arguments, and any
 * other state with nothing left to suggest.
 */
export function suggestGhost(draft: string, commands: readonly CommandSpec[]): GhostSuggestion | null {
  if (draft === '') return null;
  const commandGhost = commandNameGhost(draft, commands);
  if (commandGhost !== null) return commandGhost;

  const typed = trailingToken(draft);
  if (typed === null) return exampleGhost(draft, commands);
  return partialArgGhost(typed, commands);
}

/**
 * Command-name ghost: `/par` → `tial`. With a single name matching the
 * prefix, the remainder completes; with several matches, only the shared
 * continuation of the sorted-first name is unambiguous enough to complete.
 */
function commandNameGhost(draft: string, commands: readonly CommandSpec[]): GhostSuggestion | null {
  const match = COMMAND_NAME_DRAFT.exec(draft);
  if (match === null) return null;
  const typed = match[1].toLowerCase();
  const names = commands
    .map(spec => spec.name.toLowerCase())
    .filter(name => name.startsWith(typed))
    .sort();
  if (names.length === 0) return null;
  const ghost = names[0].slice(typed.length);
  const unambiguous = names.every(name => name.slice(typed.length).startsWith(ghost));
  if (ghost === '' || !unambiguous) return null;
  return { ghost, kind: 'command' };
}

/** The trailing token split off its base; null when the draft ends with whitespace. */
function trailingToken(draft: string): { chunk: string; base: string } | null {
  const match = TRAILING_TOKEN.exec(draft);
  if (match === null) return null;
  return { chunk: match[1], base: draft.slice(0, draft.length - match[1].length) };
}

/** Draft ends with whitespace: the next unfilled argument offers its example. */
function exampleGhost(draft: string, commands: readonly CommandSpec[]): GhostSuggestion | null {
  const parsed = parseComposerInput(draft, commands);
  if (parsed.kind !== 'command') return null;
  const current = parsed.spec.args.find(arg => parsed.args[arg.name] === undefined);
  if (current?.example === undefined || current.example === '') return null;
  return { ghost: current.example, kind: 'example' };
}

/**
 * Draft ends mid-token: `token`/`'partial` fills the next open argument in
 * declared order, `key=partial` targets the named argument.
 */
function partialArgGhost(
  typed: { chunk: string; base: string },
  commands: readonly CommandSpec[],
): GhostSuggestion | null {
  const parsed = parseComposerInput(typed.base, commands);
  if (parsed.kind !== 'command') return null;
  const named = NAMED_TOKEN.exec(typed.chunk);
  const current: ArgSpec | undefined = named
    ? parsed.spec.args.find(arg => arg.name === named[1])
    : parsed.spec.args.find(arg => parsed.args[arg.name] === undefined);
  if (current === undefined) return null;
  // A leading quote prefix (`'red`) mirrors the parser's quote grouping and
  // is ignored for matching; the ghost completes inside the quotes.
  const partial = named ? named[2] : typed.chunk.replace(/^['"]/, '');
  return enumValueGhost(current, partial);
}

/** Remainder of the first `hint` option matching the partial, annotations ignored. */
function enumValueGhost(arg: ArgSpec, partial: string): GhostSuggestion | null {
  if (!arg.hint.includes(' | ')) return null;
  const wanted = partial.toLowerCase();
  for (const option of arg.hint.split(' | ')) {
    const value = option.trim().replace(OPTION_ANNOTATION, '');
    if (value.toLowerCase().startsWith(wanted)) {
      const ghost = value.slice(partial.length);
      return ghost === '' ? null : { ghost, kind: 'enum' };
    }
  }
  return null;
}
