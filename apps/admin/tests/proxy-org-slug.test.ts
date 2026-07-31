import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Same contract as the dashboard's copy of this guard: every proxied request
 * carries the org's Clerk slug so client-service can store it, because that stored
 * slug IS the org's referral invite code.
 *
 * The admin app matters here for a reason of its own — in god-mode the staff member
 * has really joined the customer's org, so Clerk's active org (and therefore
 * `orgSlug`) is the CUSTOMER's. Staff browsing a customer heals that customer's
 * slug, which is the behaviour we want.
 *
 * These drive the real route handlers with Clerk mocked and `fetch` spied, and
 * assert what actually went out on the wire.
 */

const { API_KEY } = vi.hoisted(() => {
  const key = "test-admin-key";
  // Read at module scope by every route under test, so set before the imports.
  process.env.ADMIN_DISTRIBUTE_API_KEY = key;
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL = "https://api.test.local";
  return { API_KEY: key };
});

const clerkState: {
  orgSlug: string | null;
} = { orgSlug: "customer-1784986038886467674" };

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    userId: "user_staff",
    orgId: "org_customer",
    orgSlug: clerkState.orgSlug,
    sessionClaims: { email: "kevin@distribute.you", firstName: "Kevin" },
  }),
  currentUser: async () => ({
    emailAddresses: [{ emailAddress: "kevin@distribute.you" }],
    firstName: "Kevin",
    lastName: "Lourd",
  }),
}));

import { GET as catchAllGet } from "../src/app/(authed)/api/v1/[...path]/route";
import { GET as requiredProvidersGet } from "../src/app/(authed)/api/v1/workflows/[id]/required-providers/route";
import { GET as crmCallbackGet } from "../src/app/(authed)/services/crm/oauth/callback/route";
import { POST as chatPost } from "../src/app/(authed)/api/v1/chat/route";

function headersOfCall(spy: ReturnType<typeof vi.spyOn>, index = 0) {
  const call = spy.mock.calls[index] as unknown as [string, RequestInit];
  return (call[1].headers ?? {}) as Record<string, string>;
}

const ROUTES: Array<{ name: string; call: () => Promise<unknown> }> = [
  {
    name: "api/v1/[...path]",
    call: () =>
      catchAllGet(new NextRequest("http://localhost/api/v1/brands"), {
        params: Promise.resolve({ path: ["brands"] }),
      }),
  },
  {
    name: "api/v1/workflows/[id]/required-providers",
    call: () =>
      requiredProvidersGet(
        new NextRequest("http://localhost/api/v1/workflows/wf_1/required-providers"),
        { params: Promise.resolve({ id: "wf_1" }) },
      ),
  },
  {
    name: "services/crm/oauth/callback",
    call: () =>
      crmCallbackGet(
        new NextRequest("http://localhost/services/crm/oauth/callback?code=c&state=s"),
      ),
  },
  {
    name: "api/v1/chat",
    call: () =>
      chatPost(
        new NextRequest("http://localhost/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "hi", configKey: "workflow-editor" }),
        }),
      ),
  },
];

describe("admin proxies forward the org slug to api-service", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clerkState.orgSlug = "customer-1784986038886467674";
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ requiredProviders: [], ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const route of ROUTES) {
    it(`${route.name} sends the active org's slug (the customer's, under god-mode)`, async () => {
      await route.call();

      expect(fetchSpy).toHaveBeenCalled();
      const headers = headersOfCall(fetchSpy);
      expect(headers["x-org-slug"]).toBe("customer-1784986038886467674");
      expect(headers["x-external-org-id"]).toBe("org_customer");
      expect(headers["x-external-user-id"]).toBe("user_staff");
      expect(headers["X-API-Key"]).toBe(API_KEY);
    });

    it(`${route.name} omits x-org-slug entirely when the session has none`, async () => {
      clerkState.orgSlug = null;

      await route.call();

      const headers = headersOfCall(fetchSpy);
      // Absent means absent — never an empty string.
      expect("x-org-slug" in headers).toBe(false);
      expect(headers["x-external-org-id"]).toBe("org_customer");
    });

    it(`${route.name} omits x-org-slug when Clerk returns an empty slug`, async () => {
      clerkState.orgSlug = "";

      await route.call();

      expect("x-org-slug" in headersOfCall(fetchSpy)).toBe(false);
    });
  }

  it("forwards the slug verbatim — never minted, slugified or normalized", async () => {
    clerkState.orgSlug = "Steady-Recruit_1785183518835827060";

    await ROUTES[0].call();

    expect(headersOfCall(fetchSpy)["x-org-slug"]).toBe(
      "Steady-Recruit_1785183518835827060",
    );
  });
});
