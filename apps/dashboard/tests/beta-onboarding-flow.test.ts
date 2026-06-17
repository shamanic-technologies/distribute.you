import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Source-substring guard for the beta guided onboarding. Pins the load-bearing
// wiring (live endpoints, services step, goal-driven rate, outcome-count budget,
// wallet setup, server-backed personas + Edit-with-AI, agency consent) so a refactor that
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

  it("welcome step shows value propositions instead of indicative price cards", () => {
    for (const copy of [
      "Drop your URL",
      "We run outreach",
      "You get outcomes",
      "Finds leads and contacts buyers across the best channels.",
    ]) {
      expect(src).toContain(copy);
    }
    expect(src).not.toContain('v: "~$15"');
    expect(src).not.toContain('v: "~$90"');
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

  it("asks the conversion rates that feed the selected goal", () => {
    expect(src).toContain("RATE_KEYS_FOR_OUTCOME");
    expect(src).toContain("Website visits to signup rate");
    expect(src).toContain("Positive reply → sales meeting");
    expect(src).toContain("Website visit → sales meeting");
    expect(src).toContain("Only set this above 0 if prospects can book a meeting directly from your website");
  });

  it("server-backed personas with Edit-with-AI (no draft-only model)", () => {
    expect(src).toContain("Who do you want to sell to?");
    expect(src).toContain("EditWithAIChat");
    expect(src).toContain("listPersonas");
    expect(src).toContain("showLifecycleActions={false}");
    expect(src).toContain('configKey="persona-editor"');
    expect(src).not.toContain("pause, resume and archive your personas");
  });

  it("does not fail the whole onboarding when optional AI suggestions 502", () => {
    expect(src).toContain("seedOnboardingPersonaFromBrandInfo");
    expect(src).toContain("suggest/create persona (onboarding seed) failed");
    expect(src).toContain("hydrateOnboardingInBackground");
    expect(src).toContain("extractBrandFields failed");
    expect(src).toContain("GENERIC_AI_SETUP_ERROR");
    expect(src).toContain("displaySetupError");
  });

  it("agency consent with no channel checkboxes", () => {
    expect(src).toContain("on your behalf");
    expect(src).toContain("consentedChannels");
    expect(src).toContain("agencyConsentAt");
    // The channels checkbox grid was removed.
    expect(src).not.toContain("Coming soon");
    expect(src).not.toContain("Always on");
  });

  it("budget is picked as outcome-count tiers before wallet setup", () => {
    expect(src).toContain("COUNT_TIERS");
    expect(src).toContain("budgetForCount");
    expect(src).toContain("Continue to wallet setup");
    expect(src).toContain("Set up your org wallet.");
    expect(src).toContain("Your first load is matched dollar-for-dollar up to $25 free.");
  });

  it("lets a filled Other budget card be reselected after choosing another tier", () => {
    expect(src).toContain("const selectCustomCount = () =>");
    expect(src).toContain("if (isCustom) setSelectedCount(customN)");
    expect(src).toContain("onClick={selectCustomCount}");
  });
});
