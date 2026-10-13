# Phase 22: ROE Text as Server State - Research

**Researched:** 2026-10-12
**Domain:** Express 4 server state extension (single-slot store + PUT/GET route pair) wiring existing pure ROE engines (`parseRoe`, `roeAudit`) to on-record text, with provenance, redaction, and honesty-pin evolution
**Confidence:** HIGH (every claim below was read from this checkout this session; citations are `path:line` + verbatim quotes)

## User Constraints (from CONTEXT.md)

<user_constraints>

## User Constraints (from 22-CONTEXT.md)

### Locked Decisions (owner-accepted grey areas, 2026-10-12)
- **Action source**: actions to adjudicate are stored WITH the ROE record — the mutation stores `{ text, actions, revision }` as one record; verdicts are computed on read over the stored actions. White stays self-contained; NO mission-module coupling (mission-drafts-as-actions was unproven research inference).
- **Verdict persistence**: computed on read. No verdict ledger slot in this milestone (deferred to v2 with revision history).
- **Mutation route**: `PUT /api/teams/white/roe` — replace-latest semantics mirroring the `purpleSyntheses` `'latest'` slot. The static pin is REWRITTEN sharper: forbids POST on the path AND requires revision identity in the stored record.
- **Body cap**: 64 KiB on the mutation route body.

### Locked doctrine (binding)
- ROE text is untrusted DATA: deterministic `parseRoe` is the ONLY scope-setter; if ROE text is ever surfaced to referee LLMs it is delimited, labeled data-only — never instructions.
- Missing or corrupt stored ROE fails closed to cannot-derive — never empty-spec-continue (the allowedTargets bug class). Class pin `roeAudit(actions, {})` never all-compliant stays green or sharper.
- `ok:false` never yields verdicts; every verdict carries full `RoeVerdict` shape + provenance (ROE revision/text hash, `parseRoe` line refs).
- `redactSecrets` on every emission (route responses, logs); text stored as-given, redacted at read — divergence from write-time ledger redaction documented.
- New route mounts under `/api/*` so the early-mounted bearer guard + rate limit cover it on non-loopback (explicit non-loopback test).
- Pins evolve same-commit, never weaken: `white-routes-static.test.ts` honesty pins ("no ROE store" / "no ROE text on record") are inverted to equally sharp positive pins.

### Deferred Ideas (OUT OF SCOPE)
- Persisted verdict ledger slot (v2 differentiator)
- ROE revision history/listing endpoint (v2)
- Purple auto-consumption of recorded verdicts (v2)
- Text provenance fields (who/when/source) beyond revision identity (v2)
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROE-01 | Operator loads ROE text via a `/api/*` mutation route; `GET /api/teams/white/roe` returns deterministic parse plus provenance-stamped `RoeVerdict`s (ROE revision/text hash, line refs) when and only when `parseRoe` is `ok:true`; missing or corrupt stored ROE fails closed to cannot-derive; emissions are `redactSecrets`-wrapped; ROE text is untrusted data (deterministic scope only) | Store shape §Architecture Patterns; route/cap/error semantics §Route Wiring; provenance fields §Revision Identity; pin rewrite §Pins To Rewrite; non-loopback test §Non-Loopback Coverage; bench case §Bench; docs sync §Docs/Skills/MCP Surfaces; supersession §Supersession Entry |
</phase_requirements>

## Summary

Phase 22 is a **pure server.ts extension over machinery that already exists**. The `purpleSyntheses` single-slot store (declared `src/server.ts:908-915`, written in the purple route at `:6457-6462`) is a complete precedent: declare a `Map<string, Record>` in the state block, add one spread line to `buildStateSnapshot()` (`:1190` precedent), one `replaceMapContents` line to `loadPersistedState()` (`:1261` precedent), and persistence/restore/shutdown-flush all come for free from the debounced `persistState` writer (`:1194-1235`) and `flushPersist` shutdown hook (`:8467-8472`). The new `roeRecords` slot mirrors this exactly. GET (`src/server.ts:6564-6567`, currently `{ ...parseRoe(''), summary: 'no ROE text on record' }`) grows additively: parse the stored text, and only when `ok:true` run `roeAudit` over the record's stored actions, stamping each verdict with `{ revision, textHash, line refs }`.

Three verified footguns shape the design and none is speculative: **(1)** a full-length sha256 hex digest stored in the record would be **self-redacted** by `redactSecrets`' `aws_secret_key` pattern (`[A-Za-z0-9/+=]{40}` matches any 40+ char hex string — `src/redact.ts:10`); the in-repo hash precedent deliberately slices to 16 chars (`memoryFingerprint`, `src/server.ts:1137-1141`) and this phase must do the same. **(2)** `persistState` wraps the *entire* snapshot in `redactSecrets(...)` before writing `state.json` (`src/server.ts:1197`), so the persisted (and post-restart-restored) ROE text is the *redacted* text — revision identity must be stamped into the record at PUT time, and a recompute-and-compare hash check at GET is the natural corrupt-record detector. **(3)** the static pin `quotedPathCount('/api/teams/white/roe') === 1` (`src/__tests__/white-routes-static.test.ts:12-14,26-30`) **breaks the moment** `app.put('/api/teams/white/roe')` is added — the pin rewrite is not optional housekeeping, the suite goes red without it.

**Primary recommendation:** mirror `purpleSyntheses` end-to-end — `roeRecords = new Map<string, RoeRecord>()` keyed `'latest'` with `RoeRecord = { id: 'latest', revision, textHash, text, actions, createdAt, updatedAt }`; one `app.put` route with an in-handler 64 KiB byte check (413) and purple-style 400 validation; GET stays a 200-honest report in every state (empty / ok:false / corrupt), adding `verdicts` + `provenance` only when `ok:true`; rewrite the honesty pins to positive form in the same commit; append the SUPERSESSION.md row in the same commit.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ROE record storage + revision stamping | API/Backend (`src/server.ts`) | — | House rule: all I/O state lives in server.ts; `src/teams/` is pure/no-I/O ("Dependency direction stays server → teams", server.ts:6548) |
| ROE text → spec parsing | Pure engine `parseRoe` (`src/teams/white/roe-parser.ts:88`) | — | Already landed, deterministic, line-accounting doctrine; unchanged |
| Action adjudication | Pure engine `roeAudit` (`src/teams/white.ts:40`) | — | Already landed; unchanged; verdicts computed on read per locked decision |
| Secret redaction at every boundary | `redactSecrets` (`src/redact.ts:54`) | — | Shared pure module; wraps route JSON, SSE, event log, and state.json writes today |
| Non-loopback authN/authZ + rate limit | `createRemoteGuard` (`src/net/remote-access.ts:89-120`), mounted `src/server.ts:345-351` | — | Prefix-matches `/api/*`, method-agnostic → PUT covered with zero new security code; semantics must NOT change (REQUIREMENTS Out of Scope) |
| Loopback CSRF/Origin + Host guards | `src/server.ts:289-300` (PUT is in `STATE_CHANGING_METHODS`, `:289`), `:325-334` | — | Automatically cover the new verb; no wiring |
| Honesty surfaces (docs/skills/MCP) | Docs + skills + MCP descriptions | — | Lockstep same-commit updates; enumerated below with verbatim current text |

