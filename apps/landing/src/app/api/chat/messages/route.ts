import {
  MAX_MESSAGES_PER_IP_PER_MINUTE,
  MAX_VISITOR_MESSAGES_PER_THREAD,
  cleanBody,
  makeRateLimiter,
  relayText,
  threadCode,
} from "@/lib/chat/rules";
import { addMessage, createThread, listMessages, openThread } from "@/lib/chat/store";
import { sendToTeam, telegramConfig } from "@/lib/chat/telegram";

export const dynamic = "force-dynamic";

const allow = makeRateLimiter(MAX_MESSAGES_PER_IP_PER_MINUTE, 60_000);

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** A visitor sends a message. The first one opens a thread and returns its secret. */
export async function POST(request: Request) {
  const config = telegramConfig();
  if (!config) return json({ error: "chat_offline" }, 503);

  const input = (await request.json().catch(() => null)) as
    | { thread?: { id?: unknown; secret?: unknown }; body?: unknown; page?: unknown }
    | null;
  const body = cleanBody(input?.body);
  if (!body) return json({ error: "invalid_message" }, 400);
  if (!allow(clientIp(request), Date.now())) return json({ error: "too_many_messages" }, 429);

  let thread: { id: string; secret: string };
  let email: string | null = null;
  let isFirst = false;
  const page = typeof input?.page === "string" ? input.page.slice(0, 120) : null;
  const country = request.headers.get("cf-ipcountry");
  if (typeof input?.thread?.id === "string" && typeof input?.thread?.secret === "string") {
    const opened = await openThread({ id: input.thread.id, secret: input.thread.secret });
    if (!opened) return json({ error: "unknown_thread" }, 404);
    if (opened.visitorMessages >= MAX_VISITOR_MESSAGES_PER_THREAD) {
      return json({ error: "thread_full" }, 429);
    }
    thread = { id: input.thread.id, secret: input.thread.secret };
    email = opened.email;
  } else {
    thread = await createThread({ page, country });
    isFirst = true;
  }

  const telegramMessageId = await sendToTeam(
    config,
    relayText({ code: threadCode(thread.id), body, page, country, email, isFirst }),
  );
  await addMessage({ threadId: thread.id, sender: "visitor", body, telegramMessageId });
  return json({ thread });
}

/** The widget polls its thread for the team's replies. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const secret = url.searchParams.get("secret");
  const after = Number(url.searchParams.get("after") ?? "0");
  const online = telegramConfig() !== null;
  if (!id || !secret) return json({ online, messages: [] });
  const opened = await openThread({ id, secret });
  if (!opened) return json({ error: "unknown_thread" }, 404);
  const messages = await listMessages(id, Number.isFinite(after) ? after : 0);
  return json({ online, messages });
}
