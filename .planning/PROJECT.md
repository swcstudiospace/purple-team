# T3MP3ST — Red Team AI

## What This Is

T3MP3ST (Tactical Execution Multi-agent Platform for Elite Security Testing) is a local-first,
multi-agent red-team harness: an express API + single-operator UI, a ReAct agent loop over a
pluggable LLM backbone, an Arsenal of security tools, mission/evidence/findings ledgers, and an
Op General / Admiral orchestration layer. Operators (security researchers, red teams, defenders)
run authorized adversarial research with scope receipts, approval gates, and evidence-backed findings.

## Core Value

Every adversarial claim hardens into scoped, receipt-backed, retestable evidence — power without
provenance is failure.

## Requirements

### Validated

- ✓ Provider backbone with OpenRouter/Venice/LiteLLM/Anthropic/OpenAI/NanoGPT/Novita/Ollama adapters — main
- ✓ Subscription sign-in for Super Grok Heavy (xai device flow) and Claude Pro/Max (anthropic PKCE) — uncommitted base
- ✓ Mission lifecycle: drafts, route previews, approvals, evidence/findings/retest ledgers, watch loop, self-heal — main
- ✓ ChatGPT Plan + Cursor Plan first-class providers (native openai OAuth vendor, ChatGPTAdapter, cursor-agent CLI spec, server routes) — v1.0 Phase 1
- ✓ Dark Purple core (black/blue/white archetypes + teams modules + purple synthesis + server integration) — v1.0 Phase 2
- ✓ White/red compartmentalized UI (11 pages + shared shell/tokens, all-5-provider settings, team pages) — v1.0 Phase 3
- ✓ Grok Bot package (rosters, 5 templates, 7 slash skills, marketplace) + 9 MCP proxy tools — v1.0 Phase 4

### Active (v1.1)

- [ ] Specialized team Hats: specter/wraith (black), sentinel/warden (blue), arbiter/auditor (white) — prompts, grants, lanes, manifest
- [ ] Grok chat slash-command abstractions: hat-scoped skills + MCP tools + command grammar
- [ ] UI complete redesign + polish: refined visual system, buttery motion, mobile viewports
- [ ] Tauri 2.0 desktop + mobile wrapper: src-tauri scaffold, capabilities, bundle wiring, mobile init

### Out of Scope

- Merging the 30 unpulled upstream commits mid-mission — 7 dirty files overlap; reconciliation is user-gated, separate work
- Any jailbreak/guardrail-bypass prompting — repo doctrine: honest authorization restatement only
- Remote/multi-tenant server exposure — threat model is single-operator localhost (server.ts security comments)
- Deploying/hosting anything — no infra changes in this milestone
- Node sidecar bundling inside Tauri (recorded follow-up); non-loopback bot hosting bearer auth (recorded follow-up)

## Context

- TypeScript ESM, Node >= 22.19, vitest, express; UI is static pages under `docs/` served at `/ui`.
- Working tree carries coherent uncommitted work (OAuth vendors, prompt manifest/audit, UI additions) — treated as base state, never discarded or swept into phase commits.
- `main` is 30 commits behind `origin/main`; overlapping files make a pull conflict-prone right now.
- GSD planning (this directory): v1.0 shipped 2026-10-09 (ROADMAP.md/STATE.md); v1.1 tracked in ROADMAP.v1.1.md/STATE.v1.1.md.
- programming-desk ships no light theme/framework and no Tauri implementation — the transferable patterns are mechanisms (single `:root` custom-property block; `tauri/**` ownership paths); palettes and the Tauri scaffold are designed, not copied.

## Constraints

- **Security posture**: loopback bind, origin/CSRF guards, no secrets in UI or logs — preserve in all phases. Tauri capabilities stay locked down (no blanket shell/fs).
- **Doctrine**: all prompts extend the PLINIAN authority model; no refusal-evasion, no destructive anti-forensics.
- **Stack**: no new runtime dependencies unless unavoidable; TS strict, ESLint, vitest conventions.
- **API stability**: existing `/api/*` routes keep their contracts; UI redesign is presentation-only.
- **Tests**: UI parse-guard and static pins evolve with the surface; never weaken pins to vacuity.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on current HEAD; do not pull origin/main mid-mission | 7 dirty files overlap upstream diff; pull would entangle a merge with the mission | — Pending |
| ChatGPT Plan = native OAuth vendor (`openai`) + Codex-backend adapter; Cursor Plan = cursor-agent CLI spec + provider alias | Matches existing oauth.ts/local-agents patterns; no fabricated endpoints — env-overridable URLs | ✓ Good |
| Purple is an orchestrator-level synthesis loop, not a spawnable operator | Red/blue/white are execution roles; purple correlates their outputs | ✓ Good |
| Phases 3 (UI) and 4 (Grok Bot) dispatch in parallel | Disjoint surfaces; Grok Bot explicitly UI-less | ✓ Good |
| Grok Bot host settled from evidence (q1) | User mandated the programming-desk pattern; grokbot/README.md documents platform + format | ✓ Good |
| Restored uncommitted src/target/index.ts deletion from HEAD | Load-bearing, no replacement, reversible | ✓ Good |
| Local-agent tests must be PATH-hermetic (hermeticPath pattern) | Real host CLIs broke 10 pre-existing tests | ✓ Good |
| Manifest extractor objRe tolerates TS annotations | Pre-existing gap; all 11 operator prompts in manifest | ✓ Good |
| White referee kit stays 9 tools; toolkits gate tiered | Padding with active probes would violate doctrine | ✓ Good |
| v1.1 hat ids: specter/wraith (black), sentinel/warden (blue), arbiter/auditor (white) | Two specialized Hats per discipline, same integration pattern as v1.0 teams | — Pending |
| v1.1 order: hats → (grok abstractions + UI redesign parallel) → tauri bundle → close-out | Grok + UI consume hat surface; Tauri wraps final docs/ assets | — Pending |
| Tauri backend = external loopback server; sidecar bundling is a follow-up | Avoids shipping a node runtime inside the bundle; matches localhost threat model | — Pending |

---
*Last updated: 2026-10-09 after v1.1 bootstrap*
