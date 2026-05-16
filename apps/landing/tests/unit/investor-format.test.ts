import { describe, it, expect } from "vitest";
import { formatCents, computeCAGR } from "@/lib/investors/format";

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
