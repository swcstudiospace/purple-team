# Phase 27 Plan 05: Load Hat Prompts and Retarget Specialist Wrappers Summary

One-liner: Hat prompts and playbook briefings loaded into the operator path; six specialist wrappers delegate to staged workflow exports with honest standing.

## Objective

Close the registered-and-loaded parity loop: import the dormant blue/black/white
prompt modules and P1 briefing helpers into `src/prompts/index.ts`, retarget the
six hat wrappers in `src/teams/hats.ts` onto the wave-1 workflow exports, register
only real exports in `src/arsenal/adapter-tools.ts`, join staged coverage in
`src/teams/purple.ts`, and move the egress pin honestly.

## Changes

- `src/prompts/index.ts`
  - Imports `prompts/blue.ts`, `prompts/black.ts`, `prompts/white.ts` (parent plus
    specialist blocks) into the loaded `OPERATOR_SYSTEM_PROMPTS` path via
    `<dedicated-hat-guidance>` sections on all nine hat-family entries.
  - Loads `aiDefenseBriefing`, `aiTradecraftBriefing`, `aiAdjudicationBriefing`
    into the operator path: full briefing text embedded in the blue/black/white
    parent prompts, plus an exported `operatorPlaybookBriefing(archetype)`
    dispatcher. `server.ts` / `mcp-server.ts` untouched.
- `src/teams/hats.ts`
  - `specterCoverReview`: delegates boundary verdicts to `runBlackWorkflow()`;
    fixed the empty-plan `0 >= 0` blown comparison (`actions.length > 0` guard);
    empty plans are insufficient/fragile, never blown or holds.
  - `wraithExfilSim`: costs/tiers/feasibility/standing from `exfilCostModel()`;
    new `standing` (`declared`/`modeled`/`unverified`/`verified`) plus optional
    `routeEvidence` input; `egressVerified` true only on observed route evidence.
    The string-verifies-egress lie is gone.
  - `sentinelDetectorMap`: optional artifact stage binding routes gaps through
    `runBlueDetectionStage()` with `detectionStatus`/`limitations`; unbound
    calls keep the `detectionGaps()` engine (id overlap alone is not coverage).
  - `wardenHardeningReview`: optional item-linked evidence resolves through
    `runBlueRetestStage()`; fresh items stay open; prose alone never retests.
  - `arbiterDispute`: disputes paired per action via `pairDisputeRulings()` with
    `paired`/`insufficient` status; one-sided rows are insufficiency, ROE still
    decides the ruling, appeal paths preserved.
  - `auditorScore`: exposes `standing` from `aggregateEvidenceStanding()`; any
    insufficient row withholds sufficiency and caps the score below 100.
  - Re-exports the six staged workflow functions for Phase 28 (no HTTP/MCP here).
- `src/teams/purple.ts`: `synthesize()` accepts `CoverageGap` rows alongside
  `DetectionGap` rows, joined by finding id; Purple stays synthesis-only.
- `src/arsenal/adapter-tools.ts`: sigma/yara register as explicit-unavailable
  tools (fail closed inside the call with install hint, never spawn);
  osquery/suricata/caldera stay null via `isMintable`; no catalog stubs minted.
- `src/__tests__/hats-modules.test.ts`: egress pin moved to the standing
  contract (`modeled` + `egressVerified: false` on a bare string; new test proves
  `verified` + `true` only with observed route evidence). No pin deleted.

## Verification

- `npx tsc --noEmit`: clean.
- Required suites (hats-modules, hats-archetypes, blue/black/white-suite):
  5 files, 145 tests, all passed.
- Neighbors (teams-archetypes, hats-integration-static, grokbot-hats, three
  playbook suites; five arsenal suites): all passed (70 + 90 tests).

## Deviations from Plan

None — plan executed as written. One auto-fix during execution: the staged
black workflow refuses the `zero-day exploit …` fixture as an unapproved probe,
and an initial mapping of that refusal to `blown` moved a pinned `fragile`
verdict; narrowed `blown` to destructive tradecraft only so the pin holds while
the refusal stays flagged. No scope change.

## Threat Flags

None — no new endpoints, auth paths, or trust-boundary crossings; unavailable
entries fail closed and never spawn.
