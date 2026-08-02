import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chartDomain, niceCeiling } from "../src/lib/chart-domain";

describe("chartDomain", () => {
  it("scales to the tallest bar when nothing is excluded", () => {
    const { max, clippedIndices } = chartDomain([50, 80, 120]);
    expect(max).toBeGreaterThanOrEqual(120);
    expect(clippedIndices).toEqual([]);
  });

  it("leaves the first bar out of the ceiling, which is the whole point for weekly NRR", () => {
    // The real shape: an enormous first week, then ordinary ones squashed flat.
    const withFirst = chartDomain([2400, 95, 110, 104]);
    const without = chartDomain([2400, 95, 110, 104], { excludeFirst: true });
    expect(without.max).toBeLessThan(withFirst.max);
    // The later weeks now occupy a readable share of the plot instead of a strip.
    expect(110 / without.max).toBeGreaterThan(0.5);
  });

  it("reports the excluded bar as clipped so it can be marked, never silently truncated", () => {
    expect(chartDomain([2400, 95, 110], { excludeFirst: true }).clippedIndices).toEqual([0]);
  });

  it("clips nothing when a later bar is the tall one — the ceiling already covers it", () => {
    // Only an EXCLUDED bar can exceed the ceiling, because the ceiling is
    // derived from the included ones. So a huge later week is simply plotted.
    expect(chartDomain([2400, 95, 3000], { excludeFirst: true }).clippedIndices).toEqual([]);
  });

  it("keeps the reference line on screen when every bar sits below it", () => {
    // All retention under 100 must still show the 100 line, or the verdict is invisible.
    expect(chartDomain([40, 55, 60], { floor: 100 }).max).toBeGreaterThanOrEqual(100);
  });

  it("does not exclude the only bar there is", () => {
    const { max, clippedIndices } = chartDomain([2400], { excludeFirst: true });
    expect(max).toBeGreaterThanOrEqual(2400);
    expect(clippedIndices).toEqual([]);
  });

  it("leaves headroom so the tallest bar does not touch the top edge", () => {
    expect(chartDomain([100]).max).toBeGreaterThan(100);
  });

  it("survives an empty series and non-finite values", () => {
    expect(chartDomain([]).max).toBeGreaterThan(0);
    expect(chartDomain([Number.NaN, Number.POSITIVE_INFINITY]).max).toBeGreaterThan(0);
  });
});

describe("niceCeiling", () => {
  it("rounds up to a tick a human reads", () => {
    expect(niceCeiling(1247)).toBe(2000);
    expect(niceCeiling(104)).toBe(200);
    expect(niceCeiling(43)).toBe(50);
  });

  it("never returns zero or a negative", () => {
    for (const v of [0, -5, Number.NaN]) expect(niceCeiling(v)).toBeGreaterThan(0);
  });
});

describe("the NRR chart wiring", () => {
  const chart = readFileSync(
    join(__dirname, "../src/components/period-compound-chart.tsx"),
    "utf8"
  );
  const view = readFileSync(join(__dirname, "../src/components/revenue-view.tsx"), "utf8");

  it("draws a SOLID reference line, not a dashed one", () => {
    const at = chart.indexOf("<ReferenceLine");
    expect(at).toBeGreaterThan(-1);
    // Measured to the closing tag; do not widen.
    expect(chart.slice(at, at + 260)).not.toContain("strokeDasharray");
  });

  it("puts that line at 100 for both NRR cards", () => {
    expect(view).toContain("const RETENTION_BREAK_EVEN_PCT = 100");
    expect(view).toContain("referenceValue={RETENTION_BREAK_EVEN_PCT}");
  });

  it("excludes the first bar from the scale on WEEKLY only", () => {
    const weekly = view.indexOf('title="Weekly NRR"');
    const monthly = view.indexOf('title="Monthly NRR"');
    expect(view.slice(weekly, weekly + 300)).toContain("excludeFirstFromScale");
    expect(view.slice(monthly, monthly + 300)).not.toContain("excludeFirstFromScale");
  });

  it("plots a capped value so a clipped bar stays inside the plot area", () => {
    expect(chart).toContain("plotted: scaled ? Math.min(d.value, domain.max) : d.value");
    expect(chart).toContain('dataKey="plotted"');
  });

  it("keeps the TRUE value in the tooltip, so nothing is misreported", () => {
    expect(chart).toContain("formatValue(point.value)");
  });

  it("marks a clipped bar rather than truncating it silently", () => {
    expect(chart).toContain("isClipped");
    expect(chart).toContain("//");
  });

  it("renders no growth line or right axis when there is no growth label", () => {
    // An empty label made recharts fall back to the dataKey, so the NRR legend
    // read "cmgrSolid".
    expect(chart).toContain('const showGrowth = growthLabel !== ""');
    expect(chart).toContain("{showGrowth ? (");
  });
});
