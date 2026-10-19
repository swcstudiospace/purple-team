---
gsd_state_version: "1.0"
milestone: v1.7
milestone_name: GitHub Integration, Repo-URL Purple Team, Claude PKCE & Full-screen Agent Panel
status: in_progress
stopped_at: Phase 34 starting — design wave in flight
last_updated: "2026-10-19T12:00:00.000Z"
last_activity: 2026-10-19
last_activity_desc: Milestone v1.7 opened (SPE-15995/15994/15992/15993); survey complete; phase designs dispatched
state_head: 0e60870e883a89d44458096764050a29a58d5b17
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
current_phase: 34
current_phase_name: Claude Subscription OAuth (PKCE)
---

# Project State

## Project Reference

See: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/v1.7-SURVEY.md` (workstream file map), and `.planning/milestones/` for the archived v1.0–v1.6 records.

**Core value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence across all 4 Hats (Red, Blue, White, Black) with Purple synthesis.
**Current focus:** Milestone v1.7 — GitHub integration with repository-URL Purple Team runs, in-app Claude subscription OAuth (PKCE, Pro Max 20x), and the full-screen Agent Panel absorbing Generative UI (`SPE-15995`, `SPE-15994`, `SPE-15992`, `SPE-15993`).

## Current Position

Phase: 34 of 36 (Claude Subscription OAuth — PKCE)
Status: in_progress
Last activity: 2026-10-19 — v1.7 opened; user decisions locked (borrow public clients · remove snippets after URL E2E · private repos in scope · sidebar + conversation history)
Progress: [░░░░░░░░░░] 0% (0/3 phases complete)

## v1.7 Locked Decisions (user, 2026-10-19)

- **q1 OAuth clients:** borrow public clients — Claude PKCE via Anthropic's public client (repo precedent: ChatGPT/Codex login in `src/llm/oauth.ts`); GitHub OAuth App env-gated, anonymous public-repo API until registered.
- **q2 Snippet input:** remove entirely once repository-URL mode passes live end-to-end.
- **q3 Private repos:** ship now — connected-account `repo` scope covers private repositories.
- **q4 Agent Panel:** sidebar + multi-conversation history.

## Pending Todos

- [ ] Phase 34: Claude Subscription OAuth (PKCE) — in-app login, provider wiring, session tier UI (`SPE-15995`)
- [ ] Phase 35: GitHub Integration & Repository-URL Purple Team — account connection, repo ingest pipeline, URL input replacing snippets (`SPE-15994`, `SPE-15992`)
- [ ] Phase 36: Full-screen Agent Panel & Generative UI Merge — viewport chat with conversation history, inline runs, sandboxed GenUi (`SPE-15993`)

## Operator Next Steps

- Autonomous run in progress on branch `v1.7-github-claude-agentpanel`; ship via `ultrathink-ship` when phases 34-36 verify green.
