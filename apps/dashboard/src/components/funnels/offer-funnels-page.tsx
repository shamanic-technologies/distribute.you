"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { getOfferFunnels } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { formatRoi } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { channelSlugLabel } from "@/lib/campaign-title";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { LearningTag } from "@/components/learning-tag";
import {
  funnelViews,
  costCoverageNote,
  summariseFunnels,
  unpricedFunnelReasonLabel,
} from "@/lib/offer-funnels";

const COLUMN_COUNT = 6;

const INVESTED_TIP =
  "What this funnel has cost all in: what we charged you, plus what you recorded for the steps your own team worked. The second half is never billed; it is here because a funnel you finish yourself would otherwise look cheaper than it is.";

const FUNNEL_TIP =
  "A sales funnel is the path from a first signal to a paying client. It is the smallest scope whose money divides into a return, because what a customer is worth is only known at the end of it.";

function fmtUsd(value: number | null): string {
  return value === null ? "—" : formatUsdAdaptive(value);
}

function fmtPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/**
 * An offer's sales funnels, one row each.
 *
 * The grain between the offer and its campaigns. A campaign buys one LEG of a funnel,
 * so it has a cost per step and no return of its own; the funnel is where a return
 * exists.
 *
 * Every figure is a served field. The rows deliberately do NOT sum to the offer: money
 * adds across funnels but people do not (a lead worked through two funnels is one lead)
 * and no ratio does, so the offer's own Overview stays the number to trust for "what did
 * this offer do".
 */
