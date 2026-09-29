"use client";

import { useMemo } from "react";
import { getBrandSpendableBudget, listCampaignsByBrand } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { splitDailyBudget } from "@/lib/v2/budget-split";

/**
 * The brand's running daily budget SPLIT by how its crews work: what daily crews may
 * spend today, and the caps of event crews (a leg that starts from a step, like
 * booking a meeting off a positive reply), which spend only when that step is reached.
 * The top bar and Crew state the first; the second is stated beside it, never added.
 *
 * Both are `null` until the served budget, the campaigns and the leg catalogue are in.
 */
export function useDailyBudgetSplit(
  brandId: string,
  { enabled = true }: { enabled?: boolean } = {},
): { dailyCents: number | null; eventCapCents: number | null; settled: boolean } {
  const spendableQ = useAuthQuery(
    ["brandSpendableBudget", brandId],
    () => getBrandSpendableBudget(brandId),
    { enabled },
  );
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), {
    enabled: enabled && !!brandId,
  });
  const catalogue = useLegCatalogue();

  const split = useMemo(() => {
    if (!spendableQ.data || !campaignsQ.data || catalogue.legs.size === 0) return null;
    const legKeyById = new Map<string, string | null>();
    for (const c of campaignsQ.data.campaigns) legKeyById.set(c.id, c.legKey ?? null);
    return splitDailyBudget(spendableQ.data, (id) => {
      const leg = legFor(catalogue, legKeyById.get(id) ?? null);
      return leg !== null && leg.fromKey !== null;
    });
  }, [spendableQ.data, campaignsQ.data, catalogue]);

  return {
    dailyCents: split?.dailyCents ?? null,
    eventCapCents: split?.eventCapCents ?? null,
    settled: split !== null || spendableQ.isError || campaignsQ.isError,
  };
}
