# Phase 36 Context — Full-Screen Agent Panel + GenUi Merge

**Node:** n6 · **Linear:** https://linear.app/swcstudio/issue/SPE-15993/n6-design-full-screen-agent-panel
**Gathered:** 2026-10-19 · **Branch:** `v1.7-github-claude-agentpanel` · **Status:** Ready for planning
**Locked user decisions (v1.7):** q4 = sidebar + multi-conversation history; q2 removes the pasted-snippet input in *phase 35* (this phase only consumes its run events).

Design doc only — no code changes in this node. Every claim about current code carries `file:line` evidence from the working tree at branch `v1.7-github-claude-agentpanel`. Where this doc and `.planning/v1.7-SURVEY.md` disagree, repository evidence wins (two discrepancies are called out in §1.7).

---

## 1. Current-state audit

### 1.1 App shell and navigation — `ui/src/App.tsx` (86 ln)

- Hash sections `overview | agent-panel | generative-ui | reports` (`ui/src/App.tsx:7`), declared in `NAV_ITEMS` (`:9-14`); `generative-ui` is nav entry #3 (`:12`).
- Hash is the source of truth; unknown hashes fall back to `overview` (`sectionFromHash`, `:23-26`); `hashchange` listener at `:33-37`; navigate handler `:39-43`.
- Two static links `/ui/hats.html` and `/ui/settings.html` (`STATIC_LINKS`, `:18-21`) render below the SPA links (`:64-70`).
- Layout mount: `<div class="shell">` → `<nav class="rail">` + `<main class="content">` (`:48-74`); section title `<h1 id="section-title">` always rendered above content (`:75-77`).

### 1.2 Global layout CSS — `ui/src/styles.css` (245 ln)

- Self-hosting rule stated at `:1` ("Fonts are self-hosted under /ui/assets/fonts… No external URLs.") — this constrains every dependency choice in §4.
- Design tokens in `:root` (`:53-66`), mirrored from `docs/assets/tokens.css`; the survey pins `docs/assets/tokens.css` as canonical.
- `.shell` = `display:grid; grid-template-columns: 220px 1fr; min-height:100vh` (`:92-96`) — fixed 220px rail, unbounded `1fr` content column.
- `.rail` (`:98-102`) and `.content { padding: 2rem 2.5rem; min-width: 0 }` (`:140-143`) — the content column has no max-width, so at 2560px text lines stretch edge to edge (dead-margin problem is the inverse: no measure control at all).
- **The only breakpoint in the file** is `@media (max-width: 640px)` (`:232-245`) which stacks the shell. There is no ≥1024px, no wide-screen, and no full-bleed behavior anywhere.
- Global focus-visible ring for `a/button/textarea` (`:85-90`).

### 1.3 AgentPanel — `ui/src/components/AgentPanel.tsx` (656 ln) + `agent-panel.css` (426 ln)

- 5 tabs `red | blue | white | black | unified` (`TabId`, `:7`; `TABS`, `:34-40`) with roving-tabindex keyboard handling (`:451-462`) and ARIA tablist/tabpanel (`:489-524`).
- Slash-command palette: composer is a `role="combobox"` textarea with listbox, aria-activedescendant, Escape/Tab/Arrow keys (`:572-612`, key handler `:421-449`); parses via `parseComposerInput(draft, COMMANDS)` from `src/ui-commands/registry.ts` (registry `:25-158`: `hunt`→`POST /api/mission/start` `:91-102`, `stop`→`/api/mission/stop` with `confirm: true` `:142-149`, `mission`, `findings`, team routes…).
- Command execution: `runCommand` fetches with per-entry `AbortController` (`controllersRef`, `:250`, `:326-377`), appends `TimelineEntry` cards (`:293-378`) with status pills, HTTP status, elapsed ms, Stop button per running entry (`:543-551`).
- Timeline is **height-bounded**: `.ap-timeline { max-height: 360px; overflow-y: auto }` (`agent-panel.css:80-83`); result blocks cap at `max-height: 180px` (`:225-226`), popover at 480px (`:249`), textarea at 260px (`:313-314`).
- Chat handoff: `ChatStream` is embedded below the timeline and driven imperatively — `chatRef.current?.send(text)` (`:254`, `:387`, mount at `:567`). Free text that isn't a command goes to the model; a busy chat yields `BUSY_NOTE` (`:59`, `:393-395`).
- Secret redaction duplicated here: `SECRET_KEY`/`SECRET_VALUE` regexes (`:82-83`).

### 1.4 ChatStream — `ui/src/components/ChatStream.tsx` (203 ln) + `chat-stream.css` (128 ln)

- `useChat` + module-level shared `DefaultChatTransport<UIMessage>` → `POST /api/chat` (`:25`); imperative `send()` handle (`:122-135`).
- Client history caps kept under the server's: `MAX_HISTORY_MESSAGES = 40`, `MAX_HISTORY_CHARS = 48000` (`:86-87`), `trimHistory` drops oldest first (`:101-111`); per-message ceiling 8000 chars (`:28`).
- Error mapping: `serverErrorField` + `describeError` produce redacted, clipped views for 400/409/503 bodies (`:45-83`).
- Rendering: text parts only, as bare `<p>` per part (`:191-193`) — **no markdown, no syntax highlighting, no copy buttons**.
- Scroll: unconditional `scrollTop = scrollHeight` on every message change (`:137-140`) — no stickiness detection, so scrolling up while streaming is silently fought by the component. No jump-to-latest.
- Already present (survey understated — see §1.7): a header **Stop** button wired to `useChat().stop` (`:151-155`) and **New chat** → `setMessages([])` (`:156-166`). No retry/regenerate, no persistence, no drafts.
- Status live region `role="status" aria-live="polite"` (`:148-150`).

