/**
 * The open Copilot speaks first when the user looks stuck (owner 2026-10-15: a Copilot
 * turn, not a campaign). The dashboard only asks; chat-service's Jev decides to speak
 * or stay quiet (chat-service #602). Alias-free so its unit tests import it directly.
 */

import type { RecentAction } from "./recent-actions";

/** After a page opens, the user gets a moment to read it before the Copilot is asked. */
export const NUDGE_AFTER_PAGE_MS = 4_000;
/** After a click, the Copilot is asked once the user has done nothing for this long. */
export const NUDGE_AFTER_IDLE_MS = 20_000;

/** How long to wait after `last` before asking, or null when there is nothing new to ask about. */
export function nudgeDelayMs(last: RecentAction | undefined, lastAskedAt: string | null): number | null {
  if (!last) return null;
  if (lastAskedAt && last.at <= lastAskedAt) return null;
  return last.kind === "page" ? NUDGE_AFTER_PAGE_MS : NUDGE_AFTER_IDLE_MS;
}

/**
 * The session a speak turn was stored in, read from the UI message stream the chat proxy
 * returns (`data: {"type":"data-session","data":{"sessionId":"…"}}`). Null when absent.
 */
export function sessionIdFromUIStream(text: string): string | null {
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;
    const event = JSON.parse(payload) as { type?: string; data?: { sessionId?: unknown } };
    if (event.type === "data-session" && typeof event.data?.sessionId === "string") return event.data.sessionId;
  }
  return null;
}
