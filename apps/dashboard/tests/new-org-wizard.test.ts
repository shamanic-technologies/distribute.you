import { describe, expect, it } from "vitest";
import {
  LEVER_QUESTIONS,
  NEW_ORG_LEGS,
  canSkipPayment,
  newOrgLeg,
  nextStep,
  parseCustomAmountCents,
  previousStep,
  recommendedDailyBudgetUsd,
  suggestNoWebsiteBrandName,
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

describe("suggestNoWebsiteBrandName", () => {
  it("is the person's name, possessive", () => {
    expect(suggestNoWebsiteBrandName("Kevin Lourd")).toBe("Kevin Lourd's brand");
    expect(suggestNoWebsiteBrandName(null)).toBe("My brand");
  });
});

describe("recommendedDailyBudgetUsd", () => {
  const visits = newOrgLeg("start_to_website_visit");
  const replies = newOrgLeg("start_to_conversation");
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

describe("parseCustomAmountCents", () => {
  it("a blank field is no answer, never zero", () => {
    expect(parseCustomAmountCents("")).toBeNull();
    expect(parseCustomAmountCents("  ")).toBeNull();
  });
  it("reads dollars, with or without a sign", () => {
    expect(parseCustomAmountCents("$75")).toEqual({ cents: 7500 });
    expect(parseCustomAmountCents("12.5")).toEqual({ cents: 1250 });
  });
  it("refuses under $1 and non-numbers", () => {
    expect(parseCustomAmountCents("0.5")).toEqual({ problem: "The minimum is $1." });
    expect(parseCustomAmountCents("abc")).toEqual({ problem: "Enter an amount in dollars." });
  });
});

describe("canSkipPayment", () => {
  it("only with spendable free credit", () => {
    expect(canSkipPayment(3000)).toBe(true);
    expect(canSkipPayment(0)).toBe(false);
    expect(canSkipPayment(null)).toBe(false);
  });
});

describe("step order", () => {
  it("skips the offer pick when one offer was detected, both ways", () => {
    expect(nextStep("offerText", { offerCount: 1 })).toBe("audienceText");
    expect(previousStep("audienceText", { offerCount: 1 })).toBe("offerText");
  });
  it("shows the offer pick when several were detected", () => {
    expect(nextStep("offerText", { offerCount: 3 })).toBe("offerPick");
    expect(previousStep("audienceText", { offerCount: 3 })).toBe("offerPick");
  });
});

describe("vocabularies", () => {
  it("offers exactly the two legs asked for", () => {
    expect(NEW_ORG_LEGS.map((l) => l.key)).toEqual(["start_to_website_visit", "start_to_conversation"]);
  });
  it("asks the six offer levers the brand-service user-fields store", () => {
    // The six non-services keys of USER_FIELD_KEYS in lib/api.ts (brand-service user-fields).
    const levers = ["dreamOutcome", "perceivedLikelihood", "socialProof", "riskReversal", "urgency", "scarcity"];
    expect(LEVER_QUESTIONS.map((q) => q.key).sort()).toEqual([...levers].sort());
  });
});
