/**
 * SALES FUNNEL CAMPAIGNS (owner 2026-10-10): a campaign is brand x offer x sales funnel, run or paused
 * as one; its UNITS are its pipes (one per leg x channel, each a campaign-service campaign with its own
 * workflow). campaign-service serves them (`/sales-funnel-campaigns`), billing-service serves each
 * funnel's caps (`/brands/:b/offers/:o/sales-funnels/:id/caps`), both through the gateway.
 *
 * Shapes only, as served; nothing is computed here. Alias-free so it carries real unit tests.
 */
import { z } from "zod";

export const SalesFunnelUnitSchema = z
  .object({
    campaignId: z.string(),
    pipeId: z.string(),
    featureSlug: z.string(),
    legKey: z.string(),
    status: z.string(),
    workflowSlug: z.string().nullable(),
    name: z.string(),
  })
  .passthrough();
export type SalesFunnelUnit = z.infer<typeof SalesFunnelUnitSchema>;

export const SalesFunnelCampaignSchema = z
  .object({
    id: z.string(),
    brandId: z.string(),
    offerId: z.string(),
    salesFunnelId: z.string(),
    salesFunnelName: z.string(),
    status: z.string(),
    stopReason: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    units: z.array(SalesFunnelUnitSchema),
  })
  .passthrough();
export type SalesFunnelCampaign = z.infer<typeof SalesFunnelCampaignSchema>;

export const SalesFunnelCampaignListSchema = z.object({ salesFunnelCampaigns: z.array(SalesFunnelCampaignSchema) }).passthrough();
export const SalesFunnelCampaignOneSchema = z.object({ salesFunnelCampaign: SalesFunnelCampaignSchema }).passthrough();

const CapWindow = {
  period: z.string(),
  periodStart: z.string(),
  periodEnd: z.string().nullable(),
  reached: z.boolean().nullable(),
  consumedUnavailableReason: z.string().nullable(),
  consumedUnavailableDetail: z.string().nullable(),
};

export const SalesFunnelCapsSchema = z
  .object({
    salesFunnelId: z.string(),
    stated: z.boolean(),
    updatedAt: z.string().nullable(),
    // billing v0.83.11 relays features-service's funnel type (owner 2026-10-10); optional until every
    // cached body carries it, null + a named reason when billing could not read it.
    salesFunnelType: z.string().nullish(),
    salesFunnelTypeUnavailableReason: z.string().nullish(),
    maxBudget: z
      .object({ amountCents: z.string(), consumedCents: z.string().nullable(), remainingCents: z.string().nullable(), ...CapWindow })
      .passthrough()
      .nullable(),
    maxVolume: z
      .object({ count: z.number(), unit: z.string(), consumed: z.number().nullable(), remaining: z.number().nullable(), ...CapWindow })
      .passthrough()
      .nullable(),
  })
  .passthrough();
export type SalesFunnelCaps = z.infer<typeof SalesFunnelCapsSchema>;

/** A served cents string ("12500" or "12500.5") as dollars, for display only. Null for a non-number (logged). */
export function centsToUsd(cents: string | null | undefined): number | null {
  if (cents == null) return null;
  const n = Number(cents);
  if (!Number.isFinite(n)) {
    console.error("[sales-funnel-campaigns] unreadable cents", { cents });
    return null;
  }
  return n / 100;
}

