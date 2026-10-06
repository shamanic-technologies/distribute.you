/**
 * What `/get-started` does once the account exists and the credit is added: turn the
 * preview the founder just watched into running campaigns, the ones they turned on at
 * the campaigns step with the budget they set on each, with no further question.
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
  saveOfferCampaignBudget,
  saveOfferUserFields,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { LEVER_QUESTIONS, NEW_ORG_CHANNEL_SLUG, newOrgLeg, recommendedDailyBudgetUsd, type NewOrgLegKey } from "@/lib/v2/new-org-wizard";
import { plannedKey, type PlannedCampaign } from "@/lib/v2/get-started";
import { startReactiveCampaign } from "@/lib/start-pair";

export const GET_STARTED_LEG: NewOrgLegKey = "start_to_website_visit";

/** The cold-email entry leg that prices the recommended budget, when the best proactive campaign works one. */
export function pricingLegFor(entryLegKey: string | null | undefined): NewOrgLegKey | null {
  return entryLegKey === "start_to_website_visit" || entryLegKey === "start_to_conversation" ? entryLegKey : null;
}

export interface LaunchInput {
  brandId: string;
  /** The brand's site; empty for a brand with no website (created from what it sells, dashboard only). */
  website: string;
  /** The offer picked at step 3, already confirmed on the brand. */
  offer: { offerId: string; name: string };
  /** Who the customer sells to (the ICP text): every launched audience is derived from it. */
  targetAudience: string;
  /** The campaigns turned on at the campaigns step, each with its daily budget (whole dollars). */
  campaigns: LaunchCampaign[];
  /** Write each campaign's daily budget (false for a plan subscriber: its plan sets them). */
  writeBudgets?: boolean;
  /** The offer points were answered in the preview and saved on the offer already. */
  answered: boolean;
}

/** One campaign to start, with the words its name is made of. */
export interface LaunchCampaign extends PlannedCampaign {
  /** The channel's name ("Cold email"). */
  label: string;
  /** The step the leg reaches ("Website visit"): two legs of one channel are told apart by it. */
  outcome: string;
}

export interface LaunchProgress {
  levers: boolean;
  audiences: boolean;
  /** Per campaign (`plannedKey`): its budget written, and the campaign started (a proactive one's id). */
  budgets: Record<string, boolean>;
  started: Record<string, boolean>;
  campaignIds: Record<string, string>;
}

export const EMPTY_PROGRESS: LaunchProgress = { levers: false, audiences: false, budgets: {}, started: {}, campaignIds: {} };

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
 * Runs the launch on the offer and audience the visitor picked (no re-pick): each campaign
 * turned on at the campaigns step gets its own daily budget (billing, per offer), then
 * starts: the proactive one is created on the workflow features-service recommends for its
 * leg, a reactive one is started by campaign-service as a funded pair. Exactly one proactive
 * campaign is on (the step refuses otherwise) and it must start or the launch fails; a
 * reactive one that cannot start yet is logged and skipped. Mutates `progress` as each
 * write lands so a retry resumes. Returns the proactive campaign's id (where the mission
 * page opens).
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

  const on = input.campaigns.filter((c) => c.on);
  const proactive = on.filter((c) => !c.reactive);
  if (proactive.length !== 1) {
    console.error("[get-started] launch: expected exactly one proactive campaign on", { brandId: input.brandId, offerId, on });
    throw new Error("Turn on one campaign that finds new leads, then try again.");
  }

  // The proactive one first: the reactive ones follow the leads it brings.
  let firstId: string | null = progress.campaignIds[plannedKey(proactive[0])] ?? null;
  for (const c of [...proactive, ...on.filter((x) => x.reactive)]) {
    const key = plannedKey(c);
    if (progress.started[key]) continue;
    if (input.writeBudgets !== false && !progress.budgets[key]) {
      await saveOfferCampaignBudget(input.brandId, offerId, { featureSlug: c.featureSlug, legKey: c.legKey, budgetCents: c.budgetUsd * 100 }, "day");
      progress.budgets[key] = true;
    }

    if (c.reactive) {
      try {
        await startReactiveCampaign({ brandId: input.brandId, offerId, featureSlug: c.featureSlug, legKey: c.legKey });
      } catch (err) {
        console.warn(`[get-started] launch: reactive campaign ${key} did not start, skipped`, err);
        continue;
      }
      progress.started[key] = true;
      continue;
    }

    const ladder = await getWorkflowProjectionLadder({ featureSlug: c.featureSlug, brandId: input.brandId, offerId, leg: c.legKey });
    const workflowSlug = ladder.recommendedWorkflowDynastySlug;
    if (!workflowSlug) throw new Error(`Nothing is ready to run for ${c.label.toLowerCase()} yet, so the campaign cannot start.`);

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
      ...(input.website ? { brandUrls: [input.website] } : { brandIds: [input.brandId] }),
      offerId,
      legKey: c.legKey,
      featureSlug: c.featureSlug,
      featureInputs,
    });
    progress.campaignIds[key] = campaign.id;
    progress.started[key] = true;
    firstId = campaign.id;
  }
  await levers;
  if (!firstId) throw new Error("The campaign did not start. Try again.");
  return firstId;
}
