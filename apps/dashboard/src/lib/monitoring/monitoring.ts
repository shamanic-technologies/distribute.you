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

/**
 * costs-service's real cost per credit of each vendor subscription (owner 2026-10-01): net paid
 * to the subscription's bank-ledger vendor(s) since 2026-01-01 over the credits consumed through
 * our own account. Money is null when no ledger line matches (unknown, never $0); a cost per
 * credit is null with a served reason. Every ratio and total is the producer's.
 */
const LedgerMoney = z.number().nullable();
export const SubscriptionCostsSchema = z.object({
  formula: z.string(),
  since: z.string(),
  asOf: z.string(),
  refreshedAt: z.string(),
  stale: z.boolean(),
  lastRefresh: z
    .object({ status: z.string(), asOf: z.string(), startedAt: z.string(), finishedAt: z.string().nullable(), error: z.string().nullable() })
    .nullable(),
  subscriptions: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      provider: z.string(),
      ledgerMatched: z.boolean(),
      ledgerNote: z.string().nullable(),
      ledgerVendors: z.array(
        z.object({
          key: z.string(),
          firstPaidOn: z.string().nullable(),
          lastPaidOn: z.string().nullable(),
          payments: z.number(),
          refunds: z.number(),
          paidUsd: z.number(),
          refundedUsd: z.number(),
          netUsd: z.number(),
        }),
      ),
      firstPaymentOn: z.string().nullable(),
      lastPaymentOn: z.string().nullable(),
      paidUsd: LedgerMoney,
      refundedUsd: LedgerMoney,
      netUsd: LedgerMoney,
      creditDefinition: z.string(),
      orgKeyUnitsCounted: z.boolean(),
      orgKeyUnitsNote: z.string().nullable(),
      credits: z.number(),
      costPerCreditUsdCents: z.number().nullable(),
      grossCostPerCreditUsdCents: z.number().nullable(),
      costPerCreditNullReason: z.string().nullable(),
      costItems: z.array(
        z.object({
          costName: z.string(),
          isCredit: z.boolean(),
          excludedReason: z.string().nullable(),
          quantityPlatformKey: z.number(),
          quantityOrgKey: z.number(),
          creditsCounted: z.number(),
          unit: z.string().nullable(),
          billedPricePerUnitInUsdCents: z.number().nullable(),
          vendorCostPerUnitInUsdCents: z.number().nullable(),
          catalogueNote: z.string().nullable(),
        }),
      ),
      monthly: z.array(
        z.object({
          month: z.string(),
          paidUsd: LedgerMoney,
          refundedUsd: LedgerMoney,
          netUsd: LedgerMoney,
          credits: z.number(),
          monthCostPerCreditUsdCents: z.number().nullable(),
          cumulativeNetUsd: LedgerMoney,
          cumulativeCredits: z.number(),
          costPerCreditUsdCents: z.number().nullable(),
          grossCostPerCreditUsdCents: z.number().nullable(),
        }),
      ),
      daily: z.array(
        z.object({
          day: z.string(),
          paidUsd: LedgerMoney,
          netUsd: LedgerMoney,
          credits: z.number(),
          cumulativePaidUsd: LedgerMoney,
          cumulativeNetUsd: LedgerMoney,
          cumulativeCredits: z.number(),
          costPerCreditUsdCents: z.number().nullable(),
          grossCostPerCreditUsdCents: z.number().nullable(),
        }),
      ),
    }),
  ),
});
export type SubscriptionCosts = z.infer<typeof SubscriptionCostsSchema>;
export type SubscriptionCost = SubscriptionCosts["subscriptions"][number];

/**
 * costs-service's real cost per unit of every cost item and the PROPOSED price (real cost x2 for
 * production tools, x1 for Stripe and media), per day since 2026-01-01 (owner 2026-10-01). Display
 * only until the owner's go: no catalogue price reads it. Methods, flags and bases are the
 * producer's vocabulary, read as strings and never re-graded here.
 */
