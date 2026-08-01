import { describe, expect, it } from "vitest";
import {
  CANONICAL_GOALS,
  normalizeBrandOptimizationGoal,
  type CanonicalGoal,
} from "../src/lib/api";

/**
 * The fleet keeps THREE lists of the same sales goals — brand-service's own
 * `CurrentGoal` (camelCase) beside its self-described "legacy" snake set,
 * features-service's `Goal` (camelCase), and this app's `BrandOptimizationGoal`
 * (snake) — each with translation layers for the other two.
 *
 * They already disagree, and not only about spelling: the bare token `sales`
 * means WEBSITE PURCHASE to brand-service and COMBINED sales here. That put every
 * website-purchase brand into the combined-sales bucket of the cross-org fleet
 * benchmark, which is the number the Audiences and Strategy pages floor their
 * cost-per-outcome on. See distribute.you#3214.
 *
 * These tests pin the target vocabulary and the reading of BOTH spellings, so the
 * producer can switch its emission without this app failing to parse.
 */
describe("canonical goal vocabulary", () => {
  it("pins the eight tokens the fleet is converging on", () => {
    // A drift alarm, not a style check. Changing this list means changing what
    // brand-service, features-service and this app each call the same goal, so it
    // is a fleet decision — it should never move in a single-repo PR.
    expect([...CANONICAL_GOALS]).toEqual([
      "signup",
      "meetingBooked",
      "websitePurchase",
      "combinedSales",
      "websiteVisit",
      "positiveReply",
      "formSubmission",
      "whatsappConversation",
    ]);
  });

  it("has no duplicate token", () => {
    expect(new Set(CANONICAL_GOALS).size).toBe(CANONICAL_GOALS.length);
  });
});

describe("normalizeBrandOptimizationGoal — the spellings brand-service emits TODAY", () => {
  // Locking current behaviour: this half must not move while the migration runs.
  const today: Array<[string, string]> = [
    ["signups", "signups"],
    ["booked_meetings", "sales_meetings"],
    ["sales_meetings", "sales_meetings"],
    ["website_visits", "website_visits"],
    ["positive_replies", "positive_replies"],
    ["form_submissions", "form_submissions"],
    ["combined_sales", "sales"],
    ["website_purchase", "website_purchase"],
  ];

  it.each(today)("reads %s as %s", (wire, local) => {
    expect(normalizeBrandOptimizationGoal(wire as never)).toBe(local);
  });

  it("reads the legacy `sales` as WEBSITE PURCHASE, never as the combined goal", () => {
    // brand-service stores the old purchase goal as `sales` and its internal read
    // emits `sales` for every purchase brand. Its own source says that spelling
    // "ALWAYS means website-purchase, and can NEVER be re-purposed for the new
    // combined goal". Reading it as combined is exactly the #3214 bug.
    expect(normalizeBrandOptimizationGoal("sales")).toBe("website_purchase");
  });

  it("reads the runtime `purchase` as website purchase", () => {
    expect(normalizeBrandOptimizationGoal("purchase")).toBe("website_purchase");
  });
});

describe("normalizeBrandOptimizationGoal — the canonical spellings, ahead of the producer", () => {
  // Nothing sends these yet. Reading them now is what makes brand-service's
  // switch a non-breaking change instead of a coordinated deploy.
  const canonical: Array<[CanonicalGoal, string]> = [
    ["signup", "signups"],
    ["meetingBooked", "sales_meetings"],
    ["websitePurchase", "website_purchase"],
    ["combinedSales", "sales"],
    ["websiteVisit", "website_visits"],
    ["positiveReply", "positive_replies"],
    ["formSubmission", "form_submissions"],
  ];

  it.each(canonical)("reads %s as %s", (wire, local) => {
    expect(normalizeBrandOptimizationGoal(wire)).toBe(local);
  });

  it("maps every canonical token except whatsappConversation", () => {
    // whatsappConversation has no local goal here, and inventing one would mean
    // adding a member to a type several exhaustive Records key on. It must fail
    // loud instead — a whatsapp brand silently reading as a sales meeting is the
    // class of bug this whole file exists to stop.
    const mapped = CANONICAL_GOALS.filter((g) => g !== "whatsappConversation");
    expect(mapped).toHaveLength(7);
    for (const goal of mapped) {
      expect(() => normalizeBrandOptimizationGoal(goal)).not.toThrow();
    }
    expect(() => normalizeBrandOptimizationGoal("whatsappConversation" as never)).toThrow(
      /Unmapped brand optimization goal/,
    );
  });
});

describe("normalizeBrandOptimizationGoal — an unmapped spelling fails loud", () => {
  it("throws rather than defaulting to sales meetings", () => {
    // The old implementation ended in a bare `return "sales_meetings"`, so any
    // spelling it did not recognise silently became a sales meeting. That would
    // have turned the producer's rename into a fleet-wide wrong goal with no
    // error anywhere.
    expect(() => normalizeBrandOptimizationGoal("something_new" as never)).toThrow(
      /Unmapped brand optimization goal/,
    );
  });
});

describe("the two meanings of `sales` stay apart", () => {
  it("brand-service's `sales` and this app's local `sales` are NOT the same goal", () => {
    // This app's LOCAL vocabulary uses `sales` for the combined goal, and sends it
    // as the features-service goal param. brand-service's WIRE `sales` means
    // website purchase. Same token, opposite meanings, two different entry points
    // — which is why normalization is keyed to where the value came from.
    expect(normalizeBrandOptimizationGoal("sales")).toBe("website_purchase");
    expect(normalizeBrandOptimizationGoal("combined_sales")).toBe("sales");
    expect(normalizeBrandOptimizationGoal("combinedSales")).toBe("sales");
  });
});
