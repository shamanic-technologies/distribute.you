import { z } from "zod";

/**
 * Monitoring > Triggers > Firing (staff only, TRIGGER-HEALTH-1028-DASH), alias-free so vitest reads it directly.
 *
 * A reactive campaign waits on a TRIGGER (a booking call started, a meeting booked, a lead event...). campaign-service
 * checks every hour whether each trigger a live campaign waits on is BROKEN, on positive evidence only: it never fired
 * while campaigns waited 3+ days, or lead-service saw people reach the trigger's own step and no event reached us. A
 * quiet trigger is ok. Read through api-service's staff passthrough of campaign-service
 * `GET /internal/ops/trigger-health?days=N` (campaign-service #802, shape `TriggerHealthResponse`). Before it, every
 * silent trigger was a staff email (4 on 2026-10-28, 2 of them quiet weeks); red on the hub IS the alert now. The page
 * draws the served verdicts, sentences and daily series as served: no sort, no sum, no re-grading.
 */

const num = z.number();
const verdict = z.enum(["ok", "red", "unknown"]);

export const TriggerHealthItemSchema = z.object({
  triggerId: z.string(),
  label: z.string(),
  firedBy: z.string(),
  watched: z.boolean(),
  watchedSince: z.string().nullable(),
  status: verdict.nullable(),
  reason: z.enum(["never_fired", "facts_without_event", "facts_unreadable"]).nullable(),
  sentence: z.string().nullable(),
  liveCampaigns: num,
  factsWithoutEvent: num.nullable(),
  missing: z.array(z.object({ orgId: z.string(), brandId: z.string(), people: num, firstReachedAt: z.string() })),
  lastEventAt: z.string().nullable(),
  byDay: z.array(z.object({ day: z.string(), events: num, status: verdict.nullable() })),
});

export const TriggerHealthSchema = z.object({
  generatedAt: z.string(),
  days: num,
  status: z.enum(["ok", "red"]),
  checkedAt: z.string().nullable(),
  triggers: z.array(TriggerHealthItemSchema),
});
export type TriggerHealth = z.infer<typeof TriggerHealthSchema>;
export type TriggerHealthItem = TriggerHealth["triggers"][number];
export type TriggerVerdict = z.infer<typeof verdict>;

/** The triggers a live campaign waits on, in served order; the rest keep their history only. */
export function watchedTriggers(data: TriggerHealth): { watched: TriggerHealthItem[]; unwatched: TriggerHealthItem[] } {
  return { watched: data.triggers.filter((t) => t.watched), unwatched: data.triggers.filter((t) => !t.watched) };
}

/** The watched triggers red right now, in served order. */
export function redTriggers(data: TriggerHealth): TriggerHealthItem[] {
  return data.triggers.filter((t) => t.watched && t.status === "red");
}

/** A verdict as a word: the producer's own status, capitalised; null = not checked. Display only. */
export function verdictWord(status: TriggerVerdict | null): string {
  if (status === "red") return "Red";
  if (status === "ok") return "OK";
  if (status === "unknown") return "Unknown";
  return "Not checked";
}

/** The colour one served verdict wears on every surface (a day's bar, the trigger's dot, the hub). Display only. */
export function verdictColor(status: TriggerVerdict | null): string {
  if (status === "red") return "var(--data-rose)";
  if (status === "ok") return "var(--run)";
  if (status === "unknown") return "var(--data-amber)";
  return "var(--fg-4)";
}
