// What a campaign is CALLED, on every surface that names one.
//
// campaign-service stores a `name` on the row, written when the campaign was
// provisioned. It is stale by construction: it predates the per-funnel model, so
// it says nothing about the funnel the campaign runs nor the channel it runs on
// — the two facts that actually distinguish one campaign from another under the
// same brand. A title is therefore COMPOSED from those two, in the words brand
// Settings already uses: the funnel it buys, then the channel it buys through.
//
// One helper, used by the Overview heading, the top-bar context and the table's
// two columns, so a campaign cannot read as one thing on the page you opened and
// another in the row you clicked.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias). The `@/lib/api` import
// is type-only and erases at compile time.

import {
  acquisitionChannelForFeatureSlug,
  type AcquisitionChannelDef,
} from "./acquisition-channels";
import { campaignFunnel, type CampaignFunnelRow } from "./campaign-funnel";
import type { SalesFunnelDef } from "./sales-funnels";

/** The fields a title reads off a campaign row. */
export interface CampaignTitleRow extends CampaignFunnelRow {
  /** campaign-service's stored name. Read ONLY when neither half resolves. */
  name: string;
  /**
   * The channel the campaign runs on. A channel IS a feature slug, and the
   * campaign states its own, so this is read — never inferred from the workflow.
   */
  featureSlug: string | null;
}

/**
 * A feature slug we carry no channel for, prettified.
 *
 * Named as the slug spells itself rather than as a channel we do not carry: an
 * invented channel name is worse than the raw one, because the catalogue is what
 * every other surface reads.
 */
export function channelSlugLabel(featureSlug: string | null): string {
  if (!featureSlug) return "—";
  return featureSlug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export interface CampaignTitleParts {
  /** The funnel's catalogue entry, or null when nothing in it ends on the goal. */
  funnel: SalesFunnelDef | null;
  /** The channel's catalogue entry, or null for a slug the catalogue misses. */
  channel: AcquisitionChannelDef | null;
  /** What the funnel half reads. Null when there is nothing honest to say. */
  funnelLabel: string | null;
  /** What the channel half reads. Null when the campaign states no channel. */
  channelLabel: string | null;
  /**
   * The whole title, one string.
   *
   * `<funnel> · <channel>` when both halves resolve, one half when only one
   * does, and campaign-service's stored name when NEITHER does — a campaign we
   * can say nothing composed about keeps whatever name it was given rather than
   * rendering an em-dash where its identity should be.
   */
  label: string;
}

/**
 * The funnel × channel a campaign runs, resolved for display.
 *
 * The funnel half reads the campaign's OWN funnel key and NOTHING else. There is
 * deliberately no fallback to the goal: the goal is the retired, lossier
 * vocabulary — two funnels answer to `meetingBooked` — so steps derived from
 * it is one the campaign never stated. campaign-service persists the funnel on
 * every campaign, so a campaign that states none leaves the half unstated rather
 * than guessed.
 */
export function campaignTitleParts(
  campaign: CampaignTitleRow,
  channels: AcquisitionChannelDef[],
): CampaignTitleParts {
  const funnel = campaignFunnel(campaign.funnelKey);
  const channel = acquisitionChannelForFeatureSlug(campaign.featureSlug, channels);

  const funnelLabel = funnel ? funnel.name : null;
  const channelLabel = campaign.featureSlug
    ? (channel?.name ?? channelSlugLabel(campaign.featureSlug))
    : null;

  const halves = [funnelLabel, channelLabel].filter((h): h is string => h !== null);
  return {
    funnel,
    channel,
    funnelLabel,
    channelLabel,
    label: halves.length > 0 ? halves.join(" · ") : campaign.name,
  };
}
