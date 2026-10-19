import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  fetchRepoFiles,
  parseRepoUrlForIngest,
  setRepoIngestFetch,
  RepoIngestError,
} from '../recon/github-ingest.js';
import { parseRepoTarget } from '../recon/repo-url.js';

// Route-contract pins for the phase 35 repo-URL mission wiring (P2e).
//
// server.ts starts listening on import, so (like phase28-workflow-routes and
// the blue/black/white-routes-static tests) the route half asserts against the
// server source instead of importing the app or hitting handlers over HTTP.
// The seam half imports the pure ingest functions the routes call and
// exercises the exact semantics the routes promise: the validator fault text
// that a 400 carries, and the cancellation an ingest-only stop relies on.

const serverSource = readFileSync(join(process.cwd(), 'src/server.ts'), 'utf8');

function routeBlock(path: string): string {
  const marker = `app.post('${path}'`;
  const start = serverSource.indexOf(marker);
  expect(start, `missing route registration ${marker}`).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\n});', start);
  expect(end, `unterminated route block for ${path}`).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

/** The runRepoUrlIngestPhase function block (first `\n}` at column 0 closes it). */
function ingestPhaseFn(): string {
  const marker = 'async function runRepoUrlIngestPhase';
  const start = serverSource.indexOf(marker);
  expect(start, 'missing runRepoUrlIngestPhase definition').toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\n}', start);
  expect(end, 'unterminated runRepoUrlIngestPhase block').toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

/** Narrow a caught error to RepoIngestError, failing the test on any other shape. */
function asRepoIngestError(err: unknown): RepoIngestError {
  if (!(err instanceof RepoIngestError)) {
    throw new Error(`expected RepoIngestError, got: ${err instanceof Error ? err.message : String(err)}`);
  }
  return err;
}

describe('mission repo-URL routes (source pins)', () => {
  it('mission/start accepts repoUrl on BOTH start branches', () => {
    const block = routeBlock('/api/mission/start');
    // The ingest phase runs once per branch, gated on the same trimmed input.
    expect(block.split('runRepoUrlIngestPhase(').length - 1).toBe(2);
    expect(block.split("if (repoUrlInput !== '')").length - 1).toBe(2);
    // Structured branch: the POST's runId doubles as the purple-run SSE id.
    expect(block).toContain('runRepoUrlIngestPhase(repoUrlInput, start.runId, res)');
    expect(block).toContain('runId: start.runId');
    // Legacy branch: runId minted at request acceptance, echoed on success.
    expect(block).toContain('const repoUrlRunId = `run-${randomUUID()}`');
    expect(block).toContain('runRepoUrlIngestPhase(repoUrlInput, repoUrlRunId, res)');
    expect(block).toContain('runId: repoUrlRunId');
    // Both branches hand the packed source to the command pre-start().
    expect(block.split('cmd.setWhiteboxSource(repoUrlPack.sourceContext)').length - 1).toBe(2);
    // Both branches map a failed ingest to the classified status verbatim.
    expect(block.split('res.status(outcome.error.httpStatus)').length - 1).toBe(2);
  });

  it('an invalid repoUrl answers 400 with the validator\'s fault text', () => {
    const block = routeBlock('/api/mission/start');
    const fn = ingestPhaseFn();
    // The ingest phase validates through the shared validator seam (its
    // RepoIngestError carries the validator message + httpStatus 400)…
    expect(fn).toContain('parseRepoUrlForIngest(repoUrl)');
    // …and the route passes that message/status through untouched: the 400
    // body is `{ error: <validator fault text>, errorCode, runId }`.
    expect(block).toContain('error: outcome.error.message');
    expect(block).toContain('errorCode: outcome.error.code');
    expect(block).toContain('res.status(outcome.error.httpStatus)');
  });

  it('repoUrl + repoPath conflict → 400 before either branch runs', () => {
    const block = routeBlock('/api/mission/start');
    expect(block).toContain("res.status(400).json({ error: 'conflicting-repo-source:");
    expect(block).toContain('not both');
    // A non-string repoUrl is the other route-side 400.
    expect(block).toContain("res.status(400).json({ error: 'repoUrl must be a string");
    // The conflict gate precedes every ingest call — no fetch leaves the
    // machine for a conflicted body.
    const conflictAt = block.indexOf('conflicting-repo-source');
    const firstIngestAt = block.indexOf('runRepoUrlIngestPhase(');
    expect(conflictAt).toBeGreaterThanOrEqual(0);
    expect(conflictAt).toBeLessThan(firstIngestAt);
  });

  it('the ingest phase registers its AbortController BEFORE fetching and clears it in finally', () => {
    const fn = ingestPhaseFn();
    const registerAt = fn.indexOf('inFlightRepoIngests.set(runId, controller)');
    const fetchAt = fn.indexOf('await fetchRepoFiles(');
    expect(registerAt, 'ingest must register its controller in inFlightRepoIngests').toBeGreaterThanOrEqual(0);
    expect(registerAt).toBeLessThan(fetchAt);
    expect(fn).toContain('signal: controller.signal');
    expect(fn.indexOf('inFlightRepoIngests.delete(runId)')).toBeGreaterThan(fetchAt);
    expect(fn).toContain('} finally {');
  });

  it('mission/stop consults the in-flight ingest registry FIRST and answers 200 for ingest-only cancels', () => {
    const block = routeBlock('/api/mission/stop');
    // Registry is consulted before any command lookup — in the pre-mission
    // window (synchronous ingest inside mission/start) no command exists yet.
    const registryAt = block.indexOf('inFlightRepoIngests');
    const cmdAt = block.indexOf('getTempestCommand()');
    expect(registryAt).toBeGreaterThanOrEqual(0);
    expect(registryAt).toBeLessThan(cmdAt);
    // Matching controllers are aborted; optional body { runId } targets one
    // run, absent runId aborts every in-flight ingest.
    expect(block).toContain('controller.abort()');
    expect(block).toContain("typeof body.runId === 'string'");
    // Ingest-only cancel is a success — never the no-active-mission 404.
    expect(block).toContain('res.json({ success: true, cancelledIngest: true, cancelledRunIds })');
    // A stopped mission echoes the same cancel fields alongside the honest
    // cancelAcknowledged: false contract.
    expect(block).toContain('cancelAcknowledged: false');
    expect(block).toContain('{ cancelledIngest: true, cancelledRunIds }');
  });
});

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
