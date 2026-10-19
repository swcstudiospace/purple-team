import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 36 static assertions (workbench shell + GenUi merge), modeled on the
 * phase-28 file-content pattern: read the sources and assert the a11y and
 * structure markers the design doc pins (36-CONTEXT §2, §6, §7).
 */

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const app = read('ui/src/App.tsx');
const agentPanel = read('ui/src/components/AgentPanel.tsx');
const chatStream = read('ui/src/components/ChatStream.tsx');
const message = read('ui/src/components/chat/message.tsx');
const sidebar = read('ui/src/components/workbench/ConversationSidebar.tsx');
const palette = read('ui/src/components/workbench/SlashPalette.tsx');
const dialog = read('ui/src/components/workbench/WorkbenchDialog.tsx');
const focus = read('ui/src/components/workbench/focus.ts');
const prefs = read('ui/src/components/workbench/prefs.ts');
const workbenchCss = read('ui/src/components/workbench/workbench.css');
const store = read('ui/src/stores/conversations.ts');
const client = read('ui/src/api/client.ts');
const styles = read('ui/src/styles.css');
const genuiFrame = read('ui/src/genui/GenUiFrame.tsx');
const frameMain = read('ui/src/genui/frame-main.tsx');
const frameProtocol = read('ui/src/genui/frameProtocol.ts');
const genuiHtml = read('ui/genui.html');
const viteConfig = read('ui/vite.config.ts');
const conversationStore = read('src/chat/conversation-store.ts');
const conversationRoutes = read('src/chat/conversation-routes.ts');
const server = read('src/server.ts');

describe('agent panel workbench shell (phase 36)', () => {
  it('merges generative-ui into the agent panel and redirects the legacy hash', () => {
    expect(app).not.toContain("{ id: 'generative-ui'");
    expect(app).not.toContain("label: 'Generative UI'");
    expect(app).toContain("'generative-ui': 'agent-panel'");
    expect(app).toContain('replaceState');
    expect(existsSync(join(process.cwd(), 'ui/src/genui/GenUiPanel.tsx'))).toBe(false);
    existsSync(join(process.cwd(), 'ui/src/genui/library.tsx'));
  });

  it('applies the workbench shell modifier with a three-state rail', () => {
    expect(app).toContain("shell--workbench");
    expect(app).toContain("railState === 'collapsed'");
    expect(app).toContain("railState === 'hidden'");
    expect(app).toContain('aria-expanded={railState === ');
    expect(app).toContain('aria-controls={railId}');
    expect(app).toContain("event.altKey");
    expect(app).toContain("document.getElementById('section-title')?.focus()");
    expect(styles).toContain('.shell--workbench');
    expect(styles).toContain('@media (max-width: 1024px)');
    expect(styles).toContain('@media (max-width: 640px)');
  });

  it('keeps Escape precedence: palette, confirm, dialog, then focus mode', () => {
    expect(palette).toContain("if (event.key === 'Escape')");
    expect(palette).toContain('escapeGuard.paletteOpen');
    expect(focus).toContain('escapeGuard.dialogOpen');
    expect(app).toContain('escapeGuard.paletteOpen || escapeGuard.confirmPending || escapeGuard.dialogOpen');
  });

  it('focuses the composer programmatically and never uses autofocus', () => {
    expect(chatStream).toContain('focusComposer');
    expect(chatStream).toContain("rootRef.current?.querySelector('textarea')?.focus()");
    expect(agentPanel).toContain('autoFocusComposer');
    for (const source of [app, agentPanel, sidebar, palette, dialog, chatStream, frameMain]) {
      expect(source).not.toContain('autofocus');
    }
  });

  it('exposes exactly one composer — the embedded ChatStream one', () => {
    expect(agentPanel).not.toContain('<textarea');
    expect(agentPanel).not.toContain('ap-composer');
    expect(agentPanel).toContain('<ChatStream');
    expect(agentPanel).toContain('showNewChat={false}');
    expect(app).toContain('shell--workbench');
  });

  it('gives the thread a log role with polite live regions', () => {
    expect(chatStream).toContain('role="log"');
    expect(chatStream).toContain('aria-live="polite"');
    expect(chatStream).toContain('toWireMessages');
  });

  it('renders conversations through the sidebar with dialogs that trap and restore focus', () => {
    expect(sidebar).toContain('aria-current={active');
    expect(sidebar).toContain('No conversations yet');
    expect(sidebar).toContain('New chat');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('role="dialog"');
    expect(focus).toContain('invoker.focus()');
    expect(focus).toContain('useFocusTrap');
  });

  it('persists display prefs under the v1 key and threads under the server store', () => {
    expect(prefs).toContain("'t3mp3st.ui.prefs.v1'");
    expect(prefs).toContain("'expanded' | 'collapsed' | 'hidden'");
    expect(store).toContain('create<ConversationsState>');
    expect(store).toContain('SYNC_DEBOUNCE_MS');
    expect(store).not.toContain('localStorage');
    expect(client).toContain('export function postJson');
    expect(client).toContain('export function patchJson');
    expect(client).toContain('export function putJson');
    expect(existsSync(join(process.cwd(), 'ui/src/genui/library.tsx'))).toBe(true);
    expect(client).toContain('putConversationMessages');
  });

  it('mounts the conversation API beside /api/chat with capped persistence', () => {
    expect(server).toContain("import { createConversationRoutes } from './chat/conversation-routes.js'");
    expect(server).toContain("app.use('/api/conversations', createConversationRoutes())");
    expect(conversationRoutes).toContain("router.get('/'");
    expect(conversationRoutes).toContain("router.post('/'");
    expect(conversationRoutes).toContain("router.get('/:id'");
    expect(conversationRoutes).toContain("router.patch('/:id'");
    expect(conversationRoutes).toContain("router.delete('/:id'");
    expect(conversationRoutes).toContain("router.put('/:id/messages'");
    expect(conversationStore).toContain('MAX_CONVERSATIONS = 50');
    expect(conversationStore).toContain('MAX_STORED_MESSAGES = 200');
    expect(conversationStore).toContain('MAX_STORE_BYTES');
    expect(conversationStore).toContain('renameSync');
    expect(conversationStore).toContain("T3MP3ST_CONVERSATIONS_STORE");
  });
});

