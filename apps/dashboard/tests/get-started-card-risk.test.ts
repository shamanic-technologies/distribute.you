import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_CHECK_UNFINISHED, cardRiskCopy, countryName, postpaidCardCheckSecret, postpaidRefusalFacts, type CardFacts } from "../src/lib/v2/card-risk";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const fine: CardFacts = { saved: true, methodId: "pm_1", postpaidAllowed: true, refusedReason: null, country: "FR" };
const prepaid: CardFacts = { saved: true, methodId: "pm_2", postpaidAllowed: false, refusedReason: "prepaid_card", country: "US" };
const indian: CardFacts = { saved: true, methodId: "pm_3", postpaidAllowed: false, refusedReason: "card_issuing_country_unsupported", country: "IN" };

describe("a card automatic charges may not reach (owner 2026-10-13), on billing's verdict", () => {
  it("says nothing on a card billing allows, an unknown card included", () => {
    for (const arm of ["prepaid", "postpaid"] as const) {
      expect(cardRiskCopy(arm, fine)).toBeNull();
      expect(cardRiskCopy(arm, { ...fine, country: null })).toBeNull();
      expect(cardRiskCopy(arm, { ...prepaid, saved: false })).toBeNull();
    }
  });

  it("prepaid: a warning with another card first, and a way past", () => {
    const india = cardRiskCopy("prepaid", indian)!;
    expect(india.body).toBe(
      "Cards issued in India often refuse automatic charges. When a top-up fails, your campaigns stop. Interested prospects can then wait for an answer, and a late answer loses deals.",
    );
    expect([india.primary, india.secondary, india.secondaryAction]).toEqual(["Use another card", "Continue anyway", "continue"]);
    const topup = cardRiskCopy("prepaid", prepaid)!;
    expect(topup.title).toBe("Your automatic top-ups may fail on this card");
    expect(topup.body.startsWith("This card is a prepaid card. When a top-up fails, your campaigns stop.")).toBe(true);
    expect(topup.secondaryAction).toBe("continue");
  });

  it("post-paid: no way past, another card or prepaid", () => {
    const c = cardRiskCopy("postpaid", prepaid)!;
    expect(c.title).toBe("Post-paid does not work with this card");
    expect([c.primary, c.secondary, c.secondaryAction]).toEqual(["Use another card", "Switch to prepaid", "prepaid"]);
    expect(c.body).not.toMatch(/continue/i);
  });

  it("prints no invented figure and no dash", () => {
    for (const arm of ["prepaid", "postpaid"] as const) {
      for (const f of [prepaid, indian]) {
        const c = cardRiskCopy(arm, f)!;
        const all = `${c.title} ${c.body} ${c.primary} ${c.secondary}`;
        expect(all).not.toMatch(/\d/);
        expect(all).not.toMatch(/[–—]/);
      }
    }
    expect(countryName("in")).toBe("India");
  });

  it("reads billing's 409 on post-paid as the same warning", () => {
    expect(postpaidRefusalFacts({ code: "postpaid_card_not_allowed", card_refused_reason: "card_issuing_country_unsupported" }, indian)).toEqual(indian);
    expect(postpaidRefusalFacts({ code: "something_else" }, indian)).toBeNull();
    expect(postpaidRefusalFacts(undefined, null)).toBeNull();
  });

  it("reads billing's refused $50 card check as the same choice, with the bank's sentence (owner 2026-10-22)", () => {
    const error = "Your bank refused a $50.00 check on this card: Your card has insufficient funds. Use another card, or pay upfront.";
    const refused = postpaidRefusalFacts({ code: "postpaid_card_hold_refused", card_refused_reason: "card_hold_refused", error }, fine)!;
    expect(refused).toEqual({ ...fine, postpaidAllowed: false, refusedReason: "card_hold_refused", refusalMessage: error });
    const c = cardRiskCopy("postpaid", refused)!;
    expect(c.title).toBe("Post-paid does not work with this card");
    expect(c.body).toBe(error);
    expect([c.primary, c.secondary, c.secondaryAction]).toEqual(["Use another card", "Switch to prepaid", "prepaid"]);
    const silent = cardRiskCopy("postpaid", postpaidRefusalFacts({ code: "postpaid_card_hold_refused" }, null)!)!;
    expect(silent.body).toBe("Your bank refused a check on this card.");
    expect(silent.body).not.toMatch(/[–—]/);
    // The country/prepaid refusal reads exactly as before.
    expect(postpaidRefusalFacts({ code: "postpaid_card_not_allowed", card_refused_reason: "prepaid_card" }, prepaid)).toEqual(prepaid);
  });

  it("a bank that wants the customer to confirm the card check: Stripe's step, then billing asked again", () => {
    expect(postpaidCardCheckSecret({ code: "postpaid_card_hold_requires_action", client_secret: "pi_1_secret_x" })).toBe("pi_1_secret_x");
    expect(postpaidCardCheckSecret({ code: "postpaid_card_hold_requires_action" })).toBeNull();
    expect(postpaidCardCheckSecret({ code: "postpaid_card_hold_refused", client_secret: "pi_1_secret_x" })).toBeNull();
    expect(postpaidCardCheckSecret(undefined)).toBeNull();
    expect(postpaidRefusalFacts({ code: "postpaid_card_hold_requires_action", client_secret: "pi_1_secret_x" }, fine)).toBeNull();
    expect(CARD_CHECK_UNFINISHED).not.toMatch(/[–—]|\$|\d/);
    // An existing post-paid org's launch (`org-launch.tsx`); the signup wall sells prepaid only.
    const launch = read("src/components/v2/get-started/org-launch.tsx");
    const arm = launch.slice(launch.indexOf("async function checkCard()"), launch.indexOf("async function openCardSave("));
    const first = arm.indexOf("await putPostpaid();");
    const action = arm.indexOf("await stripe.handleNextAction({ clientSecret });");
    const again = arm.indexOf("await putPostpaid();", action);
    expect(first).toBeGreaterThan(-1);
    expect(action).toBeGreaterThan(first);
    expect(again).toBeGreaterThan(action);
    expect(arm.indexOf("setError(CARD_CHECK_UNFINISHED);")).toBeLessThan(arm.indexOf("setCardRisk(refused);"));
    expect(again).toBeLessThan(arm.indexOf("void launch();"));
  });
});

