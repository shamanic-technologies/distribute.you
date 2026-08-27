import { describe, expect, it } from "vitest";
import { campaignFunnel } from "../src/lib/campaign-funnel";
import { SALES_FUNNELS, normalizeSalesFunnelKey } from "../src/lib/sales-funnels";
import { CANONICAL_GOALS, optimizationGoalForRuntimeGoal } from "../src/lib/api";

/**
 * A brand with ONE declared funnel (Form Magnet) read as two campaigns on the
 * Campaigns table, the second naming "Sales Meeting from Conversation" — a funnel
 * it had never picked. Two separate causes, both pinned here.
 *
 * 1. The campaign goal was read through a three-token union that ended in a bare
 *    `return "sales_meetings"`, so `formSubmission` (what campaign-service sends
 *    for a Form Magnet funnel) fell through the default.
 * 2. campaign-service keeps the pre-funnel campaign alive as a fallback pot, and
 *    it stays `ongoing`, so nothing on the row said it was not a second live
 *    campaign.
 */
describe("campaign goal vocabulary", () => {
  // The campaign goal and the brand goal are the SAME vocabulary — campaign-service
  // forwards the funnel's goal verbatim from brand-service. One mapping, so there
  // is only one place to go stale.
  it("reads every canonical goal a campaign can carry", () => {
    expect(optimizationGoalForRuntimeGoal("formSubmission")).toBe("form_submissions");
    expect(optimizationGoalForRuntimeGoal("signup")).toBe("signups");
    expect(optimizationGoalForRuntimeGoal("meetingBooked")).toBe("sales_meetings");
    expect(optimizationGoalForRuntimeGoal("positiveReply")).toBe("positive_replies");
    expect(optimizationGoalForRuntimeGoal("websiteVisit")).toBe("website_visits");
    expect(optimizationGoalForRuntimeGoal("websitePurchase")).toBe("website_purchase");
    expect(optimizationGoalForRuntimeGoal("combinedSales")).toBe("sales");
    // The pre-rename spelling, still stored on older rows.
    expect(optimizationGoalForRuntimeGoal("purchase")).toBe("website_purchase");
  });

  // Every canonical goal but the one this app has no local member for.
  it("covers the canonical set, and fails loud on the one it cannot name", () => {
    for (const goal of CANONICAL_GOALS) {
      if (goal === "whatsappConversation") {
        expect(() => optimizationGoalForRuntimeGoal(goal)).toThrow();
        continue;
      }
      expect(() => optimizationGoalForRuntimeGoal(goal)).not.toThrow();
    }
  });
});

describe("sales funnel key vocabulary", () => {
  // The four keys stored today, and the four brand-service is renaming to. Read
  // ahead of the producer so its switch is additive, exactly as the goal
  // vocabulary was learned ahead of it.
  it("reads both spellings of all four funnels", () => {
    expect(normalizeSalesFunnelKey("visit_form")).toBe("visit_form");
    expect(normalizeSalesFunnelKey("form_magnet")).toBe("visit_form");
    expect(normalizeSalesFunnelKey("reply_meeting")).toBe("reply_meeting");
    expect(normalizeSalesFunnelKey("sales_meetings_from_conversation")).toBe("reply_meeting");
    expect(normalizeSalesFunnelKey("visit_meeting")).toBe("visit_meeting");
    expect(normalizeSalesFunnelKey("sales_meetings_from_website")).toBe("visit_meeting");
    expect(normalizeSalesFunnelKey("visit_signup")).toBe("visit_signup");
    expect(normalizeSalesFunnelKey("website_purchases")).toBe("visit_signup");
  });

  it("names a funnel for every key the catalogue carries", () => {
    for (const def of SALES_FUNNELS) {
      expect(campaignFunnel(def.key)?.name).toBe(def.name);
    }
  });

  // A funnel the catalogue does not carry is a vocabulary drift we want to see,
  // not a plausible funnel the brand never declared.
  it("throws on a key it cannot name", () => {
    expect(() => campaignFunnel("visit_whatsapp" as never)).toThrow();
  });

  // A pre-funnel campaign names no funnel of its own; the caller falls back to
  // what the brand declares rather than this module guessing one.
  it("returns null for a campaign with no funnel key", () => {
    expect(campaignFunnel(null)).toBeNull();
  });
});

describe("no goal fallback", () => {
  // The goal is the retired, lossier vocabulary: `meetingBooked` is the goal of
  // two different funnels, so steps derived from it are ones the campaign never
  // stated. campaign-service persists the funnel on every campaign, so this
  // module resolves that key and offers nothing else.
  it("exports no goal-to-funnel resolver", async () => {
    const mod = await import("../src/lib/campaign-funnel");
    expect(Object.keys(mod)).toEqual(["campaignFunnel"]);
  });
});
