import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Regression guard for the "Run test" button on the sales workflow picker.
// Bug: campaign-service reports a running campaign as "ongoing" / terminal as "stopped",
// but the page gated the test poll + spinner on the literal "active" (a stale openapi
// example value that never matches reality). Result: poll never started, emails never
// rendered — the button "did nothing". See campaign-service DB (only ongoing/stopped exist).
const pagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Workflow test-run status detection", () => {
  it("must NOT gate the test run on the dead 'active' status literal", () => {
    // campaign-service never returns "active"; comparing against it freezes the test poll.
    expect(content).not.toContain('=== "active"');
    expect(content).not.toContain('|| "active"');
  });

  it("detects a running test via the terminal status, not a hardcoded running label", () => {
    expect(content).toContain("isTestRunning");
    expect(content).toContain('!== "stopped"');
  });

  it("stores the backend status verbatim with no silent fallback default", () => {
    expect(content).toContain("status: campaign.status,");
  });

  it("isolates the poll per campaign so one cross-org 404 cannot freeze the others", () => {
    // The poll fans out getCampaign per running test id; a single failure must be caught
    // and logged (fail-loud) instead of rejecting the whole Promise.all batch.
    expect(content).toContain("[dashboard] workflow-test poll failed");
    expect(content).toMatch(/try\s*{[\s\S]*getCampaign\(cid\)[\s\S]*}\s*catch/);
  });
});
