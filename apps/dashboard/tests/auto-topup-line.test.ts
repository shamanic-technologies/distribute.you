import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { autoTopupSentence, parseReloadAmountCents, reloadRefusal, reloadToSave } from "../src/lib/v2/auto-topup-line";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// BILLING-AUTOTOPUP-MODAL-1118: the Billing "Auto top-up" card reads ONE plain sentence off
// billing's served figures; the amount changes in a modal (owner 2026-11-18: « quelle horreur »
// for the inline input). The threshold is $0 for everyone, editable nowhere.
describe("auto top-up sentence", () => {
  it("reads the served $0 threshold as 'reaches $0', value first, no 'from your card'", () => {
    expect(autoTopupSentence(true, 0, 1000)).toBe("Adds $10 each time your balance reaches $0.");
    expect(autoTopupSentence(true, 0, 1000)).not.toContain("card");
  });

  it("an account billing has not moved yet reads its own threshold", () => {
    expect(autoTopupSentence(true, 500, 1000)).toBe("Adds $10 each time your balance falls below $5.");
  });

  it("off says what happens at $0", () => {
    expect(autoTopupSentence(false, null, null)).toBe("Off. Your campaigns pause when your balance reaches $0.");
  });

  it("never fills in a figure billing did not serve", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(autoTopupSentence(true, null, 1000)).toBeNull();
    expect(autoTopupSentence(true, 0, undefined)).toBeNull();
    err.mockRestore();
  });
});

describe("parseReloadAmountCents", () => {
  it("reads whole dollars, $0 included", () => {
    expect(parseReloadAmountCents("10")).toBe(1000);
    expect(parseReloadAmountCents(" $25 ")).toBe(2500);
    expect(parseReloadAmountCents("1,000")).toBe(100000);
    expect(parseReloadAmountCents("0")).toBe(0);
    expect(parseReloadAmountCents("10.50")).toBeNull();
    expect(parseReloadAmountCents("-5")).toBeNull();
    expect(parseReloadAmountCents("ten")).toBeNull();
  });
});

describe("what the modal saves", () => {
  it("unticked or $0 = off (0); otherwise at least billing's minimum", () => {
    expect(reloadToSave({ on: false, amount: "25" }, 1000)).toEqual({ cents: 0 });
    expect(reloadToSave({ on: true, amount: "0" }, 1000)).toEqual({ cents: 0 });
    expect(reloadToSave({ on: true, amount: "25" }, 1000)).toEqual({ cents: 2500 });
    expect(reloadToSave({ on: true, amount: "5" }, 1000)).toEqual({ problem: "At least $10, or $0 to turn it off." });
    expect(reloadToSave({ on: true, amount: "ten" }, 1000)).toEqual({ problem: "Whole dollars." });
  });

  it("says billing's refusals in plain words", () => {
    expect(reloadRefusal(400, { code: "topup_below_minimum", minimum_cents: 1000 })).toBe("At least $10, or $0 to turn it off.");
    expect(reloadRefusal(409, { code: "auto_topup_required" })).toContain("could not be turned off on this account yet");
    expect(reloadRefusal(500, null)).toBe("Not saved. Try again.");
  });
});

describe("Billing page money settings: one button, one modal, same way (owner 2026-11-18)", () => {
  const page = read("src/components/v2/billing-page.tsx");
  const card = read("src/components/v2/auto-topup-card.tsx");
  const limit = read("src/components/v2/monthly-limit-card.tsx");

  it("no inline money input is left on the page or its cards", () => {
    expect(page).not.toContain("<input\n                  autoFocus");
    expect(page).not.toContain("ReloadAmount");
    expect(card).not.toContain("onBlur");
    expect(limit).not.toContain("onBlur");
  });

  it("auto top-up and monthly limit both open a SettingModal from a SettingButton", () => {
    for (const src of [card, limit]) {
      expect(src).toContain("<SettingButton");
      expect(src).toContain("<SettingModal");
    }
    expect(page).toContain("<AutoTopupCard");
    expect(page).toContain("<MonthlyLimitCard />");
  });

  it("the auto top-up modal reuses the launch payment modal's reload fields", () => {
    expect(card).toContain('import { ReloadFields } from "@/components/v2/get-started/prepaid-topup";');
    expect(read("src/components/v2/get-started/prepaid-topup.tsx")).toContain("<ReloadFields");
  });

  it("$0 turns it off; no threshold is sent; the minimum is billing's", () => {
    expect(card).toContain("if (cents === 0) await disableAutoTopup();");
    expect(card).toContain("else await configureAutoTopup(cents);");
    expect(card).toContain("rules.data.reload_amount_minimum_cents");
    expect(card).not.toContain("remove your card");
  });
});
