/**
 * T3MP3ST White v2 — ROE parser: operator text → structured RoeSpec (pure, no I/O).
 *
 * Grammar (line-oriented, case-insensitive directive prefix):
 *   scope: <comma/semicolon target list>        aliases: allowed targets:, targets:, in scope:
 *   allow active: <yes|no|true|false|permitted|forbidden|allowed|denied|disallowed|prohibited>
 *                                               aliases: active testing:, active techniques:
 *   "- "/"* " bullet lines directly under a scope directive append targets.
 *   "#" and "//" lines are comments: counted, never interpreted.
 *
 * Doctrine: the parser never guesses. Every content line either lands in
 * `resolved` (folded into the spec, with its source line on record) or in
 * `unresolved` with the exact reason it could not be honored — adjudication
 * never silently drops operator text. `ok` is true only when every line was
 * accounted for and at least one directive parsed, so callers can hold the
 * engagement instead of running against a permissive partial spec.
 */

import type { RoeSpec } from '../white.js';

/** The RoeSpec fields this parser can populate from operator text. */
export type RoeDirectiveField = 'allowedTargets' | 'allowActive';

/** Scope directive aliases, case-insensitive prefix match (longest intent first is not needed — none is a prefix of another). */
const SCOPE_DIRECTIVES: readonly string[] = ['scope:', 'allowed targets:', 'targets:', 'in scope:'];

/** Allow-active directive aliases, case-insensitive prefix match. */
const ACTIVE_DIRECTIVES: readonly string[] = ['allow active:', 'active testing:', 'active techniques:'];

/** Yes/no vocabulary for allow-active values; anything else is reported unresolved. */
const BOOLEAN_TOKENS: Record<string, boolean> = {
  yes: true,
  true: true,
  permitted: true,
  allowed: true,
  no: false,
  false: false,
  forbidden: false,
  denied: false,
  disallowed: false,
  prohibited: false,
};

/** One operator line successfully folded into the spec. */
export interface RoeFieldResolution {
  /** RoeSpec field this line set. */
  field: RoeDirectiveField;
  /** 1-based source line. */
  line: number;
  /** Trimmed source text of the line. */
  raw: string;
  /** Normalized value: the line's targets joined with ", " ("" when it added only duplicates), or "true"/"false". */
  value: string;
}

/** One operator line that is NOT in the parsed spec, with the exact reason. */
export interface RoeParseIssue {
  /** 1-based source line. */
  line: number;
  /** Trimmed source text. */
  text: string;
  /** Why the line could not be mapped onto a RoeSpec field. */
  reason: string;
}

export interface RoeParseResult {
  /** The structured spec parsed so far — check `ok` before trusting it for adjudication. */
  roe: RoeSpec;
  /** Content lines folded into the spec. */
  resolved: RoeFieldResolution[];
  /** Content lines reported instead of guessed. */
  unresolved: RoeParseIssue[];
  /** Comment lines ("#"/"//") — accounted here, never silently dropped. */
  commentLines: number;
  /** false ⇒ the spec is incomplete: at least one line went unhandled, or nothing parsed at all. */
  ok: boolean;
  /** One-line operator-readable parse outcome. */
  summary: string;
}

/**
 * Parse operator ROE text into a structured RoeSpec. Scope values are matched
 * downstream by ../white.ts roeAudit's suffix/substring rules, so targets are
 * kept verbatim (casing preserved, duplicates dropped case-insensitively). A
 * later allow-active line overriding an earlier conflicting one wins, but the
 * conflict is reported — the text must be clean before adjudication relies on it.
 */
