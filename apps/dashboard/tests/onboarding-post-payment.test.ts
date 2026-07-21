import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { POST_PAYMENT_OFFER_LEVERS } from "../src/components/onboarding/offer-levers";
import { COUNTRIES, DEFAULT_COUNTRY, codeToFlag, searchCountries } from "../src/components/onboarding/phone-countries";

/**
 * Post-payment onboarding steps: after a successful Stripe checkout return, and
 * BEFORE the launching loader, the flow collects an optional phone, confirms
 * lifetime revenue / paid client, then walks the offer levers one screen at a
 * time. Guards pin the load-bearing wiring (source-substring, matching the other
 * onboarding guards — the component pulls Clerk/posthog/api so it can't be
 * imported) plus real behaviour of the pure phone/offer modules.
 */

const onboardingSrc = fs.readFileSync(
  path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf-8",
);
const phoneRoutePath = path.join(__dirname, "../src/app/(authed)/api/onboarding/phone/route.ts");
const apiSrc = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

describe("post-payment step wiring in onboarding.tsx", () => {
  it("adds the phone / ltr / offer steps to the Step union", () => {
    expect(onboardingSrc).toContain('| "celebrate"');
    expect(onboardingSrc).toContain('| "phone"');
    expect(onboardingSrc).toContain('| "ltr"');
    expect(onboardingSrc).toContain('| "offer"');
    // launching stays (the loader still runs after the post-payment steps)
    expect(onboardingSrc).toContain('| "launching"');
  });

  it("routes the checkout SUCCESS first-paint to the celebrate step, not launching", () => {
    expect(onboardingSrc).toContain('searchParams.get("launch_checkout") === "success"\n        ? "celebrate"');
  });

  it("starts the launch in the BACKGROUND at checkout return (parallel with post-payment steps)", () => {
    const resume = onboardingSrc.slice(
      onboardingSrc.indexOf("async function resumeCheckoutLaunch"),
      onboardingSrc.indexOf("// ── Post-payment steps"),
    );
    expect(resume).toContain("pendingCheckoutRef.current = pending;");
    expect(resume).toContain('setStep("celebrate");');
    // The whole launch is fired in the background right away (aggressive parallel launch),
    // so the campaign is created even if the user quits before reaching the dashboard.
    expect(resume).toContain("startBackgroundLaunch()");
  });

  it("fires the launch work exactly once, guarded by backgroundLaunchRef", () => {
    expect(onboardingSrc).toContain("async function runLaunchWork(pending: PendingCheckoutLaunch)");
    expect(onboardingSrc).toContain("function startBackgroundLaunch()");
    expect(onboardingSrc).toContain("if (backgroundLaunchRef.current) return backgroundLaunchRef.current;");
    // onboarding-complete must be set by the background work so a quit-before-dashboard
    // still lands on a complete dashboard next visit.
    expect(onboardingSrc).toContain('await fetch("/api/onboarding/complete", { method: "POST" })');
  });

  it("finalizes at the last offer step by awaiting the background launch", () => {
    expect(onboardingSrc).toContain("function finalizePostPaymentAndLaunch");
    expect(onboardingSrc).toContain("await startBackgroundLaunch();");
    // launching loader still shown by the terminal commit
    expect(onboardingSrc).toContain('setStep("launching");');
    // cleanup + redirect happen only at the terminal (so a mid-flow refresh can resume)
    expect(onboardingSrc).toContain("window.sessionStorage.removeItem(CHECKOUT_PENDING_KEY);");
  });

  it("introduces the best model after LTR (same ladder + pick as the Strategy page)", () => {
    expect(onboardingSrc).toContain('| "model"');
    expect(onboardingSrc).toContain('if (step === "model")');
    expect(onboardingSrc).toContain("getWorkflowProjectionLadder");
    expect(onboardingSrc).toContain("pickBestBrandRow");
    expect(onboardingSrc).toContain("<BestModelStats");
    // LTR advances to the model step (not straight to offer)
    expect(onboardingSrc).toContain('setStep("model");');
  });

  it("saves lifetime revenue via sales-economics and the phone via savePhoneNumber", () => {
    expect(onboardingSrc).toContain("function saveLtrAndContinue");
    expect(onboardingSrc).toContain("lifetimeRevenueUsd: nextRates.ltv");
    expect(onboardingSrc).toContain("await savePhoneNumber(phone);");
  });

  it("walks the offer levers one screen at a time via an index", () => {
    expect(onboardingSrc).toContain("POST_PAYMENT_OFFER_LEVERS[offerIndex]");
    expect(onboardingSrc).toContain("function continueOffer");
  });
});

