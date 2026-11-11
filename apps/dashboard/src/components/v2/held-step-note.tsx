"use client";

import { getFunnelCampaignNextSteps } from "@/lib/api";
import { slowServerReadOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { stepLabel } from "@/lib/legs";
import { heldStepCopy, heldStepOf } from "@/lib/held-step";
import { HeldStepCard } from "@/components/v2/held-step-card";

/**
 * Why nothing goes out on this campaign (NEXT-STEPS-TRUE-REASON-1111): the step features-service says cannot
 * run (`nextSends.heldBy`), how many people wait at it and since when, and the client's fix when one exists.
 * Nothing when no step is held. features-service reads several services for it, so it polls on the slow tier.
 */
export function useFunnelCampaignNextSteps(brandId: string, salesFunnelCampaignId: string) {
  return useAuthQuery(
    ["funnelCampaignNextSteps", brandId, salesFunnelCampaignId],
    () => getFunnelCampaignNextSteps(brandId, salesFunnelCampaignId),
    slowServerReadOptions,
  );
}

/** Opens the campaign's brief in place (the Goal section's field) and brings it into view. */
function openBrief() {
  const field = document.querySelector<HTMLButtonElement>('button[aria-label="Edit the brief"]');
  if (!field) {
    console.error("[held-step] the brief field is not on this page");
    return;
  }
  field.scrollIntoView({ behavior: "smooth", block: "center" });
  field.click();
}

export function HeldStepNote({ brandId, salesFunnelCampaignId }: { brandId: string; salesFunnelCampaignId: string }) {
  const q = useFunnelCampaignNextSteps(brandId, salesFunnelCampaignId);
  const catalogue = useLegCatalogue();
  const state = heldStepOf(q.data);
  if (!state) return null;
  const label = stepLabel(catalogue, state.held.outcome);
  // The step is named by its catalogue name only: the note waits for the catalogue rather than print a key.
  if (!label) {
    if (catalogue.steps.size > 0) console.error("[held-step] the catalogue serves no label for this outcome", { outcome: state.held.outcome });
    return null;
  }
  return <HeldStepCard outcome={state.held.outcome} copy={heldStepCopy(state.held, state.waiting, label)} onFix={openBrief} />;
}
