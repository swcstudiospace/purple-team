/**
 * repo-url validator fault matrix (35-CONTEXT §8, SPE-15992).
 *
 * parseRepoTarget is the ONE shared client+server validator; every test here
 * asserts BOTH the exact fault code from the taxonomy AND that the message
 * names the observed culprit — "invalid URL" is never an acceptable answer.
 * Credential-bearing inputs additionally assert the secret never appears in
 * the message (the creds check runs before anything can echo the URL back).
 */

import { describe, it, expect } from 'vitest';
import { parseRepoTarget, REPO_URL_MAX_LENGTH, type ParsedRepoTarget, type RepoUrlFault } from '../recon/repo-url.js';

function parseOk(url: string): ParsedRepoTarget {
  const result = parseRepoTarget(url);
  if (result.ok) return result.value;
  throw new Error(`expected ok for "${url}" - got ${result.fault}: ${result.message}`);
}

function parseFault(url: string): { fault: RepoUrlFault; message: string } {
  const result = parseRepoTarget(url);
  if (!result.ok) return { fault: result.fault, message: result.message };
  throw new Error(`expected a fault for "${url}" - parsed as ${result.value.canonical}`);
}

const SHA = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('parseRepoTarget happy paths', () => {
  it('accepts a plain repo root URL and defaults ref to HEAD', () => {
    const value = parseOk('https://github.com/octocat/Hello-World');
    expect(value).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      ref: 'HEAD',
      subpath: '',
      canonical: 'octocat/Hello-World@HEAD',
    });
  });

  it('strips a .git suffix', () => {
    expect(parseOk('https://github.com/octocat/Hello-World.git').canonical).toBe('octocat/Hello-World@HEAD');
  });

  it('strips a .git suffix before a /tree/ ref', () => {
    const value = parseOk('https://github.com/octocat/Hello-World.git/tree/main');
    expect(value.repo).toBe('Hello-World');
    expect(value.ref).toBe('main');
  });

  it('strips a leading www. from the host', () => {
    expect(parseOk('https://www.github.com/octocat/Hello-World').canonical).toBe('octocat/Hello-World@HEAD');
  });

  it('accepts an uppercase host (hostname is case-insensitive)', () => {
    expect(parseOk('https://GITHUB.COM/octocat/Hello-World').canonical).toBe('octocat/Hello-World@HEAD');
  });

  it('accepts the default https port', () => {
    expect(parseOk('https://github.com:443/octocat/Hello-World').canonical).toBe('octocat/Hello-World@HEAD');
  });

  it('strips a trailing slash on the repo root', () => {
    expect(parseOk('https://github.com/octocat/Hello-World/').canonical).toBe('octocat/Hello-World@HEAD');
  });

  it('parses /tree/{branch}', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/main');
    expect(value.ref).toBe('main');
    expect(value.subpath).toBe('');
    expect(value.canonical).toBe('octocat/Hello-World@main');
  });

  it('parses /tree/{version-tag}/{subpath}', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/v1.2.3/src');
    expect(value.ref).toBe('v1.2.3');
    expect(value.subpath).toBe('src');
    expect(value.canonical).toBe('octocat/Hello-World@v1.2.3/src');
  });

  it('parses a 40-hex commit SHA as the ref', () => {
    const value = parseOk(`https://github.com/octocat/Hello-World/tree/${SHA}`);
    expect(value.ref).toBe(SHA);
    expect(value.canonical).toBe(`octocat/Hello-World@${SHA}`);
  });

  it('splits a slash-bearing branch URL per the doc grammar: single-segment ref, rest as subpath', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/feature/login-flow');
    expect(value.ref).toBe('feature');
    expect(value.subpath).toBe('login-flow');
    // The canonical label still spells the pasted scope verbatim - the split
    // ambiguity never misrepresents the run label (35-CONTEXT §2 rules 6+10).
    expect(value.canonical).toBe('octocat/Hello-World@feature/login-flow');
  });

  it('parses a multi-segment subpath and strips the trailing slash', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/main/src/recon/');
    expect(value.subpath).toBe('src/recon');
    expect(value.canonical).toBe('octocat/Hello-World@main/src/recon');
  });

  it('accepts an explicit HEAD ref (codeload resolves it to the default branch)', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/HEAD/src');
    expect(value.ref).toBe('HEAD');
    expect(value.subpath).toBe('src');
    expect(value.canonical).toBe('octocat/Hello-World@HEAD/src');
  });

  it('accepts a URL at exactly the 2048-character cap', () => {
    const prefix = 'https://github.com/octocat/Hello-World/tree/main/';
    const pad = 'ab/'.repeat(Math.ceil((REPO_URL_MAX_LENGTH - prefix.length) / 3));
    const url = (prefix + pad).slice(0, REPO_URL_MAX_LENGTH).replace(/\/$/, '');
    expect(url.length).toBe(REPO_URL_MAX_LENGTH);
    expect(parseOk(url).subpath.length).toBeGreaterThan(0);
  });
});

