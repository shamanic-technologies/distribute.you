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
  return offerScopedCents(
    scope.def.key,
    scope.featureSlug,
    campaignPairCents(scope, budgets),
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
 * The (funnel, channel) PAIR this campaign's ceiling belongs to, in cents,
 * across EVERY offer funding it.
 *
 * The grain the product minimum binds — see `channel-minimums.ts`. It is what a
 * form is CHECKED against, while `campaignSavedCents` above is what the form
 * EDITS: two offers selling one funnel on one channel are two campaigns funded
 * separately, and the pair figure is their sum.
 */
export function campaignPairCents(
  scope: CampaignBudgetScope,
  budgets: BrandFunnelBudgetSet | undefined,
): number {
  if (!budgets) return 0;
  if (budgets.channels === undefined) {
    return budgets.funnels.find((f) => f.funnelKey === scope.def.key)?.dailyBudgetCents ?? 0;
  }
  return (
    budgets.channels.find(
      (c) => c.funnelKey === scope.def.key && c.featureSlug === scope.featureSlug,
    )?.dailyBudgetCents ?? 0
  );
}

/**
 * Whether a campaign is still running once this form's budget lands.
 *
 * A campaign funded at NOTHING does not send. campaign-service says so itself —
 * `fundingFromBudgets` is the platform's one definition of "is this campaign
 * funded", and a ceiling of zero fails it, so the scheduler holds the campaign on
 * the funding gate every tick and never hands it a turn. Its stored STATUS,
 * meanwhile, stayed `ongoing`, so the pill said `Active` and every surface that
 * reads that word inherited the claim. Measured in production on 2026-09-17: 9 of
 * 21 ongoing campaigns were funded at zero (or had no ceiling at all) and all 9
 * read `Active` to their customer.
 *
 * So setting the budget to zero PAUSES, and the same Save that writes the ceiling
 * writes the status. Fixing it at WRITE time rather than deriving it at read time
 * is deliberate: the status is what the pill, the scope rollups, the Leads tabs,
 * the staff console and features-service all read, so one honest write corrects
 * every reader at once — where a derivation would have to be threaded through
 * eight surfaces and would still leave the staff console and a direct API write
 * saying `Active`.
 *
 * ⚠️ Only the customer's OWN move to zero pauses. A row billing ALREADY stores at
 * zero is left alone (`savedCents === 0` → unchanged), because the modal edits
 * several rows at once and stopping a campaign nobody touched is a write nobody
 * asked for.
 *
 * ⚠️ The inverse does NOT hold: funding a paused campaign does not start it.
 * campaign-service deleted provisioning-from-a-funded-ceiling on 2026-09-06
 * ("money starts nothing") because reading money as an intent to run had
 * resurrected campaigns customers had deliberately stopped. The switch sits
 * beside the field on every surface that edits one, so both travel in one Save.
 */
export function runningAfterBudget(input: {
  /** What the form's switch holds right now. */
  running: boolean;
  /** The ceiling this form would write, in cents. Null = not a whole number of dollars. */
  nextCents: number | null;
  /** What billing stores for this campaign today, in cents. */
  savedCents: number;
}): boolean {
  if (!input.running) return false;
  // Unparseable: every form blocks its own Save on this, so it states no opinion
  // rather than pausing a campaign on a half-typed figure.
  if (input.nextCents === null) return true;
  if (input.nextCents === 0 && input.savedCents > 0) return false;
  return true;
}
