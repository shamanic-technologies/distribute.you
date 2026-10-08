"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getOfferRevenue,
  getOfferRevenueWindow,
  getOfferOutcomes,
  getOfferContactedValue,
  getLeadBucketCounts,
  getLeadHistory,
  getLeadStandingCounts,
  getOrgUsage,
  keepLastGoodFeatureRevenue,
  listLeadsPage,
  type LeadScope,
} from "@/lib/api";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import type { RevenueOverview } from "@/lib/revenue-view";
import type { LeadHistoryEvent } from "@/lib/lead-history";
import { pollOptions } from "@/lib/query-options";
import type { RevenueWindowDays } from "@/lib/revenue-window";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { leadBucketCountsQuery, standingCountsQuery, type LeadBucket } from "@/lib/leads-server-page";

/**
 * The reads every v2 page shares. Each is about the ONE offer the sidebar's switcher
 * picked (`useSelectedOffer`, owner 2026-10-03): no v2 page states a brand-wide total.
 * The keys keep v1's prefixes with the offer appended, so a prefix invalidation of the
 * brand still reaches them. Nothing here derives a metric.
 */

/** v1's lead scope key for a brand (`engaged-leads-page.tsx`), narrowed to one offer. */
export const brandLeadScopeKey = (brandId: string, offerId?: string | null) =>
  offerId ? `brand:${brandId}:offer:${offerId}` : `brand:${brandId}`;

/**
 * The lead scope every v2 people read sends: the brand, narrowed to the selected offer.
 * `ready` is false until an offer is picked, so no read ever asks for the whole brand.
 */
export function useLeadScope(brandId: string): { scope: LeadScope; key: string; ready: boolean } {
  const { offerId } = useSelectedOffer();
  return {
    scope: offerId ? { brandId, offerId } : { brandId },
    key: brandLeadScopeKey(brandId, offerId),
    ready: !!brandId && !!offerId,
  };
}

export function useBrandInfo(brandId: string) {
  return useAuthQuery(["brand", brandId], () => getBrand(brandId), pollOptions);
}

/**
 * The selected offer's money (features-service's offer grain). Not asked while the offer
 * has no campaign: that offer has no money yet, and features-service answers it with a
 * 404 rather than an empty body, so `enabled` is false and pages show their no-data state.
 */
export function useBrandRevenue(brandId: string) {
  const featureSlug = useSoleFeatureSlug();
  const { offerId, campaignIds, scopeSettled } = useSelectedOffer();
  const enabled = isRevenueFeature(featureSlug) && !!offerId && (campaignIds?.length ?? 0) > 0;
  const q = useAuthQuery(["brandRevenue", brandId, "offer", offerId], () => getOfferRevenue(offerId!, brandId), {
    enabled,
    ...pollOptions,
    structuralSharing: (prev, next) =>
      keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
  });
  // Reveal on SETTLE: a failed read shows its dashes, never an eternal skeleton. While the
  // offer and its campaigns load, `enabled` is false for want of data, not for want of an
  // offer: that is pending too, or every reload flashes the page's no-data note.
  return { ...q, enabled, pending: enabled ? q.data === undefined && !q.isError : !scopeSettled };
}

/** The selected offer's outcomes, one row per step (features-service), same gate as `useBrandRevenue`. */
export function useOfferOutcomes(brandId: string) {
  const featureSlug = useSoleFeatureSlug();
  const { offerId, campaignIds, scopeSettled } = useSelectedOffer();
  const enabled = isRevenueFeature(featureSlug) && !!offerId && (campaignIds?.length ?? 0) > 0;
  const q = useAuthQuery(["offerStepOutcomes", brandId, offerId], () => getOfferOutcomes(offerId!, brandId), {
    enabled,
    ...pollOptions,
  });
  return { ...q, pending: enabled ? q.data === undefined && !q.isError : !scopeSettled };
}

/**
 * What the selected offer's contacted people are worth (features-service contacted-value,
 * the Deals board's Contacted column read without lead ids): per person and in all.
 */
export function useOfferContactedValue(brandId: string) {
  const { offerId } = useSelectedOffer();
  return useAuthQuery(["contactedValue", brandId, "offer", offerId, ""], () => getOfferContactedValue(offerId!, brandId, []), {
    enabled: !!offerId,
    ...pollOptions,
  });
}

/** Today's stat row over the last `days` UTC days, same offer and gate as `useBrandRevenue`. */
export function useBrandRevenueWindow(brandId: string, days: RevenueWindowDays) {
  const featureSlug = useSoleFeatureSlug();
  const { offerId, campaignIds, scopeSettled } = useSelectedOffer();
  const enabled = isRevenueFeature(featureSlug) && !!offerId && (campaignIds?.length ?? 0) > 0;
  const q = useAuthQuery(["brandRevenueWindow", brandId, "offer", offerId, days], () => getOfferRevenueWindow(offerId!, brandId, days), {
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

export function useBucketCounts(brandId: string) {
  const lead = useLeadScope(brandId);
  return useAuthQuery(
    ["leadBucketCounts", lead.key, ""],
    () => getLeadBucketCounts(lead.scope, leadBucketCountsQuery("")),
    { ...pollOptions, enabled: lead.ready },
  );
}

export function useStandingCounts(brandId: string) {
  const lead = useLeadScope(brandId);
  return useAuthQuery(
    ["leadStandingCounts", lead.key, ""],
    () => getLeadStandingCounts(lead.scope, standingCountsQuery("")),
    { ...pollOptions, enabled: lead.ready },
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
  const lead = useLeadScope(brandId);
  return useAuthQuery(
    ["leadsPage", lead.key, "v2-needs-call", limit],
    () =>
      listLeadsPage(
        lead.scope,
        { view: "basic", bucket: "positive_reply", standing: "sales_interest", sort: "activity", limit: String(limit) },
        undefined,
        { includeCampaigns: false },
      ),
    { refetchInterval: POLL_INTERVAL, enabled: lead.ready },
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
  const lead = useLeadScope(brandId);
  const scopeKey = campaignId ? `campaign:${campaignId}` : lead.key;
  return useAuthQuery(
    ["leadsPage", scopeKey, "v2-latest", bucket, limit],
    () =>
      listLeadsPage(
        campaignId ? { campaignId } : lead.scope,
        { view: "basic", bucket, sort: "activity", limit: String(limit) },
        undefined,
        { includeCampaigns: false },
      ),
    { refetchInterval: POLL_INTERVAL, enabled: !!campaignId || lead.ready },
  );
}

/** The latest message the person SENT us, off lead-service's merged history. */
export function useTheirLastWords(leadRowId: string, brandId: string) {
  const q = useAuthQuery(
    ["leadHistory", leadRowId, brandId, "campaign"],
    () => getLeadHistory(leadRowId, { brandId, scope: "campaign" }),
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

