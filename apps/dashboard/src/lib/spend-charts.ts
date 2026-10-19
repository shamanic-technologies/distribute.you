import { z } from "zod";

/**
 * WHY A DAY COSTS WHAT IT COSTS, AND WHETHER IT IS CONVERGING (owner 2026-10-19, SPEND-CHARTS-1019).
 *
 * features-service serves one chart per scope (an offer, a sales funnel campaign, each pipe of it):
 * one point per UTC day since the scope's first activity, the MEASURED cost per outcome (served
 * while Learning), the conversion by entry cohort, the Learning and cohort-maturity flags, what the
 * day's spend bought per action, and the expected values the lines converge to. Gateway:
 * `/v1/features/brands/:brandId/sales-funnel-campaigns/:id/spend-charts` and
 * `/v1/offers/:offerId/spend-charts?brandId=`, both read with `pricing=net`.
 *
 * Nothing here computes a stat: the helpers below only SHAPE served points for drawing (which
 * line a point sits on, where the dotted tail ends) and pick a served day to put in words.
 * Alias-free on purpose (unit tests import it directly).
 */

const num = z.coerce.number();
const numOrNull = z.coerce.number().nullable();

export const SpendActionDaySchema = z.object({
  key: z.string(),
  label: z.string(),
  step: z.string().nullish(),
  unit: z.string().nullish(),
  spendUsd: num,
  actions: numOrNull.optional(),
  costPerActionUsd: numOrNull.optional(),
});
export type SpendActionDay = z.infer<typeof SpendActionDaySchema>;

export const SpendChartPointSchema = z.object({
  date: z.string(),
  spendUsd: num,
  cumulativeSpendUsd: num.optional(),
  cumulativeOutcomes: num.optional(),
  costPerOutcomeUsd: numOrNull,
  entered: num.optional(),
  cohortOutcomes: num.optional(),
  cohortConversionPct: numOrNull.optional(),
  cohortMature: z.boolean(),
  cumulativeEntered: num.optional(),
  cumulativeConverted: num.optional(),
  conversionRatePct: numOrNull,
  matureConversionRatePct: numOrNull.optional(),
  matureOutcomes: num.optional(),
  learning: z.boolean(),
  byAction: z.array(SpendActionDaySchema),
  byActionGapUsd: numOrNull.optional(),
});
export type SpendChartPoint = z.infer<typeof SpendChartPointSchema>;

export const SpendChartSchema = z.object({
  leg: z
    .object({
      channelSlug: z.string(),
      legKey: z.string(),
      fromStep: z.string().nullable(),
      toStep: z.string(),
      maturityDays: num.optional(),
      learningOutcomesRequired: num.optional(),
    })
    .nullable(),
  outcomeStep: z.string().nullable(),
  outcomeUnavailableReason: z.string().nullable().optional(),
  conversionUnavailableReason: z.string().nullable().optional(),
  daily: z.array(SpendChartPointSchema),
  spendByActionUnavailableReason: z.string().nullable().optional(),
  totals: z.object({
    spendUsd: num,
    outcomes: num,
    costPerOutcomeUsd: numOrNull,
    entered: num,
    converted: num,
    conversionRatePct: numOrNull,
    learning: z.boolean().nullable(),
  }),
  expected: z.object({
    costPerOutcomeUsd: numOrNull,
    costPerOutcomeBasis: z.string().nullable().optional(),
    costPerOutcomeUnavailableReason: z.string().nullable().optional(),
    conversionRatePct: numOrNull,
    conversionBasis: z.string().nullable().optional(),
    conversionSource: z.string().nullable().optional(),
    conversionUnavailableReason: z.string().nullable().optional(),
    roiMultiple: numOrNull.optional(),
    roiBasis: z.string().nullable().optional(),
    roiUnavailableReason: z.string().nullable().optional(),
  }),
});
export type SpendChart = z.infer<typeof SpendChartSchema>;

export const PipeSpendChartSchema = SpendChartSchema.extend({
  campaignId: z.string(),
  pipeId: z.string(),
  featureSlug: z.string(),
  legKey: z.string(),
  status: z.string(),
});
export type PipeSpendChart = z.infer<typeof PipeSpendChartSchema>;

export const FunnelCampaignSpendChartsSchema = z.object({
  salesFunnelCampaignId: z.string(),
  brandId: z.string(),
  offerId: z.string(),
  pricing: z.string(),
  campaign: SpendChartSchema,
  pipes: z.array(PipeSpendChartSchema),
});
export type FunnelCampaignSpendCharts = z.infer<typeof FunnelCampaignSpendChartsSchema>;

export const OfferSpendChartsSchema = z.object({
  offerId: z.string(),
  brandId: z.string(),
  pricing: z.string(),
  salesFunnelCampaignIds: z.array(z.string()),
  offer: SpendChartSchema,
});
export type OfferSpendCharts = z.infer<typeof OfferSpendChartsSchema>;