## Standard Stack

### Core (all already in repo — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.x (`@types/express ^4.17.21`, package.json:172) | route + global json parser | Existing server framework; Express 4 semantics confirmed in-repo (async-hang comment server.ts:6598-6601) |
| node:crypto `createHash` | node v24.18.0 (already imported, server.ts:19) | textHash for provenance | In-repo pattern: `memoryFingerprint` sha256 → hex → `.slice(0, 16)` (server.ts:1137-1141) |
| vitest | ^4.1.9 (package.json:181) | static pins + engine tests | Existing test spine; `include: ['src/**/*.test.ts']` (vitest.config.ts:17) |
| parseRoe / roeAudit | in-repo | parse + adjudication | The entire point: deterministic engines already pinned by white-suite + v13-class-probes |

**Package Legitimacy Audit:** N/A — this phase installs **no external packages** (REQUIREMENTS.md Out of Scope: "New runtime dependencies"). Everything above is already vendored and pinned in package.json / package-lock.json.

**Installation:** none. `npm run build` (tsc) is only needed to refresh `dist/` if `src/teams/**` ever changed — **it does not in this phase** (verified: `dist/teams/white*` rebuilt 2026-10-12 22:24, current relative to src; bench engines load from dist).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────────────────────────────────────┐
                    │ src/server.ts (the only production module modified)  │
                    │                                                      │
 Operator           │  guard chain (mount order, lines 268→351):           │
 PUT /api/teams/    │   cors → CSRF/Origin (289, PUT ∈ STATE_CHANGING)     │
 white/roe ────────►│   → Host anti-rebinding (325, loopback only)         │
 { text, actions }  │   → express.json 10mb (335)                          │
                    │   → createRemoteGuard (345, non-loopback only:       │
                    │      bearer + 60/min burst-120 on every /api/*)      │
                    │            │                                         │
                    │            ▼                                         │
                    │  app.put('/api/teams/white/roe')   [NEW]             │
                    │   1. validate: text:string, actions:array (400)      │
                    │   2. 64 KiB byte check (413)                         │
                    │   3. revision = (prev?.revision ?? 0) + 1            │
                    │      textHash = sha256(text).hex.slice(0,16)         │
                    │   4. roeRecords.set('latest', record)                │
                    │   5. emitContractEvent → schedulePersist (4879-4888) │
                    │   6. res json redactSecrets(...)                     │
                    │            │                                         │
 UI/curl/MCP        │  app.get('/api/teams/white/roe')   [MODIFY 6564]     │
 GET ──────────────►│   no record ──► zeroed parse + 'no ROE text on       │
                    │                  record' (200, today's shape)        │
                    │   record ─────► parseRoe(record.text)                │
                    │                    ├─ ok:false ► parse + provenance, │
                    │                    │            NO verdicts (200)    │
                    │                    └─ ok:true  ► roeAudit(record.    │
                    │                      actions, parse.roe) + verdicts  │
                    │                      each stamped {revision,         │
                    │                      textHash, lines} (200)          │
                    │   corrupt record ► cannot-derive (200, fail-closed)  │
                    │            │                                         │
                    │  debounced persistState ─► redactSecrets(snapshot)   │
                    │  flushPersist on SIGTERM/SIGINT ─► state.json        │
                    └──────────────────────────────────────────────────────┘
```

### Store Slot Shape (mirror of purpleSyntheses — verified precedent)

**Declaration** — `src/server.ts:908-915`, verbatim:
```typescript
/** Latest dark-purple synthesis result — one slot, overwritten per synthesis. */
interface PurpleSynthesisRecord {
  id: string;
  createdAt: string;
  correlation: DarkPurpleSynthesis['correlation'];
  synthesis: DarkPurpleSynthesis;
}
const purpleSyntheses = new Map<string, PurpleSynthesisRecord>();
```

**Write** — `src/server.ts:6456-6462`, verbatim:
```typescript
  // schedules the debounced full-snapshot write that flushes it to state.json.
  purpleSyntheses.set('latest', {
    id: 'latest',
    createdAt: nowIso(),
    correlation: synthesis.correlation,
    synthesis,
  });
```

**Snapshot slot** — `buildStateSnapshot()` enumerates every store; `src/server.ts:1190`, verbatim: `purpleSyntheses: [...purpleSyntheses.values()],`

**Restore** — `replaceMapContents` (`src/server.ts:1169-1176`) + call at `:1261` verbatim: `replaceMapContents(purpleSyntheses, state.purpleSyntheses);`

⚠️ **`replaceMapContents` filter (server.ts:1170-1174, verbatim):**
```typescript
  for (const value of values) {
    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string') {
      map.set(String((value as Record<string, unknown>).id), value as T);
    }
  }
