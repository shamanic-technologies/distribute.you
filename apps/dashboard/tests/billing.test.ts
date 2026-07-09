import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const proxyPath = path.resolve(__dirname, "../src/app/(authed)/api/v1/[...path]/route.ts");
const billingPagePath = path.resolve(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx");
const billingGuardPath = path.resolve(__dirname, "../src/lib/billing-guard.tsx");
const layoutPath = path.resolve(__dirname, "../src/app/(authed)/(dashboard)/layout.tsx");
const sidebarPath = path.resolve(__dirname, "../src/components/context-sidebar.tsx");

describe("Billing API wrappers", () => {
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should export getBillingAccount function", () => {
    expect(content).toContain("export async function getBillingAccount");
    expect(content).toContain("/billing/accounts");
  });

  it("should export getBillingBalance function", () => {
    expect(content).toContain("export async function getBillingBalance");
    expect(content).toContain("/billing/accounts/balance");
  });

  it("should NOT export listBillingTransactions (endpoint removed from api-service)", () => {
    expect(content).not.toContain("listBillingTransactions");
    expect(content).not.toContain("/billing/accounts/transactions");
  });

  it("should NOT export BillingTransaction interface (endpoint removed)", () => {
    expect(content).not.toMatch(/export interface BillingTransaction\b/);
  });

  it("should export configureAutoTopup function using PATCH /auto_topup", () => {
    expect(content).toContain("export async function configureAutoTopup");
    expect(content).toContain("/billing/accounts/auto_topup");
    expect(content).toContain('"PATCH"');
  });

  it("should export disableAutoTopup function using DELETE /auto_topup", () => {
    expect(content).toContain("export async function disableAutoTopup");
    expect(content).toContain("/billing/accounts/auto_topup");
    expect(content).toContain('"DELETE"');
  });

  it("should send topup_amount_cents / topup_threshold_cents in configureAutoTopup body", () => {
    expect(content).toContain("topup_amount_cents");
    expect(content).toContain("topup_threshold_cents");
  });

  it("should NOT reference legacy auto-reload endpoint paths, functions, or reload_*_cents body fields", () => {
    // The current write path is /auto_topup (configureAutoTopup / disableAutoTopup).
    // billing-service v0.40.0+ adds a READ-ONLY `auto_reload_supported` contract field
    // (off_session unavailable for some card-issuing countries) — that underscore field
    // is allowed; only the legacy /auto_reload endpoint family + reload_*_cents body is banned.
    expect(content).not.toContain("/billing/accounts/auto_reload");
    expect(content).not.toContain("/billing/accounts/auto-reload");
    expect(content).not.toContain("reload_amount_cents");
    expect(content).not.toContain("reload_threshold_cents");
    expect(content).not.toContain("configureAutoReload");
    expect(content).not.toContain("disableAutoReload");
  });

  it("should NOT have switchBillingMode (removed endpoint)", () => {
    expect(content).not.toContain("switchBillingMode");
    expect(content).not.toContain("/billing/accounts/mode");
  });

  it("should NOT have billingMode in BillingAccount interface", () => {
    expect(content).toContain("export interface BillingAccount");
    expect(content).not.toContain("billingMode");
  });

  it("should NOT have billing_mode in BillingBalance interface", () => {
    expect(content).toContain("export interface BillingBalance");
    expect(content).not.toContain("billing_mode");
  });

  it("should export createCheckoutSession with topup_amount_cents body", () => {
    expect(content).toContain("export async function createCheckoutSession");
    expect(content).toContain("/billing/checkout-sessions");
    expect(content).toContain("topup_amount_cents: number");
  });

  it("should export setupBillingWallet for first-load match wallet setup", () => {
    expect(content).toContain("export async function setupBillingWallet");
    expect(content).toContain("/billing/accounts/wallet_setup");
    expect(content).toContain("initial_load_amount_cents: number");
    expect(content).toContain("first_load_match_applied: boolean");
    expect(content).toContain("first_load_match_cents: string");
  });

  it("should export createPortalSession function", () => {
    expect(content).toContain("export async function createPortalSession");
    expect(content).toContain("/billing/portal-sessions");
  });

  it("should support PATCH and DELETE methods in ApiOptions", () => {
    expect(content).toMatch(/method\?:.*"PATCH"/);
    expect(content).toMatch(/method\?:.*"DELETE"/);
  });

  // BillingAccount response shape — billing-service post-rename hotfix.
  // balance_cents = spendable, actual_balance_cents = user-facing actual-only credit balance.
  it("should expose BillingAccount fields in snake_case (post-rename wire shape)", () => {
    expect(content).toContain("id: string");
    expect(content).toContain("org_id: string");
    expect(content).toContain("credited_cents: string");
    expect(content).toContain("usage_cents: string");
    expect(content).toContain("balance_cents: string");
    expect(content).toContain("actual_balance_cents?: string");
    expect(content).toContain("topup_amount_cents: number | null");
    expect(content).toContain("topup_threshold_cents: number | null");
    expect(content).toContain("has_payment_method: boolean");
    expect(content).toContain("has_auto_topup: boolean");
    expect(content).toContain("created_at: string");
    expect(content).toContain("updated_at: string");
  });

  it("should NOT keep legacy available_cents field on BillingAccount", () => {
    expect(content).not.toContain("available_cents");
  });

  it("should NOT keep legacy camelCase BillingAccount fields", () => {
    expect(content).not.toContain("grantsCents");
    expect(content).not.toContain("runsSpentCents");
    expect(content).not.toContain("availableCents");
    expect(content).not.toContain("hasAutoReload");
    expect(content).not.toContain("reloadAmountCents");
    expect(content).not.toContain("reloadThresholdCents");
    expect(content).not.toContain("creditBalanceCents");
  });
});

