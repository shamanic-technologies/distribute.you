/**
 * The staff Monitoring page: what the platform cost us, what we billed, the margin between the
 * two, and the emails we sent, fleet-wide (every org) since inception.
 *
 * Every figure is served by its owner through staff-only gateway routes (api-service
 * `requireStaff`: platform key + a staff `x-email`, 403 otherwise), so nothing reaches a browser
 * that is not staff:
 * - runs-service margin read: billed gross/net, vendor cost, margin and unpriced remainder, as a
 *   total, per provider and per (provider, cost item). Margin is the producer's; this module never
 *   subtracts.
 * - costs-service vendor catalogue: every price version (billed unit price, vendor unit cost,
 *   markup) per cost item, since the first.
 * - instantly-service fleet stats: emails sent.
 *
 * Alias-free so it carries real unit tests.
 */
import { z } from "zod";

const Cents = z.string();

const MarginFiguresShape = {
  billedCostInUsdCents: Cents,
  netBilledCostInUsdCents: Cents,
  pricedBilledCostInUsdCents: Cents,
  netPricedBilledCostInUsdCents: Cents,
  vendorCostInUsdCents: Cents,
  marginCostInUsdCents: Cents,
  netMarginCostInUsdCents: Cents,
  unpricedBilledCostInUsdCents: Cents,
  netUnpricedBilledCostInUsdCents: Cents,
  refundedCostInUsdCents: Cents,
  vendorRefundedCostInUsdCents: Cents,
  unpricedRefundedCostInUsdCents: Cents,
  unpricedCostNames: z.array(z.string()),
};

export const CostMarginSchema = z.object({
  total: z.object(MarginFiguresShape),
  providers: z.array(z.object({ provider: z.string().nullable(), ...MarginFiguresShape })),
  costItems: z.array(z.object({ provider: z.string().nullable(), costName: z.string(), ...MarginFiguresShape })),
});
export type CostMargin = z.infer<typeof CostMarginSchema>;
export type MarginFigures = CostMargin["total"];
export type ProviderMargin = CostMargin["providers"][number];
export type CostItemMargin = CostMargin["costItems"][number];

const UnitCents = z.coerce.number().nullable();

export const PriceVersionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  planTier: z.string().nullable(),
  billingCycle: z.string().nullable(),
  unit: z.string().nullable(),
  billedPricePerUnitInUsdCents: UnitCents,
  vendorCostPerUnitInUsdCents: UnitCents,
  vendorCostKnown: z.boolean(),
  markupMultiplier: UnitCents,
  reconstructed: z.boolean(),
  effectiveFrom: z.string(),
  createdAt: z.string(),
});
export const PriceVersionsSchema = z.object({ versions: z.array(PriceVersionSchema) });
export type PriceVersion = z.infer<typeof PriceVersionSchema>;

/** The public catalogue's current billed price per cost item: costs-service decides which version is in force. */
export const CurrentPriceSchema = z.object({
  name: z.string(),
  provider: z.string(),
  // Null in prod on the sponsorship spend items (no vendor site to show).
  providerDomain: z.string().nullable(),
  pricePerUnitInUsdCents: z.coerce.number(),
  unit: z.string().nullish(),
  effectiveFrom: z.string().nullish(),
});
export const CurrentPricesSchema = z.array(CurrentPriceSchema);
export type CurrentPrice = z.infer<typeof CurrentPriceSchema>;

/** The fleet's email counters (instantly-service public stats, no org scoping): every email
 *  sent (follow-ups included) and the people they went to. */
export const FleetEmailStatsSchema = z.object({
  emailStats: z.object({ sent: z.coerce.number() }).passthrough(),
  recipientStats: z.object({ sent: z.coerce.number() }).passthrough(),
});
export type FleetEmailStats = z.infer<typeof FleetEmailStatsSchema>;

