"use client";

import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { legFor, type LegDef } from "@/lib/legs";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { LegMark } from "@/components/marks/leg-mark";

/**
 * WHICH campaign this is, stated once, in the one vocabulary the whole dashboard uses.
 *
 * A campaign IS (offer x leg x channel). The LEG leads because it is what the campaign
 * buys; the channel is where it goes to buy it, so it reads quieter behind "Via". Every
 * surface that identifies a campaign (the Campaigns table, the budget modal, the lead
 * panel, the top bar) renders one of the two layouts below, so a campaign cannot read
 * one way on a page and another way in the modal that changes its budget.
 *
 * The leg is the one the campaign STATES (`legKey`), looked up in the platform catalogue
 * rather than parsed. A leg the catalogue does not carry (still loading, or unknown) reads
 * `—` with no tile: a mark or a name we would have to invent is worse than none. A channel
 * the catalogue misses keeps its own prettified slug, which is still its name.
 */

export interface CampaignIdentityParts {
  featureSlug: string | null;
  /** The leg the campaign states, as campaign-service carries it. */
  legKey?: string | null;
  /** A leg the surface already resolved, which wins over `legKey`. */
  leg?: LegDef | null;
}

/** The channel half, resolved against the catalogue the environment publishes. */
function useChannelParts(featureSlug: string | null) {
  const channels = useAcquisitionChannels();
  if (!featureSlug) return null;
  const def = acquisitionChannelForFeatureSlug(featureSlug, channels);
  return { def, label: def ? def.name : channelSlugLabel(featureSlug) };
}

function useLegPart(legKey: string | null | undefined, leg: LegDef | null | undefined): LegDef | null {
  const catalogue = useLegCatalogue();
  return leg ?? legFor(catalogue, legKey);
}

/**
 * The STACKED layout: the leg on its own line, the channel under it. The text block is
 * pinned to the leg mark's height (32px = 14 + 18 leadings), so a row is the height of
 * its icon; the 18 is the `xs` channel mark's own height.
 */
export function CampaignIdentity({ featureSlug, legKey, leg: legOverride }: CampaignIdentityParts) {
  const channel = useChannelParts(featureSlug);
  const leg = useLegPart(legKey, legOverride);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {leg && <LegMark fromKey={leg.fromKey} toKey={leg.toKey} size="sm" />}
      <div className="flex h-8 min-w-0 flex-col justify-center">
        <span className="truncate leading-[14px] text-gray-800" title={leg?.label}>
          {leg?.label ?? "—"}
        </span>
        <span className="flex h-[18px] min-w-0 items-center gap-1 text-xs leading-[18px] text-gray-500">
          {channel ? (
            <>
              <span className="shrink-0">Via</span>
              {channel.def && <AcquisitionChannelMark def={channel.def} size="xs" />}
              <span className="truncate">{channel.label}</span>
            </>
          ) : (
            <span className="truncate">{"—"}</span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * The INLINE layout: the same two halves, same order, same "Via", on ONE line, for the
 * top bar. Both marks are `xs` (18px), byte the offer tile beside them, so the crumbs
 * line up by construction. No separator between the halves: they are not peers.
 */
export function CampaignIdentityInline({
  featureSlug,
  legKey,
  leg: legOverride,
  fallbackLabel,
}: CampaignIdentityParts & {
  /** What to read when NEITHER half resolves — campaign-service's stored name. */
  fallbackLabel: string;
}) {
  const channel = useChannelParts(featureSlug);
  const leg = useLegPart(legKey, legOverride);
  if (!leg && !channel) return <span className="truncate">{fallbackLabel}</span>;

  return (
    <>
      {leg && (
        <span className="flex min-w-0 items-center gap-1.5" title={leg.label}>
          <LegMark fromKey={leg.fromKey} toKey={leg.toKey} size="xs" />
          <span className="truncate">{leg.label}</span>
        </span>
      )}
      {channel && (
        <span className="flex min-w-0 items-center gap-1 text-xs font-normal text-gray-500">
          <span className="shrink-0">Via</span>
          {channel.def && <AcquisitionChannelMark def={channel.def} size="xs" />}
          <span className="truncate">{channel.label}</span>
        </span>
      )}
    </>
  );
}
