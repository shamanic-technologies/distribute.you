import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Feature workflows page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/features/[featureId]/workflows/page.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should import WORKFLOW_DEFINITIONS from content package", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WORKFLOW_DEFINITIONS");
    expect(content).toContain("@distribute/content");
  });

  it("should use fetchRankedWorkflows for data", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("fetchRankedWorkflows");
    expect(content).toContain("ranked-workflows");
    expect(content).toContain("useAuthQuery");
  });

  it("should NOT use old fetchFeatureLeaderboard or listWorkflows", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("fetchFeatureLeaderboard");
    expect(content).not.toContain("listWorkflows");
    expect(content).not.toContain("deprecatedSet");
  });

  it("should use WorkflowDetailPanel for detail view", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WorkflowDetailPanel");
    expect(content).toContain("detailWorkflowId");
  });

  it("should display performance stats per workflow", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("emailsSent");
    expect(content).toContain("openRate");
    expect(content).toContain("replyRate");
    expect(content).toContain("costPerReplyCents");
    expect(content).toContain("runCount");
  });

  it("should use workflow ID for detail panel (not name-based)", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("setDetailWorkflowId(row.id)");
    expect(content).not.toContain("workflowNameToId");
  });

  it("should have a loading state", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("isLoading");
    expect(content).toContain("animate-pulse");
  });

  it("should use rankedToRow to flatten items", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("rankedToRow");
    expect(content).toContain("WorkflowRowData");
  });
});
