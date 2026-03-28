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

  it("should import useFeatures from features-context", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("useFeatures");
    expect(content).toContain("@/lib/features-context");
  });

  it("should use fetchFeatureStats with groupBy workflowDynastySlug for data", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("fetchFeatureStats");
    expect(content).toContain('groupBy: "workflowDynastySlug"');
    expect(content).toContain("useAuthQuery");
  });

  it("should NOT use old fetchRankedWorkflows or rankedToRow", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("fetchRankedWorkflows");
    expect(content).not.toContain("rankedToRow");
    expect(content).not.toContain("WorkflowRowData");
  });

  it("should display dynamic stats from feature outputs and registry", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("formatStatValue");
    expect(content).toContain("registry");
    expect(content).toContain("sortedOutputs");
  });

  it("should use WorkflowDetailPanel for detail view", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WorkflowDetailPanel");
    expect(content).toContain("detailWorkflowId");
  });

  it("should have a loading state", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("isLoading");
    expect(content).toContain("animate-pulse");
  });

  it("should have workflows-list test id", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("workflows-list");
  });
});
