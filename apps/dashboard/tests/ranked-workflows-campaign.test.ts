import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Campaign creation page uses feature stats + dynasty workflows", () => {
  it("should fetch feature stats grouped by workflow for display columns", () => {
    expect(content).toContain("fetchFeatureStats");
    expect(content).toContain('groupBy: "workflowName"');
  });

  it("should fetch workflows via listWorkflows filtered by featureSlug", () => {
    expect(content).toContain("listWorkflows({ featureSlug })");
  });

  it("should group workflows by displayName (dynasty pattern)", () => {
    expect(content).toContain("byDisplayName");
    expect(content).toContain("wf.displayName");
  });

  it("should use dynamic feature outputs for table columns (not hardcoded email columns)", () => {
    expect(content).toContain("sortedOutputs");
    expect(content).toContain("featureDef?.outputs");
    expect(content).toContain("formatStatValue");
    // Should NOT have hardcoded email column headers
    expect(content).not.toContain('"% Opens"');
    expect(content).not.toContain('"$/Open"');
    expect(content).not.toContain('"$/Reply"');
  });

  it("should filter by featureSlug", () => {
    expect(content).toContain("featureSlug");
  });

  it("should use workflow ID as stable selection key", () => {
    expect(content).toContain("selectedWorkflowId");
    expect(content).toContain("effectiveSelectionId");
  });

  it("should send the active workflow name for campaign creation", () => {
    expect(content).toContain("workflowName: selectedRow.name");
  });

  it("should wrap input values in featureInputs, not spread as top-level", () => {
    expect(content).toContain("featureInputs: inputValues");
    expect(content).not.toContain("...inputValues");
  });

  it("should use workflow ID directly for detail panel", () => {
    expect(content).toContain("setDetailWorkflowId(wf.id)");
    expect(content).not.toContain("workflowNameToId");
  });

  it("should not need deprecated names filtering", () => {
    expect(content).not.toContain("deprecatedNames");
  });

  it("should use registry from features context for stat formatting", () => {
    expect(content).toContain("registry");
    expect(content).toContain("sortDirectionForType");
  });
});
