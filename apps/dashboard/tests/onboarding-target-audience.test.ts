import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The onboarding audience step is ONE box: who the customer sells to, in their
 * own words, saved on the brand as the `targetAudience` user-field. Nothing is
 * searched, suggested, picked or activated during onboarding any more; the
 * audiences are built by hand after payment, from that text.
 *
 * Owner-decided 2026-09-19: "On veut juste l'input de leur target audience,
 * mais pas lancer la recherche. Je ferai ca a la main une fois que la personne
 * a payee." The same pass removed the wizard's "How do you sell?" step and the
 * primary-funnel pick, which re-asked what the sell-first Path screen answers.
 *
 * Source-substring guards: `onboarding.tsx` imports through the `@` alias, which
 * vitest does not resolve here. The call site is pinned as well as the
 * component: a saver nothing calls is the feature entirely absent.
 */
const flow = readFileSync(join(__dirname, "../src/components/onboarding/onboarding.tsx"), "utf8");
const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");
const banner = readFileSync(join(__dirname, "../src/components/onboarding/no-audience-banner.tsx"), "utf8");
const reminders = readFileSync(join(__dirname, "../src/components/onboarding/onboarding-reminders.tsx"), "utf8");

const step = flow.slice(flow.indexOf("function OnboardingAudiences("), flow.indexOf("function BrandStepHeader("));
const saver = flow.slice(flow.indexOf("async function saveTargetAudienceAndContinue()"), flow.indexOf("async function saveFunnelsAndContinue()"));

describe("the audience step is one box", () => {
  it("asks who the customer sells to and searches nothing", () => {
    expect(step).toContain("Who do you sell to?");
    expect(step).toContain("<textarea");
    for (const gone of ["suggestAudiences", "runSuggest", "candidates", "Find my perfect audiences", "AudienceCandidateCard", "selectedAudienceIds"]) {
      expect(step, `search surface still present: ${gone}`).not.toContain(gone);
    }
  });

  it("prefills the box from brand-service's ICP draft, and says NOTHING when it could not", () => {
    expect(step).toContain("suggestBrandIcp(brandId)");
    expect(step).toContain("prefetch.promise");
    expect(step).toContain("Drafting your ideal customer profile");
    // A failed prefill is ours to know about, not the customer's (owner-decided 2026-09-25).
    expect(step).not.toContain("Tell us in your own words.");
  });

  it("cannot continue on an empty box", () => {
    expect(step).toContain("disabled={icpLoading || busy || !prompt.trim()}");
  });
});

describe("what it writes", () => {
  it("saves the text on the brand as the targetAudience user-field, then continues", () => {
    expect(saver).toContain("await saveBrandTargetAudience(id, text);");
    expect(saver).toContain('setStep("consent");');
    // Fail loud, no silent advance: a blank brief is a blank brief for the person
    // building the audiences.
    expect(saver).toContain('setError("Tell us who you sell to first.");');
    expect(saver).toContain("We could not save that. Try again.");
    expect(saver).not.toContain("err.message");
  });

  it("the call site hands the saver to the step", () => {
    expect(flow).toContain("onContinue={() => void saveTargetAudienceAndContinue()}");
  });

  it("the api writes the ONE key through the existing user-fields PUT", () => {
    const fn = api.slice(api.indexOf("export async function saveBrandTargetAudience("), api.indexOf("export async function saveBrandUserFields("));
    expect(fn).toContain("body: { fields: { targetAudience } }");
    expect(fn).toContain('method: "PUT"');
    // The key is already one the brand profile extracts, so nothing new is named.
    expect(api).toContain('{ key: "targetAudience", description: "Target audience description" }');
  });
});

describe("nothing creates or activates an audience during onboarding", () => {
  it("imports neither the suggest nor the status write", () => {
    expect(flow).not.toContain("suggestAudiences");
    expect(flow).not.toContain("setAudienceStatus");
    expect(flow).not.toContain("listAudiences");
    expect(flow).not.toContain("Pick at least one audience");
  });

  it("the prewarm drafts the ICP only", () => {
    const prewarm = flow.slice(flow.indexOf("const audiencePrewarm = (async ()"), flow.indexOf("setAudiencePrefetch({ promise: audiencePrewarm })"));
    expect(prewarm).toContain("suggestBrandIcp(id)");
    expect(prewarm).not.toContain("suggestAudiences");
  });

  it("the built summary states the text as prose, not an audience list", () => {
    expect(flow).toContain("targetAudience: audiencePrompt,");
    expect(flow).not.toContain("audiences: (audienceCandidates");
  });
});

describe("the dashboard does not ask the customer to add what we are building", () => {
  it("the no-audience banner carries no CTA and reads as status, not alarm", () => {
    expect(banner).toContain("{copy.cta && (");
    expect(banner).toContain('const building = nudge.tier === "zero-active";');
    expect(banner).toContain('role={building ? "status" : "alert"}');
  });

  it("the reminder modal has no zero-active copy to show", () => {
    expect(reminders).not.toContain("REMINDER_COPY.audience;");
    expect(reminders).toContain("audience reminder has no copy for tier");
  });
});
