# Phase 21: Retroactive Validation (Phases 15–20) - Research

**Researched:** 2026-10-12
**Domain:** Evidence-quality engineering — State-B retroactive validation of six archived v1.3 phases (test-only probes, template-shaped VALIDATION.md, Nyquist promotion, supersession log)
**Confidence:** HIGH (command inventory and pin coverage are file:line-verified in-repo; probe-green predictions are code-read + one live runtime eval; re-audit tooling behavior against an archived milestone is the main assumption)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sequencing and boundary**
- VAL-01 runs FIRST in the milestone, against the frozen v1.3 boundary; no v1.4 code change may land before its evidence exists
- Evidence must describe code that existed at `4c37232`/milestone start — State-B reconstruction, no invented wave-0 history
- Later v1.4 phases (22, 23, …) that mutate phase-15–20 surfaces append to the supersession log with the update rule stated in Phase 21's own VALIDATION/log artifact

**Evidence quality (anti evidence-theater)**
- Per-Task Verification Map ties every phase requirement to a command ACTUALLY RUN GREEN during this pass — never a restatement of v1.3 gate tables
- ≥1 class-level negative probe per phase probing the BUG CLASS, not the fixed instance (e.g. `roeAudit(actions, {})` must never be all-compliant — the allowedTargets silent-permissiveness class); probes committed separately from docs commits
- Nyquist gap tests committed separately from the VALIDATION.md docs commit
- Bench-fixture oracles (bent twice in v1.3) are RE-JUSTIFIED (cite original incident + pin rationale), not silently re-run
- Unautomatable requirements escalate to an honest Manual-Only table, never papered over

**Fixture re-justification protocol (conservative default)**
- An oracle change is legitimate only with a written rationale citing the incident that bent it plus a pin that would catch a future silent bend; otherwise the oracle is treated as frozen ground truth
- Nyquist gap-filling scope: new tests only where a requirement cell has NO automated command; everything else lands in Manual-Only

