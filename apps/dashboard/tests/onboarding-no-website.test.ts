import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The beta "I have no website" onboarding path: a brand with no site the user
 * describes in a free-form block instead of a URL. It drops the click-destination
 * step and locks the goal to positive_replies. On the dashboard generally a brand
 * with no website (url == null) restricts its goal pickers the same way.
 *
 * Behavioural import isn't possible (Clerk/posthog/api pulls), so we assert the
 * load-bearing source, matching the repo's other onboarding guards.
 */
const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

describe("Onboarding — no-website path (beta)", () => {
  const src = read("src/components/onboarding/onboarding.tsx");

  it("bumps the state version to 8 and persists the no-website fields", () => {
    expect(src).toContain("ONBOARDING_STATE_VERSION = 8");
    expect(src).toContain("restored?.noWebsiteMode ??");
    expect(src).toContain("restored?.brandName ??");
    expect(src).toContain("restored?.brandContext ??");
  });

  it("accepts noWebsiteMode / brandName / brandContext in parseOnboardingState", () => {
    expect(src).toContain('typeof p.noWebsiteMode !== "boolean"');
    expect(src).toContain('typeof p.brandName !== "string"');
    expect(src).toContain('typeof p.brandContext !== "string"');
  });

  it("shows a GA 'I have no website' button (no beta gate, no badge)", () => {
    // GA: the button renders for everyone, ungated, with no MaturityBadge.
    expect(src).toContain("I have no website");
    expect(src).toContain("enterNoWebsiteMode");
    expect(src).not.toMatch(/isBeta &&[\s\S]{0,400}I have no website/);
    expect(src).not.toMatch(/I have no website[\s\S]{0,200}MaturityBadge level="beta"/);
  });

  it("swaps the URL input for a brand name + free-form context textarea", () => {
    expect(src).toContain('id="ob-brand-name"');
    expect(src).toContain('id="ob-brand-context"');
    expect(src).toContain("maxLength={300000}");
    expect(src).toContain("startAnalyzeNoWebsite");
  });

  it("creates the null-url brand + persists context BEFORE extraction", () => {
    expect(src).toContain("createBrandWithoutWebsite(name, context)");
    expect(src).toContain("createBrandNoWebsiteAndFetchServices");
  });

  it("asks for no click destination at all, for any brand", () => {
    // A funnel owns its landing page now, so the standalone click-destination step
    // is gone for EVERY brand — a no-website brand could never reach it anyway.
    expect(src).not.toContain('if (step === "destination") {');
    expect(src).toContain('setStep("audiences")');
  });

  it("hides the website-led funnels in no-website mode", () => {
    // A funnel that starts with a click onto the site cannot run without a site,
    // and brand-service 400s on declaring one — so it is never offered.
    expect(src).toContain("selectableFunnels(funnelViews, !noWebsiteMode)");
    expect(src).toContain("Paths that start with a click onto your website are hidden");
  });

  it("locks the optimization goal to positive_replies in no-website mode", () => {
    expect(src).toContain('if (noWebsiteMode && outcome !== "positive_replies") setOutcome("positive_replies")');
  });

  it("isolates the create+context API calls behind one helper conformed to the deployed contract", () => {
    const api = read("src/lib/api.ts");
    expect(api).toContain("export async function createBrandWithoutWebsite");
    // Conformed to brand-service #366: POST /brands { name } then
    // PUT /brands/:id/business-context { content } before extraction.
    expect(api).toContain("/business-context");
    expect(api).toContain("body: { content: context }");
  });
});

describe("Dashboard goal pickers — restrict to positive_replies when brand has no website", () => {
  it("brand-status-control coerces the DISPLAYED goal when brand.url == null", () => {
    const src = read("src/components/brand/brand-status-control.tsx");
    expect(src).toContain("brandData.brand.url == null");
    // The picker is gone — a no-website brand is restricted by the funnel catalogue
    // itself, since every website-led funnel refuses to be declared without a site.
    // What survives here is the DISPLAY coercion: a brand stored on a visit-driven
    // goal must still read "positive replies" rather than claim a path it cannot run.
    expect(src).toContain('noWebsite && storedGoal ? "positive_replies" : storedGoal');
    expect(src).not.toContain("GOAL_OPTIONS");
  });

  // The settings sales-economics card carried the same restriction until brand
  // Settings dropped its flat goal picker: a no-website brand is now restricted
  // by the funnel catalogue itself, since every website-led funnel refuses to be
  // declared for a brand with no domain.
  it("locks every website-led funnel on a brand with no domain", () => {
    const src = read("src/components/settings/brand-sales-funnels-card.tsx");
    expect(src).toContain("const noWebsite = !!brand && brand.url == null;");
    expect(src).toContain("def.requiresWebsite && noWebsite");
  });
});
