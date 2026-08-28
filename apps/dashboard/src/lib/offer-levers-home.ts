import type { Campaign } from "@/lib/api";

/**
 * Where the offer's Hormozi levers are EDITED.
 *
 * The levers are the words the cold email says, so they are stated where that
 * campaign is set up rather than one level up on Offer Settings, which is about
 * the proposition as a whole. What does NOT move with them is the storage: the 7
 * user-fields are keyed on (brand, offer) in brand-service and there is no
 * per-campaign column, so the cold email campaign's Settings page is a WINDOW
 * onto the offer's own answer, never a second copy of it. Two windows on one
 * value is fine; two narrowings is what makes surfaces disagree.
 *
 * That has one consequence this module exists to hold: an offer with NO cold
 * email campaign would have nowhere left to state its levers at all. An offer is
 * born at signup and a campaign is only provisioned once a funnel is funded, so
 * that gap is the ordinary case for a brand that has not launched yet, not an
 * edge. Offer Settings therefore keeps the editor exactly while no cold email
 * campaign exists, and hands it over the moment one does. One editable card at a
 * time, and never zero.
 */

/**
 * The cold email channels, as a SET rather than a `===` at each call site.
 *
 * One slug today. It is a set because a slug re-version rots every hardcoded
 * comparison scattered across consumers, and because the sibling channels that
 * also write emails from these levers (`sales-crm-email-outreach`,
 * `feedback-request-cold-email-outreach`) are one line from joining it if their
 * Settings pages should host the levers too.
 */
const COLD_EMAIL_CHANNEL_SLUGS: ReadonlySet<string> = new Set(["sales-cold-email-outreach"]);

/** True when this campaign's acquisition channel is the cold email one. */
export function isColdEmailChannel(featureSlug: string | null | undefined): boolean {
  return featureSlug != null && COLD_EMAIL_CHANNEL_SLUGS.has(featureSlug);
}

/**
 * The offer's cold email campaign, or null when it has none.
 *
 * campaign-service mints a fresh row every time a campaign's workflow changes and
 * keeps only the newest running, so one campaign as the customer knows it is many
 * stored rows. This picks the ONE a reader should be sent to: a live row wins
 * outright, and between two dead ones the latest, which is byte-equal to the rule
 * the Campaigns table collapses its own identities with. Latest by `updatedAt`
 * compared as the ISO-8601 UTC strings the wire carries, so nothing is parsed.
 *
 * A campaign carrying no offer belongs to none and is left out rather than folded
 * into whichever offer the reader happens to be looking at.
 */
export function coldEmailCampaignForOffer(
  campaigns: readonly Campaign[],
  offerId: string,
): Campaign | null {
  let held: Campaign | null = null;
  for (const campaign of campaigns) {
    if (campaign.offerId !== offerId) continue;
    if (!isColdEmailChannel(campaign.featureSlug)) continue;
    if (!held) {
      held = campaign;
      continue;
    }
    if (isRunning(held)) continue;
    if (isRunning(campaign) || campaign.updatedAt > held.updatedAt) held = campaign;
  }
  return held;
}

/**
 * Running, in campaign-service's own free-text `status` column.
 *
 * Deliberately a local copy of the words `isActiveStatus` holds rather than an
 * import: that helper lives in the Campaigns table, which imports through the `@`
 * alias, and this module stays alias-free at runtime so it can carry real unit
 * tests. The set is the same and a guard pins the two together.
 */
const RUNNING_STATUSES = new Set(["active", "running", "ongoing", "live"]);
function isRunning(campaign: Campaign): boolean {
  return RUNNING_STATUSES.has(campaign.status.toLowerCase());
}
