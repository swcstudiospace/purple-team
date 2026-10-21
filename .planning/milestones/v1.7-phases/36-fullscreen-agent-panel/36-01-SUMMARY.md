# 36-01 Summary: Full-Screen Agent Panel and GenUi Merge

**Phase:** 36 · **Refs:** SPE-15993 · **Completed:** 2026-10-21 · **Branch:** v1.7-github-claude-agentpanel

## Shipped (commits 2c2feb5, d689796, c7b9ae4, plus the working tree)

- Workbench shell (`.shell--workbench`), a three-state rail with a persisted preference, Alt+digit section keys, and the Escape precedence.
- Conversation sidebar with Rename and Delete dialogs. Server store `src/chat/conversation-store.ts` and six routes in `src/chat/conversation-routes.ts`.
- Markdown with react-markdown, remark-gfm and rehype-highlight (no rehype-raw; URL allowlist). Copy buttons. Stop, regenerate and retry. 48 px scroll pinning with jump-to-latest.
- Inline run card (`data-purple-run`) with cancel. GenUi frame in a sandboxed iframe (`sandbox="allow-scripts"`) with a postMessage allowlist. `GenUiPanel.tsx` removed.

## Closed in this pass (from the phase audit)

1. **Frame CSP tightened** from wildcard script, style and font sources to 127.0.0.1 and localhost. Verified in a real sandboxed iframe: `genui-ready` arrives from the opaque origin, height reports follow a source message, and no CSP violation is logged. `connect-src 'none'` and `img-src data:` are unchanged. In LAN-bound mode the frame cannot load its bundle and falls back to raw source.
2. **Lazy Markdown.** The run card imported Markdown statically, which defeated the split. Main bundle went from 590.63 kB to 256.16 kB; Markdown is now its own chunk.
3. **Focus trap on the RepoEntry dialog** via `useFocusTrap`. Escape is consumed without skipping the entry.
4. **Alt+digit help text** now lists six sections.
5. **Byte-accurate 5 MB store cap** (it counted JSON characters).
6. **Shared modules.** `toWireMessages` and `trimHistory` moved to `src/chat/wire.ts`; `frameProtocol.ts` moved to `src/genui/frameProtocol.ts`. Both are covered by behavioral tests.
7. **Source-text pins removed** from the static workbench test for `frameProtocol.ts`. The validator is now tested behaviorally.

## Deviations (kept, documented)

- Section id is `chat` (label "Chat Panel"). `#agent-panel` and `#generative-ui` redirect to it.
- Drafts live in a module-level map (`chat/drafts.ts`), not in zustand. They are per thread but outside the store.
- Validation is hand-written rather than zod, in `conversation-routes.ts`.
- `Overview.tsx` changed in phase 34 P1b (Claude tier and re-auth badges). Phase 34 planned that change, so the phase-36 "Overview untouched" claim does not hold.
- `Reports.tsx` gained a mission-drafts panel in this session. Unplanned.
- File paths differ from plan section 8: prefs in `workbench/prefs.ts`, store in `stores/conversations.ts`, Markdown in `chat/markdown.tsx`, run card in `chat/run-card.tsx`, frame as `genui.html` plus `genui/frame-main.tsx`.

## Open

- **Streaming on a live model:** pinning cadence, and regenerate on a reloaded thread (plan section 9.4 Q1). Needs a model run.
- **Manual keyboard pass** in a real browser.
- **Focus trap in the AgentPanel configure dialog** (audit R17, `AgentPanel.tsx` around lines 626-644) is not verified.
