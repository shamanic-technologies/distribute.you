import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OfferOutcomeCostSeriesSchema, lastDays, ledgerOutcomeOf, unlistedLedgerOutcomes } from "../src/lib/v2/outcome-cost-series";

// GSC-CONNECTOR-1108: every outcome the brand's ledger holds shows on the Outcomes overview, a connector's
// (« Google search click ») included, read off features-service's `ledgerOutcomes`, never a list of keys.

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const day = (date: string, units: number | null) => ({ date, units, ourUnits: units === null ? null : 0, otherFactoryUnits: units === null ? null : units });
const BODY = {
  brandId: "b1",
  pricing: "net",
  firstSpendDay: null,
  steps: [],
  ledgerOutcomes: [
    { outcomeKey: "google_search_click", units: 12, ourUnits: 0, otherFactoryUnits: { total: 12 }, costPerUnitUsd: null, costPerUnitBasis: null, costPerUnitUnavailableReason: "no_unit_of_ours_yet", productionCostUsd: 0, producerGap: null, daily: [day("2026-11-05", 5), day("2026-11-06", 7), day("2026-11-07", null)] },
    { outcomeKey: "lead_visited", units: 3, ourUnits: 3, otherFactoryUnits: {}, costPerUnitUsd: 1.5, costPerUnitBasis: "every_path", costPerUnitUnavailableReason: null, productionCostUsd: 4.5, producerGap: null, daily: [] },
    { outcomeKey: "signup", units: 9, ourUnits: 2, otherFactoryUnits: {}, costPerUnitUsd: 3, costPerUnitBasis: "every_path", costPerUnitUnavailableReason: null, productionCostUsd: 6, producerGap: null, daily: [] },
  ],
};

describe("ledger outcomes", () => {
  it("parses the served block, and a body without it", () => {
    const parsed = OfferOutcomeCostSeriesSchema.parse(BODY);
    expect(parsed.ledgerOutcomes?.[0].daily[2].units).toBeNull();
    expect(OfferOutcomeCostSeriesSchema.parse({ ...BODY, ledgerOutcomes: undefined }).ledgerOutcomes).toBeUndefined();
  });

  it("lists only what no other row shows, a shown step's lead state included, in served order", () => {
    const parsed = OfferOutcomeCostSeriesSchema.parse(BODY);
    const leadStates: Record<string, string> = { website_visit: "lead_visited" };
    const out = unlistedLedgerOutcomes(parsed, new Set(["signup", "website_visit"]), (k) => leadStates[k] ?? null);
    expect(out.map((o) => o.outcomeKey)).toEqual(["google_search_click"]);
    expect(unlistedLedgerOutcomes(undefined, new Set(), () => null)).toEqual([]);
  });

  it("reads one outcome and its last days as served", () => {
    const parsed = OfferOutcomeCostSeriesSchema.parse(BODY);
    expect(ledgerOutcomeOf(parsed, "google_search_click")?.units).toBe(12);
    expect(ledgerOutcomeOf(parsed, "nope")).toBeNull();
    expect(lastDays([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(lastDays([1], 28)).toEqual([1]);
  });

  it("the overview and the outcome page read the shared ledger path, never a key", () => {
    const page = read("components/v2/outcomes-page.tsx");
    expect(page).toContain("unlistedLedgerOutcomes(");
    expect(page).toContain("<LedgerOutcomeRow");
    expect(page).toContain("<LedgerOutcomeStats lo={ledger}");
    expect(page).not.toContain("google_search_click");
    expect(read("components/v2/outcome-stats.tsx")).not.toContain("google_search_click");
  });
});
