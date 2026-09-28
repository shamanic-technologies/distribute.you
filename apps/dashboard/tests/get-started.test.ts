import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  STEPS_NOT_LIVE,
  compactCount,
  hostOf,
  parseCompetitors,
  parseDailyBudget,
  parseGetStartedSnapshot,
  valueLines,
} from "../src/lib/v2/get-started";

/**
 * Onboarding v2 (`/get-started`). `lib/v2/get-started.ts` is alias-free, so the
 * first half is real unit tests; the second half pins the surface.
 */

describe("the rules the page decides on", () => {
  it("reads competitors with their domains, dropping duplicates and the brand itself", () => {
    const got = parseCompetitors(
      ["Calendly (calendly.com)", "SavvyCal (https://www.savvycal.com)", "calendly.com", "TidyCal (tidycal.com)", "Doodle"],
      "tidycal.com",
    );
    expect(got).toEqual([
      { name: "Calendly", domain: "calendly.com" },
      { name: "SavvyCal", domain: "savvycal.com" },
      { name: "Doodle", domain: null },
    ]);
  });

  it("reads a competitor list however the model shaped it", () => {
    expect(parseCompetitors("- Acme (acme.io)\n- Beta (beta.com)", null).map((c) => c.domain)).toEqual(["acme.io", "beta.com"]);
    expect(parseCompetitors([{ name: "Gamma", domain: "gamma.app" }], null)).toEqual([{ name: "Gamma", domain: "gamma.app" }]);
  });

  it("drops the model's Unknown rather than printing it", () => {
    expect(valueLines("Unknown")).toEqual([]);
  });

  it("prints a segment size the way Explee does", () => {
    expect(compactCount(840)).toBe("840");
    expect(compactCount(12_400)).toBe("12.4K");
    expect(compactCount(3_100_000)).toBe("3.1M");
  });

  it("takes the host of whatever was typed", () => {
    expect(hostOf("https://www.Acme.com/pricing")).toBe("acme.com");
    expect(hostOf("acme.com")).toBe("acme.com");
    expect(hostOf("")).toBeNull();
  });

  it("refuses a budget under the channel floor or not in whole dollars", () => {
    expect(parseDailyBudget("", 1)).toEqual({ problem: "Enter a daily budget." });
    expect(parseDailyBudget("2.5", 1)).toEqual({ problem: "Enter a whole number of dollars a day." });
    expect(parseDailyBudget("3", 5)).toEqual({ problem: "Cold email runs from $5 a day." });
    expect(parseDailyBudget("$12", 1)).toEqual({ usd: 12 });
  });

  it("restores a snapshot, and starts over on anything malformed", () => {
    const snap = {
      version: 1,
      website: "https://acme.com",
      brandId: "b1",
      brandName: "Acme",
      domain: "acme.com",
      overview: "Acme sells anvils.",
      facts: ["Sells anvils"],
      competitors: [{ name: "Beta", domain: "beta.com" }],
      segments: [{ audienceId: "a1", name: "Coyotes", rationale: "They buy anvils", count: 1200 }],
      budgetUsd: 10,
    };
    expect(parseGetStartedSnapshot(JSON.stringify(snap))).toEqual(snap);
    expect(parseGetStartedSnapshot("{nope")).toBeNull();
    expect(parseGetStartedSnapshot(JSON.stringify({ ...snap, version: 2 }))).toBeNull();
    expect(parseGetStartedSnapshot(JSON.stringify({ ...snap, budgetUsd: 2.5 }))?.budgetUsd).toBeNull();
  });

  it("has every step live now that both producers reached the gateway", () => {
    expect([...STEPS_NOT_LIVE]).toEqual([]);
  });
});

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const FLOW = read("src/components/v2/get-started/get-started.tsx");
const WALL = read("src/components/v2/get-started/account-card-wall.tsx");
const LAUNCH = read("src/components/v2/get-started/launch.ts");

