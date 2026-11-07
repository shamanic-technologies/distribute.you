"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getBrandOutcomes,
  getBrandDisqualifications,
  getBrandRevenue,
  getBrandRevenueWindow,
  getAwaitingReply,
  getReachedCounts,
  getLeadDetail,
  getLeadHistory,
  getOrgUsage,
  getUniboxLifecycleCounts,
  getBrandCompanyLifecycle,
  keepLastGoodFeatureRevenue,
  type AwaitingReplyPerson,
  type LeadScope,
} from "@/lib/api";
import { useBrandScope } from "@/components/v2/brand-scope";
import type { RevenueOverview } from "@/lib/revenue-view";
import type { LeadHistoryEvent } from "@/lib/lead-history";
import { pollOptions, pollIntervalFor } from "@/lib/query-options";
import type { RevenueWindowDays } from "@/lib/revenue-window";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { filtersKey, type UniboxFilters } from "@/lib/unibox-leads";
import { getBrandCampaignTargets, getCampaignTargetRow } from "@/lib/api";

/**
 * The reads every v2 page shares. Each is about the BRAND (owner 2026-11-07,
 * AUDIENCE-PER-OFFER-1107: Offers are a list, never a top-level pick): money through
 * features-service's brand grain, leads through lead-service's brand scope. The keys keep
 * v1's prefixes, so a prefix invalidation of the brand still reaches them. Nothing here
 * derives a metric.
 */

/** v1's lead scope key for a brand (`engaged-leads-page.tsx`). */
export const brandLeadScopeKey = (brandId: string) => `brand:${brandId}`;

/** The lead scope every v2 people read sends: the whole brand, every offer. */
export function useLeadScope(brandId: string): { scope: LeadScope; key: string; ready: boolean } {
  return { scope: { brandId }, key: brandLeadScopeKey(brandId), ready: !!brandId };
}

export function useBrandInfo(brandId: string) {
  return useAuthQuery(["brand", brandId], () => getBrand(brandId), pollOptions);
}

/**
 * The brand's money (features-service's brand grain, every offer and channel, net). Not asked
 * while the brand has no campaign: there is no money yet, and pages show their no-data state.
 */
export function useBrandRevenue(brandId: string) {
  const { campaignIds, scopeSettled } = useBrandScope();
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug) && !!brandId && (campaignIds?.length ?? 0) > 0;
  const q = useAuthQuery(["brandRevenue", brandId, "brand"], () => getBrandRevenue(brandId), {
    enabled,
    ...pollOptions,
    structuralSharing: (prev, next) =>
      keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
  });
  // Reveal on SETTLE: a failed read shows its dashes, never an eternal skeleton. While the
  // campaigns load, `enabled` is false for want of data: that is pending too, or every reload
  // flashes the page's no-data note.
  return { ...q, enabled, pending: enabled ? q.data === undefined && !q.isError : !scopeSettled };
}

/**
 * Today's Target rows (LEAD-GENERIC-1106): one per ongoing campaign of the brand, on its Target,
 * served by features-service.
 */
export function useCampaignTargets(brandId: string) {
  const q = useAuthQuery(["campaignTargets", brandId], () => getBrandCampaignTargets(brandId), pollOptions);
  return { ...q, answered: q.data !== undefined || (q.isFetchedAfterMount && q.isError) };
}

/** One campaign's row with its milestone cards (campaign page), served by features-service. */
export function useCampaignTargetRow(brandId: string, salesFunnelCampaignId: string) {
  const q = useAuthQuery(["campaignTargets", brandId, salesFunnelCampaignId], () => getCampaignTargetRow(brandId, salesFunnelCampaignId), pollOptions);
  return { ...q, answered: q.data !== undefined || (q.isFetchedAfterMount && q.isError) };
}

/** Today's stat row over the last `days` UTC days, the brand read's `window` block, same gate as `useBrandRevenue`. */
export function useBrandRevenueWindow(brandId: string, days: RevenueWindowDays) {
  const featureSlug = useSoleFeatureSlug();
  const { campaignIds, scopeSettled } = useBrandScope();
  const enabled = isRevenueFeature(featureSlug) && !!brandId && (campaignIds?.length ?? 0) > 0;
  const q = useAuthQuery(["brandRevenueWindow", brandId, "brand", days], () => getBrandRevenueWindow(brandId, days), {
    enabled,
    ...pollOptions,
  });
  return { ...q, pending: enabled ? q.data === undefined && !q.isError : !scopeSettled };
}

/**
 * Everything the org has been billed, every brand and every kind of work (setting up a
 * brand, finding contacts, writing, replies), net. features-service serves the total
 * billing debits; the Billing page's Usage section reads the same key.
 */
export function useOrgUsage() {
  const q = useAuthQuery(["orgUsage"], () => getOrgUsage(), pollOptions);
  return { ...q, pending: q.data === undefined && !q.isError };
}

