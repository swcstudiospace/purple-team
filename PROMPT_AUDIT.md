# T3MP3ST Prompt Audit — XML Uplift

Baseline: `f2eec3c` · generated pre-uplift, frozen as preservation contract
(`scripts/prompt-manifest.json`).

## Schema mapping

| Original structure | XML form |
|---|---|
| Leading role paragraph | `<role>…</role>` |
| `## Section Title` | `<section-title>` (kebab-case) |
| `### Phase N — X` | `<phase name="Phase N — X">` |
| `### Other Sub-heading` | `<sub-section name="…">` |
| Headerless standalone prompt | wrapped in `<directive>` |
| Interpolated heading (`## Security Finding: ${title}`) | `<section name="…">` |
| Shared consts (DOCTRINE / REACT_PREAMBLE / OPSEC_RULES / AUTHORIZATION_NOTICE) | tagged once; composed via existing `${CONST}` interpolation |
| **Bold** pseudo-headings, finding-field specs, report formats, JSON output blocks | payload — intentionally unchanged |

## Mechanical guarantees

- **XML conformance**: every prompt unit carries ≥1 section tag; all tags balance
  (`scripts/prompt-audit.mjs`: xml-section-tag / balanced-tags / no-markdown-headers).
- **Preservation**: every directive line recorded in the frozen baseline must appear
  (containment match, whitespace-normalized) in the rewritten unit — enforced by lint
  (`node scripts/prompt-manifest.mjs` → exit 0), not manual review.
- **Composition-aware**: shared constants are expanded before both checks, so composed
  prompts are validated on their fully-assembled text.

## Existing audit check renames (token-only; semantics unchanged)

| Check | Old token (markdown heading) | New token (XML tag) |
|---|---|---|
| prompt operating standard exists | Prompt Operating Standard | <prompt-operating-standard> |
| hacker mindset explicit | Hacker Mindset | <hacker-mindset> |
| creative agency explicit | Creative Agency And Meta-Prompting | <creative-agency-and-meta-prompting> |
| pliny north star preserved | Pliny North Star | <pliny-north-star> |
| defensive arsenal covenant | Defensive Arsenal Covenant | <defensive-arsenal-covenant> |
| forefront adversarial mandate | Forefront Adversarial Mandate | <forefront-adversarial-mandate> |
| fixer repair boundaries | What You May/Must Not Do Automatically | <what-you-may-do-automatically> / <what-you-must-not-do-automatically> |

## Per-prompt status (template units)

| Unit | Baseline directives | Tags | Preservation |
|---|---|---|---|
| `PLINIAN_OPERATOR_DOCTRINE` | 71 | 7 | ✅ |
| `GENERAL_SYSTEM_PROMPT` | 156 | 16 | ✅ |
| `GENERAL_REPLAN_PROMPT` | 26 | 4 | ✅ |
| `THE_FIXER_SYSTEM_PROMPT` | 113 | 14 | ✅ |
| `taskExecution` | 7 | 3 | ✅ |
| `findingReport` | 9 | 3 | ✅ |
| `analysisRequest` | 7 | 2 | ✅ |
| `COGNITION_PROMPTS.chainOfThought` | 8 | 1 | ✅ |
| `COGNITION_PROMPTS.react` | 8 | 1 | ✅ |
| `COGNITION_PROMPTS.treeOfThought` | 8 | 1 | ✅ |
| `REASONING_PROMPTS.riskAssessment` | 16 | 1 | ✅ |
| `REASONING_PROMPTS.decisionMatrix` | 9 | 1 | ✅ |
| `REASONING_PROMPTS.exploitability` | 20 | 1 | ✅ |
| `WORKFLOW_PROMPTS.reconWorkflow` | 19 | 1 | ✅ |
| `WORKFLOW_PROMPTS.vulnScanWorkflow` | 20 | 1 | ✅ |
| `WORKFLOW_PROMPTS.exploitWorkflow` | 21 | 1 | ✅ |
| `SPECIALIZED_PROMPTS.webAppTesting` | 31 | 1 | ✅ |
| `SPECIALIZED_PROMPTS.apiTesting` | 23 | 1 | ✅ |
| `SPECIALIZED_PROMPTS.cloudSecurity` | 23 | 1 | ✅ |
| `SPECIALIZED_PROMPTS.networkPentest` | 20 | 1 | ✅ |
| `WORKER_SYSTEM_PROMPT` | 16 | 4 | ✅ |
| `ORCHESTRATOR_DECOMPOSE_PROMPT` | 8 | 8 | ✅ |

## Quoted-string pools (structured data — preservation scope only)

| Pool | Strings | Converted | Status |
|---|---|---|---|
| `quotes:WORKFLOW_PRESETS` | undefined | — | ✅ |
| `quotes:FOREFRONT_PRESSURE_LANES` | undefined | — | ✅ |
| `quotes:RESOURCE_PACKS` | undefined | — | ✅ |
| `quotes:AGENT_PROMPT_PACKS` | undefined | — | ✅ |
| `quotes:OPERATOR_RUNBOOKS` | undefined | — | ✅ |

## Gate results at time of writing

- `node scripts/prompt-audit.mjs` → exit 0 (38/38 checks)
- `node scripts/prompt-manifest.mjs` → exit 0 (27/27 units)
- `npm run verify-claims` → exit 0 (27 passed, 0 failed)
- `npx vitest run no-phantom-tools index ai-redteam-playbook` → 56/56
- `npx tsc --noEmit` → exit 0

## Scope notes

- `src/resources/index.ts` packs are structured data (served via API, asserted by tests);
  they carry no markdown-header templates. They join the preservation manifest;
  conversion N/A by classification.
- `src/resources/ai-redteam-playbook.ts`: technique records, not prompt templates — read-only.
- Denylist honored: no external software handling, no network ops, no target-specific
  content; authorization/RoE language byte-preserved.
