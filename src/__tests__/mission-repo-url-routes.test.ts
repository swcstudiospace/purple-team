import { describe, it, expect, afterEach } from 'vitest';

import {
  fetchRepoFiles,
  parseRepoUrlForIngest,
  setRepoIngestFetch,
  RepoIngestError,
} from '../recon/github-ingest.js';
import { parseRepoTarget } from '../recon/repo-url.js';

// Seam semantics for the phase 35 repo-URL routes: the pure ingest functions
// the routes call, asserted by behavior rather than by server source text.

/** Narrow a caught error to RepoIngestError, failing the test on any other shape. */
function asRepoIngestError(err: unknown): RepoIngestError {
  if (!(err instanceof RepoIngestError)) {
    throw new Error(`expected RepoIngestError, got: ${err instanceof Error ? err.message : String(err)}`);
  }
  return err;
}

describe('mission repo-URL seam semantics (the pure functions the routes call)', () => {
  afterEach(() => {
    setRepoIngestFetch(undefined);
  });

  it('parseRepoUrlForIngest surfaces the validator fault verbatim with httpStatus 400', () => {
    // This is the exact error a 400 `repoUrl` response is built from: the
    // route maps `{ message, code }` straight into the response body.
    const badUrl = 'https://github.com/octocat/Hello-World/tree/';
    const parsed = parseRepoTarget(badUrl);
    if (parsed.ok) throw new Error('fixture URL must fail validation');
    let err: unknown;
    try {
      parseRepoUrlForIngest(badUrl);
    } catch (e) {
      err = e;
    }
    const repoErr = asRepoIngestError(err);
    expect(repoErr.code).toBe('invalid_url');
    expect(repoErr.httpStatus).toBe(400);
    expect(repoErr.fault).toBe(parsed.fault);
    expect(repoErr.message).toBe(parsed.message);
  });

  it('stop-before-mission: aborting the registered controller cancels the ingest with zero fetch hops', async () => {
    // Mirrors the stop route's pre-mission behavior: runRepoUrlIngestPhase
    // registers one AbortController per runId, /api/mission/stop aborts it,
    // and the ingest must classify as cancelled without leaving the machine
    // (no fetch, and no slash-branch retry either).
    const fetchUrls: string[] = [];
    setRepoIngestFetch(async (url) => {
      fetchUrls.push(url);
      throw new Error(`unexpected fetch hop: ${url}`);
    });
    // POST /api/mission/stop { runId } semantics: the registered controller
    // is aborted (and its registration deleted) before any command lookup.
    const controller = new AbortController();
    controller.abort();

    const target = parseRepoUrlForIngest('https://github.com/octocat/Hello-World/tree/feature/login-flow');
    let err: unknown;
    try {
      await fetchRepoFiles(target, { signal: controller.signal });
    } catch (e) {
      err = e;
    }
    const repoErr = asRepoIngestError(err);
    expect(repoErr.code).toBe('cancelled');
    expect(repoErr.httpStatus).toBe(499);
    expect(fetchUrls).toEqual([]);
  });
});
