import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paymentModeOf } from "../src/lib/payment-mode";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const V2 = read("src/components/v2/billing-page.tsx");
const ROUTE = read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/billing/page.tsx");
const API = read("src/lib/api.ts");

describe("paymentModeOf", () => {
  it("reads billing's own word", () => {
    expect(paymentModeOf({ payment_mode: "prepaid", has_payment_method: false })).toBe("prepaid");
    expect(paymentModeOf({ payment_mode: "postpaid", has_payment_method: true })).toBe("postpaid");
  });

  it("is null when the account does not say, never a guessed default", () => {
    expect(paymentModeOf({ has_payment_method: true })).toBeNull();
    expect(paymentModeOf({ payment_mode: "weekly", has_payment_method: true })).toBeNull();
    expect(paymentModeOf(null)).toBeNull();
  });
});

describe("the v2 Billing page draws; it re-implements no money path", () => {
  it("is what the v2 route renders", () => {
    expect(ROUTE).toContain("<V2BillingPage />");
    expect(ROUTE).not.toContain("V2AccountFrame");
  });

  it("runs the shared billing controller", () => {
    expect(V2).toContain("useBillingController()");
  });

  it("owns no charge path of its own", () => {
    for (const fn of ["createPortalSession", "createCheckoutSession", "removePaymentMethod", "openCardWidget"]) {
      expect(V2, fn).not.toContain(fn);
    }
  });

  it("routes every card control through the gate that asks before it charges", () => {
    expect(V2.match(/handleManagePayment\("manage"\)/g) ?? []).toHaveLength(3);
    expect(V2.match(/handleManagePayment\("invoices"\)/g) ?? []).toHaveLength(1);
    // The only raw open is the confirmation's own Confirm.
    expect(V2.match(/openCardPage\(/g) ?? []).toHaveLength(1);
  });

  it("mounts both money confirmations with every prop", () => {
    const change = V2.slice(V2.indexOf("<CardChangeConfirmModal"), V2.indexOf("{c.removeConfirmOpen"));
    expect(change).toContain("settleCents={c.settleCents}");
    expect(change).toContain("pending={c.portalLoadingSource !== null}");
    expect(change).toContain("problem={c.settleProblem?.problem ?? null}");
    const remove = V2.slice(V2.indexOf("<CardRemoveConfirmModal"), V2.indexOf('<div className="mb-6 flex flex-wrap'));
    expect(remove).toContain("consequence={c.removeConsequence}");
    expect(remove).toContain("pending={c.removePending}");
    expect(remove).toContain("c.handleRemoveCard()");
  });
});

describe("a Revolut org can always get a card on file", () => {
  const CONTROLLER = read("src/components/billing/use-billing-controller.ts");

  it("offers Add card when there is no card, through the card gate", () => {
    const noCard = V2.slice(V2.indexOf("No card yet."), V2.indexOf("{c.settleCents !== null"));
    expect(noCard).toContain("Add card");
    expect(noCard).toContain('c.handleManagePayment("manage")');
    expect(V2).not.toContain("One is saved with your first payment");
  });

  it("tops up through the in-page widget first, which saves the card", () => {
    const topup = CONTROLLER.slice(CONTROLLER.indexOf("async function handleTopup("));
    const embeddedAt = topup.indexOf("createEmbeddedCheckoutSession(amountCents)");
    const hostedAt = topup.indexOf("createCheckoutSession({");
    expect(embeddedAt).toBeGreaterThan(-1);
    expect(hostedAt).toBeGreaterThan(embeddedAt);
    expect(topup).toContain('embedded.mode === "embedded_widget"');
    expect(topup).toContain("savePaymentMethodFor: embedded.save_payment_method_for");
  });
});

describe("how the org pays: a tag, set by staff", () => {
  // Owner 2026-10-01: each client keeps the mode it has, stated plainly; only staff
  // moves an org between modes (admin console), so the page offers no switch.
  const section = V2.slice(V2.indexOf('id="payment-mode"'), V2.indexOf("{/* Auto top-up, in the words of the mode it serves. */}"));

  it("shows the current mode as a tag with its rule, and nothing to click", () => {
    expect(section).toContain('<span className="k-chip">{MODE_COPY[mode].title}</span>');
    expect(section).toContain("{MODE_COPY[mode].line}");
    expect(section).not.toContain("<button");
    expect(section).not.toContain('role="radio"');
    expect(V2).not.toContain("setPaymentMode");
    expect(V2).not.toContain("CardImprintModal");
  });

  it("says who changes it", () => {
    expect(section).toContain("Set by our team for your account. Write to us if you want it changed.");
  });

  it("reads the mode off the account billing already serves", () => {
    expect(API).toContain('payment_mode?: "prepaid" | "postpaid" | "subscription";');
    expect(V2).toContain("paymentModeOf(account)");
  });
});

describe("the v2 page speaks Keel", () => {
  it("uses no v1 greys, brand fills or bordered cards", () => {
    expect(V2).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl/);
  });

  it("carries no em-dash in its copy", () => {
    const code = V2.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("—");
  });
});
