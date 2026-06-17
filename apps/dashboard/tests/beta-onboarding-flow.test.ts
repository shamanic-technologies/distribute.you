import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Source-substring guard for the beta guided onboarding. Pins the load-bearing
// wiring (live endpoints, services step, goal-driven rate, outcome-count budget,
// server-backed personas + Edit-with-AI, agency consent) so a refactor that
// silently drops a real fetch / the launch is caught. Beta-gated via isBetaEmail.
describe("Beta onboarding guided flow", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/beta-onboarding.tsx"),
    "utf-8",
  );

  it("fetches real data during the loading step (no fake)", () => {
    expect(src).toContain("getBrandProfile");
    expect(src).toContain("getSalesEconomicsEffective");
    expect(src).toContain("suggestPersonas");
    expect(src).toContain("getWorkflowProjection");
  });

  it("persists rates, personas, profile and launches a real campaign", () => {
    expect(src).toContain("saveBrandSalesEconomics");
    expect(src).toContain("createPersona");
    expect(src).toContain("saveBrandProfileVersion");
    expect(src).toContain("createCampaign");
  });

  it("asks which services to promote and persists them on the brand profile", () => {
    expect(src).toContain("What services do you want to promote with us?");
    expect(src).toContain("services");
  });

  it("offers the two sales goals and prices in the chosen unit", () => {
    expect(src).toContain("What is your primary sales goal?");
    for (const unit of ["signups", "meetings"]) {
      expect(src).toContain(unit);
    }
    expect(src).toContain("outcomeUnitCost");
    // Collapsed away from the old six-outcome list.
    expect(src).not.toContain("sales-revenue");
    expect(src).not.toContain("conversations");
  });

  it("asks exactly one conversion rate, driven by the goal", () => {
    expect(src).toContain("RATE_FOR_OUTCOME");
    expect(src).toContain("Website visits to signup rate");
    expect(src).toContain("Positive reply to sales meeting");
  });

  it("server-backed personas with Edit-with-AI (no draft-only model)", () => {
    expect(src).toContain("Who do you want to sell to?");
    expect(src).toContain("EditWithAIChat");
    expect(src).toContain("listPersonas");
    expect(src).toContain('configKey="persona-editor"');
  });

  it("agency consent with no channel checkboxes", () => {
    expect(src).toContain("on your behalf");
    expect(src).toContain("consentedChannels");
    expect(src).toContain("agencyConsentAt");
    // The channels checkbox grid was removed.
    expect(src).not.toContain("Coming soon");
    expect(src).not.toContain("Always on");
  });

  it("budget is picked as outcome-count tiers with the first-week match callout", () => {
    expect(src).toContain("COUNT_TIERS");
    expect(src).toContain("budgetForCount");
    expect(src).toContain("double your first week");
  });
});
