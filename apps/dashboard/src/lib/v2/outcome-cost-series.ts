/**
 * $ / OUTCOME OVER TIME, every outcome step of an offer (features-service OUTCOME-COST-SERIES-1027).
 *
 * Owner 2026-10-27 ("A"): what the client spent on the offer ÷ the outcomes reached by people WE
 * contacted, never ÷ everyone the client's own tools report. Per month and cumulative since inception,
 * net of discount. Every figure is served: this module only parses and picks.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";

const ExpectedSchema = z.object({
  costPerOutcomeUsd: z.number().nullable(),
  basis: z.string().nullable(),
  combinationKey: z.string().nullable(),
  unavailableReason: z.string().nullable(),
});

export const OutcomeCostMonthSchema = z.object({
  /** YYYY-MM (UTC). */
  month: z.string(),
  spendUsd: z.number(),
  outcomes: z.number(),
  costPerOutcomeUsd: z.number().nullable(),
  cumulativeSpendUsd: z.number(),
  cumulativeOutcomes: z.number(),
  cumulativeCostPerOutcomeUsd: z.number().nullable(),
  learning: z.boolean(),
});
export type OutcomeCostMonth = z.infer<typeof OutcomeCostMonthSchema>;

export const OutcomeCostStepSchema = z.object({
  /** The producer's canonical step key (`signup`, `website_visit`, `paid_client`…): a string, the producer adds steps. */
  stepKey: z.string(),
  learningOutcomesRequired: z.number(),
  sinceInception: z.object({
    spendUsd: z.number(),
    outcomes: z.number(),
    undatedOutcomes: z.number(),
    costPerOutcomeUsd: z.number().nullable(),
    learning: z.boolean(),
  }),
  expected: ExpectedSchema,
  /** What one outcome is worth and its return (P5 OUTCOMES-ENTRY); optional until features-service deploys them. */
  value: z.object({ valuePerOutcomeUsd: z.number().nullable(), unavailableReason: z.string().nullable() }).optional(),
  roi: z.object({ measured: z.number().nullable(), expected: z.number().nullable() }).optional(),
  months: z.array(OutcomeCostMonthSchema),
});
export type OutcomeCostStep = z.infer<typeof OutcomeCostStepSchema>;

export const OfferOutcomeCostSeriesSchema = z.object({
  offerId: z.string(),
  brandId: z.string(),
  pricing: z.string(),
  firstSpendDay: z.string().nullable(),
  steps: z.array(OutcomeCostStepSchema),
});
export type OfferOutcomeCostSeries = z.infer<typeof OfferOutcomeCostSeriesSchema>;

/** One step's series, or null when the producer serves none for it. */
export function costStepOf(series: OfferOutcomeCostSeries | null | undefined, stepKey: string): OutcomeCostStep | null {
  return series?.steps.find((s) => s.stepKey === stepKey) ?? null;
}

/** A step's ROI as every v2 surface prints it (`RoiValue`): measured, greyed while Learning; else the served expected one; else the reason. */
export interface OutcomeRoi {
  value: number | null;
  expected: boolean;
  reason: string | null;
  learning?: boolean;
  expectedValue?: number | null;
}

export function outcomeRoiOf(step: OutcomeCostStep | null): OutcomeRoi {
  if (!step?.roi) return { value: null, expected: false, reason: null };
  const { measured, expected } = step.roi;
  if (measured != null) return { value: measured, expected: false, reason: null, learning: step.sinceInception.learning, expectedValue: expected };
  if (expected != null) return { value: expected, expected: true, reason: null };
  return { value: null, expected: false, reason: step.value?.unavailableReason ?? step.expected.unavailableReason };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03" → "Mar 2026" (display only; "Mar 26" read as a day). */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const i = Number(m) - 1;
  if (!y || !(i >= 0 && i < 12)) return month;
  return `${MONTHS[i]} ${y}`;
}

/** A chart tick: the month alone, with its year on the first tick and on every January. */
export function monthTick(month: string, index: number): string {
  const [, m] = month.split("-");
  const i = Number(m) - 1;
  if (!(i >= 0 && i < 12)) return month;
  return index === 0 || i === 0 ? monthLabel(month) : MONTHS[i];
}
