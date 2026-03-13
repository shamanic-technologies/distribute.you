import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("FunnelMetrics bar chart", () => {
  const filePath = path.resolve(
    __dirname,
    "../src/components/campaign/funnel-metrics.tsx"
  );
  const content = fs.readFileSync(filePath, "utf-8");

  it("should use a single bar color (no stacked two-tone bars)", () => {
    // Only one bg-brand class on bars, not a nested outer/inner pattern
    expect(content).toContain("bg-brand-500");
    // Should NOT have the old light+dark stacking pattern
    expect(content).not.toContain("bg-brand-100");
  });

  it("should not use transition-all on bars (prevents jumpy animation on poll)", () => {
    expect(content).not.toContain("transition-all");
  });

  it("should use fixed-height bar container for consistent alignment", () => {
    // All bars share a fixed pixel-height container so bottoms align
    expect(content).toContain("height: 128");
  });

  it("should reserve fixed space for rate label to prevent layout shift", () => {
    // Rate label area has fixed height even when empty (first bar has no rate)
    expect(content).toContain("h-4");
    expect(content).toContain("&nbsp;");
  });

  it("should export a skeleton loader component", () => {
    expect(content).toContain("export function FunnelMetricsSkeleton");
    expect(content).toContain("animate-pulse");
  });
});

describe("ReplyBreakdown chart", () => {
  const filePath = path.resolve(
    __dirname,
    "../src/components/campaign/reply-breakdown.tsx"
  );
  const content = fs.readFileSync(filePath, "utf-8");

  it("should not use transition-all on bars", () => {
    expect(content).not.toContain("transition-all");
  });

  it("should export a skeleton loader component", () => {
    expect(content).toContain("export function ReplyBreakdownSkeleton");
    expect(content).toContain("animate-pulse");
  });
});

describe("Feature page skeleton loaders", () => {
  const filePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/page.tsx"
  );
  const content = fs.readFileSync(filePath, "utf-8");

  it("should import skeleton components", () => {
    expect(content).toContain("FunnelMetricsSkeleton");
    expect(content).toContain("ReplyBreakdownSkeleton");
  });

  it("should show skeletons during loading state", () => {
    expect(content).toContain("<FunnelMetricsSkeleton");
    expect(content).toContain("<ReplyBreakdownSkeleton");
  });

  it("should wait for all data queries before showing stats (not just campaigns)", () => {
    // statsLoading combines all query loading states so charts don't flash with partial data
    expect(content).toContain("statsLoading");
    expect(content).toContain("isLoadingBatchStats");
    expect(content).toContain("isLoadingDelivery");
    expect(content).toContain("isLoadingCosts");
  });
});
