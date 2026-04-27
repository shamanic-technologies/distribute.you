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

  it("should filter by featureSlug + objective instead of category/channel/audienceType", () => {
    expect(content).toContain("featureSlug: featureId");
    expect(content).toContain("objective:");
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
    expect(content).toContain("stats.completedRuns");
    expect(content).toContain("stats.totalOutcomes");
    expect(content).toContain("stats.costPerOutcome");
  });

  it("should display the dynasty name (dynastyName) not signatureName", () => {
    expect(content).toContain("formatDisplayName");
    // Should NOT use signatureName for display in the row
    expect(content).not.toMatch(/wf\.signatureName\s*\?/);
  });

  it("should send the active workflow slug (not name) for campaign creation", () => {
    expect(content).toContain("workflowSlug: selectedRow.slug");
    // Must NOT use .name — names have spaces/capitalization, slugs are lowercase-hyphenated
    expect(content).not.toContain("workflowSlug: selectedRow.name");
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
  it("should map totalOutcomes and completedRuns directly from stats", () => {
    expect(content).toContain("stats.totalOutcomes");
    expect(content).toContain("stats.completedRuns");
  });

  it("should map costPerOutcome from stats", () => {
    expect(content).toContain("stats.costPerOutcome");
  });
});
