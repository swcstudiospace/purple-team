---
gsd_state_version: "1.0"
milestone: v2
milestone_name: Audit Follow-ups, Lint Gate & Deferred v2 Requirements
status: Phase 37 partly done; stray directory open
last_updated: "2026-10-21T05:00:00.000Z"
last_activity: 2026-10-21
last_activity_desc: Closeout run — v1.6 archived, v1.7 closed (PR #7 merged), v2 bootstrapped
state_head: 95c63331bce121c06d5bcb8c67567cd034db1231
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 0
  completed_plans: 0
  percent: 20
current_phase: 37
current_phase_name: Audit follow-ups
stopped_at: phase 38 merged (PR #9); phase 37 partly done
---

# Project State

## Project Reference

See: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, and `.planning/milestones/` for archived v1.0–v1.7 records.

**Core value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence across all 4 Hats (Red, Blue, White, Black) with Purple synthesis.
**Current focus:** Milestone v2 (phases 37-41). v1.6 and v1.7 are archived. PR #7 (v1.7) is merged to `main`.

## Current Position

Phase: 37 — Audit follow-ups (partly done)
Plan: —
Status: Phase 37 partly done; phase 38 merged (PR #9, b2671b4). F-20-01 retargeted (38/38); Nyquist and Phase 23 complete. Open: stray repo-root directory.
Last activity: 2026-10-21 — v1.6 archived; v1.7 closed; v2 bootstrapped

## Completed Context (v1.7)

- **Phase 34** (`SPE-15995`): `claude` OAuthVendor (S256 PKCE + state, pasted-callback, rotating refresh w/ single-flight, tier via profile, env-overridable endpoints), AnthropicAdapter Bearer+beta branch, OAuth-wins config hydration, `/api/oauth/claude/*` routes, settings session UI with tier badge. Artifacts: `.planning/milestones/v1.7-phases/34-claude-oauth-pkce/`.
- **Phase 35** (`SPE-15994`, `SPE-15992`): GitHub OAuth backend (web flow + token store + repo listing/resolve + tarball ingest + repoUrl mission start). Extended in the redesign wave: zero-config **device-flow login** (gh CLI public client id, `T3MP3ST_GITHUB_DEVICE_CLIENT_ID` override), PAT connect, branch listing; repo-first Agent Panel entry (account list w/ visibility filter + paste-URL resolve → configure → launch), conversation-scoped repo targets, composer paste capture. Live E2E: real device login, private+public org repos, anonymous resolve + mission ingest on expressjs/express. Artifacts: `.planning/milestones/v1.7-phases/35-github-integration-repo-url/`.
- **Phase 36** (`SPE-15993`): full-screen Agent Panel (sidebar/history/streaming/timeline). Redesign wave: 4-hat tab strip removed (single unified stream; tools/skills merged into the slash palette), Grok-style dark reskin, SPA Settings section (`#settings`) replacing the static-link nav, static Four Hats page removed. **GenUI sandbox boot repaired** — opaque-origin CSP self-block + anonymous-CORS fix; verified live render at auto-height. Artifacts: `.planning/milestones/v1.7-phases/36-fullscreen-agent-panel/`.

## Redesign wave fixes (root causes of the "constant errors")

1. GitHub page 503/setup wall → device flow makes login zero-config.
2. `POST /api/chat` 402 on credit-limited keys → `maxOutputTokens: 8192` cap in `src/chat/chat-route.ts`.
3. GenUI frames never rendered → `ui/genui.html` CSP + `Access-Control-Allow-Origin: *` on `/app` static assets (`src/server.ts`).

## Pending Todos

- [ ] R1 at milestone close: manual live Claude Pro/Max login through the Claude card (34-01-SUMMARY). GitHub live login is now verified (`@SomeRandmGuyy` device flow).
- [ ] D2 gate: live public-repo URL E2E checklist (35-CONTEXT §8) — partially covered by the 2026-10-19 expressjs/express run; remaining: >64 MiB repo, mid-fetch cancel, SSE drop/reconnect.

## Operator Next Steps

- Phase 37: the stray repo-root directory `Heads-up: while wiring GET ` needs your approval before deletion.
- Phases 39–41 need owner design decisions before execution (ledger shape, provenance fields, install-verification environment).
- PR #4 (`feat/purple-team-rebrand`) is stale (base is the v1.4-era main) and conflicts with main: decide merge, close or hold.
- `feat/purple-team-platform` has 21 unmerged commits and no PR: decide whether to open one.
- R1 live Claude Pro/Max login and the D2 mission-level run remain user-run validations.
