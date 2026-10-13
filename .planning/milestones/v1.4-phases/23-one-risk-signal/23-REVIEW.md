---
phase: 23-one-risk-signal
reviewed: 2026-10-13T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/teams/purple.ts
  - src/__tests__/teams-modules.test.ts
  - docs/operators.html
  - docs/API_REFERENCE.md
  - grokbot/skills/dark-purple/SKILL.md
  - .planning/milestones/v1.3-phases/SUPERSESSION.md
  - docsite/t3mp3st-docs/content/API_REFERENCE.md
  - docsite/t3mp3st-docs/content/CHANGELOG.md
  - docsite/t3mp3st-docs/content/GETTING_STARTED.md
  - docsite/t3mp3st-docs/content/MCP_GUIDE.md
  - docsite/t3mp3st-docs/content/RELEASE_CHECKLIST.md
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
scope:
  - c510ba7 (purple.ts derivation + parity pin + operators.html + API_REFERENCE.md + SKILL.md + SUPERSESSION row)
  - e38d657 (docsite mirror wholesale regen)
---

# Phase 23: Code Review Report

**Reviewed:** 2026-10-13
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found (2 INFO, 0 WARNING, 0 BLOCKER)

## Summary

Reviewed both commits in full (`git show c510ba7`, `git show e38d657`) against
23-CONTEXT.md locked decisions and 23-RESEARCH.md ground truth, plus the current
working-tree files. All 8 review priorities verify clean:

1. **Single writer** — `RISK_BY_SEVERITY`/`riskWord` fully removed from
   `src/teams/purple.ts`; repo-wide grep for `riskWord|RISK_BY_SEVERITY|no detection
   covers|detection is partial|pending ROE remediation` returns zero hits in
   `src/`, `docs/`, `grokbot/` (one unrelated "severe impact" hit in
   `src/prompts/index.ts`). The prose writer is exactly one
   `Record<PurpleRiskTier, …>` table with totality by construction; the row
   builder (`purple.ts:127-129`) computes `riskTier` then renders prose from it
   with no branch on detection/verdict/severity. Remaining detection/verdict
   branches in `synthesize()` drive `unresolved`/`nextMissions` only, never prose.
2. **Template honesty** — all five templates carry tier-honest framing with no
   detection/verdict fact claims, so tier `high` truthfully serves both
   no-detection and violation rows. Interpolation is `${finding.id}${subject}`
   (rendered data, not signal inputs); empty/missing title degrades to `''`
   with its own pin.
3. **Parity pin strength** — whole-vocabulary loop (all 5 tiers, `toBe` string
   equality), tier math verified per row (info/low/medium via base, high via
   medium+none bump, critical via critical base), plus a 4-row adjacency block
   covering bump (`medium+none→high`, `low+none→medium`, `high+none→critical`)
   and floor (`low+covered+violation→high`) paths. Existing behavioral pins
   (unresolved/nextMissions) kept intact; first-test tier math re-verified
   (critical+none→critical, medium+covered→medium).
4. **Shape invariance** — return shape `{ findingId, detection, verdict,
   riskTier, residualRisk }` untouched; `git diff` confirms `src/server.ts`,
   `src/__tests__/purple-v2.test.ts`, `src/__tests__/v13-class-probes.test.ts`,
   `src/mcp-server.ts` unmodified across both commits. The v13 orphan pin stays
   relational (both sides re-derive through the new writer).
5. **Consumer cutover** — operators.html header gains `Tier` in matching column
   order with the row cells, rendered through `Shell.escHtml` with `'—'`
   fallback; API_REFERENCE documents `riskTier` as authoritative, marks
   `residualRisk` derived, and carries the full two-vocabulary side-by-side note;
   SKILL.md updates both relay points (§6 row fields, §7 completion summary)
   while preserving "exactly as returned".
6. **Docsite mirror** — e38d657 commits 5 content files wholesale including the
   expected pre-existing catch-up (OAuth, provider IDs, full purple section);
   mirror purple paragraph verified byte-identical to the source edit; no
   `dist/` paths in either commit (`dist/` untracked); no hand-trimming evident.
7. **Supersession tokens** — row contains `20-VALIDATION P20-C1, P20-C2b,
   P20-C3a, P20-C4` verbatim.
8. **Lint discipline** — no orphaned references: `risk` const removed with its
   only use; `subject`/`detection`/`verdict` still consumed; `PurpleRiskTier`
   type import in the test file is used by `EXPECTED`/`CASES` annotations.

No BLOCKER or WARNING findings. Two INFO nits below.

## Info

### IN-01: Prose-model comment cites `residualRiskTier()` as "above" but it is defined below

**File:** `src/teams/purple.ts:49`
**Issue:** The comment reads "prose is a pure derived rendering of the tier
computed by `residualRiskTier()` above", but `residualRiskTier()` is defined at
line 83, below the `RISK_PROSE_BY_TIER` table. Direction word is inaccurate;
no behavioral effect.
**Fix:** Change "above" to "below":
```ts
// residualRiskTier() below. Templates key STRICTLY on the tier — no branch on
```

### IN-02: Adjacency block omits the `partial`+`violation` floor input combo

**File:** `src/__tests__/teams-modules.test.ts:316-326`
**Issue:** The boundary block pins bump paths and one floor path
(`low`+`covered`+`violation`→`high`), but not the research-identified third
contradiction class (`medium`/`low`+`partial`+`violation`→`high` via floor).
Since prose is keyed strictly on the tier, any `high` renders identically, so
this is defense-in-depth coverage only — not a correctness gap.
**Fix:** Consider adding one row, e.g.:
```ts
{ id: 'b-partial-floor', severity: 'medium', coverage: 'partial', verdict: 'violation', tier: 'high', prose: 'high residual risk — b-partial-floor (T) sits above appetite; do not declare the posture acceptable while this row is high' },
```

---
_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
