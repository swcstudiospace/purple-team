/**
 * Shared GitHub repository-URL validator — ONE module, both sides of the wire
 * (35-CONTEXT §2, SPE-15992).
 *
 * The SPA run-config form uses it for instant fault feedback and the
 * mission/start route re-validates with it (client code is untrusted by
 * convention). The UI imports it exactly like the existing server-adjacent
 * shared code (the ui-commands precedent, ui/src/components/AgentPanel.tsx:2-3):
 * a pure, synchronous, dependency-free module — no Node APIs, no fetch, no
 * process.env — so it builds identically under the server tsconfig (lib
 * ES2022; `URL` arrives via @types/node globals) and the Vite DOM build
 * (`URL` is a browser global).
 *
 * Contract: every rejection names the EXACT fault from the taxonomy below —
 * there is no generic "invalid URL" answer. The embedded-credential check runs
 * before any check that could echo part of the URL back, so no later message
 * can ever quote a credential.
 */

export type RepoUrlFault =
  | 'empty'
  | 'url-too-long'
  | 'not-https'
  | 'bad-host'
  | 'embedded-credentials'
  | 'query-or-fragment'
  | 'bad-path-shape'
  | 'bad-owner'
  | 'bad-repo'
  | 'bad-ref'
  | 'subpath-traversal'
  | 'unsupported-view';

export interface ParsedRepoTarget {
  owner: string;
  repo: string;
  /** Resolved ref: the explicit /tree/ ref, else 'HEAD' (codeload resolves HEAD to the default branch — no API call). */
  ref: string;
  /** '' = whole repo; else a normalized posix path with no leading '/'. */
  subpath: string;
  /** `owner/repo@ref` (+ `/subpath` when set) — the canonical run label. */
  canonical: string;
}

export type RepoUrlParseResult =
  | { ok: true; value: ParsedRepoTarget }
  | { ok: false; fault: RepoUrlFault; message: string };

/** Hard ceiling on the pasted URL (35-CONTEXT §2 rule 1). */
export const REPO_URL_MAX_LENGTH = 2048;

const REPO_HOST = 'github.com';
const EXPECTED_PATH_SHAPE = '/{owner}/{repo}[/tree/{ref}[/{subpath}…]]';

/** GitHub hosts that are NOT repo pages — rejected with a pointer back to the repo page URL. */
const NON_REPO_GITHUB_HOSTS: Record<string, true> = {
  'gist.github.com': true,
  'api.github.com': true,
  'codeload.github.com': true,
  'raw.githubusercontent.com': true,
  'objects.githubusercontent.com': true,
};

/** Repo-page views that carry no /tree/-style source scope (35-CONTEXT §2 rule 6). */
const UNSUPPORTED_VIEWS: Record<string, true> = {
  blob: true,
  commit: true,
  raw: true,
  releases: true,
  archive: true,
};

/** Any `scheme://userinfo@` prefix — `user:token@`, `ghp_…@`, bare `user@` — caught before URL parsing can relocate it. */
const EMBEDDED_CREDENTIALS = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#\s]+@/;
/** True when any UTF-16 unit is an ASCII control character (0x00-0x1f, 0x7f). Scan, not regex, so lint's no-control-regex stays on. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function fail(fault: RepoUrlFault, message: string): RepoUrlParseResult {
  return { ok: false, fault, message };
}

/** Percent-decodes one raw path segment; a malformed escape (e.g. "%zz") fails with the segment named. */
function percentDecode(raw: string, role: string): { ok: true; value: string } | { ok: false; message: string } {
  try {
    return { ok: true, value: decodeURIComponent(raw) };
  } catch {
    return { ok: false, message: `${role} segment "${raw}" is not valid percent-encoding - each "%" must be followed by two hex digits` };
  }
}

/** GitHub owner rules: 1–39 chars, [A-Za-z0-9-], no leading/trailing '-', no '--'. Returns the broken rule, or null. */
function ownerRuleViolation(owner: string): string | null {
  if (owner.length < 1 || owner.length > 39) return `owner must be 1-39 characters (got ${owner.length})`;
  if (!/^[A-Za-z0-9-]+$/.test(owner)) return 'owner may contain only ASCII letters, digits, and hyphens';
  if (owner.startsWith('-')) return 'owner must not start with a hyphen ("-octocat" is invalid)';
  if (owner.endsWith('-')) return 'owner must not end with a hyphen';
  if (owner.includes('--')) return 'owner must not contain consecutive hyphens ("--")';
  return null;
}

