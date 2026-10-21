---
status: passed_with_open_validation
phase: 36-fullscreen-agent-panel
verified: 2026-10-21
suite_observed: vitest src/__tests__ 127 files and 1553 tests passed; ui:typecheck clean; ui:build clean (main chunk 256.16 kB, Markdown split); browser check of the sandboxed GenUi frame under the tightened CSP passed; eslint clean on the changed TypeScript files
---

# Phase 36 Verification: Full-Screen Agent Panel and GenUi Merge

## Requirement audit (36-CONTEXT sections 1 to 9, against the current tree)

| ID | Requirement | Status | Note |
|---|---|---|---|
| R1 | Nav without generative-ui; legacy hash redirect via replaceState | PRESENT | Target section id is `chat`, not `agent-panel` |
| R2 | Workbench class only when active; three-state rail, persisted | PRESENT | Key `t3mp3st.ui.prefs.v1` |
| R3 | Alt+digit keys; Escape precedence | PRESENT | Six sections; help text corrected this pass |
| R4 | 80ch measure; three bands; 1024 and 640 breakpoints | PARTIAL | Bands sit inside `apx-body`; effective measure is 80ch; breakpoints present |
| R5 | Sidebar with Rename and Delete dialogs, aria-current, empty state | PRESENT | Search and export are extras |
| R6 | Store: env path, 0600, atomic write, corrupt recovery, caps | PRESENT | Byte cap fixed this pass; store test file added |
| R7 | Six routes beside /api/chat; zod validation | PARTIAL | Routes present and mounted; validation is hand-written |
| R8 | Client store in zustand; PUT sync; wire stripping; 40/48k trim | PARTIAL | Metas and debounce in zustand; drafts in a module map; wire helpers moved and tested |
| R9 | react-markdown, remark-gfm, rehype-highlight; URL allowlist; lazy | PRESENT | Lazy split achieved this pass |
| R10 | Stop, regenerate, retry | PRESENT | |
| R11 | Pinning within 48 px; jump with count | PRESENT | |
| R12 | Per-thread drafts; Enter, Shift+Enter, IME | PRESENT | |
| R13 | Run card: part type, fields, in-place update, cancel, errorCode | PARTIAL | Payload and state names differ from the spec; cancel works |
| R14 | GenUi frame: sandbox, CSP, allowlist, origin checks, fallback | PRESENT | CSP tightened and verified in a browser |
| R15 | GenUiPanel deleted; library, boundary and CSS kept | PRESENT | |
| R16 | Overview and reports untouched | DEVIATION | Overview changed by phase 34 P1b; Reports gained a panel this session |
| R17 | Accessibility: log role, throttled announcements, dialogs, reduced motion | PARTIAL | RepoEntry trap added; AgentPanel configure-dialog trap not verified |
| R18 | Tests: store, wire, frame protocol | PARTIAL | Added this pass; no UI behaviour tests |
| R19 | Build emits both entries | PRESENT | `ui/vite.config.ts` input: main and genui |
| R20 | Deviations recorded | PRESENT | Listed in 36-01-SUMMARY |

## Open

- Streaming on a live model (pinning, regenerate on reload). Needs a model run.
- Manual keyboard pass and AgentPanel configure-dialog focus trap.