export function parseRoe(text: string): RoeParseResult {
  const roe: RoeSpec = {};
  const resolved: RoeFieldResolution[] = [];
  const unresolved: RoeParseIssue[] = [];
  let commentLines = 0;
  const seenTargets = new Set<string>();
  // Targets in spec order (directive order, first casing wins) — folded onto the RoeSpec below.
  const specTargets: string[] = [];
  // Source line of the current allowActive definition, so conflicting redefinitions cite it.
  let allowActiveLine = 0;
  // Scope directives still waiting for targets (empty inline value; bullets may follow).
  let pendingScope: Array<{ line: number; raw: string }> = [];
  // While set, bullet lines continue this field's target list.
  let bulletField: RoeDirectiveField | null = null;

  /** Split a comma/semicolon value into deduplicated targets; returns only the newly added ones. */
  const addTargets = (value: string): string[] => {
    const added: string[] = [];
    for (const piece of value.split(/[,;]/)) {
      const target = piece.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
      if (!target) continue;
      const key = target.toLowerCase();
      if (seenTargets.has(key)) continue;
      seenTargets.add(key);
      specTargets.push(target);
      added.push(target);
    }
    return added;
  };

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const content = rawLine.trim();
    if (!content) return; // blank lines structure the text; they carry no requirements
    if (content.startsWith('#') || content.startsWith('//')) {
      commentLines += 1;
      return;
    }

    // Bullet continuation of a scope directive's target list.
    const bullet = /^[-*•]\s+(.*)$/.exec(content);
    if (bullet) {
      if (bulletField !== 'allowedTargets') {
        bulletField = null;
        unresolved.push({
          line,
          text: content,
          reason: 'list item without a preceding "scope:" directive to continue',
        });
        return;
      }
      const added = addTargets(bullet[1]);
      if (added.length) {
        for (const header of pendingScope) {
          resolved.push({ field: 'allowedTargets', line: header.line, raw: header.raw, value: 'filled by the bullet list below' });
        }
        pendingScope = [];
      }
      resolved.push({ field: 'allowedTargets', line, raw: content, value: added.join(', ') });
      return;
    }

    const lowered = content.toLowerCase();

    const activePrefix = ACTIVE_DIRECTIVES.find(prefix => lowered.startsWith(prefix));
    if (activePrefix) {
      bulletField = null;
      const rawValue = content.slice(activePrefix.length).trim();
      const parsed = BOOLEAN_TOKENS[rawValue.replace(/[.!]$/, '').toLowerCase()];
      if (parsed === undefined) {
        unresolved.push({
          line,
          text: content,
          reason: `"${rawValue}" is not a recognized yes/no token (expected yes/no/true/false/permitted/forbidden/allowed/denied/disallowed/prohibited)`,
        });
        return;
      }
      if (roe.allowActive !== undefined && roe.allowActive !== parsed) {
        unresolved.push({
          line,
          text: content,
          reason: `conflicting redefinition of allowActive: line ${allowActiveLine} set "${String(roe.allowActive)}", this line sets "${String(parsed)}"; the later value wins but the text must be resolved before adjudication`,
        });
      }
      roe.allowActive = parsed;
      allowActiveLine = line;
      resolved.push({ field: 'allowActive', line, raw: content, value: String(parsed) });
      return;
    }

    const scopePrefix = SCOPE_DIRECTIVES.find(prefix => lowered.startsWith(prefix));
    if (scopePrefix) {
      const added = addTargets(content.slice(scopePrefix.length).trim());
      if (added.length) {
        for (const header of pendingScope) {
          unresolved.push({
            line: header.line,
            text: header.raw,
            reason: `empty scope directive superseded by the scope directive on line ${line}`,
          });
        }
        pendingScope = [];
        resolved.push({ field: 'allowedTargets', line, raw: content, value: added.join(', ') });
      } else {
        pendingScope.push({ line, raw: content });
      }
      bulletField = 'allowedTargets';
      return;
    }

    bulletField = null;
    unresolved.push({
      line,
      text: content,
      reason: 'unrecognized directive; expected "scope:" or "allow active:" (aliases: allowed targets/targets/in scope, active testing/active techniques)',
    });
  });

  for (const header of pendingScope) {
    unresolved.push({
      line: header.line,
      text: header.raw,
      reason: 'scope directive carries no targets (expected a comma/semicolon list or "- " bullet lines)',
    });
  }
  if (specTargets.length > 0) roe.allowedTargets = specTargets;

  // A spec without scope targets cannot bound any action: roeAudit treats an empty
  // allowedTargets as unrestricted, so allow-active-only text must not parse as ok.
  const ok = resolved.length > 0 && unresolved.length === 0 && specTargets.length > 0;
  const summary =
    resolved.length === 0 && unresolved.length === 0
      ? 'no ROE directives found in the text'
      : specTargets.length === 0 && unresolved.length === 0
        ? 'parsed directive line(s) but no scope targets; a spec without scope cannot be adjudicated'
        : `parsed ${resolved.length} directive line(s); ${unresolved.length} line(s) unresolved${ok ? '' : ' — resolve the reported lines before adjudication'}`;

  return { roe, resolved, unresolved, commentLines, ok, summary };
}
