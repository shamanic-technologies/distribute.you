import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the sidebar-wrapper fetched campaign emails with its own useAuthQuery
 * on the same query key ("campaignEmails") as the CampaignProvider context. The two
 * observers had conflicting options (different refetchInterval and placeholderData),
 * causing the email data to flicker every 5 seconds in both sidebar and body.
 *
 * Fix: sidebar-wrapper must use emails from useCampaign() context (single observer),
 * just like it already does for leads.
 */
describe("Campaign emails should not flicker (no duplicate query)", () => {
  const sidebarWrapperPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/sidebar-wrapper.tsx"
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
    // Should destructure emails from the campaign context
    expect(sidebarContent).toMatch(/emails.*useCampaign|useCampaign.*emails/s);
  });
});
