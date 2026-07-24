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

  it("shows a beta-gated 'I have no website' button carrying a MaturityBadge", () => {
    // Gated on isBeta, with a visible beta badge (a gated element must have one).
    expect(src).toContain("I have no website");
    expect(src).toContain("enterNoWebsiteMode");
    expect(src).toMatch(/isBeta &&[\s\S]{0,400}I have no website[\s\S]{0,200}MaturityBadge level="beta"/);
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

  it("skips the click-destination step in no-website mode", () => {
    // services -> objective (not destination); objective back -> services.
    expect(src).toContain('setStep(noWebsiteMode ? "objective" : "destination")');
    expect(src).toContain('setStep(noWebsiteMode ? "services" : "destination")');
  });

  it("locks the onboarding goal picker to positive_replies in no-website mode", () => {
    expect(src).toContain('noWebsiteMode ? o.key === "positive_replies"');
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
  it("brand-status-control restricts GOAL_OPTIONS when brand.url == null", () => {
    const src = read("src/components/brand/brand-status-control.tsx");
    expect(src).toContain("brandData.brand.url == null");
    expect(src).toContain('GOAL_OPTIONS.filter((option) => option.value === "positive_replies")');
    // Still uses the base GOAL_OPTIONS.filter for the website case.
    expect(src).toContain("GOAL_OPTIONS.filter");
  });

  it("brand-sales-economics-card restricts OPTIMIZATION_GOALS when brand.url == null", () => {
    const src = read("src/components/settings/brand-sales-economics-card.tsx");
    expect(src).toContain("brandData.brand.url == null");
    expect(src).toContain('OPTIMIZATION_GOALS.filter((g) => g.value === "positive_replies")');
    // Fallback: display positive_replies for a brand stored on another goal.
    expect(src).toContain("effectiveGoal");
  });
});
