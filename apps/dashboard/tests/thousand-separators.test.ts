import { describe, it, expect } from "vitest";
import {
  formatCount,
  formatUsd,
  formatCentsAsUsd,
  formatCentsAsUsdOrNull,
  formatUsdAdaptive,
  formatCentsAsUsdAdaptive,
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

describe("formatUsdAdaptive", () => {
  it("keeps cents below $10", () => {
    expect(formatUsdAdaptive(0)).toBe("$0.00");
    expect(formatUsdAdaptive(4.2)).toBe("$4.20");
    expect(formatUsdAdaptive(9.99)).toBe("$9.99");
  });
  it("drops cents at $10 and above, with thousand separators", () => {
    expect(formatUsdAdaptive(10)).toBe("$10");
    expect(formatUsdAdaptive(12.5)).toBe("$13");
    expect(formatUsdAdaptive(1234.56)).toBe("$1,235");
  });
});

describe("formatCentsAsUsdAdaptive", () => {
  it("applies the <$10 / ≥$10 rule from cents", () => {
    expect(formatCentsAsUsdAdaptive(999)).toBe("$9.99");
    expect(formatCentsAsUsdAdaptive(1000)).toBe("$10");
    expect(formatCentsAsUsdAdaptive("123456")).toBe("$1,235");
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

  // The campaign press-kit detail page (which used formatCount for view stats)
  // was removed with the campaign concept.
});

describe("sales economics surfaces use locale-aware text inputs", () => {
  // The flat settings sales-economics card is gone; a funnel now owns the rates
  // and the lifetime revenue, and its inputs carry the same helpers.
  it("offer campaign settings take amounts as text inputs, never number inputs", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/settings/offer-campaigns-card.tsx"),
      "utf-8"
    );
    // Lifetime revenue and the per-campaign budgets are text, so a thousands
    // separator is typeable; the lifetime revenue strips it before parsing.
    expect(content).toContain('type="text"');
    expect(content).not.toContain('type="number"');
    expect(content).toContain('value.replace(/,/g, "")');
    expect(content).toContain("parseDailyBudgetUsd(budget)");
  });
  it("brand conversion rates render through the shared RateInput", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/settings/leg-rates-editor.tsx"),
      "utf-8"
    );
    expect(content).toContain("<RateInput");
    expect(content).not.toContain('type="number"');
  });

  it("onboarding rates and budget labels use the shared locale helpers", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
      "utf-8"
    );
    expect(content).toContain("formatLocaleInteger");
    expect(content).toContain("formatLocaleNumberInputValue");
    expect(content).toContain("parseLocaleNumberInput");
    expect(content).not.toContain("function groupInt");
    expect(content).not.toContain('toLocaleString("en-US")');
  });
});
