# Summary 20-01: Purple v2 & Defend UI

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE (full gate run)

## What changed

- **Purple v2:** `synthesize` accepts optional `verdictsByFinding` (id-keyed join; legacy positional still works but the output declares `correlation: 'positional-fallback'` honestly); per-row deterministic `riskTier` (severity base, none-detection bump, violation floor — named constants + documented table); `DarkPurpleSynthesis` extended additively. Server route validates the map (honest 400 on bad shape) and persists the latest synthesis through the existing snapshot/restore machinery.
- **Defend UI:** `docs/defend.html` (Command nav group, icon D) — four read-only panels over the live color routes: detection-coverage matrix (with coverage filter + unresolved D3FEND ids surfaced), noise budget (tier/violations), evidence chain (intact/broken + repair conditions), report audit (readiness/gaps/unclaimed). All four states per panel, escHtml everywhere, zero new CSS (white/red tokens; mobile drawer + reduced-motion inherited). Asset pins updated (tauri-scaffold list + IA.md inventory).
- **Wiring sweep:** dark-purple SKILL.md rewired onto the real color routes (black cover, blue gaps, white roe — honest no-ROE-on-record caveat; synthesize curl carries `verdictsByFinding`, MCP proxy noted as the plain form); MCP_GUIDE.md gains the three tool rows, count Nine → Twelve.

## Verification (full gates, repo root)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 — 0 errors, 177 warnings (176 pre-existing baseline + 1 net-new) |
| `npx tsc --noEmit` | clean |
| `npm test` | 100 files / **1103 tests passed**; ops preflight 11/11; model matrix 19/19; refusal-frontier self-test in script (exit 0) |
| `npm run doctor` | exit 0 (warnings: optional tools absent; API offline — no server running, matches v1.2 baseline) |
| `npm run prompt:audit` | exit 0 — 39/39 directive-preservation baseline |

Unit-level: purple-v2 11 tests (shuffled-map id join vs positional decoy, 16-row risk table, fallback modes); Defend UI replicated the ui-inline-scripts gates (43/43 on touched suites).

## Deferred with reasons

- White verdicts-on-record need a ROE text source in server state (routes + skills report the honest cannot-derive state today).
- `residualRisk` prose string kept verbatim (pinned by teams-modules + rendered in operators.html/API_REFERENCE) — the deterministic signal is the new `riskTier` field.
- docsite MCP_GUIDE mirror is build-time generated (pagenary), not hand-synced.
