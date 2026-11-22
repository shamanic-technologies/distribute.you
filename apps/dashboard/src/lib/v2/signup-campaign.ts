/**
 * The END of signup (`/get-started` and "Add a brand"), owner 2026-11-22 (ONE-CAMPAIGN-VOLUME-1122, replaces the
 * 2026-10-16 two cards): ONE campaign aimed at meetings booked, ONE card:
 *
 *   WHAT IT DOES       <one brief, prefilled by features-service, click to edit>
 *   HOW MANY YOU WANT  [10] meetings booked  [per day | per week | per month]
 *   ESTIMATED BUDGET   $X to $Y per week (20th to 80th percentile, served), never more than $Y per week
 *                      First meetings around week N, then about 10 a week from week M (served)
 *   Never spend more than $9,000 per month, all campaigns together
 *   [ Launch ]  -> then the payment wall exactly as today
 *
 * « Les gens ne pensent pas en 20/jour » : the visitor states a volume of the Target, never a daily spend; we split
 * the campaign into its parts (cold email outreach, the AI that books the meeting) and the visitor never sees them.
 * The campaign is ONE features-service funnel that runs both (Lead Sourcing -> cold email -> AI meeting booking),
 * runnable for THIS offer (`GET /v1/offers/:offerId/sales-funnels?brandId=`); every figure is features-service's
 * (`lib/v2/campaign-volume.ts`). Alias-free so it carries real unit tests.
 */
import { z } from "zod";
import { asVolumePeriod, oneCampaignPlan, type OneCampaignPlan, type VolumeEstimate, type VolumePeriod } from "./campaign-volume";

/** Lead Sourcing plays that only re-serve people the brand already reached: a new client has none. */
export const SIGNUP_EXCLUDED_SOURCING_PLAYS: ReadonlySet<string> = new Set(["lead-follow-up-due", "contacted-pure-prospects"]);

/**
 * The ONE funnel signup launches (owner 2026-11-22): people found by Lead Sourcing (we pick the sources, never the
 * client's own contacts: a new client has none), cold email, then the AI books the meeting; any step after it (the
 * client's own meeting attended, paid client) may follow. Any play on the cold email (the email style picked sets
 * it); features-service still ranks them.
 */
const MEETING_CAMPAIGN_FUNNEL =
  /^start_to_lead_found@lead-sourcing(?:~([^+]+))?\+lead_found_to_conversation@sales-cold-email-outreach(?:~[^+]+)?\+conversation_to_meeting_booked@ai-meeting-booking(?:~[^+]+)?(?:\+.+)?$/;
export function isMeetingCampaignFunnel(funnelId: string): boolean {
  const m = funnelId.match(MEETING_CAMPAIGN_FUNNEL);
  return !!m && !(m[1] && SIGNUP_EXCLUDED_SOURCING_PLAYS.has(m[1]));
}

export const PublicSalesFunnelRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    costUsd: z.number().nullable(),
    costPer: z.string().nullable(),
    roi: z.number().nullable(),
    /** features-service's word for the figures: measured, estimated, learning, customer_time. */
    status: z.string().nullish(),
    runnable: z.boolean(),
    mixed: z.boolean(),
  })
  .passthrough();
export type PublicSalesFunnelRow = z.infer<typeof PublicSalesFunnelRowSchema>;

export const PublicSalesFunnelPageSchema = z.object({ rows: z.array(PublicSalesFunnelRowSchema) }).passthrough();


export interface SignupFunnel {
  salesFunnelId: string;
  name: string;
  /** features-service's figure and its unit in words, or null while nothing is priced. */
  costUsd: number | null;
  costPer: string | null;
  roi: number | null;
  /** The served word for its figures ("estimated", "measured", "learning"), or null. */
  status: string | null;
}

/** The first runnable, unmixed row of a type the caller accepts: the producer already ranks ROI first. */
export function firstOfType(
  rows: readonly PublicSalesFunnelRow[],
  type: "proactive" | "reactive",
  fits: (funnelId: string) => boolean = () => true,
): SignupFunnel | null {
  const row = rows.find((r) => r.type === type && r.runnable && !r.mixed && fits(r.id));
  return row ? funnelOfRow(row) : null;
}

function funnelOfRow(row: PublicSalesFunnelRow): SignupFunnel {
  return { salesFunnelId: row.id, name: row.name, costUsd: row.costUsd, costPer: row.costPer, roi: row.roi, status: row.status ?? null };
}

/**
 * The campaign's funnel: the first runnable row (producer order, ROI first) of the page that runs the whole
 * campaign (cold email then the AI booking the meeting); null when none is runnable for this offer.
 */
export function signupCampaignFunnelFrom(
  body: unknown,
  /** Which funnels the email style picked allows (lib/v2/email-angles.ts `funnelFitsAngles`). */
  fits: (funnelId: string) => boolean = () => true,
): SignupFunnel | null {
  const parsed = PublicSalesFunnelPageSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[signup-campaign] funnels body shape mismatch", { issues: parsed.error.issues });
    throw new Error("[signup-campaign] invalid funnels body");
  }
  const row = parsed.data.rows.find((r) => r.runnable && isMeetingCampaignFunnel(r.id) && fits(r.id));
  return row ? funnelOfRow(row) : null;
}

