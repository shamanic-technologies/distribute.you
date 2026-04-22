import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflow list page shows all workflows (not just those with stats)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/workflows/page.tsx"
  );

  const content = fs.readFileSync(pagePath, "utf-8");

  it("should filter workflows by featureSlug via API", () => {
    expect(content).toContain("listWorkflows({ featureDynastySlug })");
  });

  it("should include resolvedSlug in the query key", () => {
    expect(content).toContain('["workflows", featureDynastySlug]');
  });

  it("should group active workflows by dynastySlug (dynasty pattern)", () => {
    expect(content).toContain("dynastyWorkflows");
    expect(content).toContain("byDynasty");
  });

  it("should use dynastyName from workflow for display", () => {
    expect(content).toContain("dynastyName");
    expect(content).toContain("wf.dynastySlug");
  });

  it("should wait for workflowsLoading before rendering the table", () => {
    expect(content).toContain("workflowsLoading");
  });

  it("should build rows from dynasty workflows with stats lookup", () => {
    expect(content).toContain("dynastyWorkflows.map");
    expect(content).toContain("statsMap.get");
  });
});
