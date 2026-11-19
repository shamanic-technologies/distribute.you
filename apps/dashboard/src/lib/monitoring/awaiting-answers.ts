import { z } from "zod";

/**
 * Monitoring > Triggers > Waiting on us (staff only, REPLY-NO-BALANCE-1118), alias-free so vitest reads it directly.
 *
 * A person who wrote to a brand and has waited on our answer for more than an hour. lead-service sweeps every brand a
 * person wrote to (every 15 min, the "Needs your call" rule) and serves `GET /internal/ops/awaiting-answers?days=N`, read
 * through api-service's staff passthrough `/v1/leads/ops/awaiting-answers`. Red on the hub IS the alert (never an email).
 * The page draws the served verdict, list and daily series as served: no sort, no sum, no re-grading.
 */

const num = z.number();

export const AwaitingPersonSchema = z.object({
  orgId: z.string(),
  brandId: z.string(),
  leadId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  waitingSince: z.string(),
  lastMessageAt: z.string(),
  lastMessageKind: z.string(),
});

export const AwaitingDaySchema = z.object({
  day: z.string(),
  waitingOverHour: num,
  maxWaitingOverHour: num,
});

export const AwaitingAnswersSchema = z.object({
  generatedAt: z.string(),
  days: num,
  status: z.enum(["ok", "red"]),
  redAfterMinutes: num,
  lastSweepAt: z.string().nullable(),
  sweepStale: z.boolean(),
  lastSweepFailedBrands: num,
  waiting: z.array(AwaitingPersonSchema),
  byDay: z.array(AwaitingDaySchema),
});
export type AwaitingAnswers = z.infer<typeof AwaitingAnswersSchema>;
export type AwaitingPerson = z.infer<typeof AwaitingPersonSchema>;
export type AwaitingDay = z.infer<typeof AwaitingDaySchema>;

/** How long a person has waited, in the largest whole unit ("3 h", "7 days"). Display only. */
export function waitedFor(sinceIso: string, nowIso: string): string {
  const ms = Date.parse(nowIso) - Date.parse(sinceIso);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} days`;
}

/** The kind of their last message as people say it. Display only. */
export function messageKindName(kind: string): string {
  if (kind === "question") return "Asked a question";
  if (kind === "interest") return "Said they are interested";
  return "Wrote to us";
}
