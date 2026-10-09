import { describe, expect, it } from "vitest";
import {
  LEVER_QUESTIONS,
  NEW_ORG_LEGS,
  newOrgLeg,
  recommendedDailyBudgetUsd,
  suggestOrgName,
} from "../src/lib/v2/new-org-wizard";

describe("suggestOrgName", () => {
  it("prefills the person's own name", () => {
    expect(suggestOrgName("Kevin Lourd", [])).toBe("Kevin Lourd");
  });
  it("numbers it when an org already carries the name, case and space insensitive", () => {
    expect(suggestOrgName("Kevin Lourd", ["kevin lourd "])).toBe("Kevin Lourd (2)");
    expect(suggestOrgName("Kevin Lourd", ["Kevin Lourd", "Kevin Lourd (2)"])).toBe("Kevin Lourd (3)");
  });
  it("falls back to a neutral name when the person has none", () => {
    expect(suggestOrgName("  ", [])).toBe("My organization");
  });
});

describe("recommendedDailyBudgetUsd", () => {
  const visits = newOrgLeg("lead_found_to_website_visit");
  const replies = newOrgLeg("lead_found_to_conversation");
  it("buys 10 website visits a day, rounded up to a whole dollar", () => {
    expect(recommendedDailyBudgetUsd(visits, 2.54, 1)).toBe(26);
  });
  it("buys 1 positive reply a day", () => {
    expect(recommendedDailyBudgetUsd(replies, 61.73, 1)).toBe(62);
  });
  it("never goes below the channel floor", () => {
    expect(recommendedDailyBudgetUsd(visits, 0.05, 8)).toBe(8);
  });
  it("recommends nothing without a price", () => {
    expect(recommendedDailyBudgetUsd(visits, null, 1)).toBeNull();
    expect(recommendedDailyBudgetUsd(visits, 0, 1)).toBeNull();
  });
});

describe("vocabularies", () => {
  it("offers exactly the two legs asked for", () => {
    expect(NEW_ORG_LEGS.map((l) => l.key)).toEqual(["lead_found_to_website_visit", "lead_found_to_conversation"]);
  });
  it("asks the six offer levers the brand-service user-fields store", () => {
    // The six non-services keys of USER_FIELD_KEYS in lib/api.ts (brand-service user-fields).
    const levers = ["dreamOutcome", "perceivedLikelihood", "socialProof", "riskReversal", "urgency", "scarcity"];
    expect(LEVER_QUESTIONS.map((q) => q.key).sort()).toEqual([...levers].sort());
  });
});
