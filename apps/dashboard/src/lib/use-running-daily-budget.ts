"use client";

import { useMemo } from "react";
import { getBrandFunnelBudgets, listCampaignsByBrand } from "@/lib/api";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useAuthQuery } from "@/lib/use-auth-query";
import { buildControlRows, scopeTotalCents } from "@/lib/campaign-controls";

/**
 * What a brand (or one of its offers) may spend TODAY, in cents.
 *
 * The question is a JOIN and neither producer can answer it: billing keys a
 * ceiling on (funnel x channel x offer) and stores no status, campaign-service
 * stores the status and no money. billing's served brand total is therefore
 * status-BLIND — a brand running one campaign at $50 beside one paused at $10
 * answers $60 — and every surface that divided by it, or projected a month from
 * it, inherited the overstatement.
 *
 * It costs no network: both query keys are the ones the page's own controls
 * trigger already polls, so React Query dedupes them to one request each. That
 * is also what makes it safe for the figure to live in more than one place —
 * every reader is looking at the same rows through the same `scopeTotalCents`.
 *
 * `cents` is `null` while either read is still in flight or has failed. It is
 * deliberately NOT zero: "we could not measure this" and "this brand spends
 * nothing" are different statements, and callers already render a dash for the
 * first. `settled` reveals on SETTLE (resolved OR errored), so a failed read
 * shows that dash instead of an eternal skeleton.
 */
export function useRunningDailyBudgetCents(
  brandId: string,
  { offerId, enabled = true }: { offerId?: string; enabled?: boolean } = {},
): { cents: number | null; settled: boolean } {
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), {
    enabled,
  });
  const budgetsQ = useAuthQuery(
    ["brandFunnelBudgets", brandId],
    () => getBrandFunnelBudgets(brandId),
    { enabled },
  );

  const channels = useAcquisitionChannels();
  const cents = useMemo(() => {
    if (campaignsQ.data === undefined || budgetsQ.data === undefined) return null;
    const rows = buildControlRows(campaignsQ.data.campaigns, budgetsQ.data, channels, { offerId });
    return scopeTotalCents(rows);
  }, [campaignsQ.data, budgetsQ.data, channels, offerId]);

  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError);

  return { cents, settled };
}