const Num = z.number().nullable();
const RealCostFields = {
  costName: z.string(),
  // Null on a legacy cost name runs-service recorded that the catalogue no longer carries (prod, v0.71.3).
  provider: z.string().nullable(),
  method: z.string(),
  flag: z.string().nullable(),
  realCostPerUnitUsdCents: Num,
  ratio: Num,
  catalogueVendorCostPerUnitUsdCents: Num,
  cataloguePricePerUnitUsdCents: Num,
  catalogueMarkupOnRealCost: Num,
  multiplier: Num,
  proposedPricePerUnitUsdCents: Num,
  proposedBasis: z.string(),
  // `vendor-list-cost-floor` only (owner 2026-10-02): the averaged real cost x2 the vendor list cost replaced.
  averagedProposedPricePerUnitUsdCents: Num.optional(),
  proposedVsCataloguePct: Num,
};
/** One slice of a split vendor's bank money; only `loadedOnUnits` slices price a unit. */
const SplitPart = z.object({ part: z.string(), usdCents: z.number(), basis: z.string().nullable(), loadedOnUnits: z.boolean(), flag: z.string().nullable() });
const RefreshShape = z
  .object({ status: z.string(), asOf: z.string(), startedAt: z.string(), finishedAt: z.string().nullable(), error: z.string().nullable() })
  .nullable();
export const RealCostsSchema = z.object({
  formula: z.string(),
  rules: z
    .object({
      since: z.string(),
      proposedMultiplier: z.number(),
      passThroughMultiplier: z.number(),
      x1Rule: z.string(),
      payAsYouGoVendors: z.array(
        z.object({
          provider: z.string(),
          ledgerVendors: z.array(z.string()),
          ledgerVendorPrefix: z.string().nullable(),
          excludedLedgerVendors: z.array(z.object({ key: z.string(), reason: z.string() })),
        }),
      ),
      catalogueVendorCostProviders: z.record(z.string(), z.string()),
    })
    .passthrough(),
  day: z.string(),
  asOf: z.string(),
  refreshedAt: z.string(),
  stale: z.boolean(),
  lastRefresh: RefreshShape,
  payAsYouGo: z.array(
    z.object({
      provider: z.string(),
      ledgerVendors: z.array(z.string()),
      paidUsdCents: z.number(),
      refundedUsdCents: z.number(),
      netPaidUsdCents: z.number(),
      vendorCostRecordedUsdCents: z.number(),
      ratio: Num,
      // What the ratio's numerator is: the whole bank block ("ledger-net-paid") or only the metered part
      // of a split vendor (Google from its billing export, Twilio from its usage records).
      numeratorBasis: z.string(),
      meteredUsdCents: Num,
      // Owner 2026-10-01: an API is priced at list cost; what the bank paid beyond it is internal, outside clients.
      vendorCostRecordedAtListUsdCents: z.number(),
      internalCostUsdCents: z.number(),
      internalCostBasis: z.string(),
      split: z
        .object({
          parts: z.array(SplitPart),
          unexplained: SplitPart.omit({ part: true }),
        })
        .nullable(),
    }),
  ),
  items: z.array(z.object(RealCostFields)),
});
export type RealCosts = z.infer<typeof RealCostsSchema>;
export type RealCostItem = RealCosts["items"][number];
export const RealCostSeriesSchema = z.object({ costName: z.string(), daily: z.array(z.object({ day: z.string(), ...RealCostFields })) });
export type RealCostSeries = z.infer<typeof RealCostSeriesSchema>;

/** A price list for the comparison: a source and the day it is read at. */
export const PRICE_SOURCES = ["catalogue", "proposed"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];
export const COMPARISON_INTERVALS = ["day", "week", "month"] as const;
export type ComparisonInterval = (typeof COMPARISON_INTERVALS)[number];

