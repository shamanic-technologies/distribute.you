import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chartDomain, niceCeiling, referenceTicks } from "../src/lib/chart-domain";

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
    expect(niceCeiling(1247)).toBe(1500);
    expect(niceCeiling(104)).toBe(150);
    expect(niceCeiling(43)).toBe(50);
  });

  it("does not waste half the plot on rounding", () => {
    // The real weekly-NRR case: 255 with headroom is 293. Under a 1/2/5/10
    // grammar that becomes 500 and every bar renders half as tall as it should.
    expect(niceCeiling(293)).toBe(300);
    expect(niceCeiling(255 * 1.15)).toBe(300);
  });

  it("always clears the value it was given", () => {
    for (const v of [1, 7, 43, 104, 255, 293, 434, 1247, 2760, 3450]) {
      expect(niceCeiling(v)).toBeGreaterThanOrEqual(v);
    }
  });

  it("never returns zero or a negative", () => {
    for (const v of [0, -5, Number.NaN]) expect(niceCeiling(v)).toBeGreaterThan(0);
  });
});

describe("referenceTicks", () => {
  it("puts the reference on a labelled tick", () => {
    expect(referenceTicks(300, 100)).toEqual([0, 100, 200, 300]);
    expect(referenceTicks(500, 100)).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("coarsens rather than printing a wall of labels, and still keeps the reference", () => {
    const ticks = referenceTicks(2000, 100)!;
    expect(ticks.length).toBeLessThanOrEqual(6);
    // Coarsening must never drop the one tick the axis exists to show.
    expect(ticks).toContain(100);
  });

  it("leaves the axis automatic when there is no reference", () => {
    expect(referenceTicks(300, undefined)).toBeUndefined();
    expect(referenceTicks(300, 0)).toBeUndefined();
    expect(referenceTicks(0, 100)).toBeUndefined();
  });
});

describe("the NRR chart wiring", () => {
  const chart = readFileSync(
    join(__dirname, "../src/components/period-compound-chart.tsx"),
    "utf8"
  );
  const view = readFileSync(join(__dirname, "../src/components/revenue-view.tsx"), "utf8");

  it("draws the reference as a dashed line in the theme's own colour", () => {
    const at = chart.indexOf("<ReferenceLine");
    expect(at).toBeGreaterThan(-1);
    // Measured to the closing tag; do not widen.
    const line = chart.slice(at, at + 280);
    expect(line).toContain("strokeDasharray");
    // `currentColor`, not a hex: near-white on the dark theme, still visible on
    // the light one. A hardcoded colour is invisible on one of the two.
    expect(line).toContain('stroke="currentColor"');
  });

  it("anchors the Y ticks on the reference so 100 carries its own label", () => {
    expect(chart).toContain("referenceTicks(domain.max, referenceValue)");
    expect(chart).toContain("ticks={ticks}");
  });

  it("draws no CartesianGrid — it resolved no ticks and marked nothing", () => {
    // These charts name their Y axes, CartesianGrid defaults to yAxisId 0, so
    // recharts drew one dashed line across the top of the plot that referenced
    // nothing at all.
    expect(chart).not.toContain("<CartesianGrid");
    const capacity = readFileSync(
      join(__dirname, "../src/components/audit/capacity-history-chart.tsx"),
      "utf8"
    );
    expect(capacity).not.toContain("<CartesianGrid");
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
