"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { listBrandOffers, getBrandOfferMoney, type Offer, type OfferRevenueGroup } from "@/lib/api";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { offerLearningFor, useOfferLearning } from "@/lib/use-offer-learning";
import { usePausedByOffer } from "@/lib/use-scope-paused";
import { scopePausedFor } from "@/lib/scope-paused";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { v2OfferHref } from "@/lib/v2/routes";
import { OfferMark } from "@/components/marks/offer-mark";
import { useRowKeys } from "@/components/v2/records";
import { V2NewOfferModal } from "@/components/v2/new-offer-modal";
import { EmptyNote, SectionTitle, Shimmer, StateDot, TopBar } from "@/components/v2/ui";

/**
 * Offers, in the Missions list's anatomy: a live-sentence header, then one card table
 * with a row per offer, ordered by return.
 *
 * Every figure is the SAME read v1's `OffersTable` makes, on the same keys, so the two
 * dedupe and paint from disk: `["brandOffers", brandId]` for the names and marks,
 * `["brandOfferMoney", brandId]` for each offer's money across every channel it is sold
 * through (features-service, `pricing=net`), and the campaign rows behind
 * `useOfferLearning` / `usePausedByOffer`. Nothing is summed or divided here: the rows
 * deliberately do not add up to the brand, and the brand's own figures are its own read.
 *
 * The two RATIOS read `Learning` together while every campaign selling the offer is
 * still learning (`Paused` when every one is stopped); the two money TOTALS never do.
 */

const TH = "k-label px-3 py-2.5 text-left font-medium";

export interface OfferListRow {
  offer: Offer;
  revenue: OfferRevenueGroup | null;
  learning: boolean;
  paused: boolean;
  /** The offer is sold by at least one campaign. Absent from the rows ⟹ nothing sells it yet. */
  sold: boolean;
}

/**
 * Ordered by return DESC, the column the table leads with. A row not stating its return
 * has no rank under it, so a learning offer sinks below the measured ones and keeps its
 * relative order; an offer with no return yet sits last rather than at zero. Byte-equal
 * to v1's ordering, so a reader switching views meets the same list.
 */
export function orderOfferRows(rows: OfferListRow[]): OfferListRow[] {
  return [...rows].sort((a, b) => {
    const byLearning = Number(a.learning) - Number(b.learning);
    if (byLearning !== 0) return byLearning;
    if (a.learning) return 0;
    return (b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1);
  });
}