describe("phone server route", () => {
  it("exists", () => {
    expect(fs.existsSync(phoneRoutePath)).toBe(true);
  });
  const content = fs.existsSync(phoneRoutePath) ? fs.readFileSync(phoneRoutePath, "utf-8") : "";
  it("derives the user id server-side and writes Clerk publicMetadata", () => {
    expect(content).toContain("await auth()");
    expect(content).toContain("updateUserMetadata");
    expect(content).toContain("publicMetadata");
  });
  it("rejects unauthenticated callers and invalid payloads", () => {
    expect(content).toContain("401");
    expect(content).toContain("400");
  });
});

describe("savePhoneNumber client helper", () => {
  it("POSTs to the phone route and fails loud on non-2xx", () => {
    expect(apiSrc).toContain("export async function savePhoneNumber");
    expect(apiSrc).toContain('"/api/onboarding/phone"');
    expect(apiSrc).toContain("throw new Error(`Failed to save phone number");
  });
  it("adds perceivedLikelihood to SALES_PROFILE_FIELDS so the lever prefills", () => {
    expect(apiSrc).toContain('key: "perceivedLikelihood"');
  });
});

describe("offer levers module", () => {
  const keys = POST_PAYMENT_OFFER_LEVERS.map((l) => l.key);
  it("has the 6 value-equation levers, excluding services (already collected)", () => {
    expect(keys).toEqual([
      "dreamOutcome",
      "perceivedLikelihood",
      "socialProof",
      "riskReversal",
      "urgency",
      "scarcity",
    ]);
    expect(keys).not.toContain("services");
  });
  it("explains why each lever matters", () => {
    for (const l of POST_PAYMENT_OFFER_LEVERS) {
      expect(l.why.length).toBeGreaterThan(20);
      expect(l.title.length).toBeGreaterThan(0);
    }
  });
  it("ships no em-dash in user-facing copy", () => {
    for (const l of POST_PAYMENT_OFFER_LEVERS) {
      expect(l.title).not.toContain("—");
      expect(l.why).not.toContain("—");
      expect(l.placeholder).not.toContain("—");
    }
  });
});

describe("phone-countries module", () => {
  it("derives a flag emoji from the ISO code", () => {
    expect(codeToFlag("US")).toBe("\u{1F1FA}\u{1F1F8}");
    expect(codeToFlag("FR")).toBe("\u{1F1EB}\u{1F1F7}");
    expect(codeToFlag("xx!")).toBe("");
  });
  it("has a non-empty list defaulting to US +1", () => {
    expect(COUNTRIES.length).toBeGreaterThan(50);
    expect(DEFAULT_COUNTRY.code).toBe("US");
    expect(DEFAULT_COUNTRY.dial).toBe("1");
  });
  it("searches by name, code and dial", () => {
    expect(searchCountries("franc").some((c) => c.code === "FR")).toBe(true);
    expect(searchCountries("gb").some((c) => c.code === "GB")).toBe(true);
    expect(searchCountries("+49").some((c) => c.code === "DE")).toBe(true);
    expect(searchCountries("").length).toBe(COUNTRIES.length);
  });
});
