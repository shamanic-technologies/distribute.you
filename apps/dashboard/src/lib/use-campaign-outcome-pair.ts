"use client";

/**
 * WHICH OUTCOME A CAMPAIGN'S WORKFLOW SURFACES ARE PRICED BY — the campaign's own LEG.
 *
 * A campaign is (offer x leg x channel), so the outcome each workflow produced FOR IT is
 * the step its leg lands on. The leg is the one the campaign STATES, looked up in the
 * platform catalogue (already polled on these pages, so naming it costs no request).
 *
 * A leg we cannot resolve, or one whose step has no per-workflow figure, answers
 * `"reply"` — what these surfaces read before legs existed, so nothing regresses to a
 * column of dashes.
 */

import { useMemo } from "react";
import { legColumnPair } from "@/lib/campaign-leg-columns";
import { useCampaignLeg } from "@/lib/use-leg-catalogue";
import {
  workflowOutcomePairFor,
  type WorkflowOutcomePair,
} from "@/lib/campaign-workflow-rows";
import type { Campaign } from "@/lib/api";

export function useCampaignOutcomePair(campaign: Campaign | null | undefined): WorkflowOutcomePair {
  const leg = useCampaignLeg(campaign);
  return useMemo(() => workflowOutcomePairFor(legColumnPair(leg)), [leg]);
}
