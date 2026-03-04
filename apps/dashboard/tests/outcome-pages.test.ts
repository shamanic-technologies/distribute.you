import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Outcome overview page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/outcomes/[outcomeId]/page.tsx"
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

  it("should show 'Coming Soon' for unimplemented outcomes", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Coming Soon");
    expect(content).toContain("implemented");
  });

  it("should use listCampaigns for implemented outcomes", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("listCampaigns");
    expect(content).toContain("getCampaignBatchStats");
  });

  it("should link to create campaign page", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Create Campaign");
    expect(content).toContain("/new");
  });
});

describe("Workflow definitions include implemented flag", () => {
  const workflowsPath = path.join(
    __dirname,
    "../../../shared/content/src/workflows.ts"
  );

  it("should have implemented field in WorkflowDefinition", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("implemented: boolean");
  });

  it("should have sales-email-cold-outreach as implemented", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    const defsStart = content.indexOf("WORKFLOW_DEFINITIONS:");
    const defsContent = content.slice(defsStart);
    const salesIdx = defsContent.indexOf("sales-email-cold-outreach");
    const salesBlock = defsContent.slice(salesIdx, salesIdx + 300);
    expect(salesBlock).toContain("implemented: true");
  });

  it("should have new outcomes as not yet implemented", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("journalists-email-cold-outreach");
    expect(content).toContain("webinars");
    expect(content).toContain("welcome-email");
  });
});
