/**
 * What `/get-started` does once the account exists and the credit is added: turn the
 * preview the founder just watched into ONE running campaign aimed at meetings booked
 * (owner 2026-11-22, ONE-CAMPAIGN-VOLUME-1122): its one brief, the volume they want per
 * period and its max budget (the top of the served range), with no further question.
 *
 * ONE create: campaign-service writes the campaign's caps at billing on THAT campaign before
 * its first run, and runs every part of its funnel under it (cold email, the AI booking the
 * meeting). Never a second campaign, never funnel-wide caps. A retry hands the same campaign
 * back (and writes its caps), never a second.
 */

import {
  USER_PROFILE_FIELDS,
  launchAudiencePortfolio,
  extractBrandFields,
  saveOfferUserFields,
  startSalesFunnelCampaign,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { LEVER_QUESTIONS } from "@/lib/v2/new-org-wizard";
import { capPeriodOf, type SignupLaunchPlan } from "@/lib/v2/signup-campaign";

export interface LaunchInput {
  brandId: string;
  /** The brand's site; empty for a brand with no website (created from what it sells, dashboard only). */
  website: string;
  /** The offer picked at step 3, already confirmed on the brand. */
  offer: { offerId: string; name: string };
  /** Who the customer sells to (the ICP text): every launched audience is derived from it. */
  targetAudience: string;
  /** The ONE campaign set at the "Your campaign" step. */
  plan: SignupLaunchPlan;
  /** The offer points were answered in the preview and saved on the offer already. */
  answered: boolean;
  /** Lab walk: the campaign is created waiting, Distry starts it on the founder's first message. */
  held?: boolean;
}

export interface LaunchProgress {
  levers: boolean;
  audiences: boolean;
  /** The campaign, once started (its id). */
  campaignId: string | null;
}

export const EMPTY_PROGRESS: LaunchProgress = { levers: false, audiences: false, campaignId: null };

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
  // One service per offer (owner 2026-10-10): another service is another offer.
  const services = valueLinesOf(read.fields.services?.value).slice(0, 1);
  if (services.length > 0) fields.services = services;
  if (Object.keys(fields).length > 0) await saveOfferUserFields(brandId, offerId, fields);
}

/**
 * The ONE create: brief, Target and max budget in the same request. Skipped on a retry once it landed. The volume typed
 * is interested leads that only PRICE the campaign (owner 2026-11-23), so it is never sent as a cap on a campaign whose
 * Target is a meeting booked.
 */
async function launchCampaign(brandId: string, offerId: string, plan: SignupLaunchPlan, progress: LaunchProgress, held = false): Promise<string> {
  if (progress.campaignId) return progress.campaignId;
  const period = capPeriodOf(plan.period);
  // A new campaign always carries its brief (owner 2026-11-21: « On ne devrait pas lancer de campaign sans brief »).
  const campaign = await startSalesFunnelCampaign({
    brandId,
    offerId,
    salesFunnelId: plan.salesFunnelId,
    target: plan.target,
    brief: plan.brief,
    maxBudget: { amountCents: plan.maxBudgetCents, period },
    held,
  });
  progress.campaignId = campaign.id;
  return campaign.id;
}

/**
 * Runs the launch on the offer and audience the visitor picked (no re-pick): the levers, the
 * audience portfolio, then the ONE campaign (it must start or the launch fails). Mutates
 * `progress` as each write lands so a retry resumes. Returns the campaign's id.
 */
export async function launchFromPreview(input: LaunchInput, progress: LaunchProgress): Promise<string> {
  const { offerId } = input.offer;

  // Levers answered in the preview are already saved on the offer; otherwise they are
  // drafted and saved now, before the emails are written from the offer.
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

  // The emails are written from the offer points: they land before anything starts.
  await levers;
  return launchCampaign(input.brandId, offerId, input.plan, progress, input.held === true);
}
