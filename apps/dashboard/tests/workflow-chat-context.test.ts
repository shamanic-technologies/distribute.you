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
    expect(content).toContain("workflow.workflowDynastyName");
    expect(content).toContain("workflow.id");
  });

  it("should include all workflow identity fields in context", () => {
    expect(content).toContain("id: workflow.id");
    expect(content).toContain("workflowSlug: workflow.workflowSlug");
    expect(content).toContain("workflowDynastySlug: workflow.workflowDynastySlug");
    expect(content).toContain("workflowDynastyName: workflow.workflowDynastyName");
    expect(content).toContain("version: workflow.version");
  });

  it("should include feature identity fields in context (no dynasty fields)", () => {
    expect(content).toContain("id: feature.id");
    expect(content).toContain("slug: feature.slug");
    expect(content).toContain("name: feature.name");
    expect(content).not.toContain("workflowDynastySlug: feature.workflowDynastySlug");
    expect(content).not.toContain("workflowDynastyName: feature.workflowDynastyName");
  });

  it("should not put featureSlug in the workflow object (it belongs to feature)", () => {
    // featureSlug should not appear inside the workflow context object
    const workflowBlock = content.match(/workflow:\s*\{[\s\S]*?\},\s*dag:/);
    if (workflowBlock) {
      expect(workflowBlock[0]).not.toContain("featureSlug");
    }
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

  it("should restrict editing scope exclusively to the current workflow", () => {
    expect(content).toContain("EXCLUSIVELY this workflow");
    expect(content).toContain("MUST NOT modify or delete any other workflow");
  });

  it("should allow reading other workflows for reference", () => {
    expect(content).toContain("CAN and SHOULD read other workflows for reference");
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

  it("should prohibit modifying other workflows", () => {
    expect(content).toContain("NEVER modify or delete any workflow other than");
  });

  it("should encourage reading other workflows for reference", () => {
    expect(content).toContain("CAN and SHOULD read other workflows for reference");
  });

  it("should describe editing scope violation as a critical error", () => {
    expect(content).toContain("critical error");
    expect(content).toContain("Reading other workflows is not a violation");
  });
});
