import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Revolut Business is the acquirer by default wherever a card or money is asked for
 * (owner-decided 2026-09-29). The declaration runs BEFORE the provider call, so the
 * provider answers on Revolut; an org whose card already lives on another acquirer
 * stays there (billing answers `card_elsewhere`).
 */

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const API = read("src/lib/api.ts");
const CONTROLLER = read("src/components/billing/use-billing-controller.ts");
const GUARD = read("src/lib/billing-guard.tsx");

function between(src: string, from: string, to: string) {
  const at = src.indexOf(from);
  expect(at, from).toBeGreaterThan(-1);
  return src.slice(at, src.indexOf(to, at));
}

function declaredBefore(body: string, providerCall: string) {
  const declared = body.indexOf("await declareRevolutDefault()");
  const called = body.indexOf(providerCall);
  expect(declared, "declareRevolutDefault").toBeGreaterThan(-1);
  expect(called, providerCall).toBeGreaterThan(declared);
}

describe("the declaration", () => {
  const fn = between(API, "export async function declareRevolutDefault(", "export async function createPortalSession(");

  it("posts to our own route with this tab's token", () => {
    expect(fn).toContain('fetch("/api/orgs/revolut"');
    expect(fn).toContain('method: "POST"');
    expect(fn).toContain("getTabSessionToken()");
    expect(fn).toContain("Authorization: `Bearer ${token}`");
  });

  it("reads a card elsewhere as an answer, and fails loud on anything else", () => {
    expect(fn).toContain('"card_elsewhere"');
    expect(fn).toContain("if (!res.ok)");
    expect(fn).toContain("throw new Error(");
  });
});

describe("every card or money entry point declares first", () => {
  it("the card page (Change card, Add card)", () => {
    declaredBefore(between(CONTROLLER, "async function openCardPage(", "function dismissSettleProblem("), "createPortalSession(");
  });

  it("the Billing page top-up", () => {
    declaredBefore(between(CONTROLLER, "async function handleTopup(", "return {"), "createCheckoutSession(");
  });

  it("the Add credit modal", () => {
    declaredBefore(between(GUARD, "async function handleCheckout(", "async function handleEmbeddedComplete("), "createEmbeddedCheckoutSession(");
  });
});
