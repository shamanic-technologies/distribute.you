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
    expect(content).toContain("TOPUP_AMOUNTS");
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

  it("should show Available (balance_cents) as the prominent spendable number", () => {
    expect(content).toContain("availableCents");
    expect(content).toContain("account?.balance_cents");
    expect(content).toContain(">Available<");
    expect(content).toContain("formatBillingCents(availableCents)");
  });

  it("should render the reconciling credit breakdown (total/confirmed/provisioned)", () => {
    expect(content).toContain("totalCreditsCents");
    expect(content).toContain("confirmedChargesCents");
    expect(content).toContain("provisionedChargesCents");
    expect(content).toContain("account?.credited_cents");
    expect(content).toContain("actual_balance_cents");
    expect(content).toContain("Total credits");
    expect(content).toContain("Confirmed charges");
    expect(content).toContain("Provisioned charges");
  });

  it("should derive confirmed/provisioned from the locked field formulas", () => {
    // Confirmed = credited − actual_balance; Provisioned = actual_balance − available.
    expect(content).toContain(
      "parseFloat(totalCreditsCents) - parseFloat(actualBalanceCents)",
    );
    expect(content).toContain(
      "parseFloat(actualBalanceCents) - parseFloat(availableCents)",
    );
  });

  it("should give each breakdown line an info tooltip", () => {
    expect(content).toContain("function InfoTip");
    expect(content).toContain('role="tooltip"');
    // No em-dash (U+2014) in any user-facing string. Code comments are exempt
    // (CLAUDE.md), so strip // line-comments and /* */ + {/* */} block-comments first.
    const stripped = content
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(stripped).not.toContain("—");
  });

  it("should key depletion on AVAILABLE (balance_cents), not the gross actual balance", () => {
    expect(content).toContain("parseFloat(availableCents) <= 0");
    expect(content).not.toContain("parseFloat(creditBalanceCents)");
  });

  it("should show depleted warning", () => {
    expect(content).toContain("isDepleted");
    expect(content).toContain("Credits depleted");
  });

  it("should show top-up flow when auto-topup is not configured", () => {
    expect(content).toContain("TOPUP_AMOUNTS");
    expect(content).toContain("Add Credits");
    expect(content).toContain("handleTopup");
  });

  it("should show editable auto-topup section when already configured", () => {
    expect(content).toContain("editingTopup");
    expect(content).toContain("handleSaveTopup");
    expect(content).toContain("handleDisableTopup");
    expect(content).toContain("Save changes");
    expect(content).toContain("Disable auto-topup");
  });

  it("should integrate auto-topup as a checkbox inside the Add Credits card", () => {
    expect(content).toContain("enableAutoTopup");
    expect(content).toContain("Enable auto-topup");
    expect(content).toContain("topupAmount");
    expect(content).toContain("topupThreshold");
  });

  it("should pre-select auto-topup with $25 amount and $5 threshold by default", () => {
    expect(content).toContain("useState(true)");
    expect(content).toContain('useState("25")');
    expect(content).toContain('useState("5")');
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

  it("should show inline error on blur when threshold is below $5", () => {
    expect(content).toContain("handleThresholdBlur");
    expect(content).toContain("Minimum threshold is $5.");
    expect(content).toContain("thresholdError");
    expect(content).toContain("onBlur={handleThresholdBlur}");
  });

  it("should reset threshold to $5 when left empty on blur", () => {
    expect(content).toContain('setTopupThreshold("5")');
  });

  it("should reset top-up amount to selected value when left empty on blur", () => {
    expect(content).toContain("handleTopupAmountBlur");
    expect(content).toContain("onBlur={handleTopupAmountBlur}");
  });

  it("should show inline error on blur when top-up amount is below $10", () => {
    expect(content).toContain("topupAmountError");
    expect(content).toContain("Minimum top-up amount is $10.");
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

  it("should sync top-up amount when selecting a preset amount", () => {
    expect(content).toContain("handleSelectTopup");
    expect(content).toContain("setTopupAmount");
  });

  it("should default auto-topup threshold to $5 (500 cents)", () => {
    // Fallback threshold when not set by user
    expect(content).toContain(": 500");
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

describe("Credit breakdown math (Total − Confirmed − Provisioned = Available)", () => {
  // Mirrors the page derivation on the locked /v1/accounts fields. All math in fractional cents.
  function breakdown(creditedCents: string, actualBalanceCents: string, balanceCents: string) {
    const total = parseFloat(creditedCents);
    const actual = parseFloat(actualBalanceCents);
    const available = parseFloat(balanceCents);
    const confirmed = total - actual;
    const provisioned = actual - available;
    return { total, confirmed, provisioned, available };
  }

  it("reconciles the broke-but-positive worked example (-$0.01 available)", () => {
    // $19.00 total − $12.03 confirmed − $6.98 provisioned = -$0.01 available.
    const { total, confirmed, provisioned, available } = breakdown("1900", "697", "-1");
    expect(confirmed).toBeCloseTo(1203, 6);
    expect(provisioned).toBeCloseTo(698, 6);
    expect(available).toBeCloseTo(-1, 6);
    expect(total - confirmed - provisioned).toBeCloseTo(available, 6);
    // The reported contradiction: gross actual balance reads positive while available is negative.
    expect(parseFloat("697")).toBeGreaterThan(0);
    expect(available).toBeLessThan(0);
  });

  it("holds the identity for full-precision decimal strings", () => {
    const { total, confirmed, provisioned, available } = breakdown(
      "5000.4200000000",
      "1234.5600000000",
      "1000.0000000000",
    );
    expect(total - confirmed - provisioned).toBeCloseTo(available, 6);
  });

  it("reads provisioned as 0 when actual_balance is absent (actual := available)", () => {
    // Older billing deploy: actual_balance_cents missing -> fold holds into confirmed.
    const available = "300";
    const { confirmed, provisioned } = breakdown("1000", available, available);
    expect(provisioned).toBeCloseTo(0, 6);
    expect(confirmed).toBeCloseTo(700, 6);
  });
});
