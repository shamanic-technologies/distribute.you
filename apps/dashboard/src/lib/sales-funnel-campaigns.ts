/**
 * SALES FUNNEL CAMPAIGNS (owner 2026-10-10): a campaign is brand x offer x sales funnel, run or paused
 * as one; its UNITS are its pipes (one per leg x channel, each a campaign-service campaign with its own
 * workflow). campaign-service serves them (`/sales-funnel-campaigns`), billing-service serves each
 * funnel's caps (`/brands/:b/offers/:o/sales-funnels/:id/caps`), both through the gateway.
 *
 * Shapes only, as served; nothing is computed here. Alias-free so it carries real unit tests.
 */
import { z } from "zod";
import { ExpectedReturnSchema } from "./expected-return";

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
    // billing (owner 2026-10-11): FUNDED = a max budget AND/OR a max volume, each above 0. The one
    // answer to "may this funnel spend"; read it, never re-derive it from the caps. Optional until
    // every cached body carries it (an absent one reads as unknown, never as not funded).
    funded: z.boolean().optional(),
    fundedBy: z.string().nullish(),
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
  return `${capWords(type).prefix}${volumeLimitLabel(type, v)}`;
}

/** A max volume with no prefix, in the type's unit: "200 new people/month", "50 leads handled/week". */
export function volumeLimitLabel(type: FunnelType | null, v: Pick<MaxVolume, "count" | "period" | "unit">): string {
  return `${v.count.toLocaleString("en-US")} ${volumeUnitWords(v.unit, type, v.count)}${capPeriodSuffix(v.period)}`;
}

/**
 * A volume-only funnel's limit where its budget would sit: "100 new people/month" (no "Max", owner
 * 2026-10-11), "Up to 50 leads handled/week" for a Reactive one (as its budget reads "Up to $N").
 */
export function volumeFundingLabel(type: FunnelType | null, v: Pick<MaxVolume, "count" | "period" | "unit">): string {
  return `${type === "reactive" ? "Up to " : ""}${volumeLimitLabel(type, v)}`;
}

/**
 * billing's funding verdict (owner 2026-10-11: a max $ AND/OR a max volume). `false` = not funded
 * ("Not funded yet"); null = billing has not served it yet (logged; nothing is claimed either way).
 */
export function funnelFunded(caps: Pick<SalesFunnelCaps, "salesFunnelId" | "funded"> | null): boolean | null {
  if (caps === null) return null;
  if (caps.funded === undefined) {
    console.error("[sales-funnel-campaigns] funded not served", { salesFunnelId: caps.salesFunnelId });
    return null;
  }
  return caps.funded;
}

/**
 * The limit a funded funnel shows where one figure fits: its max budget when it states one, else its
 * max volume when billing says the volume alone funds it (no $ figure is ever made up). Null when
 * nothing funds it.
 */
export function fundingLimit(
  caps: Pick<SalesFunnelCaps, "maxBudget" | "maxVolume" | "fundedBy"> | null,
): { kind: "budget"; budget: MaxBudget } | { kind: "volume"; volume: MaxVolume } | null {
  if (!caps) return null;
  if (caps.maxBudget) return { kind: "budget", budget: caps.maxBudget };
  if (caps.maxVolume && caps.fundedBy === "max_volume") return { kind: "volume", volume: caps.maxVolume };
  return null;
}

// ─── The Campaigns table row (features-service, owner 2026-10-11) ───────────────────────────

/**
 * One sales funnel campaign as features-service serves it for the Campaigns table
 * (`GET /v1/features/brands/:brandId/sales-funnel-campaigns`): its type label ("Daily" or the
 * trigger), its PATH as structured items (steps, and the channel between the two steps of each leg
 * we run, ending at Paid client), its money invested since inception and its ROI. Everything is
 * served: the browser parses no id and adds nothing.
 */
