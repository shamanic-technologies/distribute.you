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

import { acquisitionChannelForFeatureSlug } from "./acquisition-channels";
import { offerScopedCents, type FunnelOfferBudgetRow } from "./funnel-channels";
import {
  SALES_FUNNELS,
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
export function campaignBudgetScope(campaign: CampaignBudgetRow): CampaignBudgetScope | null {
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
  const channel = acquisitionChannelForFeatureSlug(campaign.featureSlug);
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
): number | null {
  if (!budgets) return null;
  const scope = campaignBudgetScope(campaign);
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
