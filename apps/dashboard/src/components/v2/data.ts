"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getBrandOutcomes,
  getBrandDisqualifications,
  getOfferRevenue,
  getOfferRevenueWindow,
  getOfferOutcomes,
  getOfferContactedValue,
  getAwaitingReply,
  getLeadBucketCounts,
  getLeadDetail,
  getLeadHistory,
  getLeadStandingCounts,
  getOrgUsage,
  getUniboxLifecycleCounts,
  keepLastGoodFeatureRevenue,
  listLeadsPage,
  type AwaitingReplyPerson,
  type LeadScope,
} from "@/lib/api";
import { useSelectedOffer, useSelectedOfferIfAny } from "@/components/v2/selected-offer";
import type { RevenueOverview } from "@/lib/revenue-view";
import type { LeadHistoryEvent } from "@/lib/lead-history";
import { pollOptions } from "@/lib/query-options";
import type { RevenueWindowDays } from "@/lib/revenue-window";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { leadBucketCountsQuery, standingCountsQuery, type LeadBucket } from "@/lib/leads-server-page";
import { filtersKey, type UniboxFilters } from "@/lib/unibox-leads";

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
  const { offerId, campaignIds, scopeSettled } = useSelectedOffer();
  const { q, enabled } = useOfferRevenueQuery(brandId, offerId, campaignIds);
  // Reveal on SETTLE: a failed read shows its dashes, never an eternal skeleton. While the
  // offer and its campaigns load, `enabled` is false for want of data, not for want of an
  // offer: that is pending too, or every reload flashes the page's no-data note.
  return { ...q, enabled, pending: enabled ? q.data === undefined && !q.isError : !scopeSettled };
}

/** The ONE query behind the offer's money: `useBrandRevenue` and the auto basis share its cache. */
function useOfferRevenueQuery(brandId: string, offerId: string | null, campaignIds: string[] | null) {
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug) && !!brandId && !!offerId && (campaignIds?.length ?? 0) > 0;
  const q = useAuthQuery(["brandRevenue", brandId, "offer", offerId], () => getOfferRevenue(offerId!, brandId), {
    enabled,
    ...pollOptions,
    structuralSharing: (prev, next) =>
      keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
  });
  return { q, enabled };
}

/**
 * The selected offer's return pair, the one figure that picks Mature or Flash for the
 * whole dashboard (lib/use-stat-basis.ts). Null outside a brand page (no offer open).
 */
export function useOfferReturnPairIfAny(): RevenueOverview["costEconomics"]["maturity"] | null {
  const sel = useSelectedOfferIfAny();
  const { q } = useOfferRevenueQuery(sel?.brandId ?? "", sel?.offerId ?? null, sel?.campaignIds ?? null);
  return q.data?.costEconomics.maturity ?? null;
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

/** Every outcome of the brand from any source its own tools state (crm-service), campaigns or not. */
export function useBrandOutcomes(brandId: string) {
  return useAuthQuery(["brandOutcomes", brandId], () => getBrandOutcomes(brandId), { ...pollOptions, enabled: !!brandId });
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
 * How many of the selected offer's people stand on each lifecycle rung (lead-service), one
 * campaign when named: the Deals board's column sizes and the sidebar's Deals count read the SAME
 * key, so the two agree. Filters narrow the counts exactly as they narrow the cards.
 */
export function useDealsLifecycleCounts(brandId: string, campaignId: string | null = null, filters: UniboxFilters = {}) {
  const { offerId } = useSelectedOffer();
  return useAuthQuery(
    ["dealsLifecycleCounts", brandId, offerId ?? "", campaignId ?? "", filtersKey(filters)],
    () => getUniboxLifecycleCounts(brandId, filters, { offerId, campaignId }),
    { ...pollOptions, enabled: !!brandId && !!offerId },
  );
}

/**
 * The people marked Disqualified for the selected offer (its own mark or a brand-wide one),
 * with their notes: lead-service's list, its `total` the length of the same list. The mark is
 * its own tag beside the standing, so this is the Deals board's Disqualified column, never
 * `standing=disqualified` (lead-service no longer produces that standing).
 */
export function useLeadDisqualifications(brandId: string) {
  const { offerId } = useSelectedOffer();
  return useAuthQuery(
    ["leadDisqualifications", brandId, offerId],
    () => getBrandDisqualifications({ brandId, offerId }),
    { ...pollOptions, enabled: !!brandId && !!offerId },
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
    { refetchInterval: POLL_INTERVAL, enabled: !!brandId },
  );
}

/**
 * The people who REPLIED with interest and whom nobody has closed: the `positive_reply`
 * bucket inside the `sales_interest` standing. Deals' "N of them replied", answered or not.
 * Never "Needs your call" (that is `useNeedsYourCall`, the ones still waiting on us).
 */
export function useInterestedReplies(brandId: string) {
  const lead = useLeadScope(brandId);
  return useAuthQuery(
    ["leadsPage", lead.key, "v2-interested-replies"],
    () =>
      listLeadsPage(
        lead.scope,
        { view: "basic", bucket: "positive_reply", standing: "sales_interest", sort: "activity", limit: "1" },
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

