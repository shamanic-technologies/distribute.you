import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * api-service must create a parent run before calling campaign-service
 * so that ALL downstream costs (enrichment, generation, email-send)
 * are linked in a single run tree.
 */
describe("Campaign routes create parent runs", () => {
  const routePath = path.join(__dirname, "../../src/routes/campaigns.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should import createRun from runs-client", () => {
    expect(content).toContain("createRun");
  });

  it("should import updateRun from runs-client", () => {
    expect(content).toContain("updateRun");
  });

  it("should create a parent run in POST /campaigns before forwarding", () => {
    // createRun must appear before callExternalService("/campaigns")
    const createRunIndex = content.indexOf('taskName: "create-campaign"');
    const forwardIndex = content.indexOf("parentRunId: parentRun.id");
    expect(createRunIndex).toBeGreaterThan(-1);
    expect(forwardIndex).toBeGreaterThan(createRunIndex);
  });

  it("should pass parentRunId to campaign-service in POST /campaigns body", () => {
    expect(content).toContain("parentRunId: parentRun.id");
  });

  it("should create a parent run in POST /campaigns/:id/resume", () => {
    expect(content).toContain('taskName: "resume-campaign"');
  });

  it("should pass parentRunId to campaign-service in resume body", () => {
    // The resume handler should include parentRunId in the activate PATCH
    const resumeSection = content.slice(content.indexOf("resume-campaign"));
    expect(resumeSection).toContain("parentRunId: parentRun.id");
  });

  it("should mark parent run as failed if campaign-service call fails", () => {
    expect(content).toContain('updateRun(parentRun.id, "failed")');
  });

  it("should complete parent run when campaign is stopped", () => {
    expect(content).toContain('updateRun(campaign.parentRunId, "completed")');
  });
});
