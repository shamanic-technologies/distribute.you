import { z } from "zod";

/**
 * Monitoring > WhatsApp > Sophie's replies (staff only, SOPHIE-WA-DELIVERY-CHART-1029), alias-free so vitest reads it.
 *
 * On 2026-10-27 and 2026-10-29 every reply Sophie (the Copilot on WhatsApp) wrote to a person signed in was refused at
 * send, silently, for two days. chat-service now stores, per inbound WhatsApp message, whether its reply left, and serves
 * a daily series `GET /internal/copilot/channel-replies/daily?days=N` (one row per UTC day, oldest first, quiet days
 * with zeros), read through api-service's staff passthrough. The page draws the served counts as served: no sum, no
 * rate. Red on the hub IS the alert (no email, owner 2026-10-22).
 */

export const SophieReplyDaySchema = z.object({
  day: z.string(),
  received: z.number(),
  delivered: z.number(),
  notDelivered: z.number(),
});
export type SophieReplyDay = z.infer<typeof SophieReplyDaySchema>;

export const SophieReplyDaysSchema = z.object({ days: z.array(SophieReplyDaySchema) });
export type SophieReplyDays = z.infer<typeof SophieReplyDaysSchema>;

/**
 * The hub is red while one of the last RED_WINDOW_DAYS UTC days (today and the two before) holds a reply written but
 * not delivered: a bad night still reads red the next morning and the day after, then clears on its own once fixed.
 */
export const RED_WINDOW_DAYS = 3;

/** The served days of the red window holding a not-delivered reply, newest first. Picks served rows; sums nothing. */
export function recentNotDelivered(data: SophieReplyDays): SophieReplyDay[] {
  return data.days
    .slice(-RED_WINDOW_DAYS)
    .filter((d) => d.notDelivered > 0)
    .reverse();
}
