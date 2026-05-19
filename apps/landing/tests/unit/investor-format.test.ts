import { describe, it, expect } from "vitest";
import {
  formatCents,
  computeCAGR,
  computeCGRSeries,
  niceTicks,
} from "@/lib/investors/format";

describe("formatCents — fractional decimal-string cents", () => {
  it("rounds sub-dollar fractional cents to $0 (sub-dollar = noise)", () => {
    expect(formatCents("0.9900000000")).toBe("$0");
  });

  it("rounds 100.42 cents ($1.0042) down to $1", () => {
    expect(formatCents("100.4200000000")).toBe("$1");
  });

  it("returns $0 for zero string", () => {
    expect(formatCents("0")).toBe("$0");
  });

  it("returns $0 for exact zero number", () => {
    expect(formatCents(0)).toBe("$0");
  });

  it("rounds 99 cents ($0.99) up to $1 (nearest dollar)", () => {
    expect(formatCents("99")).toBe("$1");
  });

  it("returns $1 exactly for 100 cents", () => {
    expect(formatCents("100")).toBe("$1");
  });

  it("rounds $1.50 to $2 (round half up)", () => {
    expect(formatCents("150")).toBe("$2");
  });

  it("handles large fractional values with grouping", () => {
    expect(formatCents("123456.7800000000")).toBe("$1,235");
  });

  it("accepts plain numbers (back-compat for chart values)", () => {
    expect(formatCents(250)).toBe("$3");
  });
});

describe("computeCAGR — fractional decimal-string inputs", () => {
  it("computes period-over-period growth from string values (descending order)", () => {
    expect(computeCAGR(["400", "100"])).toBe("300");
  });

  it("returns null when all values are zero", () => {
    expect(computeCAGR(["0", "0"])).toBe(null);
  });

  it("returns null when only one positive period exists", () => {
    expect(computeCAGR(["100", "0"])).toBe(null);
  });

  it("handles fractional decimal strings", () => {
    expect(computeCAGR(["12.50", "6.25"])).toBe("100");
  });

  it("computes CAGR across multiple periods", () => {
    expect(computeCAGR(["800", "400", "200", "100"])).toBe("100");
  });

  it("accepts plain numbers (back-compat)", () => {
    expect(computeCAGR([400, 100])).toBe("300");
  });
});

describe("computeCGRSeries — compound growth rate per period (ASC input)", () => {
  it("returns empty array for empty input", () => {
    expect(computeCGRSeries([])).toEqual([]);
  });

  it("returns [null] for single-value series (no comparison possible)", () => {
    expect(computeCGRSeries([100])).toEqual([null]);
  });

  it("computes 1-period growth: [100, 110] -> [null, +10%]", () => {
    expect(computeCGRSeries([100, 110])).toEqual([null, "10"]);
  });

  it("compounds geometric mean over 2 periods: [100, 110, 121] -> [null, +10, +10]", () => {
    expect(computeCGRSeries([100, 110, 121])).toEqual([null, "10", "10"]);
  });

  it("compresses 21% total over 1 period as 21% (not compound): [100, 121] -> [null, +21]", () => {
    expect(computeCGRSeries([100, 121])).toEqual([null, "21"]);
  });

  it("returns null entries when anchor is zero", () => {
    expect(computeCGRSeries([0, 50])).toEqual([null, null]);
  });

  it("skips zero-value periods (computes against anchor only when both positive)", () => {
    const result = computeCGRSeries([100, 0, 200]);
    expect(result[0]).toBe(null);
    expect(result[1]).toBe(null);
    expect(Number(result[2])).toBeCloseTo(41, 0);
  });

  it("accepts decimal-string inputs (back-compat with billing cents)", () => {
    expect(computeCGRSeries(["100", "110", "121"])).toEqual([null, "10", "10"]);
  });

  it("handles decreasing series with negative compound rate", () => {
    expect(computeCGRSeries([100, 50])).toEqual([null, "-50"]);
  });
});

describe("niceTicks — round-number axis ticks", () => {
  it("produces clean ticks for [0, 100] with step 20", () => {
    expect(niceTicks(0, 100)).toEqual({
      min: 0,
      max: 100,
      ticks: [100, 80, 60, 40, 20, 0],
    });
  });

  it("rounds [0, 1234] up to nice max with step 500", () => {
    expect(niceTicks(0, 1234)).toEqual({
      min: 0,
      max: 1500,
      ticks: [1500, 1000, 500, 0],
    });
  });

  it("rounds [0, 87] up to 100 with step 20", () => {
    expect(niceTicks(0, 87)).toEqual({
      min: 0,
      max: 100,
      ticks: [100, 80, 60, 40, 20, 0],
    });
  });

  it("handles negative range [-50, 150] with symmetric step 50", () => {
    expect(niceTicks(-50, 150)).toEqual({
      min: -50,
      max: 150,
      ticks: [150, 100, 50, 0, -50],
    });
  });

  it("degenerate [0, 0] returns safe fallback", () => {
    const result = niceTicks(0, 0);
    expect(result.max).toBeGreaterThan(result.min);
    expect(result.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("small range [0, 3] uses step 1", () => {
    expect(niceTicks(0, 3)).toEqual({
      min: 0,
      max: 3,
      ticks: [3, 2, 1, 0],
    });
  });

  it("large range [0, 50000] uses clean step", () => {
    const result = niceTicks(0, 50000);
    expect(result.min).toBe(0);
    expect(result.max).toBe(50000);
    expect(result.ticks[0]).toBe(50000);
    expect(result.ticks[result.ticks.length - 1]).toBe(0);
    for (const tick of result.ticks) {
      expect(tick % 10000).toBe(0);
    }
  });
});
