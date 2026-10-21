import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import type { UIMessage } from 'ai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_CONVERSATIONS,
  MAX_MESSAGE_TEXT_CHARS,
  MAX_STORE_BYTES,
  MAX_STORED_MESSAGES,
  __resetConversationStore,
  __setConversationNow,
  conversationStorePath,
  createConversation,
  getConversationRecord,
  listConversations,
  putConversationMessages,
} from '../chat/conversation-store';

let dir: string;
let storePath: string;
let previousEnv: string | undefined;
let clock: number;

function message(id: string, text: string, role: 'user' | 'assistant' = 'user'): UIMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

function textOf(entry: UIMessage | undefined): string {
  if (entry === undefined) return '';
  return entry.parts.map(part => (part.type === 'text' ? part.text : '')).join('');
}

/** Each call advances the injected clock so LRU order is deterministic. */
async function create(): Promise<{ id: string; evictedIds: string[] }> {
  clock += 1;
  const { meta, evictedIds } = await createConversation();
  return { id: meta.id, evictedIds };
}

async function save(id: string, messages: UIMessage[]) {
  clock += 1;
  return putConversationMessages(id, messages);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'conversation-store-'));
  storePath = join(dir, 'conversations.json');
  previousEnv = process.env.T3MP3ST_CONVERSATIONS_STORE;
  process.env.T3MP3ST_CONVERSATIONS_STORE = storePath;
  clock = 1_000;
  __setConversationNow(() => clock);
  __resetConversationStore();
});

afterEach(() => {
  __setConversationNow(undefined);
  __resetConversationStore();
  if (previousEnv === undefined) delete process.env.T3MP3ST_CONVERSATIONS_STORE;
  else process.env.T3MP3ST_CONVERSATIONS_STORE = previousEnv;
  rmSync(dir, { recursive: true, force: true });
});

describe('conversation store caps', () => {
  it('evicts the least recently updated conversation past 50 and reports its id', async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_CONVERSATIONS; i++) {
      const created = await create();
      expect(created.evictedIds).toEqual([]);
      ids.push(created.id);
    }

    // Touch the oldest conversation so the second-oldest becomes the LRU victim.
    await save(ids[0], [message('a', 'touch')]);

    const overflow = await create();
    expect(overflow.evictedIds).toEqual([ids[1]]);

    const remaining = (await listConversations()).map(meta => meta.id);
    expect(remaining).toHaveLength(MAX_CONVERSATIONS);
    expect(remaining).not.toContain(ids[1]);
    expect(remaining).toContain(ids[0]);
    expect(remaining).toContain(overflow.id);
    expect(await getConversationRecord(ids[1])).toBeNull();
  });

  it('keeps only the newest 200 messages per conversation, dropping the oldest', async () => {
    const { id } = await create();
    const messages = Array.from({ length: MAX_STORED_MESSAGES + 50 }, (_, i) => message(`m${i}`, `text ${i}`));

    const result = await save(id, messages);
    expect(result?.meta.messageCount).toBe(MAX_STORED_MESSAGES);

    const record = await getConversationRecord(id);
    expect(record?.messages).toHaveLength(MAX_STORED_MESSAGES);
    expect(record?.messages[0].id).toBe('m50');
    expect(record?.messages.at(-1)?.id).toBe(`m${MAX_STORED_MESSAGES + 49}`);
  });

  it('clips each message to 8000 characters and keeps text at exactly the cap', async () => {
    const { id } = await create();
    await save(id, [
      message('over', 'x'.repeat(MAX_MESSAGE_TEXT_CHARS + 1)),
      message('exact', 'y'.repeat(MAX_MESSAGE_TEXT_CHARS)),
    ]);

    const record = await getConversationRecord(id);
    expect(textOf(record?.messages[0]).length).toBe(MAX_MESSAGE_TEXT_CHARS);
    expect(textOf(record?.messages[1])).toBe('y'.repeat(MAX_MESSAGE_TEXT_CHARS));
  });

  it('shares the 8000-character budget across text parts within one message', async () => {
    const { id } = await create();
    await save(id, [
      {
        id: 'split',
        role: 'user',
        parts: [
          { type: 'text', text: 'a'.repeat(5000) },
          { type: 'text', text: 'b'.repeat(5000) },
        ],
      },
    ]);

    const record = await getConversationRecord(id);
    const parts = record?.messages[0].parts ?? [];
    expect(parts).toEqual([
      { type: 'text', text: 'a'.repeat(5000) },
      { type: 'text', text: 'b'.repeat(MAX_MESSAGE_TEXT_CHARS - 5000) },
    ]);
  });

  it('evicts by UTF-8 byte size when the character count is still under the cap', async () => {
    // A euro sign is one JS character but three UTF-8 bytes. Two conversations of
    // 200 x 8000 characters total 3.2M characters (under 5 MB) but 9.6 MB of UTF-8.
    const euro = '€'.repeat(MAX_MESSAGE_TEXT_CHARS);
    const euroMessages = Array.from({ length: MAX_STORED_MESSAGES }, (_, i) => message(`m${i}`, euro));

    const first = await create();
    const second = await create();
    expect((await save(first.id, euroMessages))?.evictedIds).toEqual([]);

    const result = await save(second.id, euroMessages);
    expect(result?.evictedIds).toEqual([first.id]);
    expect(statSync(storePath).size).toBeLessThanOrEqual(MAX_STORE_BYTES);
    expect((await listConversations()).map(meta => meta.id)).toEqual([second.id]);
  });

  it('does not evict ASCII text that stays under 5 MB in bytes', async () => {
    const ascii = 'a'.repeat(MAX_MESSAGE_TEXT_CHARS);
    const bulk = Array.from({ length: MAX_STORED_MESSAGES }, (_, i) => message(`m${i}`, ascii));

    const first = await create();
    const second = await create();
    expect((await save(first.id, bulk))?.evictedIds).toEqual([]);
    expect((await save(second.id, bulk))?.evictedIds).toEqual([]);
    expect(await listConversations()).toHaveLength(2);
  });
});

