# Phase 26 Adopted Runtime Contract (operator-facing)

Plan 26-02 companion to `docs/API_REFERENCE.md` (which carries unrelated
user WIP and is intentionally left uncommitted). This file documents only
what 26-01/26-02 implemented — no aspirational routes.

## Structured start discriminator

`POST /api/mission/start` branches on the presence of `roleInputs`,
`family`, or `targetContext`. `inlineArtifacts` alone never flips the
branch. Unknown roles fail 400 naming the role; duplicate roles fail 400
before any spawn.

## Bounded inline artifact

- Envelope: array, at most 1 element (`inlineArtifacts`).
- Element: `mediaType: "text/plain"`, `encoding: "utf8"`,
  nonempty string `data`, 64 KiB cap (413 over cap, 400 shape violations).
- The server mints the binding id (caller `id` kept as label only) and
  computes the sha256 hash (four 16-hex groups). Validated and hashed
  before any mission state exists; no mission on failure.
- Artifact-only starts (`targetContext.kind: "artifacts"`) insert no
  targets and never call `generateTasksForTarget`.

## Structured validation errors

`validateStructuredStart` requires an objective and nonempty known unique
roles; every failure is a 400 naming the offending role. Spawn throw per
role yields `unavailable` with a retained `runId` — never model prose.

## Claimed-versus-observed receipt boundary

Public, legacy, and imported source/tool/system/type/strength labels stay
claimed. Only the private `recordReceipt` writer mints `origin: observed`,
solely after a real computation returns, bound to run, mission, stage,
tool, input hash, and item id. First honest hook: successful `parseRoe`
on `PUT /api/teams/white/roe`. No writes on parse failure or from GET
handlers. `POST /api/evidence` ignores `body.origin`. Historical rows
without origin stay unlabeled — no backfill. Restore drops forged
`origin: observed` rows lacking the full binding. No public
receipt-minting endpoint exists.

## Unavailable-executor behavior

A hat executor that is not registered reports `unavailable` with the
retained run id. It never returns a fake completion.

## Unsupported cancellation (honest)

`POST /api/mission/stop` halts the tick loop and answers
`{ success: true, message: 'Mission stopped', cancelAcknowledged: false }`.
A scheduler stop or transport abort is not an acknowledged cancel or
resume. No `POST /api/mission/cancel` route exists. Pending/running
retained runs restore as `interrupted` with `executionSettled: true` —
never resumed. Valid completed evidence survives interruption; retry never
repeats a completed side effect without existing idempotency or renewed
approval. Late results complete only the original mission row
(`completeForMission` refuses cross-mission retarget).

## Absent routes

There is no `POST /api/mission/artifacts`. Do not document or call it.

## Controller prerequisite

FH-EXEC-4 is unmounted in this host. Product plans never invoke
`orch_amend.py`, invent a signature, re-lease DONE tasks, or claim the
amendment closed. Loopback remains the trust boundary; non-loopback
bearer behavior is unchanged.

## Finite bounds (unchanged)

`maxRetries: 3`, `DEFAULT_AGENT_MAX_ITERATIONS: 15`, existing task
timeouts. No second scheduler was added.
