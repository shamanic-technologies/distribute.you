/**
 * What `/get-started` does once the account exists and the card is saved: turn the
 * preview the founder just watched into a running campaign, with no further
 * question. Explee's "Claim $30 credits & send".
 *
 * It reuses the calls the v2 "Add a brand" modal launches with (same channel, same
 * leg vocabulary, same write order), so the campaign it creates is the same kind
 * of campaign. Every write is done ONCE: a retry skips what already landed.
 */

import {
  ApiError,
  confirmBrandOffers,
  createCampaignWithoutBrandEnrichment,
  getWorkflowProjectionLadder,
  listBrandOffers,
  prefillFeatureInputs,
  proposeBrandOffers,
  saveCampaignBudget,
  setAudienceStatus,
} from "@/lib/api";
import { NEW_ORG_CHANNEL_SLUG, newOrgLeg, recommendedDailyBudgetUsd, type NewOrgLegKey } from "@/lib/v2/new-org-wizard";

export const GET_STARTED_LEG: NewOrgLegKey = "start_to_website_visit";

export interface LaunchInput {
  brandId: string;
  website: string;
  /** What we read the company sells, used to name its offer if it has none yet. */
  offerSource: string;
  audienceIds: string[];
  budgetUsd: number;
}

export interface LaunchProgress {
  offerId: string | null;
  audiences: boolean;
  budget: boolean;
  campaignId: string | null;
}

export const EMPTY_PROGRESS: LaunchProgress = { offerId: null, audiences: false, budget: false, campaignId: null };

/** The brand's offer: the one it has, else the main one proposed from what it sells. */
async function resolveOffer(brandId: string, source: string): Promise<{ offerId: string; name: string }> {
  const { offers } = await listBrandOffers(brandId);
  const live = offers.filter((o) => o.status !== "archived");
  if (live.length > 0) return { offerId: live[0].offerId, name: live[0].name };
  const text = source.trim();
  if (!text) throw new Error("We could not tell what you sell, so the campaign has no offer to pitch.");
  const proposal = await proposeBrandOffers(brandId, text);
  if (proposal.offers.length === 0) throw new Error("We could not read an offer on your site.");
  const main = proposal.mainOfferIndex >= 0 && proposal.mainOfferIndex < proposal.offers.length ? proposal.mainOfferIndex : 0;
  const { chosenOfferId } = await confirmBrandOffers(brandId, proposal.offers, main);
  return { offerId: chosenOfferId, name: proposal.offers[main].name };
}

/**
 * ONE offer resolution per brand in this tab. The wall resolves it as soon as the
 * account exists (to price the budget) and the launch resolves it again; two
 * concurrent resolutions of a brand with no offer would each confirm a proposal and
 * leave it with two offers. A failure is forgotten, so a retry asks again.
 */
const offerByBrand = new Map<string, Promise<{ offerId: string; name: string }>>();
function resolveOfferOnce(brandId: string, source: string): Promise<{ offerId: string; name: string }> {
  const held = offerByBrand.get(brandId);
  if (held) return held;
  const p = resolveOffer(brandId, source).catch((e) => {
    offerByBrand.delete(brandId);
    throw e;
  });
  offerByBrand.set(brandId, p);
  return p;
}

/**
 * The daily budget the v2 "Add a brand" modal would recommend for this brand:
 * features-service's recommended workflow for the brand's offer on this leg, its
 * campaign-grain cost per outcome, turned into a daily figure by the leg's own rule,
 * never under the channel floor. A brand is only given its offer once somebody owns
 * it, so this runs after the claim. `null` when no price is held yet.
 */
export async function recommendedBudgetForPreview(brandId: string, source: string, floorUsd: number): Promise<number | null> {
  const offer = await resolveOfferOnce(brandId, source);
  const ladder = await getWorkflowProjectionLadder({
    featureSlug: NEW_ORG_CHANNEL_SLUG,
    brandId,
    offerId: offer.offerId,
    leg: GET_STARTED_LEG,
  });
  const rec = ladder.recommendedWorkflowDynastySlug;
  const row = ladder.rows.find((r) => r.audienceId === null && r.workflow.workflowDynastySlug === rec);
  return recommendedDailyBudgetUsd(newOrgLeg(GET_STARTED_LEG), row?.resolved.costPerOutcomeUsd ?? null, floorUsd);
}

/**
 * Runs the launch, mutating `progress` as each write lands so a retry resumes.
 * Returns the created campaign's id.
 */
export async function launchFromPreview(input: LaunchInput, progress: LaunchProgress): Promise<string> {
  const leg = newOrgLeg(GET_STARTED_LEG);
  const offer = await resolveOfferOnce(input.brandId, input.offerSource);
  progress.offerId = offer.offerId;

  if (!progress.audiences) {
    if (input.audienceIds.length === 0) throw new Error("No audience was found for your company, so there is nobody to write to.");
    for (const id of input.audienceIds) {
      try {
        await setAudienceStatus(id, "active");
      } catch (e) {
        // Already active (a retry after a partial launch) is what we wanted.
        if (!(e instanceof ApiError && e.status === 409)) throw e;
      }
    }
    progress.audiences = true;
  }

  if (!progress.budget) {
    await saveCampaignBudget(
      input.brandId,
      { offerId: offer.offerId, legKey: GET_STARTED_LEG, featureSlug: NEW_ORG_CHANNEL_SLUG },
      input.budgetUsd * 100,
    );
    progress.budget = true;
  }

  if (progress.campaignId) return progress.campaignId;

  const ladder = await getWorkflowProjectionLadder({
    featureSlug: NEW_ORG_CHANNEL_SLUG,
    brandId: input.brandId,
    offerId: offer.offerId,
    leg: GET_STARTED_LEG,
  });
  const workflowSlug = ladder.recommendedWorkflowDynastySlug;
  if (!workflowSlug) throw new Error(`No workflow is ready for ${leg.unitPlural} yet, so the campaign cannot start.`);

  const prefill = await prefillFeatureInputs(NEW_ORG_CHANNEL_SLUG, [input.brandId], offer.offerId);
  const featureInputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefill.prefilled)) if (typeof v === "string" && v.trim()) featureInputs[k] = v;

  const { campaign } = await createCampaignWithoutBrandEnrichment({
    name: `${offer.name} (${leg.label}, Cold email)`,
    workflowSlug,
    brandUrls: [input.website],
    offerId: offer.offerId,
    legKey: GET_STARTED_LEG,
    featureSlug: NEW_ORG_CHANNEL_SLUG,
    featureInputs,
  });
  progress.campaignId = campaign.id;
  return campaign.id;
}
