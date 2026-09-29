import {
  getFeature,
  getWorkflowProjectionLadder,
  prefillFeatureInputs,
  prefillToStringMap,
  startCampaign,
} from "@/lib/api";
import { ChannelStartRefusal, startableWorkflowDynastySlug } from "@/lib/channel-start";

/**
 * CREATE the campaign for one (offer x leg x channel) that has none yet.
 *
 * The one implementation of a start from nothing, shared by Offer Settings' per-row
 * switch and dashboard v2's "Add a mission": the workflow is the producer's own pick
 * for THIS leg (never one of ours), the inputs are the offer's own prefill, and the
 * name carries the leg AND the channel because campaign-service refuses a name the org
 * already holds and one offer sells through several pairs.
 */
export async function createCampaignForPair({
  brandId,
  offerId,
  featureSlug,
  legKey,
  channelName,
  legLabel,
  brandName,
}: {
  brandId: string;
  offerId: string;
  featureSlug: string;
  legKey: string;
  channelName: string;
  legLabel: string | null;
  brandName: string;
}): Promise<void> {
  const ladder = await getWorkflowProjectionLadder({ featureSlug, brandId, leg: legKey });
  const workflowDynastySlug = startableWorkflowDynastySlug(ladder.recommendedWorkflowDynastySlug);
  if (!workflowDynastySlug) {
    throw new ChannelStartRefusal(`${channelName} is not ready for this outcome yet, so there is nothing to start.`);
  }
  const [{ feature }, prefill] = await Promise.all([
    getFeature(featureSlug),
    prefillFeatureInputs(featureSlug, [brandId], offerId),
  ]);
  const prefilled = prefillToStringMap(prefill.prefilled);
  const featureInputs: Record<string, string> = {};
  for (const input of feature.inputs ?? []) {
    const value = prefilled[input.key]?.trim();
    if (value) featureInputs[input.key] = value;
  }
  await startCampaign({
    name: `${brandName} — ${legLabel ?? legKey} (${channelName})`,
    brandId,
    featureSlug,
    featureInputs,
    workflowDynastySlug,
    offerId,
    legKey,
  });
}
