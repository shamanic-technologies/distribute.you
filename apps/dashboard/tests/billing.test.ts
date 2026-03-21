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

  it("should export switchBillingMode function using PATCH", () => {
    expect(content).toContain("export async function switchBillingMode");
    expect(content).toContain("/billing/accounts/mode");
    expect(content).toContain('"PATCH"');
  });

  it("should export createCheckoutSession function", () => {
    expect(content).toContain("export async function createCheckoutSession");
    expect(content).toContain("/billing/checkout-sessions");
  });

  it("should export createPortalSession function", () => {
    expect(content).toContain("export async function createPortalSession");
    expect(content).toContain("/billing/portal-sessions");
    expect(content).toContain("return_url");
  });

  it("should support PATCH method in ApiOptions", () => {
    expect(content).toContain('"PATCH"');
    expect(content).toMatch(/method\?:.*"PATCH"/);
  });

  it("should export BillingAccount interface with required fields", () => {
    expect(content).toContain("export interface BillingAccount");
    expect(content).toContain("creditBalanceCents");
    expect(content).toContain("hasPaymentMethod");
    expect(content).toContain("reloadAmountCents");
    expect(content).toContain("reloadThresholdCents");
  });

  it("should export BillingTransaction interface with type field", () => {
    expect(content).toContain("export interface BillingTransaction");
    expect(content).toContain('"deduction"');
    expect(content).toContain('"credit"');
    expect(content).toContain('"reload"');
  });

  it("should support reload_threshold_cents in switchBillingMode", () => {
    expect(content).toContain("reloadThresholdCents");
    expect(content).toContain("reload_threshold_cents");
  });
});

describe("API proxy PATCH support", () => {
  const content = fs.readFileSync(proxyPath, "utf-8");

  it("should export PATCH handler", () => {
    expect(content).toContain("export async function PATCH");
  });

  it("should use the same proxyRequest for PATCH", () => {
    const patchBlock = content.slice(content.indexOf("export async function PATCH"));
    expect(patchBlock).toContain("proxyRequest");
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

  it("should pass balance_cents and required_cents from error body", () => {
    expect(apiContent).toContain("balance_cents");
    expect(apiContent).toContain("required_cents");
  });
});

describe("Billing guard provider", () => {
  it("should exist", () => {
    expect(fs.existsSync(billingGuardPath)).toBe(true);
  });

  const content = fs.readFileSync(billingGuardPath, "utf-8");

  it("should be a client component", () => {
    expect(content).toContain('"use client"');
  });

  it("should listen for billing:payment-required custom events", () => {
    expect(content).toContain("billing:payment-required");
    expect(content).toContain("addEventListener");
  });

  it("should export BillingGuardProvider component", () => {
    expect(content).toContain("export function BillingGuardProvider");
  });

  it("should export dispatchPaymentRequired function", () => {
    expect(content).toContain("export function dispatchPaymentRequired");
  });

  it("should render a modal with insufficient credits message", () => {
    expect(content).toContain("Insufficient Credits");
    expect(content).toContain("Add Credits");
  });

  it("should show balance info in the modal", () => {
    expect(content).toContain("Current balance");
    expect(content).toContain("Required");
  });

  it("should clean up event listener on unmount", () => {
    expect(content).toContain("removeEventListener");
  });
});

describe("Billing guard wired into layout", () => {
  const content = fs.readFileSync(layoutPath, "utf-8");

  it("should import BillingGuardProvider", () => {
    expect(content).toContain("BillingGuardProvider");
    expect(content).toContain("billing-guard");
  });

  it("should wrap DashboardContent with BillingGuardProvider", () => {
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

  it("should import billing API functions (no switchBillingMode in top-level imports)", () => {
    expect(content).toContain("getBillingAccount");
    expect(content).toContain("listBillingTransactions");
    expect(content).toContain("createCheckoutSession");
    expect(content).toContain("createPortalSession");
  });

  it("should use useAuthQuery for data fetching", () => {
    expect(content).toContain("useAuthQuery");
  });

  it("should NOT have mode switching UI (no BYOK/PAYG toggle)", () => {
    expect(content).not.toContain("handleModeSwitch");
    expect(content).not.toContain("ModeBadge");
    expect(content).not.toContain("Billing Mode");
    expect(content).not.toContain("Bring your own");
  });

  it("should display credit balance", () => {
    expect(content).toContain("creditBalanceCents");
    expect(content).toContain("Credit Balance");
  });

  it("should show depleted warning", () => {
    expect(content).toContain("isDepleted");
    expect(content).toContain("Credits depleted");
  });

  it("should show payment method status", () => {
    expect(content).toContain("hasPaymentMethod");
    expect(content).toContain("Card connected");
  });

  it("should always show top-up flow (not gated behind mode)", () => {
    expect(content).toContain("TOPUP_AMOUNTS");
    expect(content).toContain("Add Credits");
    expect(content).toContain("handleTopup");
    // Should NOT be conditionally rendered based on billingMode
    expect(content).not.toContain('billingMode === "payg"');
  });

  it("should redirect to Stripe checkout via createCheckoutSession", () => {
    expect(content).toContain("createCheckoutSession");
    expect(content).toContain("session.url");
  });

  it("should include success and cancel URLs for Stripe redirect", () => {
    expect(content).toContain("success_url");
    expect(content).toContain("cancel_url");
    expect(content).toContain("?success=true");
  });

  it("should handle success query param after Stripe redirect", () => {
    expect(content).toContain("useSearchParams");
    expect(content).toContain("Payment successful");
  });

  it("should integrate auto-reload as a checkbox inside the Add Credits card", () => {
    expect(content).toContain("enableAutoReload");
    expect(content).toContain("Enable auto-reload");
    expect(content).toContain("reloadAmount");
    expect(content).toContain("reloadThreshold");
    // Should NOT be in a separate card gated behind hasPaymentMethod
    expect(content).not.toContain("handleSaveReload");
  });

  it("should save auto-reload settings before Stripe redirect when enabled", () => {
    expect(content).toContain("enableAutoReload && reloadAmount");
    expect(content).toContain("switchBillingMode");
  });

  it("should pre-fill reload amount when selecting a top-up amount", () => {
    expect(content).toContain("handleSelectTopup");
  });

  it("should display transaction history with color-coding", () => {
    expect(content).toContain("Transaction History");
    expect(content).toContain("text-red-600");
    expect(content).toContain("text-green-600");
    expect(content).toContain("tx.type");
  });

  it("should have loading skeleton state", () => {
    expect(content).toContain("animate-pulse");
    expect(content).toContain("accountLoading");
  });

  it("should show custom amount input for top-up", () => {
    expect(content).toContain("customAmount");
    expect(content).toContain('placeholder="Custom $"');
  });

  it("should import and use createPortalSession", () => {
    expect(content).toContain("createPortalSession");
  });

  it("should have a manage payment method button", () => {
    expect(content).toContain("handleManagePayment");
    expect(content).toContain("Manage payment method");
  });

  it("should redirect to Stripe portal via createPortalSession", () => {
    expect(content).toContain("createPortalSession");
    expect(content).toContain("window.location.href");
  });


  it("should only show manage payment button when payment method exists", () => {
    expect(content).toContain("hasPaymentMethod");
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

  it("should highlight billing link when on billing page", () => {
    expect(content).toContain('pathname.startsWith(`/orgs/${orgId}/billing`)');
  });
});
