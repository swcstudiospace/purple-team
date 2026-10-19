# 35-CONTEXT — Repo-URL Purple Team Pipeline (node n5)

**Node:** n5 · **Linear:** https://linear.app/swcstudio/issue/SPE-15992/n5-design-repo-url-purple-team-pipeline
**Date:** 2026-10-19 · **Branch:** `v1.7-github-claude-agentpanel`
**Scope:** paste a `github.com` URL → fetch → security-rank → `setWhiteboxSource` → unchanged Purple mission. Private repos ship now (q3). Snippet input removal is gated on live public-repo E2E (q2).
**Sibling:** `35-RESEARCH-GITHUB-SECTION.md` (GitHub OAuth App connection — owned by another node; this doc consumes its "connected token" accessor and nothing else).

---

## 1. Current-state audit (evidence-pinned)

### 1.1 Mission start — `POST /api/mission/start`

Route at `src/server.ts:7389`. Destructures `name/targets/operators/apiKey/provider/model/baseUrl/repoPath` (`src/server.ts:7390-7403`). Two branches:

- **Structured branch** — flipped by `isStructuredStart` = presence of `roleInputs | family | targetContext` (`src/teams/contracts.ts:344-347`, checked at `src/server.ts:7429-7430`). Validates via `validateStructuredStart` (`src/server.ts:7448-7454`), guards each target through `guardAction(...,'mission_execution',...)` (`src/server.ts:7465-7469`), spawns roles, binds `stagedArtifact` into `configureStructuredRun` (`src/server.ts:7511-7520`), starts + responds (`src/server.ts:7546-7565`). **This branch has NO whitebox/repo wiring at all** — `repoPath` is destructured but never used here; the only source-context path is `stagedArtifact.raw`, threaded at `src/index.ts:896-897`.
- **Legacy branch** — guards targets (`src/server.ts:7578-7582`), then resolves `repoPath` through `resolveRepoSourceForAnalysis` with `RepoPathError`/`RepoCloneError` mapped to 400 (`src/server.ts:7584-7595`), and *after* target/operator setup ingests: `ingestRepoToSourceContext(repoSource.repoPath)` → `cmd.setWhiteboxSource(wb.sourceContext)` only when non-empty (`src/server.ts:7640-7647`), cleanup in `finally` (`src/server.ts:7671-7673`). Response carries `whitebox: { includedUnits, droppedUnits, stats, source }` (`src/server.ts:7666`).

`inlineArtifacts` is bound on **both** branches before mission state exists: `bindInlineArtifacts` (`src/server.ts:7435-7441`; impl `src/teams/contracts.ts:217-229`) — one element, `text/plain`, utf8, **64 KiB cap** (`INLINE_ARTIFACT_MAX_BYTES`, `src/teams/contracts.ts:133-137`), sha256 binding (`src/teams/contracts.ts:172-175`), `ArtifactValidationError` carries 400|413 (`src/teams/contracts.ts:159-166`).

**Consequence for this phase:** the SPA hunt surface (`/hunt`, §1.6) posts the *structured* shape, so repo-URL wiring must land in the structured branch — adding it only to the legacy branch would be invisible to the UI.

### 1.2 Whitebox ingest seam — `src/recon/whitebox.ts` (364 ln, read fully)

Pipeline glue: `code-ingest (SELECT) → context-pack (BUDGET) → DecompositionOrchestrator (REASON)` (`src/recon/whitebox.ts:1-9`). Key exports:

- `RepoSourceContext { sourceContext, stats, includedUnits, droppedUnits }` (`src/recon/whitebox.ts:60-70`).
- `resolveContainedRepoPath` — B-03 path containment: realpath, must be dir, confined to `T3MP3ST_REPO_ROOT || homedir()`; throws `RepoPathError` → 400 (`src/recon/whitebox.ts:177-227`).
- **A GitHub path already exists** (corrects the survey's "zero GitHub code"): `isGitHubHttpsRepoUrl` accepts `https://github.com/<owner>/<repo>[.git]` root URLs only (`src/recon/whitebox.ts:96-105`); `cloneGitHubRepoForAnalysis` requires `T3MP3ST_GITHUB_TOKEN || GITHUB_TOKEN` (`src/recon/whitebox.ts:107-119`), shallow-clones `--depth 1 --filter=blob:none` via `git` + askpass helper with token redaction on failure (`src/recon/whitebox.ts:121-163`); `resolveRepoSourceForAnalysis` dispatches URL→clone else local containment (`src/recon/whitebox.ts:166-175`). This is a full-disk `git clone` with a PAT — the phase-35 pipeline replaces it for URL inputs (no git dependency, no temp-dir clone, capped streaming ingest), and it remains as the fallback for `/api/whitebox/analyze`.
- `ingestRepoToSourceContext(repoPath, tokenBudget=24000)` → `ingestRepository(createMultiLangIngestConfig(repoPath))` → `packAnalysisUnits(units, budget)` (`src/recon/whitebox.ts:237-254`).
- `runWhiteboxAnalysis` — full decomposition run; throws only when `stats.files === 0` (`src/recon/whitebox.ts:319-364`, gate at `338-343`). Served by `POST /api/whitebox/analyze` (`src/server.ts:7685-7711`).

### 1.3 Ingest core — `src/recon/code-ingest.ts`

`IngestConfig { repoRoot, includeExts, excludeGlobs, maxFileBytes?, maxFiles?, maxTotalBytes? }` (`src/recon/code-ingest.ts:53-68`). `ingestRepository` = `crawl()` (sync `readdirSync` walk, `src/recon/code-ingest.ts:248-290`) then a loop that `readFileSync(path,'utf8')`s each file and `parseFileMultiLang(path, content, ext)`s it, accumulating `totalBytes` until `maxTotalBytes` trips `stats.truncated` (`src/recon/code-ingest.ts:759-786`). **The disk coupling lives entirely in `crawl` + the `readFileSync` at `src/recon/code-ingest.ts:771`** — everything downstream of that line (`buildCallGraph`, `findEntryPoints`, reachability, exposure classification, priority sort, stats at `:788-801`) is already string-in/units-out. That is the refactor seam (§3.1).

Defaults that bound a runaway repo today: `DEFAULT_EXCLUDES` dir fragments `node_modules/.git/dist/build/venv/.venv/__pycache__/site-packages/test/tests/__tests__/testing` (`src/recon/code-ingest.ts:133-148`); `createMultiLangIngestConfig` sets `includeExts ['.py','.js','.ts','.tsx','.go','.java','.c','.cpp']`, `maxFileBytes 1_000_000`, `maxFiles 50_000`, `maxTotalBytes 1_000_000_000` (`src/recon/code-ingest.ts:870-879`). Honest language-scope caveats are documented at `src/recon/whitebox.ts:11-36` (tree-sitter grammars, fail-open `[]`) and must be echoed in UI copy — never "any repo".

### 1.4 Purple synthesis — unchanged (input path only)

`src/teams/purple.ts` is pure functions, no I/O (`src/teams/purple.ts:1-15`); `synthesize()` correlates findings/detections/verdicts into the posture ledger (`src/teams/purple.ts:111-179`). Served by `POST /api/teams/purple/synthesize`; the server keeps teams modules pure and reads ledgers read-only (`src/server.ts:6630-6635`). This phase changes **what source text operators see**, nothing downstream.

### 1.5 How progress reaches the UI today

- **SSE exists beyond `/api/chat` and is the mission event bus:** `broadcastEvent` fans out to `sseClients` with `redactSecrets` applied (`src/server.ts:5195-5205`); `GET /api/events` is origin-guarded, capped at 64 clients, 30 s heartbeats (`src/server.ts:5207-5258`). Mission lifecycle already flows through it: `mission:started` (`src/server.ts:7547, 7652`), `mission:stopped/paused/resumed` (`src/server.ts:7762, 7780, 7795`), `task:dispatched/completed/failed` (`src/server.ts:8006, 8040, 8056`).
- **Polling:** `GET /api/mission/status` returns the full snapshot — mission, operators, targets, vault, tasks, `operatorTaskRuns` (redacted), findings (`src/server.ts:7802-7847`). The legacy console polls it every 8 s (`docs/index.html:1340`) *and* opens `/api/events` but only logs stream lines (`docs/index.html:808-815`). The SPA fetches it once per refresh via `useResource` keyed on `runId` (`ui/src/pages/Overview.tsx:31-55`, used at `:143`) — no interval.
- **Report export:** `GET /api/mission/report` / `/:id/report` (`src/server.ts:7718-7734`).
- **Stop:** `POST /api/mission/stop` requires a live command (`getTempestCommand()` → 404 if none), stops it, marks pending/running rows interrupted, `cancelAcknowledged: false` (`src/server.ts:7739-7767`). **During a synchronous ingest inside `/api/mission/start` no command exists yet** — a mid-ingest cancel therefore has nothing to stop today.
- **AgentPanel timeline** (below) is per-command fetch/abort only; it has no mission-event subscription.

### 1.6 Guardrails + UI shapes

- `src/teams/guardrails.ts`: `MAX_TOOL_PAYLOAD_BYTES = 2 MiB` and `DEFAULT_TOOL_TIMEOUT_MS = 15 s` (`src/teams/guardrails.ts:8-10`); `runGuardedTool` composes an internal `AbortController` with caller signal + timeout timer and races the handler against abort (`src/teams/guardrails.ts:328-412`) — the exact cancellation pattern this design reuses for fetching. The 2 MiB cap governs *tool/skill payloads*, not HTTP mission bodies; our download caps (§3.3) are separate knobs.
- `ui/src/components/AgentPanel.tsx` (656 ln): 5 tabs (`:34-40`); `TimelineEntry { id, agent, echo, status: 'running'|'ok'|'error'|'aborted'|'help', elapsedMs, httpStatus, error, resultText }` (`:17-26`); `runCommand` does `fetch` with a per-entry `AbortController`, maps non-2xx to `serverErrorMessage(body)` (server `error` string preferred, `:184-190`), aborted → status `'aborted'` (`:364-374`); secret redaction incl. `ghp_/gho_` prefixes (`:82-87`, mirroring `src/redact.ts:13-14`).
- Slash commands come from the server-adjacent shared registry `src/ui-commands/registry.ts` imported directly by the UI (`ui/src/components/AgentPanel.tsx:2-3`) — the precedent for a shared client+server validator module (§2). `/hunt` posts to `/api/mission/start` with `objective/operators/targets/name` (`src/ui-commands/registry.ts:91-102`) and the panel special-cases its body into the structured shape `{ objective, roleInputs, targets, name }` (`ui/src/components/AgentPanel.tsx:164-172`).
- GitHub token hygiene precedents: token never echoed (clone error redaction `src/recon/whitebox.ts:161`; `broadcastEvent` redacts `src/server.ts:5197`); `.env.example:30-31` documents `GITHUB_TOKEN` (xbow-bench).

---

## 2. Shared URL validator — `src/recon/repo-url.ts` (new, one module client+server)

Imported by the UI exactly like `ui-commands` (`ui/src/components/AgentPanel.tsx:2-3` pattern). Pure, sync, no I/O — trivially testable in both `src/__tests__` and UI builds.

```ts
export type RepoUrlFault =
  | 'empty' | 'url-too-long' | 'not-https' | 'bad-host'
  | 'embedded-credentials' | 'query-or-fragment' | 'bad-path-shape'
  | 'bad-owner' | 'bad-repo' | 'bad-ref' | 'subpath-traversal'
  | 'unsupported-view';
export interface ParsedRepoTarget {
  owner: string; repo: string;
  ref: string;        // resolved: explicit ref, else 'HEAD' (= GitHub default branch)
  subpath: string;    // '' = whole repo; else normalized posix path, no leading '/'
  canonical: string;  // `owner/repo@ref[/subpath]` — the n6 label form
}
export function parseRepoTarget(input: string):
  | { ok: true; value: ParsedRepoTarget }
  | { ok: false; fault: RepoUrlFault; message: string };  // message names the EXACT fault
```

Rules (each rejection names the exact fault — no generic "invalid URL"):

1. **Length cap 2048 chars** → `url-too-long` ("URL exceeds 2048 characters (got N)").
2. **Scheme `https:` only** → `not-https` ("use https:// — got http:").
3. **Host `github.com` or `www.github.com`** (www stripped) → else `bad-host` naming the allowed host ("host must be github.com — got gist.github.com"). `api.github.com`, `raw.githubusercontent.com`, codeload etc. are rejected here with a pointer to paste the repo page URL.
4. **No embedded credentials**: `url.username || url.password` non-empty, or `user:token@`/`ghp_…@` forms → `embedded-credentials` ("URL contains embedded credentials — remove them; connect GitHub in Settings instead"). Checked before anything else can echo the credential back.
5. **No query, no fragment** → `query-or-fragment` ("remove the query string `?tab=readme` …").
6. **Path shapes** accepted: `/{owner}/{repo}`, `/{owner}/{repo}.git` (suffix stripped), `/{owner}/{repo}/tree/{ref}[/{subpath…}]`. `/{owner}/{repo}/blob|commit|raw|releases|archive/…` → `unsupported-view` ("replace `/blob/` with `/tree/` or use the repo root"); anything else → `bad-path-shape` (echo the observed path vs expected shape).
7. **Owner** (GitHub rules): 1–39 chars, `[A-Za-z0-9-]`, no leading/trailing `-`, no consecutive `--` → `bad-owner` with the broken rule named. **Repo**: 1–100 chars, `[A-Za-z0-9._-]`, no leading/trailing `.` or `-` → `bad-repo` likewise.
8. **Ref**: `[A-Za-z0-9._-/]` (covers branches, tags, `v1.2.3`, 40-hex SHAs), 1–255 chars, no leading `/`, no `..`, no control chars → `bad-ref` ("ref `refs/heads/x` contains `..`").
9. **Subpath**: normalize posix; reject `.`/`..` segments and empty `//` → `subpath-traversal`. Trailing `/` stripped.
10. **Canonical output**: `owner/repo@ref` (+ `/subpath` when set); `ref` defaults to `HEAD` — codeload resolves `HEAD` to the default branch (live-verified §3.2), so no API call is needed for the default case.

Server treats `repoUrl` presence as the URL-source discriminator; `repoUrl` + `repoPath` together → 400 `conflicting-repo-source` (one source per run).

---

## 3. Ingest pipeline

### 3.1 Whitebox refactor seam (concrete, against the real modules)

**`src/recon/code-ingest.ts`** — split `ingestRepository` (`:759-841`) into:

- `export interface SourceFileInput { path: string; content: string }` — repo-relative **posix** path (matches the `path` field of `CodeBlock`, `src/recon/code-ingest.ts:74`, which is only ever used as a label + exclusion input, never opened).
- `export function ingestFiles(files: SourceFileInput[], limits: { maxTotalBytes?: number }): IngestResult` — the *current* loop body verbatim minus `readFileSync`: per-file `parseFileMultiLang(file.path, file.content, extname(file.path).toLowerCase())`, `totalBytes += content.length`, same `maxTotalBytes` truncation and same `stats` shape (`truncated` optional per `src/recon/code-ingest.ts:120-126`). Note `isExcluded` splits on `sep` (`:225-232`) — on the in-memory path, exclusion already happened upstream, and posix `'/'` equals `sep` on Linux.
- `ingestRepository` becomes: `crawl(config)` → `readFileSync` each → `ingestFiles(...)` (byte-identical outputs; parity covered by existing tests + a new equivalence test).
- Export the two constants the fetch adapter must share so there is ONE authority: `MULTI_LANG_INCLUDE_EXTS` (from `:873`) and `DEFAULT_EXCLUDES` (`:134-148`).

**`src/recon/whitebox.ts`** — add the in-memory entry point beside the path one (both stay; local/clone flows unchanged):

```ts
export function ingestFetchedFilesToSourceContext(
  files: SourceFileInput[],
  tokenBudget = 24000,
): RepoSourceContext {
  const result = ingestFiles(files, { maxTotalBytes: /* same 1 GB sentinel */ });
  const packed = packAnalysisUnits(result.analysisUnits, tokenBudget);
  return { sourceContext: packed.text, stats: result.stats,
           includedUnits: packed.includedUnits.length, droppedUnits: packed.droppedUnits.length };
}
```

Same contract as `ingestRepoToSourceContext` (`src/recon/whitebox.ts:237-254`) so the mission route treats both identically (`cmd.setWhiteboxSource` only when non-empty, mirroring `src/server.ts:7643-7645`).

**`src/recon/github-ingest.ts`** (new) — the fetch adapter: validator → fetch plan → streamed tarball → skip engine → `SourceFileInput[]` + `IngestProgress` + classified errors (§4–§5). No Express, no server state; injected `fetch` for tests (precedent: `setOAuthFetch` in `src/__tests__/oauth.test.ts` per survey §W1).

### 3.2 Fetch strategy — one streamed codeload tarball for BOTH whole-repo and subpath

**Decision: `https://codeload.github.com/{owner}/{repo}/tar.gz/{ref}` streamed and prefix-filtered for subpath scope.** The git/trees API walk is rejected.

Live-verified 2026-10-19 (curl probes, this machine):
- `codeload.github.com/octocat/Hello-World/tar.gz/HEAD` → `200`, `content-type: application/x-gzip`; tarball root dir is `{repo}-{ref}/` (literal ref), first entry is `pax_global_header` (GNU/pax tar).
- `api.github.com/repos/{o}/{r}/tarball/{ref}` → `302` with `Location: https://codeload.github.com/…` — the authed path hands off to a presigned codeload URL, and **it consumes the `core` quota: `x-ratelimit-limit: 60` anonymous**.

Justification:
1. **Rate-limit economics decide it.** Anonymous core quota is 60 req/hr (verified). A trees walk for a 300-file subpath = 1 tree page (100 entries/page ⇒ often 2–4 pages) + up to 300 blob fetches — instant exhaustion and a lockout for the session. The tarball is **one request**, and the anonymous form doesn't touch the core quota at all (direct codeload).
2. **Uniform pipeline.** Whole-repo and subpath share the same decode/skip/cap engine; subpath is just a path-prefix predicate during extraction (root prefix `{repo}-{ref}/` stripped first). No second code path to secure or test.
3. **Out-of-scope bytes are bounded, not unbounded.** The download aborts the moment caps trip (§3.3), so worst case ≈ one capped stream; the trees walk's "efficiency" is illusory under quota anyway.
4. `HEAD` as default ref needs zero API calls (codeload resolves it; verified). Resolved-SHA provenance is deliberately *not* fetched in v1 (root dir echoes the literal ref — verified); see Open Questions.

Stream: `fetch(...)` body → `zlib.createGunzip()` → tar entry stream → per-entry decisions. Tar container parsing is not in `package.json` (`package.json:148-178` has no tar dep) — add **`tar-stream@^3`** (zero-dep, streaming, per-entry backpressure; hand-rolling pax/GNU-longname handling is exactly the kind of subtle code a security tool should not carry). Entries are processed in stream order; skip/counter updates are O(1).

### 3.3 Caps (config knobs + clear exceeded messaging)

All env-overridable, documented in `.env.example` beside `GITHUB_TOKEN` (`.env.example:30-31`), mirroring the `T3MP3ST_*` convention (`.env.example:22-37`):

| Knob | Default | Meaning |
|---|---|---|
| `T3MP3ST_REPO_MAX_DOWNLOAD_BYTES` | 64 MiB | decompressed bytes of *selected* files; breach aborts stream → terminal `oversized` |
| `T3MP3ST_REPO_MAX_FILES` | 5,000 | selected files kept; breach → `oversized` (file-count copy) |
| `T3MP3ST_REPO_MAX_FILE_BYTES` | 1 MiB | per-file cap (matches ingest `maxFileBytes 1_000_000`, `src/recon/code-ingest.ts:875`); per-file skip, **not** terminal |
| `T3MP3ST_REPO_TIMEOUT_MS` | 120,000 | overall wall-clock per ingest (§4) |

Exceeded messaging always carries both numbers + one remediation: e.g. `Repo exceeds the 64 MiB download cap (hit 64.0 MiB at src/gen/proto/x.pb.ts). Narrow the URL to a /tree/<ref>/<subpath> scope, or raise T3MP3ST_REPO_MAX_DOWNLOAD_BYTES.` Downstream `maxTotalBytes`/`maxFiles` from `ingestFiles` keep today's 1 GB / 50 k sentinels (`src/recon/code-ingest.ts:875-877`) — the fetch caps are the first, tighter gate.

### 3.4 Skip rules (ordered; first match wins; one reason per file)

The skip engine runs *inside* `github-ingest.ts` on every tar entry, before decode:

1. `dir-fragment` — any path segment in exported `DEFAULT_EXCLUDES` (`node_modules/.git/dist/build/venv/.venv/__pycache__/site-packages/test/tests/__tests__/testing`, `src/recon/code-ingest.ts:134-148`) **plus** `vendor`, `target`, `out`, `.next`, `coverage` (fetch-side additions, kept in the adapter, not silently widening the local-flow contract).
2. `out-of-scope` — subpath runs: path lacks the requested prefix.
3. `ext-not-analyzable` — extension not in exported `MULTI_LANG_INCLUDE_EXTS` (`.py .js .ts .tsx .go .java .c .cpp`, `src/recon/code-ingest.ts:873`). This drops images/media/archives wholesale.
4. `lockfile` — basename ∈ {`package-lock.json`,`yarn.lock`,`pnpm-lock.yaml`,`Poetry.lock`,`poetry.lock`,`Cargo.lock`,`go.sum`,`Gemfile.lock`,`composer.lock`,`Pipfile.lock`,`flake.lock`}.
5. `binary-signature` — NUL byte in the first 8 KiB of the entry stream (catches extensionless/binaries that slipped rule 3).
6. `minified` — `.min.`/`.bundle.`/`-bundle.` in basename, or any single line ≥ 2,000 chars.
7. `file-too-large` — entry size > `T3MP3ST_REPO_MAX_FILE_BYTES` (numbers in summary).
8. `non-utf8` — fatal UTF-8 decode failure or NUL beyond the 8 KiB head.

**Visible skip summary** (counts + reasons, no paths beyond the first example each): returned as `whitebox.skipSummary: { total: number; byReason: Record<string, number>; example: Record<string, string> }` in the start response, mirrored into the SSE phase `detail` (§5). Skips are *not* errors; a repo that skips everything and selects 0 files still reaches the existing `stats.files === 0` honesty gate (`src/recon/whitebox.ts:338-343` semantics preserved via the empty-source rule at `src/server.ts:7643-7645`).

**Decode constraints:** `TextDecoder('utf-8', { fatal: true })`, BOM stripped, no newline normalization (local flow uses raw `readFileSync(path,'utf8')` output, `src/recon/code-ingest.ts:771` — parity matters for block line numbers).

---

## 4. Fetch safety

- **SSRF origin allowlist per redirect hop.** All requests use `redirect: 'manual'`; max 5 hops. Each hop: resolve `Location` against the current URL, require `https:` and host ∈ `{ api.github.com, codeload.github.com, objects.githubusercontent.com, raw.githubusercontent.com }`. Any other host aborts with terminal `network` error, fault `redirect-blocked`, message naming the blocked host ("redirect to evil.example refused — only GitHub fetch hosts are allowed"). The 302 target host was live-verified as `codeload.github.com` (§3.2); `objects.githubusercontent.com` is kept for LFS/archive variants.
- **Token placement.** `Authorization: Bearer` is attached **only when the next hop host is `api.github.com`** — never re-sent to codeload/raw hops (the redirect URL is presigned; verified 302 flow). Token resolution order (q3 = private now): connected GitHub OAuth token (accessor from the sibling GitHub-section design) → `T3MP3ST_GITHUB_TOKEN` → `GITHUB_TOKEN` (precedent `src/recon/whitebox.ts:107-109`) → anonymous. Anonymous uses the direct codeload URL (zero core-quota use, zero token).
- **Anonymous vs authed URL.** Anonymous: `codeload.github.com/{o}/{r}/tar.gz/{ref}`. Authed: `api.github.com/repos/{o}/{r}/tarball/{ref}` (302 → presigned codeload). Private repos 404 both ways without a `repo`-scoped token — classified `private_inaccessible` (§5), never retried anonymously.
- **Timeout + cancellation.** One `AbortController` per ingest: `setTimeout(T3MP3ST_REPO_TIMEOUT_MS)` + linked caller signal — the exact composition of `runGuardedTool` (`src/teams/guardrails.ts:386-399`): internal controller, external abort listener, timer abort, race. The stream reader passes `controller.signal` into `fetch`; cap breaches (§3.3) and `/api/mission/stop` (§6.3) abort the same controller, tearing down the socket mid-stream.
- **Token hygiene.** Errors are constructed token-free (host/status/codes only); `broadcastEvent` redaction (`src/server.ts:5197`) is defense-in-depth. Never log the URL *after* credential rejection (the validator never echoes the credential portion).

---

## 5. Progress + errors

### 5.1 Channel: existing `/api/events` SSE via `broadcastEvent`

**Decision: SSE, not polling.** Correcting the survey premise with repo evidence: SSE is not chat-only — `/api/events` is the standing mission bus (`src/server.ts:5210-5258`) and `broadcastEvent` already carries `mission:*`/`task:*` (`src/server.ts:7652, 7762, 8006, 8040, 8056`). Rationale:
1. Ingest progress is bursty sub-second telemetry (per-file counters); the SPA's fetch-once `useResource` (`ui/src/pages/Overview.tsx:31-55`) can't see it, and 8 s polling (legacy, `docs/index.html:1340`) would miss or coarsen it.
2. Ingest runs synchronously inside `POST /api/mission/start` (today's pattern, `src/server.ts:7641-7647`), so the HTTP response can only carry the *terminal* state; live updates need a side channel, and SSE already exists with origin guard + client cap.
3. Phase 36 wants the same feed for the full-screen panel (n6 aligned, below) — one subscription, two consumers.
Fallback for SSE-less clients: the terminal summary is always in the start response (`whitebox` field, `src/server.ts:7666` shape extended) and mirrored into `GET /api/mission/status` as `whitebox` (module-level last-ingest record, exposed alongside the existing snapshot fields, `src/server.ts:7814-7846`).

### 5.2 Event contract — aligned with n6 (DesignAgentPanel)

Event name `purple-run` on `/api/events`. Payload is the n6 `PurpleRunData` projection (their `data-purple-run` UIMessage part) with the two agreed widenings (`counters.filesFetched/filesSkipped/bytesFetched`, `errorCode` beside `error`):

```ts
{
  runId: string;                 // minted at request acceptance, echoed in the POST response
  label: string;                 // canonical `${owner}/${repo}@${ref}` (validator output)
  state: 'queued'|'ingesting'|'running'|'done'|'error'|'cancelled';
  phases: Array<{ id: 'resolve'|'fetch'|'analyze'; label: string;
                  state: 'pending'|'active'|'done'|'error'; detail?: string }>;
  counters?: { filesFetched?: number; filesSkipped?: number; bytesFetched?: number;
               tasksDone?: number; tasksTotal?: number; findings?: number };
  startedAt: number; endedAt?: number;
  error?: string; errorCode?: RepoIngestErrorCode;
}
```

Granular events (`files-discovered`, `fetched`, `skipped`, `bytes` deltas) are **throttled into this rollup** — emit at most every 250 ms or every 100 files — to respect the 64-client SSE fan-out (`src/server.ts:5207-5209`). `analysis-started` = the `analyze` phase flipping `active`. Progress events flow from ingest start until `cmd.start()`; mission lifecycle events then continue on the existing `mission:*`/`task:*` names.

### 5.3 Terminal error taxonomy (distinct copy + retry guidance, one code each)

| errorCode | Trigger (observable) | HTTP | Copy (essence) | Retry guidance |
|---|---|---|---|---|
| `invalid_url` | validator fault (§2) | 400 | names the exact fault ("ref `x..y` contains `..`") | none — fix the URL; faults are self-describing |
| `repo_not_found` | 404 on repo metadata/tarball for a *known-public-shape* miss | 404 | `Repository owner/repo not found on github.com` | "Check spelling; if it is private, see below" |
| `private_inaccessible` | 404 while a token IS attached, or 404 anonymous + `not_connected` context | 402 | `owner/repo is private or does not exist` | "Connect GitHub with the repo scope in Settings, then retry" (q3) |
| `not_connected` | no token available AND repo requires auth (404/redirect-to-login) | 402 | `No GitHub connection is configured, and owner/repo is not accessible anonymously` | "Connect GitHub (repo scope) or set T3MP3ST_GITHUB_TOKEN, or pick a public repo" |
| `rate_limited` | 403/429 with `x-ratelimit-remaining: 0` or `Retry-After` (header is exposed, live-verified §3.2) | 429 | `GitHub rate limit reached (resets at HH:MM)` | honor `Retry-After` seconds, else core-reset epoch; never auto-hammer |
| `oversized` | any cap in §3.3 | 413 | cap name + both numbers + first offending file | "narrow to a /tree/<ref>/<subpath> scope or raise the named knob" |
| `network` | ENOTFOUND/ECONNRESET/TLS/timeout/`redirect-blocked` | 502 | `Could not fetch owner/repo@ref from GitHub: <class>` | "Check connectivity; the fetch is a single GitHub request — retry is safe" |
| `cancelled` | abort via `/api/mission/stop` or client disconnect | — (entry state) | `Ingest cancelled after N files (X MiB)` | none — matches AgentPanel `'aborted'` status (`ui/src/components/AgentPanel.tsx:8, 366-367`) |

Server mapping: single `RepoIngestError { code, httpStatus, message }` thrown by `github-ingest.ts`; the route catches and responds `{ error: message, errorCode, retryHint }` — `error` stays a plain string per the cross-cutting rule (survey §Cross-cutting: "error bodies carry only `error: string`" — the extra fields ride *beside* `error`, and the AgentPanel's `serverErrorMessage` already prefers the `error` string, `ui/src/components/AgentPanel.tsx:184-190`).

---

## 6. Run configuration + wiring

### 6.1 Run shape

`repoUrl` (string, optional) on `POST /api/mission/start`, both branches. The URL **is** the ref/branch + scope selector: `/tree/{ref}/{subpath}` encodes branch/tag/SHA + subpath; repo root = default branch (`HEAD`). No separate selector fields in v1 — one arg, zero ambiguity, canonical label falls out of the validator. `/hunt` gains `{ name: 'repoUrl', required: false, hint: 'github.com owner/repo[/tree/ref/subpath] URL' }` (`src/ui-commands/registry.ts:91-102`) and the hunt body builder passes it through (`ui/src/components/AgentPanel.tsx:164-172`). Client-side pre-validation uses the same module for instant fault feedback; the server **always** re-validates (client code is untrusted by convention).

### 6.2 Wiring (both branches, ordering preserved)

Legacy branch — insert beside the existing `repoPath` block (`src/server.ts:7584-7595`), after `guardAction` approval (`:7578-7582`): parse+fetch+ingest via adapter → `cmd.setWhiteboxSource` before `cmd.start()` (same guard: only when non-empty, `:7643-7645`) → response `whitebox: { includedUnits, droppedUnits, stats, source: 'github', skipSummary, runId, label }`.

Structured branch — **the new capability**: after `guardAction` targets (`src/server.ts:7465-7469`) and before `createTempestCommandInstance` (`:7471-7478`), run the ingest (it is pre-mission, pre-spawn; guards already approved the run). After spawn, `cmd.setWhiteboxSource(pack)` **before** `cmd.start()` (`:7546`) — precedence over `stagedArtifact.raw` (which is threaded inside `configureStructuredRun`, `src/index.ts:896-897`): when `repoUrl` is present, the repo pack wins (real source supersedes a pasted snippet; `setWhiteboxSource` also re-propagates to already-spawned operators, `src/index.ts:1425-1430`). `inlineArtifacts` stays bound and echoed (`:7435-7441`, `:7562`) until the q2 gate.

Mission agents/prompts/results are untouched: `setWhiteboxSource` only threads source text into operator loops (`src/index.ts:344-348, 1409-1411`); synthesis is pure (`src/teams/purple.ts:111-179`); the adapter packs fetched files into the *same* whitebox-source path the snippet/local flows use (§3.1), so operator behavior is bit-identical to a local-repo run of the same content.

`runId` for events: structured branch reuses `start.runId` (pre-spawn, `src/server.ts:7507,7523-7532`); legacy branch mints `run-<uuid>` at request acceptance. Both echo it in the response so the UI can join SSE events to the POST.

### 6.3 Cancel

`/api/mission/stop` is extended (agreed with n6): a module-level `Map<runId, AbortController>` of in-flight ingests; the stop handler checks it **first** — today it 404s when no command exists (`src/server.ts:7739-7746`) — aborts, responds `{ success: true, cancelledIngest: true }`, then falls through to the existing stop path for started missions. Client disconnect on the POST also aborts (request `close` listener), matching the honest-cancel stance (`cancelAcknowledged: false`, `src/server.ts:7763-7766`).

### 6.4 Snippet-input removal — gated on live public-repo E2E (q2)

Gate: a live E2E against a real public repo (checklist §8) proving URL→whitebox→mission→report end-to-end on the SPA hunt surface. Only then: remove the snippet input affordances from the hunt surfaces (legacy console hunt form; SPA keeps no snippet composer today — survey §W2 "no URL-target input anywhere in the SPA"; `inlineArtifacts` in the SPA arrives only via this phase's predecessor flows). **Server API keeps `inlineArtifacts`** — it is the structured-role staging mechanism (`configureStructuredRun` staged artifact, `src/server.ts:7511-7520`), used by non-UI callers (MCP `tempest_mission_start`, `docs/MCP_GUIDE.md:78`); removing the *input UI* ≠ removing the contract. Rollback = revert the UI commit; server untouched.

---

## 7. Changed files

| File | Change |
|---|---|
| `src/recon/repo-url.ts` | **NEW** — shared validator (`parseRepoTarget`, faults, canonical form) |
| `src/recon/code-ingest.ts` | extract `ingestFiles` + `SourceFileInput`; export `MULTI_LANG_INCLUDE_EXTS`, `DEFAULT_EXCLUDES`; `ingestRepository` becomes wrapper |
| `src/recon/whitebox.ts` | add `ingestFetchedFilesToSourceContext`; existing exports unchanged |
| `src/recon/github-ingest.ts` | **NEW** — fetch adapter: fetch plan (anon/authed), redirect allowlist loop, tar-stream extraction, skip engine, caps, `RepoIngestError`, progress emitter (injected `fetch`) |
| `src/server.ts` | mission/start: `repoUrl` handling in BOTH branches (+ `conflicting-repo-source` 400); mission/stop: in-flight ingest abort; mission/status: `whitebox` last-ingest summary; `purple-run` broadcasts |
| `src/ui-commands/registry.ts` | `/hunt` `repoUrl` arg |
| `ui/src/components/AgentPanel.tsx` | `repoUrl` in hunt body builder; `EventSource('/api/events')` subscription for `purple-run` (ingest phase line + counters in timeline entry detail); `errorCode` → copy/retry mapping |
| `ui/src/api/client.ts` | response types (`MissionStatusResponse.whitebox`, start-response `whitebox`/`errorCode`) |
| `package.json` | `+ tar-stream@^3` |
| `.env.example` | `T3MP3ST_REPO_MAX_DOWNLOAD_BYTES / _MAX_FILES / _MAX_FILE_BYTES / _TIMEOUT_MS` |
| tests | `src/recon/__tests__/repo-url.test.ts`, `src/recon/__tests__/github-ingest.test.ts`, code-ingest parity test, server route tests, ui static test for the new subscription (mirror `oauth-ui-static.test.ts` pattern) |

Out of scope / untouched: `src/teams/purple.ts` (pure, input path only), operator prompts, `src/index.ts` whitebox threading, `/api/whitebox/analyze` local flow, GitHub OAuth connection itself (sibling doc).

---

## 8. Test plan

**Validator unit matrix** (`repo-url.test.ts`): happy paths (root, `.git`, `www.`, `/tree/main`, `/tree/v1.2.3/src`, `/tree/40-hex`, trailing slash) × faults: http scheme; `gist.github.com`/`api.github.com` host; `https://user:token@github.com/o/r` and `ghp_x@` credentials; `?tab=readme`, `#anchor`; `/blob/`, `/commit/`, `/releases/`; owner 40 chars/leading `-`/`--`; repo `.hidden`/trailing `.`; ref `..`, leading `/`, 256 chars; subpath `../`, `a//b`, `/abs`; 2049-char URL; canonical assertions (`owner/repo@HEAD`, label form).

**Error mapping** (`github-ingest.test.ts`, injected `fetch`): 404 anon → `not_connected` vs 404 with token → `private_inaccessible`; 403 + `x-ratelimit-remaining: 0` → `rate_limited` with reset epoch in copy; cap breach → `oversized` with both numbers; `Location: https://evil.example` → `redirect-blocked` under `network`; ECONNRESET → `network`; abort → `cancelled`; every message token-free.

**Skip rules**: fixture tarball (synthetic gz via `zlib`) with `pax_global_header`, root prefix, nested `node_modules/`, `vendor/`, `package-lock.json`, `x.min.js`, 2 MiB file, NUL-head file, latin-1 file, in/out-of-subpath files — assert per-reason counts, examples, and that selected files decode fatal-UTF-8 only.

**Cap enforcement**: streaming abort — fetch body emits > cap then asserts controller aborted, socket teardown called, `oversized` terminal, counters frozen; `T3MP3ST_REPO_TIMEOUT_MS` expiry → `network`(timeout) classification.

**Refactor parity**: `ingestRepository(path)` vs `crawl+read → ingestFiles` on identical fixture trees → deep-equal `IngestResult` (incl. `truncated` both ways); existing whitebox tests stay green.

**Route/integration**: structured + legacy start with `repoUrl` (mock adapter) → `setWhiteboxSource` called pre-`start`, response carries `whitebox.skipSummary` + `runId`; `repoUrl`+`repoPath` → 400; mission/stop during ingest → `cancelledIngest: true`; `purple-run` events throttled ≤4/s.

**Live-run checklist (manual, gates q2)**: public repo whole-repo; public repo `/tree/<branch>/<subdir>`; 404 repo; private repo connected-token; private repo anonymous; rate-limit window; >64 MiB repo; cancel mid-fetch; SSE drop + reconnect → status fallback shows terminal summary; mission report renders after URL-run.

---

## 9. Risks

- **Tar dep supply chain** (`tar-stream`) — small, widely used, streaming-only; pinned caret range; no eval paths. Alternative (hand-rolled ustar/pax reader) documented and rejected (§3.2).
- **Codeload format drift** (pax root naming) — root-prefix strip is by first-segment + `pax_global_header` skip, live-verified; covered by fixture test so drift fails loud.
- **Synchronous ingest inside the start request** — bounded by caps + 120 s timeout; the event loop stays free (streaming async); SSE gives visibility. If field usage shows pain, the two-phase job split (§5.1 alternative) is a contained follow-up — contract (runId, events, response shape) already supports it.
- **Authed flows spend core quota** (1 request per ingest; verified `x-ratelimit-resource: core` on the tarball endpoint) — 60/hr anonymous vs connected-token budget; `rate_limited` copy includes reset time.
- **Structured-branch behavior change** (whitebox now possible where it never was) — ordering after `guardAction` preserved; precedence rule pinned (§6.2).
- **Token leakage** — constructed-token-free errors, allowlisted redirect auth, `redactSecrets` on broadcast (`src/server.ts:5197`), validator never echoes credentials (§4).

## 10. Open questions

1. **Connected-token accessor name/shape** from the sibling GitHub-section doc (`35-RESEARCH-GITHUB-SECTION.md`) — this design assumes `getConnectedGitHubToken(): string | undefined` with `repo` scope when connected; reconcile at PLAN time.
2. **Default-branch display name** — `HEAD` literal is used as the canonical ref (zero API calls); resolving `main`/`master` for display costs 1 core call per run — defer unless UI needs it.
3. **Resolved-commit SHA provenance** — codeload root dir echoes the literal ref (verified), not the SHA; if reports need immutable provenance, add the 1-call `git/commits/{ref}` lookup at PLAN time.
4. **`/blob/` single-file URLs** — rejected by the validator in v1 (`unsupported-view`); a single-file scope is trivially the subpath engine + one file, worth adding only if users hit it.
5. **SVG/Markdown retention** — dropped by `ext-not-analyzable` (not in `MULTI_LANG_INCLUDE_EXTS`, `src/recon/code-ingest.ts:873`) — intentional (ingest cannot rank them), but copy must not imply "everything was read".
6. **Last-ingest summary persistence across restarts** — v1 keeps it in-memory on `/api/mission/status`; if mission history (q4 sidebar) needs it later, move into the persisted ledger substrate n6 designs.
