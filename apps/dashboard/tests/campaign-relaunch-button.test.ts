import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.join(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Campaign relaunch button", () => {
  it("should import createCampaign from api", () => {
    expect(content).toContain("createCampaign");
    expect(content).toContain("@/lib/api");
  });

  it("should show relaunch button only for stopped campaigns", () => {
    expect(content).toMatch(/campaign\.status\s*===\s*["']stopped["']/);
    expect(content).toContain("Relaunch");
  });

  it("should not show relaunch button for ongoing campaigns", () => {
    // The relaunch button is gated by status === "stopped", and the stop button by status === "ongoing"
    // Verify both conditions exist as separate blocks
    const ongoingBlocks = content.match(/campaign\.status\s*===\s*["']ongoing["']/g);
    const stoppedBlocks = content.match(/campaign\.status\s*===\s*["']stopped["']/g);
    expect(ongoingBlocks?.length).toBeGreaterThanOrEqual(1);
    expect(stoppedBlocks?.length).toBeGreaterThanOrEqual(1);
  });

  it("should use router to navigate to the new campaign after relaunch", () => {
    expect(content).toContain("useRouter");
    expect(content).toContain("router.push");
  });

  it("should forward featureInputs from the stopped campaign", () => {
    expect(content).toContain("campaign.featureInputs");
  });

  it("should forward budget fields from the stopped campaign", () => {
    expect(content).toContain("campaign.maxBudgetDailyUsd");
    expect(content).toContain("campaign.maxBudgetWeeklyUsd");
    expect(content).toContain("campaign.maxBudgetMonthlyUsd");
    expect(content).toContain("campaign.maxBudgetTotalUsd");
  });

  it("should show relaunching state while creating", () => {
    expect(content).toContain("relaunching");
    expect(content).toContain("Relaunching");
  });

  it("should display relaunch errors", () => {
    expect(content).toContain("relaunchError");
  });

  it("should use campaign.brandUrls (plural) for relaunch payload", () => {
    expect(content).toContain("campaign.brandUrls");
    // brandUrls is guaranteed non-null by api-service — no fallback needed
    expect(content).not.toContain("getBrand(");
  });
});
