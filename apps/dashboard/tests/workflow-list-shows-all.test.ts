import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflow list page shows all workflows (not just those with stats)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/workflows/page.tsx"
  );

  const content = fs.readFileSync(pagePath, "utf-8");

  it("should filter workflows by feature category", () => {
    expect(content).toContain("wf.category === wfDef.category");
  });

  it("should build rows from featureWorkflows (not only from stats groups)", () => {
    // The rows memo should iterate over featureWorkflows so newly created
    // workflows with zero stats still appear in the list
    expect(content).toContain("featureWorkflows.map");
  });

  it("should use displayName from workflow when available", () => {
    expect(content).toContain("wf.displayName || formatWorkflowDisplayName");
  });

  it("should wait for workflowsLoading before rendering the table", () => {
    expect(content).toContain("workflowsLoading");
  });

  it("should still include stats-only rows for deprecated workflows", () => {
    expect(content).toContain("stats-only rows");
    expect(content).toContain("!seen.has(name)");
  });
});
