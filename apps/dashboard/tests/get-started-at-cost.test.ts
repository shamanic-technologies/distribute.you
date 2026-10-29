import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { atCostCheckout, isAtCostOffer, matchNote, topupCta, wallCopy } from "../src/lib/v2/get-started";
import { spendConsentLines } from "../src/lib/v2/spend-consent";

// ONBOARDING-PREPAID-1029 (owner 2026-10-29): every org created since is billing's
// `prepaid_at_cost`: first top-up + automatic reload in one checkout, minimums $10 / $5 /
// threshold + $10 checked HERE (billing refuses none), no match, no free money promised.

const src = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("at-cost checkout minimums", () => {
  it("takes the owner's worked example: $10 now, $15 below $5", () => {
    expect(atCostCheckout({ topup: "10", threshold: "5", reload: "15" })).toEqual({
      problems: { topup: null, threshold: null, reload: null },
      values: { topupUsd: 10, thresholdUsd: 5, reloadUsd: 15 },
    });
  });

  it("refuses each amount under its own minimum, by name", () => {
    const r = atCostCheckout({ topup: "9", threshold: "4", reload: "13" });
    expect(r.values).toBeNull();
    expect(r.problems.topup).toBe("At least $10.");
    expect(r.problems.threshold).toBe("At least $5.");
    expect(r.problems.reload).toBe("At least $14.");
  });

  it("ties the reload to the threshold typed", () => {
    expect(atCostCheckout({ topup: "50", threshold: "20", reload: "29" }).problems.reload).toBe("At least $30.");
    expect(atCostCheckout({ topup: "50", threshold: "20", reload: "30" }).values).toEqual({ topupUsd: 50, thresholdUsd: 20, reloadUsd: 30 });
  });

  it("refuses anything but whole dollars", () => {
    expect(atCostCheckout({ topup: "10.5", threshold: "5", reload: "15" }).problems.topup).toBe("Whole dollars.");
    expect(atCostCheckout({ topup: "$1,000", threshold: "5", reload: "15" }).values?.topupUsd).toBe(1000);
  });
});

describe("no free money for an at-cost org", () => {
  it("reads billing's offer", () => {
    expect(isAtCostOffer({ free_credit_offer: "prepaid_at_cost" })).toBe(true);
    expect(isAtCostOffer({ free_credit_offer: "match_100" })).toBe(false);
    expect(isAtCostOffer(null)).toBe(false);
  });

  it("the wall's words promise no match, no trial, nothing free", () => {
    const copy = wallCopy(null, false, true);
    expect(copy.creditUsd).toBeNull();
    const words = Object.values(copy).filter((v) => typeof v === "string").join(" ");
    expect(words).not.toMatch(/match|free|trial|gift|\$/i);
    expect(words).not.toMatch(/[—–]/);
  });

  it("an older org's wall is unchanged", () => {
    expect(wallCopy(null, false).creditUsd).toBe(100);
    expect(wallCopy(null, true).cardNote).toContain("match");
  });

  it("the match line and the pay button say nothing free", () => {
    const acct = { free_credit_offer: "prepaid_at_cost" };
    expect(matchNote(acct)).toBe("");
    expect(topupCta(10, matchNote(acct))).toBe("Pay $10 and launch");
  });

  it("the reload statement names the pair picked", () => {
    const [card] = spendConsentLines({ arm: { kind: "prepaid", topupUsd: 10, reload: { thresholdUsd: 5, amountUsd: 15 } } });
    expect(card.text).toContain("When my credit falls under $5, $15 is added automatically");
  });
});

describe("the wall and the dashboard walk use the at-cost checkout", () => {
  it("the wall forces prepaid once billing says at cost, and hands the topup its offer", () => {
    const wall = src("src/components/v2/get-started/account-card-wall.tsx");
    expect(wall).toContain('if (isAtCostOffer(acct)) setSold("prepaid");');
    expect(wall).toContain("<PrepaidTopup busy={busy} atCost={atCost}");
  });

  it("the dashboard walk's launch does too", () => {
    const launch = src("src/components/v2/get-started/org-launch.tsx");
    expect(launch).toContain("atCost={isAtCostOffer(account)}");
    expect(launch).toContain("|| isAtCostOffer(account),");
  });

  it("the signed-out walk reads its org's offer before promising anything", () => {
    const walk = src("src/components/v2/get-started/get-started.tsx");
    expect(walk).toContain("readWalkOffer()");
    expect(walk).toContain("wallCopy(planMonthlyUsd, postpaidArm, walkAtCost)");
    expect(src("src/app/api/anon/offer/route.ts")).toContain("getOrgFreeCreditOffer(session.orgId)");
  });
});
