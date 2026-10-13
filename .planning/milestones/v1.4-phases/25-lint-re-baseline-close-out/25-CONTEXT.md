# Phase 25: Lint Re-baseline & Close-Out - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The milestone closes on a measured lint number: the baseline returns to ≤176 with 0 errors intact, a mechanical pin prevents silent drift, and full gates re-run green as close-out evidence. Deliverables: the one net-new phase-20 warning located (lint diff vs the 176 baseline) and fixed in code or narrowly suppressed with recorded reason; the measured count in the close-out gate table; a lint-hygiene pin (inline-disable ceiling + config-diff watch, enforced via doctor check or CI step); ROADMAP/STATE reflecting completion.

</domain>

<decisions>
## Implementation Decisions

### Locked direction (research + roadmap)
- LINT-01 closes the milestone: only a post-VAL, post-code re-measure is meaningful (VAL-added tests moved counts); every phase 21–24 already reported its running count (177 held throughout, 0 errors)
- Fix in code first; narrow line-scoped suppression only with a recorded reason; NO config loosening, NO file-level disables, NO `.mjs` scope dodge, NO deletion of real logic
- The lint-hygiene pin is mechanical and enforced (doctor check or CI step) — not prose
- Close-out gate table records the MEASURED number, not a remembered one

### Claude's Discretion
- The specific doctor/CI enforcement shape (whichever binds most naturally to existing doctor checks / CI wiring)

</domain>

<code_context>
## Existing Code Insights

### Reusable Assets
- Warn rules: no-unused-vars, no-explicit-any, no-non-null-assertion, curly (eslint.config.js flat config)
- Measurement: `npm run lint` summary line; the net-new warning entered in phase 20 (177 = 176 + 1)
- Doctor checks pattern (npm run doctor — 0 blockers; extendable) and CI workflow (ci.yml) for the enforcement pin
- STACK.md §4: no `--max-warnings` gate exists today; `npx eslint "src/**/*.ts" --max-warnings 176` is the hold knob

### Established Patterns
- Static pins as enforcement language (repo convention); doctor's check list (28/33 with optional warns at v1.3 close)

### Integration Points
- eslint.config.js (watch-only — never loosened), doctor wiring, ci.yml, close-out gate tables (ROADMAP/STATE + SUMMARY)

</code_context>

<specifics>
## Specific Ideas

- Locate the phase-20 warning by linting and diffing warning identities against the 176-baseline file set (the SUMMARYs record which phase introduced it)
- Research: `.planning/research/SUMMARY.md` §Phase 5, `STACK.md` §4, `PITFALLS.md` §5 (suppression channels to forbid)

</specifics>

<deferred>
## Deferred Ideas

- Per-rule warning budgets (v2 differentiator)

</deferred>
