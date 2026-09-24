import postgres from "postgres";
import { randomBytes, randomUUID } from "node:crypto";
import type { ChatMessage, ChatSender } from "./rules";

/**
 * The landing chat's storage, in the landing's own database (the one the blog reads).
 * Two tables, created on first use so the chat needs no migration step: a thread per
 * visitor, and every message in it with the Telegram message id it was relayed as, which
 * is how a team reply finds its thread.
 *
 * A thread is read with its SECRET, never its id alone: the id's first six characters
 * are shown in Telegram, and knowing them must not let anyone read the conversation.
 */

let sqlClient: ReturnType<typeof postgres> | null = null;
let ready: Promise<void> | null = null;

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("[landing/chat] DATABASE_URL is not set");
  if (!sqlClient) sqlClient = postgres(url, { max: 2 });
  return sqlClient;
}

async function ensureSchema(): Promise<ReturnType<typeof postgres>> {
  const db = sql();
  if (!ready) {
    ready = (async () => {
      await db`CREATE TABLE IF NOT EXISTS landing_chat_threads (
        id uuid PRIMARY KEY,
        secret text NOT NULL,
        page text,
        country text,
        email text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await db`CREATE TABLE IF NOT EXISTS landing_chat_messages (
        id bigserial PRIMARY KEY,
        thread_id uuid NOT NULL REFERENCES landing_chat_threads(id),
        sender text NOT NULL CHECK (sender IN ('visitor', 'team')),
        body text NOT NULL,
        telegram_message_id bigint,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await db`CREATE INDEX IF NOT EXISTS landing_chat_messages_thread_idx ON landing_chat_messages (thread_id, id)`;
      await db`CREATE INDEX IF NOT EXISTS landing_chat_messages_tg_idx ON landing_chat_messages (telegram_message_id)`;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
  return db;
}

export type ThreadRef = { id: string; secret: string };

export async function createThread(input: { page: string | null; country: string | null }): Promise<ThreadRef> {
  const db = await ensureSchema();
  const ref = { id: randomUUID(), secret: randomBytes(24).toString("base64url") };
  await db`INSERT INTO landing_chat_threads (id, secret, page, country)
    VALUES (${ref.id}, ${ref.secret}, ${input.page}, ${input.country})`;
  return ref;
}

export type ThreadInfo = { id: string; email: string | null; page: string | null; country: string | null; visitorMessages: number };

/** The thread, when the secret matches it. */
export async function openThread(ref: ThreadRef): Promise<ThreadInfo | null> {
  const db = await ensureSchema();
  const rows = await db`SELECT t.id, t.email, t.page, t.country,
      (SELECT count(*)::int FROM landing_chat_messages m WHERE m.thread_id = t.id AND m.sender = 'visitor') AS visitor_messages
    FROM landing_chat_threads t WHERE t.id = ${ref.id} AND t.secret = ${ref.secret}`;
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, email: r.email, page: r.page, country: r.country, visitorMessages: r.visitor_messages };
}

export async function setThreadEmail(threadId: string, email: string): Promise<void> {
  const db = await ensureSchema();
  await db`UPDATE landing_chat_threads SET email = ${email} WHERE id = ${threadId}`;
}

export async function addMessage(input: {
  threadId: string;
  sender: ChatSender;
  body: string;
  telegramMessageId: number | null;
}): Promise<void> {
  const db = await ensureSchema();
  await db`INSERT INTO landing_chat_messages (thread_id, sender, body, telegram_message_id)
    VALUES (${input.threadId}, ${input.sender}, ${input.body}, ${input.telegramMessageId})`;
}

export async function listMessages(threadId: string, afterId: number): Promise<ChatMessage[]> {
  const db = await ensureSchema();
  const rows = await db`SELECT id, sender, body, created_at FROM landing_chat_messages
    WHERE thread_id = ${threadId} AND id > ${afterId} ORDER BY id LIMIT 200`;
  return rows.map((r) => ({
    id: Number(r.id),
    sender: r.sender as ChatSender,
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** The thread a relayed Telegram message belongs to. */
export async function threadForTelegramMessage(telegramMessageId: number): Promise<string | null> {
  const db = await ensureSchema();
  const rows = await db`SELECT thread_id FROM landing_chat_messages
    WHERE telegram_message_id = ${telegramMessageId} LIMIT 1`;
  return rows[0]?.thread_id ?? null;
}

/** The thread whose id starts with a short code, when exactly one does. */
export async function threadForCode(code: string): Promise<string | null> {
  const db = await ensureSchema();
  const rows = await db`SELECT id FROM landing_chat_threads
    WHERE replace(id::text, '-', '') LIKE ${code + "%"} ORDER BY created_at DESC LIMIT 2`;
  return rows.length === 1 ? rows[0].id : null;
}