describe('conversation store persistence', () => {
  it('leaves no temp file behind after a save', async () => {
    const { id } = await create();
    await save(id, [message('a', 'hello')]);

    expect(existsSync(storePath)).toBe(true);
    expect(existsSync(`${storePath}.tmp`)).toBe(false);
    const onDisk = JSON.parse(readFileSync(storePath, 'utf8')) as { conversations: unknown[] };
    expect(onDisk.conversations).toHaveLength(1);
  });

  it.skipIf(process.platform === 'win32')('writes the store file with mode 0600', async () => {
    await create();
    expect(statSync(storePath).mode & 0o777).toBe(0o600);
  });

  it.each([['truncated JSON', '{not valid json'], ['wrong shape', '{"conversations":"nope"}']])(
    'loads a corrupt store (%s) as an empty store without throwing',
    async (_label, payload) => {
      writeFileSync(storePath, payload);
      __resetConversationStore();

      await expect(listConversations()).resolves.toEqual([]);

      const created = await create();
      expect((await listConversations()).map(meta => meta.id)).toEqual([created.id]);
    },
  );

  it('selects the store file path from T3MP3ST_CONVERSATIONS_STORE', async () => {
    const custom = join(dir, 'nested', 'custom.json');
    process.env.T3MP3ST_CONVERSATIONS_STORE = `  ${custom}  `;
    __resetConversationStore();

    expect(conversationStorePath()).toBe(custom);
    await create();
    expect(existsSync(custom)).toBe(true);
    expect(existsSync(storePath)).toBe(false);
  });

  it('falls back to ~/.t3mp3st/conversations.json when the override is unset', () => {
    delete process.env.T3MP3ST_CONVERSATIONS_STORE;
    expect(conversationStorePath()).toBe(join(homedir(), '.t3mp3st', 'conversations.json'));
  });
});