/** Every outcome of the brand from any source its own tools state (crm-service), campaigns or not. */
export function useBrandOutcomes(brandId: string) {
  return useAuthQuery(["brandOutcomes", brandId], () => getBrandOutcomes(brandId), { ...pollOptions, enabled: !!brandId });
}

/**
 * How many people of the brand (one campaign when named) REACHED each step, by catalogue step key:
 * lead-service's Unibox `total` filtered on `reachedStep` (LEAD-REACHED-STEP-1106), the same rows
 * the outcome's people list shows, so a count and its list agree.
 */
export function useReachedCounts(brandId: string, steps: readonly string[], campaignId: string | null = null) {
  const list = [...new Set(steps)].sort();
  const scope = campaignId ? { campaignId } : {};
  return useAuthQuery(
    ["reachedCounts", brandId, "", campaignId ?? "", list.join(",")],
    () => getReachedCounts(brandId, list, scope),
    { ...pollOptions, enabled: !!brandId && list.length > 0 },
  );
}

/**
 * How many of the brand's people stand on each lifecycle rung (lead-service), one campaign when
 * named: the Deals board's column sizes and the sidebar's Deals count read the SAME key, so the two
 * agree. Filters narrow the counts exactly as they narrow the cards.
 */
export function useDealsLifecycleCounts(brandId: string, campaignId: string | null = null, filters: UniboxFilters = {}) {
  return useAuthQuery(
    ["dealsLifecycleCounts", brandId, "", campaignId ?? "", filtersKey(filters)],
    () => getUniboxLifecycleCounts(brandId, filters, { campaignId }),
    { ...pollOptions, enabled: !!brandId },
  );
}

/**
 * Each company's lifecycle rung (features-service), and the companies per rung: the Companies
 * page's tabs and Stage column, the company page's stage. Read at the BRAND grain (v0.179.548):
 * every offer of the brand, each company once.
 */
export function useCompanyLifecycle(brandId: string) {
  return useAuthQuery(["companyLifecycle", brandId, "brand"], () => getBrandCompanyLifecycle(brandId), {
    ...pollOptions,
    enabled: !!brandId,
  });
}

/**
 * The people marked Disqualified at the brand (any offer's mark or a brand-wide one), with their
 * notes: lead-service's list, its `total` the length of the same list.
 */
export function useLeadDisqualifications(brandId: string) {
  return useAuthQuery(
    ["leadDisqualifications", brandId, null],
    () => getBrandDisqualifications({ brandId }),
    { ...pollOptions, enabled: !!brandId },
  );
}

/**
 * NEEDS YOUR CALL (owner 2026-10-11): ONLY the people who wrote back and are waiting on US.
 * lead-service decides the set (`getAwaitingReply`): their latest message came after any
 * answer of ours, an answer through our mailboxes or an "answered outside" statement takes
 * them out, website visitors never enter. `total` is that set's own length, so the bell,
 * Work and Today count exactly the rows they list. Each shown person's row is read by id for
 * the card (company, avatar, conversation link); `waiting` says why they are there.
 */
export function useNeedsYourCall(brandId: string, limit: number) {
  return useAuthQuery(
    ["awaitingReply", brandId, limit],
    async () => {
      const awaiting = await getAwaitingReply(brandId);
      const rowless = awaiting.people.filter((p) => !p.id);
      if (rowless.length > 0) {
        console.error("[dashboard] useNeedsYourCall: waiting people with no lead row at the brand", {
          brandId,
          leadIds: rowless.map((p) => p.leadId),
        });
      }
      const shown = awaiting.people.filter((p): p is AwaitingReplyPerson & { id: string } => !!p.id).slice(0, limit);
      const leads = await Promise.all(shown.map((p) => getLeadDetail(p.id, brandId)));
      const waiting: Record<string, AwaitingReplyPerson> = {};
      for (const p of shown) waiting[p.id] = p;
      return { total: awaiting.total, leads, waiting };
    },
    { refetchInterval: pollIntervalFor, enabled: !!brandId },
  );
}

/** The latest message the person SENT us, off lead-service's merged history. */
export function useTheirLastWords(leadRowId: string, brandId: string) {
  const q = useAuthQuery(
    ["leadHistory", leadRowId, brandId, "brand"],
    () => getLeadHistory(leadRowId, { brandId, scope: "brand" }),
    { enabled: !!leadRowId && !!brandId },
  );
  const inbound = useMemo(() => {
    let latest: LeadHistoryEvent | null = null;
    for (const e of q.data?.events ?? []) {
      if (e.type !== "message" || e.direction !== "inbound") continue;
      if (!latest || (e.at ?? "") >= (latest.at ?? "")) latest = e;
    }
    return latest;
  }, [q.data]);
  return { inbound, settled: q.data !== undefined || q.isError };
}

