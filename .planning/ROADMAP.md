# Roadmap: Purple Team — 4-Hat Vulnerability AI

## Milestones

- ✅ **v1.0 Plan-Based Inference, Dark Purple Core, White/Red UI & Grok Bot** — Phases 1-5 (shipped 2026-10-09)
- ✅ **v1.1 Specialist Hats, Grok Abstractions, UI Redesign, Tauri Wrapper** — Phases 6-10 (shipped 2026-10-09)
- ✅ **v1.2 Re-home Completion: Tauri Bundling & Remote Hardening** — Phases 11-14 (shipped 2026-10-10)
- ✅ **v1.3 Color Team Suites at Red Parity** — Phases 15-20 (shipped 2026-10-10)
- ✅ **v1.4 Hardening & Validation** — Phases 21-25 (shipped 2026-10-13)
- ✅ **v1.5 Four-Hat Runtime Parity** — Phases 26-29 (shipped 2026-10-15)
- ✅ **v1.6 Four-Hat Tooling, Composable Skills, UI & Desktop/Mobile Optimization** — Phases 30-33 (completed 2026-10-15; archived 2026-10-21)
- ✅ **v1.7 GitHub Integration, Repo-URL Purple Team, Claude PKCE & Full-screen Agent Panel** — Phases 34-36 (shipped 2026-10-21 via PR #7; archived)
- 🚀 **v2 Audit Follow-ups, Lint Gate & Deferred v2 Requirements** — Phases 37-41 (started 2026-10-21)

Archives: `.planning/milestones/` (per-milestone `v*-ROADMAP.md` / `v*-REQUIREMENTS.md`, phase dirs in `v*-phases/`).

## Current Milestone

🚀 **v2 Audit Follow-ups, Lint Gate & Deferred v2 Requirements (Phases 37-41)** — started 2026-10-21. Scope is the candidate list recorded at v1.4 close in `.planning/PROJECT.md` (owner-accepted). Phases 39-41 are grey areas and need owner decisions before execution.

- [ ] Phase 37 (partly done): F-20-01 retargeted to shipped doctrine sources, 38/38 (33/38 measured 2026-10-21 before retargeting); stale v1.3 Nyquist prose refreshed; Phase 23 Tier-cell browser render observed and 23-VERIFICATION reconciled. Open: stray repo-root artifact (deletion not approved; left in place)
- [ ] Phase 38: Lint scope and gates — F-25-01 (18 never-linted files, 16 errors, 112 warnings); per-rule lint budgets; doctor-integrated lint gate
- [ ] Phase 39: ROE verdict ledger and revision history — grey area, owner design decision needed
- [ ] Phase 40: ROE text provenance and purple auto-consumption of recorded verdicts — grey area; depends on Phase 39
- [ ] Phase 41: Install-and-launch verification of the built `.deb` / AppImage — environment-dependent

<details>
<summary>✅ v1.7 GitHub Integration, Repo-URL Purple Team, Claude PKCE & Full-screen Agent Panel (Phases 34-36) — shipped 2026-10-21</summary>

- [x] Phase 34: Claude Subscription OAuth (PKCE) — in-app Pro Max 20x login via Anthropic's public PKCE client, provider wiring, session tier UI (`SPE-15995`) — completed 2026-10-19 (manual live-login E2E pending, R1)
- [x] Phase 35: GitHub Integration & Repository-URL Purple Team — account connection (private repos in scope), repo ingest pipeline, URL input replacing code snippets (`SPE-15994`, `SPE-15992`) — code shipped in 2c2feb5; verified + extended 2026-10-19 (zero-config device login, PAT connect, branch listing, repo-first Agent Panel entry; live E2E incl. real device-flow login and private/org repo listing)
- [x] Phase 36: Full-screen Agent Panel & Generative UI Merge — viewport chat with conversation sidebar/history, inline run progress, sandboxed GenUi (`SPE-15993`) — code shipped in 2c2feb5; verified + repaired 2026-10-19 (GenUI sandbox boot fixed: opaque-origin CSP + anonymous CORS; single unified stream after 4-hat tab removal; Grok-style reskin)

Archived: `.planning/milestones/v1.7-ROADMAP.md`, `.planning/milestones/v1.7-MILESTONE-AUDIT.md`, `.planning/milestones/v1.7-phases/`. Carried validation debt: R1 live Claude login; D2 mission-level run.

</details>

<details>
<summary>✅ v1.6 Four-Hat Tooling, Composable Skills, UI & Desktop/Mobile Optimization (Phases 30-33) — completed 2026-10-15; archived 2026-10-21</summary>

- [x] Phase 30: Four-Hat Architecture Audit & Milestone Alignment (`SPE-14018`, `SPE-14023`) — completed 2026-10-15
- [x] Phase 31: Unified 4-Hat Tool Registry, Blue/White/Black Tools, Extra Utilities & Composable Skills (`SPE-14019`, `SPE-14022`) — completed 2026-10-15
- [x] Phase 32: Upgraded 4-Hat UI Shell, WCAG 2.1 AA Hat Theming, Command Palette & Interactive Workspace (`SPE-14020`) — completed 2026-10-15
- [x] Phase 33: Desktop Multi-Pane & Native Mobile / PWA Ergonomics + Automated Verification (`SPE-14021`, `SPE-14024`) — completed 2026-10-15

Archived: `.planning/milestones/v1.6-ROADMAP.md`, `.planning/milestones/v1.6-phases/` (phase 30 only). Phases 31-33 have no PLAN, SUMMARY or VERIFICATION file on any branch; completion is recorded here only.

</details>

<details>
<summary>✅ v1.5 Four-Hat Runtime Parity (Phases 26-29) — archived 2026-10-15, override closeout</summary>

- [x] Phase 26: Runtime Authority, Bound Inputs and Retained Execution (2/2 plans) — completed 2026-10-15
- [x] Phase 27: Blue, Black and White Substantive Capability Parity (5/5 plans) — completed 2026-10-15
- [x] Phase 28: Runtime-connected Four-Hat UI, MCP, Skills and Explicit Synthesis (5/5 plans) — completed 2026-10-15
- [ ] Phase 29: Integrated Acceptance and Governed Closure — owner accepted the gap on 2026-10-15; not a passed verification

Full phase text: `.planning/milestones/v1.5-ROADMAP.md`. Requirements snapshot: `.planning/milestones/v1.5-REQUIREMENTS.md`. Audit: `.planning/milestones/v1.5-MILESTONE-AUDIT.md` (`gaps_found`, accepted).

Known gaps carried forward: FH-EXEC-4 unmounted; all 72 AC/NFR rows still Pending in the archived requirements; no hostile-input matrix; no TaskStore gate transition; uncommitted rebrand WIP was not part of the archive commit.

</details>

<details>
<summary>✅ v1.4 Hardening & Validation (Phases 21-25) — SHIPPED 2026-10-13</summary>

- [x] Phase 21: Retroactive Validation (Phases 15–20) (3/3 plans) — completed 2026-10-12
- [x] Phase 22: ROE Text as Server State (1/1 plans) — completed 2026-10-12
- [x] Phase 23: One Risk Signal (1/1 plans) — completed 2026-10-13
- [x] Phase 24: Ops Evidence on This Host (1/1 plans) — completed 2026-10-13
- [x] Phase 25: Lint Re-baseline & Close-Out (1/1 plans) — completed 2026-10-13

</details>

## Deferred (not in v2)

Owner-accepted gaps not scheduled into v2: Phase 29 (v1.5 integrated acceptance), FH-EXEC-4, and the 72 still-Pending v1.5 AC/NFR rows. Do not treat the v1.5 archive as proof those rows passed.
