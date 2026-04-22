import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Campaign stop button functionality has moved from the old brand-scoped
 * campaigns list page to the feature-scoped page at:
 * orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/page.tsx
 *
 * The stop button is now a StopCampaignButton component using useStopCampaign hook.
 */

const pagePath = path.join(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Campaign list stop button", () => {
  it("should import useStopCampaign from use-stop-campaign", () => {
    expect(content).toContain("useStopCampaign");
    expect(content).toContain("@/lib/use-stop-campaign");
  });

  it("should show stop button only for ongoing campaigns", () => {
    expect(content).toMatch(/status\s*===\s*["']ongoing["']/);
  });

  it("should prevent Link navigation when clicking stop", () => {
    expect(content).toContain("e.preventDefault()");
  });
});

describe("Campaign list skeleton loading", () => {
  it("should use CampaignRowSkeleton for initial load", () => {
    expect(content).toContain("CampaignRowSkeleton");
  });

  it("should show inline skeleton when stats are not yet loaded", () => {
    expect(content).toContain("animate-pulse");
    expect(content).toMatch(/statsReady/);
  });
});
