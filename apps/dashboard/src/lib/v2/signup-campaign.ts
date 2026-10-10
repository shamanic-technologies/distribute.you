/**
 * The END of signup (`/get-started` and "Add a brand"), owner sketch 2026-10-10:
 *
 *   Your campaign
 *   [face] <best runnable PROACTIVE funnel for the offer>
 *   <one plain line of what it does>
 *   Estimated: <served cost + its unit>
 *   Max budget   [$ 20 ] per [day v]
 *   Max volume   [ optional ] new people per [month v]
 *   [ ] Also let our AI book meetings when someone replies
 *       [face] <reactive funnel> · Up to [$ 10 ] per [week v]
 *   [ Launch ]  -> then the payment wall exactly as today
 *
 * The funnels are features-service's (`GET /v1/public/catalogue/sales-funnels`, runnable only,
 * ROI first); the launch writes billing's caps then starts campaign-service's funnel campaign.
 * Nothing here computes a figure the producers serve: the picks are the first served row of
 * the right type, the line under the name is the channel's own served short description.
 *
 * Alias-free so it carries real unit tests.
 */
import { z } from "zod";

/** The one channel this flow sells (cold email), and the one that books meetings on replies. */
export const SIGNUP_PROACTIVE_CHANNEL = "sales-cold-email-outreach";
export const SIGNUP_REACTIVE_CHANNEL = "ai-meeting-booking";

export const PublicSalesFunnelRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    costUsd: z.number().nullable(),
    costPer: z.string().nullable(),
    roi: z.number().nullable(),
    runnable: z.boolean(),
    mixed: z.boolean(),
  })
  .passthrough();
export type PublicSalesFunnelRow = z.infer<typeof PublicSalesFunnelRowSchema>;

export const PublicSalesFunnelPageSchema = z.object({ rows: z.array(PublicSalesFunnelRowSchema) }).passthrough();

/** The body `/api/public/sales-funnels` hands back: the two producer pages, verbatim. */
export const SignupFunnelsBodySchema = z.object({ proactive: PublicSalesFunnelPageSchema, reactive: PublicSalesFunnelPageSchema });

export interface SignupFunnel {
  salesFunnelId: string;
  name: string;
  /** features-service's figure and its unit in words, or null while nothing is priced. */
  costUsd: number | null;
  costPer: string | null;
  roi: number | null;
}

/** The first runnable, unmixed row of a type: the producer already ranks ROI first. */
export function firstOfType(rows: readonly PublicSalesFunnelRow[], type: "proactive" | "reactive"): SignupFunnel | null {
  const row = rows.find((r) => r.type === type && r.runnable && !r.mixed);
  return row ? { salesFunnelId: row.id, name: row.name, costUsd: row.costUsd, costPer: row.costPer, roi: row.roi } : null;
}

/** The two funnels the step proposes: the best proactive cold-email one, and the meeting-booking reactive one. */
export function signupFunnelsFrom(body: unknown): { proactive: SignupFunnel | null; reactive: SignupFunnel | null } {
  const parsed = SignupFunnelsBodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("[signup-campaign] funnels body shape mismatch", { issues: parsed.error.issues });
    throw new Error("[signup-campaign] invalid funnels body");
  }
  return { proactive: firstOfType(parsed.data.proactive.rows, "proactive"), reactive: firstOfType(parsed.data.reactive.rows, "reactive") };
}

/** "Estimated: $143.48 per paying client". Null when the producer priced nothing (never a made-up figure). */
export function estimatedLine(f: Pick<SignupFunnel, "costUsd" | "costPer">): string | null {
  if (f.costUsd == null || !f.costPer) return null;
  const usd = f.costUsd >= 100 ? Math.round(f.costUsd).toLocaleString("en-US") : f.costUsd.toFixed(2).replace(/\.00$/, "");
  return `Estimated: $${usd} ${f.costPer}`;
}

/** The periods the step offers (billing's vocabulary), with the word the select shows. */
export const SIGNUP_PERIODS = [
  { key: "daily", label: "day" },
  { key: "weekly", label: "week" },
  { key: "monthly", label: "month" },
] as const;
export type SignupPeriod = (typeof SIGNUP_PERIODS)[number]["key"];

export function asSignupPeriod(v: unknown, fallback: SignupPeriod): SignupPeriod {
  return SIGNUP_PERIODS.some((p) => p.key === v) ? (v as SignupPeriod) : fallback;
}

/** What the person typed, as typed (strings), so a half-typed amount survives a reload. */
export interface SignupCampaignDraft {
  budget: string;
  budgetPeriod: SignupPeriod;
  /** Blank = no volume cap. */
  volume: string;
  volumePeriod: SignupPeriod;
  reactiveOn: boolean;
  reactiveBudget: string;
  reactivePeriod: SignupPeriod;
}

