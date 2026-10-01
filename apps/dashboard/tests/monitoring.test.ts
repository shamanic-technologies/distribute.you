import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CostMarginSchema,
  CurrentPricesSchema,
  FleetEmailStatsSchema,
  MONITORING_PAGES,
  PriceVersionsSchema,
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
    for (const root of ["staffCostMargin", "staffPriceVersions", "staffCurrentPrices", "staffEmailsSent"]) {
      expect(sensitive).toContain(`"${root}"`);
      expect(read("components/v2/monitoring-page.tsx")).toContain(`["${root}"]`);
    }
  });
});
