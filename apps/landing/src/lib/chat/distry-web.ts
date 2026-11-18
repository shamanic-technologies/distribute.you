/**
 * The Copilot in our site's pages (DISTRY-WEB-CHAT-1117): a visitor writes to Distry in the
 * page and chat-service answers as the SAME assistant as on WhatsApp and email. This
 * module only carries the message and reads the answer: who the visitor is, what the
 * assistant may say and what a visitor with no account may do are chat-service's.
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

/** Clickable answers the assistant offers: the page shows them as buttons, a click sends the label. */
export type WebChoices = { question: string | null; choices: { label: string; description: string | null }[] };

/** What the page shows for one message: the producer's verdict, read, never re-graded. */
export type WebAnswer = {
  status: "answered" | "failed" | "busy" | "in_progress";
  reply: string | null;
  choices: WebChoices | null;
  continuedOn: "whatsapp" | "email" | null;
  /** Whether this visitor proved an email in the chat: the conversation then acts with their account. */
  account: { signedIn: boolean; email: string | null };
};

const STATUSES = ["answered", "failed", "busy", "in_progress"] as const;

function parseChoices(value: unknown): WebChoices | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.choices) || v.choices.length === 0) return undefined;
  const choices: WebChoices["choices"] = [];
  for (const item of v.choices) {
    const c = item as Record<string, unknown> | null;
    if (typeof c !== "object" || c === null || typeof c.label !== "string" || c.label.trim() === "") return undefined;
    choices.push({ label: c.label, description: typeof c.description === "string" ? c.description : null });
  }
  return { question: typeof v.question === "string" ? v.question : null, choices };
}

/** The served body, or null when it is not the shape chat-service documents. */
export function parseWebAnswer(body: unknown): WebAnswer | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.status !== "string" || !(STATUSES as readonly string[]).includes(b.status)) return null;
  if (b.reply !== null && typeof b.reply !== "string") return null;
  const choices = parseChoices(b.choices);
  if (choices === undefined) return null;
  const account = b.account as Record<string, unknown> | null | undefined;
  if (typeof account !== "object" || account === null || typeof account.signedIn !== "boolean") return null;
  return {
    status: b.status as WebAnswer["status"],
    reply: b.reply as string | null,
    choices,
    continuedOn: b.continuedOn === "whatsapp" || b.continuedOn === "email" ? b.continuedOn : null,
    account: { signedIn: account.signedIn, email: typeof account.email === "string" ? account.email : null },
  };
}

/**
 * The speed guard of the page chat, per address: a visitor id is a cookie a script can
 * drop, the address it writes from is not. Counts NEW messages only (the page asks again
 * with the same id while a long turn runs). chat-service holds the other two guards: the
 * speed per visitor and the day's budget for visitors with no account.
 */
export const IP_MESSAGE_LIMIT = 60;
export const IP_WINDOW_MS = 10 * 60_000;

export function createIpGuard(limit = IP_MESSAGE_LIMIT, windowMs = IP_WINDOW_MS) {
  const seen = new Map<string, Map<string, number>>();
  return {
    allow(ip: string, messageId: string, now = Date.now()): boolean {
      const mine = seen.get(ip) ?? new Map<string, number>();
      for (const [id, at] of mine) if (now - at >= windowMs) mine.delete(id);
      if (mine.has(messageId)) return true;
      if (mine.size >= limit) return false;
      mine.set(messageId, now);
      seen.set(ip, mine);
      // Addresses gone quiet are dropped so the map follows the traffic of one window.
      if (seen.size > 5000) for (const [key, ids] of seen) if ([...ids.values()].every((at) => now - at >= windowMs)) seen.delete(key);
      return true;
    },
  };
}

/** A turn can outlast one HTTP wait (the site sits behind a 100 s edge cap): the page then asks again. */
export const RELAY_WAIT_MS = 85_000;

const STILL_RUNNING: WebAnswer = { status: "in_progress", reply: null, choices: null, continuedOn: null, account: { signedIn: false, email: null } };

export type WebRelay = { ok: true; answer: WebAnswer } | { ok: false; reason: "not_configured" | "refused" | "unreachable" };

export async function relayWebMessage(
  visitorId: string,
  messageId: string,
  text: string,
  deps: { fetchImpl?: typeof fetch; env?: Record<string, string | undefined> } = {},
): Promise<WebRelay> {
  const env = deps.env ?? process.env;
  const baseUrl = env.CHAT_SERVICE_URL?.trim();
  const apiKey = env.CHAT_SERVICE_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    console.error("[landing/chat] web message NOT handed to the Copilot: CHAT_SERVICE_URL / CHAT_SERVICE_API_KEY not set");
    return { ok: false, reason: "not_configured" };
  }
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${baseUrl}/internal/copilot/web-messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ visitorId, messageId, text }),
      signal: AbortSignal.timeout(RELAY_WAIT_MS),
    });
    const answer = parseWebAnswer(await res.json().catch(() => null));
    if (res.ok && answer !== null) return { ok: true, answer };
    console.error(`[landing/chat] web message not answered by the Copilot: ${res.status}`);
    return { ok: false, reason: "refused" };
  } catch (err) {
    // The turn goes on in chat-service: the same message id reads its answer once it is written.
    if (err instanceof Error && err.name === "TimeoutError") return { ok: true, answer: STILL_RUNNING };
    console.error("[landing/chat] web message not handed to the Copilot:", err);
    return { ok: false, reason: "unreachable" };
  }
}
