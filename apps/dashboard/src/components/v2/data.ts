"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getBrandRevenue,
  getLeadBucketCounts,
  getLeadStandingCounts,
  keepLastGoodFeatureRevenue,
  listLeadsPage,
} from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { pollOptions } from "@/lib/query-options";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { leadBucketCountsQuery, standingCountsQuery, type LeadBucket } from "@/lib/leads-server-page";

/**
 * The reads every v2 page shares, on EXACTLY v1's query keys — so v2 and v1 paint from
 * one cache and cannot state two numbers for one brand. Nothing here derives a metric.
 */

/** v1's lead scope key for a brand (`engaged-leads-page.tsx`). */
export const brandLeadScopeKey = (brandId: string) => `brand:${brandId}`;

export function useBrandInfo(brandId: string) {
  return useAuthQuery(["brand", brandId], () => getBrand(brandId), pollOptions);
}

export function useBrandRevenue(brandId: string) {
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug);
  const q = useAuthQuery(["brandRevenue", brandId], () => getBrandRevenue(brandId), {
    enabled,
    ...pollOptions,
    structuralSharing: (prev, next) =>
      keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
  });
  // Reveal on SETTLE: a failed read shows its dashes, never an eternal skeleton.
  return { ...q, enabled, pending: q.data === undefined && !q.isError && enabled };
}

export function useBucketCounts(brandId: string) {
  return useAuthQuery(
    ["leadBucketCounts", brandLeadScopeKey(brandId), ""],
    () => getLeadBucketCounts({ brandId }, leadBucketCountsQuery("")),
    pollOptions,
  );
}

export function useStandingCounts(brandId: string) {
  return useAuthQuery(
    ["leadStandingCounts", brandLeadScopeKey(brandId), ""],
    () => getLeadStandingCounts({ brandId }, standingCountsQuery("")),
    pollOptions,
  );
}

/**
 * NEEDS YOUR CALL: the people who REPLIED with interest and whom nobody has closed,
 * disqualified or opted out yet — the `positive_reply` bucket read inside the
 * `sales_interest` standing. `total` is lead-service's own count of that set.
 *
 * NOT the `sales_interest` standing alone: that standing also holds everyone who only
 * visited the website (86 of 87 on the brand that surfaced this), so counting it as
 * "wants to talk" stated 87 conversations for a brand with two replies ever.
 */
export function useNeedsYourCall(brandId: string, limit: number) {
  return useAuthQuery(
    ["leadsPage", brandLeadScopeKey(brandId), "v2-needs-call", limit],
    () =>
      listLeadsPage(
        { brandId },
        { view: "basic", bucket: "positive_reply", standing: "sales_interest", sort: "activity", limit: String(limit) },
        undefined,
        { includeCampaigns: false },
      ),
    { refetchInterval: POLL_INTERVAL },
  );
}

/**
 * The latest leads in one bucket, newest first on lead-service's own activity order.
 * `limit` rides the key so two surfaces asking different sizes never share an entry.
 */
export function useLatestInBucket(
  brandId: string,
  bucket: LeadBucket,
  limit: number,
  campaignId?: string,
) {
  const scopeKey = campaignId ? `campaign:${campaignId}` : brandLeadScopeKey(brandId);
  return useAuthQuery(
    ["leadsPage", scopeKey, "v2-latest", bucket, limit],
    () =>
      listLeadsPage(
        campaignId ? { campaignId } : { brandId },
        { view: "basic", bucket, sort: "activity", limit: String(limit) },
        undefined,
        { includeCampaigns: false },
      ),
    { refetchInterval: POLL_INTERVAL },
  );
}
