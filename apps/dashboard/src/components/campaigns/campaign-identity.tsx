"use client";

import type { SalesFunnelDef } from "@/lib/sales-funnels";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";

/**
 * WHICH campaign this is, stated once, in the one vocabulary the whole dashboard
 * uses for it.
 *
 * A campaign IS (offer x funnel x channel), so naming one half without the other
 * names half of it. The funnel LEADS because it is what the campaign is buying;
 * the channel is where it goes to buy it, so it reads quieter and prefixed
 * "Via". Every surface that identifies a campaign — the Campaigns table, the
 * budget modal at all three grains, the top bar — renders one of the two layouts
 * below, so a campaign cannot read one way on a page and another way in the
 * modal that changes its budget.
 *
 * ONE narrowing, several windows: the marks come from the shared components the
 * brand Settings cards render, and the words come from the same two catalogues.
 * A second copy of either is how two surfaces come to disagree about what a
 * funnel is called or what a channel looks like.
 *
 * A half we cannot source keeps its words and drops its tile — a mark we would
 * have to invent is worse than none. An unresolvable funnel reads `—`, which is
 * a real gap and says so; an unresolvable channel falls back to its prettified
 * slug, which is still the channel's own name rather than a guess.
 */

/** What the two layouts are handed. The funnel arrives already resolved because
 *  its callers hold it in different shapes (a campaign's wire key on one side, a
 *  billing scope's own def on the other) and resolving it twice is how they would
 *  drift. */
export interface CampaignIdentityParts {
  funnel: SalesFunnelDef | null;
  featureSlug: string | null;
}

/**
 * The channel half, resolved against the catalogue the environment publishes.
 *
 * A HOOK rather than a plain function because the catalogue is now read off the
 * features the app already fetches, and because one caller used to resolve it
 * conditionally: a hook cannot be, so it takes a null slug and answers null
 * rather than being called behind a ternary.
 *
 * A slug the catalogue misses keeps its own words through `channelSlugLabel`,
 * which is the channel's name in every case that matters and is never a guess at
 * a DIFFERENT channel's name.
 */
function useChannelParts(featureSlug: string | null) {
  const channels = useAcquisitionChannels();
  if (!featureSlug) return null;
  const def = acquisitionChannelForFeatureSlug(featureSlug, channels);
  return { def, label: def ? def.name : channelSlugLabel(featureSlug) };
}

/**
 * The STACKED layout: the funnel on its own line, the channel under it.
 *
 * The text block is pinned to the funnel mark's height (`h-8` = the `sm` mark's
 * 32px) by giving its two lines leadings that add to exactly that (14 + 18), so
 * a row is the height of its icon rather than of whatever the two lines happen
 * to need. The 18 is the `xs` channel mark's own height, which is why the second
 * line carries it.
 *
 * Used wherever a campaign occupies a row of its own: the Campaigns table's
 * first column, and each row of the budget modal.
 */
export function CampaignIdentity({ funnel, featureSlug }: CampaignIdentityParts) {
  const channel = useChannelParts(featureSlug);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {funnel && <SalesFunnelMark def={funnel} size="sm" />}
      <div className="flex h-8 min-w-0 flex-col justify-center">
        <span className="truncate leading-[14px] text-gray-800">
          {funnel ? funnel.name : "—"}
        </span>
        <span className="flex h-[18px] min-w-0 items-center gap-1 text-xs leading-[18px] text-gray-500">
          <span className="shrink-0">Via</span>
          {channel?.def && <AcquisitionChannelMark def={channel.def} size="xs" />}
          <span className="truncate">{channel ? channel.label : "\u2014"}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The INLINE layout: the same two halves, same order, same "Via", on ONE line.
 *
 * The top bar is a single row of crumbs, so a two-line campaign there would set
 * the bar's height off the tallest crumb and leave every other crumb floating in
 * it. The vocabulary is what carries across, not the stacking: the funnel leads
 * at the crumb's own weight, the channel follows quieter behind "Via", and both
 * marks are `xs` (18px) — byte the offer tile beside them, so the crumbs line up
 * by construction rather than by two hand-tuned numbers.
 *
 * There is deliberately no middle dot between the halves any more. A separator
 * makes two peers of them, and they are not peers: one is what the campaign buys
 * and the other is where it buys it.
 */
export function CampaignIdentityInline({
  funnel,
  featureSlug,
  fallbackLabel,
}: CampaignIdentityParts & {
  /** What to read when NEITHER half resolves — campaign-service's stored name.
   *  A campaign we can say nothing composed about keeps the name it was given
   *  rather than rendering an em-dash where its identity should be. */
  fallbackLabel: string;
}) {
  const channel = useChannelParts(featureSlug);
  if (!funnel && !channel) return <span className="truncate">{fallbackLabel}</span>;

  return (
    <>
      {funnel && (
        <span className="flex min-w-0 items-center gap-1.5">
          <SalesFunnelMark def={funnel} size="xs" />
          <span className="truncate">{funnel.name}</span>
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