```
A record whose `id` is missing/non-string is **silently dropped** at restore → empty store → GET fails closed. That is the *correct* behavior for corrupt state.json — do not "harden" it into an error or a permissive default.

**Minimal analog for this phase** (recommended; single slot, key mirrors `'latest'` per the locked "mirroring the purpleSyntheses 'latest' slot" decision):
```typescript
/** Sanctioned ROE text on record — one slot, overwritten per PUT (mirrors purpleSyntheses). */
interface RoeRecord {
  id: string;            // 'latest' — required by replaceMapContents (server.ts:1171)
  revision: number;      // monotonic, server-assigned: (prev?.revision ?? 0) + 1
  textHash: string;      // sha256(text) hex, 16-char slice (see Pitfall P2)
  text: string;          // operator ROE text, stored as-given (redacted at read — documented divergence)
  actions: AuditedAction[]; // stored WITH the record (locked decision); adjudicated on read
  createdAt: string;
  updatedAt: string;
}
const roeRecords = new Map<string, RoeRecord>();
```
Plus exactly three wiring lines: snapshot spread `roeRecords: [...roeRecords.values()],`, restore `replaceMapContents(roeRecords, state.roeRecords),`, and the PUT write. Store name: **`roeRecords`** (avoid any field/store name matching the redactSecrets key filter — see Pitfall P7).

**Persistence scope note:** `stateRoot()` returns `process.env.T3MP3ST_STATE_DIR` or `'memory'` (`server.ts:1005-1008`); `stateFilePath()` returns `null` in memory mode (`:1010-1013`), so `persistState` no-ops. ROE persistence survives restart **only when `T3MP3ST_STATE_DIR` is set** — identical to every existing store including purpleSyntheses. No change, but document it.

### Route Wiring

- **Global body parser:** `app.use(express.json({ limit: '10mb' }));` — `src/server.ts:335`. It runs **before** all routes, so a route-scoped `express.json({ limit: '64kb' })` would find the body already parsed and be a no-op. **The 64 KiB cap must be an explicit in-handler check** → respond 413. (Bodies between 64 KiB and 10 mb parse fine and reach the handler; >10 mb hits the global error handler which returns 500 for everything — `server.ts:8405-8408` — so the 64 KiB check also keeps this route far away from that path.)
- **Error/response conventions (verified):** validation failures answer `res.status(400).json({ error: '...' })` (purple synthesize, server.ts:6400-6403); read routes answer **200 with an honest zeroed/empty report, never 500** (pin: `white-routes-static.test.ts:39-43` "never answers 500 from a white route block (empty state stays a 200 honest report)"). There is **no 404/409 convention** in the white routes: missing/corrupt on GET is a 200 cannot-derive report, not 404/409 — that IS the pinned fail-closed honesty. 400/413 belong to PUT validation only.
- **Guard coverage:** `createRemoteGuard` matches `path !== '/api' && !path.startsWith('/api/')` → next; otherwise 401 `{ error: 'Bearer token required', ... }` / 429 with `Retry-After` (`src/net/remote-access.ts:89-120`, verbatim pattern). Mounted early (`server.ts:345-351`) when `!HOST_IS_LOOPBACK && bearerLoad.ok`; non-loopback without a token refuses startup (`server.ts:8426-8430`: "Refusing to bind non-loopback host ... without a bearer token"). Rate: `REMOTE_RATE_PER_MINUTE=60`, `REMOTE_RATE_BURST=120` (pinned remote-access-guard.test.ts:145-146). **Method-agnostic → PUT is covered with zero new security code.**
- **Loopback PUT:** PUT is in `STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])` (`server.ts:289`) → the CSRF/Origin guard covers it; no-Origin curl/CLI and same-origin UI trusted, foreign browser origins rejected (server.ts:290-300).
- **Persistence trigger:** PUT should call `emitContractEvent('white.roe.on-record', {...})` — verified body (`server.ts:4879-4888`): SSE broadcast (`redactSecrets`-wrapped, `:4900`) + `appendStateEvent` (redactSecrets-wrapped, `:1240`) + `schedulePersist(type)`. The purple route is the precedent (`server.ts:6464-6471`).
- **GET modify:** replace the body of `src/server.ts:6564-6567` (verbatim today):
```typescript
app.get('/api/teams/white/roe', (_req: Request, res: Response): void => {
  const parse = { ...parseRoe(''), summary: 'no ROE text on record' };
  res.json(redactSecrets(parse));
});
```
  and rewrite its rationale comment (`server.ts:6555-6563` — "no second store is invented here ... until a real text source lands" becomes false) **in the same commit**.

**Recommended response envelopes** (shapes for the planner to pin; `RoeParseResult` fields verbatim from `roe-parser.ts:66-78`: `{ roe: RoeSpec; resolved: RoeFieldResolution[]; unresolved: RoeParseIssue[]; commentLines: number; ok: boolean; summary: string }`):

```
GET, no record:   { ...parseRoe(''), summary: 'no ROE text on record' }                      // byte-shape = today
GET, ok:false:    { ...parse, provenance: { revision, textHash, recordedAt } }               // NO verdicts key
GET, ok:true:     { ...parse, provenance: {...}, verdicts: [ { ...RoeVerdict, roeRevision,
                    roeTextHash, roeLines: number[] /* from parse.resolved[].line */ } ] }
