import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const PAGE = readFileSync(
  join(root, "src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"),
  "utf8",
);
const WIDGET = readFileSync(join(root, "src/lib/card-setup-widget.ts"), "utf8");

/**
 * Saving a card is the mirror of removing one, and it had the same defect.
 *
 * The cache is local-first: the persister restores from IndexedDB in an effect,
 * so a reload hands the FIRST FRAME to the previous visit's snapshot. On the
 * removal that meant the removed card lingered; here it meant a customer who had
 * just saved one was told they had no payment method, for the length of the cold
 * billing read. Same class, opposite direction.
 */
describe("the billing page re-reads after a card is saved, and never reloads", () => {
  it("reloads nowhere on the page", () => {
    expect(PAGE).not.toContain("location.reload");
  });

  it("re-reads every root saving a card moves", () => {
    const at = PAGE.indexOf("async function refreshAfterCardSaved(");
    expect(at).toBeGreaterThan(-1);
    const body = PAGE.slice(at, PAGE.indexOf("async function openCardPage(", at));
    // The card, the credit-line floor and the auto-topup state.
    expect(body).toContain('refetchQueries({ queryKey: ["billingAccount"] })');
    // Saving a card can carry a charge.
    expect(body).toContain('refetchQueries({ queryKey: ["billingPayments"] })');
  });

  // The spinner on the button is the only thing saying the re-read is running;
  // clearing it first hands back a settled-looking page still claiming no card.
  it("clears the in-flight state only after the re-read settles", () => {
    const at = PAGE.indexOf("async function refreshAfterCardSaved(");
    const body = PAGE.slice(at, PAGE.indexOf("async function openCardPage(", at));
    const refetch = body.lastIndexOf("refetchQueries");
    expect(refetch).toBeGreaterThan(-1);
    expect(body.lastIndexOf("setPortalLoadingSource(null)")).toBeGreaterThan(refetch);
  });

  // The card IS saved by the time this runs, so a failed re-read must not be
  // reported to the customer as a failure — the next poll corrects the page.
  it("logs a failed re-read rather than telling the customer it failed", () => {
    const at = PAGE.indexOf("async function refreshAfterCardSaved(");
    const body = PAGE.slice(at, PAGE.indexOf("async function openCardPage(", at));
    expect(body).toContain("console.error");
    expect(body).not.toContain("setError(");
  });

  it("is what the widget's success hands back to", () => {
    const at = PAGE.indexOf("const { openCardWidget }");
    const call = PAGE.slice(at, PAGE.indexOf("} catch (err) {", at));
    expect(call).toContain("refreshAfterCardSaved()");
  });
});

/**
 * Read out of the DEPLOYED bundles rather than the types — the npm package is a
 * loader and the widget is a rolling CDN build, so `.d.ts` settles nothing.
 *
 * `embed.js`: `payWithPopup` binds teardown to the popup's `close` message only
 * (`a.close.subscribe(() => y())`); `a.success.subscribe` unsubscribes cancel,
 * calls `onSuccess`, and does nothing else. `card-popup.js` publishes `success`
 * and `close` from two separate callbacks, so one does not imply the other.
 * Without this the popup can sit over the page it just refreshed.
 */
describe("the provider module takes its own popup down", () => {
  it("destroys the popup before handing success back", () => {
    const at = WIDGET.indexOf("onSuccess: () => {");
    expect(at).toBeGreaterThan(-1);
    const body = WIDGET.slice(at, WIDGET.indexOf("onCancel:", at));
    expect(body).toContain("instance.destroy()");
    // Teardown first, so the caller's re-read runs against a visible page.
    expect(body.indexOf("instance.destroy()")).toBeLessThan(
      body.indexOf("options.onSuccess()"),
    );
  });

  // On error the customer is meant to fix the card and try again, which is why
  // the SDK leaves the popup up too.
  it("leaves the popup up on error", () => {
    const at = WIDGET.indexOf("onError: (error: unknown) => {");
    expect(at).toBeGreaterThan(-1);
    expect(WIDGET.slice(at)).not.toContain("instance.destroy()");
  });

  // A page-level teardown would put the provider's own semantics in the caller.
  it("keeps the teardown in the provider module", () => {
    expect(PAGE).not.toContain("instance.destroy()");
  });
});