export function OfferFunnelsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const params = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const featureSlug = useSoleFeatureSlug();
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;

  const funnels = useAuthQuery(
    ["offerFunnels", brandId, offerId],
    () => getOfferFunnels(offerId, brandId),
    { enabled: Boolean(brandId && offerId), ...pollOptions },
  );

  const rows = useMemo(() => funnelViews(funnels.data?.funnels ?? []), [funnels.data]);
  const summary = useMemo(() => summariseFunnels(rows), [rows]);
  const coverage = costCoverageNote(funnels.data?.costCoverage);

  // Reveal on SETTLE: a read that errors falls through to a stated empty table rather
  // than holding the page in a skeleton forever.
  const pending = funnels.isPending && !funnels.isError;

  // How many campaigns carry a funnel, counted the way the Campaigns table counts
  // them: ONE per campaign IDENTITY. campaign-service keeps every superseded row a
  // workflow switch produced, so the ids the producer sends are the stored rows —
  // 47 of them for a funnel a customer knows as two campaigns.
  const { rows: campaignRows } = useCampaignRows(brandId, featureSlug, offerId);
  const campaignCountFor = (key: string) => {
    const wanted = normalizeSalesFunnelKey(key as SalesFunnelKeyWire);
    return campaignRows.filter(
      (r) =>
        r.campaign.funnelKey != null &&
        normalizeSalesFunnelKey(r.campaign.funnelKey) === wanted,
    ).length;
  };
  // Its mark, off the shared catalogue — the same one the campaigns table draws.
  const funnelDefFor = (key: string) => campaignFunnel(key as SalesFunnelKeyWire);
  // A funnel states `Learning` on its RATIOS while every campaign carrying it is still
  // learning, and clears the moment ONE of them is measured — the same rule the offer
  // and the brand headline use, one grain down. A funnel with no campaign at all is
  // UNMEASURED rather than learning: there is nothing to have an opinion about.
  const funnelLearningFor = (key: string) => {
    const wanted = normalizeSalesFunnelKey(key as SalesFunnelKeyWire);
    return scopeIsLearning(
      campaignRows.filter(
        (r) =>
          r.campaign.funnelKey != null &&
          normalizeSalesFunnelKey(r.campaign.funnelKey) === wanted,
      ),
    );
  };

  return (
    // EMBEDDED is how the offer Overview renders it: an offer sells through funnels,
    // so the Overview lists those rather than the campaigns two levels down. It then
    // owns the page chrome and the heading, and this contributes the table alone.
    <div className={embedded ? "space-y-3" : "p-4 md:p-8 max-w-7xl mx-auto space-y-6"}>
      {!embedded && (
        <header>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-1.5">
            Sales funnels
            <InfoTooltip tip={FUNNEL_TIP} />
          </h1>
          <p className="mt-1 text-sm text-gray-500 max-w-3xl">
            Each way this offer turns a stranger into a paying client, and what each one
            returned. A campaign buys one step of a funnel, so the return lives here.
          </p>
          {!pending && summary.total > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {summary.total} funnel{summary.total === 1 ? "" : "s"}, and{" "}
              {summary.priced === 0
                ? "none of them can be priced yet"
                : `${summary.priced} of them priced`}
              .
            </p>
          )}
        </header>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full md:min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">Funnel</th>
              <th className="px-4 py-2 font-medium text-right">ROI</th>
              <th className="px-4 py-2 font-medium text-right">% CAC</th>
              <th className="px-4 py-2 font-medium text-right">$ CAC</th>
              <th className="px-4 py-2 font-medium text-right">$ Revenue</th>
              <th className="px-4 py-2 font-medium text-right">
                <span className="inline-flex items-center gap-1">
                  $ Invested
                  <InfoTooltip tip={INVESTED_TIP} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pending ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-3" colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-4 w-full rounded" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={COLUMN_COUNT}>
                  {funnels.isError
                    ? "Couldn\u2019t read this offer\u2019s sales funnels."
                    : "This offer sells through no sales funnel yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.funnelKey}
                  // The whole row is the control, and it responds the way a campaign row
                  // does: the surface tints, nothing underlines. A link inside a
                  // clickable row is two affordances for one action.
                  onClick={() =>
                    router.push(`${basePath}/funnels/${encodeURIComponent(row.funnelKey)}`)
                  }
                  // Warm the funnel's route on hover. Without it the click waits on a
                  // dynamic RSC render and the nearest loading boundary is the OFFER's,
                  // so drilling into a funnel blanked this whole page to a skeleton.
                  onMouseEnter={() =>
                    prefetch(`${basePath}/funnels/${encodeURIComponent(row.funnelKey)}`)
                  }
                  onFocus={() =>
                    prefetch(`${basePath}/funnels/${encodeURIComponent(row.funnelKey)}`)
                  }
                  className="border-b border-gray-50 cursor-pointer transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    {/* The SAME shape a campaign row wears: the mark, the name, and
                        the quieter line under it. A funnel reads one way on this table
                        and the same way in the campaigns table one click down. */}
                    <span className="flex min-w-0 items-center gap-2.5">
                      {funnelDefFor(row.funnelKey) && (
                        <SalesFunnelMark def={funnelDefFor(row.funnelKey)!} size="sm" />
                      )}
                      <span className="flex h-8 min-w-0 flex-col justify-center">
                        <span className="truncate leading-[14px] text-gray-800">
                          {row.name}
                        </span>
                        <span className="truncate text-xs leading-[18px] text-gray-500">
                          {row.steps.join("  \u2192  ")}
                        </span>
                      </span>
                    </span>
                    {!row.priced && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {unpricedFunnelReasonLabel(row.unpricedReason)}
                      </p>
                    )}
                  </td>
                  {/* The three RATIOS each state the tag in their OWN column, the way
                      the Campaigns table does. One tag spanning them reads as a note
                      about the table rather than as the answer in each cell, and it
                      leaves two columns blank, which is a different claim. Each divides
                      by an outcome count, so at a low count each is decided by whichever
                      outcome happened to land. The TOTALS beside them are never gated:
                      money already spent and pipeline already earned are facts. */}
                  <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                    {funnelLearningFor(row.funnelKey) ? (
                      <LearningTag withInfo={false} />
                    ) : (
                      formatRoi(row.roiMultiple)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {funnelLearningFor(row.funnelKey) ? (
                      <LearningTag withInfo={false} />
                    ) : (
                      fmtPct(row.costOfAcquisitionPct)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {funnelLearningFor(row.funnelKey) ? (
                      <LearningTag withInfo={false} />
                    ) : (
                      fmtUsd(row.costPerAcquisitionUsd)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtUsd(row.pipelineUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtUsd(row.investedUsd)}
                    {/* The split, only where there is one to state. What we charged and
                        what you recorded are two questions with two owners, and one of
                        them is what we bill. */}
                    {row.customerCostUsd !== null && row.customerCostUsd > 0 && (
                      <p className="text-[11px] text-gray-400">
                        {fmtUsd(row.platformCostUsd)} us · {fmtUsd(row.customerCostUsd)} you
                      </p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {coverage && <p className="text-xs text-gray-500 max-w-3xl">{coverage}</p>}

    </div>
  );
}
