import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Cost summary card on feature Overview (actual spend)", () => {
  const card = read("components/revenue/revenue-cost-summary.tsx");
  // Feature flattened into the brand level — the brand root page IS the overview.
  const overview =
    read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");

  it("renders Total spent without Cost of acquisition or ROI cards", () => {
    expect(card).toContain("Total spent");
    expect(card).not.toContain("Cost of acquisition");
    expect(card).not.toContain("Share of expected pipeline revenue");
    expect(card).not.toContain("ROI");
    expect(card).not.toContain("Return multiple on spend");
  });

  it("top cost sources show provider logo + share, no $ amounts", () => {
    expect(card).toContain("Top cost sources");
    expect(card).toContain("ProviderLogo");
    expect(card).toContain("{Math.round(s.pct)}%");
    // The provider rows must not print a dollar figure.
    expect(card).not.toContain("formatUsd(s.cents");
  });

  it("Overview wires the cost breakdown through the revenue section into the summary card", () => {
    expect(overview).toContain("getBrandCostBreakdown");
    expect(overview).toContain("costBreakdown={costData?.costs ?? []}");
    const section = read("components/revenue/revenue-overview-section.tsx");
    // The cost summary lives in the right-of-chart column, replacing the old
    // org/lead/event counters.
    expect(section).toContain("RevenueCostSummary");
    expect(section).not.toContain("costEconomics={data?.costEconomics}");
    expect(section).not.toContain("Converting organizations");
    expect(section).not.toContain("Lead conversions");
  });

  it("Total spent and provider shares use actual costs only", () => {
    expect(card).toContain("parseFloat(c.actualCostInUsdCents)");
    expect(card).not.toContain("parseFloat(c.totalCostInUsdCents)");
  });

  it("Total spent only keeps cents below ten dollars", () => {
    expect(card).toContain("const fractionDigits = usd < 10 ? 2 : 0");
    expect(card).toContain("minimumFractionDigits: fractionDigits");
    expect(card).toContain("maximumFractionDigits: fractionDigits");
  });

  it("Overview replaces the bottom cost-source card with real top personas", () => {
    const api = read("lib/api.ts");
    const personaCard = read("components/revenue/top-personas-card.tsx");
    expect(overview).toContain("fetchFeaturePersonaStats");
    expect(overview).toContain("featurePersonaStats");
    expect(overview).toContain("<TopPersonasCard");
    expect(overview).toContain("costBottomCard=");
    expect(api).toContain("export async function fetchFeaturePersonaStats");
    expect(api).toContain("`/features/${featureSlug}/persona-stats?");
    expect(personaCard).toContain("Top 3 personas");
    expect(personaCard).toContain("row.metrics.cpcCents");
    expect(personaCard).toContain("row.metrics.cpprCents");
    expect(personaCard).toContain("No persona-tagged results yet.");
  });

  it("does not derive hidden cost efficiency ratios in the browser", () => {
    expect(card).not.toContain("costEconomics?.costOfAcquisitionPct");
    expect(card).not.toContain("costEconomics?.roiMultiple");
    expect(card).not.toContain("cacPct");
    expect(card).not.toContain("roiMultiple");
    expect(card).not.toContain("totalPipelineUsd");
  });

  it("the /revenue parser threads costEconomics through the view-model", () => {
    const parser = read("lib/revenue-parse.ts");
    expect(parser).toContain("costEconomics: CostEconomicsSchema");
    expect(parser).toContain("costEconomics: d.costEconomics");
  });
});
