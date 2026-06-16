import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Source-substring guard for the beta guided onboarding. Pins the load-bearing
// wiring (live endpoints, per-outcome pricing, agency consent) so a refactor that
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

  it("offers the six outcomes and prices in the chosen unit", () => {
    for (const unit of ["page-visits", "signups", "purchases", "conversations", "meetings", "sales-revenue"]) {
      expect(src).toContain(unit);
    }
    expect(src).toContain("outcomeUnitCost");
  });

  it("only the two funnels Website Purchase + Sales Meeting", () => {
    expect(src).toContain("Website Purchase");
    expect(src).toContain("Sales Meeting");
    expect(src).not.toContain("Website Signups");
  });

  it("agency-channel consent: cold email locked, others Coming soon", () => {
    expect(src).toContain("Coming soon");
    expect(src).toContain("on your behalf");
    // Email channel is non-toggleable.
    expect(src).toContain('key === "email"');
  });

  it("persists channel consent on the brand profile (no backend field needed)", () => {
    expect(src).toContain("consentedChannels");
    expect(src).toContain("agencyConsentAt");
  });
});
