import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchPath = path.resolve(
  __dirname,
  "../../src/lib/performance/fetch-leaderboard.ts"
);
const content = fs.readFileSync(fetchPath, "utf-8");

describe("Leaderboard fetch uses renamed workflow fields from features-service", () => {
  it("should use workflowSlug/workflowName in WorkflowRankedItem type (not slug/name)", () => {
    expect(content).toContain("workflowSlug: string");
    expect(content).toContain("workflowName: string");
    expect(content).toContain("workflowDynastyName: string");
    expect(content).toContain("workflowDynastySlug: string");
  });

  it("should read r.workflow.workflowName (not r.workflow.name)", () => {
    expect(content).toContain("r.workflow.workflowName");
    expect(content).not.toMatch(/r\.workflow\.name[^:]/);
  });

  it("should read r.workflow.workflowDynastyName (not r.workflow.dynastyName)", () => {
    expect(content).toContain("r.workflow.workflowDynastyName");
    expect(content).not.toContain("r.workflow.dynastyName");
  });
});