describe("API proxy PATCH and DELETE support", () => {
  const content = fs.readFileSync(proxyPath, "utf-8");

  it("should export PATCH handler", () => {
    expect(content).toContain("export async function PATCH");
  });

  it("should export DELETE handler", () => {
    expect(content).toContain("export async function DELETE");
  });
});

describe("402 Payment Required handling", () => {
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  it("should detect 402 status in apiCall and dispatch payment-required event", () => {
    expect(apiContent).toContain("response.status === 402");
    expect(apiContent).toContain("dispatchPaymentRequired");
  });

  it("should only dispatch on client-side (typeof window check)", () => {
    expect(apiContent).toContain('typeof window !== "undefined"');
  });
});

describe("Billing guard provider", () => {
  it("should exist", () => {
    expect(fs.existsSync(billingGuardPath)).toBe(true);
  });

  const content = fs.readFileSync(billingGuardPath, "utf-8");

  it("should listen for billing:payment-required custom events", () => {
    expect(content).toContain("billing:payment-required");
    expect(content).toContain("addEventListener");
  });

  it("should export BillingGuardProvider and dispatchPaymentRequired", () => {
    expect(content).toContain("export function BillingGuardProvider");
    expect(content).toContain("export function dispatchPaymentRequired");
  });

  it("should render a modal with insufficient credits message or proactive warning", () => {
    expect(content).toContain("Insufficient Credits");
    expect(content).toContain("Keep the wallet funded.");
  });

  it("should offer quick top-up amount buttons in the modal", () => {
    // Presets are sized to N days of the in-scope brand's daily budget.
    expect(content).toContain("topupPresetsForDailyBudget");
    expect(content).toContain("presetAmounts");
    expect(content).toContain("selectedAmount");
  });

  it("should capture the card via in-modal Embedded Checkout (no hosted-page redirect)", () => {
    expect(content).toContain("createEmbeddedCheckoutSession");
    expect(content).toContain("<EmbeddedCheckout />");
    expect(content).toContain("handleCheckout");
    expect(content).not.toContain("window.location.href = session.url");
  });

  it("should clean up event listener on unmount", () => {
    expect(content).toContain("removeEventListener");
  });
});

describe("Billing guard wired into layout", () => {
  const content = fs.readFileSync(layoutPath, "utf-8");

  it("should import and wrap with BillingGuardProvider", () => {
    expect(content).toContain("BillingGuardProvider");
    expect(content).toContain("<BillingGuardProvider>");
    expect(content).toContain("</BillingGuardProvider>");
  });
});

