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

  it("keeps booking actions visible in the mobile viewport", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("max-h-[calc(100dvh-2rem)]");
    expect(content).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(content).toContain("shrink-0 border-t border-gray-100");
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
    // No card-capture / auto-topup step at onboarding — it tripped the $5 welcome
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

  it("uses setup checkout then wallet setup so the first-load match is applied", () => {
    expect(content).toContain("createCheckoutSession");
    expect(content).toContain('mode: "setup"');
    expect(content).toContain("setupBillingWallet");
    expect(content).toContain("initial_load_amount_cents: pending.initialLoadCents");
    expect(content).toContain("topup_amount_cents: pending.topupAmountCents");
    expect(content).toContain("topup_threshold_cents: pending.topupThresholdCents");
    expect(content).toContain("saveBrandDailyBudget");
    expect(content).toContain("featureInputs,");
    expect(content).toContain("createCampaignWithoutBrandEnrichment");
    expect(content).not.toContain('mode: "subscription"');
    expect(content).not.toContain("configureAutoTopup(pending.topupAmountCents, pending.topupThresholdCents)");
  });

  it("opens Stripe checkout without waiting for launch setup work", () => {
    const beginStart = content.indexOf("async function beginWalletCheckout()");
    const beginEnd = content.indexOf("async function resumeWalletCheckout()");
    expect(beginStart).toBeGreaterThan(-1);
    expect(beginEnd).toBeGreaterThan(beginStart);
    const beginWalletCheckout = content.slice(beginStart, beginEnd);
    expect(beginWalletCheckout).toContain("createCheckoutSession");
    expect(beginWalletCheckout).not.toContain("waitForOnboardingHydration");
    expect(beginWalletCheckout).not.toContain("saveBrandProfileVersion");
    expect(beginWalletCheckout).not.toContain("saveBrandDailyBudget");
    expect(beginWalletCheckout).not.toContain("buildFeatureInputsForLaunch");
  });

  it("blocks the initial analysis only on service extraction", () => {
    expect(content).toContain("SERVICES_PROFILE_FIELDS");
    expect(content).toContain("createBrandAndFetchServices");
    expect(content).toContain("const hydration = hydrateOnboardingInBackground(newBrandId)");
    expect(content).toContain("hydrationPromiseRef.current = hydration");
    expect(content).toContain("Adding your brand");
    expect(content).toContain("Extracting your services");
  });

  it("shows a real launch progress screen after Stripe success", () => {
    expect(content).toContain('| "launching"');
    expect(content).toContain("LAUNCH_STEPS");
    expect(content).toContain("Confirming wallet payment");
    expect(content).toContain("Applying wallet match");
    expect(content).toContain("Launching campaign");
    expect(content).toContain("Opening your dashboard");
    expect(content).toContain('setStep("launching")');
  });

  it("can retry checkout from the pending wallet launch after Stripe cancel", () => {
    expect(content).toContain("readPendingWalletLaunchOrNull");
    expect(content).toContain("const storedPending = readPendingWalletLaunchOrNull()");
    expect(content).toContain("storedPending?.workflowSlug");
    expect(content).toContain("storedPending?.brandUrl");
    expect(content).toContain("setBusy(false);");
    expect(content).toContain('throw new Error("Wallet setup state is missing. Go back to pricing and try again.")');
  });
});

describe("Onboarding layout", () => {
  const layoutPath = path.join(__dirname, "../src/app/(authed)/onboarding/layout.tsx");
  const creditGatePath = path.join(__dirname, "../src/components/onboarding/onboarding-credit-gate.tsx");

  it("should have an onboarding layout", () => {
    expect(fs.existsSync(layoutPath)).toBe(true);
  });

  it("should use QueryProvider", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("QueryProvider");
  });

  it("should initialize welcome credits before rendering onboarding", () => {
    const layout = fs.readFileSync(layoutPath, "utf-8");
    const gate = fs.readFileSync(creditGatePath, "utf-8");
    expect(layout).toContain("OnboardingCreditGate");
    expect(gate).toContain("getBillingAccount");
    expect(gate).toContain("Unable to initialize signup credits");
  });
});
