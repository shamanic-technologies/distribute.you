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
import { OutcomeAccountingSchema } from "./outcome-accounting";

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
  /** Null = the ledger holds no count for this step (LEDGER-ONLY-1107: never 0); see the step's `outcomesUnavailableReason`. */
  outcomes: z.number().nullable(),
  costPerOutcomeUsd: z.number().nullable(),
  cumulativeSpendUsd: z.number(),
  cumulativeOutcomes: z.number().nullable(),
  cumulativeCostPerOutcomeUsd: z.number().nullable(),
  learning: z.boolean().nullable(),
});
export type OutcomeCostMonth = z.infer<typeof OutcomeCostMonthSchema>;

const ReturnSchema = z.object({ roiMultiple: z.number().nullable(), unavailableReason: z.string().nullable() });

/**
 * BRAND-VALUE-ROI-1108 (features-service v0.179.556, brand read only): one outcome row across the brand's offers, value
 * TRACED per offer (each Unit carries the value of the offer its campaign states), expected figures = a flexible budget at
 * the actual spend mix. A return only where the outcome IS a campaign Target (ROI-CONSISTENCY-1103). An expected figure
 * has no history: the chart's dotted line is today's figure. Optional: not served on the offer read.
 */
export const OfferMixSchema = z.object({
  rule: z.string(),
  weightBasis: z.string(),
  offers: z.array(
    z.object({
      offerId: z.string(),
      weightUsd: z.number().nullable(),
      weightShare: z.number().nullable(),
      valuePerOutcomeUsd: z.number().nullable(),
      expectedCostPerOutcomeUsd: z.number().nullable(),
      isCampaignTarget: z.boolean(),
      expectedReturn: ReturnSchema,
      measuredReturn: z.object({
        roiMultiple: z.number().nullable(),
        targetUnits: z.number().nullable(),
        valueUsd: z.number().nullable(),
        spentUsd: z.number().nullable(),
        unavailableReason: z.string().nullable(),
      }),
      unavailableReason: z.string().nullable(),
    }),
  ),
  valuePerOutcomeUsd: z.number().nullable(),
  valueUnavailableReason: z.string().nullable(),
  expectedCostPerOutcomeUsd: z.number().nullable(),
  expectedCostUnavailableReason: z.string().nullable(),
  isCampaignTarget: z.boolean(),
  expectedReturn: ReturnSchema,
  measuredReturn: z.object({
    roiMultiple: z.number().nullable(),
    targetUnits: z.number().nullable(),
    valueUsd: z.number().nullable(),
    spentUsd: z.number().nullable(),
    learning: z.boolean(),
    unavailableReason: z.string().nullable(),
    months: z.array(
      z.object({
        month: z.string(),
        spentUsd: z.number(),
        targetUnits: z.number(),
        valueUsd: z.number().nullable(),
        roiMultiple: z.number().nullable(),
      }),
    ),
  }),
});
export type OfferMix = z.infer<typeof OfferMixSchema>;

export const OutcomeCostStepSchema = z.object({
  /** The producer's canonical step key (`signup`, `website_visit`, `paid_client`…): a string, the producer adds steps. */
  stepKey: z.string(),
  learningOutcomesRequired: z.number(),
  sinceInception: z.object({
    spendUsd: z.number(),
    /** OUR ledger Units of the step: the divisor of `costPerOutcomeUsd` (OUTCOME-COST-CUMUL-1109). */
    outcomes: z.number().nullable(),
    /** Every ledger Unit of the step, ours and another factory's (OUTCOME-TOTAL-UNITS-1110): always >= `outcomes`. */
    totalOutcomes: z.number().nullish(),
    undatedOutcomes: z.number().nullable(),
    costPerOutcomeUsd: z.number().nullable(),
    learning: z.boolean().nullable(),
  }),
  /** Why the ledger holds no count for this step (LEDGER-ONLY-1107), when `sinceInception.outcomes` is null. */
  outcomesUnavailableReason: z.string().nullish(),
  expected: ExpectedSchema,
  /** What one outcome is worth and its served `roi` (P5 OUTCOMES-ENTRY). A per-step return is never shown (ROI-CONSISTENCY-1103). */
  value: z.object({ valuePerOutcomeUsd: z.number().nullable(), unavailableReason: z.string().nullable() }).optional(),
  roi: z.object({ measured: z.number().nullable(), expected: z.number().nullable() }).optional(),
  months: z.array(OutcomeCostMonthSchema),
  /** OUTCOME-ACCOUNTING-1107: the step's cost-accounting report, actual beside expected. */
  accounting: OutcomeAccountingSchema.nullish(),
  offerMix: OfferMixSchema.optional(),
});
export type OutcomeCostStep = z.infer<typeof OutcomeCostStepSchema>;

