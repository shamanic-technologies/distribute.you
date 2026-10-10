/**
 * What `/get-started` does once the account exists and the credit is added: turn the
 * preview the founder just watched into ONE running campaign (owner 2026-10-10: a campaign
 * IS a sales funnel), with the caps they set at the "Your campaign" step, plus the optional
 * meeting-booking one, with no further question.
 *
 * Order per funnel: billing's caps FIRST (a funnel with no max budget is held unfunded), then
 * campaign-service starts the funnel campaign. Every write is done ONCE: a retry skips what
 * already landed, and campaign-service hands an existing funnel campaign back, never a second.
 */

import {
  USER_PROFILE_FIELDS,
  launchAudiencePortfolio,
  extractBrandFields,
  saveOfferUserFields,
  saveSalesFunnelCaps,
  startSalesFunnelCampaign,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { LEVER_QUESTIONS } from "@/lib/v2/new-org-wizard";
import type { SignupLaunchFunnel, SignupLaunchPlan } from "@/lib/v2/signup-campaign";

export interface LaunchInput {
  brandId: string;
  /** The brand's site; empty for a brand with no website (created from what it sells, dashboard only). */
  website: string;
  /** The offer picked at step 3, already confirmed on the brand. */
  offer: { offerId: string; name: string };
  /** Who the customer sells to (the ICP text): every launched audience is derived from it. */
  targetAudience: string;
  /** The campaign set at the "Your campaign" step: the proactive funnel and, if ticked, the reactive one. */
  plan: SignupLaunchPlan;
  /** The offer points were answered in the preview and saved on the offer already. */
  answered: boolean;
}

export interface LaunchProgress {
  levers: boolean;
  audiences: boolean;
  /** Per sales funnel id: its caps written, and its funnel campaign started (with its id). */
  caps: Record<string, boolean>;
  started: Record<string, boolean>;
  campaignIds: Record<string, string>;
}

export const EMPTY_PROGRESS: LaunchProgress = { levers: false, audiences: false, caps: {}, started: {}, campaignIds: {} };

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

/** Caps first, then the start: both skipped on a retry once they landed. Returns the funnel campaign id. */
async function launchFunnel(brandId: string, offerId: string, f: SignupLaunchFunnel, progress: LaunchProgress): Promise<string> {
  if (!progress.caps[f.salesFunnelId]) {
    await saveSalesFunnelCaps(brandId, offerId, f.salesFunnelId, f.caps);
    progress.caps[f.salesFunnelId] = true;
  }
  const known = progress.campaignIds[f.salesFunnelId];
  if (known && progress.started[f.salesFunnelId]) return known;
  const campaign = await startSalesFunnelCampaign({ brandId, offerId, salesFunnelId: f.salesFunnelId });
  progress.campaignIds[f.salesFunnelId] = campaign.id;
  progress.started[f.salesFunnelId] = true;
  return campaign.id;
}

/**
 * Runs the launch on the offer and audience the visitor picked (no re-pick): the levers, the
 * audience portfolio, then the proactive funnel campaign (it must start or the launch fails),
 * then the meeting-booking one when ticked (a refusal there is stated in the console and does not
 * undo the outreach that started). Mutates `progress` as each write lands so a retry resumes.
 * Returns the proactive funnel campaign's id (where the campaign page opens).
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
  const firstId = await launchFunnel(input.brandId, offerId, input.plan.proactive, progress);
  const reactive = input.plan.reactive;
  if (reactive && !progress.started[reactive.salesFunnelId]) {
    try {
      await launchFunnel(input.brandId, offerId, reactive, progress);
    } catch (err) {
      console.error(`[get-started] launch: meeting booking ${reactive.name} did not start`, { brandId: input.brandId, offerId, err });
    }
  }
  return firstId;
}
