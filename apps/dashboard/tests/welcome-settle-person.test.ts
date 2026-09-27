import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The welcome credit is once per PERSON (billing-service #507). The anonymous
 * claim is the one signup path billing cannot learn the person from on its own,
 * so the dashboard tells it: the internal user uuid client-service wrote in the
 * claim, sent as `x-user-id` on the signup settle.
 */

const USER = "3f1c2a8e-9b7d-4e2a-8f00-1c2d3e4f5a6b";
const ORG = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init: RequestInit) => ({
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.resetModules();
  process.env.BILLING_SERVICE_URL = "http://billing";
  process.env.BILLING_SERVICE_API_KEY = "k";
  process.env.CLIENT_SERVICE_URL = "http://client";
  process.env.CLIENT_SERVICE_API_KEY = "k";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("settleWelcomeOnSignup", () => {
  it("sends the internal user uuid as x-user-id", async () => {
    const fetchFn = mockFetch({ welcomeReceivedElsewhere: true });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { settleWelcomeOnSignup } = await import("../src/lib/billing-service");
    await expect(settleWelcomeOnSignup(ORG, USER)).resolves.toBe(true);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`http://billing/internal/accounts/by-org/${ORG}/signup`);
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe(USER);
  });

  it("logs welcomeReceivedElsewhere and never returns it", async () => {
    mockFetch({ welcomeReceivedElsewhere: true });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { settleWelcomeOnSignup } = await import("../src/lib/billing-service");
    expect(await settleWelcomeOnSignup(ORG, USER)).toBe(true);
    expect(log.mock.calls.flat().join(" ")).toContain("welcomeReceivedElsewhere=true");
  });

  it("still settles WITHOUT the header when the uuid is unresolved, loudly", async () => {
    const fetchFn = mockFetch({});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { settleWelcomeOnSignup } = await import("../src/lib/billing-service");
    await expect(settleWelcomeOnSignup(ORG, null)).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].headers as Record<string, string>).not.toHaveProperty(
      "x-user-id",
    );
    expect(err).toHaveBeenCalled();
  });

  it("never throws on a failed settle — a signup is never lost to it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { settleWelcomeOnSignup } = await import("../src/lib/billing-service");
    await expect(settleWelcomeOnSignup(ORG, USER)).resolves.toBe(false);
  });
});

describe("claimAnonymousOrg reads the person off the claim", () => {
  it("returns the internal userId client-service wrote", async () => {
    mockFetch({ orgId: ORG, userId: USER, alreadyClaimed: false });
    const { claimAnonymousOrg } = await import("../src/lib/client-service");
    const out = await claimAnonymousOrg({ orgId: ORG, externalOrgId: "org_x", externalUserId: "user_x" });
    expect(out).toMatchObject({ claimed: true, userId: USER });
  });

  it.each([
    ["absent", undefined],
    ["a Clerk id", "user_2abcDEF"],
    ["the zero uuid", "00000000-0000-0000-0000-000000000000"],
  ])("yields null, never a stand-in, when the id is %s", async (_label, userId) => {
    mockFetch({ orgId: ORG, userId, alreadyClaimed: true });
    const { claimAnonymousOrg } = await import("../src/lib/client-service");
    const out = await claimAnonymousOrg({ orgId: ORG, externalOrgId: "org_x", externalUserId: "user_x" });
    expect(out).toMatchObject({ claimed: true, userId: null });
  });
});

describe("the claim route hands the person to the settle", () => {
  const SRC = fs.readFileSync(path.join(__dirname, "../src/app/api/anon/claim/route.ts"), "utf8");
  it("passes the claim's userId, never the Clerk userId", () => {
    expect(SRC).toContain("settleWelcomeOnSignup(session.orgId, outcome.userId)");
    expect(SRC).not.toMatch(/settleWelcomeOnSignup\([^)]*,\s*userId\)/);
  });
});