/**
 * runs-service's monthly margin series: every provider, every UTC month from the first cost row
 * to the current one (dense, zeros where a provider had no row), same rows and basis as the
 * margin read, so a provider's months sum to its margin row. `complete` is false for the month
 * in progress: the producer's verdict, never re-derived from a clock here.
 */
export const MarginTimeseriesSchema = z.object({
  interval: z.literal("month"),
  timezone: z.string(),
  periods: z.array(z.string()),
  providers: z.array(
    z.object({
      provider: z.string().nullable(),
      buckets: z.array(z.object({ period: z.string(), complete: z.boolean(), ...MarginFiguresShape })),
    }),
  ),
});
export type MarginTimeseries = z.infer<typeof MarginTimeseriesSchema>;
export type ProviderMonth = MarginTimeseries["providers"][number]["buckets"][number];

/**
 * One of OUR accounts that paid a vendor, as costs-service reads it from the bank ledger
 * (admin.kevinlourd.com owns the accounts; nothing here is typed by hand).
 */
export const PaidFromSchema = z.object({
  accountId: z.string(),
  label: z.string(),
  institutionDomain: z.string().nullable(),
  scope: z.enum(["personal", "business"]),
  lastPaidOn: z.string().nullable(),
});
export type PaidFrom = z.infer<typeof PaidFromSchema>;
/** `unmatched` = the ledger knows no vendor for this provider: shown as such, never as "nobody pays it". */
export const ProviderSourcesRowSchema = z.object({
  provider: z.string(),
  providerDomain: z.string().nullable(),
  match: z.enum(["matched", "unmatched"]),
  lastPaidOn: z.string().nullable(),
  paidFrom: z.array(PaidFromSchema),
});
export type ProviderSourcesRow = z.infer<typeof ProviderSourcesRowSchema>;
export const ProviderSourcesListSchema = z.object({ ledgerGeneratedAt: z.string(), providers: z.array(ProviderSourcesRowSchema) });

/**
 * instantly-service's emails sent per UTC period, by purpose: what reached leads apart from
 * our own mail (warmup, warmup replies, inbox-placement seeds). Dense, oldest first, the last
 * period flagged `inProgress` by the producer (never re-derived from a clock here).
 */
export const SENT_GRAINS = ["day", "week", "month"] as const;
export type SentGrain = (typeof SENT_GRAINS)[number];
const SentCountsShape = {
  toLeads: z.number(),
  manualReplies: z.number(),
  warmup: z.number(),
  warmupReplies: z.number(),
  seeds: z.number(),
};
export const SentPerPeriodSchema = z.object({
  grain: z.enum(SENT_GRAINS),
  timezone: z.string(),
  asOf: z.string(),
  totals: z.object(SentCountsShape),
  periods: z.array(z.object({ periodStart: z.string(), periodEnd: z.string(), inProgress: z.boolean(), leadsEmailed: z.number(), ...SentCountsShape })),
});
export type SentPerPeriod = z.infer<typeof SentPerPeriodSchema>;
export type SentPeriod = SentPerPeriod["periods"][number];

/**
 * costs-service's price of ONE cold email sent to a lead (owner formula, 2026-10-01): everything
 * ever paid to the email-infrastructure vendors (read from the bank ledger) over every email ever
 * sent to a lead (instantly-service), recomputed daily and kept as a dense per-day history.
 * Spend is NET (paid minus refunded; a refund day can be negative), gross served beside it.
 * Display only: no billed price reads it. Every figure, ratio and running total is the
 * producer's; prices are null over zero emails or a negative net spend, never 0.
 */