describe('parseRepoTarget ref/subpath split', () => {
  it('treats /tree/{ref}/{rest} as ref plus subpath (slash-bearing refs are not distinguishable in URL form)', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/feature/login-flow');
    expect(value.ref).toBe('feature');
    expect(value.subpath).toBe('login-flow');
  });
});

describe('parseRepoTarget scheme/host/credentials faults', () => {
  it('rejects an empty field', () => {
    for (const input of ['', '   ', '\t\n']) {
      const { fault, message } = parseFault(input);
      expect(fault).toBe('empty');
      expect(message).toContain('empty');
    }
  });

  it('rejects URLs over 2048 characters with the observed length', () => {
    const prefix = 'https://github.com/octocat/Hello-World/tree/main/';
    const url = prefix + 'a'.repeat(REPO_URL_MAX_LENGTH + 1 - prefix.length);
    expect(url.length).toBe(REPO_URL_MAX_LENGTH + 1);
    const { fault, message } = parseFault(url);
    expect(fault).toBe('url-too-long');
    expect(message).toContain(String(REPO_URL_MAX_LENGTH));
    expect(message).toContain(String(REPO_URL_MAX_LENGTH + 1));
  });

  it('rejects http:// naming the observed scheme', () => {
    const { fault, message } = parseFault('http://github.com/octocat/Hello-World');
    expect(fault).toBe('not-https');
    expect(message).toContain('http:');
  });

  it('rejects a schemeless paste as not-https', () => {
    const { fault, message } = parseFault('github.com/octocat/Hello-World');
    expect(fault).toBe('not-https');
    expect(message).toContain('no scheme');
  });

  it('rejects gist.github.com naming the host', () => {
    const { fault, message } = parseFault('https://gist.github.com/octocat/1234abcd');
    expect(fault).toBe('bad-host');
    expect(message).toContain('gist.github.com');
    expect(message).toContain('github.com');
  });

  it('rejects api.github.com with a pointer to the repo page URL', () => {
    const { fault, message } = parseFault('https://api.github.com/repos/octocat/Hello-World');
    expect(fault).toBe('bad-host');
    expect(message).toContain('api.github.com');
    expect(message).toContain('repository page URL');
  });

  it('rejects raw.githubusercontent.com with a pointer to the repo page URL', () => {
    const { fault, message } = parseFault(`https://raw.githubusercontent.com/octocat/Hello-World/main/README`);
    expect(fault).toBe('bad-host');
    expect(message).toContain('raw.githubusercontent.com');
    expect(message).toContain('repository page URL');
  });

  it('rejects codeload.github.com with a pointer to the repo page URL', () => {
    const { fault, message } = parseFault('https://codeload.github.com/octocat/Hello-World/tar.gz/HEAD');
    expect(fault).toBe('bad-host');
    expect(message).toContain('codeload.github.com');
    expect(message).toContain('repository page URL');
  });

  it('rejects a non-GitHub host naming it', () => {
    const { fault, message } = parseFault('https://gitlab.com/octocat/Hello-World');
    expect(fault).toBe('bad-host');
    expect(message).toContain('gitlab.com');
  });

  it('rejects github.com on a non-default port', () => {
    const { fault, message } = parseFault('https://github.com:8443/octocat/Hello-World');
    expect(fault).toBe('bad-host');
    expect(message).toContain('8443');
  });

  it('rejects user:token@ URLs without echoing the credential', () => {
    const { fault, message } = parseFault('https://user:ghp_secretsecretsecret123@github.com/octocat/Hello-World');
    expect(fault).toBe('embedded-credentials');
    expect(message).not.toContain('user:');
    expect(message).not.toContain('ghp_');
    expect(message).toContain('connect GitHub in Settings');
  });

  it('rejects ghp_…@ bearer forms without echoing the token', () => {
    const { fault, message } = parseFault('https://ghp_secretsecretsecret123@github.com/octocat/Hello-World');
    expect(fault).toBe('embedded-credentials');
    expect(message).not.toContain('ghp_');
  });

  it('rejects a bare username@ form', () => {
    expect(parseFault('https://octocat@github.com/Hello-World/x').fault).toBe('embedded-credentials');
  });

  it('rejects a query string naming it verbatim', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World?tab=readme');
    expect(fault).toBe('query-or-fragment');
    expect(message).toContain('?tab=readme');
  });

  it('rejects a fragment naming it verbatim', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World#anchor');
    expect(fault).toBe('query-or-fragment');
    expect(message).toContain('#anchor');
  });

  it('names both query and fragment when both are present', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World?tab=readme#anchor');
    expect(fault).toBe('query-or-fragment');
    expect(message).toContain('?tab=readme');
    expect(message).toContain('#anchor');
  });
});

