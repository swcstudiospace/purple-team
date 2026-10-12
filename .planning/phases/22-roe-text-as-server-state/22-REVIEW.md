---
phase: 22
status: findings
reviewed: 2026-10-12T23:45:00Z
depth: standard
scope:
  - src/server.ts
  - src/__tests__/roe-store-pins.test.ts
  - src/__tests__/white-routes-static.test.ts
  - src/__tests__/remote-access-guard.test.ts
  - src/mcp-server.ts
  - bench/roe-adjudication/corpus.json
  - bench/roe-adjudication/report.json
  - docs/API_REFERENCE.md
  - docs/MCP_GUIDE.md
  - grokbot/skills/white-arbiter/SKILL.md
  - grokbot/skills/dark-purple/SKILL.md
files_reviewed_list:
  - src/server.ts
  - src/__tests__/roe-store-pins.test.ts
  - src/__tests__/white-routes-static.test.ts
  - src/__tests__/remote-access-guard.test.ts
  - src/mcp-server.ts
  - bench/roe-adjudication/corpus.json
  - bench/roe-adjudication/report.json
  - docs/API_REFERENCE.md
  - docs/MCP_GUIDE.md
  - grokbot/skills/white-arbiter/SKILL.md
  - grokbot/skills/dark-purple/SKILL.md
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
---

# Phase 22: Code Review Report (ROE Text as Server State)

**Reviewed:** 2026-10-12T23:45:00Z — diff `d79fea9` read directly, plus current file heads, 22-CONTEXT.md (locked decisions), 22-RESEARCH.md (ground truth).
**Depth:** standard (per-file analysis + cross-file tracing: server.ts ↔ redact.ts ↔ teams/white.ts ↔ roe-parser.ts ↔ guard chain).
**Status:** findings (0 BLOCKER, 1 WARNING, 1 INFO).

## Summary

The implementation faithfully mirrors the locked decisions: single-slot `roeRecords` keyed `'latest'` with `id: 'latest'` (satisfies the `replaceMapContents` id filter), PUT-stamped `revision` + 16-char sha256 `textHash` (below the `redactSecrets` 40-char self-redaction floor), in-handler 64 KiB utf8 byte cap → 413, empty-string → 400, GET fail-closed ladder at always-200 with the `ok` gate before `roeAudit`, stored-field-only stamp emission plus recompute-and-compare, `redactSecrets` on all five emission paths (1 PUT + 4 GET), route mounted under `/api/*` after the early `createRemoteGuard` mount (:345-346 vs routes at :6584/:6632) with PUT in `STATE_CHANGING_METHODS` for the loopback CSRF guard. ROE text flows only into deterministic `parseRoe` — no LLM-prompt interpolation (`roeRecords` has exactly 6 use sites: declare, snapshot, restore, PUT get/set, GET get). Pins are sharp, not vacuous (per-verb exactly-once, PUT-writes/GET-never-writes, ok-gate ordering, mismatch-branch isolation, 4× GET redaction count). Bench case satisfies hygiene (non-decoy, mixed compliant/needs_approval/violation, `ok:true`, full actionIndex 0–2) and report.json matches (13 cases, 27/27). No stale prose survives (`until a real source lands` / `no ROE text is on record yet` / `no server state carries ROE text` all grep-clean). SUPERSESSION.md row is complete with green commands, same commit. Two robustness findings below — neither breaks the security posture under normal operation.

## Warnings

### WR-01: GET shape guard misses element-level action corruption → 500 instead of the promised 200 cannot-derive

