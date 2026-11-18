import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AT_COST_TOPUP_CHOICES_USD, atCostCheckout as check, isAtCostOffer, matchNote, offersNoFreeMoney, reloadRulesUsd, topupCta, topupRefusal, wallCopy } from "../src/lib/v2/get-started";
import { spendConsentLines } from "../src/lib/v2/spend-consent";

// ONBOARDING-PREPAID-1029 (owner 2026-10-29): every org created since is billing's
// `prepaid_at_cost`: first top-up + automatic reload in one checkout, no match, no free
// money promised. The minimums are billing's reload rules (RELOAD-RULE-ONE-HOME-1118):
// the fixture below is billing's prod answer for an at-cost org, never a dashboard copy.
const RULES = reloadRulesUsd({
  first_topup_minimum_cents: 1000,
  reload_amount_minimum_cents: 1000,
  default_reload_amount_cents: 1000,
});
const atCostCheckout = (input: Parameters<typeof check>[0]) => check(input, RULES);

const src = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("at-cost checkout minimums", () => {
  it("takes the owner's worked example: $10 now, +$10 when the balance reaches $0", () => {
    expect(atCostCheckout({ topup: "10", reload: "10" })).toEqual({
      problems: { topup: null, reload: null },
      values: { topupUsd: 10, reloadUsd: 10 },
    });
  });

  it("refuses each amount under its own minimum, by name", () => {
    const r = atCostCheckout({ topup: "9", reload: "9" });
    expect(r.values).toBeNull();
    expect(r.problems.topup).toBe("At least $10.");
    expect(r.problems.reload).toBe("At least $10.");
  });

  it("a larger reload the person picks passes", () => {
    expect(atCostCheckout({ topup: "50", reload: "50" }).values).toEqual({ topupUsd: 50, reloadUsd: 50 });
  });

  it("refuses anything but whole dollars", () => {
    expect(atCostCheckout({ topup: "10.5", reload: "15" }).problems.topup).toBe("Whole dollars.");
    expect(atCostCheckout({ topup: "$1,000", reload: "15" }).values?.topupUsd).toBe(1000);
  });
});

describe("the automatic reload is optional, ticked by default (owner 2026-10-29)", () => {
  it("unticked: only the top-up is checked, no reload is sent", () => {
    expect(atCostCheckout({ topup: "10", reload: "", reloadOn: false })).toEqual({
      problems: { topup: null, reload: null },
      values: { topupUsd: 10, reloadUsd: null },
    });
    expect(atCostCheckout({ topup: "9", reload: "", reloadOn: false }).values).toBeNull();
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

  it("an org opened through the API (agent_api) gets the $10 at-cost checkout, match_100 keeps $100", () => {
    expect(isAtCostOffer({ free_credit_offer: "agent_api" })).toBe(true);
    expect(isAtCostOffer({ free_credit_offer: "legacy" })).toBe(false);
    for (const offer of ["agent_api", "prepaid_at_cost"]) {
      const account = { free_credit_offer: offer };
      expect(isAtCostOffer(account)).toBe(offersNoFreeMoney(account));
      expect(wallCopy(isAtCostOffer(account)).creditUsd).toBeNull();
      expect(matchNote(account)).toBe("");
    }
    expect(wallCopy(isAtCostOffer({ free_credit_offer: "match_100" })).creditUsd).toBe(100);
    expect(AT_COST_TOPUP_CHOICES_USD).toEqual([100, 250, 500, 1000]);
    const under = atCostCheckout({ topup: "9", reload: "10" });
    expect(under.problems.topup).toBe("At least $10.");
    expect(atCostCheckout({ topup: "10", reload: "10" }).values).toEqual({ topupUsd: 10, reloadUsd: 10 });
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

  it("the reload statement names the amount added when the balance reaches $0 (owner 2026-11-18)", () => {
    const [card] = spendConsentLines({ arm: { kind: "prepaid", topupUsd: 10, reload: { amountUsd: 15 } } });
    expect(card.text).toContain("When my balance reaches $0, $15 is added from my card automatically");
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
    expect(src("src/app/api/anon/offer/route.ts")).toContain("getOrgReloadRules(session.orgId)");
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

describe("billing's reload rules are the only source of the figures (RELOAD-RULE-ONE-HOME-1118)", () => {
  it("follows whatever billing serves: a staff override of $25 moves every check", () => {
    const rules = reloadRulesUsd({
      first_topup_minimum_cents: 2500,
      reload_amount_minimum_cents: 2500,
      default_reload_amount_cents: 2500,
    });
    const r = check({ topup: "20", reload: "10" }, rules);
    expect(r.problems).toEqual({ topup: "At least $25.", reload: "At least $25." });
    expect(check({ topup: "25", reload: "50" }, rules).values).toEqual({ topupUsd: 25, reloadUsd: 50 });
  });

  it("a minimum in cents rounds UP to whole dollars", () => {
    expect(
      reloadRulesUsd({
        first_topup_minimum_cents: 1050,
        reload_amount_minimum_cents: 1001,
        default_reload_amount_cents: 1001,
      }),
    ).toEqual({ firstTopupMinUsd: 11, reloadMinUsd: 11, defaultReloadUsd: 11 });
  });

  it("relays billing's own refusal words, for its three minimum codes only", () => {
    expect(topupRefusal({ code: "reload_below_minimum", minimum_cents: 1000, error: "An automatic reload must add at least $10.00" })).toBe(
      "An automatic reload must add at least $10.00.",
    );
    expect(topupRefusal({ code: "topup_threshold_below_minimum", minimum_cents: 500, error: "The reload threshold must be at least $5.00" })).toBe(
      "The reload threshold must be at least $5.00.",
    );
    expect(topupRefusal({ code: "topup_below_minimum", minimum_cents: 1000, error: "A top-up must be at least $10.00" })).toBe("A top-up must be at least $10.00.");
    expect(topupRefusal({ code: "other", error: "x" })).toBeNull();
    expect(topupRefusal({ code: "topup_below_minimum" })).toBeNull();
    expect(topupRefusal(undefined)).toBeNull();
  });

  it("the credit step reads the rules from billing and holds no number of its own", () => {
    const topup = src("src/components/v2/get-started/prepaid-topup.tsx");
    expect(topup).toContain("getReloadRules()");
    expect(topup).toContain("useState(String(rules.defaultReloadUsd))");
    const lib = src("src/lib/v2/get-started.ts");
    expect(lib).not.toMatch(/(MIN|DEFAULT)_(RELOAD|THRESHOLD|TOPUP)\w*\s*=/);
    expect(src("src/lib/api.ts")).toContain('"/billing/accounts/reload_rules"');
  });
});

describe("no reload threshold anywhere (owner 2026-11-18: « On mets $0 pour tout le monde »)", () => {
  it("the credit step and the launch modal show no threshold field and send none", () => {
    const topup = src("src/components/v2/get-started/prepaid-topup.tsx");
    expect(topup).not.toContain("falls under");
    expect(topup).not.toMatch(/thresholdUsd/);
    expect(topup).toContain("When my balance reaches $0, add");
    const guard = src("src/lib/billing-guard.tsx");
    expect(guard).not.toContain("When balance below");
    expect(guard).not.toMatch(/topupThreshold|thresholdCents/);
    expect(guard).toContain("When your balance reaches $0, add ($)");
    const pay = src("src/components/v2/get-started/pay-topup.ts");
    expect(pay).toContain("configureAutoTopup(reload.amountUsd * 100)");
    expect(src("src/lib/api.ts")).toContain("configureAutoTopup(rules.default_reload_amount_cents, undefined, token)");
  });
});
