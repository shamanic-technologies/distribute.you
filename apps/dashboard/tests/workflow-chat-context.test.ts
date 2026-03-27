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

  it("should explicitly tell the model to use the workflow UUID for tool calls", () => {
    expect(content).toContain("For ALL tool calls requiring a workflowId parameter");
    expect(content).toContain("Never ask the user for the workflow ID");
  });

  it("should pass workflowContext to WorkflowChat", () => {
    expect(content).toContain("workflowContext={workflowContext}");
  });

  it("should restrict scope exclusively to the current workflow", () => {
    expect(content).toContain("EXCLUSIVELY this workflow");
    expect(content).toContain("MUST NOT read, modify, or interact with any other workflow");
  });
});

describe("Platform chat system prompt — scope enforcement", () => {
  const instrumentationPath = path.join(
    __dirname,
    "../src/instrumentation.ts"
  );

  const content = fs.readFileSync(instrumentationPath, "utf-8");

  it("should have a SCOPE ENFORCEMENT section in the system prompt", () => {
    expect(content).toContain("SCOPE ENFORCEMENT");
  });

  it("should prohibit list_workflows when workflowId is in context", () => {
    expect(content).toContain("NEVER call list_workflows");
  });

  it("should mark list_workflows as off limits when workflowId is present", () => {
    expect(content).toContain("this tool is OFF LIMITS");
  });

  it("should describe scope violation as a critical error", () => {
    expect(content).toContain("critical error");
  });
});
