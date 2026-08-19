"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { listBrandOffers, getFeatureRevenueByOffer, type Offer, type OfferRevenueGroup } from "@/lib/api";
import {
  COLUMN_INFO,
  NumericHead,
  RoiCell,
  fmtPct,
  fmtUsd,
} from "@/components/campaigns/campaigns-table";
import { Skeleton } from "@/components/skeleton";

/**
 * The brand's offers, one line each, ordered by return.
 *
 * This is the brand Overview's own list, and it sits exactly where the Campaigns
 * table used to: a brand is an IDENTITY and an offer is a PROPOSITION, so what a
 * brand's Overview lists is the propositions it sells, and the campaigns that sell
 * one of them belong to that offer's Overview one click down.
 *
 * Every number is a READY features-service field off `?groupBy=offerId`. The only
 * client work is joining the offer row (its NAME, which brand-service owns) to its
 * revenue group by offerId — a display lookup, never a derived metric. Nothing here
 * sums the groups: the brand's own headline figures come from features-service's
 * un-grouped read on the page above, so the table and the headline can never
 * disagree the way a client-side sum of the rows would let them.
 */

const OFFER_COLUMN_INFO = {
  roi: COLUMN_INFO.roi,
  cacPct: COLUMN_INFO.cacPct,
  revenue:
    "Expected pipeline revenue: the outcomes this offer has produced so far, valued with the conversion rates and customer lifetime revenue set for the funnels it is sold through. It is a projection of what this pipeline is worth, not money already collected.",
  invested:
    "What this offer has cost so far, net of any discount: money already billed plus money reserved for emails its campaigns have queued. It is the same figure the ROI and % CAC beside it are calculated from. Those two are projections of what it is worth going forward, so this is not a multiplier of them.",
} as const;

interface OfferRow {
  offer: Offer;
  revenue: OfferRevenueGroup | null;
}

export function OffersTable({
  brandId,
  featureSlug,
  basePath,
}: {
  brandId: string;
  featureSlug: string;
  /** `/orgs/:orgId/brands/:brandId` — a row opens that offer underneath it. */
  basePath: string;
}) {
  const router = useRouter();
  const revenueEnabled = isRevenueFeature(featureSlug);

  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), {
    refetchInterval: POLL_INTERVAL,
  });

  const groupsQ = useAuthQuery(
    ["featureRevenueByOffer", brandId, featureSlug],
    () => getFeatureRevenueByOffer(featureSlug, brandId),
    { enabled: revenueEnabled, refetchInterval: POLL_INTERVAL },
  );

  const offers = useMemo(() => offersQ.data?.offers ?? [], [offersQ.data]);
  const groupsById = useMemo(() => {
    const m = new Map<string, OfferRevenueGroup>();
    for (const g of groupsQ.data ?? []) m.set(g.offerId, g);
    return m;
  }, [groupsQ.data]);

  // Ordered by return DESC, the column the table leads with — a table that displays
  // one order and sorts by another reads as unordered. An offer with no return yet
  // has nothing to rank on, so it sits last rather than at zero.
  const rows = useMemo<OfferRow[]>(() => {
    const joined = offers.map((o) => ({ offer: o, revenue: groupsById.get(o.offerId) ?? null }));
    return joined.sort((a, b) => (b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1));
  }, [offers, groupsById]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed gate.
  const settled =
    (offersQ.data !== undefined || offersQ.isError) &&
    (groupsQ.data !== undefined || groupsQ.isError);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 text-right"><NumericHead label="ROI" tip={OFFER_COLUMN_INFO.roi} /></th>
            <th className="px-4 py-3 text-right"><NumericHead label="% CAC" tip={OFFER_COLUMN_INFO.cacPct} /></th>
            <th className="px-4 py-3 text-right"><NumericHead label="$ Revenue" tip={OFFER_COLUMN_INFO.revenue} /></th>
            <th className="px-4 py-3 text-right"><NumericHead label="$ Invested" tip={OFFER_COLUMN_INFO.invested} /></th>
            <th className="px-4 py-3">Offer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {!settled ? (
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td className="px-4 py-3" colSpan={5}>
                  <Skeleton className="h-5 w-full" />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-gray-500" colSpan={5}>
                No offers yet.
              </td>
            </tr>
          ) : (
            rows.map(({ offer, revenue }) => (
              <tr
                key={offer.offerId}
                onClick={() => router.push(`${basePath}/offers/${offer.offerId}`)}
                className="cursor-pointer transition hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-right"><RoiCell multiple={revenue?.roiMultiple} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtPct(revenue?.costOfAcquisitionPct)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUsd(revenue?.totalPipelineUsd)}</td>
                {/* `costEconomics.committedCostUsd`, read verbatim off the same
                    `pricing=net` group the ROI and % CAC beside it divide by, so a
                    row cannot contradict its own return. An offer with no group at
                    all reads "—" rather than $0 — "we have no figure" and "it cost
                    nothing" are different statements. */}
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUsd(revenue?.committedCostUsd)}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{offer.name}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
