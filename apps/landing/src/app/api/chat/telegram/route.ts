import { explicitCode } from "@/lib/chat/rules";
import { addMessage, threadForCode, threadForTelegramMessage } from "@/lib/chat/store";
import { sendToTeam, telegramConfig, type TelegramUpdate } from "@/lib/chat/telegram";

export const dynamic = "force-dynamic";

/**
 * Telegram's webhook. Only the team chat is listened to, and only a message that
 * addresses a thread (a reply to a relayed message, or `#code text`) reaches a visitor.
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
  if (!msg || String(msg.chat.id) !== config.ownerChatId || !msg.text) {
    return Response.json({ ok: true });
  }
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
  if (!threadId) {
    await sendToTeam(config, "Not sent: reply to a visitor's message, or start with #code.");
    return Response.json({ ok: true });
  }
  await addMessage({ threadId, sender: "team", body, telegramMessageId: msg.message_id });
  return Response.json({ ok: true });
}
