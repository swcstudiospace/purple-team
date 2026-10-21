# Phase 30: Four-Hat Tooling, Security Guardrails & Composable Skills - Context

**Gathered:** 2026-10-15
**Status:** Ready for execution
**Graph:** `ut-mva0xpbk-30f78d96` (`SPE-14018`..`SPE-14024`)

## Repository Discovery & 4th Hat Identity

- **Product & 4 Hats Architecture**: Purple Team is a 4-Hat educational Vulnerability AI comprising **Red Hat** (offensive discovery, validation & adversary simulation across 8 operator archetypes), **Blue Hat** (detection engineering, D3FEND hardening, workflow sequencing, decision ledger & execution monitoring, plus `sentinel`/`warden` specialists), **Black Hat** (stealth routing, OPSEC risk/failure analysis, policy validation & stress probing, plus `specter`/`wraith` specialists), and **White Hat** (ROE governance, structured data inspection, evidence collection & information gap analysis, plus `arbiter`/`auditor` specialists), with **Purple** as orchestrator-level cross-hat synthesis.
- **Stack**: TypeScript ESM backend (`src/server.ts`, `src/mcp-server.ts`, `src/teams/`, `src/arsenal/`), compartmentalized HTML5 + vanilla JS frontend (`docs/*.html`, `docs/assets/shell.js`, `docs/assets/tokens.css`), and Tauri 2.12 desktop/mobile wrapper (`src-tauri/`).
- **Clarification Defaults**:
  - `q1` (Mobile build): Installable PWA (`docs/manifest.webmanifest`) + LAN/remote pairing alongside the existing Tauri 2.12 desktop & mobile wrapper (`src-tauri/`).
  - `q2` (Tool engine): Deterministic local engines by default with optional LLM integration where configured.
  - `k1` (Desktop pkg): Tauri shell (`com.t3mp3st.app`) loading `docs/` paired with `t3mp3st-server` sidecar on `127.0.0.1:3333`.
