# Roadmap: v1.0 — Plan-Based Inference, Dark Purple Core, White/Red UI & Grok Bot

## Overview

Upgrade the Red Team AI along four axes: subscription-plan inference (ChatGPT Plan, Cursor Plan,
with Claude/Grok/OpenRouter verified), a "Dark Purple" agent core (sharper agent logic plus Black,
Blue, and White Team capabilities with a purple synthesis loop), a compartmentalized white-and-red
UI redesign, and a UI-less Grok Bot integration with slash commands. Closes with full gates and docs.

## Phases

- [x] **Phase 1: Inference — Plan-Based Providers** - ChatGPT Plan + Cursor Plan as first-class providers; verify Claude/Grok/OpenRouter coverage (2026-10-09)
- [x] **Phase 2: Dark Purple Agent Core** - agent logic upgrade + Black/Blue/White team archetypes & tools + purple synthesis loop (2026-10-09)
- [x] **Phase 3: UI Redesign — White & Red** - compartmentalized multi-page UI, clean light theme, new sign-in/team surfaces wired in (2026-10-09)
- [x] **Phase 4: Grok Bot Integration** - rosters/templates/skills/marketplace package + MCP gateway slash-command surface (no web UI) (2026-10-09)
- [x] **Phase 5: Hardening & Close-out** - full gates, docs, planning upkeep (2026-10-09)

## Phase Details

### Phase 1: Inference — Plan-Based Providers
**Goal**: Operators can select ChatGPT Plan and Cursor Plan as inference backends alongside Claude Plan, Grok Plan, and OpenRouter.
**Depends on**: Nothing (first phase)
**Requirements**: ChatGPT Plan OAuth vendor + adapter; Cursor Plan CLI spec + provider wiring; registry/model-list/config coverage; server routes; provider tests
**Success Criteria** (what must be TRUE):
  1. `LLMProvider` union, `AVAILABLE_MODELS`, settings schema, and backbone factory all cover `chatgpt` and `cursor`
  2. `/api/oauth/openai/*` routes follow the existing xai/anthropic OAuth route pattern with token-store parity
  3. cursor-agent detection lands in `local-agents.ts` SPECS with artifact-presence auth detection (no credential reads)
  4. New provider tests pass under vitest following existing `{vendor}-provider.test.ts` conventions
**Plans**: 1 plan

Plans:
- [x] 01-01: ChatGPT Plan + Cursor Plan provider stack (oauth vendors, adapters, config/registry, routes, tests)

### Phase 2: Dark Purple Agent Core
**Goal**: Agents think and coordinate sharper: upgraded archetype doctrine plus Black/Blue/White Team modules and a purple synthesis loop.
**Depends on**: Phase 1 (provider contracts only, not runtime)
**Requirements**: new archetypes in prompt library; `src/teams/{black,blue,white,purple}` modules; lane/tool-grant metadata; prompt manifest regen
**Success Criteria** (what must be TRUE):
  1. `OperatorArchetype` union + VALID_ARCHETYPES include Black/Blue/White archetypes with full PLINIAN-compliant prompts
  2. `src/teams/` modules expose tool bundles and mapping tables consumable by server lane grants and endpoints
  3. Purple synthesis correlates red findings ↔ blue detections ↔ white verdicts into ledger-backed records
  4. `scripts/prompt-manifest.json` regenerated; `prompt:audit` passes; team tests pass
**Plans**: 1 plan

Plans:
- [x] 02-01: Archetype prompts + team modules + purple synthesis + manifest regen

### Phase 3: UI Redesign — White & Red
**Goal**: The UI is subtle and clean: white/red light theme, compartmentalized multi-page structure instead of one 27.8k-line page.
**Depends on**: Phase 1 and Phase 2 (wires their surfaces)
**Requirements**: split `docs/index.html` into pages with shared shell/CSS tokens; preserve API contract; rewrite chrome-pinned test; wire provider sign-in + team pages
**Success Criteria** (what must be TRUE):
  1. `/ui` serves compartmentalized pages (dashboard, operators, mission, arsenal, evidence, terminal, benchmarks, settings, about) with a shared shell
  2. Theme is white/red light: palette tokens, no neon gradients/aurora/meteors chrome
  3. All existing `/api/*` contracts still work from the new pages; `ui-inline-scripts-parse` guard passes per page
  4. `oauth-ui-static.test.ts` pins the new sign-in surface (ChatGPT/Claude/Grok/OpenRouter) rather than motion chrome
**Plans**: 3 plans

Plans:
- [x] 03-01: Token foundation + shared shell/nav (from programming-desk mechanism: single :root custom-property block)
- [x] 03-02: Page split + per-compartment states (loading/empty/error/success)
- [x] 03-03: Settings sign-in surface (all plan providers) + team pages + test updates

### Phase 4: Grok Bot Integration
**Goal**: Full mission control from Grok Bot with slash commands — no t3mp3st web UI involved.
**Depends on**: Phase 1 and Phase 2 (server surface it drives)
**Requirements**: `grokbot/` package (rosters, templates, skills index + SKILL.md skills, avatars, marketplace plugin) following programming-desk pattern; MCP gateway tools; integrity checks
**Success Criteria** (what must be TRUE):
  1. `grokbot/` package exists with roster, seat templates, skills index, and slash-command skills driving the server API directly
  2. MCP/gateway surface exposes mission start/status/report/operator commands without the web UI
  3. No token shapes/secrets in committed grokbot files; template generation parity verified
**Plans**: 1 plan

Plans:
- [x] 04-01: grokbot package + gateway tools + slash-command skills

### Phase 5: Hardening & Close-out
**Goal**: Milestone is verifiably green and documented.
**Depends on**: Phases 1-4
**Requirements**: lint, typecheck, full test suite, doctor; docs update; planning state upkeep
**Success Criteria** (what must be TRUE):
  1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run doctor` all pass
  2. Docs cover new providers, teams, UI structure, and Grok Bot integration
  3. ROADMAP/STATE reflect completion
**Plans**: 1 plan

Plans:
- [x] 05-01: Full gates + docs + state upkeep

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 (3 and 4 may dispatch in parallel)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Inference — Plan-Based Providers | 1/1 | Complete | 2026-10-09 |
| 2. Dark Purple Agent Core | 1/1 | Complete | 2026-10-09 |
| 3. UI Redesign — White & Red | 3/3 | Complete | 2026-10-09 |
| 4. Grok Bot Integration | 1/1 | Complete | 2026-10-09 |
| 5. Hardening & Close-out | 1/1 | Complete | 2026-10-09 |
