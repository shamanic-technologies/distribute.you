import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Cost & efficiency card on feature Overview (served costEconomics)", () => {
  const card = read("components/revenue/revenue-cost-summary.tsx");
  // Feature flattened into the brand level — the brand root page IS the overview.
  const overview =
    read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");

  it("renders Total spent, Cost of acquisition and ROI cards with info hints", () => {
    expect(card).toContain("Total spent");
    expect(card).toContain("Cost of acquisition");
    expect(card).toContain("ROI");
    expect(card).toContain("InfoHint");
  });

  it("top cost sources show provider logo + share, no $ amounts", () => {
    expect(card).toContain("Top cost sources");
    expect(card).toContain("ProviderLogo");
    expect(card).toContain("{Math.round(s.pct)}%");
    // The provider rows must not print a dollar figure.
    expect(card).not.toContain("formatUsd(s.cents");
  });

  it("Overview wires the cost breakdown through the revenue section into the 3 cards", () => {
    expect(overview).toContain("getBrandCostBreakdown");
    expect(overview).toContain("costBreakdown={costData?.costs ?? []}");
    const section = read("components/revenue/revenue-overview-section.tsx");
    // The cost cards now live in the right-of-chart column, replacing the old
    // org/lead/event counters.
    expect(section).toContain("RevenueCostSummary");
    expect(section).toContain("costEconomics={data?.costEconomics}");
    expect(section).not.toContain("Converting organizations");
    expect(section).not.toContain("Lead conversions");
  });

  it("CAC % and ROI × read the served costEconomics, not client arithmetic", () => {
    // Single source: the two ratios come straight off the features-service prop
    // (optional-chained — the card now renders its shell before data arrives).
    expect(card).toContain("costEconomics?.costOfAcquisitionPct");
    expect(card).toContain("costEconomics?.roiMultiple");
    // Served nulls still render as an em dash.
    expect(card).toContain('cacPct == null ? "—"');
    expect(card).toContain('roiMultiple == null ? "—"');
    // No re-derivation of the ratios from pipeline in the browser.
    expect(card).not.toContain("totalPipelineUsd");
  });

  it("the /revenue parser threads costEconomics through the view-model", () => {
    const parser = read("lib/revenue-parse.ts");
    expect(parser).toContain("costEconomics: CostEconomicsSchema");
    expect(parser).toContain("costEconomics: d.costEconomics");
  });
});