describe("Billing page", () => {
  it("should exist at orgs/[orgId]/billing/page.tsx", () => {
    expect(fs.existsSync(billingPagePath)).toBe(true);
  });

  const content = fs.readFileSync(billingPagePath, "utf-8");

  it("should be a client component", () => {
    expect(content).toContain('"use client"');
  });

  it("should NOT reference billingMode or switchBillingMode", () => {
    expect(content).not.toContain("billingMode");
    expect(content).not.toContain("switchBillingMode");
    expect(content).not.toContain("ModeBadge");
    expect(content).not.toContain("Billing Mode");
  });

  it("should NOT reference removed listBillingTransactions / BillingTransaction / Payments tab", () => {
    expect(content).not.toContain("listBillingTransactions");
    expect(content).not.toContain("BillingTransaction");
    expect(content).not.toContain("Transaction History");
    expect(content).not.toContain('"payments"');
  });

  it("should read has_auto_topup from snake_case response", () => {
    expect(content).toContain("has_auto_topup");
  });

  it("should use configureAutoTopup to enable auto-topup", () => {
    expect(content).toContain("configureAutoTopup");
  });

  it("should use disableAutoTopup when user unchecks auto-topup", () => {
    expect(content).toContain("disableAutoTopup");
  });

  it("should NOT reference legacy configureAutoReload / disableAutoReload", () => {
    expect(content).not.toContain("configureAutoReload");
    expect(content).not.toContain("disableAutoReload");
  });

  it("should render a reconciling credit-balance breakdown (Available + Total/Confirmed/Provisioned)", () => {
    // The single gross "Credit Balance" number was replaced by a breakdown whose
    // lines reconcile (Total - Confirmed - Provisioned == Available).
    expect(content).toContain("availableCents");
    expect(content).toContain("totalCreditsCents");
    expect(content).toContain("confirmedChargesCents");
    expect(content).toContain("provisionedChargesCents");
    // Derived from all three locked billing fields.
    expect(content).toContain("balance_cents");
    expect(content).toContain("credited_cents");
    expect(content).toContain("actual_balance_cents");
    // Visible labels.
    expect(content).toContain("Available");
    expect(content).toContain("Total credits");
    expect(content).toContain("Confirmed charges");
    expect(content).toContain("Provisioned charges");
    // The prominent number is the spendable balance, not the gross actual balance.
    expect(content).not.toContain("Credit Balance</p>");
  });

  it("should show depleted warning keyed on AVAILABLE balance (balance_cents), not the gross actual balance", () => {
    expect(content).toContain("isDepleted");
    expect(content).toContain("Credits depleted");
    // isDepleted now keys on availableCents (= balance_cents), so the warning fires
    // when spending is actually blocked even with a positive gross total.
    expect(content).toMatch(/isDepleted\s*=\s*account\s*\?\s*!hasAutoTopup\s*&&\s*availableCents\s*<=\s*0/);
  });

  it("should give each breakdown line an info tooltip with no em-dash", () => {
    expect(content).toContain("InfoTooltip");
    // Tooltip copy present (humanizer-clean, plain language).
    expect(content).toContain("Everything added to your account, including top-ups.");
    expect(content).toContain("Emails already sent and billed. This won't change.");
    expect(content).toContain("Reserved for follow-up emails we've scheduled.");
    // The user-facing breakdown copy uses a real minus glyph (&minus;) for charges,
    // never an em-dash. (Code comments are exempt from the em-dash rule.)
    expect(content).toContain("&minus;");
  });

  it("should show top-up flow when auto-topup is not configured", () => {
    // Presets are sized to N days of the org's combined daily burn.
    expect(content).toContain("topupPresetsForDailyBudget");
    expect(content).toContain("presetAmounts");
    expect(content).toContain("Add Credits");
    expect(content).toContain("handleTopup");
  });

  it("should show a READ-ONLY next-charge status when auto-topup is configured (no editable amount/threshold — derived server-side)", () => {
    // Auto-topup amount + credit-line floor are DERIVED (billing-service tier
    // ladder), so the page shows the upcoming charge, not editable inputs.
    expect(content).toContain("Next charge");
    expect(content).toContain("spentSinceChargeCents");
    expect(content).toContain("creditLineCents");
    expect(content).toContain("chargePct");
    expect(content).toContain("nextChargeDate");
    expect(content).toContain("handleDisableTopup");
    expect(content).toContain("Disable auto-topup");
    // The old editable-config UI is gone.
    expect(content).not.toContain("editingTopup");
    expect(content).not.toContain("handleSaveTopup");
    expect(content).not.toContain("Save changes");
  });

  it("should show the month-end sweep guarantee date on the next-charge line", () => {
    expect(content).toContain("lastDayOfMonthLabel");
    expect(content).toContain("or on ");
  });

  it("should integrate auto-topup as a checkbox (no amount/threshold inputs) inside the Add Credits card", () => {
    expect(content).toContain("enableAutoTopup");
    expect(content).toContain("Enable auto-topup");
    // Amount + threshold are derived server-side — no user-editable input STATE
    // remains (the derived display value topupAmountCents is fine).
    expect(content).not.toContain("setTopupAmount");
    expect(content).not.toContain("setTopupThreshold");
    expect(content).not.toContain("topupThreshold");
  });

  it("should default the auto-topup checkbox to on", () => {
    expect(content).toContain("useState(true)");
  });

  it("should only save auto-topup before checkout when payment method exists", () => {
    expect(content).toContain("account?.has_payment_method");
    expect(content).toContain("configureAutoTopup");
  });

  it("should pass pending auto-topup params via URL when no payment method", () => {
    expect(content).toContain("pending_topup");
    expect(content).toContain("pending_threshold");
  });

  it("should save auto-topup on successful return from Stripe", () => {
    expect(content).toContain("showSuccess && pendingTopup");
    expect(content).toContain("configureAutoTopup(topupCents, thresholdCents)");
  });

  it("should NOT have auto-topup amount/threshold blur validators (fields removed — derived server-side)", () => {
    expect(content).not.toContain("handleThresholdBlur");
    expect(content).not.toContain("handleTopupAmountBlur");
    expect(content).not.toContain("thresholdError");
    expect(content).not.toContain("topupAmountError");
  });

  it("should show inline error on blur when custom amount is below $10", () => {
    expect(content).toContain("handleCustomAmountBlur");
    expect(content).toContain("Minimum top-up is $10.");
    expect(content).toContain("customAmountError");
    expect(content).toContain("onBlur={handleCustomAmountBlur}");
  });

  it("should disable Add Credits button when validation errors exist", () => {
    expect(content).toContain("hasValidationError");
  });

  it("should select a one-off top-up amount via handleSelectTopup", () => {
    expect(content).toContain("handleSelectTopup");
    expect(content).toContain("setTopupSelected");
  });

  it("should arm the auto-topup enabled flag with fixed derived-tier placeholder values", () => {
    // The stored amount/threshold are only the "enabled" flag; the real values
    // are derived server-side, so the page sends fixed placeholders.
    expect(content).toContain("AUTO_TOPUP_ENABLE_AMOUNT_CENTS");
    expect(content).toContain("AUTO_TOPUP_ENABLE_THRESHOLD_CENTS");
  });

  it("should redirect to Stripe checkout via createCheckoutSession", () => {
    expect(content).toContain("createCheckoutSession");
    expect(content).toContain("session.url");
  });

  it("should have a manage payment method button", () => {
    expect(content).toContain("handleManagePayment");
    expect(content).toContain("Manage payment method");
    expect(content).toContain("createPortalSession");
  });

  it("should have loading skeleton state", () => {
    expect(content).toContain("animate-pulse");
    expect(content).toContain("accountLoading");
  });
});

