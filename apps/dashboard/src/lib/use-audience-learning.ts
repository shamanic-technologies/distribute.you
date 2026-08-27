"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useOrgQueryGate } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { fetchFeatureAudienceStats, type FeatureAudienceStatsRow } from "@/lib/api";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { audienceIsLearning } from "@/lib/learning-threshold";
import { stepsFor } from "@/lib/goal-steps";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";

/**
 * Which of a scope's audiences are still learning, one answer each.
 *
 * An audience clears the bar the moment ONE of the scope's campaigns has produced enough
 * outcomes FROM IT — the same rule the scope itself follows, one level down. So the read
 * is per CAMPAIGN: features-service answers per-audience evidence scoped to a campaign,
 * and every one of those keys is byte-equal to the one that campaign's own Audiences page
 * already polls, so drilling in costs no second request.
 *
 * Counts from different campaigns are NOT added. An audience at five replies in each of
 * two campaigns has two unreliable prices; the table states a price per audience, and
 * pooling them would invent a reliability neither has.
 */
export function useAudienceLearning(
  brandId: string,
  featureSlug: string,
  offerId?: string,
): { learningByAudienceId: Map<string, boolean>; settled: boolean } {
  const orgConsistent = useOrgQueryGate();
  // The scope's campaigns, through the hook the Campaigns table already uses — same
  // keys, no network, and the same list the money above these rows is judged on.
  const { rows: campaignRows } = useCampaignRows(brandId, featureSlug, offerId);

  const statsQs = useQueries({
    queries: campaignRows.map(({ campaign }) => ({
      queryKey: [
        "featureAudienceStats",
        featureSlug,
        brandId,
        campaign.funnelKey ?? "no-funnel",
        "all-statuses",
        campaign.id,
      ] as const,
      queryFn: () =>
        fetchFeatureAudienceStats(featureSlug, {
          brandId,
          ...(campaign.funnelKey ? { funnel: campaign.funnelKey } : {}),
          statuses: "active,paused,archived",
          campaignId: campaign.id,
        }),
      enabled: orgConsistent && Boolean(featureSlug),
      ...pollOptions,
    })),
  });

  const statsData = statsQs.map((q) => q.data);
  const learningByAudienceId = useMemo(() => {
    const counts = new Map<string, Array<number | null | undefined>>();
    campaignRows.forEach(({ campaign }, i) => {
      const rows = statsData[i]?.audiences ?? [];
      // What this campaign's funnel actually measures — a positive reply on the reply-led
      // funnels, a website visit on the visit-led ones. Never its terminal outcome: that
      // needs the brand's tracker live and is legitimately 0, which would hold every
      // audience in learning forever.
      const steps = stepsFor(null, campaign.funnelKey as SalesFunnelKeyWire | null);
      const has = (key: string) => steps.some((step) => step.key === key);
      const read = (row: FeatureAudienceStatsRow): number | null | undefined => {
        if (has("positive_replies")) return row.evidence.positiveReplies;
        if (has("website_visits")) return row.evidence.websiteClicks;
        return undefined;
      };
      for (const row of rows) {
        for (const id of [row.audienceId, row.audience.id]) {
          if (!id) continue;
          const held = counts.get(id) ?? [];
          held.push(read(row));
          counts.set(id, held);
        }
      }
    });
    const map = new Map<string, boolean>();
    for (const [id, list] of counts) map.set(id, audienceIsLearning(list));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignRows, ...statsData]);

  // Reveal on SETTLE, so one failed read cannot hold a table forever — and a scope with
  // NO campaigns settles immediately with an empty map, which gates nothing.
  const settled = statsQs.every((q) => q.data !== undefined || q.isError);
  return { learningByAudienceId, settled };
}

/**
 * Whether this audience's money should read `Learning`.
 *
 * Absent from the map means the fan-out has not settled, or the scope has no campaigns —
 * both are "cannot tell", and the row then reads exactly as it does today. An audience
 * the campaigns DO report on and that clears nothing is present, and `true`.
 */
export function audienceLearningFor(
  map: Map<string, boolean>,
  audienceId: string | null | undefined,
  settled: boolean,
): boolean {
  if (!settled || map.size === 0 || !audienceId) return false;
  return map.get(audienceId) ?? true;
}
