---
gsd_state_version: '1.0'
status: in_progress
progress:
  total_phases: 6
  completed_phases: 4
  percent: 67
---

# Project State — v1.3

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-10) and .planning/milestones/ for the archived v1.0–v1.2 records.

**Core value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence.
**Current focus:** v1.3 — color suites at red parity

## Current Position

Phase: 19 of 20 (White Suite)
Plan: not yet planned
Status: Phases 15–18 complete
Last activity: 2026-10-10 — Phase 18: tradecraft playbook (20, ATT&CK-keyed), opsec-review bench (6/6 gates, benign-admin decoys), tempest_black_cover

Progress: [██████▋░░░] 67%

## Completed Context

- **v1.0–v1.2:** archived (see `.planning/milestones/`); v1.2 tagged `v1.2` 2026-10-10.
- **Phase 15** (`f654ea1`): detection category, D3FEND vendor, blue pipeline + routes; 109→115 pins.
- **Phase 16** (`7c87fa4`): defense playbook (20), detection-coverage bench, tempest_blue_gaps + skill backends.
- **Phase 17** (`7d7d7f0`): emulation category, ATT&CK v19.2 vendor (61), black engines + routes; 115→117 pins.
- **Phase 18 (2026-10-10):** `ai-tradecraft-playbook.ts` (20, attckId-verified); `opsec-review-bench` (10 cases/25 groups/2 decoys, CI-pinned, `black:bench`); MCP `tempest_black_cover`; specter/wraith skills on real routes.

## Pending Todos

- Phase 19: white suite (governance packs, white v2, ROE bench, routes/skills/MCP).

## Blockers/Concerns

- `dark-purple/SKILL.md` rewiring → Phase 20 (needs white routes).
- MCP_GUIDE tool-table sync → Phase 20 close-out.
- Count pins stable at 117 (no adapter wave in 18).

## Session Continuity

Last session: 2026-10-10
Stopped at: Phase 19 next
Resume file: None
