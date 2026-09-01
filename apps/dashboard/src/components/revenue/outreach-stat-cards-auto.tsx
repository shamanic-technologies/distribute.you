"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchFeatureStats,
  getFeatureRevenue,
  getOfferRevenue,
  getBrandRevenue,
  keepLastGoodFeatureRevenue,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { salesInterestSharePct } from "@/lib/funnel-share";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { isRunningStatus } from "@/lib/campaign-controls";
import { useScopePaused } from "@/lib/use-scope-paused";
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
  leadsOverride,
  salesInterestOverride,
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
   * The board's own two numbers, forwarded untouched: the POPULATION this surface holds,
   * and how many of those people stand at sales interest with their share of it.
   *
   * The Leads page supplies both off the very rows its board partitions, so its cards and
   * its columns cannot disagree about the same screen. Supplying `leadsOverride` replaces
   * the people/actions pair; supplying `salesInterestOverride` also stands the funnel
   * pair's own count card down, because that one counts reply signals while the board
   * renders lead-service's funnel-aware standing and the two legitimately differ.
   */
  leadsOverride?: number | null;
  salesInterestOverride?: { count: number; sharePct: number | null } | null;
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
  // WHICH CHANNEL this row is about. A campaign states its own on its row, so a
  // campaign-scoped row reads THAT and not the brand's sole GA feature — otherwise it
  // prices a campaign on the brand's second channel with the FIRST one's money, under
  // the open campaign's name, while the lead panel below it walks the right one. Same
  // `["campaign", id]` key the campaign Overview and the top bar already poll, so this
  // is the read this row was already making, narrowed.
  const {
    campaign: scopedCampaign,
    featureSlug,
    settled: scopeSettled,
  } = useScopedFeatureSlug(campaignId);
  const campaignScoped = Boolean(campaignId);
  const soleFeatureSlug = useSoleFeatureSlug();
  const channels = useAcquisitionChannels();
  // Under a campaign the gate is the channel CATALOGUE, not the brand's revenue-feature
  // set: that set decides which features get a revenue page on a brand-scoped surface,
  // and gating a campaign on it blanks every campaign that is not on the brand's one GA
  // channel. Never fired under a guessed slug — a read on the wrong channel lands in
  // that channel's cache entry.
  const enabled =
    featureSlug !== null &&
    (campaignScoped
      ? acquisitionChannelForFeatureSlug(featureSlug, channels) !== null
      : isRevenueFeature(featureSlug));

  const { data: featureStatsData } = useAuthQuery(
    campaignId
      ? ["featureStats", featureSlug, "campaign", campaignId]
      : ["featureStats", featureSlug, brandId],
    () =>
      fetchFeatureStats(featureSlug as string, campaignId ? { campaignId } : { brandId }),
    { enabled, ...pollOptions },
  );

  // WHICH steps this row shows comes from the campaign's own SALES FUNNEL, never from
  // the brand goal — that column is retired in brand-service (NOT NULL with a server
  // default, so it reads "website purchases" for a brand that stated nothing) and it
  // cannot separate the two meeting funnels either. Same `["campaign", id]` key the
  // campaign Overview and the top bar already poll → one request for all three.
  const funnelKey = scopedCampaign?.funnelKey ?? null;
  // A PAUSED campaign says `Paused` where it would otherwise say `Learning`: the tag
  // withholds a figure because too few outcomes have landed, and on a stopped campaign
  // none are landing, so it would promise a number that cannot arrive until the customer
  // restarts it. WHICH figures are withheld does not change — that stays keyed on the
  // outcome counts — so restarting restores exactly the tags it had. Read off the
  // campaign query this row already makes (no second read); brand and offer grain state
  // no single status and pass false.
  const campaignPaused = scopedCampaign != null && !isRunningStatus(scopedCampaign.status);
  // Off a campaign the same question is asked of the SCOPE this row is about — the offer
  // when the route names one, else the brand — and it is the verdict the pill on that
  // page's own header already renders. A scope with no campaign at all is unmeasured
  // rather than stopped, so it keeps the word it read before.
  const { paused: scopePaused } = useScopePaused(brandId, {
    offerId,
    campaignId,
  });
  const withheldPaused = campaignPaused || scopePaused;

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
        ? getFeatureRevenue(featureSlug as string, brandId, { campaignId })
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
  // The brand/offer learning gate, on the feature the brand-level list has always been
  // pinned to. An offer-scoped list spans channels anyway, and a campaign-scoped row
  // states funnel steps rather than these ratios.
  const { rows: campaignRows } = useCampaignRows(brandId, soleFeatureSlug, offerId);
  const economicsLearning = scopeIsLearning(campaignRows);

  const statsRevealed = useCoordinatedReveal([featureStatsData !== undefined]);

  // Hidden only once we KNOW there is nothing to show. While the campaign read is in
  // flight the reads are disabled and the cards render their own skeletons, rather than
  // the row appearing out of nowhere a round trip later.
  if (!enabled && scopeSettled) return null;

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
      paused={withheldPaused}
      outreachOverride={contactedOverride != null ? outreachActions : outreachOverride}
      contactedOverride={contactedOverride}
      leadsOverride={leadsOverride}
      salesInterestOverride={salesInterestOverride}
      // The share of contacted that showed sales interest, through the one helper the
      // campaign Overview reads too, so the two surfaces cannot state it two ways.
      signalSharePct={salesInterestSharePct(revenueData?.funnelSteps)}
      outreachLabel={contactedOverride != null ? (outreachLabel ?? "Outreaches") : outreachLabel}
    />
  );
}
