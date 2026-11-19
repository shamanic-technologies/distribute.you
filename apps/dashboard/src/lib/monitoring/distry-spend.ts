import { z } from "zod";

/**
 * Monitoring > Copilot > Distry spend on non-clients (staff only, DISTRY-SPEND-CHART-1119), alias-free so vitest reads it.
 *
 * Distry (our AI on the landing chat) answers people with no account on our money. chat-service v0.63.194 caps it: $5 per
 * visitor with no account, $30 a day for every non-client together, and raises a once-a-day alert when the day cap is
 * reached. It stores and serves the daily series `GET /internal/copilot/distry-spend/daily?days=N` (one row per UTC day,
 * oldest first, quiet days at zero), read through api-service's staff passthrough. Red on the hub IS the alert (no email
 * besides the one the owner asked for): only TODAY's row served `alertFired`. The page draws the served values as served.
 */

export const DistrySpendDaySchema = z.object({
  day: z.string(),
  nonClientSpendUsd: z.number(),
  thresholdUsd: z.number(),
  visitorsCut: z.number(),
  turnsRefusedByDayCap: z.number(),
  alertFired: z.boolean(),
  alertFiredAt: z.string().nullable(),
  measuredAt: z.string().nullable(),
});
export type DistrySpendDay = z.infer<typeof DistrySpendDaySchema>;

export const DistrySpendSchema = z.object({ days: z.array(DistrySpendDaySchema) });
export type DistrySpend = z.infer<typeof DistrySpendSchema>;

/** Today's served row: the newest one (chat-service serves oldest first, ending on today's UTC day). */
export function todayRow(data: DistrySpend): DistrySpendDay | undefined {
  return data.days.at(-1);
}

/** The hub is red only when today's row reached the day cap (chat-service's `alertFired`); a past capped day stays red on its own bar. */
export function cappedToday(data: DistrySpend): boolean {
  return todayRow(data)?.alertFired === true;
}
