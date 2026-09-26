// ONE campaign's own daily ceiling, resolved out of billing's answer.
//
// A campaign IS (offer x leg x acquisition channel), and billing keys a ceiling on
// exactly that address (`GET /brands/:id/campaign-budgets`), so a campaign really does
// have money of its own. This module only ever PICKS a row out of that answer; the one
// thing it adds up is a channel's total across the brand, which is the grain billing
// judges the channel's floor on and which this app needs only to check a form before
// billing does.
//
// It lives in one place because several surfaces read it — the Campaigns table states
// it per row, the campaign Overview states it in its header, Campaign Settings and Offer
// Settings edit it — and several copies of the lookup is how they would start
// disagreeing about the same campaign's money.
//
// Only relative value imports live here, so this module stays directly unit-testable
// (vitest does not resolve the "@" alias).

import {
  acquisitionChannelForFeatureSlug,
  type AcquisitionChannelDef,
} from "./acquisition-channels";

/** The fields this module reads off a campaign-service campaign. */
export interface CampaignBudgetRow {
  featureSlug: string | null;
  legKey?: string | null;
  offerId?: string | null;
}

/** One ceiling as billing serves it. */
export interface CampaignCeiling {
  offerId: string | null;
  legKey: string | null;
  featureSlug: string;
  dailyBudgetCents: number;
}

/** The fields this module reads off billing's campaign-budgets answer. */
export interface CampaignBudgetSet {
  campaigns: readonly CampaignCeiling[];
}

/** What a campaign's budget row is, once its address resolves. */
export interface CampaignBudgetScope {
  offerId: string | null;
  legKey: string;
  featureSlug: string;
  channelName: string;
}

/**
 * The (offer, leg, channel) a campaign's money is keyed on, or null.
 *
 * A campaign that names no leg or no channel has no ceiling to point at, and guessing
 * one would offer to spend money against a row billing would refuse, so the callers
 * say so instead.
 */
export function campaignBudgetScope(
  campaign: CampaignBudgetRow,
  channels: AcquisitionChannelDef[],
): CampaignBudgetScope | null {
  if (!campaign.legKey || !campaign.featureSlug) return null;
  const channel = acquisitionChannelForFeatureSlug(campaign.featureSlug, channels);
  return {
    offerId: campaign.offerId ?? null,
    legKey: campaign.legKey,
    featureSlug: campaign.featureSlug,
    channelName: channel?.name ?? campaign.featureSlug,
  };
}

/**
 * The ceiling billing stores at this address, or undefined.
 *
 * A ceiling stated before billing carried the offer names none; for a brand selling one
 * offer that row IS this campaign's money, so it answers when no row names the offer.
 */
function findCeiling(
  scope: { offerId: string | null; legKey: string; featureSlug: string },
  budgets: CampaignBudgetSet,
): CampaignCeiling | undefined {
  const sameAddress = (c: CampaignCeiling) =>
    c.legKey === scope.legKey && c.featureSlug === scope.featureSlug;
  return (
    budgets.campaigns.find((c) => sameAddress(c) && c.offerId === scope.offerId) ??
    budgets.campaigns.find((c) => sameAddress(c) && c.offerId === null)
  );
}

/** This campaign's own stored ceiling, in cents. Zero = funded at nothing. */
export function campaignSavedCents(
  scope: { offerId: string | null; legKey: string; featureSlug: string },
  budgets: CampaignBudgetSet | undefined,
): number {
  if (!budgets) return 0;
  return findCeiling(scope, budgets)?.dailyBudgetCents ?? 0;
}

/**
 * A campaign's ceiling as a reader sees it, or null when we have no answer.
 *
 * Null is "billing has not answered" or "this campaign names no leg", which every
 * caller renders as a dash — a different statement from a funded-at-zero campaign,
 * which really does say `$0` because zero is how a customer stops one.
 */
export function campaignBudgetCents(
  campaign: CampaignBudgetRow,
  budgets: CampaignBudgetSet | undefined,
  channels: AcquisitionChannelDef[],
): number | null {
  if (!budgets) return null;
  const scope = campaignBudgetScope(campaign, channels);
  if (!scope) return null;
  return campaignSavedCents(scope, budgets);
}

/**
 * A channel's TOTAL ceiling across the brand, in cents — the grain billing judges the
 * channel's published floor on. Checked against before a write, never displayed.
 */
export function channelTotalCents(
  featureSlug: string,
  budgets: CampaignBudgetSet | undefined,
): number {
  if (!budgets) return 0;
  return budgets.campaigns
    .filter((c) => c.featureSlug === featureSlug)
    .reduce((sum, c) => sum + (c.dailyBudgetCents > 0 ? c.dailyBudgetCents : 0), 0);
}

/**
 * A daily budget in WHOLE dollars, always.
 *
 * A ceiling is a configured whole-dollar value, so cents read wrong on one — the
 * repo-wide carve-out from the adaptive currency format. This is the one formatter for
 * it, so a row in the table and the campaign's own header cannot print the same ceiling
 * two ways.
 */
export function fmtDailyBudgetUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/**
 * Whether a campaign is still running once this form's budget lands.
 *
 * A campaign funded at NOTHING does not send: campaign-service holds it on the funding
 * gate every tick. Its stored STATUS used to stay `ongoing`, so the pill said `Active`
 * on a campaign sending nothing (9 of 21 ongoing campaigns on 2026-09-17). So setting
 * the budget to zero PAUSES, and the same Save that writes the ceiling writes the
 * status — fixed at WRITE time, so every reader of the status is corrected at once.
 *
 * ⚠️ Only the customer's OWN move to zero pauses. A row billing ALREADY stores at zero
 * is left alone, because a form can edit several rows at once and stopping a campaign
 * nobody touched is a write nobody asked for.
 *
 * ⚠️ The inverse does NOT hold: funding a paused campaign does not start it (money
 * starts nothing, campaign-service 2026-09-06). The switch sits beside the field on
 * every surface that edits one, so both travel in one Save.
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
  if (input.nextCents === null) return true;
  if (input.nextCents === 0 && input.savedCents > 0) return false;
  return true;
}
