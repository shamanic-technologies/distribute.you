import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Cost & efficiency card on feature Overview (actual spend)", () => {
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
    expect(section).toContain("totalPipelineUsd={data?.totalPipelineUsd}");
    expect(section).not.toContain("Converting organizations");
    expect(section).not.toContain("Lead conversions");
  });

  it("Total spent and provider shares use actual costs only", () => {
    expect(card).toContain("parseFloat(c.actualCostInUsdCents)");
    expect(card).not.toContain("parseFloat(c.totalCostInUsdCents)");
  });

  it("CAC % and ROI × are derived from actual spend, not provisioned-inclusive costEconomics", () => {
    expect(card).toContain("(totalCostUsd / totalPipelineUsd) * 100");
    expect(card).toContain("totalPipelineUsd / totalCostUsd");
    expect(card).not.toContain("costEconomics?.costOfAcquisitionPct");
    expect(card).not.toContain("costEconomics?.roiMultiple");
    expect(card).toContain('cacPct == null ? "—"');
    expect(card).toContain('roiMultiple == null ? "—"');
  });

  it("the /revenue parser threads costEconomics through the view-model", () => {
    const parser = read("lib/revenue-parse.ts");
    expect(parser).toContain("costEconomics: CostEconomicsSchema");
    expect(parser).toContain("costEconomics: d.costEconomics");
  });
});
