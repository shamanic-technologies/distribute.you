import { describe, expect, it } from "vitest";
import { cumulativeLineSvg, formatUsd, niceCeiling, weeklyBarsSvg, type RevenuePoint } from "../src/lib/saas-revenue-charts";

const weeks: RevenuePoint[] = [
  { start: "2026-10-26", usd: 420, current: false },
  { start: "2026-11-02", usd: 1310, current: false },
  { start: "2026-11-09", usd: 980, current: false },
  { start: "2026-11-16", usd: 560, current: true },
];

const days: RevenuePoint[] = [
  { start: "2026-11-18", usd: 2400, current: false },
  { start: "2026-11-19", usd: 2710, current: false },
  { start: "2026-11-20", usd: 2900, current: false },
  { start: "2026-11-21", usd: 3270, current: true },
];

describe("saas revenue charts", () => {
  it("draws the current week dashed and every past week solid", () => {
    const svg = weeklyBarsSvg(weeks, "SaaS gross cash per week", "$560 this week");
    expect(svg.match(/stroke-dasharray/g)?.length).toBe(1);
    expect(svg.match(/<rect x=/g)?.length).toBe(4);
    expect(svg).toContain("$560 this week");
  });

  it("draws no dashed bar when no week is current", () => {
    const svg = weeklyBarsSvg(weeks.map((w) => ({ ...w, current: false })), "t", "h");
    expect(svg).not.toContain("stroke-dasharray");
  });

  it("dashes only the segment into today on the cumulative line", () => {
    const svg = cumulativeLineSvg(days, "SaaS gross cash since inception", "$3,270");
    expect(svg.match(/stroke-dasharray/g)?.length).toBe(1);
    expect(svg).toContain("<polyline");
  });

  it("refuses an empty series or a non-numeric amount instead of drawing a flat zero", () => {
    expect(() => weeklyBarsSvg([], "t", "h")).toThrow(/no points/);
    expect(() => cumulativeLineSvg([{ start: "2026-11-21", usd: Number.NaN, current: true }], "t", "h")).toThrow(/non-numeric/);
    expect(() => weeklyBarsSvg(weeks.map((w) => ({ ...w, current: true })), "t", "h")).toThrow(/flagged current/);
  });

  it("formats money and rounds the axis", () => {
    expect(formatUsd(1234.4)).toBe("$1,234");
    expect(formatUsd(9.5)).toBe("$9.50");
    expect(niceCeiling(1310)).toEqual({ ceiling: 2000, step: 500 });
  });
});
