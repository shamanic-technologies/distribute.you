/**
 * A customer links their Telegram to their org through the platform bot: the dashboard
 * gives them a `t.me/<bot>?start=<code>` link, Telegram then sends the bot `/start <code>`
 * from their chat, and this module hands that code and chat id to client-service, which
 * records the chat as the org owner's and sends the "Connected" line itself.
 *
 * Any chat may send a code (the team chat too: the owner links other orgs from it).
 * Alias-free so the parsing carries real unit tests.
 */

/** The code of `/start <code>` (Telegram's start parameter: [A-Za-z0-9_-], up to 64). */
export function startCode(text: string): string | null {
  const match = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{1,64})$/.exec(text.trim());
  return match ? match[1] : null;
}

export type OwnerLinkOutcome = "linked" | "unknown" | "expired" | "used" | "unavailable";

/** What the chat reads when the link did not go through. A linked chat gets client-service's own line. */
export const OWNER_LINK_REPLIES: Record<Exclude<OwnerLinkOutcome, "linked">, string> = {
  unknown: "This link does not work. Open your distribute.you settings and tap Connect Telegram to get a new one.",
  expired: "This link has expired. Open your distribute.you settings and tap Connect Telegram to get a new one.",
  used: "This link was already used. Open your distribute.you settings and tap Connect Telegram to get a new one.",
  unavailable: "We could not connect this chat right now. Please try the link again in a minute.",
};

const STATUS_OUTCOME: Record<number, OwnerLinkOutcome> = { 404: "unknown", 410: "expired", 409: "used" };

export async function linkOwnerChat(code: string, chatId: number | string): Promise<OwnerLinkOutcome> {
  const baseUrl = process.env.CLIENT_SERVICE_URL?.trim();
  const apiKey = process.env.CLIENT_SERVICE_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    console.error("[landing/chat] owner Telegram link NOT recorded: CLIENT_SERVICE_URL / CLIENT_SERVICE_API_KEY not set");
    return "unavailable";
  }
  try {
    const res = await fetch(`${baseUrl}/internal/owner-telegram/links`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ code, chatId: String(chatId) }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return "linked";
    const outcome = STATUS_OUTCOME[res.status];
    if (outcome) return outcome;
    console.error(`[landing/chat] owner Telegram link failed for chat ${chatId}: ${res.status} ${await res.text().catch(() => "")}`);
    return "unavailable";
  } catch (err) {
    console.error(`[landing/chat] owner Telegram link failed for chat ${chatId}:`, err);
    return "unavailable";
  }
}
