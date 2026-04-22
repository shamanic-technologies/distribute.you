import { describe, it, expect } from "vitest";
import { formatCount, formatUsd, formatCentsAsUsd, formatCentsAsUsdOrNull } from "../src/lib/format-number";
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

describe("sidebar components use formatCount for badges", () => {
  it("mcp-sidebar imports and uses formatCount", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/mcp-sidebar.tsx"),
      "utf-8"
    );
    expect(content).toContain('import { formatCount } from "@/lib/format-number"');
    expect(content).toContain("formatBadge(badge)");
  });

  it("context-sidebar imports and uses formatCount", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/components/context-sidebar.tsx"),
      "utf-8"
    );
    expect(content).toContain('import { formatCount } from "@/lib/format-number"');
    expect(content).toContain("formatCount(item.badge)");
  });

  it("brand overview page uses formatCount for outcome counts", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"),
      "utf-8"
    );
    expect(content).toContain('import { formatCount } from "@/lib/format-number"');
    expect(content).toContain("formatCount(outcomeCounts[key])");
  });

  it("press-kit page uses formatCount for view stats", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/press-kits/[kitId]/page.tsx"),
      "utf-8"
    );
    expect(content).toContain('import { formatCount } from "@/lib/format-number"');
    expect(content).toContain("formatCount(stats.totalViews)");
    expect(content).toContain("formatCount(stats.uniqueVisitors)");
  });
});
