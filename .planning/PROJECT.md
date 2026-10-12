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

## Current Milestone: v1.4 Hardening & Validation

**Goal:** Close the v1.3 audit tech-debt and promote unvalidated phases to verified.

**Target features:**
- ROE-01 — real ROE text source in server state; `/api/teams/white/roe` emits verdicts-on-record
- VAL-01 — retroactive validate-phase for v1.3 phases 15–20 (VALIDATION.md, Nyquist promotion)
- UNIFY-01 — residualRisk prose and riskTier unified into one signal across all consumers
- OPS-01 — docker healthcheck exercised in a real container
- OPS-02 — desktop installer matrix built on this host (not CI-only)
- LINT-01 — lint warning baseline restored to ≤176 with no new warnings

## Requirements

### Validated

- ✓ Provider backbone with OpenRouter/Venice/LiteLLM/Anthropic/OpenAI/NanoGPT/Novita/Ollama adapters — main
- ✓ Subscription sign-in for Super Grok Heavy (xai device flow) and Claude Pro/Max (anthropic PKCE) — uncommitted base
- ✓ Mission lifecycle: drafts, route previews, approvals, evidence/findings/retest ledgers, watch loop, self-heal — main
- ✓ ChatGPT Plan + Cursor Plan first-class providers (native openai OAuth vendor, ChatGPTAdapter, cursor-agent CLI spec, server routes) — v1.0 Phase 1
- ✓ Dark Purple core (black/blue/white archetypes + teams modules + purple synthesis + server integration) — v1.0 Phase 2
- ✓ White/red compartmentalized UI (11 pages + shared shell/tokens, all-5-provider settings, team pages) — v1.0 Phase 3
- ✓ Grok Bot package (rosters, 5 templates, 7 slash skills, marketplace) + MCP proxy tools — v1.0 Phase 4
- ✓ Specialized team Hats: specter/wraith (black), sentinel/warden (blue), arbiter/auditor (white) — prompts, grants, lanes, manifest — v1.1 Phase 6
- ✓ Grok chat slash-command abstractions: hat-scoped skills + MCP tools + command grammar — v1.1 Phase 7
- ✓ UI complete redesign + polish: tokens, motion with reduced-motion kill-switch, mobile viewports — v1.1 Phase 8
- ✓ Tauri 2.0 wrapper: locked-down scaffold, capabilities, bundle wiring — v1.1 Phase 9
- ✓ Repo re-home: fresh `main` on `swcstudiospace/purple-team`, AGPL-3.0 → MIT, identity sweep — v1.2 pre-phase
- ✓ Tauri bundle completion: @tauri-apps/cli, committed icon rasters, Rust sources, strict-JSON configs, `cargo check` green; mobile-init blockers recorded — v1.2 Phase 11
- ✓ Node server sidecar: `@yao-pkg/pkg` node22 binary from `dist/server.js`, `externalBin` + docs resources, Rust spawn/reap outside dev, same-origin `/ui/` navigation, tauri.localhost origin handling — v1.2 Phase 12
- ✓ Remote-access hardening: non-loopback binds (incl. Docker) refuse to start without `T3MP3ST_BEARER_TOKEN[_FILE]`; `/api` bearer + per-IP 60/min burst-120 limit; loopback unchanged; MCP proxy sends the bearer — v1.2 Phase 13
- ✓ Color suites at red parity: detection/emulation/governance catalog categories (+12 adapters, 120 total), D3FEND + ATT&CK v19.2 attributed vendors, blue/black/white engine suites, three deterministic corpus benches (CI-pinned), four playbooks, nine color routes, purple v2 id-keyed synthesis + riskTier + persistence, Defend UI, 12 MCP tools — v1.3 Phases 15–20

### Active

- [ ] ROE-01: Operator can load ROE text into server state so `/api/teams/white/roe` produces verdicts-on-record
- [ ] VAL-01: Phases 15–20 carry retroactive VALIDATION.md evidence (validate-phase pass, Nyquist promotion)
- [ ] UNIFY-01: residualRisk prose and riskTier collapse into one deterministic signal; every consumer updated
- [ ] OPS-01: Docker healthcheck verified by a real container run
- [ ] OPS-02: Desktop installer matrix observed building on this host
- [ ] LINT-01: Lint warning count back to ≤176 with zero new warnings

