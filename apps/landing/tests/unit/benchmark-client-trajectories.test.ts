import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const benchmarkFetchPath = path.resolve(
  __dirname,
  "../../src/lib/benchmarks/fetch-benchmark.ts",
);
const componentPath = path.resolve(
  __dirname,
  "../../src/components/benchmarks/client-trajectories-section.tsx",
);

const fetchContent = fs.readFileSync(benchmarkFetchPath, "utf-8");
const componentContent = fs.readFileSync(componentPath, "utf-8");

describe("benchmark client trajectories", () => {
  it("preserves an optional public brand timeline from the ranked response", () => {
    expect(fetchContent).toContain("timeline?: RawBrandTimelinePoint[]");
    expect(fetchContent).toContain("timeline: mapBrandTimeline(item.timeline)");
    expect(fetchContent).toContain("expectedRevenueUsd: item.headline?.totalPipelineUsd");
    expect(fetchContent).toContain("roiMultiple: item.costEconomics?.roiMultiple");
    expect(fetchContent).toContain("function mapRevenueTimeline");
    expect(fetchContent).toContain("cumulativePipelineUsd: expectedRevenueUsd");
    expect(fetchContent).toContain("const trajectoryBrandIds = new Set");
    expect(fetchContent).toContain("(item.costEconomics?.roiMultiple ?? 0) > 1");
    expect(fetchContent).toContain(".slice(0, 6)");
  });

  it("fetches public revenue timelines from features-service", () => {
    expect(fetchContent).toContain("/public/stats/revenue");
    expect(fetchContent).toContain("groupBy=brand");
    expect(fetchContent).toContain("groupBy=workflow");
    expect(fetchContent).not.toContain("/v1/public/features/revenue");
  });

  it("uses the public revenue set as the brand table source of truth", () => {
    expect(fetchContent).toContain(".filter((item) => (item.headline?.totalPipelineUsd ?? 0) > 0)");
    expect(fetchContent).toContain("if (!revenue) return []");
    expect(fetchContent).toContain("const expectedRevenueUsd = brands.reduce");
    expect(fetchContent).toContain("const brandCost = brands.reduce");
  });

  it("renders only dated revenue timeline mini charts, never funnel bars", () => {
    expect(componentContent).toContain("Pipeline revenue over time");
    expect(componentContent).toContain("public revenue timelines");
    expect(componentContent).toContain("expectedRevenueUsd={brand.expectedRevenueUsd}");
    expect(componentContent).toContain(".filter(hasProfitableTimeline)");
    expect(componentContent).toContain("(brand.roiMultiple ?? 0) > 1");
    expect(componentContent).toContain("(b.expectedRevenueUsd ?? 0) - (a.expectedRevenueUsd ?? 0)");
    expect(componentContent).toContain("ROI {brand.roiMultiple!.toFixed(1)}x");
    expect(componentContent).not.toContain("Current funnel");
    expect(componentContent).not.toContain("funnel snapshots");
    expect(componentContent).not.toContain("rounded-full bg-gray-100 overflow-hidden");
    expect(componentContent).not.toContain(">Sent<");
    expect(componentContent).not.toContain(">Open rate<");
    expect(componentContent).not.toContain("$/reply");
  });
});
