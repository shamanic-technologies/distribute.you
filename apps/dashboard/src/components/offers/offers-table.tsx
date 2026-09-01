"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { listBrandOffers, getBrandOfferMoney, type Offer, type OfferRevenueGroup } from "@/lib/api";
import {
  COLUMN_INFO,
  NumericHead,
  RoiCell,
  fmtPct,
  fmtUsd,
} from "@/components/campaigns/campaigns-table";
import { LearningTag } from "@/components/learning-tag";
import { offerLearningFor, useOfferLearning } from "@/lib/use-offer-learning";
import { usePausedByOffer } from "@/lib/use-scope-paused";
import { scopePausedFor } from "@/lib/scope-paused";
import { Skeleton } from "@/components/skeleton";
import { OfferMark } from "@/components/marks/offer-mark";

/**
 * The brand's offers, one line each, ordered by return.
 *
 * This is the brand Overview's own list, and it sits exactly where the Campaigns
 * table used to: a brand is an IDENTITY and an offer is a PROPOSITION, so what a
 * brand's Overview lists is the propositions it sells, and the campaigns that sell
 * one of them belong to that offer's Overview one click down.
 *
 * Every number is a READY features-service field, asked at the OFFER grain: each
 * row is that offer's money across EVERY acquisition channel it is sold through.
 * The only client work is joining the offer row (its NAME, which brand-service
 * owns) to its money by offerId — a display lookup, never a derived metric.
 *
 * It used to ask `?groupBy=offerId` on the per-feature read, which groups by offer
 * but answers for ONE channel, and printed that under the offer's name directly
 * beneath brand cards showing the whole thing. On the brand that surfaced it, whose
 * single offer runs four channels, the row read $2,625.44 / 2.7x under cards
 * reading $2,670.44 / 2.6x — both real, about different things, nothing erroring.
 *
 * Nothing here sums the rows either: the brand's own headline figures come from
 * features-service's brand-grain read on the page above, so the table and the
 * headline can never disagree the way a client-side sum would let them. Across
 * several offers the rows deliberately do NOT sum to the brand — a lead served
 * under two offers' campaigns is one lead to the brand and belongs to both.
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
  /**
   * Whether this offer's two RATIOS rest on too little evidence to state.
   *
   * An offer is a scope sold by campaigns, so it is learning while every campaign
   * selling it is — the same rule the cards above this table already follow, one grain
   * down. `$ Revenue` and `$ Invested` are never gated by it: one is a TOTAL that grows
   * with each outcome rather than being decided by whichever one landed, the other is
   * money already spent, and neither divides by an outcome count.
   */
  learning: boolean;
  /**
   * Whether every campaign selling this offer is STOPPED, in which case the withheld
   * ratios read `Paused` rather than `Learning`: nothing is landing, so the tag would
   * promise a number that cannot arrive until the customer restarts something. It is the
   * word this offer's own page states, so a row and the page it opens agree.
   *
   * An offer with NO campaign at all is unmeasured rather than stopped, and reads exactly
   * as it did before.
   */
  paused: boolean;
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
  const prefetch = useRoutePrefetch();
  const revenueEnabled = isRevenueFeature(featureSlug);

  // Whether each offer's ratios rest on enough evidence to state. Read through the same
  // campaign rows the offer's own surfaces are judged on, on keys this page already
  // polls, so a row can never state a return that every campaign selling it is declining
  // to state.
  const { learningByOfferId, settled: learningSettled } = useOfferLearning(
    brandId,
    featureSlug,
  );
  // ...and whether each one is stopped, off the SAME rows the pill on that offer's own
  // header is built from. A row cannot call a hook, so the verdict is a map built once at
  // brand grain and read per row — the shape `useOfferLearning` already uses beside it.
  const { pausedByOfferId, settled: pausedSettled } = usePausedByOffer(brandId);

  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), {
    refetchInterval: POLL_INTERVAL,
  });

  // Asked at the OFFER grain — each row combined across every channel that offer is
  // sold through — never of one channel. The key carries no feature for the same
  // reason: there is no channel in this answer.
  const groupsQ = useAuthQuery(
    ["brandOfferMoney", brandId],
    () => getBrandOfferMoney(brandId),
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
    const joined = offers.map((o) => ({
      offer: o,
      revenue: groupsById.get(o.offerId) ?? null,
      learning: offerLearningFor(learningByOfferId, o.offerId, learningSettled),
      paused: scopePausedFor(pausedByOfferId, o.offerId, pausedSettled),
    }));
    return joined.sort((a, b) => {
      // A row that is not stating its return has no rank under it — ordering a table by
      // a number it is deliberately not showing reads as unordered. Learning offers sit
      // below the measured ones and keep their relative order among themselves.
      const byLearning = Number(a.learning) - Number(b.learning);
      if (byLearning !== 0) return byLearning;
      if (a.learning) return 0;
      return (b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1);
    });
  }, [offers, groupsById, learningByOfferId, learningSettled, pausedByOfferId, pausedSettled]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed gate.
  const settled =
    (offersQ.data !== undefined || offersQ.isError) &&
    (groupsQ.data !== undefined || groupsQ.isError);

  return (
    /* Below `md` the table narrows to the two things a reader can act on: which
       offer it is, and what it returns. The three columns behind them fold.

       The floor is gated at the same breakpoint for a reason: unconditional, it
       re-widens the row past a phone's viewport even with every other column
       hidden, so the two that survived get pushed off to the right and read as
       missing. `table-fixed` below `md` is what makes the truncation bite — in the
       default auto layout a column grows to its content, so one long offer name
       widens the whole row however many `truncate`s it carries. */
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full table-fixed text-sm md:table-auto md:min-w-[720px]">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 w-[70%] md:w-auto">Offer</th>
            <th className="px-4 py-3 text-right w-[30%] md:w-auto"><NumericHead label="ROI" tip={OFFER_COLUMN_INFO.roi} /></th>
            <th className="px-4 py-3 text-right hidden md:table-cell"><NumericHead label="% CAC" tip={OFFER_COLUMN_INFO.cacPct} /></th>
            <th className="px-4 py-3 text-right hidden md:table-cell"><NumericHead label="$ Revenue" tip={OFFER_COLUMN_INFO.revenue} /></th>
            <th className="px-4 py-3 text-right hidden md:table-cell"><NumericHead label="$ Invested" tip={OFFER_COLUMN_INFO.invested} /></th>
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
            rows.map(({ offer, revenue, learning, paused }) => (
              <tr
                key={offer.offerId}
                onClick={() => router.push(`${basePath}/offers/${offer.offerId}`)}
                // Warm the offer's route while the pointer rests on the row, so the
                // click has no server round-trip left to wait on and the offer's
                // `loading.tsx` never gets to render. See `useRoutePrefetch`.
                onMouseEnter={() => prefetch(`${basePath}/offers/${offer.offerId}`)}
                onFocus={() => prefetch(`${basePath}/offers/${offer.offerId}`)}
                className="cursor-pointer transition hover:bg-gray-50"
              >
                {/* The offer leads the row: it is what the line is ABOUT, and the
                    numbers behind it qualify it. The mark is the SHARED `OfferMark`
                    the top bar and the tenant switcher draw, so one thing wears one
                    mark everywhere. `min-w-0` on the flex wrapper is what lets
                    `truncate` bite inside a fixed-layout cell. */}
                <td className="px-4 py-3 font-medium text-gray-800">
                  <div className="flex min-w-0 items-center gap-2">
                    <OfferMark size="sm" />
                    <span className="truncate">{offer.name}</span>
                  </div>
                </td>
                {/* The two RATIOS state `Learning` together or not at all — they are one
                    statement in two units, a return and its reciprocal, so showing one of
                    them beside a tag would let a reader trust the number we just said we
                    could not stand behind. The two money columns after them are totals,
                    not prices, and keep their figures. */}
                <td className="px-4 py-3 text-right">
                  {learning ? <LearningTag withInfo={false} paused={paused} /> : <RoiCell multiple={revenue?.roiMultiple} />}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">{learning ? <LearningTag withInfo={false} paused={paused} /> : fmtPct(revenue?.costOfAcquisitionPct)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">{fmtUsd(revenue?.totalPipelineUsd)}</td>
                {/* `costEconomics.committedCostUsd`, read verbatim off the same
                    `pricing=net` group the ROI and % CAC beside it divide by, so a
                    row cannot contradict its own return. An offer with no group at
                    all reads "—" rather than $0 — "we have no figure" and "it cost
                    nothing" are different statements. */}
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">{fmtUsd(revenue?.committedCostUsd)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