/** The producer's word for a status or reason, capitalised (never renamed). */
export function producerWord(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

/** A funnel campaign is ONGOING while campaign-service says so (`ongoing`). */
export function isOngoingFunnelCampaign(c: Pick<SalesFunnelCampaign, "status">): boolean {
  return c.status === "ongoing";
}

// ─── GA display (owner 2026-10-10): the campaign page, the Overview section, the sidebar ──────────

/** The PUT body: both keys always (object states the cap, null clears it). */
export const CAP_PERIODS = ["daily", "weekly", "monthly", "one_off"] as const;
export type CapPeriod = (typeof CAP_PERIODS)[number];

export interface SalesFunnelCapsInput {
  maxBudget: { amountCents: number; period: CapPeriod } | null;
  maxVolume: { count: number; period: CapPeriod } | null;
}

export type MaxBudget = NonNullable<SalesFunnelCaps["maxBudget"]>;
export type MaxVolume = NonNullable<SalesFunnelCaps["maxVolume"]>;

/** billing's period vocabulary narrowed for the editor; an unknown token is logged and read as weekly. */
export function asCapPeriod(p: string): CapPeriod {
  if ((CAP_PERIODS as readonly string[]).includes(p)) return p as CapPeriod;
  console.error("[sales-funnel-campaigns] unknown cap period", { period: p });
  return "weekly";
}

/** How a period reads after an amount: "$50/week", "200 people/month", "$300 in total". */
export function capPeriodSuffix(period: string): string {
  switch (period) {
    case "daily":
      return "/day";
    case "weekly":
      return "/week";
    case "monthly":
      return "/month";
    case "one_off":
      return " in total";
    default:
      console.error("[sales-funnel-campaigns] unknown cap period", { period });
      return "";
  }
}

/** The window a consumed figure covers, for a sentence: "this week", "so far". */
export function capWindowWords(period: string): string {
  switch (period) {
    case "daily":
      return "today";
    case "weekly":
      return "this week";
    case "monthly":
      return "this month";
    case "one_off":
      return "so far";
    default:
      return "";
  }
}

/** The period's name in the cap editor. */
export const CAP_PERIOD_LABEL: Record<CapPeriod, string> = {
  daily: "Per day",
  weekly: "Per week",
  monthly: "Per month",
  one_off: "In total",
};

/** Whole dollars from a served cents string, no cents: a cap is a promise amount. "—" logged when unreadable. */
export function formatCapUsd(cents: string | null): string {
  const usd = centsToUsd(cents);
  return usd === null ? "—" : `$${Math.round(usd).toLocaleString("en-US")}`;
}

export function maxBudgetLabel(b: Pick<MaxBudget, "amountCents" | "period">): string {
  return `${formatCapUsd(b.amountCents)}${capPeriodSuffix(b.period)}`;
}

/** The volume unit is billing's `first_contacts`: a new person contacted. */
export function maxVolumeLabel(v: Pick<MaxVolume, "count" | "period">): string {
  return `${v.count.toLocaleString("en-US")} ${v.count === 1 ? "person" : "people"}${capPeriodSuffix(v.period)}`;
}

/**
 * Why a consumed figure is missing, in one plain line. billing names the reason; a reason we
 * have no sentence for still says something true and logs the token.
 */
export function capUnavailableSentence(reason: string | null): string {
  switch (reason) {
    case "volume_not_measured_on_channel":
      return "Not counted on this channel yet.";
    case "no_proactive_pipe":
      return "This campaign contacts nobody first.";
    default:
      if (reason) console.error("[sales-funnel-campaigns] no sentence for consumedUnavailableReason", { reason });
      return "Could not count this right now.";
  }
}

/** Whole positive dollars typed in a field, or null. */
export function parseWholeAmount(v: string): number | null {
  const t = v.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/**
 * The face of a campaign's name: features-service draws it from the NAME alone
 * (`GET /public/catalogue/faces/:name.svg`, `faceOf` = the URL-encoded name), served
 * through the dashboard's PUBLIC route (`/api/public/faces`), so a signed-out visitor
 * (the signup's campaign step) sees it too: `/api/v1/*` answers them with the sign-in
 * page (prod 2026-10-10: a broken image on the signup). A pure display lookup.
 */
export function funnelCampaignFaceSrc(name: string): string {
  return `/api/public/faces/${encodeURIComponent(name)}.svg`;
}

// ─── The funnel's TYPE words (owner 2026-10-10) ─────────────────────────────────────────────

/**
 * A Proactive campaign (at least one proactive pipe) asks "Max budget" / "Max volume"; a Reactive
 * one asks "Up to $X" / "Up to N <unit>". The type is features-service's, relayed by billing's caps
 * read: READ, never derived here. Null when not served (logged with billing's reason): neutral words.
 */
export type FunnelType = "proactive" | "reactive";

export function funnelTypeOf(caps: Pick<SalesFunnelCaps, "salesFunnelType" | "salesFunnelTypeUnavailableReason"> | null): FunnelType | null {
  const t = caps?.salesFunnelType ?? null;
  if (t === "proactive" || t === "reactive") return t;
  if (caps) console.error("[sales-funnel-campaigns] no funnel type served", { type: t, reason: caps.salesFunnelTypeUnavailableReason ?? null });
  return null;
}

export interface CapWords {
  /** The budget's field / cell label. */
  budget: string;
  /** The volume's field / cell label. */
  volume: string;
  /** Before a stated amount: "Max $50/week", "Up to $50/week". */
  prefix: string;
}

export function capWords(type: FunnelType | null): CapWords {
  if (type === "proactive") return { budget: "Max budget", volume: "Max volume", prefix: "Max " };
  if (type === "reactive") return { budget: "Budget", volume: "Volume", prefix: "Up to " };
  return { budget: "Budget", volume: "Volume", prefix: "" };
}

/** A stated budget in the type's words: "Max $50/week" (Proactive), "Up to $50/week" (Reactive). */
export function statedBudget(type: FunnelType | null, b: Pick<MaxBudget, "amountCents" | "period">): string {
  return `${capWords(type).prefix}${maxBudgetLabel(b)}`;
}

/**
 * What one unit of a max volume is, in words: billing's unit when it is stated, else the unit a
 * campaign of this type is counted in (billing counts a Proactive one in first contacts, a Reactive
 * one in prospects handled). A unit we have no words for is logged and printed as served.
 */
export function volumeUnitWords(unit: string | null, type: FunnelType | null, count: number): string {
  const u = unit ?? (type === "proactive" ? "first_contacts" : type === "reactive" ? "prospects_handled" : null);
  switch (u) {
    case "first_contacts":
      return count === 1 ? "new person" : "new people";
    case "prospects_handled":
      return count === 1 ? "lead handled" : "leads handled";
    case null:
      return count === 1 ? "person" : "people";
    default:
      console.error("[sales-funnel-campaigns] no words for volume unit", { unit: u });
      return u.replace(/_/g, " ");
  }
}

/** A stated volume in the type's words: "Max 200 new people/month", "Up to 50 leads handled/week". */
export function statedVolume(type: FunnelType | null, v: Pick<MaxVolume, "count" | "period" | "unit">): string {
  return `${capWords(type).prefix}${v.count.toLocaleString("en-US")} ${volumeUnitWords(v.unit, type, v.count)}${capPeriodSuffix(v.period)}`;
}
