"use client";

import { useMemo } from "react";
import { useBrandOutcomes } from "@/components/v2/data";
import { useOngoingCampaigns, type OngoingOutcome } from "@/components/v2/ongoing-campaigns";
import { outcomeOfBucket } from "@/lib/v2/outcomes";
import { reachedBuckets, stepStatOf, type OutcomeStepStat } from "@/lib/v2/outcome-people";

/** One outcome the brand has: what its ON campaigns land on, and what its own tools state, campaigns or not. */
export interface BrandOutcome extends OngoingOutcome {
  /** crm-service's count of this step over every source; null for a step it does not serve (Positive replies, Leads found). */
  all: OutcomeStepStat | null;
}

/**
 * EVERY outcome of the brand (owner 2026-10-11: « tous mes outcomes … même s'ils ne
 * viennent pas de campaigns distribute »): the steps the selected offer's ON campaigns
 * land on, in campaign order, then every step crm-service states people for that no
 * campaign produces, in its funnel order. One read for the sidebar and the Overview.
 */
export function useBrandOutcomeList(orgId: string, brandId: string, offerId: string | null) {
  const ongoing = useOngoingCampaigns(orgId, brandId, offerId);
  const allQ = useBrandOutcomes(brandId);
  const outcomes = useMemo<BrandOutcome[]>(() => {
    const out: BrandOutcome[] = ongoing.outcomes.map((o) => ({
      ...o,
      all: o.outcome.items.kind === "people" ? stepStatOf(allQ.data, o.outcome.items.bucket) : null,
    }));
    for (const bucket of reachedBuckets(allQ.data)) {
      const outcome = outcomeOfBucket(bucket);
      if (!outcome) {
        console.error("[v2] crm-service serves an outcome step no outcome maps to", { bucket });
        continue;
      }
      if (out.some((o) => o.outcome.key === outcome.key)) continue;
      out.push({ outcome, campaigns: [], funnelCampaigns: [], all: stepStatOf(allQ.data, bucket) });
    }
    return out;
  }, [ongoing.outcomes, allQ.data]);
  // Settled once the campaigns AND the all-sources read have answered (a failed read settles too).
  const settled = ongoing.settled && (allQ.data !== undefined || allQ.isError);
  return { outcomes, settled, allError: allQ.isError && !allQ.data };
}