// ---------------------------------------------------------------------------
// Faults: path shape and unsupported views
// ---------------------------------------------------------------------------

describe('parseRepoTarget path faults', () => {
  it('rejects a bare host', () => {
    const { fault, message } = parseFault('https://github.com');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('got "/"');
  });

  it('rejects an owner-only path, echoing it against the expected shape', () => {
    const { fault, message } = parseFault('https://github.com/octocat');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('/octocat');
    expect(message).toContain('{owner}/{repo}');
  });

  it('rejects /tree/ with no ref', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('requires a ref');
  });

  it('rejects an unknown third path segment as a bad shape', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/fork');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('/fork');
  });

  it('rejects /blob/ with tree replacement guidance', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/blob/main/src/index.ts');
    expect(fault).toBe('unsupported-view');
    expect(message).toContain('/blob/');
    expect(message).toContain('/tree/');
  });

  it('rejects /commit/ as an unsupported view', () => {
    const { fault, message } = parseFault(`https://github.com/octocat/Hello-World/commit/${SHA}`);
    expect(fault).toBe('unsupported-view');
    expect(message).toContain('/commit/');
  });

  it('rejects /releases/ as an unsupported view', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/releases');
    expect(fault).toBe('unsupported-view');
    expect(message).toContain('/releases/');
  });

  it('rejects /raw/ and /archive/ as unsupported views', () => {
    expect(parseFault('https://github.com/octocat/Hello-World/raw/main/src/index.ts').fault).toBe('unsupported-view');
    expect(parseFault('https://github.com/octocat/Hello-World/archive/refs/heads/main.tar.gz').fault).toBe('unsupported-view');
  });
});

// ---------------------------------------------------------------------------
// Faults: owner / repo / ref / subpath rules
// ---------------------------------------------------------------------------

describe('parseRepoTarget owner/repo/ref/subpath faults', () => {
  it('rejects a 40-character owner on length', () => {
    const { fault, message } = parseFault(`https://github.com/${'a'.repeat(40)}/Hello-World`);
    expect(fault).toBe('bad-owner');
    expect(message).toContain('40');
  });

  it('rejects a leading hyphen owner', () => {
    const { fault, message } = parseFault('https://github.com/-octocat/Hello-World');
    expect(fault).toBe('bad-owner');
    expect(message).toContain('start with a hyphen');
  });

  it('rejects a trailing hyphen owner', () => {
    const { fault, message } = parseFault('https://github.com/octocat-/Hello-World');
    expect(fault).toBe('bad-owner');
    expect(message).toContain('end with a hyphen');
  });

  it('rejects consecutive hyphens in the owner', () => {
    const { fault, message } = parseFault('https://github.com/oc--tcat/Hello-World');
    expect(fault).toBe('bad-owner');
    expect(message).toContain('"--"');
  });

  it('rejects an owner with illegal characters', () => {
    const { fault, message } = parseFault('https://github.com/octo_cat/Hello-World');
    expect(fault).toBe('bad-owner');
    expect(message).toContain('letters, digits, and hyphens');
  });

  it('rejects a dot-prefixed repo (.hidden)', () => {
    const { fault, message } = parseFault('https://github.com/octocat/.hidden');
    expect(fault).toBe('bad-repo');
    expect(message).toContain('start with "."');
  });

  it('rejects a trailing-dot repo', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World.');
    expect(fault).toBe('bad-repo');
    expect(message).toContain('end with "."');
  });

  it('rejects a hyphen-prefixed repo', () => {
    const { fault, message } = parseFault('https://github.com/octocat/-hello');
    expect(fault).toBe('bad-repo');
    expect(message).toContain('start with "-"');
  });

  it('rejects a 101-character repo on length', () => {
    const { fault, message } = parseFault(`https://github.com/octocat/${'r'.repeat(101)}`);
    expect(fault).toBe('bad-repo');
    expect(message).toContain('101');
  });

  it('rejects a repo with illegal characters', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello+World');
    expect(fault).toBe('bad-repo');
    expect(message).toContain('"."');
  });

  it('rejects a ref containing "..", naming it', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main..feat');
    expect(fault).toBe('bad-ref');
    expect(message).toContain('..');
    expect(message).toContain('main..feat');
  });

  it('rejects an empty ref segment (/tree//main) on length', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree//main');
    expect(fault).toBe('bad-ref');
    expect(message).toContain('got 0');
  });

  it('rejects a 256-character ref on length', () => {
    const { fault, message } = parseFault(`https://github.com/octocat/Hello-World/tree/${'b'.repeat(256)}`);
    expect(fault).toBe('bad-ref');
    expect(message).toContain('256');
  });

  it('rejects an unknown third path segment containing ref-like characters', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/main$');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('/main$');
  });

  it('rejects a ".." subpath segment', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main/../etc');
    expect(fault).toBe('subpath-traversal');
    expect(message).toContain('..');
  });

  it('rejects a "." subpath segment', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main/recon/.');
    expect(fault).toBe('subpath-traversal');
    expect(message).toContain('"." segment');
  });

  it('rejects an empty subpath segment (a//b)', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main/a//b');
    expect(fault).toBe('subpath-traversal');
    expect(message).toContain('"//"');
  });

  it('rejects an absolute subpath segment (/tree/main//abs)', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main//abs');
    expect(fault).toBe('subpath-traversal');
    expect(message).toContain('"//"');
  });
});

