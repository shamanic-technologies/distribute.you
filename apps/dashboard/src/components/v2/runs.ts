"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { getBrandRunsByCampaign } from "@/lib/api";
import type { V2Campaign } from "@/components/v2/use-campaigns";

export { foldSteps, runTaskLabel } from "@/lib/v2/run-labels";

/**
 * runs-service, read the way Keel reads its agents. Every figure is served per campaign;
 * the only step here is keeping the groups of the brand's campaigns (a display join), and
 * adding counts that are disjoint by construction (a run belongs to exactly one campaign).
 */

/** Local midnight, `daysAgo` days back, as an ISO instant. */
export function localDayStart(daysAgo = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return d.toISOString();
}

export function useRunsToday(brandId: string) {
  const start = localDayStart(0);
  return useAuthQuery(
    ["v2RunsByCampaign", brandId, start],
    () => getBrandRunsByCampaign(brandId, { startedAfter: start }),
    { enabled: !!brandId, refetchInterval: POLL_INTERVAL },
  );
}

/** Runs finished today by the campaigns in `campaignById` (the selected offer's). */
export function useCampaignRunsToday(
  brandId: string,
  campaignById: Map<string, V2Campaign>,
): { runsToday: number; settled: boolean } {
  const today = useRunsToday(brandId);
  const runsToday = useMemo(() => {
    let n = 0;
    for (const g of today.data ?? []) if (g.campaignId && campaignById.has(g.campaignId)) n += g.runCount;
    return n;
  }, [today.data, campaignById]);
  return { runsToday, settled: today.data !== undefined || today.isError };
}
