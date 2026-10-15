# Phase 28 changed-control observation

**Recorded:** 2026-10-15
**Browser:** Playwright Chromium 1248, headless, `prefers-reduced-motion: reduce`
**Server:** `http://127.0.0.1:3333` (`tsx src/server.ts`), pages under `/ui/`
**Viewports:** 1280×900 and 390×844

This record covers the Phase 28 staged controls only. Full integrated four-discipline security, Red regression, and milestone acceptance stay in Phase 29.

## Keyboard and focus

Tab from the top of each page lands on the skip link and nav links. Those links show `outline: solid 2px`.

Direct focus of the staged controls, after the focus-visible rule landed:

| Page | Control | Tag | Label | Focused outline |
|---|---|---|---|---|
| operators | opBlueFinding | INPUT | Finding id | solid 2px rgb(26, 26, 26) |
| operators | opBlueStageSubmit | BUTTON | Score | solid 2px |
| operators | opBlueStageRetry | BUTTON | Retry | solid 2px |
| mission | missionStageId | INPUT | Mission id | solid 2px |
| arsenal | arsenalCoverageFinding | INPUT | Finding id | solid 2px |
| overview | overviewStageHat | SELECT | Hat | solid 2px |
| overview | overviewStageSubmit | BUTTON | text "Stage" | solid 2px |
| defend | coverageFinding | INPUT | Finding id | solid 2px |

Before that rule, inputs computed `outline-style: none` and no shadow change. Buttons already had a solid 2px ring. The rule is pinned in `src/__tests__/phase28-staged-consumers-a11y.test.ts`.

## Fail-closed announcements

Quoted from the live region after a click on the submit button:

- operators Blue, empty artifact bytes: `Origin POST /api/teams/blue/coverage: fail-closed: Missing artifact: no artifact id or artifact bytes were supplied, so the stage fails closed. No finding is covered.`
- operators Black, empty plan: `Origin POST /api/teams/black/workflow: insufficient. Effects: 0. empty plan: no actions or paths supplied, nothing to analyze. not a clean bill.`
- operators White, ROE text `scope: none`: `Origin POST /api/teams/white/stage: violation. An approved flag alone is not a receipt.` The server returned `ok: true` with verdict `violation` because the target was outside an empty allow-list. That is not compliant. A blank ROE body returns `ok: false`, `reason: roe-parse-failed`, not a permissive start.
- mission Black: `Origin POST /api/teams/black/workflow: mission ui-mission: insufficient. Effects: 0. not a clean bill`
- mission White: `Origin POST /api/teams/white/stage: mission ui-mission: violation. An approved flag alone is not a receipt.`
- arsenal, empty bytes: origin-labeled `insufficient-evidence` / fail-closed, never covered.
- overview Blue, empty bytes: `Origin POST /api/teams/blue/coverage: insufficient-evidence fail-closed`
- index Black, one action: `Origin POST /api/teams/black/workflow: complete` — a supplied action is an analysis, not an empty-plan clean bill.
- defend Black, empty plan: `Black outcome: insufficient. Effects: 0.` The older defend handler does not prefix `Origin POST`. Operators, mission, arsenal, and overview do.

No staged submit minted a receipt or dispatched a Purple proposal.

## Responsive and reduced motion

At 390×844 every staged form remained reachable. Measured widths were 324px, inside the viewport, with no horizontal clip of the submit control. `matchMedia('(prefers-reduced-motion: reduce)')` was true. Status text updated in the polite live region with no animation dependency.

Screenshots from the walk are local observation artifacts under `/tmp/p28-shots/` and are not product files.

## Phase 29 boundary

Not observed here: credential-isolated hostile input matrix, keyboard-only operation of every legacy Red control, full reduced-motion audit of unrelated pages, or owner acceptance of remaining adoption blockers.
