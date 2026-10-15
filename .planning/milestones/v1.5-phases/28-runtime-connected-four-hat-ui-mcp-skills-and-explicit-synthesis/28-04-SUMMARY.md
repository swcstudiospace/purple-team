# 28-04 Consumer Docs (Staged Contracts) — Summary

## Scope
Documented the three staged team contracts with fail-closed wording in the
consumer guides and pinned them with a docs test. No runtime changes.

## Rows added
- `docs/API_REFERENCE.md` — Dark Purple Teams table, immediately after the
  `GET /api/teams/white/report-audit` row:
  - `POST /api/teams/blue/coverage` — artifact-bound coverage stage;
    empty artifact ids / empty `artifactBytes` → `200 insufficient-evidence`;
    non-string `artifactBytes` or non-array `findings`/`telemetry` → `400`.
    Does not mint a receipt.
  - `POST /api/teams/black/workflow` — analysis-only staged review;
    empty actions + empty paths → `200 insufficient`, not a clean bill;
    destructive concealment / unapproved live probe / live bulk exfil →
    `refused`. Does not mint a receipt.
  - `POST /api/teams/white/stage` — ROE audit staging without storing a
    receipt; empty allow-list → `200 ok: false roe-scope-empty`;
    `approved: true` without `approvalEvidenceId` is not a receipt and is
    not compliant. Does not mint a receipt.
  - Existing uncommitted POST rows lower in the table left untouched.
- `docs/MCP_GUIDE.md` — Purple Team Bot Proxy Tools table, after
  `tempest_white_roe` (existing "Twelve tools" sentence untouched):
  - `tempest_blue_coverage`, `tempest_black_workflow`, `tempest_white_stage`
    with fail-closed one-liners and "Not a mission-start step."
- `src/__tests__/phase28-consumer-docs.test.ts` — pins the three paths,
  three tool names, `insufficient-evidence`, `not a clean bill`,
  `roe-scope-empty`, `Does not mint a receipt`,
  `An approved flag alone is not a receipt`, and asserts neither doc
  contains `auto-dispatch`.

## Verification
Not run (per assignment: no vitest/lint/formatters).

## Commit
Left to the orchestrator — no git commands run.
