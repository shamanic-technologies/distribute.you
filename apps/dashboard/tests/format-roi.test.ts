import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formatRoi, roiDigits } from "../src/lib/format-roi";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("formatRoi", () => {
  it("keeps one decimal below ten, where it changes a decision", () => {
    expect(formatRoi(2.44)).toBe("2.4×");
    expect(formatRoi(2.45)).toBe("2.5×");
    expect(formatRoi(0)).toBe("0.0×");
    expect(formatRoi(9.94)).toBe("9.9×");
  });

  it("rounds to a whole number from ten up", () => {
    expect(formatRoi(29.5)).toBe("30×");
    expect(formatRoi(11.7)).toBe("12×");
    expect(formatRoi(10)).toBe("10×");
    expect(formatRoi(1240.4)).toBe("1240×");
  });

  it("rounds a value that crosses the threshold upward exactly once", () => {
    // 9.96 formats under the ten rule (one decimal) and must not become "10.0×".
    expect(formatRoi(9.96)).toBe("10.0×");
    expect(formatRoi(10.04)).toBe("10×");
  });

  it("coarsens a negative return on its own magnitude", () => {
    expect(formatRoi(-2.4)).toBe("-2.4×");
    expect(formatRoi(-29.5)).toBe("-30×");
  });

  it("states the caller's own word for an unmeasurable return, never a zero", () => {
    expect(formatRoi(null)).toBe("—");
    expect(formatRoi(undefined)).toBe("—");
    expect(formatRoi(null, "-")).toBe("-");
    expect(formatRoi(Number.NaN)).toBe("—");
    expect(formatRoi(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("exposes the digit count so a chart axis can share the rule", () => {
    expect(roiDigits(2.4)).toBe(1);
    expect(roiDigits(30)).toBe(0);
  });
});

describe("every ROI surface reads the one helper", () => {
  // A second copy of the rule is exactly what shipped `12×` under `11.7×` before.
  const SURFACES = [
    "components/audiences/customer-audiences-page.tsx",
    "components/campaigns/campaigns-table.tsx",
    "components/revenue/outreach-stat-cards.tsx",
    "components/revenue/roi-trend-card.tsx",
    "components/revenue/top-audiences-card.tsx",
    "components/strategy/best-model-card.tsx",
    "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/workflows/page.tsx",
    "lib/outcome-digest.ts",
  ];

  for (const rel of SURFACES) {
    it(`${rel} imports formatRoi`, () => {
      expect(read(rel)).toContain("formatRoi");
    });

    it(`${rel} declares no ROI formatter of its own`, () => {
      const src = read(rel);
      expect(src).not.toContain("toFixed(1)}×");
      expect(src).not.toContain("toFixed(1)}\\u00d7");
      expect(src).not.toContain("maximumFractionDigits: 1 })}×");
      expect(src).not.toContain("toFixed(multiple < 10 ? 1 : 0)");
    });
  }
});
