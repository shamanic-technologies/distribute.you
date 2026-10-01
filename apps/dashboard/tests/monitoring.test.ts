import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CostMarginSchema,
  CurrentPricesSchema,
  FleetEmailStatsSchema,
  MONITORING_PAGES,
  MarginTimeseriesSchema,
  ProviderSourcesListSchema,
  SentPerPeriodSchema,
  PriceVersionsSchema,
  EmailSendPriceSchema,
  SubscriptionCostsSchema,
  RealCostsSchema,
  PriceComparisonSchema,
  costItemNames,
  parseMonitoringPath,
  versionInForce,
  versionsOf,
  type PriceVersion,
} from "../src/lib/monitoring/monitoring";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const figures = {
  billedCostInUsdCents: "1000.0000000000",
  netBilledCostInUsdCents: "900.0000000000",
  pricedBilledCostInUsdCents: "800.0000000000",
  netPricedBilledCostInUsdCents: "720.0000000000",
  vendorCostInUsdCents: "400.0000000000",
  marginCostInUsdCents: "400.0000000000",
  netMarginCostInUsdCents: "320.0000000000",
  unpricedBilledCostInUsdCents: "200.0000000000",
  netUnpricedBilledCostInUsdCents: "180.0000000000",
  refundedCostInUsdCents: "0",
  vendorRefundedCostInUsdCents: "0",
  unpricedRefundedCostInUsdCents: "0",
  unpricedCostNames: ["instantly-email-send"],
};

const version = (o: Partial<PriceVersion> & { name: string; effectiveFrom: string }): PriceVersion => ({
  id: `${o.name}-${o.effectiveFrom}`,
  provider: "anthropic",
  planTier: null,
  billingCycle: null,
  unit: "token",
  billedPricePerUnitInUsdCents: 0.3,
  vendorCostPerUnitInUsdCents: 0.2,
  vendorCostKnown: true,
  markupMultiplier: 1.5,
  reconstructed: false,
  createdAt: o.effectiveFrom,
  ...o,
});

describe("monitoring: the producers' shapes parse", () => {
  it("runs-service margin read (total, providers, cost items; null provider allowed)", () => {
    const parsed = CostMarginSchema.parse({
      total: figures,
      providers: [{ provider: "anthropic", ...figures }, { provider: null, ...figures }],
      costItems: [{ provider: "anthropic", costName: "anthropic-sonnet-input", ...figures }],
    });
    expect(parsed.providers[1].provider).toBeNull();
    expect(parsed.total.netMarginCostInUsdCents).toBe("320.0000000000");
  });
  it("costs-service vendor catalogue: numeric strings coerce, unknown vendor cost stays null", () => {
    const parsed = PriceVersionsSchema.parse({
      versions: [
        { ...version({ name: "a", effectiveFrom: "2026-01-01T00:00:00Z" }), billedPricePerUnitInUsdCents: "0.3000000000", vendorCostPerUnitInUsdCents: null, markupMultiplier: null, vendorCostKnown: false, vendorCostUnknownReason: "not-yet-stated" },
      ],
    });
    expect(parsed.versions[0].billedPricePerUnitInUsdCents).toBe(0.3);
    expect(parsed.versions[0].vendorCostPerUnitInUsdCents).toBeNull();
  });
});

describe("monitoring: prod quirks seen on the first real read", () => {
  it("a null providerDomain does not reject the whole price catalogue", () => {
    expect(CurrentPricesSchema.parse([{ name: "podcast-sponsorship-spend", provider: "podcast-sponsorship", providerDomain: null, pricePerUnitInUsdCents: "100" }])[0].providerDomain).toBeNull();
  });
  it("emails reads both counters: every email, and the people they went to", () => {
    const s = FleetEmailStatsSchema.parse({ recipientStats: { sent: 49158, contacted: 1 }, emailStats: { sent: 161911, opened: 2 } });
    expect([s.emailStats.sent, s.recipientStats.sent]).toEqual([161911, 49158]);
  });
});