### Claude's Discretion
- Exact probe selection per phase and gap-test placement, within the class-level rule above

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (ROE-01 action-source and route-shape choices belong to Phase 22 planning.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VAL-01 | Each v1.3 phase dir 15–20 carries `NN-VALIDATION.md` whose Per-Task Verification Map ties every phase requirement to a command actually run green during the pass, with ≥1 class-level negative probe per phase, an honest Manual-Only table, State-B dating, and a supersession log later v1.4 phases update | Per-Phase Requirement → Evidence Map (below) names the runnable command for every v1.3 criterion; probe candidates designed and (for the flagship) runtime-verified; supersession log format + update rule proposed; re-audit flip mechanics documented from audit-milestone §5.5 |
</phase_requirements>

## Summary

Phase 21 is an evidence pass, not a code pass. The repo is already shaped for it: every one of the 22 v1.3 success criteria (v1.3-ROADMAP.md phase sections) is evidenced today by an existing automated command — the six suites (`blue/black/white-suite.test.ts`, `purple-v2.test.ts`), the three deterministic benches, the static pin family (routes/gateway/counts/guards), and the gate spine (`test:pr`/`test:release`, `package.json:81,84`). The research found **no criterion with zero automated coverage**; what is missing is (a) live-HTTP and browser-render cells that no test harness exists for (the repo deliberately avoids importing `server.ts` in vitest — `vitest.config.ts:8`), which escalate to honest Manual-Only, and (b) the class-level negative probes, of which only some classes are already pinned. The flagship probe named in VAL-01 is real and green today: `roeAudit(mixedActions, {})` returns `["needs_approval","compliant"]` — *never all-compliant* because the approval axis still fires under an empty spec (`src/teams/white.ts:40,46` short-circuits scope, `:66-73` keeps needs_approval) — runtime-verified this session via `npx tsx`.

The honest end state of the re-audit is **`not_validated_phases: []`**, with phases 15/19/20 expected in `partial_phases` (they have genuine Manual-Only cells) and 16/17/18 candidates for `compliant_phases` — per audit-milestone §5.5, `nyquist_compliant: true` requires *zero* manual escalations, so the planner must NOT chase `compliant` for phases with live-render cells. Papering those over to flip `overall` green is precisely the evidence-theater failure this phase exists to kill.

**Primary recommendation:** One new test file (`src/__tests__/v13-class-probes.test.ts`) holding all six class-level probes, committed as `test(...)` before any docs commit; then one template-shaped `NN-VALIDATION.md` per archived phase dir whose Per-Task Verification Map rows each cite a command executed during this pass (re-run, dated, measured counts — never restated v1.3 numbers); open `.planning/milestones/v1.3-phases/SUPERSESSION.md` with its update rule; re-justify the two bent fixtures as written records citing `v1.3-STATE.md:44` and the phase SUMMARYs; finish by applying the §5.5 rule to `.planning/v1.3-MILESTONE-AUDIT.md`'s `nyquist:` block.

## Boundary Receipt (verified this session)

- `git diff --stat 4c37232..HEAD -- src scripts package.json docs Dockerfile` → **empty**; the only commits since `4c37232` are planning docs (`.planning/**`). HEAD is `da8e070`. [VERIFIED: git, 2026-10-12]
- Consequence: evidence gathered **now** describes the v1.3 boundary exactly. Recommended pre-flight receipt for each VALIDATION.md: record the empty-diff command + HEAD sha at run time.
- Pre-flight guard for the whole phase: if any commit lands on `src/` (non-test) before the evidence pass completes, the boundary is broken — stop and re-scope.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Engine honesty probes (empty-spec, unmatched-input, lookalike-id) | Pure engine tier (`src/teams/**`) | vitest suite | Engines are pure/I-O-free; probes assert their fail-closed semantics directly |
| Route/skill/MCP wiring evidence | Static pin tests (source-reading) | Manual-Only (live HTTP) | Repo convention: routes are pinned by reading `server.ts` source in `*-routes-static.test.ts`; live HTTP has no harness by design |
| Corpus/oracle evidence (3 benches) | Bench scripts over `dist/` | CI pin tests (`*-bench.test.ts`) | Benches import the real `dist/` pipeline (`detection-coverage-bench.mjs:31,47`); `npm run build` is the prerequisite |
| Validation records + audit state | Planning artifacts (`.planning/**`) | gsd tooling (`validate-phase`, `audit-milestone §5.5`) | VALIDATION.md frontmatter is what §5.5 reads; the audit YAML block is the mutable stored claim |
| Supersession tracking | Append-only log file | Later phases' commits | Single stable path beats six per-phase edits; VALIDATION.md files stay frozen post-validation |

## Standard Stack

Nothing new — the phase runs entirely on the existing, host-verified toolchain. No new packages, no new test frameworks (REQUIREMENTS.md Out-of-Scope: "no new test/coverage frameworks"). [VERIFIED: REQUIREMENTS.md Out of Scope; .planning/research/SUMMARY.md §Recommended Stack]

| Tool | Version | Role in this phase | Evidence |
|------|---------|--------------------|----------|
| vitest | 4.1.9 | Runs all suites; auto-picks up new probes via `include: ['src/**/*.test.ts']` | `vitest.config.ts:17` [VERIFIED] |
| eslint (flat) | 9.39.2 | `npm run lint` = `eslint src/**/*.ts` — **includes `src/__tests__/**`**: new probe files must land with zero net-new warnings | `package.json:88` [VERIFIED] |
| tsc | 5.9.3 | `typecheck` gate; also compiles `src/__tests__` into `dist/__tests__/` (384 files exist today — established convention, not a pin) | `package.json:20,89`; `tsconfig.json` `include: ["src/**/*"]` [VERIFIED] |
| benches | 3 scripts | Phase 16/18/19 corpus evidence; deterministic self-test default, `dist/`-backed, throw without build | `package.json:47-49`; `detection-coverage-bench.mjs:47` [VERIFIED] |
| gsd tooling | `validate-phase` workflow, `audit-milestone` §5.5, `verification.append-audit` | VALIDATION.md contract + audit flip semantics | `$HOME/.agents/gsd-core/workflows/{validate-phase,audit-milestone}.md` [VERIFIED: read this session] |

**Installation:** none. `npm ci` only.

## Package Legitimacy Audit

**None.** Phase 21 installs zero packages (milestone constraint: no new runtime dependencies, no new test tooling). No registry checks required; no [SUS]/[SLOP] surface exists.

## Per-Phase Requirement → Evidence Map

The authoritative requirement set per phase is the **Success Criteria block in `.planning/milestones/v1.3-ROADMAP.md`** (v1.3 had no REQUIREMENTS.md — `v1.3-MILESTONE-AUDIT.md`: "Coverage is measured against the six roadmap success-criteria blocks"). Commands below are what the executor ACTUALLY RUNS during Phase 21; every row must be executed fresh (measured results, dated), never copied from v1.3 gate tables. Quick form: `npx vitest run src/__tests__/<file>.test.ts`. All file:line citations verified this session.

### Phase 15 — Blue Suite Core (`15-blue-suite-core/`)

| Criterion (v1.3-ROADMAP §Phase 15) | Automated command (run green this pass) | Pin/live citation | Disposition |
|---|---|---|---|
| C1: `detection` adapters honest; every granted id resolves | `npx vitest run src/__tests__/adapter-tools.test.ts src/__tests__/arsenal-count-honesty.test.ts` | count pins 120 [VERIFIED: 19-01-SUMMARY]; grant ⊆ catalog invariant | Automated |
| C2: `GET /api/teams/blue/rules` returns valid Sigma YAML keyed to D3FEND ids | `npx vitest run src/__tests__/blue-suite.test.ts src/__tests__/blue-routes-static.test.ts` | deterministic YAML + fields `blue-suite.test.ts:100`; no rule for keyless/covered `:128`; route wires `sigmaRulepack(`+`coverageGaps(` `blue-routes-static.test.ts:47-49` | Automated (engine + static); **live HTTP cell → Manual-Only** (no server harness exists) |
| C3: Loopback unchanged; new routes honor origin/bearer guards | `npx vitest run src/__tests__/local-api-hardening-static.test.ts src/__tests__/remote-access-guard.test.ts` | existing suites green | Automated |
| C4: vitest + typecheck green; static pins updated | `npm run typecheck` + targeted vitest + `npm run lint` (report measured count) | gates `package.json:88,89` | Automated |

### Phase 16 — Blue Playbook & Bench (`16-blue-playbook-bench/`)

| Criterion | Automated command | Citation | Disposition |
|---|---|---|---|
| C1: Bench self-test passes, decoy penalties active, report JSON emitted | `npm run build` then `node scripts/detection-coverage-bench.mjs` + `npx vitest run src/__tests__/detection-coverage-bench.test.ts` | 5-invariant pin `detection-coverage-bench.test.ts:17,23,28,34,48`; harness fails closed without dist `detection-coverage-bench.mjs:47` | Automated |
| C2: Playbook briefs via resources pattern | `npx vitest run src/__tests__/ai-defense-playbook.test.ts` | unknown-id rejected `:36` | Automated |
| C3: Skills grammar intact; index rows paired | `npx vitest run src/__tests__/grokbot-hats.test.ts src/__tests__/hats-integration-static.test.ts` | existing suites | Automated |
| C4: MCP registers via loopback/bearer path, no child processes | `npx vitest run src/__tests__/grokbot-gateway.test.ts` | tool-count pins `grokbot-gateway.test.ts:109-118` | Automated; **end-to-end Grok relay → Manual-Only** (external service) |

### Phase 17 — Black Suite Core (`17-black-suite-core/`)

| Criterion | Automated command | Citation | Disposition |
|---|---|---|---|
| C1: Noise budget quantifies per action (numbers, not prose) | `npx vitest run src/__tests__/black-suite.test.ts` | recon-low `:72`, rm-rf-high + anti-forensics refusal `:87`, determinism `:104`, exfil tiers `:114`, unknown-channel fallback `:133`, unknown phase throws `:162`, empty-plan honest `:183` | Automated |
| C2: Black grants disjoint from blue/white | `npx vitest run src/__tests__/adapter-tools.test.ts src/__tests__/arsenal-count-honesty.test.ts` | disjointness invariant (117→120 history) [VERIFIED: 17-01-SUMMARY] | Automated |
| C3: Routes behind guards; vitest + typecheck green | `npx vitest run src/__tests__/black-routes-static.test.ts` + typecheck + lint | static route/guard pins | Automated; **live HTTP → Manual-Only** |

### Phase 18 — Black Playbook & Bench (`18-black-playbook-bench/`)

| Criterion | Automated command | Citation | Disposition |
|---|---|---|---|
| C1: Bench self-test passes; decoy plans penalized | `npm run build` then `node scripts/opsec-review-bench.mjs` + `npx vitest run src/__tests__/opsec-review-bench.test.ts` | benign decoys never flagged `opsec-review-bench.test.ts:62`; real pipeline matches ground truth `:57`; deterministic `:68`; harness fail-closed `opsec-review-bench.mjs:53` | Automated |
| C2: Skills wired without breaking grammar | `npx vitest run src/__tests__/grokbot-hats.test.ts src/__tests__/hats-integration-static.test.ts` | existing suites | Automated |
| C3: MCP registers through loopback/bearer path | `npx vitest run src/__tests__/grokbot-gateway.test.ts` | gateway pins | Automated; **end-to-end relay → Manual-Only** |

### Phase 19 — White Suite (`19-white-suite/`)

| Criterion | Automated command | Citation | Disposition |
|---|---|---|---|
| C1: ROE parser → structured `RoeSpec`, honest parse-failure | `npx vitest run src/__tests__/white-suite.test.ts` | per-line accounting `:8`; conflict withholds ok `:38`; every unhonored line reported `:53`; empty/comment-only honest `:75` | Automated |
| C2: Evidence-chain consumes the real receipt ledger, not mock data | `npx vitest run src/__tests__/white-suite.test.ts src/__tests__/white-routes-static.test.ts` | chain semantics `white-suite.test.ts` (replay-hook, duplicate-id, provenance tests); route reads ledger read-only `white-routes-static.test.ts:52-58` | Automated (semantics + static); **live ledger over HTTP → Manual-Only** |
| C3: ROE bench passes; routes/skills/MCP live; vitest + typecheck | `npm run build` then `node scripts/roe-adjudication-bench.mjs` + `npx vitest run src/__tests__/roe-adjudication-bench.test.ts src/__tests__/white-routes-static.test.ts` | honesty axes `roe-adjudication-bench.test.ts:49`; verdicts match `:92`; decoys `:97`; deterministic `:103`; honesty pin "no ROE text on record" `white-routes-static.test.ts:61-67` | Automated; live e2e → Manual-Only |

### Phase 20 — Purple v2 & Defend UI (`20-purple-v2-defend-ui/`)

| Criterion | Automated command | Citation | Disposition |
|---|---|---|---|
| C1: id-keyed correlation pinned (shuffled order joins) | `npx vitest run src/__tests__/purple-v2.test.ts` | join regardless of map order `:37`; id wins over opposite positional story `:48`; no entry carries no verdict `:60`; fallback declared `:78`; empty map still id-mode `:90`; 16-row tier table incl. missing/unknown severity → medium `:128-153` | Automated |
| C2: Defend page renders gap matrix from live routes; pins updated | `npx vitest run src/__tests__/ui-inline-scripts-parse.test.ts src/__tests__/tauri-scaffold-static.test.ts` | asset pins + parse gates (43/43 on touched suites per 20-01-SUMMARY) | Automated (static); **browser render against live server → Manual-Only** |
| C3: All gates green; ROADMAP/STATE reflect completion | `npm run test:pr` + `npm run doctor` + `npm run prompt:audit` (measured, this pass) + prose pins `teams-modules.test.ts:248-255` | full gate table exists in 20-01-SUMMARY — restate is forbidden; re-run is the evidence | Automated (gates); archival-accuracy inspection → Manual-Only |

**Nyquist gap verdict (research question 3):** every criterion has an automated command for its *semantics*; the only genuinely unautomated cells are **live-HTTP route behavior, live receipt-ledger HTTP, browser render, external Grok relay end-to-end, and archival-accuracy inspection**. Adding a server-integration harness would require new test infrastructure (Out of Scope: "no new test/coverage frameworks") and importing side-effectful `server.ts` into vitest (`vitest.config.ts:8` comment shows that file is deliberately excluded from coverage — convention: don't import it). **Minimal gap-test set = the six class-level probes below; everything else escalates to Manual-Only.**

## Class-Level Negative Probes (research question 2)

One per phase, probing the bug CLASS (silent permissiveness / invented-id acceptance / vacuous green), not the fixed instance. All are new pins (none duplicate an existing test — checked against the suites' full test-name listings). Recommended home: **one new file `src/__tests__/v13-class-probes.test.ts`** (auto-discovered by `vitest.config.ts:17`, linted by `package.json:88`). Probe-green status: P19 is **runtime-verified** (live `npx tsx` eval, this session); P15/P16/P17/P20 are code-read-verified against the cited engine lines — executor confirms each green at first run; a red probe is a FINDING (escalate, never weaken the engine to make it pass — that would be a src change, out of scope).

| Phase | Probe (assertion) | Why it's the class | Engine semantics (citation) | Predicted green |
|---|---|---|---|---|
| 15 | Lookalike/id-prefix D3FEND keys: `coverageGaps([{id:'F-X', countermeasures:['D3-PA','D3-P']}], [{source:'edr-process', countermeasures:['D3-PA']}])` → `'D3-P'` lands in `unresolvedCountermeasures`, coverage math uses only resolved ids, recommendation appends the "reported, not used" suffix | Invented/lookalike ids must surface and never silently count as coverage — the invented-id class the bench decoys sample at corpus level | exact key lookup `coverage.ts:126`; unresolved never dropped `:93-94,123-131` | HIGH (code-read) |
| 16 | Bench harness fails closed: static pin asserting `scripts/detection-coverage-bench.mjs` contains the dist-missing throw + `dist/teams/blue` import (never vendored logic) | "Bench silently measuring a vendored/stale copy" — the validation-theater class | `detection-coverage-bench.mjs:31,47` | HIGH (static pin over existing text) |
| 17 | Unmatched-input honesty: `structuredNoiseBudget({actions:['totally-unmatched-action'], egress:['egress.internal:443']})` → entry cost 0 AND rationale contains the engine's own honesty string `unmatched is not safe` | Unknown input must never be scored as *safe/silent* — the absent-signal class in black's direction | noise.ts emits `'0 = no vocabulary match (unmatched is not safe — run coverAudit)'` for zero matches [VERIFIED: `src/teams/black/noise.ts:199-201` region] | HIGH (code-read) |
| 18 | Bench harness fails closed (black twin of P16): static pin on `scripts/opsec-review-bench.mjs` dist-guard + `dist/teams/black` imports | Same vendored-copy class, black bench | `opsec-review-bench.mjs:33,53` | HIGH (static pin) |
| 19 | **Flagship:** `roeAudit(mixedActions, {})` never all-compliant — mixed set incl. one active unapproved action → verdicts contain `needs_approval` (never all `compliant`); plus minimal-but-explicit spec `{allowActive:false}` still yields `violation` on approved active work; plus `parseRoe('')` → `ok:false` | THE allowedTargets silent-permissiveness class: an empty/absent ROE signal can never green-light a plan wholesale — active work always needs approval; explicit prohibition still binds; absent text never parses | scope short-circuit `white.ts:40,46`; approval axis `:66-73`; allowActive violation `:59-64`; parser fail-closed doctrine `roe-parser.ts:14-19` | **VERIFIED — live eval this session:** `["needs_approval","compliant"]`; `["violation"]`; `ok:false` ("no ROE directives found in the text") |
| 20 | Orphan-verdict isolation: `synthesize` with `verdictsByFinding` containing keys matching no finding id → every coverageMatrix row (riskTier + residualRisk) byte-identical to the run without the orphans | Correlation cannot be inflated/shifted by verdicts for nonexistent findings — the join-by-coincidence class (positional-bug's cousin) | findings drive the row map; verdict lookup is per-finding-id only, orphans never read [VERIFIED: `src/teams/purple.ts` synthesize body] | HIGH (code-read) |

**Commit discipline (locked):** probes/gap tests land in a `test(...)` commit (or per-phase test commits) that precedes the corresponding `docs(...)` VALIDATION.md commit — mirroring validate-phase §7. Single-file probes commit is acceptable; the rule is test-commit-before-docs-commit, never mixed.

## Bench-Fixture Re-Justification Records (research question 4)

The two v1.3 bends are **test fixtures** (not bench corpus): "test fixture corrected to v1 semantics twice (coverage tiers, target extraction) — the pins now document actual engine contracts" [VERIFIED: `.planning/milestones/v1.3-STATE.md:44`]. Re-justification = a written record inside the affected VALIDATION.md (incident → why the fixture was wrong, not the engine → the pin now guarding the contract). Both records:

1. **Coverage tiers** (Phase 15): incident — a `blue-suite` fixture assumed uncovered-with-telemetry ≠ partial; corrected during verification to the documented contract "uncovered-with-telemetry = partial; 'none' requires empty telemetry" [VERIFIED: 15-01-SUMMARY.md §Tests]. Legitimacy: the fixture contradicted the documented contract, not vice versa. Guarding pins today: `blue-suite.test.ts:42-49` (empty telemetry → 'none'; deployed-but-uncovering → 'partial') and `:60-68` (keyless fallback says so). Re-justification verdict: **legitimate oracle correction — contract-first, pin-guarded.**
2. **Target extraction** (Phase 19): incident — a fixture assumed command-embedded targets were scope-judged; v1 `roeAudit` reads `action.target` only; fixture corrected to carry the target explicitly [VERIFIED: 19-01-SUMMARY.md §Verification]. Legitimacy: fixture encoded behavior the engine never had. Guarding pins today: `white-suite.test.ts:93` ("hands parseRoe output straight to roeAudit and rules per action") + the bench's suffix-vs-lookalike class cases. Re-justification verdict: **legitimate oracle correction — pin-guarded.**

Distinct and NOT bends (do not confuse): phase 18's three hand-computation traps were ground-truth authored by probing the real engines (ground truth corrected toward engine reality, pinned by `opsec-review-bench.test.ts:57`) [VERIFIED: 18-01-SUMMARY.md]; the phase-19 `allowedTargets` bug was an ENGINE defect caught by the bench and fixed in the engine — the oracle was right. Bench corpus files (`bench/**`) are frozen this phase: no edits, no re-bending; benches are re-RUN as evidence, their oracles cited as re-justified-by-record.

## Supersession Log (research question 5)

**Proposal: single append-only file at `.planning/milestones/v1.3-phases/SUPERSESSION.md`** (the archived-milestone root, beside the six phase dirs it governs). Single-file beats per-phase entries: one stable path for phases 22–25 to append to (CONTEXT names Phase 22 criterion 5 and Phase 23 criterion 4 as appenders), no risk of an appender picking the wrong of six files, and the update rule lives in exactly one header. [ASSUMED: location preference — reversible; planner may confirm]

```markdown
# v1.3 Validation Supersession Log

Append-only. Rule: any post-Phase-21 v1.4 commit whose diff touches a file named in a
NN-VALIDATION.md Per-Task Verification Map MUST append one row in the SAME commit,
citing the new green command that re-evidences the mutated surface. The NN-VALIDATION.md
files themselves are never edited after validation — they describe the 4c37232 boundary;
this log is how readers know what has moved since.

| Date | v1.4 Phase (req) | Mutated surface (files) | Validation affected | New evidence (command → result) | Commit |
|------|------------------|-------------------------|---------------------|---------------------------------|--------|
```

Each VALIDATION.md carries a one-line footer pointing at the log ("Supersessions: see SUPERSESSION.md — this file describes the 4c37232 boundary"). Update rule is thereby stated in Phase 21's own artifact, satisfying the locked decision.

## Re-Audit Mechanics (research question 6)

Source: `$HOME/.agents/gsd-core/workflows/audit-milestone.md` §5.5 [VERIFIED: read this session]. Classification per phase dir, from `NN-VALIDATION.md` frontmatter:

| §5.5 Class | Condition |
|---|---|
| COMPLIANT | `status: validated` **and** `nyquist_compliant: true` and all tasks green |
| PARTIAL | `status: validated` and (`nyquist_compliant: false` or red/pending rows) |
| NOT-VALIDATED | `status: draft` (or file absent) |
| MISSING | no VALIDATION.md |

Mechanics for the flip:
1. validate-phase State B ("VALIDATION_FILE empty, SUMMARY_FILES non-empty") is exactly this phase's input state; its §6 contract sets **`status: validated`** and fills Test Infrastructure / Per-Task Map / Manual-Only / Sign-Off. `nyquist_compliant: true` is set **only when no gaps were escalated** — validate-phase routes Manual-Only escalations to the PARTIAL result ("PHASE {N} VALIDATED (PARTIAL): {M} automated, {K} manual-only").
2. §5.5 is **discovery-only** ("never auto-calls /gsd:validate-phase") — the audit reads frontmatter and rewrites the `nyquist:` YAML block (`compliant_phases`, `partial_phases`, `not_validated_phases`, `missing_phases`, `overall`).
3. Success criterion 3 ("empties the `not_validated` block") is therefore met by: every NN-VALIDATION.md at `status: validated` + a re-audit pass applying §5.5 to `.planning/v1.3-MILESTONE-AUDIT.md` (its frontmatter currently: `not_validated_phases: ["15"…"20"]`, `overall: not_validated` [VERIFIED: audit frontmatter]).
4. **Expected honest end state:** `not_validated_phases: []`; `partial_phases` ⊇ {15, 19, 20} (genuine live-HTTP/render/inspection cells); 16/17/18 plausibly `compliant_phases` if their Manual-Only cells stay empty; `overall: partial` (or better only if truly zero manual cells). Chasing `compliant` for 15/19/20 by hiding manual cells is the evidence-theater anti-pattern — the planner must plan for honest PARTIAL.
5. `wave_0_complete` stays `false` in all six files — State-B reconstruction must not fabricate wave-0 history (locked).
6. Open item: whether `gsd-audit-milestone` can target an **archived** milestone's phase dirs or only the active milestone. [ASSUMED] If it cannot, apply §5.5's deterministic rule manually to the v1.3 audit file, citing each VALIDATION.md frontmatter as the receipt — the classification is a pure function of the frontmatter, so a manual application with receipts is faithful. Confirm at execution; either path satisfies criterion 3.

## What Phase 21 Must NOT Do (research question 7)

- **No `src/` changes except new test files.** Probes are tests only. Confirmed safe: static pins read *source* files (not test files); count pins (`arsenal-count-honesty`, gateway `TEMPEST_TOOLS.length`, `grokbot-gateway.test.ts:109-118`) enumerate runtime exports, not test counts; vitest auto-discovers `src/**/*.test.ts` with zero config change [VERIFIED: `vitest.config.ts:17`]. tsc already compiles `__tests__` into `dist/__tests__/` (384 files today) — adding test files continues an existing convention, refreshed by `npm run build`; not a pin surface.
- **Do not import `src/server.ts` in probes** — side-effectful (binds listeners); the repo's own coverage config excludes it by comment `vitest.config.ts:8`. Route evidence stays static-pin + Manual-Only.
- **No bench corpus/oracle edits** (`bench/**` frozen), no `:live` bench variants (network), benches run in deterministic self-test default only.
- **No edits to `eslint.config.js`, `package.json` scripts, tsconfig, vitest configs.** New test files must be **warning-clean**: `lint` covers `src/__tests__/**` and the milestone rule is zero net-new warnings (177 current, ≤176 is Phase 25's re-baseline) [VERIFIED: 20-01-SUMMARY gate table; ROADMAP milestone constraints].
- **No restating v1.3 gate tables** — every map row cites a command run during this pass with its fresh measured result (incl. the running lint count in the phase gate table).
- **No editing NN-VALIDATION.md after its docs commit** — corrections route through the supersession log, same as later phases.
- No work on ROE-01/UNIFY-01 concerns (ROE store, prose/tier unification) — Deferred/other phases.

## Architecture Patterns

### Evidence-flow diagram (the phase's data flow)

```
v1.3 criteria (v1.3-ROADMAP §Phase 15–20)
        │  map 1:1
        ▼
Per-Task Verification Map rows  ──each row──▶  command RUN THIS PASS (vitest / bench / gate)
        │                                              │
        │                                              ▼
        │                                     measured result + date (receipt)
        ▼                                              │
class-level probes (new test file) ──commit──▶  NN-VALIDATION.md (status: validated,
        │  test-commit BEFORE docs-commit        honest nyquist_compliant, Manual-Only table,
        ▼                                        State-B dating, fixture re-justification)
SUPERSESSION.md opened (update rule) ◀──footer pointer──┘
        │
        ▼
§5.5 re-audit: frontmatter ▶ nyquist YAML rewrite in v1.3-MILESTONE-AUDIT.md
   (not_validated_phases: [], honest compliant/partial split)
```

### Pattern 1: State-B reconstruction dating
**What:** VALIDATION.md `created:` = actual run date; every evidence row dated; explicit note that this is a State-B reconstruction of a completed phase against boundary `4c37232` (empty-diff receipt).
**When to use:** every one of the six files.
**Example:** frontmatter from the template (`$HOME/.agents/gsd-core/templates/VALIDATION.md`): `status: validated`, `nyquist_compliant: <honest>`, `wave_0_complete: false`, `created: <run-date>`. Never claim plan-time seeding.

### Pattern 2: falsifier statement per phase
**What:** each VALIDATION.md names what observation would have failed the phase (the anti-rubber-stamp floor from PITFALLS §1: "no statement of what evidence would have failed" is a warning sign).
**When to use:** Summary/Sign-Off section of each file. Example (P19): "Falsifier: `roeAudit(activeActions, {})` returning any `compliant` verdict for unapproved active work."

### Anti-Patterns to Avoid
- **Rubber-stamping:** copying v1.3 SUMMARY gate numbers into the map — validation without new information.
- **Vacuous green:** probes that sample zero adversarial cases (house anti-vacuity floor lives in `oracle-consistency.test.ts:83` pattern).
- **Chasing nyquist_compliant:true** by reclassifying Manual-Only cells as automated or dropping them.
- **Mixed commits:** test + docs in one commit (locked separation).
- **Oracle re-bending:** "re-running until green" on bench fixtures instead of the written re-justification record.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Requirement→test mapping | custom tracker script | validate-phase §2b map + the table in this research | already the tooling's native shape |
| Bench execution/oracles | new harness | the 3 existing benches + their CI pin tests | deterministic, `dist/`-backed, decoy-penalized, already pinned |
| Audit classification | new scoring tool | audit-milestone §5.5 rule (pure function of frontmatter) | deterministic, documented |
| Live-HTTP route checks | new server test harness | Manual-Only cells (honest) | no harness exists; building one = new test infra (out of scope) + `server.ts` import hazard |
| Commit bookkeeping | ad-hoc git scripting | `gsd_run query commit --files` | commit_docs-aware, established |

**Key insight:** every piece of validation machinery this phase needs already exists and is pinned; the phase's only genuine product is *fresh receipts + the six class probes + the log*.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `not_validated_phases: ["15"…"20"]`, `overall: not_validated` in `.planning/v1.3-MILESTONE-AUDIT.md` frontmatter [VERIFIED] | rewrite `nyquist:` block via §5.5 after VALIDATION.md files land |
| Live service config | None — no external services hold validation state | None — verified: no tool exists for this in-repo-only phase |
| OS-registered state | None — no schedulers/daemons touched | None |
| Secrets/env vars | None — phase adds no env vars; no tokens needed (benches are offline self-test) | None |
| Build artifacts | committed `dist/` (incl. `dist/__tests__/`, 384 files) — benches require fresh `npm run build` before runs (`detection-coverage-bench.mjs:47` throws otherwise); rebuilding at the unchanged boundary is drift-free [VERIFIED: empty diff 4c37232..HEAD] | run `npm run build` before each bench; record dist freshness |

## Common Pitfalls

### Pitfall 1: Restating instead of re-running
**What goes wrong:** map rows cite v1.3 SUMMARY numbers ("1103 tests passed") — filing, not validating.
**Why:** the green tables already exist and are seductive.
**Avoid:** every row = command + this-pass date + measured output; phase gate table reports measured lint count.
**Warning signs:** VALIDATION.md identical in numbers to 20-01-SUMMARY.

### Pitfall 2: Probe designed against imagined semantics
**What goes wrong:** "never all-compliant" asserted for a *passive-only* action set — today `roeAudit(passiveActions, {})` IS all-compliant (scope axis short-circuits on empty `allowedTargets`, `white.ts:40,46`); scope enforcement lives at the parse layer (`ok:false`) and route layer (`no ROE text on record` pin).
**Why:** the flagship example is quoted without reading the engine.
**Avoid:** probe the class as verified: mixed set with active work → `needs_approval` present; `{allowActive:false}` → violation binds; `parseRoe('')` → ok:false. [VERIFIED: live eval]
**Warning signs:** a red probe met with an engine "fix" (out of scope!) instead of a probe redesign.

### Pitfall 3: Lint-count self-inflicted wound
**What goes wrong:** probe files add warnings → milestone rule "no net-new warnings" violated by the validation phase itself.
**Avoid:** match house test style (strict TS: `noUnusedLocals` etc. are on — no unused imports in probes); run `npm run lint` before committing tests.
**Warning signs:** count >177 in the phase gate table.

### Pitfall 4: nyquist_compliant inflation
**What goes wrong:** setting `nyquist_compliant: true` on phases with Manual-Only cells to make the audit prettier.
**Avoid:** per §5.5 + validate-phase routing, manual-only ⇒ PARTIAL. Honest partial is the deliverable.
**Warning signs:** `partial_phases: []` alongside non-empty Manual-Only tables.

### Pitfall 5: Boundary blur mid-phase
**What goes wrong:** a drive-by src tweak lands during the pass; evidence now describes a moving target.
**Avoid:** pre-flight + post-flight empty-diff receipt (`git diff --stat 4c37232..HEAD -- src scripts package.json docs Dockerfile`, tests excluded from the check).

## Code Examples

### Flagship P19 probe (runtime-verified semantics)
```typescript
// src/__tests__/v13-class-probes.test.ts (excerpt)
// Source: src/teams/white.ts:36-78; semantics live-evaluated 2026-10-12 via npx tsx
import { roeAudit } from '../teams/white.js';
import { parseRoe } from '../teams/white/roe-parser.js';

it('phase 19 class probe: an empty ROE spec can never green-light a plan wholesale', () => {
  const mixed = [
    { command: 'nmap -sV 10.0.0.5', target: '10.0.0.5' },          // active, unapproved
    { command: 'cat /etc/hosts', target: 'internal-database.corp' }, // passive
  ];
  const verdicts = roeAudit(mixed, {});
  expect(verdicts.some(v => v.verdict !== 'compliant')).toBe(true); // never ALL-compliant
  expect(verdicts[0].verdict).toBe('needs_approval');               // active axis still fires

  // An explicit prohibition binds even on a minimal spec with an approved action:
  expect(roeAudit([{ command: 'nmap -sV x', target: 'x', approved: true }], { allowActive: false }))
    .toEqual([expect.objectContaining({ verdict: 'violation' })]);

  // Fail-closed parse: absent text never yields a usable spec.
  expect(parseRoe('').ok).toBe(false);
});
```

### P17 probe (unmatched-input honesty, code-read-verified)
```typescript
// Source: src/teams/black/noise.ts — zero-match rationale string is engine-authored
it('phase 17 class probe: an unmatched action is never scored as safe', () => {
  const report = structuredNoiseBudget({ actions: ['totally-unmatched-action'], egress: ['egress.internal:443'] });
  const entry = report.entries[0];
  expect(entry.cost).toBe(0);
  expect(entry.rationale).toContain('unmatched is not safe'); // engine's own honesty marker
});
```

### P16/P18 harness fail-closed static pin pattern
```typescript
// Source: scripts/detection-coverage-bench.mjs:31,47 · scripts/opsec-review-bench.mjs:33,53
import { readFileSync } from 'node:fs';
it('phase 16/18 class probe: benches fail closed on a missing dist (never vendored logic)', () => {
  const blue = readFileSync(new URL('../../scripts/detection-coverage-bench.mjs', import.meta.url), 'utf8');
  expect(blue).toContain('dist/teams/blue');
  expect(blue).toMatch(/blue pipeline not found under dist/);
  const black = readFileSync(new URL('../../scripts/opsec-review-bench.mjs', import.meta.url), 'utf8');
  expect(black).toContain('dist/teams/black');
  expect(black).toMatch(/black pipeline not found under dist/);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Gate tables as the only evidence (v1.3) | Template-shaped VALIDATION.md + Per-Task Map + probes | Phase 21 (this phase) | Audit gains machine-readable frontmatter; §5.5 can classify |
| `not_validated` as accepted debt | Honest compliant/partial split | Phase 21 | Future phases must supersede explicitly, not silently |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gsd-audit-milestone` may not target archived v1.3 phase dirs; manual §5.5 application to `.planning/v1.3-MILESTONE-AUDIT.md` with frontmatter receipts is faithful | Re-Audit Mechanics | Low — classification is a pure frontmatter function; criterion 3 satisfiable either way |
| A2 | Probes P15/P16/P17/P18/P20 run green on first execution (code-read-verified only; P19 live-verified) | Class-Level Negative Probes | Low — a red is treated as a finding: redesign probe or escalate; never touch engines |
| A3 | Expected audit end state: 15/19/20 → PARTIAL, 16/17/18 → candidates for COMPLIANT | Re-Audit Mechanics | Low — depends on whether planner keeps any Manual-Only cell in 16/17/18 (e.g. Grok e2e relay); either is honest |
| A4 | Supersession log location `.planning/milestones/v1.3-phases/SUPERSESSION.md` | Supersession Log | Low — cosmetic; rule and append-only property are what matter |
| A5 | `node 24` local vs CI `node 22` parity holds for the six suites and benches (v1.3 full gates ran green on this host) | Environment Availability | Low — same host/versions as the v1.3 close run |

## Open Questions

1. **Re-audit tooling against archived milestones** — What we know: §5.5 is discovery-only and deterministic; the v1.3 audit file's YAML block is the mutation target. Unclear: whether the workflow accepts archived phase dirs. Recommendation: attempt the workflow; fall back to manual application with receipts (A1). Decide at plan time, not mid-execution.
2. **Manual-Only cell inventory final call** — 16/17/18's only candidate manual cell is the external Grok relay e2e. If the planner classifies gateway pins as sufficient, those phases go COMPLIANT; if e2e counts, they join PARTIAL. Recommendation: keep the cell (honest), accept PARTIAL — but either is defensible; owner taste.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | all suites/benches | ✓ | v24.18.0 (engines ≥22.19; CI pins 22) | — |
| npm | gates | ✓ | 11.16.0 | — |
| vitest | probes + suites | ✓ (devDep) | 4.1.9 | — |
| tsx | (optional) probe-semantics evals | ✓ (devDep) | ^4.7.0 | node --experimental-strip-types |
| docker | nothing in Phase 21 | ✓ 29.6.2 (unused here) | — | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (existing devDep; no new frameworks allowed) |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts']` — new probe files auto-discovered); coverage variant `vitest.pr.config.ts` excludes tests |
| Quick run command | `npx vitest run src/__tests__/v13-class-probes.test.ts` (new) or `npx vitest run src/__tests__/<suite>.test.ts` |
| Full suite command | `npm run test:pr` (= `npm run lint && npm run typecheck && npm test && npm run doctor`; CI parity, `.github/workflows/ci.yml:35`) |
| Estimated runtime | quick ≈ seconds; `test:pr` ≈ minutes (1103+ tests at v1.3 close) |

### Phase Requirements → Test Map (VAL-01)
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VAL-01 | ≥1 class-level negative probe per phase 15–20 | unit (new pins) | `npx vitest run src/__tests__/v13-class-probes.test.ts` | ❌ Wave 0 (this phase's first task creates it) |
| VAL-01 | Existing per-criterion evidence re-run green (22 criteria) | unit/static/bench | Per-Phase Requirement → Evidence Map commands above | ✅ all exist |
| VAL-01 | VALIDATION.md frontmatter drives §5.5 classification | tooling (audit) | validate-phase State-B §6 + §5.5 re-audit | ✅ gsd tooling |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/v13-class-probes.test.ts` + the task's touched suite; `npm run lint` before every commit (net-new-warning rule)
- **Per wave merge:** `npm run test:pr`
- **Phase gate:** full `npm run test:pr` green + measured lint count in gate table + `not_validated` block emptied before `/gsd:verify-work`

### Per-Task Verification Map skeleton (each NN-VALIDATION.md fills this shape)
```
| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01 | 01 | 1 | P15-C2 | T-15-01 / — | rules route wires real coverage engine | unit+static | `npx vitest run src/__tests__/blue-suite.test.ts src/__tests__/blue-routes-static.test.ts` | ✅ | ✅ green (2026-10-XX) |
| 15-01 | 01 | 1 | P15-C2-live | — | Sigma YAML served over HTTP | manual-only | curl loopback (steps in Manual-Only table) | — | ⬜ manual |
```
Requirements column uses `P<NN>-C<n>` ids from the v1.3-ROADMAP criteria blocks; Task ID column uses the phase's single real plan id (`NN-01`).

### Wave 0 Gaps
- [ ] `src/__tests__/v13-class-probes.test.ts` — the six class-level probes (covers VAL-01 probe criterion)
- [ ] No framework install, no conftest needed — infrastructure complete
- Everything else: existing suites/benches/pins cover all criteria (gap cells → Manual-Only)

## Security Domain

(No `.planning/config.json` exists → `security_enforcement` defaults to enabled; section included.)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes (evidence rows re-prove guard coverage) | existing `remote-access-guard.test.ts` + `local-api-hardening-static.test.ts` re-run; no new guard surface |
| V5 Input Validation | yes (probes assert fail-closed on absent/empty/lookalike inputs) | new class probes; engines' own throw/unresolved semantics |
| V2/V3/V6 | no | no auth/session/crypto surface touched by a tests-only phase |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Silent permissiveness (empty signal → allowed) | Elevation of Privilege | P17/P19 probes pin fail-closed class forever |
| Evidence theater (restated green, vacuous passes) | Repudiation | State-B dating, falsifier statements, fresh measured rows |
| Pin erosion (weakened assertions to ease probes) | Tampering | probes never edit engines; pins evolve same-commit only in code phases |

## Sources

### Primary (HIGH confidence — all read this session)
- `.planning/phases/21-retroactive-validation-phases-15-20/21-CONTEXT.md` — locked decisions
- `.planning/milestones/v1.3-ROADMAP.md` §Phase 15–20 — the 22 criteria (requirement source of truth)
- `.planning/v1.3-MILESTONE-AUDIT.md` — nyquist block, criteria-evidence table, debt items
- `.planning/milestones/v1.3-phases/{15..20}-01-SUMMARY.md` — per-phase changes/verification/deferred
- `.planning/milestones/v1.3-STATE.md:44` — the two fixture bends record
- `package.json:20-111` — gate spine; `vitest.config.ts:8,17`; `vitest.pr.config.ts:10-11`; `tsconfig.json`; `.github/workflows/ci.yml:35,72`
- `src/teams/white.ts:12-78`; `src/teams/white/roe-parser.ts:14-19,45-78`; `src/teams/blue/coverage.ts:12-137`; `src/teams/black/noise.ts:166-218`; `src/teams/black/exfil.ts:121-173`; `src/teams/purple.ts:39-143`
- Test suites: `blue-suite.test.ts`, `blue-routes-static.test.ts`, `black-suite.test.ts`, `purple-v2.test.ts`, `white-suite.test.ts`, `white-routes-static.test.ts:61-67`, `teams-modules.test.ts:248-255`, `{detection-coverage,opsec-review,roe-adjudication}-bench.test.ts`, playbook suites, `grokbot-gateway.test.ts:109-118`
- `$HOME/.agents/gsd-core/templates/VALIDATION.md`; `$HOME/.agents/gsd-core/workflows/validate-phase.md` (§1 State A/B/C, §6, §7); `$HOME/.agents/gsd-core/workflows/audit-milestone.md` §5.5 (:158-185)
- Live runtime eval (`npx tsx`, 2026-10-12): `roeAudit` empty-spec verdicts, `parseRoe('')` ok:false — flagship probe semantics
- `git diff 4c37232..HEAD -- src scripts package.json docs Dockerfile` → empty (boundary receipt)

### Secondary (MEDIUM)
- `.planning/research/SUMMARY.md`, `PITFALLS.md` §1–2 — failure-mode framing (file-cited, inherited)

### Tertiary (LOW)
- None — no external sources needed; domain fully internal.

*Research-plan seam (external docs lookup) intentionally skipped: zero ecosystem/library questions exist in a tests-only, no-new-dependencies phase; every claim above is repo-verified.*

## Metadata

**Confidence breakdown:**
- Command inventory / evidence map: HIGH — every row file:line-verified this session
- Probe design: HIGH for P19 (runtime-verified), MEDIUM-HIGH for the rest (code-read-verified; A2)
- Re-audit mechanics: HIGH for §5.5 semantics (workflow read), MEDIUM for archived-milestone tooling path (A1)

**Research date:** 2026-10-12
**Valid until:** 2026-11-11 (stable: internal domain; re-verify only if src/ drifts from `4c37232` before execution starts)
