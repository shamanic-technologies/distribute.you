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

  it("exports upgradeWorkflow that POSTs /workflows/upgrade with workflowSlug + hints as string[]", () => {
    expect(apiContent).toContain("export async function upgradeWorkflow");
    const fnMatch = apiContent.match(
      /export async function upgradeWorkflow\([\s\S]*?\n\}/,
    );
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('"/workflows/upgrade"');
    expect(fnMatch![0]).toContain('method: "POST"');
    const reqMatch = apiContent.match(
      /interface UpgradeWorkflowRequest \{[\s\S]*?\n\}/,
    );
    expect(reqMatch).toBeTruthy();
    expect(reqMatch![0]).toContain("workflowSlug:");
    expect(reqMatch![0]).toContain("description:");
    expect(reqMatch![0]).toMatch(/hints\?:\s*string\[\]/);
  });

  it("exports forkWorkflow that PUTs /workflows/:id", () => {
    expect(apiContent).toContain("export async function forkWorkflow");
    const fnMatch = apiContent.match(
      /export async function forkWorkflow\([\s\S]*?\n\}/,
    );
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toMatch(/`\/workflows\/\$\{[^}]+\}`/);
    expect(fnMatch![0]).toContain('method: "PUT"');
  });
});
