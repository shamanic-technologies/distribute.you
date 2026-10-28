import { z } from "zod";

/**
 * Monitoring > Triggers > Prospects waiting (staff only, REACTIVE-THROUGHPUT-1028), alias-free so vitest reads it directly.
 *
 * When a prospect acts (fills a form, replies, gives a number), campaign-service records an OCCURRENCE and a campaign
 * answers it. One carrying a person, still not answered 30 minutes later and genuinely blocked (not a money hold, not a
 * turn in a queue that moves) is STUCK and makes the read red. Read through api-service's staff passthrough of
 * campaign-service `GET /internal/ops/stuck-occurrences?days=N` (campaign-service #797). Before it, every stuck one was a
 * staff email (48 on 2026-10-28, all people queued behind a newsletter burst); red on the hub IS the alert now. The page
 * draws the served verdict, list and daily series as served: no sort, no sum, no re-grading.
 */

const num = z.number();

export const StuckOccurrenceSchema = z.object({
  occurrenceId: z.string(),
  orgId: z.string(),
  brandId: z.string(),
  offerId: z.string(),
  triggerId: z.string().nullable(),
  campaignId: z.string().nullable(),
  campaignName: z.string().nullable(),
  person: z.object({ name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() }).nullable(),
  reasons: z.array(z.string()),
  lastError: z.string().nullable(),
  attempts: num,
  waitingSince: z.string(),
});

export const StuckOccurrencesSchema = z.object({
  generatedAt: z.string(),
  days: num,
  stuckAfterMinutes: num,
  status: z.enum(["ok", "red"]),
  stuck: num,
  queued: num,
  stuckByReason: z.array(z.object({ reason: z.string(), count: num, oldestWaitingSince: z.string() })),
  stuckOccurrences: z.array(StuckOccurrenceSchema),
  byDay: z.array(z.object({ day: z.string(), answered: num, answeredLate: num, skipped: num, failed: num, waiting: num })),
});
export type StuckOccurrences = z.infer<typeof StuckOccurrencesSchema>;
export type StuckOccurrence = z.infer<typeof StuckOccurrenceSchema>;

/** campaign-service's hold reasons (`STEP_TRIGGER_SKIPS`) as people say them. Display only. */
const REASON_NAMES: Record<string, string> = {
  failure_backoff: "Campaign failing, waiting to retry",
  dispatch_refused: "Run refused",
  run_in_flight: "Behind a run that does not move",
  cohort_run_in_flight: "Behind a sibling run that does not move",
  sales_funnel_caps_unavailable: "Budget not readable",
  no_serveable_audience: "Nobody left to serve",
  play_allows_no_workflow: "No workflow allowed yet",
  incomplete_campaign: "Campaign incomplete",
  no_workflow: "No workflow",
  unnamed: "No reason given",
};

/** A hold reason as people say it; an unknown one shows as served, underscores as spaces. Display only. */
export function waitReasonName(reason: string): string {
  return REASON_NAMES[reason] ?? reason.replace(/_/g, " ");
}

/** Who waits: their name, else their email, else their phone; null when the occurrence names nobody. Display only. */
export function waitingPerson(o: Pick<StuckOccurrence, "person">): string | null {
  const p = o.person;
  return p ? p.name ?? p.email ?? p.phone ?? null : null;
}