### Out of Scope

- Any jailbreak/guardrail-bypass prompting — repo doctrine: honest authorization restatement only
- Remote/multi-tenant server exposure — threat model is single-operator loopback; non-loopback binds are opt-in and now bearer-gated
- Deploying/hosting anything — no infra changes
- Live defensive-tool execution from the desktop app — analysis-first posture; blue tooling validates detections, it does not operate EDR/SIEM estates

## Context

- TypeScript ESM, Node >= 22.19, vitest, express; UI is static pages under `docs/` served at `/ui` (bundled into Tauri via `frontendDist`, also served by the sidecar).
- Repo: `github.com/swcstudiospace/purple-team`, MIT, fresh history from 2026-10-10 (pre-reset bundle at `../purple-team-pre-reset.bundle`).
- Desktop: Tauri 2.12 shell spawns the packaged API server as a sidecar on 127.0.0.1:3333; capabilities stay `core:default`.
- GSD planning (this directory): v1.0–v1.2 archived under `.planning/milestones/`.
- Known debt (accepted at v1.2 close): no phase VERIFICATION files; installer matrix CI-only; docker healthcheck edited but unrun; mobile `gen/` needs JDK/Android-SDK or macOS/Xcode.

## Constraints

- **Security posture**: loopback bind by default, origin/CSRF/Host guards, bearer + rate limit off loopback, no secrets in UI or logs — preserve in all phases. Tauri capabilities stay locked down (no blanket shell/fs).
- **Doctrine**: all prompts extend the PLINIAN authority model; no refusal-evasion, no destructive anti-forensics.
- **Stack**: no new runtime dependencies unless unavoidable; TS strict, ESLint, vitest conventions.
- **API stability**: existing `/api/*` routes keep their contracts; UI redesign is presentation-only.
- **Tests**: UI parse-guard and static pins evolve with the surface; never weaken pins to vacuity.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ChatGPT Plan = native OAuth vendor (`openai`) + Codex-backend adapter; Cursor Plan = cursor-agent CLI spec + provider alias | Matches existing oauth.ts/local-agents patterns; no fabricated endpoints — env-overridable URLs | ✓ Good |
| Purple is an orchestrator-level synthesis loop, not a spawnable operator | Red/blue/white are execution roles; purple correlates their outputs | ✓ Good |
| Grok Bot host settled from evidence; grokbot/README.md documents platform + format | User mandated the programming-desk pattern | ✓ Good |
| Local-agent tests must be PATH-hermetic (hermeticPath pattern) | Real host CLIs broke 10 pre-existing tests | ✓ Good |
| White referee kit stays 9 tools; toolkits gate tiered | Padding with active probes would violate doctrine | ✓ Good |
| v1.1 hat ids: specter/wraith (black), sentinel/warden (blue), arbiter/auditor (white) | Two specialized Hats per discipline, same integration pattern as v1.0 teams | ✓ Good |
| Re-home before v1.2 phases: fresh root, MIT, identity sweep | Owner-directed; pre-reset work preserved in a bundle | ✓ Good |
| v1.2 sidecar = `@yao-pkg/pkg` node22 from tsc output | pkg-fetch 3.6 dropped node20 bases; Node SEA rejected (postject, no cross-build story) | ✓ Good |
| v1.2 Rust spawns sidecar via `std::process::Command`, not tauri-plugin-shell | Keeps capabilities at `core:default`; renderer gains no execution surface | ✓ Good |
| v1.2 non-loopback binds fail closed without a bearer | Intentionally breaks unauthenticated Docker `0.0.0.0` exposure — the vulnerability being closed | ✓ Good |
| v1.2 Windows webview origin (`tauri.localhost`) trusted as page origin, never as Host | Host allow-list stays literal loopback to keep the anti-rebinding gate intact | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-12 at v1.4 start*
