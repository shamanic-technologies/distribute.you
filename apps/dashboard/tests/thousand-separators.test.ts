import { describe, it, expect } from "vitest";
import {
  formatCount,
  formatUsd,
  formatCentsAsUsd,
  formatCentsAsUsdOrNull,
  formatLocaleInteger,
  formatLocaleNumberInputValue,
  parseLocaleNumberInput,
} from "../src/lib/format-number";
import * as fs from "fs";
import * as path from "path";

describe("formatCount", () => {
  it("adds thousand separators to large numbers", () => {
    expect(formatCount(1000)).toBe("1,000");
    expect(formatCount(1234567)).toBe("1,234,567");
  });

  it("does not add separators to small numbers", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });
});

describe("formatUsd", () => {
  it("adds thousand separators and dollar sign", () => {
    expect(formatUsd(1234.56)).toBe("$1,234.56");
    expect(formatUsd(1000000)).toBe("$1,000,000.00");
  });
});

describe("formatCentsAsUsd", () => {
  it("converts cents to dollars with thousand separators", () => {
    expect(formatCentsAsUsd(123456)).toBe("$1,234.56");
    expect(formatCentsAsUsd("100000000")).toBe("$1,000,000.00");
  });
});

describe("formatCentsAsUsdOrNull", () => {
  it("returns null for zero, null, undefined, NaN", () => {
    expect(formatCentsAsUsdOrNull(null)).toBeNull();
    expect(formatCentsAsUsdOrNull(undefined)).toBeNull();
    expect(formatCentsAsUsdOrNull(0)).toBeNull();
    expect(formatCentsAsUsdOrNull("not-a-number")).toBeNull();
  });

  it("formats valid cents", () => {
    expect(formatCentsAsUsdOrNull(150000)).toBe("$1,500.00");
  });
});

describe("locale-aware numeric text helpers", () => {
  it("formats grouped input values with the requested viewer locale", () => {
    expect(formatLocaleNumberInputValue(1500.5, "en-US")).toBe("1,500.5");
    expect(formatLocaleNumberInputValue(1500.5, "fr-FR")).toBe("1 500,5");
    expect(formatLocaleNumberInputValue(1500.5, "de-DE")).toBe("1.500,5");
  });

  it("parses the viewer locale group and decimal separators", () => {
    expect(parseLocaleNumberInput("1,500.5", "en-US")).toBe(1500.5);
    expect(parseLocaleNumberInput("1 500,5", "fr-FR")).toBe(1500.5);
    expect(parseLocaleNumberInput("1.500,5", "de-DE")).toBe(1500.5);
  });

  it("formats integer labels with locale-specific thousands separators", () => {
    expect(formatLocaleInteger(12500, "en-US")).toBe("12,500");
    expect(formatLocaleInteger(12500, "fr-FR")).toBe("12 500");
  });
});

describe("sidebar components use formatCount for badges", () => {
  // mcp-sidebar.tsx was removed with the campaign concept.
  it("context-sidebar imports and uses formatCount", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/context-sidebar.tsx"),
      "utf-8"
    );
    expect(content).toContain('import { formatCount } from "@/lib/format-number"');
    expect(content).toContain("formatCount(item.badge)");
  });

  it("brand metrics header thousand-separates its stat numbers", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/brand-metrics-header.tsx"),
      "utf-8"
    );
    // Visits / DR / revenue big numbers + chart values format with thousand
    // separators via toLocaleString (the Outcomes count cards this replaced
    // used formatCount for the same purpose).
    expect(content).toContain('toLocaleString("en-US")');
  });

  // The campaign press-kit detail page (which used formatCount for view stats)
  // was removed with the campaign concept.
});

describe("sales economics surfaces use locale-aware text inputs", () => {
  it("settings sales economics uses the shared locale input helpers instead of number inputs", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/settings/brand-sales-economics-card.tsx"),
      "utf-8"
    );
    expect(content).toContain('from "@/lib/format-number"');
    expect(content).toContain("formatLocaleNumberInputValue");
    expect(content).toContain("parseLocaleNumberInput");
    expect(content).toContain('type="text"');
    expect(content).toContain('inputMode="decimal"');
    expect(content).not.toContain('type="number"');
  });

  it("onboarding rates and budget labels use the shared locale helpers", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/onboarding/beta-onboarding.tsx"),
      "utf-8"
    );
    expect(content).toContain("formatLocaleInteger");
    expect(content).toContain("formatLocaleNumberInputValue");
    expect(content).toContain("parseLocaleNumberInput");
    expect(content).not.toContain("function groupInt");
    expect(content).not.toContain('toLocaleString("en-US")');
  });
});
