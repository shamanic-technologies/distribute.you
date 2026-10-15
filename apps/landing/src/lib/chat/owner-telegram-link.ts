/**
 * A customer links their Telegram to their org by tapping the dashboard's
 * `https://t.me/distribute_you_bot?start=<code>` link: Telegram then sends `/start <code>`
 * to the platform bot, whose webhook is the landing chat's. client-service owns the code
 * and the link (`POST /internal/owner-telegram/links`); this side only forwards it and
 * tells the chat why when it fails. On success client-service has already sent the chat
 * its "Connected" line, so nothing is sent here.
 */

/** The link code of a `/start <code>` message, or null for anything else (bare `/start` included). */
export function startLinkCode(text: string): string | null {
  const match = /^\/start(?:@\w+)?\s+(\S+)\s*$/.exec(text.trim());
  return match ? match[1] : null;
}

export type StartLinkOutcome =
  | { kind: "linked" }
  | { kind: "refused"; reply: string }
  | { kind: "failed"; reply: string };

export const LINK_REPLIES = {
  link_code_unknown: "This link is not valid. Get a new one from your dashboard.",
  link_code_expired: "This link has expired. Get a new one from your dashboard.",
  link_code_used: "This link was already used. Get a new one from your dashboard.",
  failed: "Could not connect right now, try again in a minute.",
} as const;

const REFUSALS: Record<number, keyof typeof LINK_REPLIES> = {
  404: "link_code_unknown",
  410: "link_code_expired",
  409: "link_code_used",
};

/** Hands one `/start <code>` to client-service. Never throws: a failure is logged loudly and answered. */
export async function forwardStartLink(code: string, chatId: string): Promise<StartLinkOutcome> {
  const baseUrl = process.env.CLIENT_SERVICE_URL?.trim();
  const apiKey = process.env.CLIENT_SERVICE_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    console.error(
      `[landing/telegram-link] CLIENT_SERVICE_URL or CLIENT_SERVICE_API_KEY missing: cannot link chat ${chatId}`,
    );
    return { kind: "failed", reply: LINK_REPLIES.failed };
  }
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, "")}/internal/owner-telegram/links`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ code, chatId }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error(`[landing/telegram-link] client-service unreachable linking chat ${chatId}:`, err);
    return { kind: "failed", reply: LINK_REPLIES.failed };
  }
  if (res.ok) return { kind: "linked" };
  const refusal = REFUSALS[res.status];
  if (refusal) return { kind: "refused", reply: LINK_REPLIES[refusal] };
  const body = await res.text().catch(() => "");
  if (res.status === 400) {
    // A garbled code reads as an invalid link to the customer; the log keeps our own bugs visible.
    console.error(`[landing/telegram-link] client-service refused the request (400) for chat ${chatId}: ${body.slice(0, 500)}`);
    return { kind: "refused", reply: LINK_REPLIES.link_code_unknown };
  }
  console.error(
    `[landing/telegram-link] client-service answered ${res.status} linking chat ${chatId}: ${body.slice(0, 500)}`,
  );
  return { kind: "failed", reply: LINK_REPLIES.failed };
}
