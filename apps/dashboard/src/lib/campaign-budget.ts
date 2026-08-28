// ONE campaign's own daily ceiling, resolved out of billing's answer.
//
// A campaign IS (offer x sales funnel x acquisition channel), and billing keys a
// ceiling on exactly that triple, so a campaign really does have money of its
// own. What it does NOT have is a figure of its own to compute: billing serves
// three grains (per funnel, per pair, per triple) and this module only ever
// PICKS one of them. Nothing here adds anything up.
//
// It lives in one place because three surfaces read it — the Campaigns table
// states it per row, the campaign Overview states it in its header, and Campaign
// Settings edits it — and three copies of the narrowing is how they would start
// disagreeing about the same campaign's money.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

import {
  acquisitionChannelForFeatureSlug,
  type AcquisitionChannelDef,
} from "./acquisition-channels";
import { offerScopedCents, type FunnelOfferBudgetRow } from "./funnel-channels";
import {
  FUNNEL_MIN_DAILY_BUDGET_USD,
  SALES_FUNNELS,
  isGrandfatheredFunding,
  normalizeSalesFunnelKey,
  type SalesFunnelDef,
  type SalesFunnelKey,
  type SalesFunnelKeyWire,
} from "./sales-funnels";

/** The fields this module reads off a campaign-service campaign. */
export interface CampaignBudgetRow {
  funnelKey: SalesFunnelKeyWire | null;
  featureSlug: string | null;
}

/** The fields this module reads off billing's funnel-budgets answer. */
export interface BrandFunnelBudgetSet {
  funnels: { funnelKey: string; dailyBudgetCents: number }[];
  channels?: { funnelKey: string; featureSlug: string; dailyBudgetCents: number }[];
  offers?: FunnelOfferBudgetRow[];
}

/** What a campaign's budget row is, once its coordinates resolve. */
export interface CampaignBudgetScope {
  def: SalesFunnelDef;
  featureSlug: string;
  channelName: string;
}

/**
 * The (funnel, channel) a campaign's money is keyed on, or null.
 *
 * A campaign that names neither — the pre-funnel campaigns, which predate the
 * model — has no ceiling to point at, and guessing one would offer to spend money
 * against a row billing would refuse. So the callers say so instead.
 */
export function campaignBudgetScope(
  campaign: CampaignBudgetRow,
  channels: AcquisitionChannelDef[],
): CampaignBudgetScope | null {
  if (!campaign.funnelKey || !campaign.featureSlug) return null;
  let key: SalesFunnelKey;
  try {
    key = normalizeSalesFunnelKey(campaign.funnelKey);
  } catch {
    // A funnel spelling shipped upstream that this catalogue does not carry yet.
    // Refusing to name a ceiling beats naming one under the wrong funnel.
    return null;
  }
  const def = SALES_FUNNELS.find((f) => f.key === key);
  if (!def) return null;
  const channel = acquisitionChannelForFeatureSlug(campaign.featureSlug, channels);
  return {
    def,
    featureSlug: campaign.featureSlug,
    channelName: channel?.name ?? campaign.featureSlug,
  };
}

/**
 * This campaign's own stored ceiling, in cents.
 *
 * The pair figure billing serves spans every offer selling that pair, so it is
 * narrowed to one offer by `offerScopedCents` — the single home of that rule.
 * A caller with no offer to name (`undefined`) gets the pair figure, which is
 * what it has always meant for a brand selling one proposition through it.
 */
export function campaignSavedCents(
  scope: CampaignBudgetScope,
  offerId: string | undefined,
  budgets: BrandFunnelBudgetSet | undefined,
): number {
  if (!budgets) return 0;
  const pairCents =
    budgets.channels === undefined
      ? (budgets.funnels.find((f) => f.funnelKey === scope.def.key)?.dailyBudgetCents ?? 0)
      : (budgets.channels.find(
          (c) => c.funnelKey === scope.def.key && c.featureSlug === scope.featureSlug,
        )?.dailyBudgetCents ?? 0);
  return offerScopedCents(
    scope.def.key,
    scope.featureSlug,
    pairCents,
    budgets.offers,
    offerId,
  );
}

/**
 * A campaign's ceiling as a reader sees it, or null when we have no answer.
 *
 * Null is "billing has not answered", which every caller renders as a dash — it
 * is a different statement from a funded-at-zero campaign, which really does say
 * `$0` because zero is how a customer stops one.
 */
export function campaignBudgetCents(
  campaign: CampaignBudgetRow,
  offerId: string | undefined,
  budgets: BrandFunnelBudgetSet | undefined,
  channels: AcquisitionChannelDef[],
): number | null {
  if (!budgets) return null;
  const scope = campaignBudgetScope(campaign, channels);
  if (!scope) return null;
  return campaignSavedCents(scope, offerId, budgets);
}

/**
 * A daily budget in WHOLE dollars, always.
 *
 * A ceiling is a configured whole-dollar value, so cents read wrong on one —
 * the repo-wide carve-out from the adaptive currency format. This is the one
 * formatter for it, so a row in the table and the campaign's own header cannot
 * print the same ceiling two ways.
 */
export function fmtDailyBudgetUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/**
 * What the whole FUNNEL would be funded at once one campaign's typed figure
 * lands, in whole dollars.
 *
 * The product minimum binds the funnel, not one campaign: a customer splitting
 * one funded funnel across two offers or two channels must not be refused for
 * each half being under a bar the whole clears. So the check and the clamp both
 * ask what the funnel TOTAL becomes, never what this campaign holds.
 *
 * Computed ONLY to check the form before it is written. billing serves the funnel
 * total and holds the same rule, and its 400 is what decides; nothing displayed
 * is derived from this.
 */
export function projectedFunnelTotalUsd(
  savedFunnelCents: number,
  savedOwnCents: number,
  typedUsd: number,
): number {
  const siblings = Math.max(0, savedFunnelCents - savedOwnCents);
  return Math.round(siblings / 100) + Math.max(0, typedUsd);
}

/**
 * The smallest FUNDED figure this campaign may hold, in whole dollars — what a
 * typed value under the bar is put back to.
 *
 * Refusing a sub-floor figure and leaving it on screen makes the customer guess
 * what is allowed; naming the floor alone makes them do the subtraction the
 * siblings imply. So the field is restored to this and the surface says why,
 * with pause offered as the reversible way to stop instead.
 *
 * It is derived from the SAME rule `funnelBudgetBelowMinimum` enforces, in the
 * same two branches, so a clamped value can never itself be refused:
 *   - ordinarily the funnel total must reach its floor;
 *   - a funnel billing already funds UNDER its floor is grandfathered, so the
 *     bar is the figure it is funded at today — it may be kept or raised, never
 *     lowered while it stays under the floor.
 * The siblings (what the funnel carries beyond this campaign) are held constant,
 * so a campaign whose funnel already clears the bar without it may be funded at
 * any amount, and the minimum is zero.
 *
 * ZERO is never clamped by the caller: defunding is an ordinary state, and the
 * bar governs what may be NEWLY stated, not whether a customer may stop.
 */
export function minimumCampaignBudgetUsd(
  key: SalesFunnelKey,
  savedFunnelCents: number,
  savedOwnCents: number,
): number {
  const siblingsUsd = Math.round(Math.max(0, savedFunnelCents - savedOwnCents) / 100);
  const barUsd = isGrandfatheredFunding(key, savedFunnelCents)
    ? Math.round(savedFunnelCents / 100)
    : FUNNEL_MIN_DAILY_BUDGET_USD[key];
  return Math.max(0, barUsd - siblingsUsd);
}
