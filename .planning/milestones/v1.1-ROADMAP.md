# Roadmap: v1.1 — Specialized Hats, Grok Abstractions, UI Redesign, Tauri Wrapper

Milestone v1.0 (Phases 1-5) shipped 2026-10-09 — see ROADMAP.md. This file tracks v1.1
(Phases 6-10). Continuous phase numbering per GSD convention.

## Overview

Deepen the Dark Purple core with specialized per-discipline Hats (2 per White/Blue/Black team),
give Grok chat a proper slash-command abstraction layer scoped per hat, completely redesign and
polish the UI to buttery-smooth, and wrap the application in Tauri 2.0 for desktop + mobile.

## Phases

- [x] **Phase 6: Specialized Team Hats** - 6 hat archetypes (specter/wraith, sentinel/warden, arbiter/auditor) with prompts, grants, lanes, manifest (2026-10-09)
- [x] **Phase 7: Grok Chat Slash Abstractions** - hat-scoped slash skills + MCP tools + command grammar (2026-10-09)
- [x] **Phase 8: UI Complete Redesign + Polish** - full visual/interaction overhaul, motion, mobile viewports (2026-10-09)
- [x] **Phase 9: Tauri 2.0 Desktop + Mobile Wrapper** - src-tauri scaffold, capabilities, bundle wiring, mobile init (2026-10-09)
- [x] **Phase 10: Hardening & Close-out** - full gates, commits, docs, planning final (2026-10-09)

## Phase Details

### Phase 6: Specialized Team Hats
**Goal**: Each discipline gains two specialized Hats with distinct doctrine, prompts, and tool grants.
**Depends on**: v1.0 (teams/prompts/operators/server contracts)
**Requirements**: OperatorArchetype union += specter, wraith, sentinel, warden, arbiter, auditor; OPERATOR_SYSTEM_PROMPTS entries; src/teams/hats.ts (HAT_ARCHETYPES, hatTeam, hatToolGrants, per-hat behaviors reusing black/blue/white functions); ARCHETYPE_PROFILES; VALID_ARCHETYPES; familyOperators/laneToolGrants; cli/general lists; manifest regen
**Success Criteria**:
  1. All 6 hats spawnable with doctrine-correct prompts and disjoint-or-justified grants
  2. Lane routing + purple synthesis consume hats without special cases
  3. prompt-manifest.json holds all 17 operator prompts; prompt:audit passes; hat tests pass
**Plans**: 2 plans

Plans:
- [x] 06-01: Hat core (union, prompts, teams/hats.ts, tests)
- [x] 06-02: Hats integration (profiles, lanes, manifest, integration tests)

### Phase 7: Grok Chat Slash Abstractions
**Goal**: Grok chat drives hat-scoped slash commands through one documented grammar over the canonical backend.
**Depends on**: Phase 6 (hat ids + team endpoints)
**Requirements**: new SKILL.md skills (per-hat commands + shared grammar: quoted args, unknown-command fallback); index.json rows; MCP hat tools in src/mcp-server.ts (proxy only); gateway tests; README registry docs
**Success Criteria**:
  1. Every hat reachable from chat via a named slash command with explicit arg grammar
  2. New MCP tools proxy canonical endpoints only (no duplicated logic); degraded-mode preserved
  3. No token/UUID shapes in grokbot/; gateway + package tests green
**Plans**: 1 plan

Plans:
- [x] 07-01: Hat skills + MCP tools + grammar docs + tests

### Phase 8: UI Complete Redesign + Polish
**Goal**: The UI is completely redesigned: refined visual system, buttery motion, mobile-ready.
**Depends on**: Phase 6 (hats surface); server API frozen
**Requirements**: visual uplift on token foundation; component refinement; transitions + reduced-motion; per-page states; mobile viewport pass; keyboard/ARIA; test updates (parse guard, static pins)
**Success Criteria**:
  1. All pages render from tokens with the refined system; zero hard-coded colors; zero legacy classes
  2. Motion throughout with prefers-reduced-motion honored; no blank screens or dead clicks
  3. Mobile viewports usable (collapses, touch targets); all UI tests green
**Plans**: 2 plans

Plans:
- [x] 08-01: Visual system + page overhaul
- [x] 08-02: Motion, mobile, states, tests

### Phase 9: Tauri 2.0 Desktop + Mobile Wrapper
**Goal**: The app ships as desktop + mobile shells wrapping the UI, backed by the loopback server strategy.
**Depends on**: Phase 8 (final docs/ asset set); backend strategy: external loopback server (sidecar bundling is a recorded follow-up, not this phase)
**Requirements**: src-tauri/ (tauri.conf.json frontend dist docs/, capabilities lockdown, icons); npm scripts (tauri:dev/build/ios/android); docs/TAURI.md; CI job; mobile init outputs; smoke (cargo check when toolchain present, else static review)
**Success Criteria**:
  1. `tauri dev`/`build` wired to docs/ with locked-down capabilities (no blanket shell/fs access)
  2. Backend connection strategy documented + implemented (loopback default, LAN override, bearer follow-up named)
  3. Mobile targets initialized with viewport-safe UI contract
**Plans**: 2 plans

Plans:
- [x] 09-01: Scaffold (config, capabilities, scripts, docs, CI)
- [x] 09-02: Bundle wiring (final assets, icons, mobile init, smoke)

### Phase 10: Hardening & Close-out
**Goal**: v1.1 verifiably green and documented.
**Depends on**: Phases 6-9
**Requirements**: lint, typecheck, full test suite, doctor, prompt:audit; phase commits; planning final; docs touch-ups
**Success Criteria**:
  1. All gates pass; tree green
  2. Docs cover hats, Grok commands, redesigned UI, Tauri wrapper
  3. ROADMAP/STATE reflect completion
**Plans**: 1 plan

Plans:
- [x] 10-01: Full gates + commits + docs + state upkeep

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Specialized Team Hats | 2/2 | Complete | 2026-10-09 |
| 7. Grok Chat Slash Abstractions | 1/1 | Complete | 2026-10-09 |
| 8. UI Complete Redesign + Polish | 2/2 | Complete | 2026-10-09 |
| 9. Tauri 2.0 Wrapper | 2/2 | Complete | 2026-10-09 |
| 10. Hardening & Close-out | 1/1 | Complete | 2026-10-09 |
