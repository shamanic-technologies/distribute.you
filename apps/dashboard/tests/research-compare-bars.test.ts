import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// COST-ACCOUNTING-1023-COMPARE: a Research bars chart served with `compare` draws each bar's paired
// figure (same key) beside it, with a legend naming both series; charts without it are unchanged.
describe("Research paired bars (compare)", () => {
  const page = src("src/components/v2/research-page.tsx");

  it("the chart type carries the served compare series", () => {
    expect(src("src/lib/research/research.ts")).toContain("compare?: { title: string; points: ResearchPoint[] };");
  });

  it("BarsChart hands a compare chart to the paired view before drawing its own bars", () => {
    const at = page.indexOf("function BarsChart(");
    const branch = page.indexOf("if (chart.compare) return <PairedBarsChart", at);
    const ownBars = page.indexOf("const max = Math.max(...chart.points.map((p) => p.value), 0) || 1;", at);
    expect(branch).toBeGreaterThan(at);
    expect(branch).toBeLessThan(ownBars);
  });

  it("pairs on the SAME key, names both series and prints served displays only", () => {
    const at = page.indexOf("function PairedBarsChart(");
    const body = page.slice(at, page.indexOf("function V2ResearchStudy(", at));
    expect(body).toContain("pairs.get(p.key)");
    expect(body).toContain("{chart.title}");
    expect(body).toContain("{compare.title}");
    expect(body).toContain("{p.display}");
    expect(body).toContain("{pair && bar(pair, COMPARE_COLOR)}");
  });
});
