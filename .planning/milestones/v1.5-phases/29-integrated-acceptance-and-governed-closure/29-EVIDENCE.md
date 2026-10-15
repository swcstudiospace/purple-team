# Phase 29 evidence record

**Recorded:** 2026-10-15
**Branch:** feat/four-hat-runtime-parity
**HEAD at record time:** 4cda5fd plus the planning commit that adds this file

This is an observation record. It does not mark the 72 requirements complete.

## Observed

| Check | Result |
|---|---|
| `npx vitest run src` | 107 files, 1239 tests, exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` phase 28 consumer pins | exit 0 |
| Loopback server | `http://127.0.0.1:3333` served `/ui` and the three staged POSTs |
| Phase 28 browser walk | `.planning/phases/28-runtime-connected-four-hat-ui-mcp-skills-and-explicit-synthesis/28-OBSERVATION.md` |

Staged routes exercised on that server:

- `POST /api/teams/blue/coverage` with empty bytes returned `status: insufficient-evidence` and did not mark the finding covered.
- `POST /api/teams/black/workflow` with empty actions and paths returned `outcome: insufficient`, `effects: []`.
- `POST /api/teams/white/stage` with blank text returned `ok: false`, `reason: roe-parse-failed`. `scope: none` returned a violation, not compliant.

No receipt-mint route was added. No Purple proposal was auto-dispatched.

## Not observed

- FH-EXEC-4 is still unmounted. STATE.md records it as an owner decision. This session did not amend TaskStore inputs, dependencies, or acceptance.
- REQUIREMENTS.md still lists all 72 AC/NFR rows Pending. Phase 28's transition could not parse those IDs into the requirements checker, and this record does not flip them.
- No hostile command/file/path/URL/symlink matrix was run against a live target.
- No credential-isolated off-loopback, CSRF, or bearer regression beyond the existing unit suite.
- No owner visual sign-off of every changed page.
- `docs/CHANGELOG.md` in the working tree is a rebrand edit. It was not updated in a phase commit.
- Authentic TaskStore audit → complete → cleanup was not performed.

## Phase 29 boundary

Criterion 5 requires the owner to follow authentic gate evidence before milestone completion. That gate is not satisfied by this file.
