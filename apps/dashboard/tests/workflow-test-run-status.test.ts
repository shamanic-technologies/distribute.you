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
    // The poll fans out per running test id; each read's failure is logged (fail-loud)
    // and isolated via Promise.allSettled so it neither rejects the batch nor drops siblings.
    expect(content).toContain("[dashboard] workflow-test getCampaign failed");
    expect(content).toContain("[dashboard] workflow-test listCampaignEmails failed");
  });

  it("gives the test-run campaign a budget so the gate-check does not fail-closed", () => {
    // campaign-service fail-closes the gate-check when no budget is defined
    // ("No budget defined (fail-closed)"). Without a budget the 3-lead test never
    // generates emails: the campaign hangs "ongoing" and the scheduler re-fires the
    // Windmill flow every tick forever. The test-run create call must carry a budget,
    // passed in the same createCampaign call that sets maxLeads: 3.
    expect(content).toContain("maxBudgetTotalUsd");
    expect(content).toMatch(/maxLeads:\s*3,[\s\S]{0,160}maxBudgetTotalUsd/);
  });

  it("decouples the status + emails poll reads so one failure does not drop the other", () => {
    // A single Promise.all([getCampaign, listCampaignEmails]) meant a getCampaign throw
    // (brand-url enrichment) also dropped the emails — the poll returned {} every cycle
    // and the modal hung on "Generating emails…" forever though the emails were ready.
    expect(content).toContain("Promise.allSettled");
  });

  it("renders the cold-email body from the sequence, not only the null top-level bodyText", () => {
    // Sequenced cold-emails store the body in sequence[].bodyText; top-level bodyText is null.
    expect(content).toContain("sequence?.[0]?.bodyText");
  });

  it("shows a terminal state instead of an endless spinner when a test ends with no emails / errors", () => {
    expect(content).toContain("No emails were generated");
    // A poll error surfaces in the panel rather than freezing on the loading text.
    expect(content).toContain("t?.error");
  });

  it("lets a test email expand to its full multi-step sequence on click", () => {
    // The card was a static line-clamp-3 preview with no way to read the full email.
    expect(content).toContain("expandedTestEmailId");
    expect(content).toContain("steps.map");
  });
});
