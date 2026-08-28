"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchFeatureStats,
  getCampaign,
  getFeatureRevenue,
  getOfferRevenue,
  getBrandRevenue,
  keepLastGoodFeatureRevenue,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { salesInterestSharePct } from "@/lib/funnel-share";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { isRunningStatus } from "@/lib/campaign-controls";
import type { RevenueOverview } from "@/lib/revenue-view";

/**
 * Self-contained outreach stat-card row for every brand- and campaign-scoped
 * content page (leads, emails, journalists, outlets, articles, quote-pitches,
 * visibility-runs, …). Reads its scope from the route params — `id` present →
 * campaign-scoped stats, else brand-scoped — and fetches its own featureStats,
 * cost, and sales-economics goal. All three queries reuse the same keys the
 * Overview/Campaigns pages use, so React Query dedupes to a single poll per
 * scope (no extra network cost on a page that already shows them).
 *
 * The dedicated Overview, Campaigns-list, and Campaign-detail surfaces wire
 * `OutreachStatCards` directly (they already hold the stats); this wrapper is for
 * the entity pages that otherwise carry no stats.
 */
export function OutreachStatCardsAuto({
  outreachOverride,
  contactedOverride,
  outreachLabel,
}: {
  /**
   * When set, the Outreach count comes from this value instead of the legacy
   * `/stats` `leadsContacted` aggregate. The leads page passes its contacted-lead
   * count (from the SAME `listBrandLeads` snapshot the table + tabs render) so the
   * box and the Outreach tab move together — mirrors the brand Overview's
   * `outreachContacted` single source (features-service #371/#372).
   */
  outreachOverride?: number | null;
  /**
   * DISTINCT leads contacted, when the caller holds its own count of them.
   *
   * The Leads page does: its tabs bucket the SAME `listBrandLeads` snapshot the table
   * renders, so its contacted count and the card have to be one number. Supplying it
   * turns the row into TWO outreach cards — people, then actions — and the actions
   * count is then read here off `/revenue` rather than taken from the caller, because
   * a page counting people has no second count to give.
   */
  contactedOverride?: number | null;
  /**
   * What that first card is CALLED. Passed through untouched — a caller supplying its
   * own count says in the same breath what the count is OF (the Leads page counts
   * people, the Overview counts email sequences). Absent → "Outreach".
   */
  outreachLabel?: string;
} = {}) {
  const params = useParams();
  const brandId = params.brandId as string;
  const campaignId = params.id as string | undefined;
  const offerId = params.offerId as string | undefined;
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug);

  const { data: featureStatsData } = useAuthQuery(
    campaignId
      ? ["featureStats", featureSlug, "campaign", campaignId]
      : ["featureStats", featureSlug, brandId],
    () =>
      fetchFeatureStats(featureSlug, campaignId ? { campaignId } : { brandId }),
    { enabled, ...pollOptions },
  );

  // WHICH steps this row shows comes from the campaign's own SALES FUNNEL, never from
  // the brand goal — that column is retired in brand-service (NOT NULL with a server
  // default, so it reads "website purchases" for a brand that stated nothing) and it
  // cannot separate the two meeting funnels either. Same `["campaign", id]` key the
  // campaign Overview and the top bar already poll → one request for all three.
  const { data: campaignData } = useAuthQuery(
    ["campaign", campaignId ?? "none"],
    () => getCampaign(campaignId as string),
    { enabled: !!campaignId },
  );
  const funnelKey = campaignData?.campaign.funnelKey ?? null;
  // A PAUSED campaign says `Paused` where it would otherwise say `Learning`: the tag
  // withholds a figure because too few outcomes have landed, and on a stopped campaign
  // none are landing, so it would promise a number that cannot arrive until the customer
  // restarts it. WHICH figures are withheld does not change — that stays keyed on the
  // outcome counts — so restarting restores exactly the tags it had. Read off the
  // campaign query this row already makes (no second read); brand and offer grain state
  // no single status and pass false.
  const campaignPaused =
    campaignData != null && !isRunningStatus(campaignData.campaign.status);

  // `/revenue` carries the `spend` block that feeds the cost cards (CPC / CPS /
  // CPSM), asked at the grain this row IS: the campaign when one is open, else the
  // offer, else the brand. Byte-identical query keys + keep-last-good to the brand
  // Overview and the Campaigns header, so React Query dedupes to one poll per grain
  // and a transient degenerate 200 can't blank a $ card mid-session.
  //
  // Only the CAMPAIGN branch names a channel, and it may: a campaign runs exactly
  // one. The other two spanned several while asking the per-feature read, so the
  // cost cards on a brand- or offer-scoped page described one channel under the
  // brand's or the offer's name — measured on the brand that surfaced it, $2,625.44
  // of one channel standing in for $2,668.47 across four.
  const { data: revenueData } = useAuthQuery(
    campaignId
      ? ["featureRevenue", brandId, featureSlug, "campaign", campaignId]
      : offerId
        ? ["offerRevenue", brandId, offerId]
        : ["brandRevenue", brandId],
    () =>
      campaignId
        ? getFeatureRevenue(featureSlug, brandId, { campaignId })
        : offerId
          ? getOfferRevenue(offerId, brandId)
          : getBrandRevenue(brandId),
    {
      enabled,
      ...pollOptions,
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(
          prev as RevenueOverview | undefined,
          next as RevenueOverview,
        ),
    },
  );

  // Whether the SCOPE this row answers for is still learning — every campaign selling it
  // is. Only the ratios below are gated by it, and only where they render (a campaign-
  // scoped row shows funnel steps instead). Read through the same hook the Campaigns
  // table uses, on the same query keys, so it costs no network and a page cannot state a
  // return the campaigns beneath it are all declining to state.
  const { rows: campaignRows } = useCampaignRows(brandId, featureSlug, offerId);
  const economicsLearning = scopeIsLearning(campaignRows);

  const statsRevealed = useCoordinatedReveal([featureStatsData !== undefined]);

  if (!enabled) return null;

  const featureStats = featureStatsData?.stats ?? {};

  // `spend` (server-computed CPC / CPS / CPSM) comes from the `/revenue` payload,
  // read verbatim by `OutreachStatCards`. Absent/cold → the cost cards render
  // "—", never a false $0. features-service stays the single source (no client
  // division).
  // Undeduped outreach VOLUME — what the spend beside it tracks. Only read when the
  // caller states a contacted count, because that is what makes the two grains
  // distinguishable on screen; on its own the row keeps one card and one word.
  const outreachActions =
    revenueData?.sequences?.total ?? revenueData?.outreachContacted?.total ?? null;

  return (
    <OutreachStatCards
      stats={featureStats}
      spend={revenueData?.spend}
      pending={!statsRevealed}
      funnelKey={funnelKey}
      economics={revenueData?.costEconomics}
      totalPipelineUsd={revenueData?.totalPipelineUsd}
      // A BRAND sells through several funnels at once, so its row states MONEY and no
      // funnel steps — the same split the brand Overview takes. A campaign sells one,
      // so its own steps are what it buys.
      showEconomics={!campaignId}
      economicsLearning={economicsLearning}
      showFunnelMetrics={!!campaignId}
      paused={campaignPaused}
      outreachOverride={contactedOverride != null ? outreachActions : outreachOverride}
      contactedOverride={contactedOverride}
      // The share of contacted that showed sales interest, through the one helper the
      // campaign Overview reads too, so the two surfaces cannot state it two ways.
      signalSharePct={salesInterestSharePct(revenueData?.funnelSteps)}
      outreachLabel={contactedOverride != null ? (outreachLabel ?? "Outreaches") : outreachLabel}
    />
  );
}