/**
 * GSC-CONNECTOR-1108: ONE outcome the brand's general ledger holds Units of, whatever its key (a connector's outcome,
 * « Google search click », included), served beside `steps[]` by features-service on the same ledger. `daily` = one
 * point per UTC day, at least the last 28; `units` null = runs-service has not computed that day yet (never a 0).
 */
export const LedgerOutcomeSchema = z.object({
  outcomeKey: z.string(),
  units: z.number(),
  ourUnits: z.number(),
  costPerUnitUsd: z.number().nullable(),
  costPerUnitUnavailableReason: z.string().nullable(),
  productionCostUsd: z.number().nullable(),
  daily: z.array(z.object({ date: z.string(), units: z.number().nullable(), ourUnits: z.number().nullable() })),
});
export type LedgerOutcome = z.infer<typeof LedgerOutcomeSchema>;

export const OfferOutcomeCostSeriesSchema = z.object({
  // Shared by the offer read and the BRAND read (features-service v0.179.548): the brand body
  // carries `offerIds` and no `offerId`.
  offerId: z.string().nullish(),
  offerIds: z.array(z.string()).nullish(),
  brandId: z.string(),
  pricing: z.string(),
  firstSpendDay: z.string().nullable(),
  steps: z.array(OutcomeCostStepSchema),
  /** Every outcome the brand's ledger holds (features-service GSC-CONNECTOR-1108); absent on a body served before it. */
  ledgerOutcomes: z.array(LedgerOutcomeSchema).optional(),
});
export type OfferOutcomeCostSeries = z.infer<typeof OfferOutcomeCostSeriesSchema>;

/**
 * A served outcome count in words: the figure, or "not counted yet" when the ledger holds none for the step
 * (LEDGER-ONLY-1107: a missing count is null with a reason, never 0).
 */
export function outcomeCountWords(n: number | null, formatCount: (n: number) => string): string {
  return n == null ? "not counted yet" : formatCount(n);
}

/** One step's series, or null when the producer serves none for it. */
export function costStepOf(series: OfferOutcomeCostSeries | null | undefined, stepKey: string): OutcomeCostStep | null {
  return series?.steps.find((s) => s.stepKey === stepKey) ?? null;
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

/** One outcome as the brand's ledger states it, or null when the ledger holds no Unit of it. */
export function ledgerOutcomeOf(series: OfferOutcomeCostSeries | null | undefined, key: string): LedgerOutcome | null {
  return series?.ledgerOutcomes?.find((o) => o.outcomeKey === key) ?? null;
}

/**
 * The ledger outcomes no other row of the Outcomes overview already shows, in the producer's order. A key is shown
 * already when a row carries it, or when it is the lead state a shown step's Units are declared under (the public
 * catalogue's `leadState`: a website visit's Units sit under `lead_visited`). Joins only, nothing counted.
 */
export function unlistedLedgerOutcomes(
  series: OfferOutcomeCostSeries | null | undefined,
  listedKeys: ReadonlySet<string>,
  leadStateOf: (stepKey: string) => string | null,
): LedgerOutcome[] {
  const shown = new Set(listedKeys);
  for (const k of listedKeys) {
    const state = leadStateOf(k);
    if (state) shown.add(state);
  }
  return (series?.ledgerOutcomes ?? []).filter((o) => !shown.has(o.outcomeKey));
}

/** The last `days` points of a served daily series, as served (a display window, nothing summed). */
export function lastDays<T>(daily: readonly T[], days: number): T[] {
  return daily.slice(Math.max(0, daily.length - days));
}
