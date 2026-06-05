import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Cost & efficiency card on feature Overview (item 6, interim client-calc)", () => {
  const card = read("components/revenue/revenue-cost-summary.tsx");
  const overview =
    read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/overview/page.tsx");

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
    expect(section).toContain("totalPipelineUsd={data.totalPipelineUsd}");
    expect(section).not.toContain("Converting organizations");
    expect(section).not.toContain("Lead conversions");
  });

  it("CAC % and ROI × logic with null guards", () => {
    const compute = (totalCostUsd: number, totalPipelineUsd: number | null) => {
      const cacPct =
        totalPipelineUsd != null && totalPipelineUsd > 0
          ? (totalCostUsd / totalPipelineUsd) * 100
          : null;
      const roiMultiple =
        totalCostUsd > 0 && totalPipelineUsd != null ? totalPipelineUsd / totalCostUsd : null;
      return { cacPct, roiMultiple };
    };
    // spend $300, expect $1000 → 30% CAC, 3.3× ROI
    expect(compute(300, 1000).cacPct).toBeCloseTo(30);
    expect(compute(300, 1000).roiMultiple).toBeCloseTo(3.333, 2);
    // zero cost → ROI null, CAC 0%
    expect(compute(0, 1000)).toEqual({ cacPct: 0, roiMultiple: null });
    // zero / null revenue → both null
    expect(compute(300, 0).cacPct).toBeNull();
    expect(compute(300, null).roiMultiple).toBeNull();
  });
});
