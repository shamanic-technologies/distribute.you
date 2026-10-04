import { z } from "zod";

/**
 * An offer's CAMPAIGNS on the Sales path page (owner 2026-10-04): every (channel x leg)
 * its sales paths use, each with ONE budget and an on/off status.
 *
 *  - The budget is billing-service's, one row per (offer, leg, channel): the same ceiling
 *    campaign-service spends (`/brands/:brandId/offers/:offerId/campaign-budgets`). A
 *    proactive campaign (an entry leg) takes a budget, a reactive one (a leg out of a step
 *    a lead reached) a MAX, at most half the offer's entry budgets. Integer cents, per DAY
 *    for prepaid / postpaid, per MONTH in whole dollars for a subscriber (`period`). billing
 *    enforces every rule and answers a `code` per refusal; this module words those codes.
 *  - On/off is campaign-service's campaign status; billing reads it, never stores it.
 *  - The name and face are features-service's `campaignName` (one word per channel x leg).
 *
 * Alias-free (only zod) so it carries real unit tests.
 */

export const CampaignPeriodSchema = z.enum(["day", "month"]);
export type CampaignPeriod = z.infer<typeof CampaignPeriodSchema>;

const CampaignBudgetRowSchema = z
  .object({
    featureSlug: z.string(),
    legKey: z.string(),
    role: z.string().nullable(),
    period: CampaignPeriodSchema,
    /** null = not set. In the ORG's period (`period`), converted when stated in the other one. */
    budgetCents: z.number().nullable(),
    /** The period the customer STATED it in; differs from `period` on a not-yet-restated row. null = not set. */
    statedPeriod: CampaignPeriodSchema.nullable().optional(),
    /** The stored daily ceiling campaign-service paces on (cents, decimal string). */
    dailyBudgetCents: z.coerce.number().nullable().optional(),
    managed: z.boolean().nullable(),
    minimumCents: z.number().int().nullable(),
    capCents: z.number().int().nullable(),
    budgetable: z.boolean(),
  })
  .passthrough();
export type CampaignBudgetRow = z.infer<typeof CampaignBudgetRowSchema>;

export const OfferCampaignBudgetsSchema = z
  .object({
    offerId: z.string(),
    period: CampaignPeriodSchema,
    items: z.array(CampaignBudgetRowSchema),
  })
  .passthrough();
export type OfferCampaignBudgets = z.infer<typeof OfferCampaignBudgetsSchema>;

/** One campaign the offer's sales paths use, as the page lists it. */
export interface OfferCampaign {
  featureSlug: string;
  legKey: string;
  /** features-service `campaignName`; null when the producer names none. */
  name: string | null;
  channelName: string;
  /** We run this channel today (false = recorded, charged only at launch). */
  managed: boolean | undefined;
  /** Out of a step a lead reached: a MAX budget. */
  reactive: boolean;
  fromLabel: string | null;
  toLabel: string;
}

type PathLegLike = {
  legKey: string;
  workedBy: string;
  reactive?: boolean;
  fromStep: { label: string } | null;
  toStep: { label: string };
  channel: { slug: string | null; name: string | null; managed?: boolean; operatedBy?: string; campaignName?: string | null } | null;
};

/**
 * Every campaign the paths use, once each, in the order the paths (ROI desc) first meet
 * them. A leg the customer's own team works is not a campaign of ours.
 */
export function campaignsOfPaths(paths: ReadonlyArray<{ legs: readonly PathLegLike[] }>): OfferCampaign[] {
  const seen = new Set<string>();
  const out: OfferCampaign[] = [];
  for (const p of paths) {
    for (const leg of p.legs) {
      const c = leg.channel;
      if (!c?.slug || !c.name || leg.workedBy === "human" || c.operatedBy === "customer") continue;
      const key = campaignKey(c.slug, leg.legKey);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        featureSlug: c.slug,
        legKey: leg.legKey,
        name: c.campaignName ?? null,
        channelName: c.name,
        managed: c.managed,
        reactive: leg.reactive === true,
        fromLabel: leg.fromStep?.label ?? null,
        toLabel: leg.toStep.label,
      });
    }
  }
  return out;
}

/** The identity billing and campaign-service share for one campaign of an offer. */
export function campaignKey(featureSlug: string, legKey: string): string {
  return `${featureSlug}:${legKey}`;
}

/** The `?campaigns=` list that makes billing answer a row (set or not) for each campaign. */
export function campaignsQuery(campaigns: readonly OfferCampaign[]): string {
  return campaigns.map((c) => campaignKey(c.featureSlug, c.legKey)).join(",");
}

/** The budget a customer typed, as billing takes it: integer cents; whole dollars for a month. Null when not a valid amount. */
export function parseBudgetText(text: string, period: CampaignPeriod): number | null {
  const t = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (period === "month") return /^\d+$/.test(t) && Number(t) > 0 ? Number(t) * 100 : null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents > 0 ? cents : null;
}

/** What the customer reads for a refusal billing answered (code + details), never its raw message. */
export function budgetRefusalCopy(body: Record<string, unknown> | undefined, usd: (cents: number) => string): string {
  const code = body?.code;
  const per = body?.period === "month" ? "a month" : "a day";
  const cents = (k: string) => (typeof body?.[k] === "number" ? usd(body[k] as number) : null);
  switch (code) {
    case "below_minimum":
      return cents("minimumCents") ? `This campaign needs at least ${cents("minimumCents")} ${per}.` : "This budget is below its minimum.";
    case "reactive_above_cap":
      return cents("capCents") ? `At most ${cents("capCents")}, half of your first-step budgets.` : "At most half of your first-step budgets.";
    case "entry_item_required":
      return "Set a first-step budget first.";
    case "amount_not_whole_dollars":
      return "Use whole dollars.";
    case "no_plan_for_offer":
      return "Start a plan for this offer first.";
    case "subscription_not_active":
      return "Your plan is not active. Update your payment method first.";
    case "reactive_charge_declined":
      return "Your card was declined. Update it and try again.";
    case "minimums_unavailable":
    case "campaign_status_unavailable":
    case "charge_unavailable":
      return "We could not save this right now. Try again in a minute.";
    default:
      return "Could not save this budget. Try again.";
  }
}