/** GitHub repo rules: 1–100 chars, [A-Za-z0-9._-], no leading/trailing '.' or '-'. Returns the broken rule, or null. */
function repoRuleViolation(repo: string): string | null {
  if (repo.length < 1 || repo.length > 100) return `repo must be 1-100 characters (got ${repo.length})`;
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) return 'repo may contain only ASCII letters, digits, ".", "_", and "-"';
  if (repo.startsWith('.')) return `repo must not start with "." (got "${repo}")`;
  if (repo.startsWith('-')) return `repo must not start with "-" (got "${repo}")`;
  if (repo.endsWith('.')) return `repo must not end with "." (got "${repo}")`;
  if (repo.endsWith('-')) return `repo must not end with "-" (got "${repo}")`;
  return null;
}

/**
 * Ref rules: 1–255 chars, [A-Za-z0-9._-/] (branches, tags, v1.2.3, 40-hex SHAs),
 * no leading '/', no '..', no control chars. Returns the broken rule, or null.
 */
function refRuleViolation(ref: string): string | null {
  if (ref.length < 1 || ref.length > 255) return `ref must be 1-255 characters (got ${ref.length})`;
  if (ref.startsWith('/')) return 'ref must not start with "/"';
  if (!/^[A-Za-z0-9._/-]+$/.test(ref)) return `ref "${ref}" may contain only ASCII letters, digits, ".", "_", "-", and "/"`;
  if (ref.includes('..')) return `ref "${ref}" contains ".."`;
  if (hasControlChars(ref)) return `ref "${ref}" contains control characters`;
  return null;
}

/**
 * Parse a pasted GitHub repo URL into the canonical run target.
 *
 * Accepted shapes (trailing '/' allowed, '.git' suffix stripped, leading 'www.' stripped):
 *   https://github.com/{owner}/{repo}
 *   https://github.com/{owner}/{repo}/tree/{ref}[/{subpath}…]
 *
 * Segments are percent-decoded after the raw path is split on '/', so "%2F" in a ref stays one segment. A malformed escape is bad-path-shape.
 *
 * Rejections return the exact fault plus a message naming the observed culprit.
 */