const Usd = z.number();
const PriceCents = z.number().nullable();
export const EmailSendPriceSchema = z.object({
  formula: z.string(),
  asOf: z.string(),
  refreshedAt: z.string(),
  stale: z.boolean(),
  lastRefresh: z
    .object({
      status: z.enum(["running", "succeeded", "failed"]),
      asOf: z.string(),
      startedAt: z.string(),
      finishedAt: z.string().nullable(),
      error: z.string().nullable(),
    })
    .nullable(),
  currentPriceUsdCents: PriceCents,
  currentGrossPriceUsdCents: PriceCents,
  currentMonthPriceUsdCents: PriceCents,
  totals: z.object({ spendUsd: Usd, paidUsd: Usd, refundedUsd: Usd, emailsToLeads: z.number() }),
  firstPaymentOn: z.string().nullable(),
  firstSendOn: z.string().nullable(),
  vendors: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      what: z.string(),
      firstPaidOn: z.string().nullable(),
      lastPaidOn: z.string().nullable(),
      payments: z.number(),
      refunds: z.number(),
      paidUsd: Usd,
      refundedUsd: Usd,
      netUsd: Usd,
    }),
  ),
  excludedVendors: z.array(z.object({ key: z.string(), reason: z.string() })),
  monthly: z.array(
    z.object({
      month: z.string(),
      spendUsd: Usd,
      spendByVendorUsd: z.record(z.string(), Usd),
      paidUsd: Usd,
      refundedUsd: Usd,
      emailsToLeads: z.number(),
      monthPriceUsdCents: PriceCents,
      cumulativeSpendUsd: Usd,
      cumulativeEmailsToLeads: z.number(),
      priceUsdCents: PriceCents,
      cumulativePaidUsd: Usd,
      grossPriceUsdCents: PriceCents,
    }),
  ),
  daily: z.array(
    z.object({
      day: z.string(),
      spendUsd: Usd,
      emailsToLeads: z.number(),
      cumulativeSpendUsd: Usd,
      cumulativeEmailsToLeads: z.number(),
      priceUsdCents: PriceCents,
      cumulativePaidUsd: Usd,
      grossPriceUsdCents: PriceCents,
      monthToDateSpendUsd: Usd,
      monthToDateEmailsToLeads: z.number(),
      monthPriceUsdCents: PriceCents,
    }),
  ),
});
export type EmailSendPrice = z.infer<typeof EmailSendPriceSchema>;
export type EmailSendPriceDay = EmailSendPrice["daily"][number];

/** Every price version of one cost item, oldest first. */
export function versionsOf(versions: PriceVersion[], name: string): PriceVersion[] {
  return versions
    .filter((v) => v.name === name)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * The catalogue version behind a current price: the same cost item at the same billed unit price,
 * the latest one in force. A LOOKUP by (name, billed unit price), the key costs-service documents
 * for this join; null when none matches, never a guess.
 */
export function versionInForce(versions: PriceVersion[], price: CurrentPrice): PriceVersion | null {
  const now = new Date().toISOString();
  const hits = versionsOf(versions, price.name).filter(
    (v) => !v.reconstructed && v.billedPricePerUnitInUsdCents === price.pricePerUnitInUsdCents && v.effectiveFrom <= now,
  );
  return hits.at(-1) ?? null;
}

/** The cost item names in the catalogue, with their version count, in name order. */
export function costItemNames(versions: PriceVersion[]): { name: string; provider: string; versions: number }[] {
  const by = new Map<string, { name: string; provider: string; versions: number }>();
  for (const v of versions) {
    const row = by.get(v.name) ?? { name: v.name, provider: v.provider, versions: 0 };
    row.versions += 1;
    row.provider = v.provider;
    by.set(v.name, row);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type MonitoringView =
  | { view: "hub" }
  | { view: "page"; page: MonitoringPage }
  | { view: "missing"; rest: string };

export const MONITORING_PAGES = ["cost/providers", "cost/spend", "price/billed", "price/current", "price/history", "price/email-sending", "margin", "emails"] as const;
export type MonitoringPage = (typeof MONITORING_PAGES)[number];

export function parseMonitoringPath(rest: string): MonitoringView {
  const clean = rest.replace(/^\/+|\/+$/g, "");
  if (!clean) return { view: "hub" };
  return (MONITORING_PAGES as readonly string[]).includes(clean) ? { view: "page", page: clean as MonitoringPage } : { view: "missing", rest: clean };
}