/**
 * The pick as the snapshot keeps it (so the wall reopens after the Google round trip without a read: signed in,
 * the visitor's session is not the anonymous org the offer lives on until the claim). A snapshot kept before the
 * one-campaign step (two funnels) is not reopened: the step reads again.
 */
export function parseSignupFunnel(v: unknown): SignupFunnel | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.salesFunnelId !== "string" || !isMeetingCampaignFunnel(o.salesFunnelId) || typeof o.name !== "string") return null;
  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  return {
    salesFunnelId: o.salesFunnelId,
    name: o.name,
    costUsd: num(o.costUsd),
    costPer: typeof o.costPer === "string" ? o.costPer : null,
    roi: num(o.roi),
    status: typeof o.status === "string" ? o.status : null,
  };
}

/** A funnel still LEARNING states no figure: the product's own word "Learning" stands in (existing rule). */
export function isLearning(f: Pick<SignupFunnel, "status">): boolean {
  return f.status === "learning";
}

/** The served status as a label ("estimated" -> "Estimated"); null for anything that prices nothing. */
export function figureLabel(f: Pick<SignupFunnel, "status">): string | null {
  if (f.status === "estimated") return "Estimated";
  if (f.status === "measured") return "Measured";
  return null;
}

/**
 * "Estimated: $143 per paying client · 4.2x return": the cost with its unit and this offer's return,
 * labelled as served. Null when the producer priced nothing, or while it is learning (never a figure).
 */
export function estimatedLine(f: Pick<SignupFunnel, "costUsd" | "costPer" | "roi" | "status">): string | null {
  const label = figureLabel(f);
  if (!label || f.costUsd == null || !f.costPer) return null;
  const usd = f.costUsd >= 100 ? Math.round(f.costUsd).toLocaleString("en-US") : f.costUsd.toFixed(2).replace(/\.00$/, "");
  const ret = f.roi == null ? "" : ` · ${f.roi >= 10 ? Math.round(f.roi) : Math.round(f.roi * 10) / 10}x return`;
  return `${label}: $${usd} ${f.costPer}${ret}`;
}

/** What the person typed, as typed (strings), so a half-typed value survives a reload. */
export interface SignupCampaignDraft {
  /** Meetings booked wanted per period, as typed. */
  volume: string;
  volumePeriod: VolumePeriod;
  /** The brief as edited; null while untouched (features-service's served prefill shows and launches). */
  brief: string | null;
  /** "Never spend more than $X per month" as typed; null while untouched (the arm's prefill). */
  monthlyLimit: string | null;
}

/** 2 meetings booked a week (owner 2026-11-22: « go with your reco »; 10 a week priced past the $9,000 monthly limit). */
export const DEFAULT_SIGNUP_DRAFT: SignupCampaignDraft = {
  volume: "2",
  volumePeriod: "week",
  brief: null,
  monthlyLimit: null,
};

/** An older snapshot (two campaigns, budgets per day) keeps only what still means something: the monthly limit. */
export function parseSignupDraft(v: unknown): SignupCampaignDraft | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    volume: typeof o.volume === "string" ? o.volume : DEFAULT_SIGNUP_DRAFT.volume,
    volumePeriod: asVolumePeriod(o.volumePeriod, DEFAULT_SIGNUP_DRAFT.volumePeriod),
    brief: typeof o.brief === "string" ? o.brief : null,
    monthlyLimit: typeof o.monthlyLimit === "string" ? o.monthlyLimit : null,
  };
}

/** The brief the campaign launches with: the edited text, else the served prefill; null = none yet. */
export function briefToLaunch(edited: string | null, prefill: string | null): string | null {
  const t = (edited ?? prefill ?? "").trim();
  return t ? t : null;
}

/** What Launch creates: ONE campaign (its funnel, name, Target, brief, volume and cap). */
export interface SignupLaunchPlan extends OneCampaignPlan {
  salesFunnelId: string;
  name: string;
}

/** billing's period word for a volume period. */
export function capPeriodOf(p: VolumePeriod): "daily" | "weekly" | "monthly" {
  return p === "day" ? "daily" : p === "week" ? "weekly" : "monthly";
}

/** The plan to launch, or the one plain sentence that says what to fix. */
export function signupLaunchPlan(input: {
  draft: SignupCampaignDraft;
  funnel: SignupFunnel | null;
  briefPrefill: string | null;
  estimate: VolumeEstimate | null;
}): { plan: SignupLaunchPlan } | { problem: string } {
  const { draft, funnel } = input;
  if (!funnel) return { problem: "We could not load your campaign. Try again." };
  const r = oneCampaignPlan({
    salesFunnelIds: [funnel.salesFunnelId],
    brief: briefToLaunch(draft.brief, input.briefPrefill),
    volume: draft.volume,
    period: draft.volumePeriod,
    estimate: input.estimate,
  });
  if ("problem" in r) return r;
  return { plan: { ...r.plan, salesFunnelId: funnel.salesFunnelId, name: funnel.name } };
}