export function parseRepoTarget(input: string): RepoUrlParseResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return fail('empty', `Paste a GitHub repository URL (https://${REPO_HOST}/{owner}/{repo}) - the field is empty.`);
  }
  if (trimmed.length > REPO_URL_MAX_LENGTH) {
    return fail('url-too-long', `URL exceeds ${REPO_URL_MAX_LENGTH} characters (got ${trimmed.length}).`);
  }
  // Credentials FIRST: before any check whose message could quote the URL back.
  if (EMBEDDED_CREDENTIALS.test(trimmed)) {
    return fail('embedded-credentials', 'URL contains embedded credentials - remove them; connect GitHub in Settings instead.');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
    return fail(
      'not-https',
      `use https:// - ${scheme ? `got ${scheme[1]}:` : 'no scheme found'}; paste the full https://${REPO_HOST}/{owner}/{repo} URL`,
    );
  }
  // Percent-encoded or relocated userinfo the raw regex could not see.
  if (url.username !== '' || url.password !== '') {
    return fail('embedded-credentials', 'URL contains embedded credentials - remove them; connect GitHub in Settings instead.');
  }
  if (url.protocol !== 'https:') {
    return fail('not-https', `use https:// - got ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  if (url.port !== '' && url.port !== '443') {
    return fail('bad-host', `host must be ${REPO_HOST} - got ${host}:${url.port} (only the default https port is accepted)`);
  }
  const repoHost = host === `www.${REPO_HOST}` ? REPO_HOST : host;
  if (repoHost !== REPO_HOST) {
    const pointer = host in NON_REPO_GITHUB_HOSTS
      ? `; paste the repository page URL (https://${REPO_HOST}/{owner}/{repo}) instead`
      : '';
    return fail('bad-host', `host must be ${REPO_HOST} - got ${host}${pointer}`);
  }
  if (url.search !== '' || url.hash !== '') {
    const parts: string[] = [];
    if (url.search !== '') parts.push(`the query string "${url.search}"`);
    if (url.hash !== '') parts.push(`the fragment "${url.hash}"`);
    return fail('query-or-fragment', `remove ${parts.join(' and ')} - the repository URL carries no query or fragment.`);
  }

  // WHATWG URL parsing resolves dot segments away before we ever see them
  // (`..` pops the preceding segment, a trailing `.` is dropped, and `%2e`
  // forms count as dots), so url.pathname would hand us an already-normalized
  // path and "/tree/main/../etc" would sail through as ref "etc". Split the
  // RAW pasted path instead and enforce the rules on what was actually typed.
  const authority = /^[a-zA-Z][a-zA-Z0-9+.-]*:(?:\/\/)?[^/?#]*/.exec(trimmed);
  let pathname = trimmed.slice(authority === null ? 0 : authority[0].length).split(/[?#]/, 1)[0];
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  const segments = pathname === '' || pathname === '/' ? [] : pathname.slice(1).split('/');
  if (segments.length < 2) {
    return fail('bad-path-shape', `path must be ${EXPECTED_PATH_SHAPE} - got "${pathname === '' ? '/' : pathname}"`);
  }

  const ownerSegment = percentDecode(segments[0], 'owner');
  if (!ownerSegment.ok) return fail('bad-path-shape', ownerSegment.message);
  const repoSegment = percentDecode(segments[1], 'repo');
  if (!repoSegment.ok) return fail('bad-path-shape', repoSegment.message);
  const owner = ownerSegment.value;
  const repo = repoSegment.value.endsWith('.git') ? repoSegment.value.slice(0, -4) : repoSegment.value;

  let ref = 'HEAD';
  let subpathSegments: string[] = [];
  if (segments.length > 2) {
    const view = segments[2];
    if (view === 'tree') {
      if (segments[3] === undefined) {
        return fail('bad-path-shape', `/tree/ requires a ref - path must be ${EXPECTED_PATH_SHAPE}, got "${pathname}"`);
      }
      const refSegment = percentDecode(segments[3], 'ref');
      if (!refSegment.ok) return fail('bad-path-shape', refSegment.message);
      ref = refSegment.value;
      subpathSegments = segments.slice(4);
    } else if (view in UNSUPPORTED_VIEWS) {
      const guidance = view === 'blob'
        ? 'replace /blob/ with /tree/ or use the repo root'
        : `use the repo root or a /tree/{ref}/{subpath} URL instead of /${view}/`;
      return fail('unsupported-view', `the /${view}/ view is not a repository scope - ${guidance}.`);
    } else {
      return fail('bad-path-shape', `path must be ${EXPECTED_PATH_SHAPE} - got "${pathname}"`);
    }
  }

  const ownerFault = ownerRuleViolation(owner);
  if (ownerFault !== null) return fail('bad-owner', ownerFault);
  const repoFault = repoRuleViolation(repo);
  if (repoFault !== null) return fail('bad-repo', repoFault);
  const refFault = refRuleViolation(ref);
  if (refFault !== null) return fail('bad-ref', refFault);

  // Decode each segment, then split on the DECODED '/': an encoded slash
  // ("..%2Fetc") must not hide a traversal from the per-segment checks below.
  const subpathParts: string[] = [];
  for (const raw of subpathSegments) {
    const decoded = percentDecode(raw, 'subpath');
    if (!decoded.ok) return fail('bad-path-shape', decoded.message);
    subpathParts.push(...decoded.value.split('/'));
  }
  const subpath = subpathParts.join('/');
  if (hasControlChars(subpath)) return fail('bad-path-shape', 'subpath contains control characters - percent-encoded control bytes are not allowed in a path');
  for (const segment of subpathParts) {
    if (segment === '') return fail('subpath-traversal', `subpath "${subpath}" contains an empty segment ("//") - use a single slash-separated path`);
    if (segment === '.') return fail('subpath-traversal', `subpath "${subpath}" contains a "." segment - remove it`);
    if (segment === '..') return fail('subpath-traversal', `subpath "${subpath}" contains a ".." segment - traversal out of the repository is not allowed`);
  }

  return {
    ok: true,
    value: {
      owner,
      repo,
      ref,
      subpath,
      canonical: `${owner}/${repo}@${ref}${subpath === '' ? '' : `/${subpath}`}`,
    },
  };
}
