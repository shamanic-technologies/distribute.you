import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

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
    // Find the definition inside WORKFLOW_DEFINITIONS array (not the JSDoc comment)
    const defsStart = content.indexOf("WORKFLOW_DEFINITIONS:");
    const defsContent = content.slice(defsStart);
    const salesIdx = defsContent.indexOf("sales-email-cold-outreach");
    const salesBlock = defsContent.slice(salesIdx, salesIdx + 300);
    expect(salesBlock).toContain("implemented: true");
  });

  it("should have new features as not yet implemented", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("journalists-email-cold-outreach");
    expect(content).toContain("webinars");
    expect(content).toContain("welcome-email");
  });
});
