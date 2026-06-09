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
  });

  it("does not fetch a non-gateway feature-service revenue endpoint from landing", () => {
    expect(fetchContent).not.toContain("/public/stats/revenue");
    expect(fetchContent).not.toContain("/v1/public/features/revenue");
  });

  it("renders current public funnel snapshots when dated timelines are absent", () => {
    expect(componentContent).toContain("current public funnel snapshots");
    expect(componentContent).toContain("Current funnel");
    expect(componentContent).toContain("Pipeline over time");
  });
});
