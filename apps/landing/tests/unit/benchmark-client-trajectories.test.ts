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
  it("does NOT carry per-brand timeline (stripped: blew the 2MB unstable_cache, never rendered)", () => {
    // The per-brand `timeline` (~1,500 daily points × up to 6 brands ≈ 2.2MB)
    // pushed the cached benchmark result past the 2MB unstable_cache limit (so it
    // never cached → every revalidation re-hit the slow API → build timeouts), and
    // its only consumer (ClientTrajectoriesSection) is not mounted. It is stripped.
    expect(fetchContent).not.toContain("timeline: mapBrandTimeline(item.timeline)");
    expect(fetchContent).not.toContain("function mapRevenueTimeline");
    expect(fetchContent).not.toContain("trajectoryBrandIds");
    // The revenue fields still drive the brand table.
    expect(fetchContent).toContain("expectedRevenueUsd: item.headline?.totalPipelineUsd");
    expect(fetchContent).toContain("roiMultiple: item.costEconomics?.roiMultiple");
  });

  it("bounds every build-time benchmark fetch so a slow API can't abort the deploy", () => {
    // fetchBoundedJson parses INSIDE the try/catch (covers a timeout during
    // res.json()) and returns a fallback on any failure — the fix for the uncaught
    // TimeoutError that aborted the /benchmarks prerender and failed deploys.
    expect(fetchContent).toContain("function fetchBoundedJson");
    expect(fetchContent).toContain("AbortSignal.timeout");
    expect(fetchContent).toContain("return fallback");
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
