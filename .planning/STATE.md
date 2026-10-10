---
gsd_state_version: '1.0'
status: in_progress
progress:
  total_phases: 6
  completed_phases: 3
  percent: 50
---

# Project State — v1.3

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-10) and .planning/milestones/ for the archived v1.0–v1.2 records.

**Core value:** Every adversarial claim hardens into scoped, receipt-backed, retestable evidence.
**Current focus:** v1.3 — color suites at red parity

## Current Position

Phase: 18 of 20 (Black Playbook & Bench)
Plan: not yet planned
Status: Phases 15–17 complete
Last activity: 2026-10-10 — Phase 17: emulation category, ATT&CK v19.2 vendor (61 techniques), black engines + routes

Progress: [█████░░░░░] 50%

## Completed Context

- **v1.0–v1.2:** archived (see `.planning/milestones/`); v1.2 tagged `v1.2` 2026-10-10.
- **Phase 15** (`f654ea1`): detection category, D3FEND vendor, blue pipeline + routes; 109→115 pins.
- **Phase 16** (`7c87fa4`): defense playbook (20), detection-coverage bench (4/4 gates), tempest_blue_gaps + skill backends.
- **Phase 17 (2026-10-10):** `emulation` category (attack-navigator, caldera); BLACK_TOOLS += 2; ATT&CK v19.2 vendor (61 techniques, detection strategies verbatim, ToU attributed); `src/teams/black/{attack-data,noise,exfil,checklist}.ts`; `GET /api/teams/black/{cover,exfil,noise}`; 117-count pins; 17 new tests.

## Pending Todos

- Phase 18: black playbook + opsec-review bench + skill/MCP wiring.

## Blockers/Concerns

- `dark-purple/SKILL.md` rewiring deferred to Phase 20 (needs all-color routes).
- ATT&CK upstream shape drift (v19 renamed tactics, moved detection prose) — vendor documents the shape it tracks; re-vendor would follow upstream.
- Count pins move with every adapter wave (15: 109→115, 17: 115→117).

## Session Continuity

Last session: 2026-10-10
Stopped at: Phase 18 next
Resume file: None
