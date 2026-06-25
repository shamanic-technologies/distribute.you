import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Guards the "insufficient credit → in-modal Embedded Checkout" flow:
//  - the add-credit modal is mounted in the onboarding tree (apiCall auto-fires it on 402)
//  - card capture is the in-page Stripe Embedded Checkout (no hosted-page redirect)
//  - onboarding treats a 402 as recoverable (no destructive reset) and resumes the
//    failed step on the `billing:resolved` event
const read = (p: string) => fs.readFileSync(path.join(__dirname, p), "utf-8");

describe("onboarding add-credit modal mount", () => {
  const layout = read("../src/app/(authed)/onboarding/layout.tsx");
  it("mounts BillingGuardProvider in the onboarding layout", () => {
    expect(layout).toContain('import { BillingGuardProvider } from "@/lib/billing-guard"');
    expect(layout).toContain("<BillingGuardProvider>");
  });
});

describe("embedded checkout API helper", () => {
  const api = read("../src/lib/api.ts");
  it("exposes createEmbeddedCheckoutSession posting ui_mode embedded", () => {
    expect(api).toContain("export async function createEmbeddedCheckoutSession");
    expect(api).toContain('ui_mode: "embedded"');
    expect(api).toContain('"/billing/checkout-sessions"');
  });
  it("exposes isInsufficientCredit keyed on a 402 ApiError", () => {
    expect(api).toContain("export function isInsufficientCredit");
    expect(api).toContain("err.status === 402");
  });
});

describe("billing-guard in-modal embedded checkout", () => {
  const guard = read("../src/lib/billing-guard.tsx");
  it("renders Stripe Embedded Checkout in the modal", () => {
    expect(guard).toContain('from "@stripe/react-stripe-js"');
    expect(guard).toContain("<EmbeddedCheckout />");
    expect(guard).toContain("createEmbeddedCheckoutSession");
  });
  it("dispatches billing:resolved so blocked callers can resume", () => {
    expect(guard).toContain('new CustomEvent("billing:resolved")');
  });
  it("no longer redirects to a hosted Stripe Checkout page", () => {
    expect(guard).not.toContain("window.location.href = session.url");
    expect(guard).not.toContain("createCheckoutSession");
  });
});

describe("onboarding 402 recovery", () => {
  const ob = read("../src/components/onboarding/onboarding.tsx");
  it("listens for billing:resolved and retries the failed step", () => {
    expect(ob).toContain('addEventListener("billing:resolved"');
    expect(ob).toContain("creditRetryRef");
  });
  it("treats a 402 as recoverable instead of resetting the step", () => {
    expect(ob).toContain("isInsufficientCredit(err)");
  });
});
