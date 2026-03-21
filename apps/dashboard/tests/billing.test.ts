import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const proxyPath = path.resolve(__dirname, "../src/app/api/v1/[...path]/route.ts");
const billingPagePath = path.resolve(__dirname, "../src/app/(dashboard)/orgs/[orgId]/billing/page.tsx");
const billingGuardPath = path.resolve(__dirname, "../src/lib/billing-guard.tsx");
const layoutPath = path.resolve(__dirname, "../src/app/(dashboard)/layout.tsx");
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

  it("should export listBillingTransactions function", () => {
    expect(content).toContain("export async function listBillingTransactions");
    expect(content).toContain("/billing/accounts/transactions");
  });

  it("should export configureAutoReload function using PATCH", () => {
    expect(content).toContain("export async function configureAutoReload");
    expect(content).toContain("/billing/accounts/auto-reload");
    expect(content).toContain('"PATCH"');
  });

  it("should export disableAutoReload function using DELETE", () => {
    expect(content).toContain("export async function disableAutoReload");
    expect(content).toContain("/billing/accounts/auto-reload");
    expect(content).toContain('"DELETE"');
  });

  it("should NOT have switchBillingMode (removed endpoint)", () => {
    expect(content).not.toContain("switchBillingMode");
    expect(content).not.toContain("/billing/accounts/mode");
  });

  it("should NOT have billingMode in BillingAccount interface", () => {
    expect(content).toContain("export interface BillingAccount");
    expect(content).not.toContain("billingMode");
  });

  it("should have hasAutoReload in BillingAccount interface", () => {
    expect(content).toContain("hasAutoReload: boolean");
  });

  it("should NOT have billing_mode in BillingBalance interface", () => {
    expect(content).toContain("export interface BillingBalance");
    expect(content).not.toContain("billing_mode");
  });

  it("should export createCheckoutSession function", () => {
    expect(content).toContain("export async function createCheckoutSession");
    expect(content).toContain("/billing/checkout-sessions");
  });

  it("should export createPortalSession function", () => {
    expect(content).toContain("export async function createPortalSession");
    expect(content).toContain("/billing/portal-sessions");
  });

  it("should support PATCH and DELETE methods in ApiOptions", () => {
    expect(content).toMatch(/method\?:.*"PATCH"/);
    expect(content).toMatch(/method\?:.*"DELETE"/);
  });

  it("should export BillingAccount interface with required fields", () => {
    expect(content).toContain("creditBalanceCents");
    expect(content).toContain("hasPaymentMethod");
    expect(content).toContain("hasAutoReload");
    expect(content).toContain("reloadAmountCents");
    expect(content).toContain("reloadThresholdCents");
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

  it("should render a modal with insufficient credits message", () => {
    expect(content).toContain("Insufficient Credits");
  });

  it("should offer quick top-up amount buttons in the modal", () => {
    expect(content).toContain("TOPUP_AMOUNTS");
    expect(content).toContain("selectedAmount");
  });

  it("should redirect to Stripe checkout directly from the modal", () => {
    expect(content).toContain("createCheckoutSession");
    expect(content).toContain("handleCheckout");
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

  it("should use hasAutoReload from account response", () => {
    expect(content).toContain("hasAutoReload");
  });

  it("should use configureAutoReload to enable auto-reload", () => {
    expect(content).toContain("configureAutoReload");
  });

  it("should use disableAutoReload when user unchecks auto-reload", () => {
    expect(content).toContain("disableAutoReload");
  });

  it("should display credit balance", () => {
    expect(content).toContain("creditBalanceCents");
    expect(content).toContain("Credit Balance");
  });

  it("should show depleted warning", () => {
    expect(content).toContain("isDepleted");
    expect(content).toContain("Credits depleted");
  });

  it("should always show top-up flow", () => {
    expect(content).toContain("TOPUP_AMOUNTS");
    expect(content).toContain("Add Credits");
    expect(content).toContain("handleTopup");
  });

  it("should integrate auto-reload as a checkbox inside the Add Credits card", () => {
    expect(content).toContain("enableAutoReload");
    expect(content).toContain("Enable auto-reload");
    expect(content).toContain("reloadAmount");
    expect(content).toContain("reloadThreshold");
  });

  it("should pre-select auto-reload with $25 reload and $5 threshold by default", () => {
    expect(content).toContain('useState(true)');
    expect(content).toContain('useState("25")');
    expect(content).toContain('useState("5")');
  });

  it("should only save auto-reload before checkout when payment method exists", () => {
    expect(content).toContain("account?.hasPaymentMethod");
    expect(content).toContain("configureAutoReload");
  });

  it("should pass pending auto-reload params via URL when no payment method", () => {
    expect(content).toContain("pending_reload");
    expect(content).toContain("pending_threshold");
  });

  it("should save auto-reload on successful return from Stripe", () => {
    expect(content).toContain("showSuccess && pendingReload");
    expect(content).toContain("configureAutoReload(reloadCents, thresholdCents)");
  });

  it("should show inline error on blur when threshold is below $5", () => {
    expect(content).toContain("handleThresholdBlur");
    expect(content).toContain("Minimum threshold is $5.");
    expect(content).toContain("thresholdError");
    expect(content).toContain("onBlur={handleThresholdBlur}");
  });

  it("should reset threshold to $5 when left empty on blur", () => {
    expect(content).toContain('setReloadThreshold("5")');
  });

  it("should reset reload amount to topup value when left empty on blur", () => {
    expect(content).toContain("handleReloadAmountBlur");
    expect(content).toContain("onBlur={handleReloadAmountBlur}");
  });

  it("should show inline error on blur when reload amount is below $10", () => {
    expect(content).toContain("reloadAmountError");
    expect(content).toContain("Minimum reload amount is $10.");
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

  it("should only toggle auto-reload on checkbox click, not label text", () => {
    // No wrapping <label> — checkbox is inside a <div>, not a clickable label
    expect(content).not.toContain('<label className="flex items-start gap-3 cursor-pointer">');
  });

  it("should sync reload amount when selecting a top-up amount", () => {
    expect(content).toContain("handleSelectTopup");
    expect(content).toContain("setReloadAmount");
  });

  it("should default auto-reload threshold to $5 (500 cents)", () => {
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

  it("should display transaction history with color-coding", () => {
    expect(content).toContain("Transaction History");
    expect(content).toContain("text-red-600");
    expect(content).toContain("text-green-600");
  });

  it("should have loading skeleton state", () => {
    expect(content).toContain("animate-pulse");
    expect(content).toContain("accountLoading");
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
