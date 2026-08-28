"use client";

import type { SalesFunnelDef } from "@/lib/sales-funnels";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { campaignLegFor, campaignLegLabel, type CampaignLeg } from "@/lib/campaign-leg";
import { funnelLegMarkFor } from "@/lib/funnel-leg-marks";
import { funnelLegOperator, funnelLegOperatorLabel } from "@/lib/funnel-leg-operator";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";
import { BrandLogo } from "@/components/brand-logo";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { FunnelLegMark } from "@/components/marks/funnel-leg-mark";

/**
 * WHICH campaign this is, stated once, in the one vocabulary the whole dashboard
 * uses for it.
 *
 * A campaign IS (offer x funnel x channel), so naming one half without the other
 * names half of it. The LEG leads because it is what the campaign actually buys;
 * the channel is where it goes to buy it, so it reads quieter and prefixed
 * "Via". Every surface that identifies a campaign — the Campaigns table, the
 * budget modal at all three grains, the top bar — renders one of the two layouts
 * below, so a campaign cannot read one way on a page and another way in the
 * modal that changes its budget.
 *
 * The leg rather than the FUNNEL, because a funnel is sold leg by leg and naming a
 * campaign after the whole funnel overstates almost all of them: a channel that only
 * takes a lead from the attended meeting to the paid client was reading as "Sales
 * Meeting from Conversation", which is the name of the funnel it closes the last
 * arrow of. `campaignLegLabel` states the arrow when the channel declares one for
 * this funnel and falls back to the funnel's own name when it declares none — the
 * sentence this surface read before legs existed, so nothing is ever blank.
 *
 * Consequence worth knowing at BRAND grain, where the table lists campaigns across
 * several funnels: two campaigns buying the same step of different funnels read the
 * same words. The funnel MARK still tells them apart, and the funnel's own name is
 * on the title attribute.
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
  /**
   * The leg this row is ABOUT, when the surface already knows it.
   *
   * The funnel page walks every arrow of its funnel — including the ones no campaign of
   * ours performs, which the brand works itself — so those rows have a leg and no
   * channel to resolve one from. Omitted, the leg is resolved from the channel exactly
   * as before.
   */
  leg?: CampaignLeg | null;
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
export function CampaignIdentity({
  funnel,
  featureSlug,
  leg: legOverride,
  statesOperator = false,
}: CampaignIdentityParts & {
  /**
   * This surface walks a funnel ARROW by arrow, so a row with no channel is an arrow
   * nobody sells us rather than a campaign whose channel failed to resolve. It then
   * states WHO works it, in the same `Via <mark> <name>` shape a channel uses.
   *
   * Off by default: everywhere else an absent channel really is a gap, and claiming a
   * team for it would name one of two parties at random.
   */
  statesOperator?: boolean;
}) {
  const channel = useChannelParts(featureSlug);
  const leg = legOverride ?? campaignLegFor(funnel, channel?.def?.legs);
  // The LEG's tile, not the funnel's: the line beside it names an arrow, so a funnel
  // tile would mark one thing above words about another. A leg this app has not drawn
  // falls back to the funnel's own mark rather than to nothing.
  const legMarked = leg != null && funnelLegMarkFor(leg.fromKey, leg.toKey) != null;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {legMarked && leg ? (
        <FunnelLegMark fromKey={leg.fromKey} toKey={leg.toKey} size="sm" />
      ) : (
        funnel && <SalesFunnelMark def={funnel} size="sm" />
      )}
      <div className="flex h-8 min-w-0 flex-col justify-center">
        {/* The title carries BOTH: the leg reads truncated on a narrow column, and the
            funnel is what tells two same-named legs of different funnels apart at brand
            grain. */}
        <span
          className="truncate leading-[14px] text-gray-800"
          title={leg && funnel ? `${leg.label} (${funnel.name})` : funnel?.name}
        >
          {leg?.label ?? funnel?.name ?? "—"}
        </span>
        <span className="flex h-[18px] min-w-0 items-center gap-1 text-xs leading-[18px] text-gray-500">
          {channel ? (
            <>
              <span className="shrink-0">Via</span>
              {channel.def && <AcquisitionChannelMark def={channel.def} size="xs" />}
              <span className="truncate">{channel.label}</span>
            </>
          ) : statesOperator && leg ? (
            <OperatorVia fromKey={leg.fromKey} toKey={leg.toKey} />
          ) : (
            <span className="truncate">{"\u2014"}</span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * WHO works an arrow no campaign performs, drawn exactly like the channel it stands in
 * for: `Via <mark> <name> team`.
 *
 * It replaced `Done by you`, which was one sentence for two different parties and was
 * wrong on the arrows we do ourselves — a customer read it as "nobody is answering the
 * replies I just paid for". `funnelLegOperator` owns the split; this only draws it.
 *
 * The brand half reads the OPEN brand off the tenant switcher rather than taking a
 * prop: every surface that renders this is already inside that brand, the hook is the
 * one home for its name and logo, and its reads are the keys the chrome already polls,
 * so naming the team costs no request. A name still resolving states `Your team`, never
 * a blank — see `funnelLegOperatorLabel`.
 */
function OperatorVia({ fromKey, toKey }: { fromKey: string | null; toKey: string }) {
  const { displayBrand } = useTenantSwitcher();
  const operator = funnelLegOperator(fromKey, toKey);
  const label = funnelLegOperatorLabel(operator, displayBrand?.name);
  return (
    <>
      <span className="shrink-0">Via</span>
      {operator === "platform" ? (
        /* Our own mark, from the same file the tab favicon serves. */
        <img
          src="/logo-distribute.svg"
          alt=""
          width={14}
          height={14}
          className="h-[14px] w-[14px] shrink-0"
        />
      ) : (
        <BrandLogo
          domain={displayBrand?.domain ?? null}
          size={14}
          className="h-[14px] w-[14px] shrink-0 rounded"
          fallbackClassName="h-[14px] w-[14px] shrink-0 text-gray-400"
        />
      )}
      <span className="truncate">{label}</span>
    </>
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
 *
 * The tile is the LEG's, exactly as in the stacked layout: the words beside it name
 * an ARROW, so a funnel tile would mark one thing above words about another, and the
 * same campaign would wear two different marks in the bar and in the table. A leg this
 * app has not drawn falls back to the funnel's own mark rather than to nothing.
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
  const leg = campaignLegFor(funnel, channel?.def?.legs);
  const legLabel = campaignLegLabel(funnel, channel?.def?.legs);
  const legMarked = leg != null && funnelLegMarkFor(leg.fromKey, leg.toKey) != null;
  if (!funnel && !channel) return <span className="truncate">{fallbackLabel}</span>;

  return (
    <>
      {funnel && legLabel && (
        <span className="flex min-w-0 items-center gap-1.5" title={funnel.name}>
          {legMarked && leg ? (
            <FunnelLegMark fromKey={leg.fromKey} toKey={leg.toKey} size="xs" />
          ) : (
            <SalesFunnelMark def={funnel} size="xs" />
          )}
          <span className="truncate">{legLabel}</span>
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
