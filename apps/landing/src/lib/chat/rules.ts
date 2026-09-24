/**
 * The landing chat's pure rules: what a visitor may send, how a thread is addressed,
 * how a message is shown to the team in Telegram, and how the team's reply finds its
 * way back to the right visitor.
 *
 * The bridge: a visitor's message is relayed to the team's Telegram chat by a bot,
 * prefixed with the thread's short code. The team answers by REPLYING to that Telegram
 * message (or by starting a message with `#code`), and the reply is stored against the
 * thread so the widget shows it. Alias-free so the rules carry real unit tests.
 */

export const MAX_BODY_CHARS = 2000;
export const MAX_EMAIL_CHARS = 200;
export const MAX_VISITOR_MESSAGES_PER_THREAD = 60;
export const MAX_MESSAGES_PER_IP_PER_MINUTE = 10;

export type ChatSender = "visitor" | "team";

export type ChatMessage = {
  id: number;
  sender: ChatSender;
  body: string;
  createdAt: string;
};

/** A thread's short code: what the team sees in Telegram and can type as `#code`. */
export function threadCode(threadId: string): string {
  return threadId.replace(/-/g, "").slice(0, 6);
}

export function cleanBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.replace(/\r\n/g, "\n").trim();
  if (!body || body.length > MAX_BODY_CHARS) return null;
  return body;
}

export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim();
  if (!email || email.length > MAX_EMAIL_CHARS) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * The contact a visitor must leave before their first message: an email or a phone
 * number, so a conversation survives a closed tab or a lost connection. A phone keeps
 * its leading `+` and loses the spacing; it needs 7 to 15 digits (E.164's range).
 */
export function cleanContact(raw: unknown): string | null {
  const email = cleanEmail(raw);
  if (email) return email;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\+?[0-9 ().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return (trimmed.startsWith("+") ? "+" : "") + digits;
}

/** The text the team receives in Telegram for one visitor message. */
export function relayText(input: {
  code: string;
  body: string;
  page: string | null;
  country: string | null;
  contact: string | null;
  isFirst: boolean;
}): string {
  const where = [input.page, input.country].filter(Boolean).join(" · ");
  const head = `💬 #${input.code}${where ? ` · ${where}` : ""}${input.contact ? ` · ${input.contact}` : ""}`;
  const hint = input.isFirst ? "\n\n(Reply to this message to answer in the chat.)" : "";
  return `${head}\n${input.body}${hint}`;
}

/**
 * How long a visitor counts as "chatting" for an unaddressed team message: with exactly
 * one such visitor, a plain message goes to them; with several, the team must say which.
 */
export const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

/** What the bot answers when a team message could not be routed. */
export function unroutedText(activeCodes: string[]): string {
  if (activeCodes.length === 0) return "Not sent: nobody is chatting right now.";
  return `Not sent: ${activeCodes.length} people are chatting. Reply to their message, or start with the code, for example #${activeCodes[0]} your answer.\nActive: ${activeCodes.map((c) => `#${c}`).join(", ")}`;
}

/** A `#code` at the start of a team message addresses that thread explicitly. */
export function explicitCode(text: string): { code: string; body: string } | null {
  const m = text.match(/^#([0-9a-f]{6})\s+([\s\S]+)$/i);
  if (!m) return null;
  const body = m[2].trim();
  return body ? { code: m[1].toLowerCase(), body } : null;
}

/** Fixed-window counter per key, in memory: one container serves the landing. */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now: number): boolean => {
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      return true;
    }
    if (cur.count >= limit) return false;
    cur.count += 1;
    return true;
  };
}
