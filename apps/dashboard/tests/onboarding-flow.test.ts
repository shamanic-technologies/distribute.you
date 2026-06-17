import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Onboarding flow", () => {
  const pagePath = path.join(__dirname, "../src/components/onboarding/default-onboarding.tsx");

  it("should have an onboarding page", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should have a booking-intro step as the first screen", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Book your onboarding call");
    expect(content).toContain("booking-intro");
    expect(content).toContain("Maybe later");
    expect(content).toContain("calendar.app.google");
  });

  it("should have agency and company type selection", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Agency");
    expect(content).toContain("Company");
    expect(content).toContain("type-selection");
  });

  it("should have a URL input step", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("url-input");
    expect(content).toContain("Create Workspace");
    expect(content).toContain("acme.com");
  });

  it("should use Clerk SDK to create org (not api.ts or /apps/register)", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("useOrganizationList");
    expect(content).toContain("createOrganization");
    expect(content).toContain("setActive");
    expect(content).toContain('@clerk/nextjs');
    expect(content).not.toContain("/apps/register");
  });

  it("should NOT show API keys after onboarding", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("apiKey");
    expect(content).not.toMatch(/Copy.*key/i);
  });

  it("should create the brand inline and land on it, with no billing/top-up step", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    // No card-capture / auto-topup step at onboarding — it tripped the $2 welcome
    // credit because the brand-new balance sits below the top-up threshold. Card +
    // auto-topup are set up later, on first campaign launch (billing-guard modal).
    expect(content).not.toContain('"billing-setup"');
    expect(content).not.toContain("createCheckoutSession");
    expect(content).not.toContain("billingSetup");
    // Brand is created inline here (the old /brands?autoCreate hop is gone) and we
    // hard-nav straight to the new brand detail page.
    expect(content).toContain("upsertBrand");
    expect(content).toContain("/orgs/${targetOrgId}/brands/${newBrandId}");
  });
});

describe("Beta onboarding wallet setup", () => {
  const pagePath = path.join(__dirname, "../src/components/onboarding/beta-onboarding.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("shows a dedicated wallet setup step after budget selection", () => {
    expect(content).toContain('| "wallet"');
    expect(content).toContain("Continue to wallet setup");
    expect(content).toContain("Set up your org wallet.");
    expect(content).toContain("Initial load amount");
    expect(content).toContain("Auto-topup trigger threshold");
    expect(content).toContain("Auto-topup reload amount");
  });

  it("states org-level wallet credits and brand-level daily budget", () => {
    expect(content).toContain("Credits live at the organization level");
    expect(content).toContain("brand daily budget");
    expect(content).toContain("daily spend cap");
  });

  it("states the first load match and required auto-topup pause copy", () => {
    expect(content).toContain("Your first load is matched dollar-for-dollar up to $25 free.");
    expect(content).toContain("Auto-topup is required for the campaign to continue running. You can pause the campaign at any time.");
  });

  it("uses paid top-up checkout and persists auto-topup before launching", () => {
    expect(content).toContain("createCheckoutSession");
    expect(content).toContain("topup_amount_cents: initialLoadCents");
    expect(content).toContain("configureAutoTopup(pending.topupAmountCents, pending.topupThresholdCents)");
    expect(content).toContain("saveBrandDailyBudget");
    expect(content).not.toContain('mode: "subscription"');
    expect(content).not.toContain('mode: "setup"');
  });
});

describe("Onboarding layout", () => {
  const layoutPath = path.join(__dirname, "../src/app/(authed)/onboarding/layout.tsx");

  it("should have an onboarding layout", () => {
    expect(fs.existsSync(layoutPath)).toBe(true);
  });

  it("should use QueryProvider", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("QueryProvider");
  });
});
