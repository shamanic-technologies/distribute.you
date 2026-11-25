/**
 * A customer writes to the platform bot from a chat they linked to their org
 * (dashboard card "Telegram updates"): chat-service answers it as Sophie, their
 * Copilot, in that chat (SOPHIE-TELEGRAM-1103). This module hands the message
 * over; chat-service decides whether the chat is linked (client-service holds
 * the link) and sends the answer itself. A chat linked to no org is a guest:
 * Distry answers it too and signs them up in the chat (DISTRY-START-DOOR-1125).
 *
 * Alias-free so the routing carries real unit tests.
 */

export type CopilotRelayOutcome = "accepted" | "duplicate" | "unavailable";

/** What a chat reads when its message could not be handed over. */
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
    if (res.ok && (body?.status === "accepted" || body?.status === "duplicate")) return body.status;
    console.error(`[landing/chat] Telegram message from chat ${chatId} not handed to the Copilot: ${res.status} ${JSON.stringify(body)}`);
    return "unavailable";
  } catch (err) {
    console.error(`[landing/chat] Telegram message from chat ${chatId} not handed to the Copilot:`, err);
    return "unavailable";
  }
}
