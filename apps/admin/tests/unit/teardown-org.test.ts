import { describe, it, expect, vi } from "vitest";
import {
  parseArgs,
  pickStripeCustomer,
  teardownStripe,
  teardownClerk,
  confirmOrgName,
} from "../../scripts/teardown-org.mjs";

// Fake fetch: matches handlers by method + url prefix, returns an ok JSON response.
function makeFakeFetch(handlers: Array<{ method: string; url: string; body: unknown }>) {
  return vi.fn(async (url: string, init: { method?: string } = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const handler = handlers.find((h) => h.method === method && url.startsWith(h.url));
    if (!handler) throw new Error(`unhandled ${method} ${url}`);
    return {
      ok: true,
      status: 200,
      json: async () => handler.body,
      text: async () => JSON.stringify(handler.body),
    };
  });
}

describe("parseArgs", () => {
  it("throws when --org is missing", () => {
    expect(() => parseArgs([])).toThrow(/--org/);
  });

  it("parses all flags", () => {
    const a = parseArgs(["--org", "org_123", "--email", "x@y.com", "--yes", "--dry-run"]);
    expect(a).toMatchObject({ orgId: "org_123", email: "x@y.com", yes: true, dryRun: true });
  });

  it("defaults stripeMetaKey to orgId and allows override", () => {
    expect(parseArgs(["--org", "org_1"]).stripeMetaKey).toBe("orgId");
    expect(parseArgs(["--org", "org_1", "--stripe-meta-key", "clerkOrgId"]).stripeMetaKey).toBe("clerkOrgId");
  });

  it("throws on unknown argument", () => {
    expect(() => parseArgs(["--org", "org_1", "--bogus"])).toThrow(/Unknown argument/);
  });
});

describe("pickStripeCustomer", () => {
  it("returns null on zero matches", () => {
    expect(pickStripeCustomer([])).toBeNull();
  });

  it("returns the single match", () => {
    expect(pickStripeCustomer([{ id: "cus_1" }])).toEqual({ id: "cus_1" });
  });

  it("throws on more than one match (fail loud, no guess)", () => {
    expect(() => pickStripeCustomer([{ id: "cus_1" }, { id: "cus_2" }])).toThrow(/refusing to guess/i);
  });
});

describe("teardownStripe", () => {
  it("cancels every subscription then deletes the customer", async () => {
    const fetchFn = makeFakeFetch([
      { method: "GET", url: "https://api.stripe.com/v1/customers/search", body: { data: [{ id: "cus_1" }] } },
      { method: "GET", url: "https://api.stripe.com/v1/subscriptions", body: { data: [{ id: "sub_1" }, { id: "sub_2" }] } },
      { method: "DELETE", url: "https://api.stripe.com/v1/subscriptions/sub_1", body: { id: "sub_1", status: "canceled" } },
      { method: "DELETE", url: "https://api.stripe.com/v1/subscriptions/sub_2", body: { id: "sub_2", status: "canceled" } },
      { method: "DELETE", url: "https://api.stripe.com/v1/customers/cus_1", body: { id: "cus_1", deleted: true } },
    ]);
    const res = await teardownStripe({ orgId: "org_1", stripeKey: "sk_test", fetchFn, log: () => {} });
    expect(res).toMatchObject({ customerId: "cus_1", subsCancelled: 2, deleted: true });
  });

  it("dry-run is read-only (no DELETE calls)", async () => {
    const fetchFn = makeFakeFetch([
      { method: "GET", url: "https://api.stripe.com/v1/customers/search", body: { data: [{ id: "cus_1" }] } },
      { method: "GET", url: "https://api.stripe.com/v1/subscriptions", body: { data: [{ id: "sub_1" }] } },
    ]);
    const res = await teardownStripe({ orgId: "org_1", stripeKey: "sk_test", fetchFn, dryRun: true, log: () => {} });
    expect(res).toMatchObject({ customerId: "cus_1", subsCancelled: 1, deleted: false, dryRun: true });
    const usedDelete = fetchFn.mock.calls.some(([, init]) => (init?.method ?? "GET").toUpperCase() === "DELETE");
    expect(usedDelete).toBe(false);
  });

  it("skips when no customer matches", async () => {
    const fetchFn = makeFakeFetch([
      { method: "GET", url: "https://api.stripe.com/v1/customers/search", body: { data: [] } },
    ]);
    const res = await teardownStripe({ orgId: "org_1", stripeKey: "sk_test", fetchFn, log: () => {} });
    expect(res).toMatchObject({ skipped: true, reason: "no-customer" });
  });

  it("throws when STRIPE key is missing", async () => {
    await expect(teardownStripe({ orgId: "org_1", stripeKey: "", fetchFn: vi.fn() })).rejects.toThrow(/STRIPE_SECRET_KEY/);
  });
});

describe("teardownClerk", () => {
  it("deletes the org and the user when userId is given", async () => {
    const fetchFn = makeFakeFetch([
      { method: "DELETE", url: "https://api.clerk.com/v1/organizations/org_1", body: { id: "org_1", deleted: true } },
      { method: "DELETE", url: "https://api.clerk.com/v1/users/user_1", body: { id: "user_1", deleted: true } },
    ]);
    const res = await teardownClerk({ orgId: "org_1", userId: "user_1", clerkKey: "sk", fetchFn, log: () => {} });
    expect(res).toMatchObject({ orgDeleted: true, userDeleted: true });
  });

  it("deletes only the org when no user is given", async () => {
    const fetchFn = makeFakeFetch([
      { method: "DELETE", url: "https://api.clerk.com/v1/organizations/org_1", body: { id: "org_1", deleted: true } },
    ]);
    const res = await teardownClerk({ orgId: "org_1", clerkKey: "sk", fetchFn, log: () => {} });
    expect(res).toMatchObject({ orgDeleted: true, userDeleted: false });
  });

  it("dry-run reads the org and mutates nothing", async () => {
    const fetchFn = makeFakeFetch([
      { method: "GET", url: "https://api.clerk.com/v1/organizations/org_1", body: { id: "org_1", name: "Acme" } },
    ]);
    const res = await teardownClerk({ orgId: "org_1", userId: "user_1", clerkKey: "sk", fetchFn, dryRun: true, log: () => {} });
    expect(res).toMatchObject({ orgDeleted: false, userDeleted: false, dryRun: true, orgName: "Acme" });
    const usedDelete = fetchFn.mock.calls.some(([, init]) => (init?.method ?? "GET").toUpperCase() === "DELETE");
    expect(usedDelete).toBe(false);
  });
});

describe("confirmOrgName", () => {
  it("returns true immediately when --yes", async () => {
    expect(await confirmOrgName({ expectedName: "Acme", yes: true })).toBe(true);
  });

  it("returns true when the typed name matches", async () => {
    expect(await confirmOrgName({ expectedName: "Acme", yes: false, readLine: async () => "Acme" })).toBe(true);
  });

  it("returns false when the typed name does not match", async () => {
    expect(await confirmOrgName({ expectedName: "Acme", yes: false, readLine: async () => "wrong" })).toBe(false);
  });
});
