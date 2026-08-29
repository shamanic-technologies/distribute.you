import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chartDomain } from "../src/lib/chart-domain";

const src = readFileSync(
  join(__dirname, "../src/components/audit/send-forecast-chart.tsx"),
  "utf8"
);

describe("send forecast Y ceiling clears the capacity line", () => {
  it("puts capacity above every bar and still leaves headroom", () => {
    // The reported case: capacity sits above the tallest bar, so an axis scaled
    // to the bars alone would discard the ReferenceLine entirely.
    const bars = [120, 200, 90];
    const capacity = 450;
    const { max } = chartDomain(bars, { floor: capacity });
    expect(max).toBeGreaterThan(capacity);
    expect(max).toBeGreaterThan(Math.max(...bars));
  });

  it("still fits the bars when they tower over capacity", () => {
    const bars = [1200, 300];
    const { max } = chartDomain(bars, { floor: 45 });
    expect(max).toBeGreaterThanOrEqual(1200);
  });

  it("has no capacity floor when none is served", () => {
    const { max } = chartDomain([10, 20], {});
    expect(max).toBeGreaterThanOrEqual(20);
  });
});

describe("the chart wires that ceiling onto its Y axis", () => {
  it("computes the domain from the served day totals and the capacity", () => {
    expect(src).toContain("chartDomain(");
    expect(src).toContain("floor: hasCapacity ? dailyCapacity : undefined");
    expect(src).toContain("domain={[0, yMax]}");
  });

  it("does not leave the axis on its automatic bars-only domain", () => {
    const yAxis = src.slice(src.indexOf("<YAxis"), src.indexOf("</BarChart>"));
    expect(yAxis).toContain("domain={[0, yMax]}");
  });
});
