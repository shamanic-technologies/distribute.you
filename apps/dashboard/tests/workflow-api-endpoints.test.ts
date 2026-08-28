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

  it("no longer exports createWorkflow — the page that called it is deleted", () => {
    // The brand Workflows surface was `useFeatureFlag`-gated, i.e. rendered for
    // nobody, and went with the rest of that cluster. Workflow authoring lives in
    // `apps/admin`, where the gate resolves.
    expect(apiContent).not.toContain("export async function createWorkflow");
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
