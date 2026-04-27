import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the sidebar-wrapper fetched campaign emails and articles with its own
 * useAuthQuery on the same query keys as the page components / CampaignProvider context.
 * The dual observers caused data to flicker every 5 seconds in both sidebar and body.
 *
 * Fix: sidebar-wrapper must NOT duplicate queries that entity pages already make.
 * - Emails: read from useCampaign() context (single observer), like leads.
 * - Articles: rely on featureStats for the sidebar count instead of fetching the full list.
 */
describe("Campaign entity data should not flicker (no duplicate queries)", () => {
  const sidebarWrapperPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/sidebar-wrapper.tsx"
  );
  const campaignContextPath = path.join(
    __dirname,
    "../src/lib/campaign-context.tsx"
  );

  const sidebarContent = fs.readFileSync(sidebarWrapperPath, "utf-8");
  const contextContent = fs.readFileSync(campaignContextPath, "utf-8");

  it("CampaignProvider should be the single source for campaign emails", () => {
    expect(contextContent).toContain("listCampaignEmails");
  });

  it("sidebar-wrapper must NOT call listCampaignEmails directly", () => {
    expect(sidebarContent).not.toContain("listCampaignEmails");
  });

  it("sidebar-wrapper must get emails from useCampaign() context", () => {
    expect(sidebarContent).toMatch(/emails.*useCampaign|useCampaign.*emails/s);
  });

  it("sidebar-wrapper must NOT call listCampaignArticles directly", () => {
    expect(sidebarContent).not.toContain("listCampaignArticles");
  });
});