GET, corrupt:     200 { ok:false, unresolved:[], summary: '<cannot-derive wording>' }         // fail-closed, never 500
PUT, valid:       200 { revision, textHash, parse: <fresh parse of stored text> }             // purple returns 201 on create; replace-latest may use 200/201 — pick one, pin it
PUT, bad body:    400 { error }      (text not string / actions not array-of-objects)
PUT, oversize:    413 { error }      (> 64 * 1024 bytes)
```

### Revision Identity (question 2)

Recommend **both, stamped at PUT**: `revision: number` (monotonic integer, server-assigned from the existing slot — restore-safe because the counter lives *in the record*, no separate module state) + `textHash: string` (content identity). Rationale:
- Success criterion 2 (ROADMAP.md:52): every verdict carries "ROE revision/text hash and parseRoe line refs".
- The rewritten pin must "require revision identity in the stored record" (CONTEXT) — an integer `revision` field is trivially assertable in a source pin.
- The hash binds verdicts to exact text; **16-char slice is mandatory** — see Pitfall P2.
- Line refs come free: `parse.resolved[]` entries carry `line` (`roe-parser.ts:45-53`), `unresolved[]` carry `line` (`:55-63`).
- **Do not recompute the hash at GET for the emitted stamp** — stamp the stored fields. Optionally recompute-and-compare as the corrupt-record detector (recomputed ≠ stored → cannot-derive); this is the one cheap integrity check that catches post-redaction-restore drift honestly. [INFERENCE — recommended, not observed]

### Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ROE grammar parsing | custom scope extraction | `parseRoe` (roe-parser.ts:88) | line-accounting doctrine, ok=false unless every line accounted; already bench-verified |
| Verdict logic | per-action rule code | `roeAudit` (white.ts:40) | precedence semantics (out-of-scope violation → active-disallowed violation → needs_approval → compliant) pinned in teams-modules.test.ts:148+ |
| Secret redaction | regex one-offs | `redactSecrets` (redact.ts:54) | 20+ curated patterns + key-name rule + circular-safe walk; unit-tested (redact*.test.ts) |
| Bearer/rate-limit | route-level auth | `createRemoteGuard` mount (server.ts:345-351) | prefix guard covers all `/api/*` verbs; new per-route auth would be *worse* security and surface creep |
| Persistence/debounce/shutdown | bespoke writer | snapshot slot + `schedulePersist`/`flushPersist` (server.ts:1194-1235, 8467-8472) | crash-window handling already reasoned + commented in-repo |
| Body cap middleware | express.json re-mount | in-handler byte check | global parser at server.ts:335 already consumed the stream; a second parser is a no-op |

**Key insight:** the phase's only genuinely new logic is *one PUT handler's validation + stamping* and *one GET body*. Everything else is wiring into patterns that exist verbatim in the same file.

## Pins To Rewrite (question 5) — `src/__tests__/white-routes-static.test.ts`

Verified current pins (exact lines/text):

| Lines | Current pin (verbatim) | Fate |
|-------|------------------------|------|
| 7 | `const WHITE_ROUTES = ['/api/teams/white/roe', '/api/teams/white/evidence', '/api/teams/white/report-audit'];` | keep (GET family); PUT handled separately |
| 8-9 | comment "…/roe reads no store today … no second store may be invented." | rewrite (false after phase) |
| 12-14 | `quotedPathCount` = `serverSource.split(`'${path}'`).length - 1` | **breaks**: `/api/teams/white/roe` appears twice once `app.put` exists |
| 26-30 | `registers each white route exactly once` → `.toBe(1)` for every WHITE_ROUTES path | **must be rewritten**: per-verb count (GET=1, PUT=1 for /roe) or expect 2 for /roe |
| 32-37 | `exposes the white audits only as read-only GET routes`: `toContain("app.get('${route}'")` + `not.toContain("app.post('${route}'")` | keep; **POST-forbidden on /roe survives** (PUT ≠ POST). Sharpen: assert `app.put('/api/teams/white/roe'` exists |
| 39-43 | `never answers 500 from a white route block` (`not.toContain('res.status(500')`) | keep for GET block; if the PUT block is pinned too, same rule holds (400/413 are not 500) |
| 45-49 | `routeBlock('/api/teams/white/roe')).toContain('parseRoe(')` | keep |
| 63-68 | `the roe route invents no ROE store (honest zeroed parse until a text source exists)`: `not.toContain('roeLedger')`, `not.toContain('missionDrafts.set')`, `toContain('no ROE text on record')` | **invert to positive**: assert the single sanctioned store name `roeRecords` (+ `roeRecords.set` lives in the PUT block, not the GET block); keep `missionDrafts.set` prohibition (GET must not mutate drafts); keep `no ROE text on record` (empty state persists when nothing is stored) |

**Mechanical traps for the rewrite:**
- `routeBlock(path)` finds the block via marker `` app.get('${path}' `` (test file :16-23). A PUT-block pin needs an `app.put(` marker variant — one-line helper extension.
- New positive pins to add (source-level; server.ts is never imported in tests — behavior coverage is engine-level + Manual-Only, the house shape): PUT route present; POST absent on the path (existing :35 already enforces); stored record construction contains `revision` (grep-able `revision:` in the PUT block); ok:false gate before verdicts (`if (parse.ok)` or equivalent in the GET block); `redactSecrets(` wrapping both emissions.
- `local-api-hardening-static.test.ts` / `black-routes-static.test.ts` use `sourceBlock(startMarker, endMarker)` over serverSource — the new code must not introduce markers that collide with existing start/end strings (no reuse of `'/api/teams/white/roe'` as a slice end-marker anywhere).

## Non-Loopback Coverage (question 6)

Suite: **`src/__tests__/remote-access-guard.test.ts`** — verified patterns:
- Live-guard test (:74-104): builds a minimal express app + `createRemoteGuard({ token, bucket })`, listens on 127.0.0.1, fetch-asserts 401 (no header) / 401 (wrong) / 200 (correct bearer). **Minimal new case:** same harness with `app.put('/api/teams/white/roe', ...)` → 401 without bearer, 200 with. (The real server.ts is never imported in tests — redact.ts:5-7 documents why: importing it starts the HTTP listener + LLM.)
- Source pin (:143-155) `mounts createRemoteGuard behind !HOST_IS_LOOPBACK and fail-closes without a token`: asserts the exact mount marker `if (!HOST_IS_LOOPBACK && bearerLoad.ok)`, `createRemoteGuard(` after it, `Refusing to bind non-loopback`, and `T3MP3ST_BEARER_TOKEN` present-but-not-hardcoded. **No change needed** — the guard is method-agnostic; this pin already guarantees the PUT route inherits coverage. Keep green.
- `src/__tests__/grokbot-gateway.test.ts:140-143` pins the proxy path list containing `/api/teams/white/roe` — unchanged (MCP proxy stays GET-only; no new MCP tool, so the tool-count pins at :109/:113/:118 are untouched).

## Bench (question 7)

`scripts/roe-adjudication-bench.mjs` (304 lines, verified):
- Corpus: `bench/roe-adjudication/corpus.json`; case shape verbatim: `{ id, desc, decoy, roe: "<text>", actions?, evidence?, findings?, expect: { parse: {...}, adjudication?: [{ actionIndex, verdict }], chain?, report? } }` (examples: `mission-full-adjudication` :6-42, `mission-action-triangle` :202-231).
- Engines load from **built dist**: `loadEngines()` imports `dist/teams/white/roe-parser.js`, `dist/teams/white.js`, etc., throwing "run `npm run build` (tsc) first" when missing (:41-56). `runCorpus` (:60-70) runs `parseRoe(c.roe ?? '')` then `roeAudit(c.actions, parse.roe)` when actions are declared — **exactly the text→parse→verdict chain the GET route performs**, so the "bench text→parse→verdict case" is a corpus case whose `roe` text + `actions` mirror a `{ text, actions }` PUT record.
- **Hygiene constraints** for any new case (`corpusHygiene`, ~:198-232): unique id; `expect.parse` mandatory; adjudication group present **iff** `actions` declared; `expect.parse.ok === true` required when actions declared (never adjudicate a partial spec); `expect.adjudication` full `actionIndex` sequence 0..n-1 with legal verdicts; **non-decoy case that is all-green is invalid** — verbatim: `if (c.decoy ? !allGreen : allGreen) return false;` → the new case must carry at least one non-compliant verdict (or decoy: true and all-green).
- **Coordination:** after editing corpus.json, run `node scripts/roe-adjudication-bench.mjs` (alias `npm run white:bench`, package.json:49) — it deterministically rewrites the committed `bench/roe-adjudication/report.json` (no timestamps; byte-identical across runs). Self-test asserts `total >= 24` and ≥6 cases / ≥2 decoys — adding a case keeps these true.
- **dist rebuild:** NOT needed for this phase (pure engines unchanged; `dist/teams/white*` verified current, rebuilt 2026-10-12 22:24). Fresh checkouts still need `npm run build` before the vitest bench test (existing precondition; the missing-dist throw is itself pinned in v13-class-probes.test.ts).

## Docs/Skills/MCP Surfaces (question 8) — every verified hit

| Surface | Location | Current text (verbatim) | After |
|---------|----------|------------------------|-------|
| API reference row | `docs/API_REFERENCE.md:269` | `` `GET` \| `/api/teams/white/roe` \| Read-only structured parse of the on-record ROE text (`{ roe, resolved, unresolved, commentLines, ok, summary }`; no server state carries ROE text today → honest zeroed parse, `ok: false`) \| `` | rewrite: GET emits parse + verdicts when `ok:true` + provenance; add PUT row (body `{ text, actions }`, 64 KiB cap, 400/413) |
| MCP guide row | `docs/MCP_GUIDE.md:88` | `` `tempest_white_roe` \| `GET /api/teams/white/roe` (on-record ROE parse: `ok`, `resolved`, `unresolved`) \| `` | update to mention verdicts-on-record when ROE text is on record (tool stays GET-only) |
| MCP tool description | `src/mcp-server.ts:239-240` | `name: 'tempest_white_roe'` / `description: `White ROE adjudication state on record (GET /api/teams/white/roe). Use when: … or the verdict on record for an action.`` | becomes literally true; sync pass to mention provenance + that recording happens via the operator PUT (no MCP mutation tool) — case handler `:445-447` (`tempestGet`) unchanged |
| white-arbiter skill | `grokbot/skills/white-arbiter/SKILL.md:38-42` | "…no ROE text is on record yet, so the backend derives no per-action verdicts until a real source lands)." | **now false — rewrite** to: verdicts appear when ROE text is on record; relay the provenance stamps |
| white-arbiter skill | `:51-53` | "If the response reports no ROE text on record, say so — that is not an 'everything allowed' verdict." | keep (empty state persists when nothing is stored) |
| white-arbiter skill | `:61-65` | "…or, with no ROE text on record, an honest statement that the backend cannot derive one, never an invented verdict…" | keep; optionally mention provenance in the relayed verdict |
| dark-purple skill | `grokbot/skills/dark-purple/SKILL.md:84-90` | curl example + "Relay the parsed `roe` spec … **No ROE text is on record yet**, so the backend derives no per-action verdicts until a real source lands — say so, never 'everything allowed'." | rewrite the "yet / until a real source lands" clause; relay verdicts + provenance; empty-state honesty sentence stays |
| white-auditor skill | `grokbot/skills/white-auditor/SKILL.md` | **no `roe` references** (verified by grep) | none — corrects the older research doc's assumption |
| Operators UI | `docs/operators.html:79` | purple synthesis panel: "…white ROE verdicts into a posture ledger … `verdict` for ROE verdicts." | optional sync note only (describes the purple *input*, still true); UNIFY-01 owns operators.html in phase 23 — sequence, don't collide |

## Supersession Entry (question 9)

`​.planning/milestones/v1.3-phases/SUPERSESSION.md` rule, verbatim:
> Append-only. Rule: any post-Phase-21 v1.4 commit whose diff touches a file named in a NN-VALIDATION.md Per-Task Verification Map MUST append one row in the SAME commit, citing the new green command that re-evidences the mutated surface.

Phase 19's map (`.planning/milestones/v1.3-phases/19-white-suite/19-VALIDATION.md:44-56`) names exactly the surfaces this phase mutates: `white-routes-static.test.ts` (P19-C1/C2/C3b), the bench self-test command (P19-C3a), `roe-adjudication-bench.test.ts`, `v13-class-probes.test.ts` (must stay green), `npm run lint`. → **Phase 22's final commit appends one SUPERSESSION.md row** citing e.g. `npx vitest run src/__tests__/white-routes-static.test.ts src/__tests__/roe-adjudication-bench.test.ts src/__tests__/v13-class-probes.test.ts && node scripts/roe-adjudication-bench.mjs` → new green counts. The `19-VALIDATION.md` file itself is **never edited** (it describes the `4c37232` boundary; its own footer :104 says so). Bonus alignment: the Manual-Only row at `19-VALIDATION.md:67` explicitly defers "verdicts-on-record once a real ROE text source lands … After ROE-01 lands, load ROE text, hit the route, confirm verdicts cite the loaded text" — the phase's live check fulfills this pending item; record it in the phase SUMMARY.

## What This Phase Must NOT Touch (question 10)

- **`src/teams/**` pure engines** — `parseRoe`/`roeAudit`/types unchanged (white-suite + teams-modules + v13-class-probes pins depend on them).
- **`src/net/remote-access.ts` guard semantics** — no exemptions, no widening (REQUIREMENTS Out of Scope: "Any bearer-guard exemption or widened unauthenticated surface").
- **Mission module** — no `missionDrafts` coupling (locked decision); the `not.toContain('missionDrafts.set')` pin stays; MissionDraft has no ROE field by design (`server.ts:666-680`).
- **Purple surfaces** — `POST /api/teams/purple/synthesize` (`server.ts:6396-6472`) and its consumers untouched; purple auto-consumption of recorded verdicts is deferred v2. Phase 23 (UNIFY-01) edits `docs/API_REFERENCE.md`'s purple section AFTER this phase — edit only the white roe row now, sequence not overlap.
- **Existing route contracts** — additive only (milestone constraint); GET's today-shape remains a prefix of the new shape.
- **Stray artifact `./Heads-up: while wiring GET `** — exists (verified: a *directory* at repo root, dated Oct 10). REQUIREMENTS.md Out of Scope explicitly logs it as follow-up, **not milestone work** — this overrides ARCHITECTURE.md §1's "delete during this phase" note.

## Common Pitfalls

### P1: The exactly-once pin breaks on the PUT route
**What goes wrong:** `quotedPathCount('/api/teams/white/roe')` (`white-routes-static.test.ts:12-14`) counts occurrences of the quoted path in serverSource and the test at :26-30 asserts `.toBe(1)` — adding `app.put('/api/teams/white/roe')` makes it 2 and the suite goes red *before any pin rewrite*.
**Why it happens:** the pin encoded "one read route" as "one occurrence".
**How to avoid:** rewrite to per-verb counting (GET once, PUT once) in the same commit as the route.
**Warning signs:** first `npx vitest run src/__tests__/white-routes-static.test.ts` after adding PUT fails on "must be registered exactly once".

### P2: A full-length sha256 hex digest gets self-redacted
**What goes wrong:** store `textHash` as a 64-char hex sha256 and every `redactSecrets`-wrapped emission — including `state.json` itself (`server.ts:1197`) — replaces it with `[redacted]` via the aws_secret_key pattern `/[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/` (`src/redact.ts:10`): 64 hex chars match, and the closing JSON `"` satisfies the negative lookahead.
**Why it happens:** the pattern is a length-based heuristic; 16-char digests (the in-repo precedent `memoryFingerprint`, `server.ts:1137-1141`: `createHash('sha256').update(...).digest('hex').slice(0, 16)`) sit below the 40-char floor — that slice is not stylistic, it is load-bearing.
**How to avoid:** `textHash = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)`; or lean on the integer `revision` for identity and keep the hash only as a short integrity stamp.
**Warning signs:** a provenance stamp that reads `[redacted]` in GET responses or state.json.

### P3: persistState redacts the snapshot — the restored text is not the recorded text
**What goes wrong:** `persistState` writes `JSON.stringify(redactSecrets({ ...buildStateSnapshot(), reason }))` (`server.ts:1197`), so the ROE text on disk is the **redacted** text. After a restart, `replaceMapContents` loads redacted text; a re-parse usually still succeeds (single-line `[redacted]` substitutions preserve line structure — but the multi-line `pem_private_key` pattern can merge lines, `redact.ts:39`), while a recomputed hash would differ from the PUT-time stamp.
**Why it happens:** the snapshot writer has one redaction boundary for the whole file; the "stored as-given, redacted at read" decision (CONTEXT) governs the in-memory ledger behavior, and the divergence must be **documented** per the locked doctrine.
**How to avoid:** stamp `revision`/`textHash` into the record at PUT (they persist verbatim — subject to P2 sizing); at GET, stamp from the stored fields, never recompute for emission; optionally recompute-and-compare as the corrupt-record detector → cannot-derive on mismatch; document the write-time-redaction divergence in the route comment.
**Warning signs:** verdict provenance that changes across a restart; a hash stamp that equals the hash of the redacted text.

### P4: Corrupt-state restore is already fail-closed — by silent drop
**What goes wrong (if "fixed"):** `replaceMapContents` (server.ts:1170-1174) silently drops records whose `id` is not a string; a corrupt `state.json` array yields an empty store → GET reports no-record → cannot-derive. "Improving" this to reconstruct partial records would widen, not tighten, safety.
**How to avoid:** keep the drop; the missing case and the corrupt case converge on the same honest zeroed parse. Validate record shape at GET too (text not a string / actions not an array → cannot-derive summary, still 200).

### P5: Fail-closed is a 200, not an HTTP error — on reads
**What goes wrong:** mapping "missing/corrupt" to 404/409 on GET breaks the pinned honesty convention (`white-routes-static.test.ts:39-43`: empty state stays a 200 honest report) and misreads the doctrine: fail-closed is about *never deriving verdicts from an absent spec*, not about status codes.
**How to avoid:** GET always 200 + parse + explicit cannot-derive wording; 400 (validation) and 413 (cap) exist only on PUT.
**Warning signs:** a test asserting `res.status(404)` on the white roe route.

### P6: Bench hygiene rejects an all-green non-decoy case
**What goes wrong:** adding a corpus case that mirrors a fully-compliant stored record fails `corpusHygiene` (`if (c.decoy ? !allGreen : allGreen) return false;`) and the "corpus exercises the honesty axes" gate.
**How to avoid:** the new text→parse→verdict case needs at least one `needs_approval`/`violation` expectation (e.g. an unapproved active action over an ok parse), full `actionIndex` sequence, `expect.parse.ok === true`.
**Warning signs:** `corpus hygiene: …` ❌ line in the bench self-test output.

### P7: redactSecrets nukes whole values by key name
**What goes wrong:** any record/response field whose name matches `/(api[_-]?key|authorization|cookie|credential|password|secret|token)/i` (`redact.ts:66-68`) has its entire value replaced with `'[redacted]'` — e.g. a field named `revisionToken` or `roeSecret` would emit `[redacted]`.
**How to avoid:** plain field names: `revision`, `textHash`, `text`, `actions`, `recordedAt`.
**Warning signs:** a response field that is always `[redacted]`.

### P8: roeAudit is not imported in server.ts yet
**What goes wrong:** the GET modification needs the value import; today only `parseRoe` (`server.ts:68`) and `type { RoeVerdict }` (`server.ts:71`) come from the white modules.
**How to avoid:** add `import { roeAudit } from './teams/white.js';` alongside; keep the dependency direction comment (server.ts:6548) true.

### P9: Honesty prose goes stale the moment the feature lands
**What goes wrong:** "no ROE text is on record **yet** … **until a real source lands**" (white-arbiter SKILL.md:40-42; dark-purple SKILL.md:88-90; the server.ts route comment :6555-6563; API_REFERENCE.md:269 "no server state carries ROE text today") becomes **false** in the same commit that adds the store. A docs-later pass is a pin-doctrine violation (honesty surfaces update in lockstep).
**How to avoid:** same-commit edits of all rows in the Docs/Skills/MCP table; keep the *empty-state* honesty sentences (still true when nothing is stored).
**Warning signs:** `grep -rn 'until a real source lands\|no ROE text is on record yet\|ROE text today' docs grokbot src` returning hits after the feature commit.

### P10: Silent permissiveness is the review lens
**What goes wrong:** any code path that treats a missing record, failed parse, or hash mismatch as "continue with empty spec" re-creates the v1.3 `allowedTargets` bug class (empty spec historically meant everything-in-scope — white.ts:49-50 `!allowedTargets.length` short-circuit makes `roeAudit(actions, {})` scope-vacuous; the class pin lives at `v13-class-probes.test.ts:11-34` and **must stay green**).
**How to avoid:** every branch on the read path ends in either a full verdict set (only when `ok:true`) or an explicit cannot-derive; never a bare empty-spec audit.
**Warning signs:** a GET response containing `verdicts` when `ok:false`.

## Code Examples

### PUT handler skeleton (validation order mirrors purple synthesize, server.ts:6396-6472)
```typescript
// Source: in-repo patterns — 400 shape server.ts:6400-6403; slot write 6457-6462;
// emitContractEvent 4879-4888; hash slice 1137-1141.
const ROE_BODY_CAP_BYTES = 64 * 1024;
app.put('/api/teams/white/roe', (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = body.text;
  const actions = body.actions;
  if (typeof text !== 'string') { res.status(400).json({ error: 'text must be a string' }); return; }
  if (!Array.isArray(actions) || actions.some(a => !a || typeof a !== 'object' || Array.isArray(a))) {
    res.status(400).json({ error: 'actions must be an array of action objects' }); return;
  }
  if (Buffer.byteLength(text, 'utf8') > ROE_BODY_CAP_BYTES) {
    res.status(413).json({ error: 'ROE text exceeds the 64 KiB cap' }); return;   // cap BEFORE any engine work
  }
  const previous = roeRecords.get('latest');
  const record: RoeRecord = {
    id: 'latest',
    revision: (previous?.revision ?? 0) + 1,
    textHash: createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16),
    text,                                   // stored as-given; redaction at read (documented divergence)
    actions: actions as AuditedAction[],
    createdAt: previous?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  roeRecords.set('latest', record);
  emitContractEvent('white.roe.on-record', { revision: record.revision, textHash: record.textHash, actions: actions.length });
  const parse = parseRoe(record.text);
  res.json(redactSecrets({ revision: record.revision, textHash: record.textHash, ok: parse.ok, summary: parse.summary }));
});
```

### GET skeleton (fail-closed ladder)
```typescript
// Source: current route server.ts:6564-6567; RoeParseResult roe-parser.ts:66-78;
// roeAudit white.ts:40; no-500 pin white-routes-static.test.ts:39-43.
app.get('/api/teams/white/roe', (_req: Request, res: Response): void => {
  const record = roeRecords.get('latest');
  if (!record || typeof record.text !== 'string' || !Array.isArray(record.actions)) {
    // missing or corrupt → cannot-derive: today's honest zeroed parse, still 200, still pinned
    res.json(redactSecrets({ ...parseRoe(''), summary: 'no ROE text on record' }));
    return;
  }
  const parse = parseRoe(record.text);
  const provenance = { revision: record.revision, textHash: record.textHash, recordedAt: record.updatedAt };
  if (!parse.ok) {
    res.json(redactSecrets({ ...parse, provenance }));        // ok:false → NO verdicts key, ever
    return;
  }
  const verdicts = roeAudit(record.actions, parse.roe).map(v => ({
    ...v,
    roeRevision: record.revision,
    roeTextHash: record.textHash,
    roeLines: parse.resolved.map(r => r.line),                // line refs: parse.resolved[] carries 1-based lines
  }));
  res.json(redactSecrets({ ...parse, provenance, verdicts }));
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| roe route parse-only over empty text | on-record text store + verdicts-on-record | this phase | honesty pins invert; skills/MCP promises become true |
| verdicts enter purple only via request body | unchanged this milestone (auto-consumption deferred v2) | — | no purple coupling |

**Deprecated/outdated (pre-phase assumptions now false):** "no second store may be invented" (server.ts:6559, test comment :8-9); "no server state carries ROE text today" (API_REFERENCE.md:269); "no ROE text is on record yet" (both skills).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Route-scoped `express.json({limit})` after the global parser is a no-op (body already consumed) — standard Express 4 behavior, not separately executed in this session | Route Wiring | 64 KiB check design; fallback (in-handler byte check) is recommended regardless, so low risk |
| A2 | `Buffer.byteLength(text,'utf8')` is an acceptable expression of "64 KiB on the mutation route body" (cap on text; actions are small structured objects) | Code Examples | Owner may want whole-body cap incl. actions — checkpoint wording at plan review |
| A3 | recompute-and-compare hash at GET as the corrupt detector is a *recommendation*, not a locked shape | Revision Identity | provenance drift detection weaker if dropped |
| A4 | PUT success returns 200 (replace semantics) — purple returns 201 for create; either is defensible, pick and pin | Route Wiring | cosmetic contract drift |
| A5 | `'latest'` slot key (mirroring purpleSyntheses exactly) rather than `'on-record'` | Store Slot Shape | pin/store naming churn only |
| A6 | Express 4's >10mb overflow surfaces as the global 500 handler (error middleware at server.ts:8405-8408 does not special-case `err.status`) | Route Wiring | none for 64 KiB-sized bodies; irrelevant if cap check runs first |

All other claims: verified from this checkout this session (citations inline). External-docs lookup not applicable — the entire domain is in-repo; no new libraries are introduced.

## Open Questions

1. **Exact cannot-derive wording for the corrupt case.** What we know: empty case is pinned as `'no ROE text on record'`; corrupt case needs its own honest wording that static pins can assert. Recommendation: planner pins e.g. `'stored ROE is corrupt — cannot derive verdicts'` and adds it to the positive pins. → Resolved (Phase 22 revision): converged — missing, corrupt, and hash-mismatched records share the kept empty-state cannot-derive report per plan key_link 2, so no separate corrupt wording is pinned.
2. **Whether PUT requires `actions` or defaults to `[]`.** What we know: CONTEXT says the record is `{ text, actions, revision }`; purple-style validation suggests required-but-may-be-empty. Recommendation: require the key (may be `[]`) so the record shape is total; simplest pin. → Resolved (Phase 22 revision): PUT requires the actions key as an array of objects (may be `[]`), 400 otherwise; empty-string text is likewise refused with 400 while whitespace-only text parse-fails honestly.
3. **Whether the 64 KiB cap covers `JSON.stringify(body)` or just `text`.** What we know: CONTEXT says "64 KiB on the mutation route body"; engines only consume `text`. Recommendation: byte-check `text` (the unbounded payload) and rely on the 10mb global parser as the outer fence; state the choice in API_REFERENCE. → Resolved (Phase 22 revision): cap applies to text bytes via Buffer.byteLength utf8 of the text field, stated in the API_REFERENCE PUT row.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | all build/test | ✓ | v24.18.0 | — |
| vitest | static pins, bench pin, class probes | ✓ | 4.1.9 | — |
| typescript (tsc) | `npm run build` (only if dist refresh needed) | ✓ | ^5.3.3 (package.json:179) | — |
| dist/teams/white* | bench engines (loadEngines) | ✓ (rebuilt 2026-10-12 22:24) | — | `npm run build` on fresh checkout |
| express | server routes | ✓ | ^4.x via @types 4.17.21 | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (repo root; `include: ['src/**/*.test.ts']`, vitest.config.ts:17) |
| Config file | `vitest.config.ts` (coverage-only config; discovery on defaults) |
| Quick run command | `npx vitest run src/__tests__/white-routes-static.test.ts src/__tests__/white-suite.test.ts src/__tests__/v13-class-probes.test.ts` |
| Full suite command | `npm test` (vitest run src + ops-preflight + model-matrix + refusal-frontier, package.json:80) |

