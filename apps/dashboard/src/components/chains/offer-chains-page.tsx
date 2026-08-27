"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOfferChains } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { formatRoi } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import {
  chainViews,
  costCoverageNote,
  summariseChains,
  unpricedChainReasonLabel,
} from "@/lib/offer-chains";

const COLUMN_COUNT = 6;

const CHAIN_TIP =
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
 * The grain between the offer and its campaigns. A campaign buys one LEG of a chain, so
 * it has a cost per step and no return of its own; the chain is where a return exists.
 *
 * Every figure is a served field. The rows deliberately do NOT sum to the offer: money
 * adds across chains but people do not (a lead worked through two chains is one lead)
 * and no ratio does, so the offer's own Overview stays the number to trust for "what did
 * this offer do".
 */
export function OfferChainsPage() {
  const params = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;

  const chains = useAuthQuery(
    ["offerChains", brandId, offerId],
    () => getOfferChains(offerId, brandId),
    { enabled: Boolean(brandId && offerId), ...pollOptions },
  );

  const rows = useMemo(() => chainViews(chains.data?.chains ?? []), [chains.data]);
  const summary = useMemo(() => summariseChains(rows), [rows]);
  const coverage = costCoverageNote(chains.data?.costCoverage);

  // Reveal on SETTLE: a read that errors falls through to a stated empty table rather
  // than holding the page in a skeleton forever.
  const pending = chains.isPending && !chains.isError;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-1.5">
          Sales funnels
          <InfoTooltip tip={CHAIN_TIP} />
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full md:min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">Funnel</th>
              <th className="px-4 py-2 font-medium text-right">ROI</th>
              <th className="px-4 py-2 font-medium text-right">% CAC</th>
              <th className="px-4 py-2 font-medium text-right">$ CAC</th>
              <th className="px-4 py-2 font-medium text-right">$ Revenue</th>
              <th className="px-4 py-2 font-medium text-right">$ Invested</th>
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
                  {chains.isError
                    ? "Couldn&apos;t read this offer&apos;s sales funnels."
                    : "This offer sells through no sales funnel yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.funnelKey} className="border-b border-gray-50 align-top">
                  <td className="px-4 py-3">
                    {/* The way DOWN: a chain is carried by campaigns, one per leg as
                        the product moves, and this is how a reader walks to them. A
                        query narrowing rather than a route of its own — the campaigns
                        live under the offer and re-homing them under a funnel segment
                        would break every link that already points at one. */}
                    <Link
                      href={`${basePath}/campaigns?funnel=${encodeURIComponent(row.funnelKey)}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{row.steps.join("  →  ")}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {row.campaignCount} campaign{row.campaignCount === 1 ? "" : "s"}
                      {row.channelNames.length > 0 && ` · ${row.channelNames.join(", ")}`}
                    </p>
                    {!row.priced && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {unpricedChainReasonLabel(row.unpricedReason)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                    {formatRoi(row.roiMultiple)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtPct(row.costOfAcquisitionPct)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtUsd(row.costPerAcquisitionUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtUsd(row.pipelineUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtUsd(row.investedUsd)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {coverage && <p className="text-xs text-gray-500 max-w-3xl">{coverage}</p>}

      <p className="text-xs text-gray-400 max-w-3xl">
        These rows do not add up to the offer, on purpose. Money adds across funnels, but a
        person worked through two of them is one person to the offer and sits in both rows,
        and no rate is the sum of two rates. Your offer Overview is the number to read for
        what the offer as a whole did.
      </p>
    </div>
  );
}
