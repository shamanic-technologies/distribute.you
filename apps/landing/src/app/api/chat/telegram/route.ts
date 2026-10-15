import { ACTIVE_WINDOW_MS, explicitCode, threadCode, unroutedText } from "@/lib/chat/rules";
import { activeThreads, addMessage, threadForCode, threadForTelegramMessage } from "@/lib/chat/store";
import { linkOwnerChat, OWNER_LINK_REPLIES, startCode } from "@/lib/chat/owner-link";
import { sendToChat, sendToTeam, telegramConfig, type TelegramUpdate } from "@/lib/chat/telegram";

export const dynamic = "force-dynamic";

/**
 * Telegram's webhook. `/start <code>` from ANY chat links that chat to a customer's org
 * (client-service records it and says "Connected"; a bad code gets a plain answer here).
 * Everything else is listened to from the team chat only. A message reaches a visitor when
 * it addresses their thread (a reply to a relayed message, or `#code text`), or when it
 * addresses nobody and exactly one visitor wrote in the last 30 minutes; the bot then
 * confirms where it went. With several visitors chatting it asks which one.
 *
 * Answers 200 on anything it can parse: Telegram retries a non-2xx and eventually stops
 * delivering, which would cut the team off from every visitor.
 */
export async function POST(request: Request) {
  const config = telegramConfig();
  if (!config) return new Response("chat offline", { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== config.webhookSecret) {
    return new Response("forbidden", { status: 403 });
  }
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const msg = update?.message;
  if (!msg?.text) return Response.json({ ok: true });
  const linkCode = startCode(msg.text);
  if (linkCode) {
    const outcome = await linkOwnerChat(linkCode, msg.chat.id);
    if (outcome !== "linked") {
      await sendToChat(config, msg.chat.id, OWNER_LINK_REPLIES[outcome]).catch((err) =>
        console.error(`[landing/chat] owner link answer (${outcome}) not sent to chat ${msg.chat.id}:`, err),
      );
    }
    return Response.json({ ok: true });
  }
  if (String(msg.chat.id) !== config.ownerChatId) return Response.json({ ok: true });
  if (msg.text.trim() === "/start") {
    await sendToTeam(config, "Connected. Visitor messages from distribute.you land here. Reply to one to answer in the chat.");
    return Response.json({ ok: true });
  }

  let threadId: string | null = null;
  let body = msg.text.trim();
  if (msg.reply_to_message) {
    threadId = await threadForTelegramMessage(msg.reply_to_message.message_id);
  } else {
    const explicit = explicitCode(body);
    if (explicit) {
      threadId = await threadForCode(explicit.code);
      body = explicit.body;
    }
  }
  let implicit = false;
  if (!threadId && !msg.reply_to_message && !explicitCode(body)) {
    const active = await activeThreads(new Date(Date.now() - ACTIVE_WINDOW_MS));
    if (active.length === 1) {
      threadId = active[0];
      implicit = true;
    } else {
      await sendToTeam(config, unroutedText(active.map(threadCode)));
      return Response.json({ ok: true });
    }
  }
  if (!threadId) {
    await sendToTeam(config, "Not sent: that message or code matches no conversation.");
    return Response.json({ ok: true });
  }
  await addMessage({ threadId, sender: "team", body, telegramMessageId: msg.message_id });
  if (implicit) await sendToTeam(config, `→ sent to #${threadCode(threadId)}`);
  return Response.json({ ok: true });
}