describe("the surface", () => {
  it("is public, exactly, so a signed-out founder reaches it", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain('"/get-started",');
    expect(proxy).not.toContain('"/get-started(.*)"');
  });

  it("runs every signed-out read on the anonymous session", () => {
    expect(FLOW).toContain("startAnonSession(");
    // The claim re-points the anonymous org at the account, as /onboarding/claim does.
    expect(WALL).toContain('fetch("/api/anon/claim"');
  });

  it("says a step is not live rather than showing invented rows", () => {
    expect(FLOW).toContain("This step is not live yet.");
    expect(FLOW).toContain("Not live yet");
  });

  it("reads the real sample and the real email, never an email address", () => {
    expect(FLOW).toContain("getAudiencePreview(");
    expect(FLOW).toContain("previewColdEmail(");
    expect(FLOW).not.toMatch(/revealEmail|enrich|emailAddress/);
  });

  it("asks a timed-out email again, but never retries a refusal", () => {
    const body = FLOW.slice(FLOW.indexOf("async function writeWithRetry"), FLOW.indexOf("function sampleNote("));
    expect(body).toContain("e.status >= 400 && e.status < 500");
  });

  it("asks the account and the card on one screen", () => {
    expect(WALL).toContain("createEmbeddedCardSetup(");
    expect(WALL).toContain("signUp.create(");
    expect(WALL).toContain('id="clerk-captcha"');
  });

  it("speaks the v2 language, not v1's", () => {
    for (const src of [FLOW, WALL]) {
      expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|InfoTooltip/);
    }
  });

  it("carries no em-dash in its copy", () => {
    for (const src of [FLOW, WALL, LAUNCH]) {
      // The one dash allowed is Keel's missing-value marker, a `"\u2014"` literal.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/"\u2014"/g, "");
      expect(code).not.toContain("—");
    }
  });

  it("moves: steps rise in, lists cascade, counts count, the email types", () => {
    expect(FLOW).toContain("<Stepper");
    expect(FLOW).toContain("<LiveStatus");
    expect(FLOW).toContain("<CountUp value={s.count}");
    expect(FLOW).toContain("<Typewriter text={mail.bodyText}");
    expect(FLOW).toContain("<GrowBar");
    expect(FLOW).toMatch(/gs-pop[^"]*"[^>]*style=\{stagger\(i, 60\)\}/);
    expect(FLOW).toContain("gs-down sticky");
    expect(WALL).toContain("gs-panel k-popover");
    expect(WALL).toContain("gs-scrim");
  });

  it("shows the end state at once under reduced motion", () => {
    const css = read("src/components/v2/keel.css");
    const block = css.slice(css.indexOf("/get-started motion"));
    expect(block).toContain("prefers-reduced-motion: reduce");
    // A block pasted inside another comment silently disappears: every opener closes.
    expect(css.split("/*").length).toBe(css.split("*/").length);
    for (const cls of ["gs-in", "gs-pop", "gs-down", "gs-scrim", "gs-panel", "gs-glow"]) expect(block).toContain(`.v2-root .${cls}`);
    const motion = read("src/components/v2/get-started/motion.tsx");
    expect(motion).toContain("(prefers-reduced-motion: reduce)");
    // The typed email is readable in full from the first frame.
    expect(motion).toContain("aria-label={text}");
  });

  it("prices the wall's budget the way the Add-a-brand modal does, once the brand has an offer", () => {
    expect(LAUNCH).toContain("export async function recommendedBudgetForPreview(");
    expect(LAUNCH).toContain("recommendedDailyBudgetUsd(newOrgLeg(GET_STARTED_LEG)");
    // One offer resolution per brand: the price read and the launch share it.
    expect(LAUNCH).toContain("resolveOfferOnce(input.brandId");
    expect(WALL).toContain("recommendedBudgetForPreview(brandId, offerSource, floorUsd)");
    // A default never blocks a price that lands later.
    expect(WALL).toContain("if (budgetTouched.current) onBudget(");
  });

  it("carries Explee's countdown and spots strips on the wall (owner-decided, copied for now)", () => {
    expect(WALL).toContain("<TrialTimer />");
    expect(WALL).toContain("<TrialSpots />");
  });

  it("counts Explee's clock down 7:30, then a 9:59 extension, then stops", async () => {
    const { timerPhase, spotsTakenThisHour } = await import("../src/components/v2/get-started/urgency");
    expect(timerPhase(0, 0)).toEqual({ phase: "initial", secondsLeft: 450 });
    expect(timerPhase(0, 450_000)).toEqual({ phase: "extended", secondsLeft: 599 });
    expect(timerPhase(0, 1_049_000)).toEqual({ phase: "expired", secondsLeft: 0 });
    const hour = 3_600_000 * 500_000;
    expect(spotsTakenThisHour(hour + 59 * 60_000)).toBeGreaterThanOrEqual(spotsTakenThisHour(hour));
  });

  it("leaves the current onboarding alone", () => {
    const onboarding = read("src/components/onboarding/onboarding.tsx");
    expect(onboarding).not.toContain("get-started");
  });
});
