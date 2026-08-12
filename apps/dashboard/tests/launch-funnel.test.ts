import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fundedLaunchFunnelKey } from "../src/lib/launch-funnel";

const onboarding = readFileSync(
  join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf-8",
);

describe("fundedLaunchFunnelKey", () => {
  it("states the primary funnel when the customer funded it", () => {
    expect(
      fundedLaunchFunnelKey({ reply_meeting: 24, visit_signup: 5 }, "visit_signup"),
    ).toBe("website_purchases");
  });

  it("never leaves the funded set — a primary nobody funded loses to a funded funnel", () => {
    expect(
      fundedLaunchFunnelKey({ visit_form: 3 }, "reply_meeting"),
    ).toBe("form_magnet");
  });

  it("falls back to the first funded funnel in catalogue order, deterministically", () => {
    const budgets = { visit_form: 2, visit_meeting: 30, visit_signup: 4 };
    // Catalogue order is reply_meeting, visit_meeting, visit_signup, visit_form —
    // insertion order of the map must not decide it.
    expect(fundedLaunchFunnelKey(budgets, null)).toBe("sales_meetings_from_website");
    expect(fundedLaunchFunnelKey({ ...budgets }, null)).toBe("sales_meetings_from_website");
  });

  it("treats a zero or negative ceiling as unfunded", () => {
    expect(fundedLaunchFunnelKey({ reply_meeting: 0, visit_form: 1 }, "reply_meeting")).toBe(
      "form_magnet",
    );
    expect(fundedLaunchFunnelKey({ reply_meeting: 0 }, "reply_meeting")).toBeNull();
  });

  it("reads the canonical spelling too, and always emits it", () => {
    expect(
      fundedLaunchFunnelKey({ sales_meetings_from_conversation: 24 }, "sales_meetings_from_conversation"),
    ).toBe("sales_meetings_from_conversation");
  });

  it("returns null when nothing is funded, rather than inventing a funnel", () => {
    expect(fundedLaunchFunnelKey({}, "reply_meeting")).toBeNull();
    expect(fundedLaunchFunnelKey({}, null)).toBeNull();
  });

  describe("an unnamable key", () => {
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
    afterEach(() => vi.restoreAllMocks());

    it("reads as absent, never as a fifth funnel", () => {
      expect(fundedLaunchFunnelKey({ something_else: 10 }, null)).toBeNull();
      expect(fundedLaunchFunnelKey({ something_else: 10, visit_form: 1 }, "something_else")).toBe(
        "form_magnet",
      );
    });
  });
});

describe("the onboarding launch states the funnel it just funded", () => {
  it("passes a funded funnel to the campaign create", () => {
    expect(onboarding).toContain(
      "fundedLaunchFunnelKey(pending.funnelBudgets ?? {}, pending.primaryFunnelKey)",
    );
    expect(onboarding).toContain("funnelKey: launchFunnelKey,");
  });

  it("stops the launch rather than inventing a funnel when nothing was funded", () => {
    const at = onboarding.indexOf("const launchFunnelKey = fundedLaunchFunnelKey(");
    expect(at).toBeGreaterThan(-1);
    expect(onboarding.slice(at, at + 500)).toContain("if (!launchFunnelKey) {");
  });

  it("creates ONE campaign, never one per funded funnel", () => {
    expect(onboarding.match(/createCampaignWithoutBrandEnrichment\(/g)?.length).toBe(1);
  });
});
