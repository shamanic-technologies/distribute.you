/**
 * The signup campaign as ONE campaign (owner 2026-11-22, ONE-CAMPAIGN-VOLUME-1122): one brief, a wanted volume
 * of meetings booked per day / week / month, the budget range that volume costs (20th to 80th percentile), when
 * the first meetings land, and the campaign's own max budget = the top of that range. « Les gens ne pensent pas
 * en 20/jour » : the visitor states outcomes, never a daily spend.
 *
 * Every figure is features-service's (`GET /v1/offers/:offerId/target-volume-estimate`), asked again for each
 * volume the visitor types (the producer applies the volume on every read off a cached cell): nothing is
 * multiplied or projected here. Alias-free so it carries real unit tests.
 */
import { z } from "zod";

/** The outcome the visitor counts (owner 2026-11-22: « Meeting booked oui »), a catalogue step key. */
export const SIGNUP_TARGET = "meeting_booked";

export const VOLUME_PERIODS = ["day", "week", "month"] as const;
export type VolumePeriod = (typeof VOLUME_PERIODS)[number];

export function asVolumePeriod(v: unknown, fallback: VolumePeriod): VolumePeriod {
  return (VOLUME_PERIODS as readonly unknown[]).includes(v) ? (v as VolumePeriod) : fallback;
}

const usd = z.number().nullable();

export const VolumeEstimateSchema = z
  .object({
    target: z.object({ step: z.string(), label: z.string() }).passthrough(),
    /** measured = this brand's own; stated, fleet, default = weaker hypotheses. */
    basis: z.string().nullable(),
    isExpected: z.boolean(),
    unavailableReason: z.string().nullable(),
    volume: z.object({ volume: z.number(), period: z.string() }).passthrough().nullable(),
    budget: z
      .object({ period: z.string(), lowUsd: usd, highUsd: usd, maxUsd: usd, unavailableReason: z.string().nullable() })
      .passthrough()
      .nullable(),
    timing: z
      .object({
        /** Week after launch the first meeting is expected; null = later than 26 weeks. */
        firstUnitsWeek: z.number().nullable(),
        /** Week the pace reaches 80% of the volume; null = later than 26 weeks. */
        steadyFromWeek: z.number().nullable(),
        unavailableReason: z.string().nullable(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();
export type VolumeEstimate = z.infer<typeof VolumeEstimateSchema>;

export function parseVolumeEstimate(raw: unknown): VolumeEstimate {
  const parsed = VolumeEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[campaign-volume] estimate shape mismatch", { issues: parsed.error.issues });
    throw new Error("[campaign-volume] invalid estimate body");
  }
  return parsed.data;
}

/** A whole number of outcomes, at least 1; null = not a volume. */
export function wholeVolume(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/** A promise amount: whole dollars with separators ("$1,523"). */
export function wholeUsdText(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** "$1,523 to $4,922" from the served budget; null when the producer priced nothing. */
export function budgetRangeText(e: VolumeEstimate): string | null {
  const b = e.budget;
  if (!b || b.lowUsd == null || b.highUsd == null) return null;
  return `${wholeUsdText(b.lowUsd)} to ${wholeUsdText(b.highUsd)}`;
}

/**
 * "First meetings around week 1, then about 10 a week from week 10": the served timing in words, with the
 * served outcome label; null when the producer states none (the line is then not shown).
 */
export function timingText(e: VolumeEstimate, volume: number, period: VolumePeriod): string | null {
  const t = e.timing;
  if (!t || t.firstUnitsWeek == null) return null;
  const plural = e.target.label.toLowerCase();
  const first = `First ${plural} around week ${t.firstUnitsWeek}`;
  if (t.steadyFromWeek == null) return `${first}.`;
  return `${first}, then about ${volume.toLocaleString("en-US")} a ${period} from week ${t.steadyFromWeek}.`;
}

/** The ONE campaign Launch creates: its funnels (we split it, the visitor never sees them), Target, brief, volume and cap. */
export interface OneCampaignPlan {
  salesFunnelIds: string[];
  target: string;
  brief: string;
  volume: number;
  period: VolumePeriod;
  /** The campaign's max budget per period: the top of the served range (owner 2026-11-22), whole cents. */
  maxBudgetCents: number;
}

/**
 * The plan to launch, or the one plain sentence that says what to fix. The estimate must be the one read for
 * THIS volume and period (the cap is its top): a stale one is refused, never stretched.
 */
export function oneCampaignPlan(input: {
  salesFunnelIds: string[];
  brief: string | null;
  volume: string;
  period: VolumePeriod;
  estimate: VolumeEstimate | null;
}): { plan: OneCampaignPlan } | { problem: string } {
  if (input.salesFunnelIds.length === 0) return { problem: "We could not load your campaign. Try again." };
  const brief = (input.brief ?? "").trim();
  if (!brief) return { problem: "Say in a few words what your campaign should do." };
  const volume = wholeVolume(input.volume);
  if (volume == null) return { problem: "Say how many you want, as a whole number." };
  const e = input.estimate;
  if (!e || e.volume?.volume !== volume || e.volume?.period !== input.period) return { problem: "One moment, we are pricing that volume." };
  const max = e.budget?.maxUsd;
  if (max == null || !(max > 0)) return { problem: "We could not price this campaign yet. Try again in a minute." };
  return {
    plan: {
      salesFunnelIds: input.salesFunnelIds,
      target: SIGNUP_TARGET,
      brief,
      volume,
      period: input.period,
      maxBudgetCents: Math.ceil(max * 100),
    },
  };
}
