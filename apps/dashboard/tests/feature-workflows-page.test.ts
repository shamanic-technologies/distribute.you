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

  it("should fetch workflows from API", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("listWorkflows");
    expect(content).toContain("useAuthQuery");
  });

  it("should filter workflows by featureId", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("w.name.startsWith(featureId)");
  });

  it("should use WorkflowDetailPanel for detail view", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WorkflowDetailPanel");
    expect(content).toContain("detailWorkflowId");
  });

  it("should have workflow rows with display info", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("displayName");
    expect(content).toContain("signatureName");
    expect(content).toContain("requiredProviders");
    expect(content).toContain("description");
  });

  it("should show empty state when no workflows", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("No workflows deployed");
  });

  it("should have a loading state", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("isLoading");
    expect(content).toContain("animate-pulse");
  });
});
