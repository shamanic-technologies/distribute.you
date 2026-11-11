import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { atCostCheckout, isAtCostOffer, matchNote, offersNoFreeMoney, topupCta, wallCopy } from "../src/lib/v2/get-started";
import { spendConsentLines } from "../src/lib/v2/spend-consent";

// ONBOARDING-PREPAID-1029 (owner 2026-10-29): every org created since is billing's
// `prepaid_at_cost`: first top-up + automatic reload in one checkout, minimums $10 / $5 /
// reload $10 checked HERE (billing refuses none), no match, no free money promised.

const src = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("at-cost checkout minimums", () => {
  it("takes the owner's worked example: $10 now, +$10 below $5", () => {
    expect(atCostCheckout({ topup: "10", threshold: "5", reload: "10" })).toEqual({
      problems: { topup: null, threshold: null, reload: null },
      values: { topupUsd: 10, thresholdUsd: 5, reloadUsd: 10 },
    });
  });

  it("refuses each amount under its own minimum, by name", () => {
    const r = atCostCheckout({ topup: "9", threshold: "4", reload: "9" });
    expect(r.values).toBeNull();
    expect(r.problems.topup).toBe("At least $10.");
    expect(r.problems.threshold).toBe("At least $5.");
    expect(r.problems.reload).toBe("At least $10.");
  });

  it("a $10 reload passes whatever the threshold (owner 2026-11-11: +$10, never threshold + $10)", () => {
    expect(atCostCheckout({ topup: "50", threshold: "20", reload: "10" }).values).toEqual({ topupUsd: 50, thresholdUsd: 20, reloadUsd: 10 });
    expect(atCostCheckout({ topup: "50", threshold: "20", reload: "9" }).problems.reload).toBe("At least $10.");
  });

  it("refuses anything but whole dollars", () => {
    expect(atCostCheckout({ topup: "10.5", threshold: "5", reload: "15" }).problems.topup).toBe("Whole dollars.");
    expect(atCostCheckout({ topup: "$1,000", threshold: "5", reload: "15" }).values?.topupUsd).toBe(1000);
  });
});

describe("the automatic reload is optional, ticked by default (owner 2026-10-29)", () => {
  it("unticked: only the top-up is checked, no reload is sent", () => {
    expect(atCostCheckout({ topup: "10", threshold: "", reload: "", reloadOn: false })).toEqual({
      problems: { topup: null, threshold: null, reload: null },
      values: { topupUsd: 10, thresholdUsd: null, reloadUsd: null },
    });
    expect(atCostCheckout({ topup: "9", threshold: "", reload: "", reloadOn: false }).values).toBeNull();
  });

  it("the box starts ticked and an unticked box pays without a reload", () => {
    const topup = src("src/components/v2/get-started/prepaid-topup.tsx");
    expect(topup).toContain("const [reloadOn, setReloadOn] = useState(true);");
    expect(topup).toContain("Reload my credit automatically");
    expect(topup).toMatch(/: null,\n\s+consent: consentRecord/);
  });

  it("the statement says the campaigns pause without a reload", () => {
    const [card] = spendConsentLines({ arm: { kind: "prepaid", topupUsd: 10, reload: null } });
    expect(card.text).toBe("My campaigns run on the credit I add. When it runs out, they pause until I add more.");
  });
});

describe("no free money for an at-cost org", () => {
  it("reads billing's offer", () => {
    expect(isAtCostOffer({ free_credit_offer: "prepaid_at_cost" })).toBe(true);
    expect(isAtCostOffer({ free_credit_offer: "match_100" })).toBe(false);
    expect(isAtCostOffer(null)).toBe(false);
  });

  it("the wall's words promise no match, no trial, nothing free", () => {
    const copy = wallCopy(true);
    expect(copy.creditUsd).toBeNull();
    const words = Object.values(copy).filter((v) => typeof v === "string").join(" ");
    expect(words).not.toMatch(/match|free|trial|gift|\$/i);
    expect(words).not.toMatch(/[—–]/);
  });

  it("an older org's wall is unchanged", () => {
    expect(wallCopy(false).creditUsd).toBe(100);
    expect(wallCopy().cardNote).toContain("match");
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
  it("the wall reads at cost off the account once it exists, and hands the topup its offer", () => {
    const wall = src("src/components/v2/get-started/account-card-wall.tsx");
    expect(wall).toContain("const atCost = account ? isAtCostOffer(account) : walkAtCost;");
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
    expect(walk).toContain("wallCopy(walkAtCost)");
    expect(src("src/app/api/anon/offer/route.ts")).toContain("getOrgFreeCreditOffer(session.orgId)");
  });
});

describe("no referral or free credit surface for a no-free-money org", () => {
  it("covers the at-cost and API offers only", () => {
    expect(offersNoFreeMoney({ free_credit_offer: "prepaid_at_cost" })).toBe(true);
    expect(offersNoFreeMoney({ free_credit_offer: "agent_api" })).toBe(true);
    expect(offersNoFreeMoney({ free_credit_offer: "match_100" })).toBe(false);
    expect(offersNoFreeMoney({ free_credit_offer: "legacy" })).toBe(false);
  });

  it("the account menu and the palette never offer Refer a friend (program ended, owner 2026-11-03)", () => {
    const menus = src("src/components/v2/sidebar-menus.tsx");
    expect(menus).not.toContain("Refer a friend\"");
    expect(menus).not.toContain("/referral");
    expect(src("src/lib/use-no-free-money.ts")).toContain("show: account !== undefined && !offersNoFreeMoney(account)");
  });

  it("the referral page is gone (old URL lands on Billing) and Billing shows no free credit for it", () => {
    expect(src("src/components/v2/setup-pages.tsx")).not.toContain("V2ReferralPage");
    expect(src("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/referral/page.tsx")).toContain("/billing`);");
    expect(src("src/components/v2/billing-page.tsx")).toContain('{account && !offersNoFreeMoney(account) && hasFreeCredit && (\n        <Section id="free-credit"');
  });
});