**File:** `src/server.ts:6634` (guard), throw site `src/teams/white.ts:45`
**Severity:** WARNING
**Issue:** The GET fail-closed guard checks `!Array.isArray(record.actions)` but not the elements. `roeAudit` dereferences `action.command` unconditionally (`const command = action.command || ''`), so a stored `actions` array containing `null`/`undefined` elements throws `TypeError`, which Express turns into a 500 — violating the "missing / shape-corrupt → 200 cannot-derive, NO verdicts" contract and the never-500 doctrine. The PUT validator (`!a || typeof a !== 'object' || Array.isArray(a)` → 400) cannot produce such a record, so the only writer-side path is a hand-corrupted `state.json` that still passes the id-only `replaceMapContents` filter — but the GET comment explicitly promises shapeless records fall to cannot-derive, and element-shapelessness escapes it. Non-object primitives (strings, numbers) are harmless (`undefined || ''` path); only nullish elements throw.
**Fix:** Mirror the PUT element check in the GET guard:
```typescript
const actionsOk = Array.isArray(record.actions) && !record.actions.some(
  (a) => !a || typeof a !== 'object' || Array.isArray(a),
);
if (!record || typeof record.text !== 'string' || !actionsOk) {
  const parse = { ...parseRoe(''), summary: 'no ROE text on record' };
  res.json(redactSecrets(parse));
  return;
}
```

## Info

### IN-01: Restored-record scalar fields trusted verbatim (revision type-poisoning, timestamps)

**File:** `src/server.ts:6600-6608`
**Severity:** INFO
**Issue:** `revision: (previous?.revision ?? 0) + 1` and `createdAt: previous?.createdAt ?? nowIso()` / `recordedAt: record.updatedAt` trust whatever `replaceMapContents` restored — it filters only on `id: string`. A hand-edited `state.json` with e.g. `"revision": "5"` yields `"5" + 1 === "51"`, permanently skewing the monotonic provenance stamp (until slot overwrite); a missing `updatedAt` silently drops `recordedAt` from provenance. No wrong verdicts result (hash gate + ok gate still hold), and no programmatic path produces this — revision is server-assigned, never client-controlled — so this is hardening, not a defect.
**Fix:**
```typescript
const prevRevision = typeof previous?.revision === 'number' && Number.isFinite(previous.revision)
  ? Math.floor(previous.revision)
  : 0;
// ...
revision: prevRevision + 1,
createdAt: typeof previous?.createdAt === 'string' ? previous.createdAt : nowIso(),
```

## Explicitly verified (no finding)

- **Hash mechanics:** PUT stamp and GET recompute use the identical `createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)` expression; 16 chars sit below the `redactSecrets` aws_secret_key 40-char floor; stamps emitted from stored fields only. Field names (`revision`, `textHash`, `text`, `actions`, `recordedAt`) avoid the redact key-name filter.
- **Fail-closed ladder:** missing → zeroed 200; shape-corrupt (record-level) → zeroed 200; hash-mismatch → zeroed 200 with no `verdicts` member (pin asserts the mismatch branch contains no `verdicts`); `ok:false` → parse + provenance, no `verdicts`; `ok:true` → parse + provenance + stamped verdicts. No bare `roeAudit(actions, {})` empty-spec path exists.
- **Route hardening:** `Buffer.byteLength(text, 'utf8') > 64*1024` (exactly-64 KiB allowed, multibyte-safe); `text.length === 0` → 400; actions required as array-of-objects (may be `[]`); POST forbidden pin intact; `res.status(500` absent from both blocks.
- **Persistence:** snapshot spread + `replaceMapContents` restore lines present; PUT persists via `emitContractEvent` → `schedulePersist` (verified body at :4903-4911); SSE broadcast and event log both `redactSecrets`-wrapped.
- **Concurrency:** handler is synchronous between `roeRecords.get('latest')` and `.set`, so last-write-wins with monotonic revision holds under Node run-to-completion.
- **Docs/MCP/skills:** API_REFERENCE PUT/GET rows match implementation shapes; MCP tool stays GET-only with no-mutation-tool disclosure; both skills keep the empty-state honesty sentence while fixing the false "yet/until a source lands" claims; operators.html untouched and still true (generic purple-input description).

---
_Reviewed: 2026-10-12T23:45:00Z_
_Reviewer: Claude (gsd-code-reviewer, Review22)_
_Depth: standard_
