# T3MP3ST UI information architecture

Legacy single-page compartments (the fourteen `page-*` sections of the old
`docs/index.html`) are now grouped into eleven static pages sharing one shell
(`docs/assets/shell.js` plus the styles in `docs/assets/tokens.css`). Every
existing function is reachable below; `docs/index.html` remains the `/ui/`
landing (same document as `overview.html`) so existing bookmarks keep working.

## Legacy compartment to page mapping

| Legacy compartment | New page | Notes |
| --- | --- | --- |
| page-warroom | overview.html | Mission launch, live status, findings, admiral quick operations |
| page-live-scan | mission.html | Live scan view (`?view=scan`) |
| page-receipts | mission.html | Scope receipts view (`?view=receipts`, `?filter=`) |
| page-operators | operators.html | Roster, prompt editor, team grants |
| page-evidence | evidence.html | Findings / evidence ledger (`?kind=`, `?sev=`, `?q=`, `?mission=`) |
| page-arsenal | arsenal.html | Adapter status, loadout plan, tool approvals |
| page-terminal | terminal.html | Allow-listed execution with receipt gating (`?target=`) |
| page-benchmarks | range.html | OBSIDIVM suite (`?suite=bench`, `?cat=`) |
| page-ctf-range | range.html | CTF drills, honestly labeled simulation (`?suite=ctf`) |
| page-general | engagements.html | Op Admiral plans (`?view=admiral`) |
| page-selfimprove | engagements.html | Learning loops and memory proposals (`?view=self`) |
| page-settings | settings.html | Five-provider sign-in, agents, keys, server (`?provider=`) |
| page-configs | engagements.html | Workflow presets and runbooks (`?view=configs`) |
| page-about | about.html | Brief, contract, live snapshot |
| specialist hats (Phase 6) | operators.html | Hats panel: all six hats from `/api/operators/prompts`, grant slices from `/api/teams/tool-grants`, per-hat dispatch via `POST /api/operators/spawn`; shares the roster search/team filter |
| color suites (Phase 20) | defend.html | Defense posture from the color GET routes: blue gap matrix (`?coverage=none\|partial\|covered` filter), black noise budget, white evidence-chain audit, white report audit; read-only, honest empty states |

## Navigation contract

- Persistent nav on every page with deep links of the form `/ui/<page>.html`.
- The active link carries `aria-current="page"`; all links are keyboard
  reachable and show the shared focus ring.
- Legacy in-app destinations (`warroom`, `live-scan`, `receipts`, `operators`,
  `evidence`, `arsenal`, `terminal`, `benchmarks`, `ctf-range`, `general`,
  `selfimprove`, `configs`, `settings`, `about`) resolve through
  `Shell.navigateTo`, which maps each id onto its new page.
- Filters and selection persist in query params; back and forward buttons
  restore them via a `popstate` re-render on each page.
- Every dynamic section ships four states: loading skeleton, empty state with
  a primary action, error state with retry, and success feedback. No page
  renders blank while data is pending or missing.
- The server contract is frozen: pages call the same API paths and payload
  shapes the old UI used. No route was added, renamed, or reshaped.