describe("monitoring: lookups, never arithmetic on money", () => {
  const vs = [
    version({ name: "b", effectiveFrom: "2026-03-01T00:00:00Z", billedPricePerUnitInUsdCents: 0.4 }),
    version({ name: "b", effectiveFrom: "2026-01-01T00:00:00Z" }),
    version({ name: "b", effectiveFrom: "2026-02-01T00:00:00Z", reconstructed: true }),
    version({ name: "a", effectiveFrom: "2026-01-01T00:00:00Z", provider: "instantly" }),
  ];
  it("versionsOf lists one item's versions oldest first", () => {
    expect(versionsOf(vs, "b").map((v) => v.effectiveFrom)).toEqual(["2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", "2026-03-01T00:00:00Z"]);
  });
  it("versionInForce matches name AND billed unit price, skips reconstructed rows, null when nothing matches", () => {
    const cur = (pricePerUnitInUsdCents: number) => ({ name: "b", provider: "anthropic", providerDomain: "anthropic.com", pricePerUnitInUsdCents });
    expect(versionInForce(vs, cur(0.4))?.effectiveFrom).toBe("2026-03-01T00:00:00Z");
    expect(versionInForce(vs, cur(0.3))?.effectiveFrom).toBe("2026-01-01T00:00:00Z");
    expect(versionInForce(vs, cur(9))).toBeNull();
  });
  it("costItemNames counts versions per item, name order", () => {
    expect(costItemNames(vs)).toEqual([
      { name: "a", provider: "instantly", versions: 1 },
      { name: "b", provider: "anthropic", versions: 3 },
    ]);
  });
  it("parses every page path, the hub, and an unknown path", () => {
    expect(parseMonitoringPath("")).toEqual({ view: "hub" });
    for (const p of MONITORING_PAGES) expect(parseMonitoringPath(`/${p}/`)).toEqual({ view: "page", page: p });
    expect(parseMonitoringPath("/nope")).toEqual({ view: "missing", rest: "nope" });
  });
  it("the page formats money and never subtracts or divides it", () => {
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).not.toMatch(/CostInUsdCents\)?\s*[-/]\s*Number|Number\([^)]*CostInUsdCents\)\s*[-+/*]/);
    expect(page).not.toContain("reduce(");
  });
});

describe("monitoring: wears Research's anatomy", () => {
  it("a card is the link (no Open footer), carries its section mark, colour and two inset cells", () => {
    const page = read("components/v2/monitoring-page.tsx");
    const card = page.slice(page.indexOf("function Card("));
    expect(card).not.toMatch(/>\s*Open\s*</);
    expect(card).toContain("<SectionMark section={meta.section} />");
    expect(card).toContain("style={{ color: look.color }}");
    expect(card).toContain("k-inset mt-4 grid grid-cols-2");
    for (const k of ["cost", "price", "margin", "emails"]) expect(page).toContain(`<Section section="${k}"`);
  });
});

describe("monitoring: staff only, end to end", () => {
  it("both routes sit behind StaffOnly", () => {
    for (const f of ["page.tsx", "[...path]/page.tsx"]) {
      const src = read(`app/(authed)/v2/orgs/[orgId]/brands/[brandId]/monitoring/${f}`);
      expect(src).toContain("<StaffOnly>");
      expect(src).toContain("<V2Monitoring />");
    }
  });
  it("the account menu lists Monitoring in staff mode only, right above Research", () => {
    const menu = read("components/v2/sidebar-menus.tsx");
    const mon = menu.indexOf('label: "Monitoring"');
    const res = menu.indexOf('label: "Research"');
    expect(mon).toBeGreaterThan(-1);
    expect(mon).toBeLessThan(res);
    expect(menu.slice(menu.lastIndexOf("\n", mon), mon)).toContain("...(staffMode ?");
  });
  it("its reads are the staff gateway routes, and none is written to disk", () => {
    const api = read("lib/api.ts");
    for (const k of ["STAFF_MONITORING_PATHS.margin", "STAFF_MONITORING_PATHS.priceVersions", "STAFF_MONITORING_PATHS.emails"]) expect(api).toContain(k);
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    for (const root of ["staffCostMargin", "staffPriceVersions", "staffCurrentPrices", "staffEmailsSent", "staffMarginTimeseries", "staffProviderSources"]) {
      expect(sensitive).toContain(`"${root}"`);
      expect(read("components/v2/monitoring-page.tsx") + read("components/v2/monitoring-providers.tsx")).toContain(`["${root}"]`);
    }
  });
});

describe("monitoring: providers table and drawer", () => {
  it("runs-service's monthly series parses (dense periods, the month in progress marked incomplete)", () => {
    const { unpricedCostNames, ...money } = figures;
    const parsed = MarginTimeseriesSchema.parse({
      interval: "month",
      timezone: "UTC",
      periods: ["2026-09-01", "2026-10-01"],
      providers: [
        { provider: "instantly", buckets: [{ period: "2026-09-01", complete: true, ...money, unpricedCostNames }, { period: "2026-10-01", complete: false, ...money, unpricedCostNames: [] }] },
        { provider: null, buckets: [] },
      ],
    });
    expect(parsed.providers[0].buckets.map((b) => b.complete)).toEqual([true, false]);
  });
  it("costs-service's per-provider sources parse (read from the bank ledger, unmatched stated)", () => {
    const rows = ProviderSourcesListSchema.parse({
      ledgerGeneratedAt: "2026-10-01T12:00:00Z",
      providers: [
        { provider: "anthropic", providerDomain: "anthropic.com", match: "matched", lastPaidOn: "2026-09-30", paidFrom: [{ accountId: "a1", label: "Qonto", institutionDomain: "qonto.com", scope: "business", lastPaidOn: "2026-09-30" }] },
        { provider: "x", providerDomain: null, match: "unmatched", lastPaidOn: null, paidFrom: [] },
      ],
    }).providers;
    expect(rows[1].match).toBe("unmatched");
    expect(rows[0].paidFrom[0].scope).toBe("business");
    expect(read("components/v2/monitoring-providers.tsx")).toContain("Not found in the bank");
  });
  it("Providers and Spend both list providers through the one table, which carries a Sources column and opens a drawer", () => {
    const page = read("components/v2/monitoring-page.tsx");
    for (const fn of ["function ProvidersPage(", "function SpendPage("]) {
      const body = page.slice(page.indexOf(fn), page.indexOf("\n}\n", page.indexOf(fn)));
      expect(body).toContain("<ProvidersTable");
    }
    const table = read("components/v2/monitoring-providers.tsx");
    expect(table).toContain("<th className={TH}>Sources</th>");
    expect(table).toContain("<ProviderDrawer");
    expect(table).toContain("<MonthlyCost provider={row.provider} />");
  });
  it("who pays a vendor is read, never edited here (the bank ledger owns it, owner 2026-10-01)", () => {
    const api = read("lib/api.ts");
    expect(api).not.toContain("setStaffProviderSources");
    expect(api).not.toContain('method: "PUT", body: { sources }');
    expect(read("components/v2/monitoring-providers.tsx")).not.toContain("aria-pressed");
  });
  it("Spend lists only providers with spend, so its counts match its table; Providers adds the catalogue", () => {
    const page = read("components/v2/monitoring-page.tsx");
    const spend = page.slice(page.indexOf("function SpendPage("), page.indexOf("\n}\n", page.indexOf("function SpendPage(")));
    expect(spend).toContain("catalogue={false}");
    const providers = page.slice(page.indexOf("function ProvidersPage("), page.indexOf("function SpendPage("));
    expect(providers).toContain("<Loaded q={versions}>");
    expect(providers).toContain("marginError={margin.isError}");
  });
  it("row keys stand down while the drawer is open and on a focused control", () => {
    const table = read("components/v2/monitoring-providers.tsx");
    const keys = table.slice(table.indexOf("// J/K move"), table.indexOf("const openRow"));
    expect(keys).toContain("if (open !== undefined) return;");
    expect(keys).toContain('t.tagName === "BUTTON"');
  });
  it("the month drawn dashed is the one runs-service marks incomplete, never one read off a clock", () => {
    const table = read("components/v2/monitoring-providers.tsx");
    const chart = table.slice(table.indexOf("function MonthlyCost("), table.indexOf("// ─── Sources editor"));
    expect(chart).toContain("b.complete");
    expect(chart).toContain("dashed");
    expect(chart).not.toMatch(/new Date\(\)|useClientClock/);
  });
  it("the table formats money and never subtracts, sums or divides it", () => {
    const table = read("components/v2/monitoring-providers.tsx");
    expect(table).not.toMatch(/CostInUsdCents\)?\s*[-+/]\s*Number|Number\([^)]*CostInUsdCents\)\s*[-+/*]/);
    expect(table).not.toContain("reduce(");
  });
  it("the reads go through the staff gateway paths", () => {
    const api = read("lib/api.ts");
    for (const k of ["STAFF_MONITORING_PATHS.marginTimeseries", "STAFF_MONITORING_PATHS.providerSources"]) expect(api).toContain(k);
  });
});

describe("monitoring: emails per period", () => {
  it("instantly-service's per-period series parses (purposes apart, the current period flagged)", () => {
    const counts = { toLeads: 10, manualReplies: 1, warmup: 5, warmupReplies: 2, seeds: 3 };
    const parsed = SentPerPeriodSchema.parse({
      grain: "week",
      timezone: "UTC",
      since: null,
      asOf: "2026-10-01T12:00:00Z",
      totals: counts,
      periods: [
        { periodStart: "2026-09-22", periodEnd: "2026-09-29", inProgress: false, leadsEmailed: 9, ...counts },
        { periodStart: "2026-09-29", periodEnd: "2026-10-06", inProgress: true, leadsEmailed: 4, ...counts },
      ],
    });
    expect(parsed.periods.map((p) => p.inProgress)).toEqual([false, true]);
  });
  it("the Emails page is bar charts with a Daily/Weekly/Monthly switch, leads apart from our own mail (owner 2026-10-01)", () => {
    const page = read("components/v2/monitoring-page.tsx");
    const body = page.slice(page.indexOf("function EmailsPage("), page.indexOf("\n}\n", page.indexOf("function EmailsPage(")));
    expect(body).toContain("<EmailsCharts />");
    const charts = read("components/v2/monitoring-emails.tsx");
    for (const label of ['day: "Daily"', 'week: "Weekly"', 'month: "Monthly"', "Sent to leads", "Our own mail"]) expect(charts).toContain(label);
    expect(charts).toContain('["staffSentPerPeriod", grain]');
    expect(read("lib/persist-cache.ts")).toContain('"staffSentPerPeriod"');
  });
  it("the dashed period is the producer's inProgress, never a clock", () => {
    const charts = read("components/v2/monitoring-emails.tsx");
    expect(charts).toContain("p.inProgress");
    expect(charts).toContain("dashed");
    expect(charts).not.toMatch(/new Date\(\)|useClientClock/);
  });
  it("reads through the staff gateway path", () => {
    expect(read("lib/api.ts")).toContain("STAFF_MONITORING_PATHS.sentPerPeriod");
  });
});

describe("monitoring: price of one cold email (owner formula 2026-10-01)", () => {
  const day = (d: string, over: Record<string, unknown> = {}) => ({
    day: d,
    spendUsd: 0,
    emailsToLeads: 0,
    cumulativeSpendUsd: 62.42,
    cumulativeEmailsToLeads: 0,
    priceUsdCents: null,
    cumulativePaidUsd: 62.42,
    grossPriceUsdCents: null,
    monthToDateSpendUsd: 62.42,
    monthToDateEmailsToLeads: 0,
    monthPriceUsdCents: null,
    ...over,
  });
  const body = {
    formula: "net paid to email-infrastructure vendors since inception / emails sent to leads since inception",
    asOf: "2026-10-01",
    refreshedAt: "2026-10-01T14:10:00.000Z",
    stale: false,
    lastRefresh: { status: "succeeded", asOf: "2026-10-01", startedAt: "2026-10-01T14:09:58.000Z", finishedAt: "2026-10-01T14:10:00.000Z", error: null },
    currentPriceUsdCents: 3.06,
    currentGrossPriceUsdCents: 3.34,
    currentMonthPriceUsdCents: null,
    totals: { spendUsd: 4775.1, paidUsd: 5204.3, refundedUsd: 429.2, emailsToLeads: 155907 },
    firstPaymentOn: "2026-01-27",
    firstSendOn: "2026-02-19",
    vendors: [
      { key: "instantly", label: "Instantly", what: "Sending platform", firstPaidOn: "2026-02-05", lastPaidOn: "2026-09-16", payments: 23, refunds: 0, paidUsd: 2456.1, refundedUsd: 0, netUsd: 2456.1 },
      { key: "forge", label: "Forge", what: "Mailboxes", firstPaidOn: "2026-06-26", lastPaidOn: "2026-09-29", payments: 19, refunds: 3, paidUsd: 2259.2, refundedUsd: 429.2, netUsd: 1830 },
    ],
    excludedVendors: [{ key: "google workspace", reason: "personal and press mailboxes, not cold-email infrastructure" }],
    monthly: [
      { month: "2026-01", spendUsd: 62.42, spendByVendorUsd: { "gandi order": 62.42 }, paidUsd: 62.42, refundedUsd: 0, emailsToLeads: 0, monthPriceUsdCents: null, cumulativeSpendUsd: 62.42, cumulativeEmailsToLeads: 0, priceUsdCents: null, cumulativePaidUsd: 62.42, grossPriceUsdCents: null },
      { month: "2026-09", spendUsd: 900.5, spendByVendorUsd: { forge: -120, instantly: 1020.5 }, paidUsd: 1450, refundedUsd: 549.5, emailsToLeads: 40066, monthPriceUsdCents: 2.25, cumulativeSpendUsd: 4775.1, cumulativeEmailsToLeads: 155085, priceUsdCents: 3.08, cumulativePaidUsd: 5204.3, grossPriceUsdCents: 3.36 },
    ],
    daily: [day("2026-01-27"), day("2026-10-01", { spendUsd: -12.5, emailsToLeads: 822, priceUsdCents: 3.06, grossPriceUsdCents: 3.34 })],
  };

  it("costs-service's series parses: net beside gross, prices null over zero emails, a negative refund day kept", () => {
    const p = EmailSendPriceSchema.parse(body);
    expect(p.currentPriceUsdCents).toBe(3.06);
    expect(p.currentGrossPriceUsdCents).toBe(3.34);
    expect(p.daily[0].priceUsdCents).toBeNull();
    expect(p.daily[1].spendUsd).toBe(-12.5);
    expect(p.monthly[1].spendByVendorUsd.forge).toBe(-120);
    expect(EmailSendPriceSchema.safeParse({ ...body, lastRefresh: null, stale: true }).success).toBe(true);
  });

  it("is a Price card and its own page, read through the staff gateway, never written to disk", () => {
    expect(MONITORING_PAGES).toContain("price/email-sending");
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('page="price/email-sending"');
    expect(page).toContain('{view.page === "price/email-sending" && <EmailSendingPage />}');
    expect(page).toContain('["staffEmailSendPrice"]');
    expect(read("lib/api.ts")).toContain("STAFF_MONITORING_PATHS.emailSendPrice");
    const persist = read("lib/persist-cache.ts");
    expect(persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"))).toContain('"staffEmailSendPrice"');
  });

  it("the page draws the producer's prices and never divides spend by emails itself", () => {
    const view = read("components/v2/monitoring-email-price.tsx");
    expect(view).not.toMatch(/[sS]pend\w*Usd\s*\//);
    expect(view).not.toMatch(/\/\s*[\w.]*[eE]mailsToLeads/);
    for (const k of ["priceUsdCents", "grossPriceUsdCents"]) expect(view).toContain(`key: "${k}"`);
  });

  it("carries the owner's anatomy: price chart, spend per vendor, monthly table, vendors, timeline, billed before", () => {
    const view = read("components/v2/monitoring-email-price.tsx");
    for (const s of ["<PriceChart", "<SpendChart", "<MonthlyTable", "<VendorsTable", "<Timeline", "<BilledBefore"]) expect(view).toContain(s);
  });
});

describe("monitoring: real cost per credit of each subscription (owner 2026-10-01)", () => {
  const sub = (over: Record<string, unknown> = {}) => ({
    key: "apollo",
    label: "Apollo",
    provider: "apollo",
    ledgerMatched: true,
    ledgerNote: null,
    ledgerVendors: [{ key: "apollo io", firstPaidOn: "2026-01-28", lastPaidOn: "2026-09-29", payments: 39, refunds: 0, paidUsd: 1761.2, refundedUsd: 0, netUsd: 1761.2 }],
    firstPaymentOn: "2026-01-28",
    lastPaymentOn: "2026-09-29",
    paidUsd: 1761.2,
    refundedUsd: 0,
    netUsd: 1761.2,
    creditDefinition: "apollo-credit + apollo-enrichment-credit + apollo-person-match-credit",
    orgKeyUnitsCounted: false,
    orgKeyUnitsNote: null,
    credits: 61007,
    costPerCreditUsdCents: 2.887,
    grossCostPerCreditUsdCents: 2.887,
    costPerCreditNullReason: null,
    costItems: [
      { costName: "apollo-credit", isCredit: true, excludedReason: null, quantityPlatformKey: 47833, quantityOrgKey: 0, creditsCounted: 47833, unit: "credit", billedPricePerUnitInUsdCents: 8.5, vendorCostPerUnitInUsdCents: 2.1, catalogueNote: null },
      { costName: "apollo-search-credit", isCredit: false, excludedReason: "Apollo does not deduct credits for search", quantityPlatformKey: 1589, quantityOrgKey: 0, creditsCounted: 0, unit: null, billedPricePerUnitInUsdCents: null, vendorCostPerUnitInUsdCents: null, catalogueNote: "not in the catalogue" },
    ],
    monthly: [{ month: "2026-09", paidUsd: 300, refundedUsd: 0, netUsd: 300, credits: 9000, monthCostPerCreditUsdCents: 3.33, cumulativeNetUsd: 1761.2, cumulativeCredits: 61007, costPerCreditUsdCents: 2.887, grossCostPerCreditUsdCents: 2.887 }],
    daily: [{ day: "2026-10-01", paidUsd: 0, netUsd: 0, credits: 120, cumulativePaidUsd: 1761.2, cumulativeNetUsd: 1761.2, cumulativeCredits: 61007, costPerCreditUsdCents: 2.887, grossCostPerCreditUsdCents: 2.887 }],
    ...over,
  });
  const body = {
    formula: "net paid since 2026-01-01 / credits consumed through our own account since 2026-01-01",
    since: "2026-01-01",
    asOf: "2026-10-01",
    refreshedAt: "2026-10-01T15:00:00.000Z",
    stale: false,
    lastRefresh: null,
    subscriptions: [
      sub(),
      sub({ key: "explee", label: "Explee", provider: "explee", ledgerMatched: false, ledgerNote: "no ledger line", ledgerVendors: [], paidUsd: null, refundedUsd: null, netUsd: null, costPerCreditUsdCents: null, grossCostPerCreditUsdCents: null, costPerCreditNullReason: "no-ledger-line" }),
    ],
  };

  it("costs-service's read parses: unknown money stays null with its reason, never $0", () => {
    const p = SubscriptionCostsSchema.parse(body);
    expect(p.subscriptions[1].netUsd).toBeNull();
    expect(p.subscriptions[1].costPerCreditNullReason).toBe("no-ledger-line");
    expect(p.subscriptions[0].costItems[1].isCredit).toBe(false);
  });

  it("is a Cost card and its own page, read through the staff gateway, never written to disk", () => {
    expect(MONITORING_PAGES).toContain("cost/subscriptions");
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('<Section section="cost" count={3}>');
    expect(page).toContain('page="cost/subscriptions"');
    expect(page).toContain('{view.page === "cost/subscriptions" && <SubscriptionsPage />}');
    expect(page).toContain('["staffSubscriptionCosts"]');
    expect(read("lib/api.ts")).toContain("STAFF_MONITORING_PATHS.subscriptionCosts");
    const persist = read("lib/persist-cache.ts");
    expect(persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"))).toContain('"staffSubscriptionCosts"');
  });

  it("the page reads the producer's cost per credit and never divides paid by credits itself", () => {
    const view = read("components/v2/monitoring-subscriptions.tsx");
    expect(view).not.toMatch(/[pP]aidUsd\s*\//);
    expect(view).not.toMatch(/[nN]etUsd\s*\//);
    expect(view).not.toMatch(/\/\s*[\w.]*[cC]redits\b/);
    expect(view).toContain("costPerCreditUsdCents");
  });
});

describe("monitoring: new pricing and pricing comparison (owner 2026-10-01)", () => {
  const fig = { amount1UsdCents: 100, amount2UsdCents: 150, differenceUsdCents: 50, differencePct: 50, realCostUsdCents: 120, margin1UsdCents: -20, margin1Pct: -20, margin2UsdCents: 30, margin2Pct: 20, billedUsdCents: 90, netBilledUsdCents: 85, billedPlatformKeyUsdCents: 90, netBilledPlatformKeyUsdCents: 85 };

  it("costs-service's real costs parse: producer methods, flags and bases read as strings, missing figures null", () => {
    const item = { costName: "apollo-credit", provider: "apollo", method: "subscription", flag: null, realCostPerUnitUsdCents: 2.94, ratio: null, catalogueVendorCostPerUnitUsdCents: 2.36, cataloguePricePerUnitUsdCents: 11.8, catalogueMarkupOnRealCost: 4.01, multiplier: 2, proposedPricePerUnitUsdCents: 5.88, proposedBasis: "real-cost-x2", proposedVsCataloguePct: -50.1 };
    const p = RealCostsSchema.parse({
      formula: "f", rules: { since: "2026-01-01", proposedMultiplier: 2, passThroughMultiplier: 1, x1Rule: "x1", payAsYouGoVendors: [], catalogueVendorCostProviders: {} },
      day: "2026-10-01", asOf: "2026-10-01", refreshedAt: "2026-10-01T15:00:00Z", stale: false, lastRefresh: null, payAsYouGo: [],
      items: [item, { ...item, costName: "explee-credit", method: "catalogue-vendor-cost", flag: "a-flag-added-later", realCostPerUnitUsdCents: null, proposedBasis: "current-price-kept" }],
    });
    expect(p.items[1].flag).toBe("a-flag-added-later");
  });

  it("the comparison parses at fleet grain (per org and brand) and at org x brand grain (none)", () => {
    const base = { perimeter: { grain: "fleet" }, list1: { source: "catalogue", date: "2026-10-01" }, list2: { source: "proposed", date: "2026-10-01" }, interval: "month", consumptionAsOf: "2026-10-01T15:00:00Z", stale: false, notes: [], totals: fig, unpricedCostNames1: ["instantly-account-email-sent"], unpricedCostNames2: [], realCostUnknownCostNames: [], buckets: [{ period: "2026-09-01", ...fig, cumulative: fig }], costItems: [] };
    expect(PriceComparisonSchema.parse({ ...base, byOrg: [{ orgId: "o", ...fig }], byBrand: [{ orgId: "o", brandId: null, ...fig }] }).byOrg).toHaveLength(1);
    expect(PriceComparisonSchema.parse({ ...base, perimeter: { grain: "org-brand", orgId: "o", brandId: "b" }, byOrg: null, byBrand: null }).byBrand).toBeNull();
  });

  it("two pages, one per section, read through the staff gateway and never written to disk", () => {
    for (const p of ["price/new-pricing", "margin/pricing-comparison"]) expect(MONITORING_PAGES).toContain(p);
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('<Section section="price" count={5}>');
    expect(page).toContain('<Section section="margin" count={2}>');
    expect(page).toContain('page="price/new-pricing"');
    expect(page).toContain('page="margin/pricing-comparison"');
    const api = read("lib/api.ts");
    for (const k of ["STAFF_MONITORING_PATHS.realCosts", "STAFF_MONITORING_PATHS.priceComparison", "STAFF_MONITORING_PATHS.brands"]) expect(api).toContain(k);
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    for (const r of ["staffRealCosts", "staffRealCostSeries", "staffPriceComparison", "staffBrands"]) expect(sensitive).toContain(`"${r}"`);
  });

  it("the comparison picks two dated lists and a perimeter, and keys its read on every one of them", () => {
    const v = read("components/v2/monitoring-pricing-comparison.tsx");
    expect(v).toContain('["staffPriceComparison", list1.source, list1.date, list2.source, list2.date, orgId, brandId, interval]');
    for (const s of ['title="Price 1"', 'title="Price 2"', 'aria-label="Organization"', 'aria-label="Brand"', 'aria-label="Interval"']) expect(v).toContain(s);
  });

  it("neither page computes a margin, a difference or a share itself", () => {
    for (const f of ["components/v2/monitoring-new-pricing.tsx", "components/v2/monitoring-pricing-comparison.tsx"]) {
      const v = read(f);
      expect(v).not.toMatch(/amount2UsdCents\s*-\s*[\w.]*amount1UsdCents/);
      expect(v).not.toMatch(/amount\dUsdCents\s*-\s*[\w.]*realCostUsdCents/);
      expect(v).not.toMatch(/proposedPricePerUnitUsdCents\s*\/\s*[\w.]*cataloguePrice/);
      expect(v).not.toMatch(/\/\s*[\w.]*(amount1|realCost|vendorCostRecorded)UsdCents/);
    }
  });
});