const FiguresShape = {
  amount1UsdCents: z.number(),
  amount2UsdCents: z.number(),
  differenceUsdCents: z.number(),
  differencePct: Num,
  realCostUsdCents: z.number(),
  margin1UsdCents: z.number(),
  margin1Pct: Num,
  margin2UsdCents: z.number(),
  margin2Pct: Num,
  billedUsdCents: z.number(),
  netBilledUsdCents: z.number(),
  billedPlatformKeyUsdCents: z.number(),
  netBilledPlatformKeyUsdCents: z.number(),
};
const Figures = z.object(FiguresShape);
export type ComparisonFigures = z.infer<typeof Figures>;
const ListRef = z.object({ source: z.string(), date: z.string() });
/** costs-service's replay of a perimeter's consumption since inception under two price lists. */
export const PriceComparisonSchema = z.object({
  perimeter: z.object({ grain: z.string(), orgId: z.string().optional(), brandId: z.string().optional() }),
  list1: ListRef,
  list2: ListRef,
  interval: z.string(),
  consumptionAsOf: z.string(),
  stale: z.boolean(),
  notes: z.array(z.string()),
  totals: Figures,
  unpricedCostNames1: z.array(z.string()),
  unpricedCostNames2: z.array(z.string()),
  realCostUnknownCostNames: z.array(z.string()),
  buckets: z.array(z.object({ period: z.string(), ...FiguresShape, cumulative: Figures })),
  costItems: z.array(
    z.object({
      costName: z.string(),
      quantity: z.number(),
      quantityPlatformKey: z.number(),
      price1PerUnitUsdCents: Num,
      price2PerUnitUsdCents: Num,
      unpricedQuantity1: z.number(),
      unpricedQuantity2: z.number(),
      realCostUnknownQuantity: z.number(),
      ...FiguresShape,
    }),
  ),
  byOrg: z.array(z.object({ orgId: z.string().nullable(), ...FiguresShape })).nullable(),
  byBrand: z.array(z.object({ orgId: z.string().nullable(), brandId: z.string().nullable(), ...FiguresShape })).nullable(),
});
export type PriceComparison = z.infer<typeof PriceComparisonSchema>;

/** brand-service's cross-org brand list (staff): the names the comparison's org and brand ids are shown by. */
export const StaffBrandsSchema = z.object({
  brands: z.array(z.object({ id: z.string(), name: z.string().nullable(), domain: z.string().nullable(), orgId: z.string().nullable() }).passthrough()),
});
export type StaffBrand = z.infer<typeof StaffBrandsSchema>["brands"][number];

/**
 * costs-service's pricing-basis summary (owner 2026-10-01): which cost items are priced on an
 * AVERAGE (email infrastructure, subscriptions: bank money / units) and which at the vendor's
 * catalogue list cost (APIs), with the fleet's real cost and what it would bill at today's
 * catalogue and at the proposed list, plus what we paid API vendors beyond list cost (internal,
 * outside clients). Every figure is the producer's.
 */
export const BasisSummarySchema = z.object({
  day: z.string(),
  asOf: z.string(),
  stale: z.boolean(),
  rule: z.string(),
  bases: z.array(
    z.object({
      basis: z.string(),
      providers: z.array(z.string()),
      itemCount: z.number(),
      consumedItemCount: z.number(),
      // Subscription credits proposed at the vendor list cost because averaged x2 fell below it.
      flooredItemCount: z.number(),
      flooredItems: z.array(z.string()),
      realCostUsdCents: z.number(),
      amountCatalogueUsdCents: z.number(),
      amountProposedUsdCents: z.number(),
    }),
  ),
  totals: z.object(FiguresShape),
  unpricedCostNames2: z.array(z.string()),
  realCostUnknownCostNames: z.array(z.string()),
  internalCost: z.object({
    byVendor: z.array(
      z.object({ provider: z.string(), netPaidUsdCents: z.number(), vendorCostRecordedAtListUsdCents: z.number(), internalCostUsdCents: z.number(), internalCostBasis: z.string() }),
    ),
    totalUsdCents: z.number(),
  }),
});
export type BasisSummary = z.infer<typeof BasisSummarySchema>;

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
  | { view: "moved"; page: MonitoringPage }
  | { view: "missing"; rest: string };

export const MONITORING_PAGES = ["cost/providers", "cost/spend", "cost/subscriptions", "cost/email-sending", "price/billed", "price/new-pricing", "price/pricing-basis", "margin", "margin/pricing-comparison", "emails", "chat/skills"] as const;
export type MonitoringPage = (typeof MONITORING_PAGES)[number];

/** Retired URLs (owner 2026-10-01): links already shared keep landing on the page that absorbed them. */
export const MONITORING_MOVED: Record<string, MonitoringPage> = {
  "price/current": "price/billed",
  "price/history": "price/billed",
  "price/email-sending": "cost/email-sending",
};

export function parseMonitoringPath(rest: string): MonitoringView {
  const clean = rest.replace(/^\/+|\/+$/g, "");
  if (!clean) return { view: "hub" };
  if (MONITORING_MOVED[clean]) return { view: "moved", page: MONITORING_MOVED[clean] };
  return (MONITORING_PAGES as readonly string[]).includes(clean) ? { view: "page", page: clean as MonitoringPage } : { view: "missing", rest: clean };
}
