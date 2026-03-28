import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/features/[featureId]/new/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Feature creation page uses ranked workflows endpoint", () => {
  it("should fetch from fetchRankedWorkflows instead of leaderboard+listWorkflows", () => {
    expect(content).toContain("fetchRankedWorkflows");
    expect(content).not.toContain("fetchFeatureLeaderboard");
    expect(content).not.toContain("listWorkflows");
  });

  it("should filter by featureSlug instead of category/channel/audienceType", () => {
    expect(content).toContain("featureSlug: featureId");
    expect(content).not.toContain("featureDef!.category");
    expect(content).not.toContain("featureDef!.channel");
    expect(content).not.toContain("featureDef!.audienceType");
  });

  it("should use workflow ID as stable selection key (not workflowName)", () => {
    expect(content).toContain("selectedWorkflowId");
    expect(content).not.toMatch(/selectedWorkflow[^I]/);
    expect(content).toContain("effectiveSelectionId");
  });

  it("should derive table rows from RankedWorkflowItem stats", () => {
    expect(content).toContain("rankedToRow");
    expect(content).toContain("stats.email.broadcast");
    expect(content).toContain("stats.totalCostInUsdCents");
  });

  it("should display the dynasty name (dynastyName) not signatureName", () => {
    expect(content).toContain("formatDisplayName");
    // Should NOT use signatureName for display in the row
    expect(content).not.toMatch(/wf\.signatureName\s*\?/);
  });

  it("should send the active workflow name for campaign creation", () => {
    expect(content).toContain("workflowSlug: selectedRow.name");
  });

  it("should use workflow ID directly for detail panel (no name-based lookup)", () => {
    expect(content).toContain("setDetailWorkflowId(wf.id)");
    expect(content).not.toContain("workflowNameToId");
  });

  it("should not need deprecated names filtering (ranked only returns active)", () => {
    expect(content).not.toContain("deprecatedNames");
  });
});

describe("rankedToRow computes display metrics from raw stats", () => {
  it("should compute rates from broadcast email stats", () => {
    expect(content).toContain("b.opened / b.sent");
    expect(content).toContain("b.clicked / b.sent");
    expect(content).toContain("b.replied / b.sent");
  });

  it("should compute cost-per metrics from total cost", () => {
    expect(content).toContain("cost / b.opened");
    expect(content).toContain("cost / b.clicked");
    expect(content).toContain("cost / b.replied");
  });

  it("should handle zero-sent case with zero rates", () => {
    expect(content).toContain("b.sent > 0 ?");
  });
});
