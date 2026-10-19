---
gsd_state_version: "1.0"
milestone: v1.7
milestone_name: GitHub Integration, Repo-URL Purple Team, Claude PKCE & Full-screen Agent Panel
status: complete
stopped_at: Milestone complete — pending R1 live-login validation note below
last_updated: "2026-10-19T17:00:00.000Z"
last_activity: 2026-10-19
last_activity_desc: Phases 34-36 complete; login-first UI redesign verified by live browser E2E (device-flow login, repo picker, GenUI, chat)
state_head: 7a45008
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 3
  completed_plans: 3
  percent: 100
current_phase: 36
current_phase_name: Full-screen Agent Panel & Generative UI Merge
---

# Project State

## Project Reference

See: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/v1.7-SURVEY.md`, `.planning/v1.7-EXECUTION-PLAN.md`, and `.planning/milestones/` for archived v1.0–v1.6 records.

**Core value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence across all 4 Hats (Red, Blue, White, Black) with Purple synthesis.
**Current focus:** Milestone v1.7 complete (phases 34-36) plus the 2026-10-19 login-first redesign on `v1.7-github-claude-agentpanel`.

## Current Position

Phase: 36 of 36 — complete
Status: milestone_closeout
Last activity: 2026-10-19 — Phases 35/36 code shipped in `2c2feb5` (planning state had lagged); redesign wave verified end-to-end and committed.
Progress: [██████████] 100% (3/3 phases complete)

## Completed Context (v1.7)

- **Phase 34** (`SPE-15995`): `claude` OAuthVendor (S256 PKCE + state, pasted-callback, rotating refresh w/ single-flight, tier via profile, env-overridable endpoints), AnthropicAdapter Bearer+beta branch, OAuth-wins config hydration, `/api/oauth/claude/*` routes, settings session UI with tier badge. Artifacts: `.planning/phases/34-claude-oauth-pkce/`.
- **Phase 35** (`SPE-15994`, `SPE-15992`): GitHub OAuth backend (web flow + token store + repo listing/resolve + tarball ingest + repoUrl mission start). Extended in the redesign wave: zero-config **device-flow login** (gh CLI public client id, `T3MP3ST_GITHUB_DEVICE_CLIENT_ID` override), PAT connect, branch listing; repo-first Agent Panel entry (account list w/ visibility filter + paste-URL resolve → configure → launch), conversation-scoped repo targets, composer paste capture. Live E2E: real device login, private+public org repos, anonymous resolve + mission ingest on expressjs/express.
- **Phase 36** (`SPE-15993`): full-screen Agent Panel (sidebar/history/streaming/timeline). Redesign wave: 4-hat tab strip removed (single unified stream; tools/skills merged into the slash palette), Grok-style dark reskin, SPA Settings section (`#settings`) replacing the static-link nav, static Four Hats page removed. **GenUI sandbox boot repaired** — opaque-origin CSP self-block + anonymous-CORS fix; verified live render at auto-height.

## Redesign wave fixes (root causes of the "constant errors")

1. GitHub page 503/setup wall → device flow makes login zero-config.
2. `POST /api/chat` 402 on credit-limited keys → `maxOutputTokens: 8192` cap in `src/chat/chat-route.ts`.
3. GenUI frames never rendered → `ui/genui.html` CSP + `Access-Control-Allow-Origin: *` on `/app` static assets (`src/server.ts`).

## Pending Todos

- [ ] R1 at milestone close: manual live Claude Pro/Max login through the Claude card (34-01-SUMMARY). GitHub live login is now verified (`@SomeRandmGuyy` device flow).
- [ ] D2 gate: live public-repo URL E2E checklist (35-CONTEXT §8) — partially covered by the 2026-10-19 expressjs/express run; remaining: >64 MiB repo, mid-fetch cancel, SSE drop/reconnect.

## Operator Next Steps

- Milestone v1.7 ready for `ultrathink-ship` on `v1.7-github-claude-agentpanel`.
