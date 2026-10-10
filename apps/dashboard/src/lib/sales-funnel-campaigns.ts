import { z } from "zod";

/**
 * A campaign IS a sales funnel (owner 2026-10-10): brand x offer x sales funnel, run or paused
 * as ONE (campaign-service `/sales-funnel-campaigns`), its money a MAX BUDGET and a MAX VOLUME
 * (billing `/brands/:b/offers/:o/sales-funnels/:f/caps`). The customer reads a name, a face, a
 * status, its caps and its results; the words funnel / pipe / leg never reach the screen.
 *
 * Alias-free (real unit tests): schemas, parsers and pure display helpers only.
 */

/** One part the campaign runs (an ordinary campaign row), campaign-service's own fields. */
const SalesFunnelUnitSchema = z.object({
  campaignId: z.string(),
  featureSlug: z.string(),
  legKey: z.string(),
  status: z.string(),
  workflowSlug: z.string().nullable(),
  name: z.string(),
});

export const SalesFunnelCampaignSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  offerId: z.string(),
  salesFunnelId: z.string(),
  salesFunnelName: z.string(),
  status: z.string(),
  stopReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  units: z.array(SalesFunnelUnitSchema),
});

export type SalesFunnelCampaign = z.infer<typeof SalesFunnelCampaignSchema>;
export type SalesFunnelUnit = z.infer<typeof SalesFunnelUnitSchema>;

const ListSchema = z.object({ salesFunnelCampaigns: z.array(SalesFunnelCampaignSchema) });
const OneSchema = z.object({ salesFunnelCampaign: SalesFunnelCampaignSchema });

function parse<T>(schema: z.ZodType<T>, raw: unknown, where: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${where}: response shape mismatch`, { issues: parsed.error.issues, raw });
    throw new Error(`[dashboard] ${where}: invalid response shape`);
  }
  return parsed.data;
}

export const parseSalesFunnelCampaigns = (raw: unknown) => parse(ListSchema, raw, "listSalesFunnelCampaigns").salesFunnelCampaigns;
export const parseSalesFunnelCampaign = (raw: unknown, where: string) => parse(OneSchema, raw, where).salesFunnelCampaign;

/** campaign-service's status vocabulary: `ongoing` runs, anything else does not. */
export const isFunnelCampaignOn = (c: Pick<SalesFunnelCampaign, "status">) => c.status === "ongoing";

/**
 * The face of a campaign's name: features-service draws it from the NAME alone
 * (`GET /public/catalogue/faces/:name.svg`, `faceOf` = the URL-encoded name), served
 * through the gateway's public route. A pure display lookup.
 */
export function funnelCampaignFaceSrc(name: string): string {
  return `/api/v1/public/catalogue/faces/${encodeURIComponent(name)}.svg`;
}

// ─── Caps (billing) ─────────────────────────────────────────────────────────────────────

export const CAP_PERIODS = ["one_off", "daily", "weekly", "monthly"] as const;
export type CapPeriod = (typeof CAP_PERIODS)[number];

const PeriodSchema = z.enum(CAP_PERIODS);
// Amounts arrive as strings (bigint columns): coerce, but keep null as null.
const cents = z.coerce.number();

const MaxBudgetSchema = z.object({
  amountCents: cents,
  period: PeriodSchema,
  periodStart: z.string(),
  periodEnd: z.string().nullable(),
  consumedCents: cents.nullable(),
  remainingCents: cents.nullable(),
  reached: z.boolean().nullable(),
  consumedUnavailableReason: z.string().nullable(),
  consumedUnavailableDetail: z.string().nullable(),
});

const MaxVolumeSchema = z.object({
  count: z.coerce.number(),
  period: PeriodSchema,
  unit: z.string(),
  periodStart: z.string(),
  periodEnd: z.string().nullable(),
  consumed: z.coerce.number().nullable(),
  remaining: z.coerce.number().nullable(),
  reached: z.boolean().nullable(),
  consumedUnavailableReason: z.string().nullable(),
  consumedUnavailableDetail: z.string().nullable(),
});

export const SalesFunnelCapsSchema = z.object({
  brandId: z.string(),
  offerId: z.string(),
  salesFunnelId: z.string(),
  stated: z.boolean(),
  updatedAt: z.string().nullable(),
  maxBudget: MaxBudgetSchema.nullable(),
  maxVolume: MaxVolumeSchema.nullable(),
});

export type SalesFunnelCaps = z.infer<typeof SalesFunnelCapsSchema>;
export type MaxBudget = z.infer<typeof MaxBudgetSchema>;
export type MaxVolume = z.infer<typeof MaxVolumeSchema>;

export const parseSalesFunnelCaps = (raw: unknown, where: string) => parse(SalesFunnelCapsSchema, raw, where);

/** The PUT body: both keys always (object states the cap, null clears it). */
export interface SalesFunnelCapsInput {
  maxBudget: { amountCents: number; period: CapPeriod } | null;
  maxVolume: { count: number; period: CapPeriod } | null;
}

/** How a period reads after an amount: "$50/week", "200 people/month", "$300 in total". */
export function capPeriodSuffix(period: CapPeriod): string {
  switch (period) {
    case "daily":
      return "/day";
    case "weekly":
      return "/week";
    case "monthly":
      return "/month";
    case "one_off":
      return " in total";
  }
}

/** The window a consumed figure covers, for a sentence: "this week", "so far". */
export function capWindowWords(period: CapPeriod): string {
  switch (period) {
    case "daily":
      return "today";
    case "weekly":
      return "this week";
    case "monthly":
      return "this month";
    case "one_off":
      return "so far";
  }
}

/** The period's name in the cap editor. */
export const CAP_PERIOD_LABEL: Record<CapPeriod, string> = {
  daily: "Per day",
  weekly: "Per week",
  monthly: "Per month",
  one_off: "In total",
};

/** Whole dollars, no cents: a cap is a promise amount. */
export function formatCapUsd(amountCents: number): string {
  return `$${Math.round(amountCents / 100).toLocaleString("en-US")}`;
}

export function maxBudgetLabel(b: Pick<MaxBudget, "amountCents" | "period">): string {
  return `${formatCapUsd(b.amountCents)}${capPeriodSuffix(b.period)}`;
}

/** The volume unit is billing's `first_contacts`: a new person contacted. */
export function maxVolumeLabel(v: Pick<MaxVolume, "count" | "period">): string {
  return `${v.count.toLocaleString("en-US")} ${v.count === 1 ? "person" : "people"}${capPeriodSuffix(v.period)}`;
}

/**
 * Why a consumed figure is missing, in one plain line. billing names the reason; a reason we
 * have no sentence for still says something true and logs the token.
 */
export function capUnavailableSentence(reason: string | null): string {
  switch (reason) {
    case "volume_not_measured_on_channel":
      return "Not counted on this channel yet.";
    case "no_proactive_pipe":
      return "This campaign contacts nobody first.";
    default:
      if (reason) console.error("[sales-funnel-caps] no sentence for consumedUnavailableReason", { reason });
      return "Could not count this right now.";
  }
}

/** Whole positive dollars typed in a field, or null. */
export function parseWholeAmount(v: string): number | null {
  const t = v.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}
