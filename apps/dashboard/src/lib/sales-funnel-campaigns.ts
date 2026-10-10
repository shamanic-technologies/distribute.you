/**
 * SALES FUNNEL CAMPAIGNS (owner 2026-10-10): a campaign is brand x offer x sales funnel, run or paused
 * as one; its UNITS are its pipes (one per leg x channel, each a campaign-service campaign with its own
 * workflow). campaign-service serves them (`/sales-funnel-campaigns`), billing-service serves each
 * funnel's caps (`/brands/:b/offers/:o/sales-funnels/:id/caps`), both through the gateway.
 *
 * Shapes only, as served; nothing is computed here. Alias-free so it carries real unit tests.
 */
import { z } from "zod";

export const SalesFunnelUnitSchema = z
  .object({
    campaignId: z.string(),
    pipeId: z.string(),
    featureSlug: z.string(),
    legKey: z.string(),
    status: z.string(),
    workflowSlug: z.string().nullable(),
    name: z.string(),
  })
  .passthrough();
export type SalesFunnelUnit = z.infer<typeof SalesFunnelUnitSchema>;

export const SalesFunnelCampaignSchema = z
  .object({
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
  })
  .passthrough();
export type SalesFunnelCampaign = z.infer<typeof SalesFunnelCampaignSchema>;

export const SalesFunnelCampaignListSchema = z.object({ salesFunnelCampaigns: z.array(SalesFunnelCampaignSchema) }).passthrough();
export const SalesFunnelCampaignOneSchema = z.object({ salesFunnelCampaign: SalesFunnelCampaignSchema }).passthrough();

const CapWindow = {
  period: z.string(),
  periodStart: z.string(),
  periodEnd: z.string().nullable(),
  reached: z.boolean().nullable(),
  consumedUnavailableReason: z.string().nullable(),
  consumedUnavailableDetail: z.string().nullable(),
};

export const SalesFunnelCapsSchema = z
  .object({
    salesFunnelId: z.string(),
    stated: z.boolean(),
    updatedAt: z.string().nullable(),
    maxBudget: z
      .object({ amountCents: z.string(), consumedCents: z.string().nullable(), remainingCents: z.string().nullable(), ...CapWindow })
      .passthrough()
      .nullable(),
    maxVolume: z
      .object({ count: z.number(), unit: z.string(), consumed: z.number().nullable(), remaining: z.number().nullable(), ...CapWindow })
      .passthrough()
      .nullable(),
  })
  .passthrough();
export type SalesFunnelCaps = z.infer<typeof SalesFunnelCapsSchema>;

/** A served cents string ("12500" or "12500.5") as dollars, for display only. Null for a non-number (logged). */
export function centsToUsd(cents: string | null | undefined): number | null {
  if (cents == null) return null;
  const n = Number(cents);
  if (!Number.isFinite(n)) {
    console.error("[sales-funnel-campaigns] unreadable cents", { cents });
    return null;
  }
  return n / 100;
}

/** The producer's word for a status or reason, capitalised (never renamed). */
export function producerWord(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

/** A funnel campaign is ONGOING while campaign-service says so (`ongoing`). */
export function isOngoingFunnelCampaign(c: Pick<SalesFunnelCampaign, "status">): boolean {
  return c.status === "ongoing";
}
