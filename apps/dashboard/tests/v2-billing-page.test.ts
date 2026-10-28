import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paymentModeOf } from "../src/lib/payment-mode";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const V2 = read("src/components/v2/billing-page.tsx");
const ROUTE = read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/billing/page.tsx");
const API = read("src/lib/api.ts");
const HERO = read("src/components/v2/balance-hero.tsx");

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
    // Banner Update card, postpaid banner Retry, Change card, Add card.
    expect(V2.match(/handleManagePayment\("manage"\)/g) ?? []).toHaveLength(4);
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
    expect(HERO).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl/);
    expect(V2).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl/);
  });

  it("carries no em-dash in its copy", () => {
    const code = V2.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("—");
  });
});

describe("prepaid automatic reload is required once on (owner 2026-10-11)", () => {
  it("offers no off switch to a prepaid org whose reload is on, and says how to stop it", () => {
    expect(V2).toContain('{!(mode === "prepaid" && c.hasAutoTopup) && (');
    expect(V2).toContain("To stop it, remove your card.");
  });
});

describe("a postpaid org reads postpaid words only (owner 2026-10-21)", () => {
  it("offers postpaid no auto top-up switch: the switch card is prepaid-only", () => {
    const auto = V2.slice(V2.indexOf("{/* Auto top-up, in the words of the mode it serves. */}"), V2.indexOf('id="monthly-limit"'));
    expect(auto).toContain('{mode === "prepaid" && account?.has_payment_method && c.autoReloadSupported && (');
    expect(auto).toContain('role="switch"');
    expect(auto).not.toContain('mode === "postpaid"');
  });

  it("shows postpaid its next automatic payment, Google Ads style, with NO button (owner 2026-10-21)", () => {
    const balance = V2.slice(V2.indexOf('id="balance"'), V2.indexOf("{/* The monthly plan, for an org on one"));
    expect(balance).toContain("<PostpaidOwedCard");
    expect(balance).toContain("charging={!!account?.has_payment_method && c.autoReloadSupported}");
    const card = HERO.slice(HERO.indexOf("function PostpaidOwedCard("), HERO.indexOf("function CreditBalanceCard("));
    expect(card).toContain("Your next automatic payment is on ${nextChargeDate}, or sooner when your billed costs reach");
    expect(card).not.toContain("<button");
    expect(card).not.toContain("credit line");
    expect(card).not.toContain("top-up");
    expect(card).not.toContain("Add credit");
  });

  it("has no Pay now anywhere on the page: a declined postpaid card is fixed by changing it", () => {
    expect(V2).not.toContain("payBalance");
    expect(V2).not.toContain("payNow");
    expect(V2).toContain('? c.handleManagePayment("manage")');
  });

  it("reads the credit line and the amount owed from billing's own fields, never the auto top-up columns", () => {
    const CTRL = read("src/components/billing/use-billing-controller.ts");
    expect(CTRL).not.toContain("Math.abs(account?.topup_threshold_cents");
    expect(V2).not.toContain("c.creditLineCents");
  });

  it("Add credit (button, section, banner) is prepaid only", () => {
    expect(V2).toContain('{mode === "prepaid" && !c.hasAutoTopup && !c.accountPending && (');
    expect(V2).toContain('{!c.accountPending && !c.hasAutoTopup && mode === "prepaid" && (');
    expect(V2).toContain('{mode === "prepaid" && c.isDepleted && (');
  });
});

describe("Billing Usage shows the same moment as Billed (BILLING-PAGE-COHERENT-1021)", () => {
  const page = readFileSync(join(__dirname, "..", "src/components/v2/billing-page.tsx"), "utf8");
  const usage = page.slice(page.indexOf("function UsageSection("));

  it("hands Usage the top's Billed and Set aside", () => {
    expect(page).toContain(
      "<UsageSection billedCents={c.confirmedChargesCents} setAsideCents={c.provisionedChargesCents} />",
    );
  });

  it("polls, and re-reads fast while its totals differ from the top", () => {
    expect(usage).toContain("const base = pollIntervalFor(query);");
    expect(usage).toContain("formatBillingCents(usdToCents(served.totalBilledUsd)) !== formatBillingCents(billedCents)");
    expect(usage).toContain("formatBillingCents(usdToCents(served.totalSetAsideUsd)) !== formatBillingCents(setAsideCents)");
    expect(usage).toContain("return behind ? USAGE_CATCH_UP_MS : base;");
  });

  it("keeps a NEGATIVE account adjustment row and shows what we cover", () => {
    expect(usage).toContain("Math.abs(usdToCents(cat.billedUsd)) >= 0.5");
    expect(usage).toContain("Covered by us: {formatBillingCents(coveredCents)}, on the house.");
  });
});

describe("Balance = one figure per mode, its parts on one bar (owner 2026-10-29)", () => {
  it("no longer draws the four equal KPI cells", () => {
    expect(V2).not.toContain('label: "Set aside"');
    expect(V2).not.toContain('label: "Total credits"');
    expect(V2).not.toContain("set aside");
  });

  it("measures the early charge on BILLED only: provisioned money is never charged (owner 2026-10-29)", () => {
    const card = HERO.slice(HERO.indexOf("function PostpaidOwedCard("), HERO.indexOf("function CreditBalanceCard("));
    expect(card).toContain("<StackedBar parts={[billed]} totalCents={line} />");
    expect(card).not.toContain("availableCents");
  });

  it("names the held money Provisioned, with its (i), in every mode", () => {
    expect(HERO.match(/label: "Provisioned"[^}]*tip: PROVISIONED_TIP/g) ?? []).toHaveLength(2);
  });
});