### Phase Requirements → Test Map (skeleton for the planner)
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROE-01 | PUT stores `{text, actions, revision}`; POST forbidden; exactly-once becomes per-verb | source pin | `npx vitest run src/__tests__/white-routes-static.test.ts` | ✅ (rewrite in place) |
| ROE-01 | ok:false → no verdicts; fail-closed missing/corrupt; provenance stamped | source pin (GET block) | same file | ✅ (new `it` blocks) |
| ROE-01 | `roeAudit(actions, {})` class pin stays green | engine probe | `npx vitest run src/__tests__/v13-class-probes.test.ts` | ✅ unchanged |
| ROE-01 | PUT bearer-gated on non-loopback (401 without / 200 with) | live-guard test | `npx vitest run src/__tests__/remote-access-guard.test.ts` | ✅ (new case, minimal-app harness :74-104 pattern) |
| ROE-01 | guard wiring pin untouched | source pin | same file (:143-155) | ✅ unchanged |
| ROE-01 | bench text→parse→verdict corpus case + regenerated report | bench + pin | `node scripts/roe-adjudication-bench.mjs && npx vitest run src/__tests__/roe-adjudication-bench.test.ts` | ✅ (corpus/report edited) |
| ROE-01 | live HTTP PUT→GET provenance (server never imported in tests) | manual-only | loopback run: `PUT` then `GET`, confirm verdicts cite revision/textHash/lines | Manual (house shape; fulfills 19-VALIDATION.md:67 deferred item) |