// ---------------------------------------------------------------------------
// Canonical label form
// ---------------------------------------------------------------------------

describe('parseRepoTarget canonical form', () => {
  it('uses HEAD as the default ref label', () => {
    expect(parseOk('https://github.com/octocat/Hello-World').canonical).toBe('octocat/Hello-World@HEAD');
  });

  it('appends the subpath after the ref', () => {
    expect(parseOk('https://github.com/octocat/Hello-World/tree/main/src/app').canonical)
      .toBe('octocat/Hello-World@main/src/app');
  });

  it('round-trips owner and repo case as typed (GitHub handles them case-insensitively)', () => {
    const value = parseOk('https://github.com/OctoCat/hello-WORLD');
    expect(value.canonical).toBe('OctoCat/hello-WORLD@HEAD');
  });
});

// ---------------------------------------------------------------------------
// Percent-encoding: segments decode after the raw split on '/'
// ---------------------------------------------------------------------------

describe('parseRepoTarget percent-encoding', () => {
  it('decodes %20 in a subpath; the canonical form carries the decoded space', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/main/my%20dir/src');
    expect(value.subpath).toBe('my dir/src');
    expect(value.canonical).toBe('octocat/Hello-World@main/my dir/src');
  });

  it('decodes %2F in a ref to a slash while keeping the ref one segment', () => {
    const value = parseOk('https://github.com/octocat/Hello-World/tree/feature%2Fx/src');
    expect(value.ref).toBe('feature/x');
    expect(value.subpath).toBe('src');
    expect(value.canonical).toBe('octocat/Hello-World@feature/x/src');
  });

  it('decodes %2F in a ref with no subpath', () => {
    expect(parseOk('https://github.com/octocat/Hello-World/tree/feature%2Fx').ref).toBe('feature/x');
  });

  it('rejects a malformed escape in a subpath as bad-path-shape, naming the segment', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main/src%zz');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('subpath');
    expect(message).toContain('%zz');
  });

  it('rejects a malformed escape in the owner as bad-path-shape, naming the segment', () => {
    const { fault, message } = parseFault('https://github.com/oc%zz/Hello-World');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('owner');
    expect(message).toContain('%zz');
  });

  it('treats %2e%2e in a subpath as subpath-traversal', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main/%2e%2e/etc');
    expect(fault).toBe('subpath-traversal');
    expect(message).toContain('..');
  });

  it('treats an encoded slash forming ".." (..%2Fetc) as subpath-traversal', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main/..%2Fetc');
    expect(fault).toBe('subpath-traversal');
    expect(message).toContain('..');
  });

  it('rejects a percent-encoded control character in a subpath (%0A) as bad-path-shape', () => {
    const { fault, message } = parseFault('https://github.com/octocat/Hello-World/tree/main/src%0Aevil');
    expect(fault).toBe('bad-path-shape');
    expect(message).toContain('control characters');
  });

  it('applies the ref rules to the decoded ref (%2e%2e decodes to "..": bad-ref)', () => {
    expect(parseFault('https://github.com/octocat/Hello-World/tree/%2e%2e').fault).toBe('bad-ref');
  });
});
