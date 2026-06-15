"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  fetchFeatureStats,
  getFeatureRevenueByCampaign,
  getFeatureOutcomes,
  listCampaignsByBrand,
} from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";

/**
 * Two "Top 3 campaigns by lowest cost" leaderboards for the Signups page — the
 * cost-efficiency counterpart to the brand Overview's ROI leaderboard.
 *
 *  - Best CPC (real): cost ÷ link clicks, per campaign, from ONE feature-stats
 *    call (`/stats?groupBy=campaignId`). Pure measured outreach data.
 *  - Best cost-per-signup (expected): features-service-computed
 *    `costPerConversionUsd` for the `signups` lens, per campaign. No grouped lens
 *    endpoint exists yet, so this fans out one lensed `/revenue?campaignId=` call
 *    per campaign-with-runs — features-service still computes each number (no
 *    client-side math). Follow-up: add `lens` to `?groupBy=campaignId` for a
 *    single call.
 *
 * Both rank ascending (lowest cost = best); a campaign with no clicks / no
 * expected signups has no defined cost → "—", sorted last. Capped at 3.
 */

type CostRow = {
  id: string;
  name: string;
  running: boolean;
  /** Cost in USD — lower is better. Null when undefined (no denominator). */
  costUsd: number | null;
};

function formatUsd(cost: number | null): string {
  if (cost == null) return "—";
  return `$${cost.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

// Lowest cost first; null sorts last (no usable denominator yet).
function byCostAsc(a: CostRow, b: CostRow): number {
  if (a.costUsd == null && b.costUsd == null) return 0;
  if (a.costUsd == null) return 1;
  if (b.costUsd == null) return -1;
  return a.costUsd - b.costUsd;
}

function CostLeaderboard({
  title,
  rows,
  pending,
  basePath,
}: {
  title: string;
  rows: CostRow[];
  pending: boolean;
  basePath: string;
}) {
  const top3 = useMemo(() => [...rows].sort(byCostAsc).slice(0, 3), [rows]);
  // Static shell: card frame + title paint immediately; only the rows wait.
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</p>
      {pending ? (
        [0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
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
            <span className="text-sm font-medium text-gray-800 tabular-nums">{formatUsd(c.costUsd)}</span>
          </Link>
        ))
      ) : (
        <p className="text-sm text-gray-400">No campaigns yet.</p>
      )}
    </div>
  );
}

/** Top 3 campaigns by lowest real cost-per-click. */
export function TopCampaignsByCpcCard({
  brandId,
  featureSlug,
  basePath,
}: {
  brandId: string;
  featureSlug: string;
  basePath: string;
}) {
  const { data: statsData } = useAuthQuery(
    ["featureStatsByCampaign", featureSlug, brandId],
    () => fetchFeatureStats(featureSlug, { brandId, groupBy: "campaignId" }),
    { ...pollOptionsSlow },
  );
  const { data: campaignsData } = useAuthQuery(
    ["campaignsByBrand", brandId],
    () => listCampaignsByBrand(brandId),
    { ...pollOptions },
  );

  const pending = statsData === undefined || campaignsData === undefined;

  const rows = useMemo<CostRow[]>(() => {
    if (!statsData || !campaignsData) return [];
    // Per-campaign CPC computed by features-service (derived stat
    // `costPerRecipientClickCents` = total run cost ÷ link clicks). The dashboard
    // only reads + formats — no client-side math. Absent (no clicks) → null.
    const cpcById = new Map<string, number | null>();
    for (const g of statsData.groups ?? []) {
      if (!g.campaignId) continue;
      const cents = g.stats.costPerRecipientClickCents;
      cpcById.set(g.campaignId, cents == null ? null : cents / 100);
    }
    return campaignsData.campaigns
      .filter((c) => c.featureSlug === featureSlug)
      .map((c) => ({
        id: c.id,
        name: c.name,
        running: c.status !== "stopped",
        costUsd: cpcById.get(c.id) ?? null,
      }));
  }, [statsData, campaignsData, featureSlug]);

  return <CostLeaderboard title="Top campaigns by CPC" rows={rows} pending={pending} basePath={basePath} />;
}

/**
 * Top 3 campaigns by lowest expected cost-per-signup. Fans out one lensed
 * `/revenue?campaignId=&lens=signups` call per campaign-with-runs (features-service
 * computes `costPerConversionUsd` for each — no client math).
 */
export function TopCampaignsByCostPerSignupCard({
  brandId,
  featureSlug,
  basePath,
}: {
  brandId: string;
  featureSlug: string;
  basePath: string;
}) {
  // Campaigns WITH runs (the lens fan-out targets) — one call.
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

  const campaignIdsWithRuns = useMemo(
    () => (revenueGroups ?? []).map((g) => g.campaignId).sort(),
    [revenueGroups],
  );

  // Per-campaign expected cost-per-signup. Fan-out runs only once the id list is
  // known; the key carries the ids so it refetches when campaigns change.
  const { data: cpsData } = useAuthQuery(
    ["campaignCostPerSignup", brandId, featureSlug, campaignIdsWithRuns.join(",")],
    async () => {
      const entries = await Promise.all(
        campaignIdsWithRuns.map(async (campaignId) => {
          const ov = await getFeatureOutcomes(featureSlug, brandId, "signups", campaignId);
          return [campaignId, ov.costEconomics.costPerConversionUsd ?? null] as const;
        }),
      );
      return new Map<string, number | null>(entries);
    },
    { enabled: campaignIdsWithRuns.length > 0, ...pollOptionsSlow },
  );

  const pending =
    revenueGroups === undefined ||
    campaignsData === undefined ||
    (campaignIdsWithRuns.length > 0 && cpsData === undefined);

  const rows = useMemo<CostRow[]>(() => {
    if (!campaignsData) return [];
    const cpsById = cpsData ?? new Map<string, number | null>();
    return campaignsData.campaigns
      .filter((c) => c.featureSlug === featureSlug)
      .map((c) => ({
        id: c.id,
        name: c.name,
        running: c.status !== "stopped",
        costUsd: cpsById.get(c.id) ?? null,
      }));
  }, [campaignsData, cpsData, featureSlug]);

  return (
    <CostLeaderboard
      title="Top campaigns by cost per signup"
      rows={rows}
      pending={pending}
      basePath={basePath}
    />
  );
}
