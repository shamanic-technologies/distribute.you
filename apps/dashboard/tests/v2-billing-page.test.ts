import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  paymentModeOf,
  paymentModeRefusalMessage,
  postpaidBlocker,
} from "../src/lib/payment-mode";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const V2 = read("src/components/v2/billing-page.tsx");
const ROUTE = read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/billing/page.tsx");
const V1 = read("src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx");
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

describe("postpaidBlocker", () => {
  // billing does not refuse the switch: it stops every campaign the moment a
  // postpaid org has no chargeable card. So the page refuses first.
  it("refuses without a card", () => {
    expect(postpaidBlocker({ has_payment_method: false })).toMatch(/Add a card first/);
  });

  it("refuses a card that cannot be charged automatically", () => {
    expect(postpaidBlocker({ has_payment_method: true, auto_reload_supported: false })).toMatch(/cannot be charged/);
  });

  it("allows a chargeable card, an absent flag reading as supported", () => {
    expect(postpaidBlocker({ has_payment_method: true })).toBeNull();
    expect(postpaidBlocker({ has_payment_method: true, auto_reload_supported: true })).toBeNull();
  });
});

describe("paymentModeRefusalMessage", () => {
  it("says a sentence per refusal code, with billing's owed amount", () => {
    expect(paymentModeRefusalMessage(409, "outstanding_balance_no_card", "$29.84")).toContain("You owe $29.84 ");
    expect(paymentModeRefusalMessage(409, "outstanding_balance_charge_declined", "$29.84")).toMatch(/declined/);
    expect(paymentModeRefusalMessage(409, "outstanding_balance_below_minimum_charge", "$0.20")).toMatch(/less than a card/);
  });

  it("falls to one generic line for anything else, never the raw body", () => {
    const generic = "We could not change how you pay. Please try again.";
    expect(paymentModeRefusalMessage(502, undefined, null)).toBe(generic);
    expect(paymentModeRefusalMessage(409, "something_new", null)).toBe(generic);
    expect(paymentModeRefusalMessage(null, null, null)).toBe(generic);
  });

  it("never claims nothing changed: a settle may have charged before a failure", () => {
    expect(paymentModeRefusalMessage(502, undefined, null)).not.toContain("Nothing was changed");
  });
});

describe("the v2 Billing page draws; it re-implements no money path", () => {
  it("is what the v2 route renders", () => {
    expect(ROUTE).toContain("<V2BillingPage />");
    expect(ROUTE).not.toContain("V2AccountFrame");
  });

  it("runs the SAME controller as v1", () => {
    expect(V2).toContain("useBillingController()");
    expect(V1).toContain("useBillingController()");
  });

  it("owns no charge path of its own", () => {
    for (const fn of ["createPortalSession", "createCheckoutSession", "removePaymentMethod", "openCardWidget"]) {
      expect(V2, fn).not.toContain(fn);
    }
  });

  it("routes every card control through the gate that asks before it charges", () => {
    expect(V2.match(/handleManagePayment\("manage"\)/g) ?? []).toHaveLength(2);
    expect(V2.match(/handleManagePayment\("invoices"\)/g) ?? []).toHaveLength(1);
    // The only raw open is the confirmation's own Confirm.
    expect(V2.match(/openCardPage\(/g) ?? []).toHaveLength(1);
  });

  it("mounts both money confirmations with every prop", () => {
    const change = V2.slice(V2.indexOf("<CardChangeConfirmModal"), V2.indexOf("{c.removeConfirmOpen"));
    expect(change).toContain("settleCents={c.settleCents}");
    expect(change).toContain("pending={c.portalLoadingSource !== null}");
    expect(change).toContain("problem={c.settleProblem?.problem ?? null}");
    const remove = V2.slice(V2.indexOf("<CardRemoveConfirmModal"), V2.indexOf("{target !== null"));
    expect(remove).toContain("consequence={c.removeConsequence}");
    expect(remove).toContain("pending={c.removePending}");
    expect(remove).toContain("c.handleRemoveCard()");
  });
});

describe("the prepaid / postpaid switch", () => {
  const request = V2.slice(V2.indexOf("function requestSwitch("), V2.indexOf("async function runSwitch("));
  const run = V2.slice(V2.indexOf("async function runSwitch("), V2.indexOf("async function toggleAutoTopup("));

  it("asks before a switch to prepaid that charges what is owed", () => {
    expect(request).toContain('next === "prepaid" && c.settleCents !== null');
    expect(request).toContain("setTarget(next)");
    // Nothing owed switches straight away.
    expect(request).toContain("void runSwitch(next)");
  });

  it("names the amount from the same derivation the card controls read", () => {
    expect(V2).toContain("settleCents={c.settleCents}");
    expect(V2).not.toContain("cardChangeSettleCents(");
  });

  it("refuses postpaid on the page when billing would stop the campaigns", () => {
    expect(V2).toContain("const blocker = postpaidBlocker(account);");
    expect(V2).toContain("disabled={switching || blocked !== null}");
  });

  it("renders a sentence per refusal, never the raw error", () => {
    expect(run).toContain("paymentModeRefusalMessage(status, body.code, owed)");
    expect(run).not.toContain("err.message");
    expect(V2).not.toContain("err instanceof Error ? err.message");
  });

  it("re-reads the account AND the payments after a switch, and never reloads", () => {
    expect(V2).toContain('refetchQueries({ queryKey: ["billingAccount"] })');
    expect(V2).toContain('refetchQueries({ queryKey: ["billingPayments"] })');
    expect(V2).not.toContain("location.reload");
    // The confirmation stays up until the fresh answer lands.
    expect(run.lastIndexOf("setTarget(null)")).toBeGreaterThan(run.indexOf("await refetchMoney()"));
  });

  it("reads the mode off the account billing already serves", () => {
    expect(API).toContain('payment_mode?: "prepaid" | "postpaid";');
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