const usd = (v: number | null | undefined) => (v == null ? "—" : formatUsdAdaptive(v));
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}%`);

function Withheld({ paused }: { paused: boolean }) {
  return <span className="k-chip">{paused ? "Paused" : "Learning"}</span>;
}

function Dash() {
  return <span className="k-fg4">{"—"}</span>;
}

export function V2OffersList() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const featureSlug = useSoleFeatureSlug();
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const search = useSearchParams();
  const [creating, setCreating] = useState(search.get("new") === "1");
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const revenueEnabled = isRevenueFeature(featureSlug);

  const { learningByOfferId, settled: learningSettled } = useOfferLearning(brandId, featureSlug);
  const { pausedByOfferId, settled: pausedSettled } = usePausedByOffer(brandId);

  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), {
    refetchInterval: POLL_INTERVAL,
  });
  const groupsQ = useAuthQuery(["brandOfferMoney", brandId], () => getBrandOfferMoney(brandId), {
    enabled: revenueEnabled,
    refetchInterval: POLL_INTERVAL,
  });

  const rows = useMemo<OfferListRow[]>(() => {
    const byId = new Map<string, OfferRevenueGroup>();
    for (const g of groupsQ.data ?? []) byId.set(g.offerId, g);
    return orderOfferRows(
      (offersQ.data?.offers ?? []).map((o) => ({
        offer: o,
        revenue: byId.get(o.offerId) ?? null,
        learning: offerLearningFor(learningByOfferId, o.offerId, learningSettled),
        paused: scopePausedFor(pausedByOfferId, o.offerId, pausedSettled),
        sold: pausedSettled && pausedByOfferId.has(o.offerId),
      })),
    );
  }, [offersQ.data, groupsQ.data, learningByOfferId, learningSettled, pausedByOfferId, pausedSettled]);

  // Reveal on SETTLE (resolved OR errored): a failed money read shows dashes, never an
  // eternal skeleton. A disabled money read (no revenue feature) counts as settled.
  const settled =
    (offersQ.data !== undefined || offersQ.isError) &&
    (!revenueEnabled || groupsQ.data !== undefined || groupsQ.isError);
  const selling = rows.filter((r) => r.sold && !r.paused).length;

  const hrefFor = (offerId: string) => v2OfferHref(orgId, brandId, offerId);
  useRowKeys({
    count: rows.length,
    cursor,
    setCursor,
    onOpen: (i) => {
      const r = rows[i];
      if (r) router.push(hrefFor(r.offer.offerId));
    },
    searchRef,
  });

  return (
    <>
      <TopBar
        crumbs={[{ label: "Setup" }, { label: "Offers" }]}
        actions={
          <button type="button" onClick={() => setCreating(true)} className="k-btn-strong">
            New offer
          </button>
        }
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {!settled
                ? "Offers"
                : rows.length === 0
                  ? "No offer yet"
                  : `${selling} of ${rows.length} ${rows.length === 1 ? "offer" : "offers"} selling`}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              Everything this brand sells. Each offer has its own missions, targeting and return.
            </p>
          </div>
          {settled && selling > 0 && (
            <span className="k-fg2 inline-flex items-center gap-1.5 text-[13px]">
              <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
              {selling} selling now
            </span>
          )}
        </div>

        <div className="mt-8">
          <SectionTitle count={settled ? rows.length : null} right={<span>Ordered by return</span>}>
            Offers
          </SectionTitle>
          <div className="k-card overflow-hidden">
            <div className="k-scroll overflow-x-auto">
              <table className="w-full table-fixed text-[13px] md:table-auto md:min-w-[760px]">
                <thead>
                  <tr className="border-b border-[var(--line-subtle)]">
                    <th className={`${TH} w-[68%] pl-4 md:w-auto`}>Offer</th>
                    <th className={`${TH} hidden md:table-cell`}>State</th>
                    <th className={`${TH} w-[32%] pr-4 text-right md:w-auto md:pr-3`}>ROI</th>
                    <th className={`${TH} hidden text-right md:table-cell`}>% CAC</th>
                    <th className={`${TH} hidden text-right md:table-cell`}>Revenue</th>
                    <th className={`${TH} hidden text-right md:table-cell`}>Invested</th>
                    <th className={`${TH} hidden w-10 pr-4 md:table-cell`} aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {!settled ? (
                    [0, 1, 2].map((i) => (
                      <tr key={i} className="k-row">
                        <td colSpan={7} className="px-4 py-3">
                          <Shimmer className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyNote>No offer yet. Add what this brand sells to start a mission for it.</EmptyNote>
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ offer, revenue, learning, paused, sold }, i) => {
                      const href = hrefFor(offer.offerId);
                      return (
                        <tr
                          key={offer.offerId}
                          className={`k-row group cursor-pointer ${cursor === i ? "k-selected" : ""}`}
                          onClick={() => router.push(href)}
                          onMouseEnter={() => prefetch(href)}
                          onFocus={() => prefetch(href)}
                        >
                          <td className="py-2.5 pl-4 pr-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <OfferMark size="md" imageUrl={offer.imageUrl} />
                              <span className="truncate font-medium">{offer.name}</span>
                            </div>
                          </td>
                          <td className="hidden px-3 md:table-cell">
                            {sold ? <StateDot running={!paused} /> : <span className="k-fg3 text-[12px]">No mission</span>}
                          </td>
                          <td className="pl-3 pr-4 text-right tabular-nums md:pr-3">
                            {learning ? (
                              <Withheld paused={paused} />
                            ) : revenue?.roiMultiple == null ? (
                              <Dash />
                            ) : (
                              <span className={`font-medium ${roiIsGood(revenue.roiMultiple) ? "text-[var(--data-teal)]" : ""}`}>
                                {formatRoi(revenue.roiMultiple)}
                              </span>
                            )}
                          </td>
                          <td className="hidden px-3 text-right tabular-nums md:table-cell">
                            {learning ? <Withheld paused={paused} /> : revenue?.costOfAcquisitionPct == null ? <Dash /> : pct(revenue.costOfAcquisitionPct)}
                          </td>
                          <td className="hidden px-3 text-right tabular-nums md:table-cell">
                            {revenue?.totalPipelineUsd == null ? <Dash /> : usd(revenue.totalPipelineUsd)}
                          </td>
                          <td className="hidden px-3 text-right tabular-nums md:table-cell">
                            {revenue?.committedCostUsd == null ? <Dash /> : usd(revenue.committedCostUsd)}
                          </td>
                          <td className="hidden py-2 pl-2 pr-4 text-right md:table-cell">
                            <span className="k-btn-ghost inline-flex h-6 w-6 justify-center p-0 opacity-0 group-hover:opacity-100" aria-hidden="true">
                              <svg width="12" height="12" viewBox="0 0 12 12">
                                <path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="k-fg3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
              <span>
                Revenue is expected pipeline, not money collected. Invested is net spend, billed plus reserved. ROI and % CAC read Learning until an offer&apos;s campaigns have ten outcomes.
              </span>
              <span className="ml-auto hidden items-center gap-1 md:inline-flex">
                <span className="k-kbd">J</span>
                <span className="k-kbd">K</span> move <span className="k-kbd ml-2">↵</span> open
              </span>
            </div>
          </div>
        </div>
      </div>
      {creating && <V2NewOfferModal brandId={brandId} orgId={orgId} onClose={() => setCreating(false)} />}
    </>
  );
}