/** The sketch's defaults: $20 a day, no volume cap, meetings off at up to $10 a week. */
export const DEFAULT_SIGNUP_DRAFT: SignupCampaignDraft = {
  budget: "20",
  budgetPeriod: "daily",
  volume: "",
  volumePeriod: "monthly",
  reactiveOn: false,
  reactiveBudget: "10",
  reactivePeriod: "weekly",
};

export function parseSignupDraft(v: unknown): SignupCampaignDraft | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const str = (x: unknown, d: string) => (typeof x === "string" ? x : d);
  return {
    budget: str(o.budget, DEFAULT_SIGNUP_DRAFT.budget),
    budgetPeriod: asSignupPeriod(o.budgetPeriod, DEFAULT_SIGNUP_DRAFT.budgetPeriod),
    volume: str(o.volume, ""),
    volumePeriod: asSignupPeriod(o.volumePeriod, DEFAULT_SIGNUP_DRAFT.volumePeriod),
    reactiveOn: o.reactiveOn === true,
    reactiveBudget: str(o.reactiveBudget, DEFAULT_SIGNUP_DRAFT.reactiveBudget),
    reactivePeriod: asSignupPeriod(o.reactivePeriod, DEFAULT_SIGNUP_DRAFT.reactivePeriod),
  };
}

/** billing's caps body (cents, period); `null` maxVolume = no volume cap. */
export interface FunnelCapsWrite {
  maxBudget: { amountCents: number; period: SignupPeriod };
  maxVolume: { count: number; period: SignupPeriod } | null;
}

/** One funnel campaign to launch: its id, its name (for messages) and its caps. */
export interface SignupLaunchFunnel {
  salesFunnelId: string;
  name: string;
  caps: FunnelCapsWrite;
}

export interface SignupLaunchPlan {
  proactive: SignupLaunchFunnel;
  reactive: SignupLaunchFunnel | null;
}

const WHOLE = /^\d+$/;

/** Whole dollars, at least $1. */
function wholeUsd(raw: string): number | null {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!WHOLE.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/**
 * The plan to launch, or the one plain sentence that says what to fix. A funnel with no max
 * budget is held unfunded by billing, so a budget is required; the volume cap is optional.
 */
export function signupLaunchPlan(
  draft: SignupCampaignDraft,
  funnels: { proactive: SignupFunnel | null; reactive: SignupFunnel | null },
): { plan: SignupLaunchPlan } | { problem: string } {
  if (!funnels.proactive) return { problem: "We could not load your campaign. Try again." };
  const budget = wholeUsd(draft.budget);
  if (budget == null) return { problem: "Set a max budget in whole dollars, $1 or more." };
  let maxVolume: FunnelCapsWrite["maxVolume"] = null;
  if (draft.volume.trim()) {
    const t = draft.volume.trim().replace(/,/g, "");
    const n = WHOLE.test(t) ? Number(t) : 0;
    if (n < 1) return { problem: "Set the max volume as a whole number of people, or leave it empty." };
    maxVolume = { count: n, period: draft.volumePeriod };
  }
  let reactive: SignupLaunchFunnel | null = null;
  if (draft.reactiveOn) {
    if (!funnels.reactive) return { problem: "Meeting booking is not available right now. Untick it to continue." };
    const upTo = wholeUsd(draft.reactiveBudget);
    if (upTo == null) return { problem: "Set how much meeting booking may spend, in whole dollars." };
    reactive = {
      salesFunnelId: funnels.reactive.salesFunnelId,
      name: funnels.reactive.name,
      caps: { maxBudget: { amountCents: upTo * 100, period: draft.reactivePeriod }, maxVolume: null },
    };
  }
  return {
    plan: {
      proactive: {
        salesFunnelId: funnels.proactive.salesFunnelId,
        name: funnels.proactive.name,
        caps: { maxBudget: { amountCents: budget * 100, period: draft.budgetPeriod }, maxVolume },
      },
      reactive,
    },
  };
}

/**
 * The daily pace of the outreach budget the person typed (billing's own rule for a cap: a day
 * x1, a week /7, a month /30), for the reload warning ("At $20 a day, $100 lasts 5 days").
 * Their own input, no served figure. The reactive budget only spends when someone replies.
 */
export function dailyPaceUsd(draft: Pick<SignupCampaignDraft, "budget" | "budgetPeriod">): number {
  const usd = wholeUsd(draft.budget);
  if (usd == null) return 0;
  const div = draft.budgetPeriod === "weekly" ? 7 : draft.budgetPeriod === "monthly" ? 30 : 1;
  return Math.round((usd / div) * 100) / 100;
}
