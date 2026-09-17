"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrandRewardTasks, type BrandRewardTasks } from "@/lib/api";

/**
 * The brand's reward-task ledger, on ONE key every surface shares.
 *
 * One read per brand answers the funnel band, the per-offer due count and the
 * badge on the top-bar pill, so drilling from a brand into an offer into a
 * funnel costs no further request and the three can never state different counts
 * for one brand. A per-funnel read would be one request per row on a brand that
 * sells through several.
 *
 * The root is allowlisted in `PERSISTABLE_QUERY_ROOTS`, so it paints from disk
 * on the first frame rather than cold-fetching on every visit.
 */
export function useBrandRewardTasks(brandId: string | null | undefined) {
  return useAuthQuery<BrandRewardTasks>(
    ["rewardTasks", brandId ?? "none"],
    () => getBrandRewardTasks(brandId!),
    { enabled: !!brandId },
  );
}
