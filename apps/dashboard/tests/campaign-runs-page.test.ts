import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign runs page", () => {
  const runsPagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/runs/page.tsx"
  );
  const sidebarPath = path.join(
    __dirname,
    "../src/components/campaign-sidebar.tsx"
  );
  const apiPath = path.join(__dirname, "../src/lib/api.ts");

  const runsPageContent = fs.readFileSync(runsPagePath, "utf-8");
  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  describe("api.ts", () => {
    it("should export listCampaignRuns function", () => {
      expect(apiContent).toContain("export async function listCampaignRuns");
    });

    it("should call /runs?campaignId= endpoint (runs-service proxy)", () => {
      expect(apiContent).toContain("/runs?campaignId=");
    });

    it("should export CampaignRun type", () => {
      expect(apiContent).toContain("export interface CampaignRun");
    });
  });

  describe("sidebar", () => {
    it("should include a Runs link in settings items", () => {
      expect(sidebarContent).toContain('id: "runs"');
      expect(sidebarContent).toContain('label: "Runs"');
    });

    it("should place Runs after workflow in settings", () => {
      const workflowIdx = sidebarContent.indexOf('id: "workflow"');
      const runsIdx = sidebarContent.indexOf('id: "runs"');
      expect(workflowIdx).toBeGreaterThan(-1);
      expect(runsIdx).toBeGreaterThan(workflowIdx);
    });
  });

  describe("runs page", () => {
    it("should call listCampaignRuns with campaign ID", () => {
      expect(runsPageContent).toContain("listCampaignRuns(campaignId)");
    });

    it("should poll every 5 seconds", () => {
      expect(runsPageContent).toContain("refetchInterval: 5_000");
    });

    it("should build a parent/child run tree from flat list", () => {
      expect(runsPageContent).toContain("buildRunTree");
      expect(runsPageContent).toContain("parentRunId");
    });

    it("should show status badges", () => {
      expect(runsPageContent).toContain("StatusBadge");
      expect(runsPageContent).toContain("completed");
      expect(runsPageContent).toContain("failed");
      expect(runsPageContent).toContain("running");
    });

    it("should display ownCostInUsdCents (not totalCostInUsdCents)", () => {
      expect(runsPageContent).toContain("ownCostInUsdCents");
      expect(runsPageContent).not.toContain("totalCostInUsdCents");
    });
  });
});
