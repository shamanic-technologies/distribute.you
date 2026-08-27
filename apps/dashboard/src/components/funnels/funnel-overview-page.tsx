"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getOfferFunnels } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { formatRoi } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import {
  funnelViews,
  costCoverageNote,
  unpricedFunnelReasonLabel,
} from "@/lib/offer-funnels";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";

const INVESTED_TIP =
  "What this funnel has cost all in: what we charged you, plus what you recorded for the steps your own team worked. The second half is never billed; it is here because a funnel you finish yourself would otherwise look cheaper than it is.";

function fmtUsd(value: number | null): string {
  return value === null ? "—" : formatUsdAdaptive(value);
}

function StatCard({
  label,
  value,
  pending,
  tip,
}: {
  label: string;
  value: string;
  pending: boolean;
  tip?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1">
        {label}
        {tip && <InfoTooltip tip={tip} />}
      </p>
      {pending ? (
        <Skeleton className="h-7 w-20 rounded mt-1.5" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      )}
    </div>
  );
}

/**
 * ONE sales funnel: what it returned, and what it cost.
 *
 * The funnel is the finest scope whose money divides into a RETURN — a campaign buys
 * one LEG of it, so a campaign has a cost per step and nothing to divide. Every figure
 * is the row features-service already serves for this funnel; nothing here divides.
 */
export function FunnelOverviewPage() {
  const params = useParams<{ brandId: string; offerId: string; funnelKey: string }>();
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const funnelKey = params?.funnelKey ? decodeURIComponent(params.funnelKey) : "";

  // The offer's funnels, on the key its own list already polls, so opening one costs
  // no request. There is no per-funnel read: the row IS the answer.
  const funnels = useAuthQuery(
    ["offerFunnels", brandId, offerId],
    () => getOfferFunnels(offerId, brandId),
    { enabled: Boolean(brandId && offerId), ...pollOptions },
  );

  const row = useMemo(() => {
    const wanted = funnelKey ? normalizeSalesFunnelKey(funnelKey as SalesFunnelKeyWire) : null;
    if (!wanted) return null;
    return (
      funnelViews(funnels.data?.funnels ?? []).find(
        (r) => normalizeSalesFunnelKey(r.funnelKey as SalesFunnelKeyWire) === wanted,
      ) ?? null
    );
  }, [funnels.data, funnelKey]);

  const def = funnelKey ? campaignFunnel(funnelKey as SalesFunnelKeyWire) : null;
  const coverage = costCoverageNote(row?.coverage);
  const pending = funnels.isPending && !funnels.isError;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        {def && <SalesFunnelMark def={def} size="md" />}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">
            {row?.name ?? def?.name ?? funnelKey}
          </h1>
          {def && <p className="mt-0.5 text-sm text-gray-500">{def.steps.join("  →  ")}</p>}
        </div>
      </header>

      {!pending && !row ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          {funnels.isError
            ? "Couldn’t read this offer’s sales funnels."
            : "This offer does not sell through this funnel."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="ROI" value={formatRoi(row?.roiMultiple ?? null)} pending={pending} />
            <StatCard
              label="$ CAC"
              value={fmtUsd(row?.costPerAcquisitionUsd ?? null)}
              pending={pending}
            />
            <StatCard
              label="$ Revenue"
              value={fmtUsd(row?.pipelineUsd ?? null)}
              pending={pending}
            />
            <StatCard
              label="$ Invested"
              value={fmtUsd(row?.investedUsd ?? null)}
              pending={pending}
              tip={INVESTED_TIP}
            />
          </div>

          {row && !row.priced && (
            <p className="text-sm text-gray-500">
              {unpricedFunnelReasonLabel(row.unpricedReason)}. The spend above is real:
              you paid it.
            </p>
          )}

          {row && row.customerCostUsd !== null && row.customerCostUsd > 0 && (
            <p className="text-sm text-gray-600">
              {fmtUsd(row.platformCostUsd)} of that is what we charged you, and{" "}
              {fmtUsd(row.customerCostUsd)} is what you recorded for the steps your own
              team worked.
            </p>
          )}

          {coverage && <p className="text-xs text-gray-500 max-w-3xl">{coverage}</p>}
        </>
      )}
    </div>
  );
}