const PathItemSchema = z.union([
  z.object({ kind: z.literal("step"), key: z.string(), label: z.string() }).passthrough(),
  z.object({ kind: z.literal("channel"), slug: z.string(), name: z.string() }).passthrough(),
  // A reactive path starts with its trigger (owner 2026-10-11), e.g. Positive Reply.
  z.object({ kind: z.literal("trigger"), slug: z.string(), name: z.string() }).passthrough(),
]);
export type FunnelPathItem = z.infer<typeof PathItemSchema>;

export const FunnelCampaignRowSchema = z
  .object({
    id: z.string(),
    salesFunnelId: z.string(),
    name: z.string(),
    status: z.string(),
    type: z.string().nullable(),
    typeLabel: z.string().nullable(),
    path: z.object({ items: z.array(PathItemSchema) }).passthrough().nullable(),
    copyUnavailableReason: z.string().nullish(),
    investedUsd: z.coerce.number().nullable(),
    roiMultiple: z.coerce.number().nullable(),
    moneyUnavailableReason: z.string().nullish(),
    costEconomics: z.object({ unmeasuredReason: z.string().nullish() }).passthrough().nullable(),
    // The producer's maturity verdict on the campaign's return (read, never re-graded).
    maturity: z.object({ isMature: z.boolean() }).passthrough().nullish(),
    // Why a null ROI is null on the pipeline side (`unpricedReason`, e.g. no_funnel_wired), served.
    headline: z.object({ unpricedReason: z.string().nullish() }).passthrough().nullish(),
    // The funnel campaign's EXPECTED return, never empty (features-service EXPECTED-ROI-1011).
    expectedReturn: ExpectedReturnSchema.nullish(),
  })
  .passthrough();
export type FunnelCampaignRow = z.infer<typeof FunnelCampaignRowSchema>;

export const FunnelCampaignRowsSchema = z.object({ salesFunnelCampaigns: z.array(FunnelCampaignRowSchema) }).passthrough();

/** Why a row's ROI is missing, as served (never guessed): the field name and the producer's reason. */
export function roiMissingReason(row: Pick<FunnelCampaignRow, "moneyUnavailableReason" | "costEconomics">): string | null {
  return row.moneyUnavailableReason ?? row.costEconomics?.unmeasuredReason ?? null;
}

/**
 * The ROI cell's value: features-service's `roiMultiple` under its own maturity verdict, the way every
 * v2 return reads (`shownReturn`): not mature and not above break-even yet = "Learning".
 */
export function funnelRoiShown(
  row: Pick<FunnelCampaignRow, "roiMultiple" | "maturity" | "costEconomics" | "headline" | "moneyUnavailableReason">,
): { learning: boolean; value: number | null; unpriced: string | null } {
  const roi = row.roiMultiple;
  const maturing = row.maturity?.isMature === false || row.costEconomics?.unmeasuredReason === "maturing";
  if (maturing && !(roi !== null && roi > 1)) return { learning: true, value: null, unpriced: null };
  if (roi !== null) return { learning: false, value: roi, unpriced: null };
  // A null ROI always carries its served reason (owner 2026-10-11: never a bare dash).
  const reason = row.headline?.unpricedReason ?? row.moneyUnavailableReason ?? row.costEconomics?.unmeasuredReason ?? null;
  return { learning: false, value: null, unpriced: reason };
}

/** A served reason for a missing ROI, in plain words. A reason we have no words for is logged. */
export function unpricedWords(reason: string | null): string {
  switch (reason) {
    case "no_funnel_wired":
    case "units_price_differently":
      return "Not priced yet";
    case null:
      return "Not priced yet";
    default:
      console.error("[sales-funnel-campaigns] no words for this ROI reason", { reason });
      return "Not priced yet";
  }
}


// ─── Campaigns table order (owner 2026-10-11) ─────────────────────────────────────────────

/**
 * A campaign's pipes in the order its funnel runs them (owner 2026-10-11: "in the right order of
 * the pipes"): each pipe's leg is linked from the step it starts on to the step it lands on, so
 * Start -> Lead found (sourcing) reads before Lead found -> Conversation (cold email) before
 * Conversation -> Paid client (closing). campaign-service serves the units in no stated order.
 * A pipe whose leg is unknown goes last; pipes on the same step keep the served order.
 */