describe("Billing guard auto-topup in modal", () => {
  const content = fs.readFileSync(billingGuardPath, "utf-8");

  it("should import configureAutoTopup (no customer disable; admin-only)", () => {
    expect(content).toContain("configureAutoTopup");
    expect(content).not.toContain("disableAutoTopup");
  });

  it("should NOT import legacy configureAutoReload / disableAutoReload", () => {
    expect(content).not.toContain("configureAutoReload");
    expect(content).not.toContain("disableAutoReload");
  });

  it("should have auto-topup toggle with enableAutoTopup state", () => {
    expect(content).toContain("enableAutoTopup");
    expect(content).toContain("Enable auto-topup");
  });

  it("should have top-up amount and threshold inputs", () => {
    expect(content).toContain("topupAmount");
    expect(content).toContain("topupThreshold");
    expect(content).toContain("Top-up amount ($)");
    expect(content).toContain("When balance below ($)");
  });

  it("should validate minimum top-up amount ($10) and threshold ($5)", () => {
    expect(content).toContain("Minimum top-up amount is $10.");
    expect(content).toContain("Minimum threshold is $5.");
  });

  it("should support custom top-up amount input", () => {
    expect(content).toContain("customAmount");
    expect(content).toContain("Custom amount ($)");
    expect(content).toContain("Minimum top-up is $10.");
  });

  it("should support proactive mode with an inspiring, sell-forward title and description", () => {
    expect(content).toContain("proactive");
    expect(content).toContain("Keep the wallet funded.");
    expect(content).toContain("Your credits live in an org-level wallet.");
  });

  it("should frame the proactive budget as a brand daily budget cap, not a campaign price", () => {
    expect(content).toContain("Brand daily budget cap");
    expect(content).toContain("/ day");
    expect(content).not.toContain("/ cycle");
    expect(content).not.toContain("Campaign May Exceed Credits");
    expect(content).not.toContain("Recurring Campaign Needs Auto-Topup");
  });

  it("should allow configuring auto-topup without checkout in proactive mode", () => {
    expect(content).toContain("handleSetupAutoTopupOnly");
    expect(content).toContain("Turn on auto-top-up");
    expect(content).toContain("onAutoTopupConfigured");
  });

  it("should center the proactive modal on auto-topup config", () => {
    // Add Credits presets are hard-block (non-proactive) only.
    expect(content).toContain("!isProactive");
    expect(content).toContain("Turn on auto-top-up");
  });

  it("should fund the top-up via embedded checkout for the chosen amount", () => {
    expect(content).toContain("createEmbeddedCheckoutSession(effectiveAmountCents)");
    expect(content).not.toContain('mode: "setup"');
  });

  it("should fetch billing account when modal opens to pre-fill auto-topup config", () => {
    expect(content).toContain("getBillingAccount");
    expect(content).toContain("setAccount(acct)");
  });

  it("should signal callers to resume after credit is added (embedded onComplete / auto-topup)", () => {
    expect(content).toContain("info.proactive");
    expect(content).toContain("handleEmbeddedComplete");
    expect(content).toContain('new CustomEvent("billing:resolved")');
    expect(content).toContain("info.onComplete");
  });
});

