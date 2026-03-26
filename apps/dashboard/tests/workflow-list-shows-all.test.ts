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

  it("should group active workflows by displayName (dynasty pattern)", () => {
    expect(content).toContain("dynastyWorkflows");
    expect(content).toContain("byDisplayName");
  });

  it("should use displayName from workflow for display", () => {
    expect(content).toContain("displayName");
    expect(content).toContain("wf.displayName");
  });

  it("should wait for workflowsLoading before rendering the table", () => {
    expect(content).toContain("workflowsLoading");
  });

  it("should build rows from dynasty workflows with stats lookup", () => {
    expect(content).toContain("dynastyWorkflows.map");
    expect(content).toContain("statsMap.get");
  });
});
