"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths } from "@/lib/api";
import { firstLaunchedPath } from "@/lib/v2/get-started";
import type { SalesPathRow } from "@/lib/offer-sales-paths";

/**
 * The sales path an offer RUNS: the same pick as the Sales path page's Active card, the
 * onboarding and campaign-service's global budget (best-ranked path a channel of ours
 * enters). Same query key as the Sales path page, so the sidebar, the campaign page and
 * that page share one read and always agree.
 */
export function useActiveSalesPath(brandId: string, offerId: string | null | undefined) {
  const q = useAuthQuery(["offerSalesPaths", brandId, offerId], () => getOfferSalesPaths(brandId, offerId as string), {
    enabled: !!brandId && !!offerId,
  });
  const active = useMemo<SalesPathRow | null>(() => firstLaunchedPath(q.data?.paths ?? []), [q.data]);
  return { active, data: q.data, settled: q.isFetchedAfterMount || q.data !== undefined, failed: q.isError && !q.data };
}
