import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-substring guards for the THREE places the website rule is applied.
 *
 * A validator nothing calls is the feature entirely absent with the module
 * perfectly correct, which is exactly how this bug shipped: `extractDomain`
 * resolved an email address to a hostname and every gate downstream trusted it.
 * So these pin the CALL SITES, not the rule (real unit tests for the rule live
 * in `website-input.test.ts`).
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

const ONBOARDING = read("src/components/onboarding/onboarding.tsx");
const COOKIE = read("src/lib/landing-url-cookie.ts");

describe("the landing carry refuses to store a non-website", () => {
  it("normalizeLandingUrl runs the rule", () => {
    expect(COOKIE).toContain('import { websiteInputProblem } from "./website-input"');
    expect(COOKIE).toContain("if (websiteInputProblem(trimmed)) return null;");
  });

  it("no longer accepts anything whose hostname merely has a dot", () => {
    // The check that let `https://kevin@gmail.com/` through.
    expect(COOKIE).not.toContain('parsed.hostname.includes(".")');
  });
});

describe("the onboarding URL step refuses to advance on a non-website", () => {
  it("derives the problem from the rule, not from extractDomain alone", () => {
    expect(ONBOARDING).toContain("const websiteProblem = noWebsiteMode ? null : websiteInputProblem(url);");
  });

  it("declares it ABOVE the JSX that reads it", () => {
    // A const consumed by an earlier-declared reader is a TDZ throw at render
    // that tsc cannot see, so the ordering is the assertion.
    const declared = ONBOARDING.indexOf("const websiteProblem =");
    const consumed = ONBOARDING.indexOf("disabled={!domain || websiteProblem !== null}");
    expect(declared).toBeGreaterThan(-1);
    expect(consumed).toBeGreaterThan(declared);
  });

  it("gates the button and the Enter key on it", () => {
    expect(ONBOARDING).toContain("disabled={!domain || websiteProblem !== null}");
    expect(ONBOARDING).toContain('e.key === "Enter" && domain && !websiteProblem');
  });

  it("states the reason and offers the no-website path in the same message", () => {
    const at = ONBOARDING.indexOf("{websiteRefusal ? (");
    expect(at).toBeGreaterThan(-1);
    const block = ONBOARDING.slice(at, ONBOARDING.indexOf("I have no website", at));
    expect(block).toContain("{websiteRefusal}");
    expect(block).toContain("No website? Tell us about your business instead.");
    expect(block).toContain("onClick={enterNoWebsiteMode}");
  });

  it("shows ONE way out at a time, never the refusal stacked on the standing button", () => {
    // Rendered side by side they read as the same control twice; the refusal
    // carries its own link, so the standing button steps aside while it shows.
    const at = ONBOARDING.indexOf("{websiteRefusal ? (");
    const block = ONBOARDING.slice(at, ONBOARDING.indexOf("</StepShell>", at));
    expect(block).toContain(") : (");
    expect(block.indexOf("I have no website")).toBeGreaterThan(block.indexOf(") : ("));
  });

  it("derives the refusal ONCE, so the message and the button cannot disagree", () => {
    expect(ONBOARDING).toContain("const websiteRefusal =");
    const declared = ONBOARDING.indexOf("const websiteRefusal =");
    expect(ONBOARDING.indexOf("{websiteRefusal ? (")).toBeGreaterThan(declared);
  });

  it("the no-website path keeps its own fields, so the rule stands down there", () => {
    expect(ONBOARDING).toContain("noWebsiteMode ? null : websiteInputProblem(url)");
  });
});
