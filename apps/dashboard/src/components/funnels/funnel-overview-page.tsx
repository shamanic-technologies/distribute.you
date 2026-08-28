"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getOfferFunnels } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import type { RevenueOverview } from "@/lib/revenue-view";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { CampaignsTable, useCampaignRows } from "@/components/campaigns/campaigns-table";
import { funnelViews, costCoverageNote, unpricedFunnelReasonLabel } from "@/lib/offer-funnels";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { scopeIsLearning } from "@/lib/learning-threshold";

/**
 * ONE sales funnel, answered the way its offer is answered.
 *
 * The SAME `RevenueOverviewSection` + `OutreachStatCards` the offer Overview renders,
 * fed by the row features-service already serves for this funnel. One layout, one
 * vocabulary: a funnel cannot read one way here and another way one level up.
 *
 * Two things it does NOT chart, and neither is an omission:
 *
 *   - the per-day outreach bars and the return curve are served per BRAND and per
 *     OFFER, not per funnel. Drawing the offer's curve under a funnel's name would
 *     state a wider scope's shape as this one's, which is the bug this repo keeps
 *     recording. The figures that ARE this funnel's are all here.
 *   - a daily budget: money is funded per (funnel, channel, offer), so a funnel with
 *     several channels has no single ceiling of its own to compare its spend against.
 *
 * A funnel not every leg has a campaign for still answers with what it has, which is
 * exactly what the producer sends.
 */
export function FunnelOverviewPage() {
  const params = useParams<{ orgId: string; brandId: string; offerId: string; funnelKey: string }>();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const rawKey = params?.funnelKey ? decodeURIComponent(params.funnelKey) : "";
  const featureSlug = useSoleFeatureSlug();
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;

  // The offer's funnels, on the key its own list already polls — opening a funnel
  // costs no request. There is no per-funnel read: the row IS the answer.
  const funnels = useAuthQuery(
    ["offerFunnels", brandId, offerId],
    () => getOfferFunnels(offerId, brandId),
    { enabled: Boolean(brandId && offerId), ...pollOptions },
  );

  const wanted = rawKey ? normalizeSalesFunnelKey(rawKey as SalesFunnelKeyWire) : null;
  const row = useMemo(() => {
    if (!wanted) return null;
    return (
      funnelViews(funnels.data?.funnels ?? []).find(
        (r) => normalizeSalesFunnelKey(r.funnelKey as SalesFunnelKeyWire) === wanted,
      ) ?? null
    );
  }, [funnels.data, wanted]);

  // This funnel's campaigns, collapsed on the campaign IDENTITY by the same hook the
  // Campaigns table uses — so the rows below and the gate above cannot disagree.
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
  // and clear the moment one is measured. The totals beside them are never gated.
  const economicsLearning = scopeIsLearning(funnelRows);

  const def = rawKey ? campaignFunnel(rawKey as SalesFunnelKeyWire) : null;
  const coverage = costCoverageNote(row?.coverage);
  const pending = funnels.isPending && !funnels.isError;

  // The section's shape, carrying THIS funnel's figures and nothing wider. Built
  // rather than fetched because features-service answers a funnel as a row of its
  // offer's list, not as a read of its own.
  const data: RevenueOverview | undefined = row
    ? {
        totalPipelineUsd: row.pipelineUsd,
        costEconomics: {
          committedCostUsd: row.investedUsd,
          costOfAcquisitionPct: row.costOfAcquisitionPct,
          roiMultiple: row.roiMultiple,
          costPerAcquisitionUsd: row.costPerAcquisitionUsd,
        },
        // Empty rather than borrowed. These are the per-lead breakdowns the offer read
        // carries and the funnel row does not; the section renders nothing for them,
        // which is the honest answer, and filling them from the offer would state a
        // wider scope's people as this funnel's.
        timeSeries: [],
        organizations: [],
        leads: [],
        events: [],
      }
    : undefined;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <RevenueOverviewSection
        data={pending ? undefined : data}
        revenuePending={pending}
        costPending={pending}
        todayCostPending={pending}
        activityPending={false}
        economicsLearning={economicsLearning}
        funnelKey={rawKey ? (rawKey as SalesFunnelKeyWire) : null}
        // The per-day outreach bars describe a CHANNEL, and a funnel carries several.
        // What a funnel is judged on is the return, so it charts that — the same call
        // the offer and the brand make one level up.
        showActivityChart={false}
        showRoiTrend
        // Money is funded per (funnel, channel, offer), so a funnel carrying several
        // channels has no single ceiling of its own. The card states what was spent
        // and claims none.
        dailyBudgetCents={null}
        budgetNote="There is no single daily budget for a sales funnel: money is funded per channel, so this is what the funnel spent with no ceiling of its own to compare it against."
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
        topRow={
          <OutreachStatCards
            // The legacy /stats counts are per CHANNEL, not per funnel. The cards read
            // the economics block above for everything this page states.
            stats={{}}
            // Outreach is what a CHANNEL does, counted per channel and per brand. A
            // funnel carrying several has none of its own, and a zero would read as
            // "nobody was contacted".
            showOutreach={false}
            // The spend BLOCK is per-channel detail the funnel row does not carry;
            // the cost card reads `economics.committedCostUsd` for the total, which is
            // this funnel's own.
            spend={null}
            pending={pending}
            economics={pending ? null : data?.costEconomics}
            totalPipelineUsd={pending ? null : (row?.pipelineUsd ?? null)}
            showEconomics
            economicsLearning={economicsLearning}
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

      {!pending && !row && (
        <p className="text-sm text-gray-500">
          {funnels.isError
            ? "Couldn\u2019t read this offer\u2019s sales funnels."
            : `${def?.name ?? rawKey} is not one of this offer\u2019s sales funnels.`}
        </p>
      )}

      {row && !row.priced && (
        <p className="text-sm text-gray-500">
          {unpricedFunnelReasonLabel(row.unpricedReason)}. The spend above is real: you
          paid it.
        </p>
      )}

      {coverage && <p className="text-xs text-gray-500 max-w-3xl">{coverage}</p>}
    </div>
  );
}
