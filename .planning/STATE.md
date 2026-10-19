---
gsd_state_version: "1.0"
milestone: v1.7
milestone_name: GitHub Integration, Repo-URL Purple Team, Claude PKCE & Full-screen Agent Panel
status: in_progress
stopped_at: Phase 35 starting — P2 wave dispatch
last_updated: "2026-10-19T12:30:00.000Z"
last_activity: 2026-10-19
last_activity_desc: Phase 34 complete (SPE-15995) — claude OAuth vendor, provider seam, session UI; full test:pr green
state_head: 341dbf6e883a89d44458096764050a29a58d5b17
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 3
  completed_plans: 1
  percent: 33
current_phase: 35
current_phase_name: GitHub Integration & Repository-URL Purple Team
---

# Project State

## Project Reference

See: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/v1.7-SURVEY.md`, `.planning/v1.7-EXECUTION-PLAN.md`, and `.planning/milestones/` for archived v1.0–v1.6 records.

**Core value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence across all 4 Hats (Red, Blue, White, Black) with Purple synthesis.
**Current focus:** Milestone v1.7 — phase 35 (GitHub integration + repo-URL Purple Team) in flight; phase 34 (Claude PKCE) complete.

## Current Position

Phase: 35 of 36 (GitHub Integration & Repository-URL Purple Team)
Plan: 35-01 in flight (P2a/P2b/P2c parallel units)
Status: in_progress
Last activity: 2026-10-19 — Phase 34 verified green (46 OAuth tests; full `npm run test:pr` chain; corrective loop closed 2 defects incl. one latent main-branch token-precedence bug)
Progress: [███░░░░░░░] 33% (1/3 phases complete)

## Completed Context (v1.7)

- **Phase 34** (2026-10-19, `SPE-15995`): `claude` OAuthVendor (S256 PKCE + state, pasted-callback, rotating refresh w/ single-flight, tier via profile, env-overridable endpoints), AnthropicAdapter Bearer+beta branch, OAuth-wins config hydration, `/api/oauth/claude/*` routes, settings/index/overview session UI with tier badge + one-time notice. Known open: R1 manual live-login E2E (user validation); anthropic not streamable (D7). Artifacts: `.planning/phases/34-claude-oauth-pkce/`.

## Pending Todos

- [ ] Phase 35: GitHub Integration & Repository-URL Purple Team (`SPE-15994`, `SPE-15992`)
- [ ] Phase 36: Full-screen Agent Panel & Generative UI Merge (`SPE-15993`)

## Operator Next Steps

- R1 validation at milestone close: real Claude Pro/Max login through the new card (see 34-01-SUMMARY).
- Autonomous run continues on `v1.7-github-claude-agentpanel`; ship via `ultrathink-ship`.
