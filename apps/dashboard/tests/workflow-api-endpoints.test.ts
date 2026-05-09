import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiContent = fs.readFileSync(
  path.resolve(__dirname, "../src/lib/api.ts"),
  "utf-8",
);

describe("Workflow API endpoints (create/upgrade/fork split)", () => {
  it("removes legacy generateWorkflow function", () => {
    expect(apiContent).not.toMatch(/export async function generateWorkflow\b/);
  });

  it("removes legacy /workflows/generate URL", () => {
    expect(apiContent).not.toContain("/workflows/generate");
  });

  it("removes legacy GenerateWorkflowRequest / Result interfaces", () => {
    expect(apiContent).not.toMatch(/interface GenerateWorkflowRequest\b/);
    expect(apiContent).not.toMatch(/interface GenerateWorkflowResult\b/);
  });

  it("exports createWorkflow that POSTs /workflows/create", () => {
    expect(apiContent).toContain("export async function createWorkflow");
    const fnMatch = apiContent.match(
      /export async function createWorkflow\([\s\S]*?\n\}/,
    );
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('"/workflows/create"');
    expect(fnMatch![0]).toContain('method: "POST"');
  });

  it("does not export upgradeWorkflow (agent-only via api-service tool)", () => {
    expect(apiContent).not.toMatch(/export async function upgradeWorkflow\b/);
    expect(apiContent).not.toContain("/workflows/upgrade");
    expect(apiContent).not.toMatch(/interface UpgradeWorkflowRequest\b/);
  });

  it("does not export forkWorkflow (agent-only via api-service tool)", () => {
    expect(apiContent).not.toMatch(/export async function forkWorkflow\b/);
    expect(apiContent).not.toMatch(/interface ForkWorkflowRequest\b/);
  });
});