### 1.5 Generative UI — `ui/src/genui/` (3 files + `genui.css`)

- `GenUiPanel.tsx` (224 ln): standalone prompt form (`:155-178`), `POST /api/genui/generate` (max 8000-char prompt, `:9-10`), streams plain text via `response.body.getReader()` accumulation (`:101-111`), abortable Stop (`:144-148`), then renders `Renderer` from `@openuidev/react-lang` with `genUiLibrary` inside `GenUiErrorBoundary` (`:198-205`); action events append to a list (`:203`, `:210-221`).
- `library.tsx` (117 ln): `createLibrary` with `Callout`, `SeverityBars`, `VulnerabilityCard`, `Stack`, props validated by `zod/v4` (`:1-2`, `:117`).
- `GenUiErrorBoundary.tsx` (40 ln): class boundary that swaps the renderer for raw `<pre>` of the OpenUI Lang source and retries when the source changes (`:24-38`).
- `genui.css` already handles `prefers-reduced-motion: reduce` for its button/bar transitions (`:323-328`) — the pattern §7 extends.
- Server side: `app.post('/api/genui/generate', createGenUiHandler(...))` (`src/server.ts:7365`; handler in `src/genui/generate-route.ts`, spec in `src/genui/library-spec.ts`).

### 1.6 Transport, API client, state, and server caps

- `ui/src/api/client.ts`: typed `getJson`/`ApiError` helper, relative paths only (same-origin Express, `:1-31`); response types for health/oauth/mission/findings (`:57-167`). No POST/PUT helper exists yet.
- `ui/src/main.tsx`: `StrictMode` + `createRoot` mount (`ui/src/main.tsx`).
- State: `zustand ^4.5.7` is already a root dependency and **currently unused by the UI** (root `package.json` dependencies; no import in `ui/src/**`).
- **No markdown/highlight/sanitize packages exist**: grep over `package.json` for `react-markdown|remark-|rehype-|marked|markdown-it|shiki|highlight|prism|dompurify|sanitize|micromark|unified|mdx` returns nothing (verified 2026-10-19). Deps that do exist: `ai ^7.0.143`, `@ai-sdk/react ^4.0.147`, `zod ^4.6.7`, `@openuidev/*`, `conf ^12`, `express ^4`.
- Server chat: `src/chat/chat-route.ts` — `MAX_MESSAGES = 60`, `MAX_TEXT_CHARS = 64000` (`:41-42`); `validateBody` checks shape/roles/part-types but **counts only `text` part chars** (`:72-79`) and passes all parts to `convertToModelMessages` (`:14`, `:85-87`), so unknown part types (e.g. `data-*`) reaching the converter are the SDK's problem to reject — the client must strip them (§3.4). The route is **stateless**: no session/thread id, history is client-authoritative. Mounted at `src/server.ts:7364`.
- AI SDK v7 part surface (pinning the extension point for §5): `UIMessage.parts` union includes `DataUIPart` of shape `{ type: \`data-${NAME}\`; id?: string; data: T }` (`node_modules/ai/dist/index.d.ts:1856`, `:1999-2003`); `useChat` helpers expose `sendMessage | regenerate | stop | resumeStream | setMessages | status | messages | clearError` and accept a per-chat `id` (`node_modules/@ai-sdk/react/dist/index.d.ts:111`, `UseChatOptions` `:112-129`).
- Live event bus already exists: `GET /api/events` SSE with origin guard, 30s heartbeat, 64-client cap (`src/server.ts:5210-5258`), fed by `broadcastEvent` (`:5196-5205`) with mission/task events today: `mission:started` (`:7547`, `:7652`), `mission:stopped` (`:7762`), `task:dispatched|completed|failed` (`:8006`, `:8040`, `:8056`). `GET /api/mission/status` returns `progress[]`, `tasks[]`, findings summary (`:7802-7841`).
- Build/serving: Vite root `ui`, base `/app/`, dev proxy `/api`→`127.0.0.1:3333`, output `ui/dist` (`ui/vite.config.ts:6-19`); served by `app.use('/app', …)` (`src/server.ts:9282-9283`) alongside `app.use('/ui', express.static('docs'))` (`:9278`). Single-package repo: `ui/` has **no package.json** — all deps live in the root manifest.
- Persistence patterns to follow: JSON-file store with env override + `0600` + `mkdir -p` + in-memory cache (`src/llm/oauth.ts:129-133` `oauthStorePath` → `~/.t3mp3st/oauth.json` via `T3MP3ST_OAUTH_STORE`; `loadStore/saveStore` `:177-199`), and `ConfigManager` on `conf` (`src/config/index.ts:306-312`, singleton `:958`). Zod-validation of route bodies is the norm elsewhere; tests use injected fetch/clock (`src/__tests__/oauth.test.ts` pattern).

