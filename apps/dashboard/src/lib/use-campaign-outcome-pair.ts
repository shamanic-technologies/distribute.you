"use client";

/**
 * WHICH OUTCOME A CAMPAIGN'S WORKFLOW SURFACES ARE PRICED BY — the campaign's own LEG,
 * never its funnel.
 *
 * A campaign is (offer x funnel x channel) and it performs ONE arrow of that funnel, so
 * the outcome each workflow produced FOR IT is that arrow's own. The Workflows table
 * hardcoded the reply pair, so a visit-led campaign read `0 sales interests` on every
 * row while it was measurably buying website visits — the same trap #3880 closed on the
 * Audiences table, one surface over.
 *
 * The precedence is every other leg-aware surface's: the campaign's own STATED leg wins,
 * and the derivation from the channel's published legs is the fallback for campaigns
 * that predate the column. Both reads are already in flight on these pages (the campaign
 * row, and the platform leg catalogue behind `useFunnelLegIndex` / the acquisition-channel
 * catalogue projected off the features query), so naming the outcome costs no request.
 *
 * A campaign stating no funnel, a leg we cannot place, or a leg whose step has no
 * per-workflow figure all answer `"reply"` — exactly what these surfaces read before, so
 * nothing regresses to a column of dashes.
 */

import { useMemo } from "react";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { campaignLegFor } from "@/lib/campaign-leg";
import { statedCampaignLeg } from "@/lib/stated-campaign-leg";
import { useFunnelLegIndex } from "@/lib/use-funnel-leg-index";
import { legColumnPair } from "@/lib/campaign-leg-columns";
import {
  workflowOutcomePairFor,
  type WorkflowOutcomePair,
} from "@/lib/campaign-workflow-rows";
import type { Campaign } from "@/lib/api";

export function useCampaignOutcomePair(
  campaign: Campaign | null | undefined,
  featureSlug: string | null,
): WorkflowOutcomePair {
  const channels = useAcquisitionChannels();
  const legIndex = useFunnelLegIndex();
  return useMemo(() => {
    const funnel = campaignFunnel(campaign?.funnelKey ?? null);
    if (!funnel || !featureSlug) return workflowOutcomePairFor(null);
    const stated = statedCampaignLeg(funnel, campaign?.legKey, legIndex);
    const leg =
      stated ??
      campaignLegFor(funnel, acquisitionChannelForFeatureSlug(featureSlug, channels)?.legs);
    return workflowOutcomePairFor(legColumnPair(leg));
  }, [campaign?.funnelKey, campaign?.legKey, featureSlug, channels, legIndex]);
}