### Sampling Rate
- **Per task commit:** quick run command above + `npm run lint` (0 errors; report running warning count — LINT-01 requires every phase to report it).
- **Per wave merge:** `npm test` full suite.
- **Phase gate:** full suite green + `node scripts/roe-adjudication-bench.mjs` `✅ ALL PASS` + lint count recorded, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] none blocking — all target suites exist; new cases are additions inside existing files (`white-routes-static.test.ts`, `remote-access-guard.test.ts`, `bench/roe-adjudication/corpus.json`)
- [ ] `npm run build` not required for CI green (dist current; engines untouched) but fresh checkouts need it for the bench test — existing documented precondition

## Security Domain

(security_enforcement absent from config → enabled)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (non-loopback) | `createRemoteGuard` bearer check (remote-access.ts:98-106); startup refusal without token (server.ts:8426-8430) |
| V3 Session Management | no | stateless bearer; no sessions in this surface |
| V4 Access Control | yes | prefix guard over every `/api/*` verb incl. new PUT (remote-access.ts:88-91); **no exemptions allowed** (REQUIREMENTS Out of Scope) |
| V5 Input Validation | yes | purple-style 400 validation + 64 KiB cap on PUT; deterministic `parseRoe` as the only scope-setter (ok:false gate) |
| V6 Cryptography | yes (hashing only) | node:crypto `createHash('sha256')` — never hand-rolled; 16-char slice per in-repo precedent |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated ROE write on non-loopback bind | Spoofing/Elevation | early-mounted guard (method-agnostic) + explicit non-loopback PUT test; rate limit 60/min burst 120 |
| Prompt injection via ROE text toward referee LLMs | Tampering | locked doctrine: text is data-only, delimited/labelled if ever relayed; scope set ONLY by `parseRoe`; skills relay verdicts, never raw-text authority |
| Secrets pasted into ROE text reaching UI/logs/state | Information Disclosure | `redactSecrets` on GET/PUT responses, SSE, event log, state.json; request logger emits only method+path (server.ts:338-341); never log `req.body` |
| Oversized-body abuse | DoS | 64 KiB in-handler cap → 413; global 10mb parser as outer fence |
| Silent permissive scope (absent signal → allowed) | Elevation | fail-closed ladder (Pitfall P10); class pin `v13-class-probes.test.ts` stays green |

