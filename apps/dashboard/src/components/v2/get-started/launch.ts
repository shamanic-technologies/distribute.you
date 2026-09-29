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
  USER_PROFILE_FIELDS,
  createCampaignWithoutBrandEnrichment,
  listAudiences,
  extractBrandFields,
  getWorkflowProjectionLadder,
  prefillFeatureInputs,
  saveCampaignBudget,
  saveOfferUserFields,
  setAudienceStatus,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { LEVER_QUESTIONS, NEW_ORG_CHANNEL_SLUG, newOrgLeg, recommendedDailyBudgetUsd, type NewOrgLegKey } from "@/lib/v2/new-org-wizard";

export const GET_STARTED_LEG: NewOrgLegKey = "start_to_website_visit";

export interface LaunchInput {
  brandId: string;
  website: string;
  /** The offer picked at step 3, already confirmed on the brand. */
  offer: { offerId: string; name: string };
  /** The audience picked at step 4, already created under that offer. */
  audienceId: string;
  budgetUsd: number;
}

export interface LaunchProgress {
  levers: boolean;
  audiences: boolean;
  budget: boolean;
  campaignId: string | null;
}

export const EMPTY_PROGRESS: LaunchProgress = { levers: false, audiences: false, budget: false, campaignId: null };

/**
 * The daily budget the v2 "Add a brand" modal would recommend for this offer:
 * features-service's recommended workflow on this leg, its campaign-grain cost per
 * outcome, turned into a daily figure by the leg's own rule, never under the channel
 * floor. `null` when no price is held yet.
 */
export async function recommendedBudgetForPreview(brandId: string, offerId: string, floorUsd: number): Promise<number | null> {
  const ladder = await getWorkflowProjectionLadder({
    featureSlug: NEW_ORG_CHANNEL_SLUG,
    brandId,
    offerId,
    leg: GET_STARTED_LEG,
  });
  const rec = ladder.recommendedWorkflowDynastySlug;
  const row = ladder.rows.find((r) => r.audienceId === null && r.workflow.workflowDynastySlug === rec);
  return recommendedDailyBudgetUsd(newOrgLeg(GET_STARTED_LEG), row?.resolved.costPerOutcomeUsd ?? null, floorUsd);
}

/**
 * The six Hormozi levers of the picked offer, drafted off the site (brand-service's
 * `suggest` mode, the onboarding's own read) and SAVED on the offer, so the campaign's
 * emails are written around them from the first send and the owner edits them later
 * in the dashboard rather than starting from blank. A lever the read left empty is
 * not written: an empty confirmed row would hide a later suggestion.
 */
async function prefillOfferLevers(brandId: string, offerId: string): Promise<void> {
  const leverFields = USER_PROFILE_FIELDS.filter((f) => LEVER_QUESTIONS.some((q) => q.key === f.key));
  const read = await extractBrandFields([brandId], leverFields, { mode: "suggest", urlStrategy: "landing", offerId });
  const fields: Partial<Record<UserFieldKey, UserFieldValue>> = {};
  for (const q of LEVER_QUESTIONS) {
    const v = read.fields[q.key]?.value;
    const lines = (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
      .map((x) => String(x).trim())
      .filter((x) => x && x.toLowerCase() !== "unknown");
    if (lines.length === 0) continue;
    fields[q.key] = q.list ? lines : lines.join("\n");
  }
  if (Object.keys(fields).length > 0) await saveOfferUserFields(brandId, offerId, fields);
}

/**
 * Runs the launch on the offer and audience the visitor picked (no re-pick),
 * mutating `progress` as each write lands so a retry resumes. Returns the campaign id.
 */
export async function launchFromPreview(input: LaunchInput, progress: LaunchProgress): Promise<string> {
  const leg = newOrgLeg(GET_STARTED_LEG);
  const { offerId, name: offerName } = input.offer;

  // The levers are read while the rest is written: the campaign's inputs are prefilled
  // from the offer below, so they are awaited before that read.
  const levers = progress.levers
    ? Promise.resolve()
    : prefillOfferLevers(input.brandId, offerId).then(() => {
        progress.levers = true;
      });

  if (!progress.audiences) {
    // The picked audience is the one launched. Another one picked earlier and left
    // (each pick creates its audience) goes back to suggested: recoverable, not sent to.
    const { audiences } = await listAudiences(input.brandId, { status: "active", offerId });
    for (const a of audiences) if (a.id !== input.audienceId) await setAudienceStatus(a.id, "suggested");
    try {
      await setAudienceStatus(input.audienceId, "active");
    } catch (e) {
      // Already active (created active at the pick, or a retry) is what we wanted.
      if (!(e instanceof ApiError && e.status === 409)) throw e;
    }
    progress.audiences = true;
  }

  if (!progress.budget) {
    await saveCampaignBudget(
      input.brandId,
      { offerId, legKey: GET_STARTED_LEG, featureSlug: NEW_ORG_CHANNEL_SLUG },
      input.budgetUsd * 100,
    );
    progress.budget = true;
  }

  if (progress.campaignId) {
    await levers;
    return progress.campaignId;
  }

  const ladder = await getWorkflowProjectionLadder({
    featureSlug: NEW_ORG_CHANNEL_SLUG,
    brandId: input.brandId,
    offerId,
    leg: GET_STARTED_LEG,
  });
  const workflowSlug = ladder.recommendedWorkflowDynastySlug;
  if (!workflowSlug) throw new Error(`Nothing is ready to run for ${leg.unitPlural} yet, so the campaign cannot start.`);

  await levers;
  const prefill = await prefillFeatureInputs(NEW_ORG_CHANNEL_SLUG, [input.brandId], offerId);
  const featureInputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefill.prefilled)) if (typeof v === "string" && v.trim()) featureInputs[k] = v;

  const { campaign } = await createCampaignWithoutBrandEnrichment({
    name: `${offerName} (${leg.label}, Cold email)`,
    workflowSlug,
    brandUrls: [input.website],
    offerId,
    legKey: GET_STARTED_LEG,
    featureSlug: NEW_ORG_CHANNEL_SLUG,
    featureInputs,
  });
  progress.campaignId = campaign.id;
  return campaign.id;
}
