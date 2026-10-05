import {
  ApiError,
  getFeature,
  getWorkflowProjectionLadder,
  prefillFeatureInputs,
  prefillToStringMap,
  startCampaign,
  startFundedPair,
} from "@/lib/api";
import {
  ChannelStartRefusal,
  fundedPairRefusalMessage,
  ladderStartRefusalMessage,
  startableWorkflowDynastySlug,
} from "@/lib/channel-start";

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
  // The OFFER is named: features-service prices a leg on the offer's own terms, and a brand
  // selling several offers is refused a read that names none.
  const ladder = await getWorkflowProjectionLadder({ featureSlug, brandId, offerId, leg: legKey }).catch((err: unknown) => {
    const refusal = err instanceof ApiError ? ladderStartRefusalMessage(err.status, channelName) : null;
    if (refusal) throw new ChannelStartRefusal(refusal);
    throw err;
  });
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

/**
 * Turn on a REACTIVE campaign (it follows the leads earlier legs deliver: AI meeting
 * booking, AI Instant Call) that has none yet. Its budget is set on its own row first, so it
 * is a funded pair, and campaign-service starts it: it picks the workflow, or none for a
 * channel another service performs (AI Instant Call has no workflow by design, so the
 * dashboard's ladder read can never name one for it).
 */
export async function startReactiveCampaign(params: {
  brandId: string;
  offerId: string;
  featureSlug: string;
  legKey: string;
}): Promise<void> {
  await startFundedPair(params).catch((err: unknown) => {
    const refusal = err instanceof ApiError ? fundedPairRefusalMessage(err.status, err.body) : null;
    if (refusal) throw new ChannelStartRefusal(refusal);
    throw err;
  });
}