// The org-scoped launch proactive-credit-check block was removed with the manual
// launch/create flow.

// Pure invariant test for the breakdown math the billing page derives inline.
// Mirrors the page formulas (cents, full-precision decimal strings):
//   Available           = balance_cents
//   Total credits       = credited_cents
//   Confirmed charges   = credited_cents - actual_balance_cents
//   Provisioned charges = actual_balance_cents - balance_cents
// Invariant: Total - Confirmed - Provisioned == Available.
function breakdown(creditedCents: string, actualBalanceCents: string, balanceCents: string) {
  const total = parseFloat(creditedCents);
  const actual = parseFloat(actualBalanceCents);
  const available = parseFloat(balanceCents);
  return {
    total,
    available,
    confirmed: total - actual,
    provisioned: actual - available,
  };
}

describe("Credit-balance breakdown math", () => {
  it("reconciles: Total - Confirmed - Provisioned == Available (worked example: $19 - $12.03 - $6.98 = -$0.01)", () => {
    // credited=$19.00, actual_balance=$6.97, balance(available)=-$0.01
    const b = breakdown("1900", "697", "-1");
    expect(b.total).toBe(1900);
    expect(b.confirmed).toBe(1203); // $12.03
    expect(b.provisioned).toBe(698); // $6.98
    expect(b.available).toBe(-1); // -$0.01
    expect(b.total - b.confirmed - b.provisioned).toBeCloseTo(b.available, 6);
  });

  it("holds for an arbitrary positive-available case", () => {
    const b = breakdown("5000", "4200", "3500");
    expect(b.confirmed).toBe(800);
    expect(b.provisioned).toBe(700);
    expect(b.total - b.confirmed - b.provisioned).toBeCloseTo(b.available, 6);
  });

  it("holds with full-precision decimal-string inputs", () => {
    const b = breakdown("1900.0000000000", "697.4200000000", "-0.5800000000");
    expect(b.total - b.confirmed - b.provisioned).toBeCloseTo(b.available, 6);
  });
});

describe("Billing sidebar link", () => {
  const content = fs.readFileSync(sidebarPath, "utf-8");

  it("should have billing link in org-level sidebar", () => {
    expect(content).toContain('"Billing"');
    expect(content).toContain('`/orgs/${orgId}/billing`');
  });

  it("should have a BillingIcon component", () => {
    expect(content).toContain("BillingIcon");
  });
});
