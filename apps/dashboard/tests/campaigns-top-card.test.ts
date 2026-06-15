import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

const CAMPAIGNS_PAGE =
  "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/page.tsx";

/**
 * The feature Campaigns page's cost/efficiency column shows a Top-3 campaigns-by-ROI
 * list (same card the feature Overview uses), replacing the former
 * "Top workflows by ROI" card. ROI = expected pipeline ÷ run cost per campaign,
 * from features-service `/revenue?groupBy=campaignId`. Running campaigns first.
 */
describe("Campaigns page — wires TopCampaignsCard as the bottom card", () => {
  const page = read(CAMPAIGNS_PAGE);

  it("passes TopCampaignsCard into RevenueCostSummary's bottomCard slot", () => {
    expect(page).toContain("<TopCampaignsCard");
    expect(page).toContain("basePath={`/orgs/${orgId}/brands/${brandId}`}");
  });

  it("no longer references the removed TopWorkflowsCard", () => {
    expect(page).not.toContain("TopWorkflowsCard");
  });
});