describe('genUi sandbox merge (phase 36 §6)', () => {
  it('sandboxes the frame with scripts-only permissions and a title', () => {
    expect(genuiFrame).toContain('sandbox="allow-scripts"');
    expect(genuiFrame).toContain('title=');
    expect(genuiFrame).toContain('referrerPolicy="no-referrer"');
    expect(genuiFrame).toContain("event.origin !== OPAQUE_ORIGIN");
    expect(genuiFrame).toContain('event.source !== frame.contentWindow');
  });

  it('cuts the frame network with a strict CSP and keeps both entries self-hosted', () => {
    expect(genuiHtml).toContain("/src/genui/frame-main.tsx");
    expect(viteConfig).toContain("genui: 'ui/genui.html'");
    expect(genuiHtml).toContain("connect-src 'none'");
    expect(genuiHtml).toContain('default-src');
  });

  it('validates every postMessage against the allowlist and falls back to raw text', () => {
    expect(frameProtocol).toContain('genui-ready');
    expect(frameProtocol).toContain('genui-action');
    expect(frameProtocol).toContain('genui-height');
    expect(frameProtocol).toContain('genui-error');
    expect(frameMain).toContain("postToParent({ type: 'genui-ready' })");
    expect(frameProtocol).toContain('clampFrameHeight');
    expect(genuiFrame).toContain('READY_TIMEOUT_MS = 3000');
    expect(genuiFrame).toContain('<pre>{source}</pre>');
  });

  it('renders data-genui parts and fenced openui blocks inline in the thread', () => {
    expect(message).toContain("part.type === 'data-genui'");
    expect(message).toContain('isGenUiData');
    expect(message).toContain('splitOpenUiSegments');
    expect(message).toContain('```openui');
  });

  it('guards new motion with prefers-reduced-motion blocks', () => {
    for (const css of [workbenchCss, read('ui/src/genui/genui-inline.css'), read('ui/src/genui/frame.css')]) {
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    }
  });
});
