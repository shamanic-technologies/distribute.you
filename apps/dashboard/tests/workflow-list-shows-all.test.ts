import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflow list page shows all workflows (not just those with stats)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/workflows/page.tsx"
  );

  const content = fs.readFileSync(pagePath, "utf-8");

  it("should filter workflows by featureSlug via API", () => {
    expect(content).toContain("listWorkflows({ featureSlug })");
  });

  it("should include featureSlug in the query key", () => {
    expect(content).toContain('["workflows", featureSlug]');
  });

  it("should build rows from dynasty workflows (not only from stats groups)", () => {
    // The rows memo should iterate over dynastyWorkflows so newly created
    // workflows with zero stats still appear in the list
    expect(content).toContain("dynastyWorkflows.map");
  });

  it("should use displayName from workflow", () => {
    expect(content).toContain("wf.displayName");
  });

  it("should wait for workflowsLoading before rendering the table", () => {
    expect(content).toContain("workflowsLoading");
  });

  it("should group workflows by dynasty (displayName)", () => {
    expect(content).toContain("byDisplayName");
  });
});