// The signup wall sells the prepaid checkout only (OFFER-RESET-1029; the plan and
// post-paid arms were deleted 2026-11-11).
describe("the prepaid wall's card check", () => {
  const wall = read("src/components/v2/get-started/account-card-wall.tsx");

  it("checks the card before it launches, and the warning sits in place of the card step", () => {
    const paid = wall.slice(wall.indexOf("async function afterPaid("), wall.indexOf("// ── The saved card's facts"));
    expect(paid.indexOf("await cardIsFine(null)")).toBeLessThan(paid.indexOf("void launch();"));
    expect(wall).toContain('if (!cardRiskCopy("prepaid", facts)) return true;');
    expect(wall).toContain("{stage === \"card\" && !cardSecret && cardRisk && (");
    expect(wall).toContain("{stage === \"card\" && !cardSecret && !cardRisk && (");
  });

  it("another card is checked again, then launches; continue anyway launches", () => {
    const another = wall.slice(wall.indexOf("function pickAnotherCard()"), wall.indexOf("function cardRiskContinue("));
    expect(another.indexOf("await cardIsFine(previousId)")).toBeLessThan(another.indexOf("void launch();"));
    const go = wall.slice(wall.indexOf("function cardRiskContinue("), wall.indexOf("// ── Launch"));
    expect(go).toContain("void launch();");
  });

  it("never makes the org post-paid", () => {
    for (const gone of ["setPaymentMode(", "armPostpaid", "postpaidRefusalFacts", "startPostpaid"]) expect(wall, gone).not.toContain(gone);
  });
});