export function orderPipesByFunnel<T>(units: readonly T[], legOf: (u: T) => { fromKey: string | null; toKey: string } | null): T[] {
  const legs = units.map(legOf);
  const toKeys = new Set(legs.flatMap((l) => (l ? [l.toKey] : [])));
  const depth = new Map<string, number>();
  const depthOf = (fromKey: string | null, seen: Set<string>): number => {
    if (fromKey === null || !toKeys.has(fromKey) || seen.has(fromKey)) return 0;
    const known = depth.get(fromKey);
    if (known !== undefined) return known;
    seen.add(fromKey);
    const parents = legs.flatMap((l) => (l && l.toKey === fromKey ? [depthOf(l.fromKey, seen)] : []));
    const d = 1 + Math.max(0, ...parents);
    depth.set(fromKey, d);
    return d;
  };
  const rank = legs.map((l) => (l ? depthOf(l.fromKey, new Set()) : Number.POSITIVE_INFINITY));
  return units
    .map((u, i) => ({ u, i }))
    .sort((a, b) => rank[a.i] - rank[b.i] || a.i - b.i)
    .map((x) => x.u);
}

const PERIOD_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

/**
 * A cap's amount per day, for ORDERING rows only (never printed): $70/week and $10/day rank
 * level. A total ("one_off") has no pace, so it returns null and ranks after every paced cap.
 */
export function capPerDay(amount: number, period: string): number | null {
  const days = PERIOD_DAYS[period];
  return days === undefined ? null : amount / days;
}

export interface FunnelSortKey {
  type: FunnelType | null;
  budget: { amount: number; period: string } | null;
  volume: { count: number; period: string } | null;
}

/** Bigger first: a paced cap by its per-day pace, then a total by its amount, then no cap. */
function compareCap(a: { amount: number; period: string } | null, b: { amount: number; period: string } | null): number {
  const rank = (c: typeof a) => (c === null ? 2 : capPerDay(c.amount, c.period) === null ? 1 : 0);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (a === null || b === null) return 0;
  const va = capPerDay(a.amount, a.period) ?? a.amount;
  const vb = capPerDay(b.amount, b.period) ?? b.amount;
  return vb - va;
}

/** Proactive first, then max budget (desc), then max volume (desc); ties keep the served order. */
export function compareFunnelCampaigns(a: FunnelSortKey, b: FunnelSortKey): number {
  const t = (k: FunnelSortKey) => (k.type === "proactive" ? 0 : k.type === "reactive" ? 1 : 2);
  return (
    t(a) - t(b) ||
    compareCap(a.budget, b.budget) ||
    compareCap(a.volume && { amount: a.volume.count, period: a.volume.period }, b.volume && { amount: b.volume.count, period: b.volume.period })
  );
}

/** The order's inputs, all served: the row's type (features-service, else billing's relay) and billing's limits. */
export function funnelSortKey(row: Pick<FunnelCampaignRow, "type"> | null, caps: SalesFunnelCaps | null): FunnelSortKey {
  const t = row?.type ?? caps?.salesFunnelType ?? null;
  const b = caps?.maxBudget ?? null;
  const usd = b ? centsToUsd(b.amountCents) : null;
  return {
    type: t === "proactive" || t === "reactive" ? t : null,
    budget: b && usd !== null ? { amount: usd, period: b.period } : null,
    volume: caps?.maxVolume ? { count: caps.maxVolume.count, period: caps.maxVolume.period } : null,
  };
}

/** Where two steps follow each other with no channel between them (a producer gap), by step labels. */
export function missingChannelGaps(items: readonly FunnelPathItem[]): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1];
    const b = items[i];
    if (a.kind === "step" && b.kind === "step") out.push({ from: a.label, to: b.label });
  }
  return out;
}

