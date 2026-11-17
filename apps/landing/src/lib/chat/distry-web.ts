/**
 * The Copilot in our site's pages (DISTRY-WEB-CHAT-1117): a visitor writes to Distry in the
 * page and chat-service answers as the SAME assistant as on WhatsApp and email. This
 * module only carries the message and reads the answer: who the visitor is, what the
 * assistant may say and how many answers an anonymous visitor gets are chat-service's.
 *
 * Alias-free so it carries real unit tests.
 */

/** The id the site mints once per visitor and keeps in its own cookie. */
export const VISITOR_COOKIE = "dy_visitor";
export const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
export const MAX_TEXT_LENGTH = 2000;

export function isVisitorId(value: string | null | undefined): value is string {
  return typeof value === "string" && VISITOR_ID_PATTERN.test(value);
}

/** What the page shows for one message: the producer's verdict, read, never re-graded. */
export type WebAnswer = {
  status: "answered" | "failed" | "contact_needed" | "busy" | "in_progress";
  reply: string | null;
  askForContact: boolean;
  messagesLeft: number | null;
  continuedOn: "whatsapp" | null;
};

const STATUSES = ["answered", "failed", "contact_needed", "busy", "in_progress"] as const;

/** The served body, or null when it is not the shape chat-service documents. */
export function parseWebAnswer(body: unknown): WebAnswer | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.status !== "string" || !(STATUSES as readonly string[]).includes(b.status)) return null;
  if (b.reply !== null && typeof b.reply !== "string") return null;
  return {
    status: b.status as WebAnswer["status"],
    reply: b.reply as string | null,
    askForContact: b.askForContact === true,
    messagesLeft: typeof b.messagesLeft === "number" ? b.messagesLeft : null,
    continuedOn: b.continuedOn === "whatsapp" ? "whatsapp" : null,
  };
}

export type WebRelay = { ok: true; answer: WebAnswer } | { ok: false; reason: "not_configured" | "refused" | "unreachable" };

export async function relayWebMessage(visitorId: string, messageId: string, text: string): Promise<WebRelay> {
  const baseUrl = process.env.CHAT_SERVICE_URL?.trim();
  const apiKey = process.env.CHAT_SERVICE_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    console.error("[landing/chat] web message NOT handed to the Copilot: CHAT_SERVICE_URL / CHAT_SERVICE_API_KEY not set");
    return { ok: false, reason: "not_configured" };
  }
  try {
    const res = await fetch(`${baseUrl}/internal/copilot/web-messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ visitorId, messageId, text }),
      // The answer is synchronous: a model turn, not a lookup.
      signal: AbortSignal.timeout(90_000),
    });
    const answer = parseWebAnswer(await res.json().catch(() => null));
    if (res.ok && answer !== null) return { ok: true, answer };
    console.error(`[landing/chat] web message not answered by the Copilot: ${res.status}`);
    return { ok: false, reason: "refused" };
  } catch (err) {
    console.error("[landing/chat] web message not handed to the Copilot:", err);
    return { ok: false, reason: "unreachable" };
  }
}
