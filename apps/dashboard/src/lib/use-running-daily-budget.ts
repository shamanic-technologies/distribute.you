"use client";

import { getBrandSpendableBudget } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";

/**
 * What a brand (or one of its offers) may spend TODAY, in cents.
 *
 * The question is a JOIN and neither producer can answer it alone: billing keys a
 * ceiling on (funnel x channel x offer) and stores no status, campaign-service
 * stores the status and no money. billing's served brand total is therefore
 * status-BLIND — a brand running one campaign at $50 beside one paused at $10
 * answers $60 — and every surface that divided by it, or projected a month from
 * it, inherited the overstatement.
 *
 * This used to make that join HERE, in the browser, from the campaign list and the
 * per-funnel budgets. campaign-service serves the answer now (both figures, plus
 * the per-offer and per-campaign decompositions), so the money on screen is a
 * served field rather than a client-computed stat — and the staff console, which
 * could not reach a browser-side join at all, reads the same number.
 *
 * `cents` is `null` while the read is in flight or has failed. It is deliberately
 * NOT zero: "we could not measure this" and "this brand spends nothing" are
 * different statements, and callers already render a dash for the first.
 * `settled` reveals on SETTLE (resolved OR errored), so a failed read shows that
 * dash instead of an eternal skeleton.
 */
export function useRunningDailyBudgetCents(
  brandId: string,
  {
    offerId,
    campaignId,
    enabled = true,
  }: { offerId?: string; campaignId?: string; enabled?: boolean } = {},
): { cents: number | null; settled: boolean } {
  const spendableQ = useAuthQuery(
    ["brandSpendableBudget", brandId],
    () => getBrandSpendableBudget(brandId),
    { enabled },
  );

  const data = spendableQ.data;
  // Narrowing to one offer is a SELECTION over rows the producer already totalled,
  // never a sum of our own: the offer carries its own running figure. An offer this
  // brand does not sell reads 0 — it funds nothing here — which is what the brand's
  // own rows would say about it.
  // Narrowing to one campaign is the same SELECTION one grain finer: the producer
  // decomposes its answer by campaign as well as by offer, so a surface scoped to one
  // campaign reads that campaign's own running figure rather than its brand's sum. A
  // campaign absent from the answer reads 0 — it is not among the ones running.
  const cents =
    data === undefined
      ? null
      : campaignId
        ? (data.campaigns.find((c) => c.campaignId === campaignId)
            ?.runningDailyBudgetCents ?? 0)
        : offerId
          ? (data.offers.find((o) => o.offerId === offerId)?.runningDailyBudgetCents ?? 0)
          : data.runningDailyBudgetCents;

  const settled = data !== undefined || spendableQ.isError;

  return { cents, settled };
}
