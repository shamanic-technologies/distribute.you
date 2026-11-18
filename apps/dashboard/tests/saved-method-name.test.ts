import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { savedMethodName } from "../src/components/billing/billing-display";

// BILLING-LINK-PAYMENT-METHOD-1118: the Billing page names WHAT we charge, whatever
// its type, from the fields billing serves (never derived in the browser).
describe("savedMethodName", () => {
  it("names a card by brand and last 4, as today", () => {
    expect(
      savedMethodName({ payment_method_type: "card", card_brand: "visa", card_last4: "4242" }, " ending ")
    ).toBe("Visa ending 4242");
  });

  it("names a card the same on an older billing deploy that states no type", () => {
    expect(savedMethodName({ card_brand: "mastercard", card_last4: "1111" }, " ")).toBe("Mastercard 1111");
  });

  it("names a Link wallet by its email", () => {
    expect(
      savedMethodName(
        { payment_method_type: "link", link_email: "ethan@example.com", card_brand: null, card_last4: null },
        " · "
      )
    ).toBe("Link · ethan@example.com");
  });

  it("says Link even when billing states no wallet email", () => {
    expect(savedMethodName({ payment_method_type: "link", link_email: null }, " ")).toBe("Link");
  });

  it("is null when billing states no detail", () => {
    expect(savedMethodName({ card_brand: null, card_last4: null }, " ")).toBeNull();
    expect(savedMethodName(null, " ")).toBeNull();
  });
});

describe("v2 Billing payment method row", () => {
  const page = readFileSync(join(__dirname, "../src/components/v2/billing-page.tsx"), "utf8");
  const line = readFileSync(join(__dirname, "../src/components/v2/saved-method-line.tsx"), "utf8");
  it("the Payment method section renders the shared line", () => {
    const at = page.indexOf('title="Payment method"');
    expect(page.slice(at, page.indexOf('"Change card"', at))).toContain("<SavedMethodLine account={account} />");
  });
  it("a Link wallet shows its mark and email before the bare connected line", () => {
    expect(line).toContain('isLink ? "link" : account.card_brand');
    expect(line.indexOf("account.link_email")).toBeLessThan(line.indexOf(">Card connected<"));
  });
});
