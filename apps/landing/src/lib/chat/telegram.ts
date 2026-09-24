/**
 * The Telegram side of the landing chat. The bot relays every visitor message to ONE
 * chat, the team's, and accepts replies from that chat only.
 *
 * Three variables on the landing app's env, and the chat is OFF until all three are
 * set: the widget then says the chat is offline and points at the other channels, so a
 * visitor is never left typing into a box nobody reads.
 */

export type TelegramConfig = {
  token: string;
  ownerChatId: string;
  webhookSecret: string;
};

export function telegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID?.trim();
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!token || !ownerChatId || !webhookSecret) return null;
  return { token, ownerChatId, webhookSecret };
}

/** Sends one message to the team chat and returns Telegram's message id. */
export async function sendToTeam(config: TelegramConfig, text: string): Promise<number> {
  const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: config.ownerChatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok: boolean; result?: { message_id: number }; description?: string }
    | null;
  if (!res.ok || !json?.ok || typeof json.result?.message_id !== "number") {
    throw new Error(`[landing/chat] telegram sendMessage failed: ${res.status} ${json?.description ?? ""}`);
  }
  return json.result.message_id;
}

/** The slice of a Telegram update the bridge reads. */
export type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    reply_to_message?: { message_id: number };
  };
};
