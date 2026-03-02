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

  it("should use leaderboard data for all available workflows", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("fetchSectionLeaderboard");
    expect(content).toContain("section-leaderboard");
    expect(content).toContain("useAuthQuery");
  });

  it("should also fetch deployed workflows for detail panel IDs", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("listWorkflows");
    expect(content).toContain("workflowNameToId");
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

  it("should show empty state when no workflows available", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("No workflows available");
  });

  it("should have a loading state", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("isLoading");
    expect(content).toContain("animate-pulse");
  });
});
