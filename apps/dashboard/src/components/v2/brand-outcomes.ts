"use client";

import { useMemo } from "react";
import { useBrandOutcomes } from "@/components/v2/data";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getAudienceSnapshot, getPublicCatalogueSteps } from "@/lib/api";
import { useStaffMode } from "@/lib/use-staff-mode";
import { useOngoingCampaigns, type OngoingOutcome } from "@/components/v2/ongoing-campaigns";
import { byDepth, outcomeOfBucket } from "@/lib/v2/outcomes";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { reachedBuckets, stepStatOf, type OutcomeStepStat } from "@/lib/v2/outcome-people";

/** One outcome the brand has: what its ON campaigns land on, and what its own tools state, campaigns or not. */
export interface BrandOutcome extends OngoingOutcome {
  /** crm-service's count of this step over every source; null for a step it does not serve (Positive replies, Leads). */
  all: OutcomeStepStat | null;
}

/**
 * EVERY outcome of the brand (owner 2026-10-11: « tous mes outcomes … même s'ils ne
 * viennent pas de campaigns distribute »): the steps the selected offer's ON campaigns
 * land on, plus every step crm-service states people for that no campaign produces,
 * most advanced first (Paid clients down to Leads, owner 2026-10-12). One read
 * for the sidebar and the Overview.
 */
export function useBrandOutcomeList(orgId: string, brandId: string, offerId: string | null) {
  const ongoing = useOngoingCampaigns(orgId, brandId, offerId);
  const allQ = useBrandOutcomes(brandId);
  const catalogue = useLegCatalogue();
  const outcomes = useMemo<BrandOutcome[]>(() => {
    const out: BrandOutcome[] = ongoing.outcomes.map((o) => ({
      ...o,
      all: o.outcome.items.kind === "people" ? stepStatOf(allQ.data, o.outcome.items.bucket) : null,
    }));
    for (const bucket of reachedBuckets(allQ.data)) {
      const outcome = outcomeOfBucket(catalogue, bucket);
      if (!outcome) {
        console.error("[v2] crm-service serves an outcome step no outcome maps to", { bucket });
        continue;
      }
      if (out.some((o) => o.outcome.key === outcome.key)) continue;
      out.push({ outcome, campaigns: [], funnelCampaigns: [], all: stepStatOf(allQ.data, bucket) });
    }
    return byDepth(out);
  }, [ongoing.outcomes, allQ.data, catalogue]);
  // Settled once the campaigns AND the all-sources read have answered (a failed read settles too).
  const settled = ongoing.settled && (allQ.data !== undefined || allQ.isError);
  return { outcomes, settled, allError: allQ.isError && !allQ.data };
}

/**
 * Each step's Phosphor icon, keyed by step key, as the catalogue serves it (the icon the staff
 * Steps section shows): the sidebar's Outcomes entries wear it (owner 2026-10-11). Public read,
 * it changes when somebody edits a step, so a long stale time.
 */
export function useStepIcons(): Map<string, string> | undefined {
  const q = useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps, { staleTime: 10 * 60_000 });
  return useMemo(() => (q.data ? new Map(q.data.map((s) => [s.key, s.icon] as const)) : undefined), [q.data]);
}

/**
 * The brand's list snapshot (lists, people and companies held), one query key for the
 * Leads found page and its sidebar entry, so the entry's count is the page's People tab
 * (owner 2026-10-11: « leads found n'affiche pas de nombre »). `enabled` lets the sidebar
 * skip the read when no Leads found entry is listed.
 */
export function useAudienceSnapshot(brandId: string, enabled = true) {
  const { staffMode: staff } = useStaffMode();
  return useAuthQuery(["staffAudienceSnapshot", brandId, staff], () => getAudienceSnapshot(brandId, staff), { enabled });
}
