# Phase 23: One Risk Signal - Research

**Researched:** 2026-10-12
**Domain:** `src/teams/purple.ts` residualRisk/riskTier unification + its consumer/pin/mirror surface
**Confidence:** HIGH (every claim below was read from this checkout this session; internal repo phase — no external libraries involved)

## Research Answer Index

| # | Question (from assignment) | Answer lives in |
|---|---|---|
| 1 | Current prose composition + tier table | [Producer Anatomy](#producer-anatomy-q1) |
| 2 | Prose strings today + API response shapes | [Agreement-Pin Target Table](#agreement-pin-target-table-q2), [API Responses](#api-responses-carrying-the-fields-q2) |
| 3 | Every consumer line (incl. ones ARCHITECTURE missed) | [Consumer Enumeration](#consumer-enumeration-q3) |
| 4 | Dist/docsite rebuild commands + changed paths | [Rebuild & Mirror Regeneration](#rebuild--mirror-regeneration-q4) — **contains a correction to CONTEXT.md's "committed dist/" premise** |
| 5 | Supersession entry contents | [Supersession Entry](#supersession-entry-q5) |
| 6 | Where the naming side-by-side note belongs | [Naming Documentation](#naming-documentation-q6) |
| 7 | What must NOT change | [Must Not Change](#must-not-change-q7) |
| 8 | Pin mechanics + whole-table parity pin shape | [Pin Mechanics](#pin-mechanics-q8) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (23-CONTEXT.md `## Implementation Decisions`, binding)
- **Option (a) — prose DERIVED from riskTier.** Dropping the prose field (option b) rejected: sanctioned API contract change, violates PROJECT.md "existing `/api/*` routes keep their contracts". The violation-branch contradiction (tier floors `high` while prose reads "low residual risk") becomes structurally impossible.
- **Template keys STRICTLY on the tier** (owner-conservative default) — guarantees prose↔tier agreement by construction; no hidden inputs.
- **Exactly one prose writer** — a pure function in `src/teams/purple.ts`; the old severity-word composition (RISK_BY_SEVERITY path) is removed, not parallel-kept.
- **Touches only `PurpleRiskTier`** (`src/teams/purple.ts`); the unrelated arsenal approval-gate `RiskTier` vocabulary (`types/index.ts`) is NOT touched; the two names are documented side-by-side in API_REFERENCE (rename only with contract sanction — not this milestone).
- API response shape unchanged: existing consumers keep parsing without edits (pinned).
- Pins evolve same-commit, never weaken: `teams-modules.test.ts` pins strengthened to assert prose↔tier agreement across the whole tier table (not re-snapshotted verbatim prose); `purple-v2.test.ts` tier pins untouched.
- `dist/` rebuilt + docsite regenerated in the same commit as the derivation (see Q4 for what this concretely means — dist/ is gitignored; the *tracked* mirror is `docsite/`).
- Supersession entry for the phase-20 purple surface, same commit.
- Running lint count in gate receipts, no net-new warnings vs 177; 0 errors.

### Claude's Discretion (from 23-CONTEXT.md)
- Exact per-tier template wording (the strings are new operator-visible constants — see Open Questions).
- Parity-pin file placement/mechanics within the locked "strengthen teams-modules.test.ts" constraint.

### Deferred Ideas (OUT OF SCOPE)
- Renaming `PurpleRiskTier` (contract sanction required — documented side-by-side instead).
- Tier+inputs-keyed prose templates (rejected: strictly-tier guarantees agreement by construction).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UNIFY-01 | `residualRisk` prose becomes a pure derived rendering of the deterministic `riskTier` (single writer in `src/teams/purple.ts`), API response shape unchanged, every consumer updated same-commit with prose↔tier parity pins (operators.html renders tier; API_REFERENCE documents tier + marks prose derived; dark-purple SKILL.md relays both; teams-modules pins strengthened) | Q1–Q8 sections: full producer anatomy, exhaustive consumer table, pin precedents, mirror/supersession mechanics, tier×prose matrix for the parity table |
</phase_requirements>

## Summary

The divergence is a **branch-order artifact inside one function**. `synthesize()` computes the deterministic tier first (`residualRiskTier`, purple.ts:80-90), then composes prose from a *different* signal — the severity word via `riskWord()`/`RISK_BY_SEVERITY` (purple.ts:47-57) — and branches on `detection` *before* `verdict` (purple.ts:127-135). Consequence: a ROE violation only reaches the prose when detection is `'covered'`; in the `'none'`/`'partial'` branches the prose never mentions the violation even though the tier floors at `high`. Besides the two contradiction classes ARCHITECTURE §2 cites (medium+none, covered+violation), this research found a **third unlisted class**: `partial`+`violation` for low/medium/info severities (tier `high`, prose "low/moderate residual risk — detection is partial… harden the missing chain links"). All are killed by the same fix: one tier→template map.

Two corrections to the working assumptions, both verified this session:

1. **`dist/` is NOT committed.** `.gitignore:2` lists `dist/`; `git ls-files dist/` returns 0 files. The "committed dist/ rebuilt same-commit" language translates to: run `npm run build` (= `tsc`) during the commit's verification so benches/gates that import `dist/` exercise the new derivation. Nothing dist-shaped enters `git`. The **tracked** regenerated artifact is the docsite mirror.
2. **The docsite mirror is already stale.** `docsite/t3mp3st-docs/content/API_REFERENCE.md` was last touched at the re-home commit `53b95ed` (2026-10-10, 239 lines, **zero** occurrences of "purple") while `docs/API_REFERENCE.md` is at `d79fea9` (2026-10-12, 310 lines, full Dark Purple Teams section + phase-22 ROE rows). `npm run docs:sync` in this phase will therefore emit a **catch-up diff far larger than the phase's own edit** — expected and correct; commit it wholesale, never hand-edit (PITFALLS §2 warning sign).

**Primary recommendation:** replace the `riskWord`/branch composition with a single `Record<PurpleRiskTier, (slots) => string>`-shaped pure writer in purple.ts; strengthen `teams-modules.test.ts` with a whole-vocabulary parity pin modeled on the purple-v2 CASES loop; update operators.html (header row **:96 + row template :262-266 — two edit points**), API_REFERENCE (:286-289 + side-by-side note), dark-purple SKILL.md (**two relay points: §6 :107-111 and §7 :115-118**); `npm run build` + `npm run docs:sync`; append the SUPERSESSION row naming 20-VALIDATION P20-C1/C2b/C3a/C4 — all in one commit.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tier computation f(severity, detection, verdict) | API/Backend (`src/teams/purple.ts`, pure) | — | Teams modules are pure, no-I/O; server only persists/relays (ARCHITECTURE §1 dependency direction) |
| Prose derivation (new single writer) | API/Backend (`src/teams/purple.ts`, pure) | — | Same module as tier — one signal, one module |
| Response assembly `POST /api/teams/purple/synthesize` | API/Backend (`src/server.ts:6410-6486`) | — | Shape-agnostic passthrough + persistence; no field coupling |
| Operator UI rendering | Browser (`docs/operators.html:96,262-266`) | — | Static page; renders whatever the API returns via `Shell.escHtml` |
| Contract documentation | Docs (`docs/API_REFERENCE.md:265-289`) | Docsite mirror (`docsite/t3mp3st-docs/content/API_REFERENCE.md`, generated) | Mirror is build-time generated by `npm run docs:sync`, never hand-edited |
| LLM skill relay | Grok skill (`grokbot/skills/dark-purple/SKILL.md`) | MCP proxy (`src/mcp-server.ts` — no coupling) | Skill quotes response fields "exactly as returned"; proxy passes the route verbatim |

## Standard Stack

No new packages. This is a repo-internal derivation + docs phase; the toolchain below already exists.

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| typescript (`tsc`) | ^5.3.3 [VERIFIED: package.json:179] | `npm run build` → emits `dist/` (gitignored) | The repo's only compiler; benches import `dist/` |
| vitest | ^4.1.9 [VERIFIED: package.json:181] | Parity pins + regression suites | Only test framework; config `vitest.config.ts` |
| eslint | ^9.39.2 [VERIFIED: package.json:178] | Lint gate (0 errors, no net-new warnings vs 177) | Locked gate metric |
| node | >=22.19.0 engines; host has v24.18.0 [VERIFIED: package.json:183-185, `node --version`] | Runtime for docs:sync script | engines floor satisfied |

**Installation:** none — PROJECT.md forbids new runtime dependencies; none needed.

## Package Legitimacy Audit

**This phase installs zero external packages** (new derivation code + doc/test/doc edits only). No registry lookups required; no [SLOP]/[SUS] surface. (Protocol run conditionally — the gate applies "whenever this phase installs external packages"; it does not.)

## Architecture Patterns

### Producer Anatomy (Q1)

**Type and tier vocabulary** — `src/teams/purple.ts`:

```ts
// purple.ts:36-39 [VERIFIED: src/teams/purple.ts:36-39]
/** Residual-risk tier — same vocabulary as finding severity, not free prose. */
export type PurpleRiskTier = 'critical' | 'high' | 'medium' | 'low' | 'info';
// …inside DarkPurpleSynthesis.coverageMatrix rows:
//   /** Deterministic f(severity, detection coverage, verdict); see the RISK_TIER_* constants. */
//   riskTier: PurpleRiskTier;
//   residualRisk: string;
```

**The obsolete prose word table (to be REMOVED, single call site purple.ts:123)** [VERIFIED: src/teams/purple.ts:47-57]:

```ts
const RISK_BY_SEVERITY: Record<string, string> = {
  critical: 'severe',
  high: 'high',
  medium: 'moderate',
  low: 'low',
  info: 'informational',
};

function riskWord(severity: string | undefined): string {
  return (severity && RISK_BY_SEVERITY[severity]) || 'moderate';
}
```

**The deterministic tier model (UNCHANGED — the derivation keys on it)** [VERIFIED: src/teams/purple.ts:59-92; function at :80 grep-verified]:

```ts
// ── Residual-risk tier model ────────────────────────────────────────────────
//   1. Base tier from severity — critical=4, high=3, medium=2, low=1, info=0.
//   2. Detection 'none' bumps the tier one step up … capped at the top of the scale.
//   3. A 'violation' verdict floors the tier at high …
const RISK_TIER_SCALE: readonly PurpleRiskTier[] = ['info', 'low', 'medium', 'high', 'critical'];
const RISK_TIER_BY_SEVERITY: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};
const RISK_TIER_DEFAULT_INDEX = 2; // medium — missing/unknown severity input
const RISK_TIER_NONE_DETECTION_BUMP = 1;
const RISK_TIER_VIOLATION_FLOOR = 3; // high

function residualRiskTier(
  severity: string | undefined,
  detection: DetectionGap['coverage'],
  verdict: string | undefined,
): PurpleRiskTier {
  const baseIndex = severity !== undefined && RISK_TIER_BY_SEVERITY[severity] !== undefined
    ? RISK_TIER_BY_SEVERITY[severity]
    : RISK_TIER_DEFAULT_INDEX;
  let tierIndex = baseIndex;
  if (detection === 'none') tierIndex = Math.min(baseIndex + RISK_TIER_NONE_DETECTION_BUMP, RISK_TIER_SCALE.length - 1);
  if (verdict === 'violation') tierIndex = Math.max(tierIndex, RISK_TIER_VIOLATION_FLOOR);
  return RISK_TIER_SCALE[tierIndex];
}
```

**Today's prose composition (the code being replaced)** — branch order is `none → partial → (covered) violation → (covered) else`; `risk` is the severity word, `subject` is `finding.title ? ` (${finding.title})` : ''` (purple.ts:123-124) [VERIFIED: src/teams/purple.ts:127-135]:

```ts
let residualRisk: string;
if (detection === 'none') {
  residualRisk = `${risk} residual risk — no detection covers ${finding.id}${subject}; close the gap before declaring the posture acceptable`;
} else if (detection === 'partial') {
  residualRisk = `${risk} residual risk — detection is partial for ${finding.id}${subject}; harden the missing chain links`;
} else if (verdict === 'violation') {
  residualRisk = `low residual risk — detection covers ${finding.id}${subject}, pending ROE remediation of the violating action`;
} else {
  residualRisk = `low residual risk — detection covers ${finding.id}${subject}`;
}
return { findingId: finding.id, detection, verdict, riskTier, residualRisk };  // :138
```

`riskWord`/`RISK_BY_SEVERITY` have **no consumers outside purple.ts** — grep over `src/` hits only purple.ts:47-57 and the single call site :123 [VERIFIED: grep src/]. Removal is conflict-free.

### Agreement-Pin Target Table (Q2)

Four prose templates exist today (A/B/C/D above), with the severity word `W(S) ∈ {severe, high, moderate, low, informational}` (fallback `moderate` for missing/unknown severity). Full current mapping — **this collapse behavior is what the new strict-tier templates must absorb** [VERIFIED: derivation code purple.ts:80-90,127-135; cross-checked against the 16 pinned cases in purple-v2.test.ts CASES, which match this matrix exactly]:

| severity (base) | detection | verdict | riskTier | current prose (leading word → template) |
|---|---|---|---|---|
| critical (4) | any | any | `critical` (bump/floor no-op) | W=critical→**"severe"**: none→A; partial→B; covered→C/D |
| high (3) | none | any | `critical` | **"high"** + A |
| high (3) | partial/covered | ¬violation | `high` | **"high"** + B / D |
| high (3) | partial/covered | violation | `high` (floor no-op) | **"high"** + B / C |
| medium (2) | none | any | `high` | **"moderate"** + A ← *word-vs-tier mismatch (ARCHITECTURE's example)* |
| medium (2) | partial/covered | ¬violation | `medium` | **"moderate"** + B / D |
| medium (2) | partial | violation | `high` (floor) | **"moderate"** + B ← *unlisted contradiction class* |
| medium (2) | covered | violation | `high` (floor) | **"low"** + C ← *THE cited contradiction (tier high, prose "low")* |
| low (1) | none | any | `medium` | **"low"** + A |
| low (1) | partial/covered | ¬violation | `low` | **"low"** + B / D |
| low (1) | partial/covered | violation | `high` (floor) | **"low"** + B/C ← *contradiction* |
| info (0) | none | any | `low` | **"informational"** + A ← *word-vs-tier mismatch* |
| info (0) | partial/covered | ¬violation | `info` | **"informational"** + B / D |
| info (0) | partial/covered | violation | `high` (floor) | **"informational"** + B/C ← *contradiction* |
| missing/unknown | *(same as medium row)* | | base 2 | word fallback **"moderate"** (pinned: r-15, r-16) |

**Guidance-loss facts the planner must design around** (within the locked strict-tier constraint):
- Prose surfaces the violation **only** in the covered branch (branch order :128-135). For `none`/`partial` + violation, prose never mentions ROE remediation while the tier floors at `high` — the remediation clause (`pending ROE remediation of the violating action`, :133) currently reaches consumers only in the covered case (PITFALLS §2 "silent semantics change" warns about deleting it).
- Under strict tier keying, one template per tier serves ALL triggering input combos. E.g. tier `high` is produced by 10+ distinct (severity, detection, verdict) rows spanning "no detection" and "violation, fully detected" situations — a tier-`high` template cannot truthfully claim either specific fact. Templates should therefore carry tier-honest severity framing and may interpolate `{findingId}{subject}` (rendered data, not signal inputs) but must not branch on detection/verdict. Wording is owner-visible (Open Questions).
- All five vocabulary values are reachable (`RISK_TIER_SCALE` purple.ts:73), so a whole-table parity pin iterates exactly 5 tiers.

### API Responses Carrying the Fields (Q2)

Exactly **one** API response carries them [VERIFIED: grep purpleSyntheses in src/server.ts — set at :6471, snapshot :1202, restore :1274; **no GET route serves the stored synthesis**]:

- `POST /api/teams/purple/synthesize` → `res.status(201).json(synthesis)` (server.ts:6485) — the `DarkPurpleSynthesis`: `coverageMatrix[]` rows `{ findingId, detection, verdict?, riskTier, residualRisk }`, plus `unresolved[]`, `nextMissions[]`, `correlation` (purple.ts:30-44).
- The route validates body shapes (400s, server.ts:6416-6445), merges ledger title/severity read-only (:6446-6456), persists the whole synthesis into the single `'latest'` slot (`purpleSyntheses.set('latest', { id: 'latest', createdAt: nowIso(), correlation, synthesis })`, server.ts:6471-6479), and emits an SSE/contract event carrying **counts only, not fields** (`emitContractEvent('purple.synthesis', { findings, detections, verdicts, correlation, unresolved, nextMissions })`, server.ts:6476-6483).
- MCP proxy `tempest_purple_synthesize` forwards the route response verbatim (mcp-server.ts:432-434) and its tool description names no response fields (:217-218) — zero coupling.

### Recommended shape of the new derivation [INFERENCE — design guidance inside the locked constraint]

```ts
// Single writer; Record<PurpleRiskTier, …> makes omission a COMPILE error
// (totality by construction), the runtime parity pin then guards the wiring.
const RISK_PROSE_BY_TIER: Record<PurpleRiskTier, (findingId: string, subject: string) => string> = {
  critical: (id, s) => `… ${id}${s} …`,
  high:     (id, s) => `… ${id}${s} …`,
  medium:   (id, s) => `… ${id}${s} …`,
  low:      (id, s) => `… ${id}${s} …`,
  info:     (id, s) => `… ${id}${s} …`,
};
// in the row builder (:123-138 becomes):
const riskTier = residualRiskTier(finding.severity, detection, verdict);
const residualRisk = RISK_PROSE_BY_TIER[riskTier](finding.id, subject);
```

### Anti-Patterns to Avoid (from PITFALLS §2, all binding)
- **Prose→tier regex parsing** (`/no detection/`): two signals again, worse — drift becomes invisible.
- **Second prose writer / divergent re-derivation**: the v1.3 drift recurs; exactly one writer in purple.ts.
- **Deleting `residualRisk`**: breaks the pinned API contract (option b, rejected).
- **Hand-editing the docsite mirror or API_REFERENCE response example**: regenerate (`docs:sync`), never hand-edit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity→tier mapping | New mapping logic | Existing `residualRiskTier` (purple.ts:80-90) + constants | Already deterministic, commented, and pinned by 16 rows |
| Prose↔tier totality | Runtime "did I cover all tiers?" checks | `Record<PurpleRiskTier, …>` typing | Compile-time exhaustiveness; zero runtime cost |
| Docsite mirroring | Hand-copied API_REFERENCE into `docsite/` | `npm run docs:sync` (scripts/pagenary-docsite.mjs) | Build-time generated; hand edits are the PITFALLS §2 warning sign |
| HTML escaping of the new tier cell | Custom sanitizer | `Shell.escHtml` (operators.html pattern :262-266) | Existing sibling cells all escape through it |

## Runtime State Inventory

> Refactor-of-output phase — inventory answered explicitly per category.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `purpleSyntheses` single `'latest'` slot persists the **whole synthesis including old-composition prose** to `${T3MP3ST_STATE_DIR}/state.json` (server.ts:6471-6479, snapshot :1202, restore :1274) | **None** — replace-latest single slot; the next synthesis overwrites the old prose. No migration; restored stale rows are served by no route (write-only continuity state) |
| Live service config | None — no external service holds these strings [VERIFIED: grep across docs/, grokbot/, scripts/ shows no other writer] | none |
| OS-registered state | None — no scheduler/pm2/launchd involvement | none |
| Secrets/env vars | None — no env var or secret key references `residualRisk`/`riskTier` (arsenal gating env `T3MP3ST_GATE_BUILTINS` is the unrelated `RiskTier` domain, untouched) | none |
| Build artifacts | `dist/` is **gitignored** (`.gitignore:2`; `git ls-files dist/` → 0 files) but load-bearing on disk: benches import `dist/teams/*` fail-closed (pinned in v13-class-probes.test.ts:2-9,23-30), `test:gate` builds first (package.json:121) | Run `npm run build` in the commit's verification; nothing dist-shaped is committed |

## Common Pitfalls

### Pitfall 1: Treating "dist/ rebuilt same-commit" as a commit step
**What goes wrong:** Planner schedules a `dist/` commit or checks `git status` for dist churn that never appears.
**Why:** `.gitignore:2` ignores `dist/`; zero tracked files [VERIFIED].
**How to avoid:** Interpret it as *verification-time* rebuild (`npm run build`) so benches/gates exercise the new derivation; the committed regenerated artifact is the docsite mirror.
**Warning signs:** A plan task that "commits dist/".

### Pitfall 2: The docs:sync catch-up diff alarms someone into hand-trimming it
**What goes wrong:** Mirror regen shows changes far beyond the phase's lines (phase-22 ROE rows, the whole purple section) and someone hand-edits the mirror to "minimize" it.
**Why:** Mirror is stale at `53b95ed` (239 lines, no "purple") vs source at `d79fea9` (310 lines) [VERIFIED: wc -l + git log + grep]. Phase 22 updated the source without committing a mirror regen.
**How to avoid:** Commit the full regenerated mirror wholesale; the mirror is generated (`scripts/pagenary-docsite.mjs` rewrites `content/*.md` + `config.json` + `manifest.json` + tracked `tenants.json`).
**Warning signs:** `git diff docsite/` smaller than the source-side change.

### Pitfall 3: Pin "strengthening" that actually weakens
**What goes wrong:** Replacing prose assertions with tier-only assertions (tier pins stay green while prose drifts) — the exact PITFALLS §2 warning sign "New tests assert only riskTier and stop asserting the prose ↔ tier agreement".
**How to avoid:** The new parity pin must assert `residualRisk` **string equality** against the per-tier template for every tier in the vocabulary, plus keep the existing behavioral pins (unresolved/nextMissions) intact.
**Warning signs:** A diff that deletes `toContain('low residual risk')` without adding a same-file prose↔tier assertion.

### Pitfall 4: Missing the second edit points
**What goes wrong:** Updating only the ARCHITECTURE-table lines and leaving `operators.html:96` (table header `<th>Residual risk</th>` with no Tier column) or SKILL.md §7 (`:115-118`, "per-finding residual risks") stale.
**How to avoid:** Use the Consumer Enumeration table below (supersedes ARCHITECTURE §2's table with 3 additional rows).
**Warning signs:** A rendered operators.html table whose tier cell has no header; a skill completion summary that relays only prose.

### Pitfall 5: Conflating the two `riskTier` vocabularies
`PurpleRiskTier = 'critical'|'high'|'medium'|'low'|'info'` (purple.ts:36) vs arsenal gate `RiskTier = 'local_read'|'passive'|'active'|'intrusive'|'credential'|'dangerous'` (types/index.ts:420, consumed at CustomTool.riskTier :451, gate isGatedRisk src/arsenal/approval.ts:46-48). Disjoint types and domains; this phase must not touch the latter [VERIFIED: both type definitions read this session].

## Consumer Enumeration (Q3)

Complete — grep of `residualRisk` and `riskTier` across src/, docs/, grokbot/, scripts/, plus committed-mirror checks. Rows marked ★ are **missed by ARCHITECTURE §2's table**.

| Consumer | File:line | Uses | Change |
|---|---|---|---|
| Producer (prose) | src/teams/purple.ts:47-57, 123, 127-138 | `riskWord`/`RISK_BY_SEVERITY` + branch composition | **Replace** with single tier→template writer; delete the severity-word path |
| Producer (tier) | src/teams/purple.ts:36-39, 59-92 | `PurpleRiskTier`, `residualRiskTier` | **Unchanged** (the derivation keys on it) |
| API route | src/server.ts:6410-6486 | passthrough + persistence + counts-only event | None required (shape-agnostic); route doc comment optionally notes prose is derived |
| Operators UI | docs/operators.html:**96** ★ (header row) | `<th>Residual risk</th>` — no Tier column | **Add Tier column header** |
| Operators UI | docs/operators.html:262-266 | `row.residualRisk` only | **Render tier cell/badge** (through `Shell.escHtml`) |
| API reference | docs/API_REFERENCE.md:286-289 | field list names `residualRisk`, omits `riskTier` (already drifted) | **Document tier, mark prose derived, add side-by-side note** |
| Grok skill | grokbot/skills/dark-purple/SKILL.md:107-111 | relay list names `residualRisk` only | **Relay tier too** |
| Grok skill | grokbot/skills/dark-purple/SKILL.md:**115-118** ★ (§7 completion summary) | "per-finding residual risks" | **Mention tiers alongside** |
| MCP proxy | src/mcp-server.ts:217-218, 432-434 | verbatim passthrough, no field coupling | None |
| Defend UI | docs/defend.html | no coverageMatrix reference [VERIFIED: ARCHITECTURE §2 grep; no residualRisk/riskTier hit in file] | None |
| Test pins (prose) | src/__tests__/teams-modules.test.ts:253,255 | `toContain('no detection')`, `toContain('low residual risk')` | **Rewrite as whole-table parity pins** (see Pin Mechanics) |
| Test pins (tier) | src/__tests__/purple-v2.test.ts:110-152 | 16-row CASES table + bump test | **Unchanged — must stay green unmodified** (locked) |
| Class probe ★ | src/__tests__/v13-class-probes.test.ts:76-95 (phase-20 block) | orphan-verdict isolation: `JSON.stringify(withOrphans.coverageMatrix) === JSON.stringify(base.coverageMatrix)` — relational, no absolute prose | **Unchanged — must stay green** (both sides re-derive through the new writer) |
| UI parse gate | src/__tests__/ui-inline-scripts-parse.test.ts | compiles every docs/*.html inline script (vm.Script) | Unchanged file — the operators.html edit must keep it green |
| Docsite mirror | docsite/t3mp3st-docs/content/API_REFERENCE.md (+ manifest.json, tenants.json) | generated copy, currently **stale** | **Regenerate via `npm run docs:sync`**, same commit |

**Repo-wide negative claims:** README.md has no residualRisk/riskTier mention [VERIFIED: grep]; `docs/CONTRIBUTION_RECEIPTS.md` / `PULL_REQUEST_TEMPLATE` "Residual risk" lines are unrelated report-template labels [VERIFIED: grep context]; no purple bench exists (`black:bench`/`blue:bench`/`white:bench` only, package.json:42-44).

## Rebuild & Mirror Regeneration (Q4)

**Committed paths that change in this phase:**
1. `docs/API_REFERENCE.md` (edited by hand — it is the source) → mirrored by regen into:
2. `docsite/t3mp3st-docs/content/API_REFERENCE.md` (generated; includes frontmatter + link-normalized copy) and possibly `docsite/t3mp3st-docs/manifest.json` + tracked `tenants.json` if section structure shifts [VERIFIED: script writes all four; manifest/tenants derived from the static pages list, which phase 23 does not change — likely byte-identical]
3. Test/source/docs edits listed above. **`dist/**` changes on disk only — never in git.**

**Commands** [VERIFIED: package.json scripts]:
```bash
npm run build        # tsc → regenerates gitignored dist/ (purple.js/.d.ts/.maps + compiled tests) on disk
npm run docs:sync    # node scripts/pagenary-docsite.mjs → rewrites TRACKED docsite/t3mp3st-docs/{content/*,config.json,manifest.json} + tenants.json
```
- `npm test` (vitest run src) imports `src/` directly — dist not involved in unit tests; `test:gate` runs `npm run build --silent` first; `test:release` ends with `npm run build` [VERIFIED: package.json:80-84,121].
- **`npm run docs:build` / `docs:check` / `docs:serve` are NOT runnable on this host**: they chain `pagenary build t3mp3st-docs`, and the `pagenary` CLI is neither on PATH nor in dependencies [VERIFIED: `command -v pagenary` → not found; package.json grep]. `docs:sync` is pure node and is sufficient for the same-commit tracked-mirror regen; the static-site build is a CI/deploy concern [ASSUMED: CI builds the GitHub Pages site — DEFAULT_SITE_URL in scripts/pagenary-docsite.mjs:6].

## Supersession Entry (Q5)

Log: `.planning/milestones/v1.3-phases/SUPERSESSION.md` — append-only; rule: "any post-Phase-21 v1.4 commit whose diff touches a file named in a NN-VALIDATION.md Per-Task Verification Map MUST append one row in the SAME commit, citing the new green command that re-evidences the mutated surface" [VERIFIED: SUPERSESSION.md header].

Row shape (phase-22 precedent, verbatim columns): `| Date | v1.4 Phase (req) | Mutated surface (files) | Validation affected | New evidence (command → result) | Commit |`.

**The phase-23 row must name these 20-VALIDATION.md map rows** (its Per-Task Map, read this session):

| 20-VALIDATION row | Surface | Why phase 23 touches it |
|---|---|---|
| P20-C1 | `npx vitest run src/__tests__/purple-v2.test.ts` (16-row risk table) | purple.ts mutated behind it; re-run as evidence (file itself unchanged) |
| P20-C2b | "prose/tier pins current" — `npx vitest run src/__tests__/teams-modules.test.ts` | Directly mutated (pins rewritten) |
| P20-C3a | full `npm run test:pr` spine (also cites lint 177) | Gate table re-run; feeds the locked "running lint count, no net-new" criterion |
| P20-C4 | orphan probe `src/__tests__/v13-class-probes.test.ts` (rows byte-identical) | Relational pin must stay green across the derivation swap |

Suggested evidence cell pattern (mirrors the phase-22 row): `npx vitest run src/__tests__/purple-v2.test.ts src/__tests__/teams-modules.test.ts src/__tests__/v13-class-probes.test.ts && npm run build && npm run docs:sync → ALL PASS`.

## Naming Documentation (Q6)

The side-by-side note belongs in **`docs/API_REFERENCE.md` inside the existing purple section** — heading `## Dark Purple Teams` at :265, specifically at the response paragraph (:286-289) where `riskTier` gets documented and `residualRisk` gets marked derived. Content to state, with exact vocabularies [VERIFIED verbatim this session]:

- Purple synthesis tier — `PurpleRiskTier` (purple.ts:36): `'critical' | 'high' | 'medium' | 'low' | 'info'` — per-coverage-matrix-row residual risk, derived f(severity, detection, verdict).
- Arsenal approval-gate tier — `RiskTier` (types/index.ts:420): `'local_read' | 'passive' | 'active' | 'intrusive' | 'credential' | 'dangerous'` — tool-execution gating vocabulary (`CustomTool.riskTier`, types/index.ts:451).
- One sentence of "unrelated despite the shared name; renaming requires contract sanction" — then the mirror regen carries it to the docsite automatically.

## Must Not Change (Q7)

1. **API response shape**: field names/set of `coverageMatrix` rows (`findingId`, `detection`, `verdict`, `riskTier`, `residualRisk`), `unresolved`, `nextMissions`, `correlation`; route status codes and 400 messages (server.ts:6416-6445); `res.status(201).json(synthesis)` (:6485).
2. **purple-v2.test.ts tier pins** (:110-152) — locked "untouched"; they must pass without edits.
3. **Tier function inputs/semantics** — `residualRiskTier` severity base, `'none'` bump, violation floor, medium default (purple.ts:80-90) and its constants.
4. **The arsenal `RiskTier` type and gate** (types/index.ts:420,451; src/arsenal/approval.ts:46-48; src/arsenal/index.ts:401-407) — different vocabulary, different domain.
5. **`v13-class-probes.test.ts`** orphan probe (:76-95) — relational, must stay green unmodified.
6. **Behavioral invariants**: `unresolved` membership (`detection === 'none' || verdict === 'violation'`) and `nextMissions` prefixes (`Detection engineering:`, `Telemetry backlog:`, `ROE remediation:`, `Approval path:`, trailing `Purple regression`) — pinned in teams-modules :256-257,281 and purple-v2 :157-206.

## Pin Mechanics (Q8)

**How teams-modules asserts prose today** — substring containment, **not** verbatim snapshot [VERIFIED: src/__tests__/teams-modules.test.ts:253,255]:
```ts
expect(result.coverageMatrix[0].residualRisk).toContain('no detection');
expect(result.coverageMatrix[1].residualRisk).toContain('low residual risk');
```
(The purple block lives at :243-283; three `it`s cover correlation/violations/needs-approval + missing-detection tolerance.)

**Whole-tier-table parity pin shape** — in-repo precedent is the purple-v2 CASES loop (16 rows, per-row labeled expect) [VERIFIED: src/__tests__/purple-v2.test.ts:110-141]. Note: CONTEXT's phrase "white-suite pin style" has no table-driven match in white-suite.test.ts (grep for `CASES|TABLE|.every(` → no hits); the apt precedent for this module is purple-v2's own table. Recommended form for teams-modules.test.ts [INFERENCE]:

```ts
it('derives prose strictly from the tier across the whole tier vocabulary', () => {
  const EXPECTED: Record<PurpleRiskTier, string> = {
    critical: `…`, high: `…`, medium: `…`, low: `…`, info: `…`,   // exact per-tier templates
  };
  for (const tier of ['info', 'low', 'medium', 'high', 'critical'] as const) {
    const result = synthesize({ findings: [{ id: 'x-1', severity: SEVERITY_THAT_YIELDS[tier] }],
                                detections: [gap('x-1', COVERAGE_THAT_YIELDS[tier])],
                                verdicts: [], verdictsByFinding: {} });
    expect(result.coverageMatrix[0].riskTier, tier).toBe(tier);
    expect(result.coverageMatrix[0].residualRisk, tier).toBe(EXPECTED[tier]);  // string equality, not contains
  }
});
```
Plus (strongest form): if the writer is exported, a source/shape pin asserting `synthesize`'s row builder routes through `RISK_PROSE_BY_TIER[riskTier]` and that `RISK_BY_SEVERITY`/`riskWord` are gone — the roe-store-pins.test.ts source-containment idiom is the repo's precedent for wiring pins [VERIFIED: src/__tests__/roe-store-pins.test.ts:7-23].

**Tier-yielding inputs for the pin table** (from the matrix above): `info` ← severity info + covered; `low` ← low + covered; `medium` ← medium + covered (or low + none); `high` ← medium + none (or any + violation floored from below); `critical` ← critical + any (or high + none).

## Code Examples

All shown above (producer anatomy :36-39/:47-57/:59-92/:127-138; parity pin; derivation shape). No external-doc examples apply — closed repo-internal domain; no documentation_lookup was needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Two signals in one row (prose from severity word; tier from full f) | One signal: tier is authoritative, prose a derived rendering | v1.4 Phase 23 (this phase) | Contradiction classes (medium+none; covered/partial+violation) become structurally impossible |
| Prose branches on detection-then-verdict (purple.ts:127-135) | Strict tier-keyed templates | this phase | Per-branch guidance collapses into per-tier templates (documented trade, owner-locked) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Exact per-tier template **wording** is chosen at plan time and is owner-visible (new operator-visible strings; the remediation clause from :133 cannot survive verbatim under strict tier keying — its content must be folded into tier-honest wording or consciously dropped) | Agreement-Pin Target Table / Open Questions | Operator guidance loss or misleading prose if worded carelessly — recommend a checkpoint on final wording |
| A2 | Parity pin lands in teams-modules.test.ts using the purple-v2 CASES idiom (UNIFY-01 names teams-modules; purple-v2 is locked untouched) | Pin Mechanics | Low — pin file placement only |
| A3 | The pagenary static-site build runs in CI (GitHub Pages via DEFAULT_SITE_URL), so skipping un-runnable `docs:build` locally loses no phase evidence | Rebuild & Mirror Regeneration | Low — docs:check (link strictness) skipped on host; if CI doesn't build it, mirror publishing needs a home |
| A4 | CONTEXT's "white-suite pin style" refers loosely to table-driven pins; no such pattern exists in white-suite.test.ts [VERIFIED negative grep] — purple-v2 CASES is used as the cited precedent instead | Pin Mechanics | Low |

## Open Questions

1. **Final per-tier template wording** (A1) — the one genuine design decision. Within the locked strict-tier constraint: tier templates must be truthful for *every* input combo that yields the tier (e.g. tier `high` covers both "no detection" and "violation, fully detected" rows), so avoid branch-specific claims ("no detection covers…", "pending ROE remediation…") unless worded tier-honestly. Recommendation: planner drafts all five templates in the plan; flag wording for a quick owner confirm since strings are operator-visible and relayed by the skill.
2. **Does the prose writer interpolate `{findingId}{subject}`?** Current prose embeds both (:129-135) and operators.html renders it per row; dropping them would blind the UI to which finding a prose string belongs to. Recommendation: keep interpolation (rendered data, not a signal input — consistent with "keys STRICTLY on the tier").
3. **Route comment**: touch or not? ARCHITECTURE says "comment update only" for server.ts; any server.ts edit recompiles dist/server.js on disk (harmless, gitignored). Either choice is contract-safe; minimal-diff favors leaving server.ts alone.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/docs:sync/tests | ✓ | v24.18.0 (engines ≥22.19.0) | — |
| typescript (tsc) | `npm run build` | ✓ (devDep) | ^5.3.3 | — |
| vitest | all test evidence | ✓ (devDep) | ^4.1.9 | — |
| eslint | lint gate | ✓ (devDep) | ^9.39.2 | — |
| `pagenary` CLI | `docs:build`/`docs:check`/`docs:serve` | ✗ | — | Use `npm run docs:sync` (pure node) for the committed mirror regen; static build stays in CI |

**Missing dependencies with no fallback:** none blocking. **With fallback:** pagenary CLI (above) — planner must not gate the phase on `docs:check`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.9 [VERIFIED: package.json:181] |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts']`; file is coverage-gate-only, discovery on defaults) |
| Quick run command | `npx vitest run src/__tests__/teams-modules.test.ts src/__tests__/purple-v2.test.ts src/__tests__/v13-class-probes.test.ts src/__tests__/ui-inline-scripts-parse.test.ts` (<1s; 20-VALIDATION measured suites <1s) |
| Full suite command | `npm run test:pr` (= `npm run lint && npm run typecheck && npm test && npm run doctor`; ~25s per 20-VALIDATION) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UNIFY-01 | Single pure tier→prose writer; severity-word path removed | unit (behavioral + wiring) | `npx vitest run src/__tests__/teams-modules.test.ts` | ✅ (edit in place) |
| UNIFY-01 | Whole-tier-vocabulary prose↔tier parity (string equality per tier) | unit (table pin) | `npx vitest run src/__tests__/teams-modules.test.ts` | ❌ Wave 0 (new `it` inside existing file) |
| UNIFY-01 | Tier math untouched | regression (locked pins) | `npx vitest run src/__tests__/purple-v2.test.ts` | ✅ unmodified |
| UNIFY-01 | Orphan-verdict rows stay byte-identical | regression (relational) | `npx vitest run src/__tests__/v13-class-probes.test.ts` | ✅ unmodified |
| UNIFY-01 | operators.html edit keeps inline JS parseable + asset pins | static gate | `npx vitest run src/__tests__/ui-inline-scripts-parse.test.ts src/__tests__/tauri-scaffold-static.test.ts` | ✅ unmodified |
| UNIFY-01 | Committed mirror regenerated from source | command evidence | `npm run build && npm run docs:sync` (then `git diff --stat docsite/`) | n/a (receipt, not a test) |
| UNIFY-01 | Browser render of the tier cell | **manual-only** | — | Justified: live-server browser render has no harness (same call as 20-VALIDATION's Manual-Only row) |

### Sampling Rate
- **Per task commit:** quick run command (or the single relevant file).
- **Per wave merge:** full `npm run test:pr`.
- **Phase gate:** `test:pr` green **+** `npm run build` + `npm run docs:sync` + gate receipt recording lint count (0 errors, no net-new warnings vs 177) + SUPERSESSION row appended.

### Wave 0 Gaps
- [ ] `src/__tests__/teams-modules.test.ts` — add the whole-vocabulary parity `it` (only gap; no new files, no framework install)

## Security Domain

> `security_enforcement` not configured (no `.planning/config.json` exists) → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched (route guards unchanged) |
| V3 Session Management | no | — |
| V4 Access Control | no | Bearer/CSRF/anti-rebinding guards untouched |
| V5 Input Validation | **yes (output side)** | New operators.html tier cell MUST render through `Shell.escHtml` like sibling cells (:262-266); route input validation untouched (400s preserved) |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via rendered synthesis fields in operators.html | Tampering/Info-disclosure | `Shell.escHtml` on every interpolated field (existing pattern; tier comes from a fixed vocabulary but escapes anyway) |
| Misleading risk evidence (tier/prose contradiction on a violation) | Repudiation (operator misled about posture) | The parity pin itself — prose↔tier agreement is an integrity control, enforced by test |
| Stale contract docs (mirror drift) | Repudiation | `docs:sync` regen same-commit; never hand-edit (PITFALLS §2) |

## Sources

### Primary (HIGH confidence — all read this session)
- `src/teams/purple.ts:36-39, 47-57, 59-92, 80, 123-141` — types, word table, tier model, prose composition (verbatim quotes inline)
- `src/server.ts:915, 1202, 1274, 6410-6486` — route, validation, persistence slot, 201 response, counts-only event
- `src/__tests__/teams-modules.test.ts:243-283` — prose substring pins; `src/__tests__/purple-v2.test.ts:100-206` — 16-row tier CASES + invariants; `src/__tests__/v13-class-probes.test.ts:76-95` — orphan probe; `src/__tests__/roe-store-pins.test.ts:7-41` — wiring-pin idiom; `src/__tests__/ui-inline-scripts-parse.test.ts:1-63` — docs HTML parse gate
- `docs/operators.html:96, 262-266`; `docs/API_REFERENCE.md:265-289`; `grokbot/skills/dark-purple/SKILL.md:90-128`; `src/mcp-server.ts:216-218, 431-435`
- `src/types/index.ts:417-421, 444-452` — arsenal `RiskTier` vocabulary + `CustomTool.riskTier`
- `package.json` (scripts :14-78, devDeps :176-182, engines :183-185); `tsconfig.json` (outDist/declaration/include); `vitest.config.ts`; `.gitignore:2`
- `scripts/pagenary-docsite.mjs:1-90, 330-424` — mirror pages list (API_REFERENCE at :76-77) + write/manifest logic
- `.planning/milestones/v1.3-phases/SUPERSESSION.md`; `.planning/milestones/v1.3-phases/20-purple-v2-defend-ui/20-VALIDATION.md`
- Git facts: `git ls-files dist/` → 0; `git check-ignore dist/teams/purple.js` → match; `docsite/…/API_REFERENCE.md` + `manifest.json` + `tenants.json` tracked; mirror last-touched `53b95ed` 2026-10-10 vs source `d79fea9` 2026-10-12

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` §2, `FEATURES.md` §3, `PITFALLS.md` §2, `SUMMARY.md` §Phase 3 (consumer map superseded by this file's enumeration where they differ)

### Tertiary (LOW confidence)
- None — no web sources used (repo-internal domain).

## Metadata

**Confidence breakdown:**
- Producer/consumer/pin mechanics: HIGH — every line read and quoted this session
- Rebuild/mirror mechanics: HIGH — commands, gitignore state, and staleness verified by direct probes
- Template-wording guidance: MEDIUM/[INFERENCE] — locked constraint honored; exact strings are a plan-time decision

**Research date:** 2026-10-12
**Valid until:** 2026-11-11 (stable internal surface; re-verify only if purple.ts or the docsite pipeline moves)
