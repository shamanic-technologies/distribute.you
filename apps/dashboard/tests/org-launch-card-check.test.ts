import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cardRiskCopy, orgLaunchStart, refusedCheckFacts } from "../src/lib/v2/card-risk";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ORG-LAUNCH-CARD-REFUSED-1028 (Sobtra, 2026-10-27): the $50 card check was refused on the
// wall, then the dashboard walk read the saved card as "already pays" and launched.
describe("the dashboard walk's launch reads billing's postpaid card check", () => {
  const postpaid = { payment_mode: "postpaid", has_payment_method: true };

  it("a refused check never reads as ready", () => {
    expect(orgLaunchStart({ ...postpaid, postpaid_card_check: "refused" })).toBe("card_refused");
  });

  it("a card never checked runs the check first", () => {
    expect(orgLaunchStart({ ...postpaid, postpaid_card_check: "required" })).toBe("card_check");
    expect(orgLaunchStart({ ...postpaid })).toBe("card_check");
  });

  it("passed and grandfathered launch as today", () => {
    expect(orgLaunchStart({ ...postpaid, postpaid_card_check: "passed" })).toBe("ready");
    expect(orgLaunchStart({ ...postpaid, postpaid_card_check: "grandfathered" })).toBe("ready");
  });

  it("prepaid and plan orgs with a card are unchanged; no card adds credit", () => {
    expect(orgLaunchStart({ payment_mode: "prepaid", has_payment_method: true, postpaid_card_check: "required" })).toBe("ready");
    expect(orgLaunchStart({ payment_mode: "subscription", has_payment_method: true, postpaid_card_check: "refused" })).toBe("ready");
    expect(orgLaunchStart({ payment_mode: "postpaid", has_payment_method: false, postpaid_card_check: "refused" })).toBe("credit");
  });

  it("the refusal shows the wall's choice with the bank's sentence", () => {
    const facts = refusedCheckFacts("Your card has insufficient funds.", { saved: true, methodId: "pm_1", postpaidAllowed: true, refusedReason: null, country: "FR" });
    expect(facts.methodId).toBe("pm_1");
    const c = cardRiskCopy("postpaid", facts)!;
    expect(c.body).toBe("Your card has insufficient funds.");
    expect([c.primary, c.secondary, c.secondaryAction]).toEqual(["Use another card", "Switch to prepaid", "prepaid"]);
  });

  it("OrgLaunch decides its start on orgLaunchStart, never on has_payment_method alone", () => {
    const src = read("src/components/v2/get-started/org-launch.tsx");
    expect(src).toContain("orgLaunchStart(a)");
    expect(src).not.toContain('a.has_payment_method ? "ready"');
    expect(src).toContain("<CardRiskNotice");
    expect(src).toContain('setPaymentMode("postpaid"');
    expect(src).toContain("chosePrepaid ||");
  });
});
