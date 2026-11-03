/**
 * A customer writes to the platform bot from a chat they linked to their org
 * (dashboard card "Telegram updates"): chat-service answers it as Sophie, their
 * Copilot, in that chat (SOPHIE-TELEGRAM-1103). This module hands the message
 * over; chat-service decides whether the chat is linked (client-service holds
 * the link) and sends the answer itself. A chat linked to no org gets the
 * linking guidance here, never a turn on someone else's account.
 *
 * Alias-free so the routing carries real unit tests.
 */

export type CopilotRelayOutcome = "accepted" | "duplicate" | "not_linked" | "unavailable";

/** What an unlinked chat reads: the existing linking path, nothing new. */
export const NOT_LINKED_REPLY = "Open your distribute.you settings and tap Connect Telegram to chat with Sophie here.";

/** What a linked chat reads when its message could not be handed over. */
export const RELAY_UNAVAILABLE_REPLY = "We could not read your message right now. Please send it again in a minute.";

export async function relayToCopilot(chatId: number | string, messageId: number, text: string | null): Promise<CopilotRelayOutcome> {
  const baseUrl = process.env.CHAT_SERVICE_URL?.trim();
  const apiKey = process.env.CHAT_SERVICE_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    console.error("[landing/chat] Telegram message NOT handed to the Copilot: CHAT_SERVICE_URL / CHAT_SERVICE_API_KEY not set");
    return "unavailable";
  }
  try {
    const res = await fetch(`${baseUrl}/internal/copilot/telegram-messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ chatId: String(chatId), messageId: String(messageId), text }),
      signal: AbortSignal.timeout(20000),
    });
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (res.ok && (body?.status === "accepted" || body?.status === "duplicate" || body?.status === "not_linked")) return body.status;
    console.error(`[landing/chat] Telegram message from chat ${chatId} not handed to the Copilot: ${res.status} ${JSON.stringify(body)}`);
    return "unavailable";
  } catch (err) {
    console.error(`[landing/chat] Telegram message from chat ${chatId} not handed to the Copilot:`, err);
    return "unavailable";
  }
}
