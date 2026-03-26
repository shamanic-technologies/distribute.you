import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflow viewer page — chat context", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/workflows/[workflowId]/page.tsx"
  );

  const content = fs.readFileSync(pagePath, "utf-8");

  it("should include the current workflow identity in instructions", () => {
    expect(content).toContain("workflow.displayName || workflow.name");
    expect(content).toContain("workflow.id");
  });

  it("should instruct the LLM NOT to ask which workflow the user means", () => {
    expect(content).toContain("do NOT ask which workflow the user means");
  });

  it("should instruct the LLM NOT to list other workflows unprompted", () => {
    expect(content).toContain("do NOT list other workflows unless explicitly asked");
  });

  it("should pass workflowContext to WorkflowChat", () => {
    expect(content).toContain("workflowContext={workflowContext}");
  });
});
