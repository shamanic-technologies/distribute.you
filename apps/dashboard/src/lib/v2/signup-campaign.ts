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
 * The funnels are features-service's, runnable only, ROI first, PRICED FOR THIS OFFER (owner
 * 2026-10-10: the wall shows this offer's return, never the fleet's): `GET /v1/offers/:offerId/
 * sales-funnels?brandId=` (features v0.179.133 through the gateway, on the visitor's own org: the
 * anonymous one signed out). The launch writes billing's caps then starts the funnel campaign.
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
    /** features-service's word for the figures: measured, estimated, learning, customer_time. */
    status: z.string().nullish(),
    runnable: z.boolean(),
    mixed: z.boolean(),
  })
  .passthrough();
export type PublicSalesFunnelRow = z.infer<typeof PublicSalesFunnelRowSchema>;

export const PublicSalesFunnelPageSchema = z.object({ rows: z.array(PublicSalesFunnelRowSchema) }).passthrough();

/** The two producer pages the step reads (cold email, AI meeting booking), verbatim. */
export const SignupFunnelsBodySchema = z.object({ proactive: PublicSalesFunnelPageSchema, reactive: PublicSalesFunnelPageSchema });

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

/** The first runnable, unmixed row of a type: the producer already ranks ROI first. */
export function firstOfType(rows: readonly PublicSalesFunnelRow[], type: "proactive" | "reactive"): SignupFunnel | null {
  const row = rows.find((r) => r.type === type && r.runnable && !r.mixed);
  return row ? { salesFunnelId: row.id, name: row.name, costUsd: row.costUsd, costPer: row.costPer, roi: row.roi, status: row.status ?? null } : null;
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

/**
 * The picks as the snapshot keeps them (so the wall reopens after the Google round trip without a
 * read: signed in, the visitor's session is not the anonymous org the offer lives on until the claim).
 */
export function parseSignupFunnels(v: unknown): { proactive: SignupFunnel | null; reactive: SignupFunnel | null } | null {
  if (!v || typeof v !== "object") return null;
  const one = (x: unknown): SignupFunnel | null => {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    if (typeof o.salesFunnelId !== "string" || !o.salesFunnelId || typeof o.name !== "string") return null;
    const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
    return {
      salesFunnelId: o.salesFunnelId,
      name: o.name,
      costUsd: num(o.costUsd),
      costPer: typeof o.costPer === "string" ? o.costPer : null,
      roi: num(o.roi),
      status: typeof o.status === "string" ? o.status : null,
    };
  };
  const o = v as Record<string, unknown>;
  const proactive = one(o.proactive);
  return proactive ? { proactive, reactive: one(o.reactive) } : null;
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
