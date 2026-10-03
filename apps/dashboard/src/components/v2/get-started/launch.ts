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
  USER_PROFILE_FIELDS,
  createCampaignWithoutBrandEnrichment,
  launchAudiencePortfolio,
  extractBrandFields,
  getWorkflowProjectionLadder,
  prefillFeatureInputs,
  saveCampaignBudget,
  saveOfferUserFields,
  setBrandSalesBudget,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { LEVER_QUESTIONS, NEW_ORG_CHANNEL_SLUG, newOrgLeg, recommendedDailyBudgetUsd, type NewOrgLegKey } from "@/lib/v2/new-org-wizard";
import type { PlanCampaign } from "@/lib/v2/get-started";

export const GET_STARTED_LEG: NewOrgLegKey = "start_to_website_visit";

/** The cold-email entry leg that prices the recommended budget, when the path launched first starts with one. */
export function pricingLegFor(entryLegKey: string | null | undefined): NewOrgLegKey | null {
  return entryLegKey === "start_to_website_visit" || entryLegKey === "start_to_conversation" ? entryLegKey : null;
}

export interface LaunchInput {
  brandId: string;
  website: string;
  /** The offer picked at step 3, already confirmed on the brand. */
  offer: { offerId: string; name: string };
  /** Who the customer sells to (the ICP text): every launched audience is derived from it. */
  targetAudience: string;
  /** The ONE daily budget (whole dollars): billing's global budget, spent on the best path first. */
  budgetUsd: number;
  /** Every campaign the ranked paths need, the path launched first first (`launchPlan`). */
  plan: PlanCampaign[];
  /** The offer points were answered in the preview and saved on the offer already. */
  answered: boolean;
}

export interface LaunchProgress {
  levers: boolean;
  audiences: boolean;
  /** The brand's global sales budget stated. */
  salesBudget: boolean;
  /** Per campaign (keyed `featureSlug|legKey`): its budget written, and its id once created. */
  budgets: Record<string, boolean>;
  campaignIds: Record<string, string>;
}

export const EMPTY_PROGRESS: LaunchProgress = { levers: false, audiences: false, salesBudget: false, budgets: {}, campaignIds: {} };

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

/** A drafted value as clean lines; "unknown" is the read's word for nothing found. */
function valueLinesOf(v: unknown): string[] {
  return (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
    .map((x) => String(x).trim())
    .filter((x) => x && x.toLowerCase() !== "unknown");
}

/**
 * The six Hormozi levers of the picked offer, drafted off the site (brand-service's
 * `suggest` mode, the onboarding's own read) and SAVED on the offer, so the campaign's
 * emails are written around them from the first send and the owner edits them later
 * in the dashboard rather than starting from blank. A lever the read left empty is
 * not written: an empty confirmed row would hide a later suggestion. Its "Services sold"
 * rides the same read.
 */
async function prefillOfferLevers(brandId: string, offerId: string): Promise<void> {
  const leverFields = USER_PROFILE_FIELDS.filter(
    (f) => f.key === "services" || LEVER_QUESTIONS.some((q) => q.key === f.key),
  );
  const read = await extractBrandFields([brandId], leverFields, { mode: "suggest", urlStrategy: "landing", offerId });
  const fields: Partial<Record<UserFieldKey, UserFieldValue>> = {};
  for (const q of LEVER_QUESTIONS) {
    const v = read.fields[q.key]?.value;
    const lines = valueLinesOf(v);
    if (lines.length === 0) continue;
    fields[q.key] = q.list ? lines : lines.join("\n");
  }
  const services = valueLinesOf(read.fields.services?.value);
  if (services.length > 0) fields.services = services;
  if (Object.keys(fields).length > 0) await saveOfferUserFields(brandId, offerId, fields);
}

/**
 * Runs the launch on the offer and audience the visitor picked (no re-pick): the ONE
 * daily budget stated as the brand's global sales budget (campaign-service spends it on
 * the best-ROI path first), then one campaign per (channel, leg) the ranked paths need.
 * Every campaign's own ceiling is the whole budget: the global one is the ONE pot of every
 * step of the sales path, replies to leads served first (owner 2026-10-03). A campaign of the path
 * launched first must be created or the launch fails; one of a later path that has
 * nothing ready to run is skipped and logged. Mutates `progress` as each write lands so
 * a retry resumes. Returns the first campaign's id (where the mission page opens).
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
    // The customer validated WHO they sell to; we launch the whole portfolio built from
    // it (the cold audiences confirmed during the preview, adopted, plus buying-signal
    // audiences), all active. The audience picked in the preview only chose the sample.
    const targetAudience = input.targetAudience.trim();
    if (!targetAudience) {
      console.error("[get-started] launch: no ICP text to build the audiences from", { brandId: input.brandId, offerId });
      throw new Error("We lost who you sell to on the way. Refresh the page and try again.");
    }
    await launchAudiencePortfolio(input.brandId, offerId, targetAudience);
    progress.audiences = true;
  }

  if (input.plan.length === 0) throw new Error("No sales path can be launched yet. Go back and tick the steps your sales go through.");
  if (!progress.salesBudget) {
    await setBrandSalesBudget(input.brandId, input.budgetUsd * 100);
    progress.salesBudget = true;
  }

  const ids: string[] = [];
  for (const c of input.plan) {
    const key = `${c.featureSlug}|${c.legKey}`;
    if (progress.campaignIds[key]) {
      ids.push(progress.campaignIds[key]);
      continue;
    }
    const ladder = await getWorkflowProjectionLadder({ featureSlug: c.featureSlug, brandId: input.brandId, offerId, leg: c.legKey });
    const workflowSlug = ladder.recommendedWorkflowDynastySlug;
    if (!workflowSlug) {
      if (c.required) throw new Error(`Nothing is ready to run for ${c.label.toLowerCase()} yet, so the campaign cannot start.`);
      console.warn(`[get-started] launch: no workflow ready for ${key}, campaign skipped (a later path)`);
      continue;
    }
    if (!progress.budgets[key]) {
      await saveCampaignBudget(input.brandId, { offerId, legKey: c.legKey, featureSlug: c.featureSlug }, input.budgetUsd * 100);
      progress.budgets[key] = true;
    }

    await levers;
    const prefill = await prefillFeatureInputs(c.featureSlug, [input.brandId], offerId);
    const featureInputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(prefill.prefilled)) if (typeof v === "string" && v.trim()) featureInputs[k] = v;

    // A campaign name is unique per org, and one channel works several legs (cold email
    // finds website visits AND positive replies): the leg's outcome tells them apart,
    // the way the "Add a brand" modal names its campaigns.
    const { campaign } = await createCampaignWithoutBrandEnrichment({
      name: `${offerName} (${c.outcome}, ${c.label})`,
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
