"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getFeatureRevenueByCampaign, listCampaignsByBrand } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { formatMultiple } from "@/lib/realized-return-words";

/**
 * Top-3 campaigns by REALIZED return for the feature Overview — replaces the
 * brand-wide "Top cost sources" list in the cost/efficiency column.
 *
 * Ranking: running campaigns (status !== "stopped") first, by realized return desc;
 * if fewer than 3 running, stopped campaigns fill the remaining slots. Capped at 3.
 *
 * Realized return = revenue of the Paid clients our outreach caused ÷ money actually
 * spent, per campaign, served by features-service (`costEconomics.realizedReturn` on
 * `/revenue?groupBy=campaignId`, ROI-CONSISTENCY-1103). The pipeline-based ROI is
 * retired. A campaign with no runs is absent from the groups → "—", sorted last.
 */
type CampaignRow = {
  id: string;
  name: string;
  running: boolean;
  roi: number | null;
};

function formatRoi(roi: number | null): string {
  return roi == null ? "—" : formatMultiple(roi);
}

// ROI desc; null ROI sorts last (no usable pipeline/cost yet).
function byRoiDesc(a: CampaignRow, b: CampaignRow): number {
  if (a.roi == null && b.roi == null) return 0;
  if (a.roi == null) return 1;
  if (b.roi == null) return -1;
  return b.roi - a.roi;
}

export function TopCampaignsCard({
  brandId,
  featureSlug,
  basePath,
}: {
  brandId: string;
  featureSlug: string;
  /** /orgs/:orgId/brands/:brandId/features/:slug — for the per-campaign link. */
  basePath: string;
}) {
  // Per-campaign ROI (one call) + the campaign list for names + status. Both poll
  // so the ROI + status stay live while a campaign spends (matches the Overview's
  // other live cards).
  const { data: revenueGroups } = useAuthQuery(
    ["featureRevenueByCampaign", brandId, featureSlug],
    () => getFeatureRevenueByCampaign(featureSlug, brandId),
    { ...pollOptionsSlow },
  );
  const { data: campaignsData } = useAuthQuery(
    ["campaignsByBrand", brandId],
    () => listCampaignsByBrand(brandId),
    { ...pollOptions },
  );

  const pending = revenueGroups === undefined || campaignsData === undefined;

  const top3 = useMemo<CampaignRow[]>(() => {
    if (!revenueGroups || !campaignsData) return [];
    const roiById = new Map(revenueGroups.map((g) => [g.campaignId, g.realizedReturn?.roiMultiple ?? null]));
    const rows: CampaignRow[] = campaignsData.campaigns
      .filter((c) => c.featureSlug === featureSlug)
      .map((c) => ({
        id: c.id,
        name: c.name,
        running: c.status !== "stopped",
        roi: roiById.get(c.id) ?? null,
      }));
    const running = rows.filter((r) => r.running).sort(byRoiDesc);
    const stopped = rows.filter((r) => !r.running).sort(byRoiDesc);
    // Running first (ROI desc), then stopped (ROI desc) fill the remaining slots.
    return [...running, ...stopped].slice(0, 3);
  }, [revenueGroups, campaignsData, featureSlug]);

  // Static shell: card frame + title paint immediately; only the rows wait.
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top campaigns by realized return</p>
      {pending ? (
        [0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))
      ) : top3.length > 0 ? (
        top3.map((c) => (
          <Link
            key={c.id}
            href={`${basePath}/campaigns/${c.id}`}
            className="group flex items-center gap-2"
          >
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${c.running ? "bg-green-500" : "bg-gray-300"}`}
              title={c.running ? "Running" : "Stopped"}
            />
            <span className="flex-1 truncate text-sm text-gray-700 group-hover:text-brand-600">
              {c.name}
            </span>
            <span className="text-sm font-medium text-gray-800 tabular-nums">{formatRoi(c.roi)}</span>
          </Link>
        ))
      ) : (
        <p className="text-sm text-gray-400">No campaigns yet.</p>
      )}
    </div>
  );
}
