import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const PAGE = readFileSync(
  join(root, "src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"),
  "utf8",
);
const MODAL = readFileSync(
  join(root, "src/components/billing/card-remove-confirm-modal.tsx"),
  "utf8",
);
const API = readFileSync(join(root, "src/lib/api.ts"), "utf8");

/**
 * The component being able to do a thing is not the feature: a page that never
 * mounts it, or never passes a prop, ships the component perfectly correct and
 * the feature entirely absent. So every assertion here that matters is about the
 * CALL SITE.
 */
describe("the billing page offers a way to remove the card", () => {
  it("renders the control", () => {
    expect(PAGE).toContain("Remove card");
    expect(PAGE).toContain("setRemoveConfirmOpen(true)");
  });

  it("mounts the confirmation and passes every prop it needs", () => {
    const at = PAGE.indexOf("<CardRemoveConfirmModal");
    expect(at).toBeGreaterThan(-1);
    // Bounded by the sibling that follows it, so the slice moves with the file
    // rather than expiring on the next comment somebody adds above it.
    const call = PAGE.slice(at, PAGE.indexOf('<div className="mb-6 flex max-w-2xl', at));
    expect(call).toContain("settleCents={settleCents}");
    expect(call).toContain("consequence={removeConsequence}");
    expect(call).toContain("cardLabel={cardLabel}");
    expect(call).toContain("pending={removePending}");
    expect(call).toContain("handleRemoveCard()");
  });

  it("calls the removal and re-reads rather than patching the account", () => {
    const at = PAGE.indexOf("async function handleRemoveCard(");
    const body = PAGE.slice(at, PAGE.indexOf("async function handleTopup(", at));
    expect(body).toContain("removePaymentMethod()");
    // Re-read, because the removal moves the credit-line floor and the
    // auto-topup state as well as the card.
    expect(body).toContain('refetchQueries({ queryKey: ["billingAccount"] })');
    // The settle on the way out can put a charge in the list.
    expect(body).toContain('refetchQueries({ queryKey: ["billingPayments"] })');
  });

  // The cache is local-first, so a reload hands the first frame to the PREVIOUS
  // visit's snapshot — the removed card, still on screen until the cold billing
  // read lands seconds later. It reads as the click having done nothing.
  it("never reloads the page to re-read", () => {
    const at = PAGE.indexOf("async function handleRemoveCard(");
    const body = PAGE.slice(at, PAGE.indexOf("async function handleTopup(", at));
    expect(body).not.toContain("location.reload");
  });

  // The card is gone the moment the DELETE returns, so "Nothing was changed" may
  // only be reachable from the removal's own failure — a re-read that fails past
  // that point must not claim it.
  it("scopes the nothing-was-changed message to the removal itself", () => {
    const at = PAGE.indexOf("async function handleRemoveCard(");
    const body = PAGE.slice(at, PAGE.indexOf("async function handleTopup(", at));
    const message = body.indexOf("Nothing was changed.");
    expect(message).toBeGreaterThan(-1);
    // The early return is what keeps the success path out of that branch.
    expect(body.slice(message, message + 200)).toContain("return;");
    // And the re-read is sequenced AFTER it, never inside the same try.
    expect(body.indexOf("refetchQueries")).toBeGreaterThan(message);
  });

  // The modal is the only thing on screen saying the removal is running, so it
  // stays up until the fresh account has landed — closing it first puts the old
  // card back under the customer's eyes for the length of the read.
  it("keeps the confirmation open until the re-read settles", () => {
    const at = PAGE.indexOf("async function handleRemoveCard(");
    const body = PAGE.slice(at, PAGE.indexOf("async function handleTopup(", at));
    const refetch = body.lastIndexOf("refetchQueries");
    const close = body.lastIndexOf("setRemoveConfirmOpen(false)");
    expect(refetch).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(refetch);
  });

  // apiCall sets `message` to the whole downstream body verbatim, so rendering
  // it is how a JSON blob reaches a customer.
  it("never renders the raw downstream error body", () => {
    const at = PAGE.indexOf("async function handleRemoveCard(");
    const body = PAGE.slice(at, PAGE.indexOf("async function handleTopup(", at));
    expect(body).not.toContain("setError(err.message");
    expect(body).not.toContain("err instanceof Error ? err.message");
  });

  // Two surfaces stating one amount is how they come to disagree about it.
  it("derives the consequence once", () => {
    expect(PAGE.split("cardRemoveConsequence(").length - 1).toBe(1);
  });

  // A greyed control with no reason beside it reads as broken rather than as
  // secondary, so the quiet weight is colour and never `disabled` at rest.
  it("is quiet, not disabled at rest", () => {
    const at = PAGE.indexOf("setRemoveConfirmOpen(true)");
    const button = PAGE.slice(at, at + 260);
    expect(button).toContain("text-gray-500");
    expect(button).toContain("disabled={portalLoadingSource !== null || removePending}");
  });
});

describe("the reader conforms to the deployed contract", () => {
  // Conformed to what api-service actually serves (#942), not to a shape guessed
  // before the producer designed one. A rename upstream must fail here rather
  // than 404 silently on a control nobody clicks until a customer does.
  it("calls the gateway path that exists", () => {
    const at = API.indexOf("export async function removePaymentMethod(");
    const body = API.slice(at, at + 400);
    expect(body).toContain('"/billing/accounts/saved_payment_method"');
    expect(body).toContain('method: "DELETE"');
  });

  it("reads billing's own response, not a borrowed account shape", () => {
    expect(API).toContain('object: "saved_payment_method_removed"');
    expect(API).toContain("Promise<SavedPaymentMethodRemoved>");
  });
});

describe("the confirmation states what actually happens", () => {
  it("says the charge never blocks the removal", () => {
    expect(MODAL).toContain("we remove the card anyway");
    expect(MODAL).toContain("stays owed");
  });

  it("answers all three consequences rather than asserting one", () => {
    expect(MODAL).toContain('consequence.kind === "runs_down"');
    expect(MODAL).toContain('consequence.kind === "stops_now"');
    expect(MODAL).toContain('consequence.kind === "unknown"');
  });

  it("states the reversibility", () => {
    expect(MODAL).toContain("add a card again");
  });

  // Top AI-tell, banned in every user-facing string.
  it("carries no em-dash in its copy", () => {
    const at = MODAL.indexOf("return (");
    expect(MODAL.slice(at)).not.toContain("—");
  });
});
