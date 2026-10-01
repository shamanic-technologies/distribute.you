import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Every proxied request carries the active Clerk org's display name as
 * `x-org-name` (api-service's header), next to `x-org-slug`. api-service passes
 * it to client-service, which stores it on the org row, so GET /v1/me can name
 * the org an API key acts in. Before this, client-service held a name for 3 of
 * 192 orgs because no caller ever sent one.
 *
 * Drives the real route handlers with Clerk mocked and `fetch` spied, and asserts
 * the header that actually went out on the wire.
 */

vi.hoisted(() => {
  process.env.ADMIN_DISTRIBUTE_API_KEY = "test-admin-key";
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL = "https://api.test.local";
});

const clerkState: {
  orgId: string | null;
  orgName: string | null;
  lookupFails: boolean;
  lookups: number;
} = { orgId: "org_123", orgName: "Acme Robotics", lookupFails: false, lookups: 0 };

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    userId: "user_123",
    orgId: clerkState.orgId,
    orgSlug: "acme-1784986038886467674",
    sessionClaims: { email: "kevin@acme.com", firstName: "Kevin" },
  }),
  currentUser: async () => ({
    emailAddresses: [{ emailAddress: "kevin@acme.com" }],
    firstName: "Kevin",
    lastName: "Lourd",
  }),
  clerkClient: async () => ({
    organizations: {
      getOrganization: async ({ organizationId }: { organizationId: string }) => {
        clerkState.lookups += 1;
        if (clerkState.lookupFails) throw new Error("clerk down");
        return { id: organizationId, name: clerkState.orgName };
      },
    },
  }),
}));

import { GET as catchAllGet } from "../src/app/(authed)/api/v1/[...path]/route";
import { POST as chatPost } from "../src/app/(authed)/api/v1/chat/route";

import { resetOrgNameCache } from "../src/lib/org-name";

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

describe("dashboard proxies forward the org name to api-service", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetOrgNameCache();
    clerkState.orgId = "org_123";
    clerkState.orgName = "Acme Robotics";
    clerkState.lookupFails = false;
    clerkState.lookups = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
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
    it(`${route.name} sends x-org-name equal to the active Clerk org's name`, async () => {
      await route.call();

      expect(fetchSpy).toHaveBeenCalled();
      const headers = headersOfCall(fetchSpy);
      expect(headers["x-org-name"]).toBe("Acme Robotics");
      // Rides next to the slug; never replaces it.
      expect(headers["x-org-slug"]).toBe("acme-1784986038886467674");
      expect(headers["x-external-org-id"]).toBe("org_123");
    });

    it(`${route.name} omits x-org-name when Clerk has no name for the org`, async () => {
      clerkState.orgName = "";

      await route.call();

      const headers = headersOfCall(fetchSpy);
      expect("x-org-name" in headers).toBe(false);
      expect(headers["x-org-slug"]).toBe("acme-1784986038886467674");
    });

    it(`${route.name} omits x-org-name and still proxies when the Clerk lookup fails`, async () => {
      clerkState.lookupFails = true;

      await route.call();

      const headers = headersOfCall(fetchSpy);
      expect("x-org-name" in headers).toBe(false);
      expect(headers["x-external-org-id"]).toBe("org_123");
    });

    it(`${route.name} sends nothing upstream when there is no active org`, async () => {
      clerkState.orgId = null;

      await route.call();

      // No org: the route refuses before any upstream call, so no name can leak.
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(clerkState.lookups).toBe(0);
    });
  }

  it("forwards the name verbatim: never slugified, trimmed or normalized", async () => {
    clerkState.orgName = "  Café & Co. (EU)  ";

    await ROUTES[0].call();

    expect(headersOfCall(fetchSpy)["x-org-name"]).toBe("  Café & Co. (EU)  ");
  });

  it("looks the name up once per org, not once per request", async () => {
    await ROUTES[0].call();
    await ROUTES[0].call();

    expect(clerkState.lookups).toBe(1);
    expect(headersOfCall(fetchSpy, 1)["x-org-name"]).toBe("Acme Robotics");
  });
});
