import { z } from "zod";

/**
 * A campaign's forecast (features-service OUTCOME-FORECAST-1117, `outcome-forecast`): each outcome of the campaign
 * projected ahead (expected line + p10-p90 range), the revenue it leads to, when the next Target is expected, the same
 * at bigger budgets, and every assumption behind it. Everything is SERVED: this module parses and words, it computes
 * no figure. Alias-free on purpose (unit-tested).
 */

const num = z.number().nullable();
const TunnelSchema = z.object({ expected: z.array(z.number()), median: z.array(z.number()), p10: z.array(z.number()), p90: z.array(z.number()) }).passthrough();
export type ForecastTunnel = z.infer<typeof TunnelSchema>;

const NextTargetSchema = z
  .object({
    shareWithinSearch: z.number(),
    searchDays: z.number(),
    medianDate: z.string().nullable(),
    earlyDate: z.string().nullable(),
    lateDate: z.string().nullable(),
    expectedOneByDate: z.string().nullable(),
    expectedOneInDays: num,
  })
  .passthrough();
export type ForecastNextTarget = z.infer<typeof NextTargetSchema>;

const BandSchema = z.object({ median: z.number(), p10: z.number(), p90: z.number() }).passthrough().nullable();

const TransitionSchema = z
  .object({
    fromStep: z.string(),
    toStep: z.string(),
    yield: z.object({ source: z.string(), unitsPerUnit: num, median: num, p10: num, p90: num }).passthrough(),
    delay: z.object({ source: z.string(), pairs: z.number(), thinSample: z.boolean(), medianHours: num }).passthrough(),
  })
  .passthrough();
export type ForecastTransition = z.infer<typeof TransitionSchema>;

export const CampaignOutcomeForecastSchema = z
  .object({
    salesFunnelCampaignId: z.string(),
    computedAt: z.string(),
    unavailableReason: z.string().nullable(),
    hypotheses: z
      .object({
        budget: z
          .object({
            monthlyUsd: num,
            pausedReason: z.string().nullable(),
            resumesAt: z.string().nullable(),
            unavailableReason: z.string().nullable(),
          })
          .passthrough(),
        entryCost: z.object({ step: z.string(), label: z.string(), source: z.string(), usdPerUnit: num }).passthrough().nullable(),
        transitions: z.array(TransitionSchema),
        targetValue: z.object({ usd: z.number() }).passthrough().nullable(),
      })
      .passthrough(),
    forecast: z
      .object({
        days: z.array(z.string()),
        outcomes: z.array(
          z
            .object({
              step: z.string(),
              label: z.string(),
              isTarget: z.boolean(),
              unitsToDate: z.number(),
              cumulativeUnits: TunnelSchema,
              unitsPerTarget: BandSchema,
              expectedRevenuePerUnitUsd: BandSchema,
            })
            .passthrough(),
        ),
        spendAheadUsd: z.array(z.number()),
        expectedRevenueUsd: TunnelSchema.nullable(),
        nextTarget: NextTargetSchema,
      })
      .passthrough()
      .nullable(),
    alternatives: z.array(
      z
        .object({
          budgetMultiplier: z.number(),
          monthlyBudgetUsd: num,
          nextTarget: NextTargetSchema,
          targetCumulativeUnits: TunnelSchema,
          expectedRevenueUsd: TunnelSchema.nullable(),
          spendAheadUsd: z.array(z.number()),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type CampaignOutcomeForecast = z.infer<typeof CampaignOutcomeForecastSchema>;

/** "Mar 2028" from a served UTC day. */
export function monthYearWords(day: string): string {
  return new Date(`${day.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** When the next Target is expected, in words. A null date is "later than the served search window", never a blank. */
export function nextTargetWords(next: ForecastNextTarget): string {
  if (next.expectedOneByDate) return `around ${monthYearWords(next.expectedOneByDate)}`;
  const years = Math.round(next.searchDays / 365);
  return `in more than ${years} years at this budget`;
}

/** Where an assumption comes from, in the reader's words. An unknown source is shown as served. */
export function sourceWords(source: string): string {
  switch (source) {
    case "campaign":
      return "measured on this campaign";
    case "brand":
      return "measured on your brand";
    case "fleet":
      return "measured across our clients";
    case "plan":
    case "default":
      return "our estimate";
    default:
      return source.replace(/_/g, " ");
  }
}

/** A served delay in hours as "about 2 days" / "about 3 hours". */
export function delayWords(hours: number | null): string | null {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours < 1) return "under an hour";
  if (hours < 36) {
    const h = Math.round(hours);
    return `about ${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const d = Math.round(hours / 24);
  if (d < 60) return `about ${d} days`;
  return `about ${Math.round(d / 30)} months`;
}

/** Why no forecast is drawn, in plain words. */
export function forecastUnavailableWords(reason: string | null): string {
  if (!reason) return "The forecast is being prepared.";
  if (reason === "campaign_states_no_target") return "This campaign has no Target yet, so there is nothing to forecast.";
  if (reason === "no_unit_reaches_a_step") return "The forecast starts with this campaign's first results.";
  if (reason.startsWith("yield_unmeasured")) return "The forecast starts once a step has enough results to measure.";
  return "The forecast is not available yet.";
}