## Sources

### Primary (HIGH confidence — read this checkout this session)
- `src/server.ts` — state block (:896-915), snapshot/restore/persist (:1169-1266), hash precedent (:1137-1141), guard chain (:268-351), emitContractEvent (:4879-4888), purple synthesize (:6396-6472), white routes + roe GET (:6546-6607), state path (:1001-1013), startup refusal (:8426-8430), shutdown flush (:8467-8472), MissionDraft (:666-680)
- `src/redact.ts` — SECRET_PATTERNS (:8-28), redactString (:30-52), redactSecrets (:54-71)
- `src/teams/white.ts` — AuditedAction/RoeSpec/RoeVerdict (:12-30), roeAudit (:40)
- `src/teams/white/roe-parser.ts` — interfaces (:45-78), parseRoe (:88), ok gate (:215), return (:221)
- `src/__tests__/white-routes-static.test.ts` (full, 69 lines); `remote-access-guard.test.ts` (:74-104, :143-155); `local-api-hardening-static.test.ts` (structure); `v13-class-probes.test.ts` (:11-34); `roe-adjudication-bench.test.ts`; `grokbot-gateway.test.ts` (:25, :109-118, :140-143)
- `scripts/roe-adjudication-bench.mjs` (full); `bench/roe-adjudication/corpus.json` (case shapes)
- `src/mcp-server.ts` (:238-242, :445-447); `docs/API_REFERENCE.md:269`; `docs/MCP_GUIDE.md:88`; `docs/operators.html:79`; `grokbot/skills/white-arbiter/SKILL.md:30-70`; `grokbot/skills/dark-purple/SKILL.md:80-95`
- `.planning/milestones/v1.3-phases/SUPERSESSION.md` (rule, verbatim); `19-VALIDATION.md` (:28-75, :104); `.planning/REQUIREMENTS.md`, `ROADMAP.md:46-54`, `STATE.md`, `22-CONTEXT.md`
- Environment: node v24.18.0, vitest 4.1.9 (probed)

### Secondary (MEDIUM)
- Prior milestone research: `.planning/research/ARCHITECTURE.md` §1, `PITFALLS.md` §3, `FEATURES.md`, `SUMMARY.md` (line numbers therein shifted slightly; all re-verified against current files above)

### Tertiary (LOW)
- none

## Metadata

**Confidence breakdown:**
- Store/route/persistence patterns: HIGH — every line quoted from source this session
- Pin-rewrite mechanics: HIGH — full 69-line pin file read; breakage modes derived from its actual helpers
- Bench/hygiene constraints: HIGH — script read end-to-end; constraints quoted verbatim
- Response-envelope shapes: MEDIUM — recommended shapes grounded in repo precedents, exact wording left to planner (A2/A4/A5/A6)

**Research date:** 2026-10-12
**Valid until:** 2026-11-11 (stable — repo-local patterns; no external dependency churn possible)
