import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The card-setup descriptor is the provider's contract, not ours.
 *
 * stripe-service DESCRIBES the mechanism rather than performing it, because the
 * two acquirers genuinely differ: one hosts a page we redirect to, the other
 * saves a card only through a field the page mounts itself. This page switches
 * on `mode` and renders what it is told.
 *
 * These guards exist because the type here has already drifted from the wire
 * once: it declared a `public_key` that the provider had REMOVED, and nothing
 * went red — a field a reader declares and the producer never sends simply
 * reads `undefined` forever.
 */

const REPO = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

const api = read("apps/dashboard/src/lib/api.ts");
const widget = read("apps/dashboard/src/lib/card-setup-widget.ts");
const billing = read(
  "apps/dashboard/src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx",
);

describe("the descriptor matches what the provider deploys", () => {
  it("carries the fields the provider sends", () => {
    for (const field of ["script_url", "environment", "token", "save_payment_method_for"]) {
      expect(api, `CardSetup must declare ${field}`).toContain(field);
    }
  });

  it("holds no merchant key", () => {
    // Removed at the provider in v0.48.0: the publishable key belongs to the
    // entry points that CANNOT save a card, so this flow has no use for it. A
    // field the page does not need is a credential it should not hold.
    //
    // Asserted against a COMMENT-STRIPPED copy: the declaration explains that
    // the field was removed and why, so a raw check fails on the very sentence
    // that records the decision.
    const at = api.indexOf("export type CardSetup =");
    const decl = api
      .slice(at, api.indexOf("export async function createPortalSession", at))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(decl).not.toContain("public_key");
  });
});

describe("the page renders the mechanism rather than choosing one", () => {
  it("branches on mode", () => {
    expect(billing).toContain('setup.mode === "hosted_redirect"');
  });

  it("passes the environment through instead of assuming it", () => {
    // Initialising the SDK against the wrong environment fails on a token that
    // is perfectly valid, which reads as a broken card form.
    expect(billing).toContain("environment: setup.environment,");
    expect(widget).toContain("RevolutCheckout(options.token, options.environment)");
    expect(widget).not.toContain('RevolutCheckout(options.token, "prod")');
  });

  it("asks for the save on behalf of the MERCHANT, from the server's answer", () => {
    // A card saved for the customer's own checkouts cannot be charged with
    // nobody on the page, so automatic top-up could never use it.
    expect(billing).toContain("savePaymentMethodFor: setup.save_payment_method_for");
  });

  it("re-reads rather than assuming the card landed", () => {
    // The card only exists at the provider once the widget's success fires, and
    // the provider has already accepted this request once while doing nothing.
    const at = billing.indexOf("openCardWidget({");
    const call = billing.slice(at, billing.indexOf("} catch", at));
    expect(call).toContain("onSuccess");
    expect(call).toContain("window.location.reload()");
  });

  it("surfaces the provider's own reason for a refusal", () => {
    // A generic "could not save the card" tells nobody anything.
    expect(widget).toContain("options.onError(detail");
  });
});