/** One row a convergence line chart draws: the served value on the Learning line OR the measured line. */
export interface ConvergenceRow {
  t: number;
  date: string;
  /** The served value while the scope is Learning (drawn grey). */
  learning: number | null;
  /** The served value once mature (drawn in colour). */
  mature: number | null;
  /** The dotted tail: set on the last measured point and on the tail's end only. */
  expected: number | null;
  /** The served day is a cohort not yet mature (conversion only). */
  maturing: boolean;
}

const DAY_MS = 86_400_000;
const dayT = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * PURE. The served points of one metric as chart rows: each point on the grey (Learning) or the
 * coloured (measured) line, the point where the scope leaves Learning carried by BOTH so the two
 * lines touch, then one extra row past the last day carrying the served expected value, so a
 * dotted line runs from the last measured point toward it. A null served value stays null (no
 * line drawn there); nothing is computed.
 */
export function convergenceRows(
  daily: readonly SpendChartPoint[],
  pick: (p: SpendChartPoint) => number | null,
  expected: number | null,
): ConvergenceRow[] {
  const rows: ConvergenceRow[] = daily.map((p) => {
    const v = pick(p);
    return {
      t: dayT(p.date),
      date: p.date,
      learning: p.learning ? v : null,
      mature: p.learning ? null : v,
      expected: null,
      maturing: !p.cohortMature,
    };
  });
  // Join the two lines where the flag flips: the earlier point also starts the next line.
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = daily[i];
    const b = daily[i + 1];
    if (a.learning === b.learning) continue;
    const v = pick(a);
    if (b.learning) rows[i].learning = v;
    else rows[i].mature = v;
  }
  if (expected == null || rows.length === 0) return rows;
  // The dotted tail starts at the last day that has a value, and ends a little past today.
  let lastIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (pick(daily[i]) != null) {
      lastIdx = i;
      break;
    }
  }
  const first = rows[0].t;
  const last = rows[rows.length - 1].t;
  const tailT = last + Math.max(3 * DAY_MS, Math.round((last - first) * 0.15));
  if (lastIdx >= 0) rows[lastIdx].expected = pick(daily[lastIdx]);
  rows.push({ t: tailT, date: "", learning: null, mature: null, expected, maturing: false });
  return rows;
}

/** PURE. The first served day whose cohort is not yet mature, if any (the "Still maturing" band starts there). */
export function firstMaturingDay(daily: readonly SpendChartPoint[]): string | null {
  return daily.find((p) => !p.cohortMature)?.date ?? null;
}

/** PURE. The latest served day that spent anything, else null. */
export function latestSpendDay(daily: readonly SpendChartPoint[]): SpendChartPoint | null {
  for (let i = daily.length - 1; i >= 0; i--) if (daily[i].spendUsd > 0) return daily[i];
  return null;
}

/** A served unit in the plural ("follow-up" -> "follow-ups"). */
export function unitPlural(unit: string, n: number): string {
  return n === 1 ? unit : `${unit}s`;
}

/** A cost per action: cents shown, and below a cent three decimals ($0.004), never "$0.00". */
export function formatPerActionUsd(usd: number): string {
  if (usd > 0 && usd < 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * PURE. A day's spend in words, from its served actions (channel-agnostic, the producer's units):
 * `counts` "12 prospects, 30 follow-ups", `prices` "$0.06 per prospect · $0.04 per follow-up".
 * An action with no countable unit (writing, reading replies) is spend only and named in `other`.
 */
export function dayInWords(p: SpendChartPoint): { counts: string | null; prices: string | null; other: string | null } {
  const counted = p.byAction.filter((a) => a.unit && a.actions != null && a.actions > 0);
  const counts = counted.map((a) => `${a.actions!.toLocaleString("en-US")} ${unitPlural(a.unit!, a.actions!)}`).join(", ");
  const prices = counted
    .filter((a) => a.costPerActionUsd != null)
    .map((a) => `${formatPerActionUsd(a.costPerActionUsd!)} per ${a.unit}`)
    .join(" · ");
  const other = p.byAction
    .filter((a) => !(a.unit && a.actions != null && a.actions > 0) && a.spendUsd > 0)
    .map((a) => a.label)
    .join(", ");
  return { counts: counts || null, prices: prices || null, other: other || null };
}

/** The action keys features-service serves, in the order a day's bar stacks them. */
export const ACTION_ORDER = ["prospects_found", "first_contacts", "follow_ups", "messages_written", "replies_read", "notifications", "other"] as const;

/** PURE. The served action keys present in a series, in stacking order (an unknown key goes last, kept). */
export function actionKeysOf(daily: readonly SpendChartPoint[]): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const p of daily) for (const a of p.byAction) if (!seen.has(a.key)) seen.set(a.key, a.label);
  const rank = (k: string) => {
    const i = (ACTION_ORDER as readonly string[]).indexOf(k);
    return i === -1 ? ACTION_ORDER.length : i;
  };
  return [...seen.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([key, label]) => ({ key, label }));
}
