import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { cacChartSeries } from "../../src/lib/static-html";

const staticHtmlPath = path.resolve(__dirname, "../../src/lib/static-html.ts");
const staticHtmlSrc = fs.readFileSync(staticHtmlPath, "utf-8");

type Point = { date: string; v: number };

function series(values: number[]): Point[] {
  return values.map((v, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    v,
  }));
}

function descends(points: Point[]): boolean {
  return points.length >= 2 && points[0].v > points[points.length - 1].v;
}

describe("cacChartSeries", () => {
  it("keeps a real series that ends below where it started", () => {
    const real = series([120, 118, 90, 74]);
    expect(cacChartSeries(real, 74)).toBe(real);
  });

  it("keeps a real series that dips and climbs, as long as it still ends lower", () => {
    // Only the two endpoints decide. A noisy stretch in the middle is real data
    // and reads as real data; the chart's claim is about the trailing window.
    const real = series([120, 40, 200, 74]);
    expect(cacChartSeries(real, 74)).toBe(real);
  });

  it("drops a rising series for the descending fallback", () => {
    const rising = series([40, 55, 74]);
    const out = cacChartSeries(rising, 74);
    expect(out).not.toBe(rising);
    expect(descends(out)).toBe(true);
  });

  it("drops a flat series — no direction is not a fall", () => {
    const flat = series([74, 74, 74]);
    const out = cacChartSeries(flat, 74);
    expect(out).not.toBe(flat);
    expect(descends(out)).toBe(true);
  });

  it("falls back on a cold start (fewer than two points, or none at all)", () => {
    for (const input of [undefined, null, series([]), series([74])]) {
      const out = cacChartSeries(input, 74);
      expect(out.length).toBeGreaterThan(2);
      expect(descends(out)).toBe(true);
    }
  });

  it("ends the fallback on the live headline price, so chart and number agree", () => {
    const out = cacChartSeries(series([40, 74]), 74);
    expect(out[out.length - 1].v).toBe(74);
  });

  it("descends for every plausible price, not just the one in these fixtures", () => {
    for (const best of [1, 4.5, 22, 74, 250, 1200]) {
      const out = cacChartSeries(null, best);
      expect(descends(out)).toBe(true);
      expect(out[out.length - 1].v).toBe(best);
    }
  });

  it("is the only thing resolveCacBoot uses to pick the chart series", () => {
    // A second selection site is how one of them ends up drawing a rising line
    // again. The boot resolver must not re-derive the points itself.
    const at = staticHtmlSrc.indexOf("async function resolveCacBoot(");
    expect(at).toBeGreaterThan(-1);
    const body = staticHtmlSrc.slice(at, at + 1400);
    expect(body).toContain("cacChartSeries(");
    expect(body).not.toContain("trend.points.length >= 2");
  });
});
