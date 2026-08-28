"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getOfferFunnelRevenue, getOfferFunnelPipelineActivity } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { CampaignsTable, useCampaignRows } from "@/components/campaigns/campaigns-table";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { scopeIsLearning } from "@/lib/learning-threshold";

/**
 * ONE sales funnel, answered the way its offer is answered.
 *
 * The same `RevenueOverviewSection` and `OutreachStatCards` the offer Overview
 * renders, on the funnel's OWN money: features-service answers this grain in full
 * (its #852), so the spend breakdown, the return over the brand's life and the dated
 * series are this funnel's rather than a wider scope's borrowed under its name.
 *
 * Two deliberate differences from the offer, and neither is an omission:
 *
 *   - it charts the RETURN, not the per-day outreach bars. Outreach is what a CHANNEL
 *     does and a funnel carries several, so the bars would describe one of its legs;
 *     the return is what the whole funnel is judged on.
 *   - it claims no daily budget. Money is funded per (funnel, channel, offer), so a
 *     funnel with several channels has no single ceiling of its own; the card states
 *     what was spent and claims none.
 *
 * A funnel this offer does not sell answers 404 upstream rather than handing back the
 * offer's numbers under a funnel's name, and this states that rather than a zero.
 */
export function FunnelOverviewPage() {
  const params = useParams<{ orgId: string; brandId: string; offerId: string; funnelKey: string }>();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const rawKey = params?.funnelKey ? decodeURIComponent(params.funnelKey) : "";
  const featureSlug = useSoleFeatureSlug();
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;
  const wanted = rawKey ? normalizeSalesFunnelKey(rawKey as SalesFunnelKeyWire) : null;
  const enabled = Boolean(brandId && offerId && rawKey);

  const revenue = useAuthQuery(
    ["offerFunnelRevenue", brandId, offerId, wanted ?? "none"],
    () => getOfferFunnelRevenue(offerId, rawKey, brandId),
    { enabled, ...pollOptions },
  );

  const activity = useAuthQuery(
    ["offerFunnelPipelineActivity", brandId, offerId, wanted ?? "none"],
    () => getOfferFunnelPipelineActivity(offerId, rawKey, { brandId }),
    { enabled, ...pollOptions },
  );

  // This funnel's campaigns, collapsed on the campaign IDENTITY by the same hook the
  // Campaigns table uses — so the rows below and the gate above cannot disagree about
  // how many campaigns there are or whether they have been measured.
  const { rows: allRows } = useCampaignRows(brandId, featureSlug, offerId);
  const funnelRows = useMemo(
    () =>
      wanted
        ? allRows.filter(
            (r) =>
              r.campaign.funnelKey != null &&
              normalizeSalesFunnelKey(r.campaign.funnelKey) === wanted,
          )
        : [],
    [allRows, wanted],
  );
  // The ratios state `Learning` while every campaign carrying this funnel still is,
  // and clear the moment one is measured. The totals beside them are never gated:
  // money already spent and pipeline already earned are facts, not prices.
  const economicsLearning = scopeIsLearning(funnelRows);

  // Reveal on SETTLE, never on success: a read that errors falls through to a stated
  // page rather than holding it in a skeleton forever.
  const revenuePending = revenue.isPending && !revenue.isError;
  const activityPending = activity.isPending && !activity.isError;
  const data = revenue.data;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <RevenueOverviewSection
        data={revenuePending ? undefined : data}
        pipelineActivity={activityPending ? undefined : activity.data}
        revenuePending={revenuePending}
        costPending={revenuePending}
        todayCostPending={revenuePending}
        activityPending={activityPending}
        economicsLearning={economicsLearning}
        funnelKey={rawKey ? (rawKey as SalesFunnelKeyWire) : null}
        // The per-day bars describe a CHANNEL and a funnel carries several. What a
        // funnel is judged on is the return, which is the call the offer and the brand
        // make one level up.
        showActivityChart={false}
        showRoiTrend
        // Money is funded per (funnel, channel, offer), so a funnel carrying several
        // channels has no single ceiling of its own to compare its spend against.
        dailyBudgetCents={null}
        budgetNote="There is no daily budget for a single sales funnel: money is funded per channel, so this is what the funnel spent, with no ceiling of its own to compare it against."
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
        topRow={
          <OutreachStatCards
            // The legacy /stats counts are per CHANNEL; everything this row states
            // comes off the funnel's own money below.
            stats={{}}
            spend={revenuePending ? null : data?.spend}
            economics={revenuePending ? null : data?.costEconomics}
            totalPipelineUsd={revenuePending ? null : (data?.totalPipelineUsd ?? null)}
            pending={revenuePending}
            showEconomics
            economicsLearning={economicsLearning}
            // Outreach is what a CHANNEL does, counted per channel and per brand. A
            // funnel carrying several has none of its own, and a zero would read as
            // "nobody was contacted".
            showOutreach={false}
            showFunnelMetrics={false}
          />
        }
      />

      {/* Full width UNDER the chart, exactly where the offer Overview puts what is
          behind its numbers. Beside the cost cards it read as a side note; a funnel's
          campaigns are the thing that produced everything above them. */}
      <div className="space-y-3 pt-2">
        <h2 className="font-display text-lg font-bold text-gray-800">Campaigns</h2>
        <CampaignsTable
          brandId={brandId}
          featureSlug={featureSlug}
          basePath={basePath}
          offerId={offerId}
          funnelKey={rawKey}
        />
      </div>

      {!revenuePending && revenue.isError && (
        <p className="text-sm text-gray-500">
          Couldn&rsquo;t read this funnel&rsquo;s money. A funnel this offer does not
          sell answers with nothing rather than with the offer&rsquo;s own numbers under
          its name.
        </p>
      )}
    </div>
  );
}
