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
import { campaignsForOutcome, type GetStartedOutcome } from "@/lib/v2/get-started";

export const GET_STARTED_LEG: NewOrgLegKey = "start_to_website_visit";

/** The cold-email leg an outcome starts with: it prices the recommended budget. */
export function coldEmailLegFor(outcome: GetStartedOutcome | null): NewOrgLegKey {
  return outcome === "meetings" ? "start_to_conversation" : GET_STARTED_LEG;
}

export interface LaunchInput {
  brandId: string;
  website: string;
  /** The offer picked at step 3, already confirmed on the brand. */
  offer: { offerId: string; name: string };
  /** The audience picked at step 4, already created under that offer. */
  audienceId: string;
  /** Whole dollars a day, set on EACH campaign the outcome launches. */
  budgetUsd: number;
  /** What the visitor buys: one campaign (visits) or two (meetings). */
  outcome: GetStartedOutcome;
  /** The offer points were answered in the preview and saved on the offer already. */
  answered: boolean;
}

export interface LaunchProgress {
  levers: boolean;
  audiences: boolean;
  /** Per campaign (keyed `featureSlug|legKey`): its budget written, and its id once created. */
  budgets: Record<string, boolean>;
  campaignIds: Record<string, string>;
}

export const EMPTY_PROGRESS: LaunchProgress = { levers: false, audiences: false, budgets: {}, campaignIds: {} };

/**
 * The daily budget the v2 "Add a brand" modal would recommend for this offer:
 * features-service's recommended workflow on this leg, its campaign-grain cost per
 * outcome, turned into a daily figure by the leg's own rule, never under the channel
 * floor. `null` when no price is held yet.
 */
export async function recommendedBudgetForPreview(
  brandId: string,
  offerId: string,
  floorUsd: number,
  legKey: NewOrgLegKey = GET_STARTED_LEG,
): Promise<number | null> {
  const ladder = await getWorkflowProjectionLadder({
    featureSlug: NEW_ORG_CHANNEL_SLUG,
    brandId,
    offerId,
    leg: legKey,
  });
  const rec = ladder.recommendedWorkflowDynastySlug;
  const row = ladder.rows.find((r) => r.audienceId === null && r.workflow.workflowDynastySlug === rec);
  return recommendedDailyBudgetUsd(newOrgLeg(legKey), row?.resolved.costPerOutcomeUsd ?? null, floorUsd);
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
 * Runs the launch on the offer and audience the visitor picked (no re-pick), one
 * campaign per (channel, leg) the outcome needs, each with the daily budget the
 * visitor set. Mutates `progress` as each write lands so a retry resumes. Returns the
 * first campaign's id (the cold email one, where the mission page opens).
 */
export async function launchFromPreview(input: LaunchInput, progress: LaunchProgress): Promise<string> {
  const { offerId, name: offerName } = input.offer;

  // Levers answered in the preview are already saved on the offer; otherwise they are
  // drafted and saved now, before the campaign inputs are prefilled from the offer.
  if (input.answered) progress.levers = true;
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

  const ids: string[] = [];
  for (const c of campaignsForOutcome(input.outcome)) {
    const key = `${c.featureSlug}|${c.legKey}`;
    if (!progress.budgets[key]) {
      await saveCampaignBudget(input.brandId, { offerId, legKey: c.legKey, featureSlug: c.featureSlug }, input.budgetUsd * 100);
      progress.budgets[key] = true;
    }
    if (progress.campaignIds[key]) {
      ids.push(progress.campaignIds[key]);
      continue;
    }
    const ladder = await getWorkflowProjectionLadder({ featureSlug: c.featureSlug, brandId: input.brandId, offerId, leg: c.legKey });
    const workflowSlug = ladder.recommendedWorkflowDynastySlug;
    if (!workflowSlug) throw new Error(`Nothing is ready to run for ${c.label.toLowerCase()} yet, so the campaign cannot start.`);

    await levers;
    const prefill = await prefillFeatureInputs(c.featureSlug, [input.brandId], offerId);
    const featureInputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(prefill.prefilled)) if (typeof v === "string" && v.trim()) featureInputs[k] = v;

    const { campaign } = await createCampaignWithoutBrandEnrichment({
      name: `${offerName} (${c.label})`,
      workflowSlug,
      brandUrls: [input.website],
      offerId,
      legKey: c.legKey,
      featureSlug: c.featureSlug,
      featureInputs,
    });
    progress.campaignIds[key] = campaign.id;
    ids.push(campaign.id);
  }
  await levers;
  return ids[0];
}
