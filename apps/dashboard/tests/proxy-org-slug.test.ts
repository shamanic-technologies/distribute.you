import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The org's Clerk slug has to reach api-service, which forwards it to
 * client-service's `POST /internal/resolve`. client-service writes it onto the org
 * row only when the stored slug is NULL, and that stored slug IS the org's referral
 * invite code — so an org that predates this header heals on its next request and
 * no backfill is needed.
 *
 * These drive the real route handlers with Clerk mocked and `fetch` spied, and
 * assert the header that actually went out on the wire. A source-substring guard
 * would pass on a header that is spelled right and never sent.
 *
 * The name is api-service's (`x-org-slug`) and is not ours to change.
 */

const { API_KEY } = vi.hoisted(() => {
  const key = "test-admin-key";
  // Both values are read at module scope by every route under test, so they have
  // to be set before the imports below are evaluated.
  process.env.ADMIN_DISTRIBUTE_API_KEY = key;
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL = "https://api.test.local";
  return { API_KEY: key };
});

const clerkState: {
  orgSlug: string | null;
} = { orgSlug: "acme-1784986038886467674" };

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    userId: "user_123",
    orgId: "org_123",
    orgSlug: clerkState.orgSlug,
    sessionClaims: { email: "kevin@acme.com", firstName: "Kevin" },
  }),
  currentUser: async () => ({
    emailAddresses: [{ emailAddress: "kevin@acme.com" }],
    firstName: "Kevin",
    lastName: "Lourd",
  }),
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        primaryEmailAddress: { emailAddress: "kevin@acme.com" },
        firstName: "Kevin",
      }),
    },
  }),
}));

import { GET as catchAllGet } from "../src/app/(authed)/api/v1/[...path]/route";
import { POST as chatPost } from "../src/app/(authed)/api/v1/chat/route";

function headersOfCall(spy: ReturnType<typeof vi.spyOn>, index = 0) {
  const call = spy.mock.calls[index] as unknown as [string, RequestInit];
  return (call[1].headers ?? {}) as Record<string, string>;
}

/** Every proxied route, driven for real, keyed by how you invoke it. */
const ROUTES: Array<{ name: string; call: () => Promise<unknown> }> = [
  {
    name: "api/v1/[...path]",
    call: () =>
      catchAllGet(new NextRequest("http://localhost/api/v1/brands"), {
        params: Promise.resolve({ path: ["brands"] }),
      }),
  },
  {
    name: "api/v1/chat",
    call: () =>
      chatPost(
        new NextRequest("http://localhost/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "hi", configKey: "brand-editor" }),
        }),
      ),
  },
];

describe("dashboard proxies forward the org slug to api-service", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clerkState.orgSlug = "acme-1784986038886467674";
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
    it(`${route.name} sends x-org-slug when the session has one`, async () => {
      await route.call();

      expect(fetchSpy).toHaveBeenCalled();
      const headers = headersOfCall(fetchSpy);
      expect(headers["x-org-slug"]).toBe("acme-1784986038886467674");
      // The slug rides alongside the identity headers that were already there —
      // it never replaces them.
      expect(headers["x-external-org-id"]).toBe("org_123");
      expect(headers["x-external-user-id"]).toBe("user_123");
      expect(headers["X-API-Key"]).toBe(API_KEY);
    });

    it(`${route.name} omits x-org-slug entirely when the session has none`, async () => {
      clerkState.orgSlug = null;

      await route.call();

      expect(fetchSpy).toHaveBeenCalled();
      const headers = headersOfCall(fetchSpy);
      // Absent means absent. Never an empty string — api-service treats a present
      // key as a value to forward, and an empty slug would reach client-service.
      expect("x-org-slug" in headers).toBe(false);
      // ...and the request still authenticates exactly as it does today.
      expect(headers["x-external-org-id"]).toBe("org_123");
      expect(headers["x-external-user-id"]).toBe("user_123");
    });

    it(`${route.name} omits x-org-slug when Clerk returns an empty slug`, async () => {
      clerkState.orgSlug = "";

      await route.call();

      const headers = headersOfCall(fetchSpy);
      expect("x-org-slug" in headers).toBe(false);
    });
  }

  it("forwards the slug verbatim — never minted, slugified or normalized", async () => {
    // Clerk's real slugs carry a numeric uniqueness suffix and can hold casing we
    // must not touch: the invite code is whatever the identity provider stored.
    clerkState.orgSlug = "Steady-Recruit_1785183518835827060";

    await ROUTES[0].call();

    expect(headersOfCall(fetchSpy)["x-org-slug"]).toBe(
      "Steady-Recruit_1785183518835827060",
    );
  });
});
