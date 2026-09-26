// What a campaign is CALLED, on every surface that names one.
//
// campaign-service stores a `name` on the row, written when the campaign was
// provisioned, and it says nothing reliable about the two facts that distinguish one
// campaign from another under the same offer: the LEG it buys and the CHANNEL it buys
// through. A title is therefore COMPOSED from those two.
//
// Only relative value imports live here, so this module stays directly unit-testable.

import {
  acquisitionChannelForFeatureSlug,
  type AcquisitionChannelDef,
} from "./acquisition-channels";
import { legFor, type LegCatalogue, type LegDef } from "./legs";

/** The fields a title reads off a campaign row. */
export interface CampaignTitleRow {
  id: string;
  /** campaign-service's stored name. Read ONLY when neither half resolves. */
  name: string;
  /** The channel the campaign runs on. A channel IS a feature slug. */
  featureSlug: string | null;
  /** The leg the campaign states it is bought for. Opaque; looked up, never parsed. */
  legKey?: string | null;
}

/**
 * A feature slug we carry no channel for, prettified. Named as the slug spells itself
 * rather than as a channel we do not carry.
 */
export function channelSlugLabel(featureSlug: string | null): string {
  if (!featureSlug) return "—";
  return featureSlug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export interface CampaignTitleParts {
  leg: LegDef | null;
  channel: AcquisitionChannelDef | null;
  legLabel: string | null;
  channelLabel: string | null;
  /** `<leg> · <channel>`, one half when only one resolves, else the stored name. */
  label: string;
}

/** The leg x channel a campaign runs, resolved for display. */
export function campaignTitleParts(
  campaign: CampaignTitleRow,
  channels: AcquisitionChannelDef[],
  catalogue: LegCatalogue,
): CampaignTitleParts {
  const leg = legFor(catalogue, campaign.legKey);
  const channel = acquisitionChannelForFeatureSlug(campaign.featureSlug, channels);
  const legLabel = leg ? leg.label : null;
  const channelLabel = campaign.featureSlug
    ? (channel?.name ?? channelSlugLabel(campaign.featureSlug))
    : null;
  const halves = [legLabel, channelLabel].filter((h): h is string => h !== null);
  return {
    leg,
    channel,
    legLabel,
    channelLabel,
    label: halves.length > 0 ? halves.join(" · ") : campaign.name,
  };
}
