import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cardRiskCopy, countryName, postpaidRefusalFacts, type CardFacts } from "../src/lib/v2/card-risk";
import { firstChargeUsd, monthlyLimitToSave } from "../src/lib/v2/monthly-limit";
import { wallCopy } from "../src/lib/v2/get-started";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const fine: CardFacts = { saved: true, methodId: "pm_1", postpaidAllowed: true, refusedReason: null, country: "FR" };
const prepaid: CardFacts = { saved: true, methodId: "pm_2", postpaidAllowed: false, refusedReason: "prepaid_card", country: "US" };
const indian: CardFacts = { saved: true, methodId: "pm_3", postpaidAllowed: false, refusedReason: "card_issuing_country_unsupported", country: "IN" };

describe("a card automatic charges may not reach (owner 2026-10-13), on billing's verdict", () => {
  it("says nothing on a card billing allows, an unknown card included", () => {
    for (const arm of ["subscription", "prepaid", "postpaid"] as const) {
      expect(cardRiskCopy(arm, fine)).toBeNull();
      expect(cardRiskCopy(arm, { ...fine, country: null })).toBeNull();
      expect(cardRiskCopy(arm, { ...prepaid, saved: false })).toBeNull();
    }
  });

  it("plan and prepaid: a warning with another card first, and a way past", () => {
    const plan = cardRiskCopy("subscription", indian)!;
    expect(plan.title).toBe("Your plan upgrades may fail on this card");
    expect(plan.body).toBe(
      "Cards issued in India often refuse automatic charges. When an upgrade fails, your campaigns stop. Interested prospects can then wait for an answer, and a late answer loses deals.",
    );
    expect([plan.primary, plan.secondary, plan.secondaryAction]).toEqual(["Use another card", "Continue anyway", "continue"]);
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
    for (const arm of ["subscription", "prepaid", "postpaid"] as const) {
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

  it("the wall sends a refused card check to the card choice, and another card arms post-paid again", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    const arm = wall.slice(wall.indexOf("async function armPostpaid()"), wall.indexOf("// ── The saved card's facts"));
    expect(arm.indexOf("postpaidRefusalFacts(e.body, knownCard.current)")).toBeLessThan(arm.indexOf("setCardRisk(refused);"));
    const goOn = wall.slice(wall.indexOf("function goOnAfterCard()"), wall.indexOf("// ── Launch"));
    expect(goOn).toContain("void armPostpaid();");
    const another = wall.slice(wall.indexOf("function pickAnotherCard()"), wall.indexOf("function cardRiskSecondary("));
    expect(another).toContain("goOnAfterCard();");
  });
});

describe("the post-paid arm's wall (owner 2026-10-13)", () => {
  it("its monthly limit lets billing's first $50 step through", () => {
    expect(firstChargeUsd({ kind: "postpaid" })).toBe(50);
    expect(monthlyLimitToSave("40", { kind: "postpaid" })).toEqual({ problem: "Your monthly limit starts at $50." });
    expect(monthlyLimitToSave(null, { kind: "postpaid" })).toEqual({ usd: 9000 });
  });

  it("its copy saves a card, says the match, never a trial", () => {
    const c = wallCopy(null, true);
    expect(c.cardTitle).toBe("Save your card");
    expect(c.cardCta).toBe("Save my card and launch");
    expect(c.cardNote).toBe("You pay after your campaigns spend. We match your first $100.");
    expect(JSON.stringify(c).toLowerCase()).not.toContain("trial");
    expect(wallCopy(null).cardTitle).toBe("Add credit");
  });

  it("saves a card, charges nothing, makes the org post-paid, then launches; the walk in the dashboard is untouched", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    const start = wall.slice(wall.indexOf("function startPostpaid()"), wall.indexOf("async function afterPostpaidCardSaved()"));
    expect(start).toContain('monthlyLimitToSave(monthlyLimit, { kind: "postpaid" })');
    expect(start).toContain("await saveMonthlyLimit(limit.usd);");
    expect(start).toContain("await openCardSave(");
    expect(start).not.toContain("payTopup");
    const arm = wall.slice(wall.indexOf("async function armPostpaid()"), wall.indexOf("// ── The saved card's facts"));
    expect(arm).toContain('await setPaymentMode("postpaid", undefined, consentRecord(postpaidConsent, new Date(), navigator.userAgent));');
    expect(arm).toContain("postpaidRefusalFacts(e.body, knownCard.current)");
    expect(arm.indexOf('setPaymentMode("postpaid"')).toBeLessThan(arm.indexOf("void launch();"));
    expect(wall).toContain("<SpendConsent lines={postpaidConsent}");
    expect(wall).toContain("disabled={busy || !allTicked(postpaidTicked)}");
    const gs = read("src/components/v2/get-started/get-started.tsx");
    expect(gs).toContain('if (!org && offerArm(document.cookie) === "postpaid") setPostpaidArm(true);');
  });

  it("checks the card on every arm before it goes on, and the warning sits in place of the card step", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    const paid = wall.slice(wall.indexOf("async function afterPaid("), wall.indexOf("// ── Card and plan"));
    expect(paid.indexOf("await cardIsFine(null)")).toBeLessThan(paid.indexOf("void launch();"));
    const trial = wall.slice(wall.indexOf("async function afterTrialCardSaved("), wall.indexOf("// ── Post-paid"));
    expect(trial.indexOf("await cardIsFine(null)")).toBeLessThan(trial.indexOf("await startSubscription("));
    expect(wall).toContain("{stage === \"card\" && !cardSecret && cardRisk && (");
    expect(wall).toContain("{stage === \"card\" && !cardSecret && !cardRisk && (");
    expect(wall).toContain('setSold("prepaid");');
  });
});
