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

/** One of OUR accounts that pays a vendor (costs-service's closed vocabulary, staff can grow it). */
export const PaymentSourceSchema = z.object({ key: z.string(), displayName: z.string(), domain: z.string().nullable() });
export type PaymentSource = z.infer<typeof PaymentSourceSchema>;
export const ProviderSourcesRowSchema = z.object({ provider: z.string(), providerDomain: z.string().nullable(), sources: z.array(PaymentSourceSchema) });
export type ProviderSourcesRow = z.infer<typeof ProviderSourcesRowSchema>;
export const ProviderSourcesListSchema = z.object({ providers: z.array(ProviderSourcesRowSchema) });

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

export const MONITORING_PAGES = ["cost/providers", "cost/spend", "price/billed", "price/current", "price/history", "margin", "emails"] as const;
export type MonitoringPage = (typeof MONITORING_PAGES)[number];

export function parseMonitoringPath(rest: string): MonitoringView {
  const clean = rest.replace(/^\/+|\/+$/g, "");
  if (!clean) return { view: "hub" };
  return (MONITORING_PAGES as readonly string[]).includes(clean) ? { view: "page", page: clean as MonitoringPage } : { view: "missing", rest: clean };
}
