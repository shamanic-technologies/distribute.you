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

  it("fetches public revenue timelines from features-service", () => {
    expect(fetchContent).toContain("/public/stats/revenue");
    expect(fetchContent).not.toContain("/v1/public/features/revenue");
  });

  it("renders only dated revenue timeline mini charts, never funnel bars", () => {
    expect(componentContent).toContain("Pipeline revenue over time");
    expect(componentContent).toContain("public revenue timelines");
    expect(componentContent).toContain(".filter(hasTimeline)");
    expect(componentContent).not.toContain("Current funnel");
    expect(componentContent).not.toContain("funnel snapshots");
    expect(componentContent).not.toContain("rounded-full bg-gray-100 overflow-hidden");
  });
});
