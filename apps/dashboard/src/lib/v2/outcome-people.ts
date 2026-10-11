/**
 * EVERY outcome of a brand, campaigns or not (owner 2026-10-11: « tous mes outcomes …
 * même s'ils ne viennent pas de campaigns distribute »).
 *
 * crm-service counts, per outcome step, the distinct PEOPLE the brand's own tools state
 * reached it (PostHog, Clerk, Stripe, GoHighLevel), one person once across sources, and
 * lists them. Its step tokens are lead-service's bucket tokens, so one vocabulary keys
 * both reads. This module only parses and names: every count is the producer's.
 *
 * `source` is a STRING, never a closed enum: crm-service adds sources.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";

const ScopeSchema = z.object({
  status: z.string(),
  lastBuiltAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

export const OutcomeStepStatSchema = z.object({
  /** lead-service's bucket token (`website_visit`, `signup`, `form_submission`, `meeting_booked`, `meeting_attended`, `sale`). */
  step: z.string(),
  people: z.coerce.number(),
  sources: z.array(z.object({ source: z.string(), people: z.coerce.number() })),
  contactedByUs: z.coerce.number(),
});
export type OutcomeStepStat = z.infer<typeof OutcomeStepStatSchema>;

export const BrandOutcomesSchema = z.object({
  brandId: z.string(),
  scope: ScopeSchema,
  steps: z.array(OutcomeStepStatSchema),
});
export type BrandOutcomes = z.infer<typeof BrandOutcomesSchema>;

export const OutcomePersonSchema = z.object({
  personId: z.string().nullable(),
  personKey: z.string(),
  displayName: z.string().nullable(),
  company: z.string().nullable(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  reachedAt: z.string().nullable(),
  sources: z.array(z.object({ source: z.string(), reachedAt: z.string().nullable() })),
  contactedByUs: z.boolean(),
  state: z.string().nullish(),
  stateSource: z.string().nullish(),
});
export type OutcomePerson = z.infer<typeof OutcomePersonSchema>;

export const OutcomePeopleSchema = z.object({
  brandId: z.string(),
  step: z.string(),
  total: z.coerce.number(),
  limit: z.coerce.number(),
  offset: z.coerce.number(),
  people: z.array(OutcomePersonSchema),
});
export type OutcomePeople = z.infer<typeof OutcomePeopleSchema>;

/** Rows per page of one outcome's people. */
export const OUTCOME_PEOPLE_PAGE_SIZE = 50;

/** The step stat of one bucket, or null when crm-service serves none for it. */
export function stepStatOf(outcomes: BrandOutcomes | null | undefined, bucket: string): OutcomeStepStat | null {
  return outcomes?.steps.find((s) => s.step === bucket) ?? null;
}

/** The buckets crm-service states people for, in its funnel order, empty ones dropped. */
export function reachedBuckets(outcomes: BrandOutcomes | null | undefined): string[] {
  return (outcomes?.steps ?? []).filter((s) => s.people > 0).map((s) => s.step);
}