### 1.7 Survey discrepancies (code wins)

1. Survey says ChatStream has "no stop/retry UI" — a Stop button exists (`ChatStream.tsx:151-155`); only retry/regenerate is missing.
2. Survey's layout framing "bounded content column" — `.content` is unbounded `1fr` with fixed padding (`styles.css:140-143`); the actual defects are *no measure cap on wide screens* and *hard-coded 360px timeline* (`agent-panel.css:81`).

---

## 2. Layout — full-viewport Agent Panel

### 2.1 Shape

- **Two layout modes of the same shell.** `App.tsx` keeps `.shell` for `overview`/`reports` exactly as today (`styles.css:92-96` untouched in behavior). When `active === 'agent-panel'`, App renders the panel inside a new modifier class `.shell--workbench` (grid `[rail auto] 1fr`, height `100dvh`, `overflow: hidden`) scoped so no other section can pick it up.
- **Rail collapse.** The 220px rail (`styles.css:94`) becomes a 3-state control inside the workbench: expanded (220px) / collapsed (48px icon rail with `aria-label`s, tooltips as `title`) / hidden (full-bleed "focus mode"). Toggle button lives in the rail footer with `aria-expanded` + `aria-controls`; the collapsed rail keeps all `NAV_ITEMS` reachable as icon links.
- **Thread measure.** The thread column centers with `max-width: 80ch` (≈50rem at the 16px root, `styles.css:81`) and `width: 100%`; sidebar (§3) takes a fixed 280px (collapsible to 0) to the left of the thread inside the workbench. At 2560px the column simply centers with wide gutters — content never stretches, and the gutters are layout, not dead margins (composer and header span the same 80ch column so the eye has one anchor).
- **Vertical fill.** `.workbench` is `display:flex; flex-direction:column; height:100%; min-height:0` with exactly three bands: header (auto), thread scroller (`flex:1 1 auto; min-height:0; overflow-y:auto`), composer (auto, sticky by construction because it's outside the scroller). This replaces today's stacked boxes where the timeline is capped at 360px (`agent-panel.css:81`), the chat log is unbounded, and the composer sits below the fold.
- **Narrow behavior.** New breakpoints (scoped to workbench classes only): `≤1024px` — sidebar becomes an overlay drawer (`role="dialog"`, §7) toggled from the header, rail auto-collapses to icons; `≤640px` — existing stacked-shell media query (`styles.css:232-245`) continues to govern the *other* sections; the workbench drops to a single column with the icon rail as a top bar. The panel remains usable at 1024×768 with sidebar closed.
- **Other sections unchanged.** `Overview.tsx`, `overview.css`, `Reports.tsx`, `report.css` are not opened; `.shell`/`.rail`/`.content` rules keep their current selectors. New rules are additive and namespaced (`.shell--workbench`, `.apx-*`).

### 2.2 Persisted preferences

- New `ui/src/prefs.ts`: typed façade over `localStorage` key `t3mp3st.ui.prefs.v1` (`{ railState: 'expanded'|'collapsed'|'hidden'; focusMode: boolean; sidebarOpen: boolean; activeConversationId?: string }`), try/catch-wrapped for private-mode/quotas. Display prefs are UI-local state — they do not belong in the server conversation store (§3) or `Conf`. Hydrated once in `App.tsx` on mount; written on change.
- **Exit affordances:** (a) visible "Exit focus mode" / rail toggle buttons in the panel header; (b) `Escape` exits focus mode *only when* no palette is open and no confirm is pending (today's Escape precedence at `AgentPanel.tsx:435-443` — palette dismissal, then confirm-cancel — stays strictly first); (c) hash navigation away (`#overview`) always restores the normal shell because the workbench class is derived from `active`.
- **Keyboard operation:** every control is a native `button`/`a`/`textarea` in DOM order; rail + sidebar implement roving tabindex exactly like the existing tablist (`AgentPanel.tsx:451-462`); `Alt+1..4` jump between rail sections (registered on `window` keydown, ignored while composing — guard `event.target` is not the textarea; `isComposing` respected as today `:445`).

---

## 3. Conversations — sidebar, history, persistence

### 3.1 Sidebar UI (q4)

- New `ui/src/conversations/ConversationSidebar.tsx`: list of conversations (title, relative updatedAt, message count), "New chat" primary button, per-item actions Rename (inline `dialog`) and Delete (confirm `dialog` — mirrors the existing two-step confirm philosophy of `/stop`, `registry.ts:148`). Active item gets `aria-current="true"`. Switching conversations swaps the active `useChat` id and draft (§4.4) and persists the id in prefs (§2.2).
- Titles: default = first user message clipped to 60 chars; Rename sets an explicit title. Empty state: "No conversations yet".

### 3.2 Server store — new module `src/chat/conversation-store.ts`

Follows the `oauth.ts` JSON-file pattern (`src/llm/oauth.ts:129-199`) rather than `Conf`, because conversations are bulk user data, not settings:

- Path: `T3MP3ST_CONVERSATIONS_STORE` env override, default `join(homedir(), '.t3mp3st', 'conversations.json')` (mirrors `oauthStorePath`, `src/llm/oauth.ts:129-133`). `mkdirSync(dirname, {recursive:true})`, write with `mode 0o600`, best-effort `chmodSync` (`:196-198`).
- **Atomic writes:** serialize mutations through a promise chain; write `path + '.tmp'` then `renameSync` (oauth's plain `writeFileSync` is acceptable for a tiny token file; conversation files are bigger and written on every chat settle, so temp+rename prevents a half-written store on crash). Corrupt file on load → treated as empty (same recovery as `loadStore`, `:184-189`).
- Shapes (wire = AI SDK `UIMessage`, the type the server already speaks, `src/chat/chat-route.ts:15`):
  ```ts
  interface ConversationMeta { id: string; title: string; createdAt: number; updatedAt: number; messageCount: number; }
  interface ConversationRecord { meta: ConversationMeta; messages: UIMessage[]; }
  ```
- Caps (server-side, enforced on every write): `MAX_CONVERSATIONS = 50` (LRU-evict lowest `updatedAt`, evicted ids returned so the client can drop them), `MAX_STORED_MESSAGES = 200` per conversation (drop oldest), per-message text cap 8000 chars (same as client `ChatStream.tsx:28`), store file hard cap ~5 MB (evict conversations LRU until under). All constants exported for tests.
- Bodies validated with `zod` (already a dep, and already used in the UI's genui library, `ui/src/genui/library.tsx:2`).

### 3.3 Server routes (Express, mounted beside `/api/chat` at `src/server.ts:7364`)

| Route | Behavior |
|---|---|
| `GET /api/conversations` | `{ conversations: ConversationMeta[] }` sorted by `updatedAt` desc |
| `POST /api/conversations` | `{}` → creates `{ conversation: ConversationMeta }`; id = `randomUUID()` |
| `GET /api/conversations/:id` | full record incl. messages; 404 `{error}` JSON |
| `PATCH /api/conversations/:id` | `{ title }` (1..120 chars) |
| `DELETE /api/conversations/:id` | `{ ok: true }` |
| `PUT /api/conversations/:id/messages` | `{ messages: UIMessage[] }` → capped store (§3.2), returns fresh `meta` |

Handler module `src/chat/conversation-routes.ts` with injected store deps (same `createXHandler(deps)` seam as `createChatHandler`, `chat-route.ts:152`), registered in `src/server.ts` next to line 7364. Loopback/origin guards are the server-wide middleware already applied to `/api/*` (the SPA is same-origin, `ui/src/api/client.ts:1-4`; dev proxy `ui/vite.config.ts:11-15`). Secrets never enter these payloads (run-card/genui parts are stripped before persist — §3.4 — and redaction regexes already guard display paths).

### 3.4 Client state — zustand + how caps interact

- New `ui/src/conversations/store.ts` (first real use of the already-present `zustand ^4.5.7`): holds `metas`, `activeId`, `drafts: Record<id, string>`, `status`. Server is the single durable substrate; **no localStorage mirror of messages** (avoids split-brain). API calls go through a small `postJson/patchJson/putJson/delJson` addition to `ui/src/api/client.ts` (same `ApiError`/redaction conventions, `:6-31`).
- Each conversation = one `useChat({ id: conversationId, transport })` instance keyed by id (SDK supports per-id state, `@ai-sdk/react/dist/index.d.ts:20`, `:111`). On switch: PUT-sync the old thread (below), GET the new one, `setMessages(loaded)`.
- **Sync point:** `onFinish`/error-settle → `PUT /api/conversations/:id/messages` with the full thread (≤200 msgs stored). Debounce 1s. The "New chat" button in ChatStream (`ChatStream.tsx:156-166`) is replaced by the sidebar's (it currently wipes state with no persistence).
- **Server 60/64k cap interaction:** sending always passes the thread through the existing `trimHistory` (40 msgs/48k, `ChatStream.tsx:86-111`) — a strict subset of the server's 60/64k (`chat-route.ts:41-42`). Long stored threads therefore *render* in full (up to 200) but *submit* only the recent window. New helper `toWireMessages(messages)` (same module as `trimHistory`) additionally **strips non-text parts** (`data-purple-run`, `data-genui`, `step-start`) and drops messages left with zero parts, because `validateBody` forwards every part to `convertToModelMessages` (`chat-route.ts:72-87`) which rejects unknown part types — without this, a thread containing a run card or inline genui block would 400 on the next send.

---

## 4. Chat core upgrade

### 4.1 Markdown + code blocks — dependency decision

**Add to root `package.json` dependencies:** `react-markdown@^10`, `remark-gfm@^4`, `rehype-highlight@^7` (highlight.js arrives transitively via `lowlight`). Verify none exist today — confirmed (§1.6, grep empty).

- **Why react-markdown over marked/markdown-it:** it renders to React elements without `dangerouslySetInnerHTML`, so raw HTML in model output is *never executed* — sanitization by construction. `marked`/`markdown-it` emit HTML strings and would force DOMPurify as a second gate.
- **Why rehype-highlight over shiki:** shiki ships an Oniguruma WASM engine + grammar JSON (~600 KB+ even fine-grained, with async grammar loading at render time) — poor fit for re-rendering a streaming markdown part on every chunk; highlight.js via `lowlight`'s common-language build adds roughly 100–120 KB gz and highlights synchronously. For a localhost operator tool the size trade is right; total addition for all three packages ≈ 150–170 KB gz (react-markdown+micromark+remark-gfm ≈ 35–45 KB). The renderer is `React.lazy`-loaded per message-list so first paint of other sections pays nothing.
- **Self-hosting rule** (`styles.css:1`): the highlight.js theme CSS (`highlight.js/styles/github.css`) is `import`ed from the new component and bundled by Vite into `/app/assets/*.css` (`ui/vite.config.ts:16-19`) — no runtime external URL, no CDN link tag.
- **Sanitization story:** (1) no `rehype-raw` — HTML in markdown stays inert text; (2) custom `urlTransform` passed to `<Markdown>` allowing only `https:`, `mailto:`, and in-app relative links/anchors, replacing the default transformer; (3) code blocks rendered through a `components.code` override that emits `<pre><code class="hljs language-*">` plus the copy button — highlighted spans are class-based, not HTML injection; (4) links get `rel="noopener noreferrer"` + `target="_blank"` only for absolute https.
- **Copy buttons:** per fenced block, `navigator.clipboard.writeText` with an execCommand-free fallback disabled state; `aria-label="Copy code"`, success announced via the existing status region pattern (`role="status"`, `ChatStream.tsx:148`).

### 4.2 Stop / retry / regenerate

- Stop: keep `useChat().stop` (already wired `ChatStream.tsx:151-155`); additionally surface Stop in the composer bar while `status === 'submitted' | 'streaming'` and disable Send (today's guard is the `BUSY_NOTE` path, `AgentPanel.tsx:59`).
- Retry/regenerate: new per-assistant-message action using `useChat().regenerate()` (`@ai-sdk/react/dist/index.d.ts:111`) — "Regenerate" on the last assistant message, and "Retry" inside the error view which does `clearError()` + `regenerate()` (`ChatStream.tsx:119` already destructures `clearError`). Partial assistant text from a dropped stream stays visible until regenerate replaces it.

### 4.3 Scroll anchoring + jump-to-latest

- Replace the unconditional force-bottom (`ChatStream.tsx:137-140`) with a pinned/unpinned model: after each render, if the user is within 48px of the bottom ("pinned"), `scrollTop = scrollHeight` inside `requestAnimationFrame`; if they scrolled up ("unpinned"), do nothing. Pin state flips on `scroll`/`wheel`/`keydown(Home/End/PageUp/PageDown)` with a `scrollend`-based settle where supported.
- While unpinned, a floating "Jump to latest ↓ N new" button appears (focusable, `aria-label` includes the count); activating it scrolls bottom and re-pins.

### 4.4 Drafts, Enter/Shift+Enter, reconnect

- Per-thread drafts live in the zustand store (`drafts[id]`, §3.4); the composer reads/writes through selectors so switching conversations restores the right draft instantly. Existing Enter/Shift+Enter/`isComposing` semantics (`AgentPanel.tsx:445-448`) are preserved verbatim in the rebuilt composer.
- Reconnect/drop: a transport error mid-stream leaves the partial assistant message and the thread intact (messages are never cleared on error — today's behavior, `ChatStream.tsx:159-163` only clears on explicit New chat). The error view gains "Retry" (§4.2). The SDK's `resumeStream`/`resume` is *not* relied on because `/api/chat` streams are not resumable server-side (stateless route, `chat-route.ts`); if `resume` later proves workable it slots in behind the same Retry button. Navigating sections does not unmount thread state once conversations live in the store keyed by id.

---

## 5. Purple Team runs inline in the thread

Phase 35 (node n5 / `DesignRepoIngest`) adds repo-URL runs; this phase renders their progress as **labelled inline thread messages with Cancel**, using the SDK's data-part channel.

### 5.1 Message-part shape extension (AI SDK v7 `DataUIPart`)

`node_modules/ai/dist/index.d.ts:1999-2003` defines parts of `{ type: \`data-${NAME}\`; id?: string; data: T }`. This phase adds one name:

```ts
/** ui/src/runs/types.ts */
type PurpleRunPhase = { id: string; label: string; state: 'pending'|'active'|'done'|'error'; detail?: string };
type PurpleRunState = 'queued' | 'ingesting' | 'running' | 'done' | 'error' | 'cancelled';
interface PurpleRunData {
  runId: string;              // phase-35 run id, minted at request acceptance (before any mission exists)
  label: string;              // canonical `${owner}/${repo}@${ref}` from the phase-35 validator
  state: PurpleRunState;      // 'ingesting' → 'running' at mission handoff; 'cancelled' on abort
  phases: PurpleRunPhase[];   // ingest: resolve → fetch → analyze (detail carries the skip rollup); mission phases follow
  counters?: {
    tasksDone?: number; tasksTotal?: number; findings?: number;
    filesFetched?: number; filesSkipped?: number; bytesFetched?: number; // live ingest signal; go quiet once tasks start
  };
  startedAt: number; endedAt?: number;
  error?: string;             // server-redacted display copy
  errorCode?: string;         // machine code so retry UI branches without parsing prose:
                              // repo_not_found | private_inaccessible | not_connected | rate_limited |
                              // oversized | network | cancelled | invalid_url
}
type PurpleRunPart = { type: 'data-purple-run'; id: string; data: PurpleRunData };
```

- When a run command executes, the client appends an assistant-role `UIMessage` whose only part is the initial `PurpleRunPart` (`setMessages`, `@ai-sdk/react` `:111`), with a preceding user-visible echo line as a normal user text message (today's `echoFor`, `AgentPanel.tsx:114`).
- Progress updates **mutate the part in place** (same `id`, new `data`) via `setMessages` — the list stays append-only, the card re-renders. Event source (contract aligned with n5, 2026-10-19): the existing `GET /api/events` SSE (`src/server.ts:5210`) with event name `purple-run`; the payload projects 1:1 onto `PurpleRunData` — `runId` minted at request acceptance (the structured-start branch already pre-spawns run ids, `src/server.ts:7507`), `label` in canonical `${owner}/${repo}@${ref}` form, ingest phases `{ id: 'resolve' | 'fetch' | 'analyze', label, state, detail }` with `detail` carrying the skip summary rollup (e.g. "1,234 fetched · 87 skipped (binaries 40, vendor 30, …)").
- Rendering: labelled card (run label, state pill, phase checklist, counters, elapsed) — reuses the timeline card's visual grammar (`ap-card`, `agent-panel.css`) ported to `apx-run-*` classes. Streaming-friendly: phases flip `pending→active→done` without layout shift.
- **Cancel:** button on the card while `state ∈ {queued, ingesting, running}` → `POST /api/mission/stop` with the registry's confirm semantics (`registry.ts:142-149`) → optimistic `state='cancelled'`, final event reconciles. **Caveat pinned with n5:** today's handler 404s with "No active mission" when no `TempestCommand` exists (`src/server.ts:7739-7744`), which is exactly the ingest window — phase 35 extends it to first abort an in-flight ingest via a runId-keyed `AbortController` map and respond with `cancelledIngest: true` before falling through to the existing stop path (`cmd.stop()`, `:7746`). Retry affordances branch on `errorCode`, never on `error` prose.
- **Wire safety:** run-card messages are stripped by `toWireMessages` (§3.4) before any `POST /api/chat`, and the server store accepts them for display persistence but they never reach the model. This is mandatory: `validateBody` forwards unknown parts to `convertToModelMessages` (`chat-route.ts:85-87`).

---

## 6. GenUi merge into the thread

### 6.1 Inline rendering in a sandboxed iframe

- New `ui/src/genui/GenUiFrame.tsx`: renders generative components *inside a message* via `<iframe sandbox="allow-scripts" src="/app/genui-frame/">`. The frame document is a **second Vite entry** (`ui/genui-frame/index.html` + `ui/genui-frame/main.tsx`; wired via `build.rollupOptions.input` in `ui/vite.config.ts`) so the bundle stays self-hosted under `/app/assets` — no data:/blob: URL, no external origin, satisfying the self-hosting rule (`styles.css:1`).
- **Sandbox attrs:** `sandbox="allow-scripts"` only. Deliberately **no `allow-same-origin`** (frame gets an opaque origin → its scripts cannot read the app's `localStorage`, cookies, or DOM), **no `allow-forms`/`allow-popups`/`allow-top-navigation`** (generated UI cannot navigate or exfiltrate via form posts), `referrerPolicy="no-referrer"`, `CSP` on the frame document itself (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src data:`) — `connect-src 'none'` is the hard network cut.
- **postMessage allowlist** (`ui/src/genui/frameProtocol.ts`, shared import both sides):
  - Frame→parent: `{type:'genui-ready'}`, `{type:'genui-action', message: string}`, `{type:'genui-height', px: number}` (px clamped 60–2000), `{type:'genui-error', message: string}`.
  - Parent→frame: `{type:'genui-source', source: string, streaming: boolean}`.
  - Parent handler validates: `event.origin === 'null'` (opaque origins serialize as `"null"` — anything else is not our frame), `event.source === iframe.contentWindow`, and the message matches the allowlisted schema; malformed/unknown messages are dropped silently. The frame posts with the app origin captured from its own `document.referrer`-free bootstrap parameter (passed via the src URL query at mount), never `'*'` when avoidable.
  - Height auto-resize from `genui-height`; the iframe itself gets `width:100%; height: clamped px; border:0` and `title` describing the widget.
- The frame's `main.tsx` receives `genui-source` and runs the same `Renderer` + `genUiLibrary` (`ui/src/genui/library.tsx:117`) and error boundary (`GenUiErrorBoundary.tsx`) ported into the frame bundle; action events come back as `genui-action` and render as a text line under the message (today's actions list, `GenUiPanel.tsx:210-221`).
- **Trigger:** a `data-genui` UIMessage part (`{ type: 'data-genui'; id: string; data: { source: string; streaming: boolean } }`) — produced by the chat flow when the model emits an OpenUI Lang block (fenced ```openui code fence parsed out of the text part) or by an explicit "Generate UI" composer action that calls `/api/genui/generate` (`src/server.ts:7365`) and appends the part on arrival, streaming chunks into `data.source` exactly like today's reader loop (`GenUiPanel.tsx:101-111`). Same wire-safety strip as §5.
- **Fallback:** if `genui-ready` doesn't arrive within 3s, or `genui-error` fires, or the boundary trips inside the frame, the message renders the raw OpenUI Lang source in a `<pre>` (the existing boundary fallback UX, `GenUiErrorBoundary.tsx:31-38`) — the thread never blanks.

### 6.2 Nav removal + hash redirect

- `NAV_ITEMS` drops `generative-ui` (`ui/src/App.tsx:9-14`) and the `SectionId` union drops it (`:7`); `GenUiPanel.tsx`'s form UX is absorbed (prompt → thread message; the standalone panel component is deleted, §8).
- `sectionFromHash` maps the legacy id: `generative-ui` → returns `'agent-panel'` **and** rewrites `window.location.hash` to `#agent-panel` (replace, not push, so history isn't polluted) — deep links and stale bookmarks land on the merged panel. No other file references the hash (grep: only `App.tsx:7,12,81`; `ui/dist` is regenerated).
- The 8000-char genui prompt cap and `PROMPT_RULE` error mapping (`GenUiPanel.tsx:10-20`) move into the composer's genui action.

---

## 7. Accessibility (WCAG AA)

- **Focus management:** on panel open/mount, focus moves to the composer textarea programmatically in `useEffect` (no HTML `autofocus` — the phase-28 suite asserts its absence in static pages, `src/__tests__/phase28-staged-consumers-a11y.test.ts:59-61`, and the SPA keeps the same rule). Rename/Delete dialogs and the ≤1024px sidebar drawer are `role="dialog" aria-modal="true"` with a focus trap; on close, focus returns to the invoking element (recorded at open time). Section switches move focus to the section title (`#section-title` exists today, `App.tsx:75`) via `tabIndex={-1}` + `.focus()`.
- **Chunked aria-live for streaming:** the message log gets `role="log" aria-live="polite"`; during streaming, a dedicated visually-hidden status region announces *throttled, chunked* text — at most one announcement per 500ms, each capped at ~200 characters plus an ellipsis note ("…streaming") — instead of per-token re-announcements. Status transitions (`submitted → streaming → done/error`) are announced through the existing pattern (`role="status"`, `ChatStream.tsx:148-150`).
- **prefers-reduced-motion:** extend the existing `genui.css` block (`:323-328`) to all new CSS — disable run-card spinners/pulse, jump-to-latest slide-in, sidebar transitions become instant. (The current spinner, `AgentPanel.tsx:555`, has no reduced-motion guard today — the port fixes that.)
- **AA specifics:** new components consume only the token palette (`styles.css:53-66`); `--text-secondary #595959` on `--bg #FFFFFF` ≈ 7.0:1, `--brand #6D28D9` on white ≈ 6.7:1 (AA for normal text); state pills (`ok/error`) carry text labels, never color alone (today's pattern, `STATUS_LABEL`, `AgentPanel.tsx:57`); hit targets ≥ 24×24px; copy/cancel/jump buttons have `aria-label`s; the iframe has a `title` and the frame content keeps `:focus-visible` rings (ported focus styles, `genui.css`/`agent-panel.css:17-20`).
- Keyboard map (documented in the header help text): `Enter` send / `Shift+Enter` newline / `/` palette / `Esc` (palette → confirm → exit focus mode) / `Alt+1..4` sections / `Home/End` jump in log.

---

## 8. Overview guarantee — additive files, read-only token imports

**Principle:** all new code is new files; the only edits to existing files are the enumeration below. New CSS consumes `:root` tokens (`styles.css:53-66`) read-only — no token is redefined, and `docs/assets/tokens.css` (canonical per survey) is untouched. No new runtime external URL anywhere (deps bundled by Vite; highlight theme imported; fonts unchanged).

**Existing files changed (exhaustive):**

| File | Change |
|---|---|
| `ui/src/App.tsx` | Remove `generative-ui` from `SectionId`/`NAV_ITEMS`/render (`:7,12,81`); add `#generative-ui`→`#agent-panel` redirect; apply `.shell--workbench` + rail state when active |
| `ui/src/components/AgentPanel.tsx` | Rebuilt as the workbench host: keeps tabs/palette/timeline grammar (source of ported logic), embeds sidebar + thread + upgraded ChatStream; drops the embedded panel-scoped chat-ref plumbing in favor of the store |
| `ui/src/components/ChatStream.tsx` | Upgraded in place: markdown renderer hookup, regenerate/retry, anchored scrolling, drafts via store, `toWireMessages` export added beside `trimHistory` (`:86-111`) |
| `ui/src/styles.css` | Additive `.shell--workbench` + wide/narrow media queries; existing rules' selectors untouched |
| `ui/vite.config.ts` | Add `build.rollupOptions.input` for the genui-frame entry (`:16-19` gains input) |
| `package.json` / `package-lock.json` | `react-markdown`, `remark-gfm`, `rehype-highlight` added; nothing removed |
| `src/server.ts` | Mount `src/chat/conversation-routes.ts` beside `/api/chat` (`:7364`) — additive lines only |
| `ui/src/api/client.ts` | Additive `postJson/patchJson/putJson/delJson` helpers + conversation types |

**Asserted untouched:** `ui/src/pages/Overview.tsx`, `ui/src/pages/overview.css`, `ui/src/pages/Reports.tsx`, `ui/src/reports/*`, `docs/**` (incl. `docs/assets/tokens.css`, legacy console), `src/genui/*`, `src/chat/chat-route.ts` (server caps stay as-is), `src/ui-commands/*` (phase 35 may extend the registry; this phase only consumes it), `src/llm/oauth.ts`, `src/config/*`. `ui/src/genui/GenUiPanel.tsx` is the one **deleted** file (absorbed by §6); `library.tsx`, `GenUiErrorBoundary.tsx`, `genui.css` are kept and re-used by the frame bundle.

**Additive new files:** `ui/src/prefs.ts`, `ui/src/conversations/{ConversationSidebar.tsx,store.ts,conversations.css}`, `ui/src/components/MarkdownMessage.tsx`, `ui/src/components/CodeBlock.tsx`, `ui/src/runs/{RunCard.tsx,types.ts}`, `ui/src/genui/{GenUiFrame.tsx,frameProtocol.ts}`, `ui/genui-frame/{index.html,main.tsx}`, `ui/src/components/agent-panel.css` additions (or sibling `workbench.css`), `src/chat/{conversation-store.ts,conversation-routes.ts}`, `src/__tests__/conversation-store.test.ts`, `src/__tests__/phase36-agent-panel-a11y.test.ts`, `.planning/phases/36-fullscreen-agent-panel/*` (this doc).

---

## 9. Changed files / Test plan / Risks / Open questions

### 9.1 Changed files

See §8 table (modified), §8 last paragraph (added), and the single deletion `ui/src/genui/GenUiPanel.tsx`.

### 9.2 Test plan

- **`npm run ui:typecheck`** — must stay clean with the new components/entries (`tsc -p ui/tsconfig.json --noEmit`).
- **`npm run ui:build`** — must produce both entries under `ui/dist` (`/app/` base) and prove the highlight theme + markdown bundles are self-contained (no external URLs — greppable in dist CSS/HTML; mirrors the intent of the fonts rule, `styles.css:1`).
- **New static a11y test** `src/__tests__/phase36-agent-panel-a11y.test.ts`, modeled on the phase-28 suite (`src/__tests__/phase28-staged-consumers-a11y.test.ts:34-62` — file-content string assertions): reads the new `ui/src` files and asserts — composer has programmatic focus (useEffect focus call present, `autofocus` string absent), `role="log"`/`aria-live` present on the thread, dialogs `aria-modal` + focus-restore, `prefers-reduced-motion` blocks exist in new CSS, sandboxed iframe has `sandbox="allow-scripts"` and a `title`, nav contains no `generative-ui` label, and `#generative-ui` redirect exists in `App.tsx`.
- **Unit (vitest, server):** `src/__tests__/conversation-store.test.ts` — caps (50 LRU, 200 msgs, 5 MB), atomic write, corrupt-file recovery, env path override; follows the injected-fs seams used by `oauth.test.ts`.
- **Unit (client logic):** `toWireMessages` strips `data-*` parts and empty messages; `trimHistory` re-export unchanged (40/48k ⊂ 60/64k, `ChatStream.tsx:86-111`, `chat-route.ts:41-42`); frame protocol validator rejects non-allowlisted/foreign-origin messages.
- **Manual/scripted smoke:** run panel at 2560/1440/1024/640 widths; keyboard-only pass (send, stop, regenerate, palette, dialogs, rail toggle); streaming with scroll-up (no forced bottom), jump-to-latest; run card phases + cancel against the phase-35 event source; genui inline render + kill-frame fallback.
- Per the contract, this node runs none of these; they are the PLAN's verification list.

### 9.3 Risks

- **Markdown re-render cost during streaming** — react-markdown re-parses per chunk; mitigated by `React.lazy` + memoizing per settled part (`state === 'done'`), and throttled updates (SDK `throttle` option exists).
- **Bundle growth** (~150–170 KB gz for markdown+highlight) — accepted for a local tool; lazy-loaded so Overview/Reports pay nothing.
- **Opaque-origin iframe quirks** — `localStorage`/`sessionStorage` throw inside the frame; the frame bundle must be storage-free (it is: state comes via postMessage). Some browsers report `event.origin === 'null'` — the validator treats exactly that as valid (§6.1).
- **`convertToModelMessages` rejecting data parts** — handled by `toWireMessages` (§3.4); a missed path would 400 the next send, caught by the unit test above.
- **Two Vite entries** — `emptyOutDir` and hashing must be accounted for in the `/app` static server (`src/server.ts:9282-9283` already serves hashed assets generically; verify at build).
- **zustand first use in UI** — no established pattern to copy; the store stays flat and selector-based to avoid re-render storms.
- **Phase-35 contract** — aligned with n5 (2026-10-19): `purple-run` events on `/api/events`, `PurpleRunData` projection 1:1, `/api/mission/stop` extended for ingest abort. Residual risk is only implementation drift between the two phase docs; §5 shapes are the shared contract.

### 9.4 Open questions

1. **`useChat` message-id stability across `setMessages` round-trips** — persisted threads reload with server-assigned ids; the SDK tolerates client-set ids, but regenerate-on-reloaded-thread needs a manual check during implementation.
2. **Highlight.js theme choice** (`github.css` proposed to match token lightness) — visual call, cheap to swap; not blocking.
3. **Whether `resumeStream` can someday restore a dropped stream** — blocked on a resumable server stream design that does not exist (`chat-route.ts` is stateless); Retry/regenerate is the committed behavior for v1.7.
