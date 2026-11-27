import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// REPORT-ORG-UPSERT-1127. The no-login public report sends the URL's org id to
// the gateway as `x-external-org-id`, and the gateway resolves it through
// client-service, which UPSERTS an org for any unknown id. On 2026-11-20 a
// stranger minted orgs (`x`, his own org id) by typing report URLs. Every
// gateway call from the report must first prove the org exists in Clerk (a
// read), so an unknown or malformed id never reaches the gateway.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const CLERK = "https://api.clerk.com/v1/organizations/";

let fetchSpy: ReturnType<typeof vi.fn>;

async function load() {
  vi.resetModules();
  process.env.ADMIN_DISTRIBUTE_API_KEY = "test-admin-key";
  process.env.CLERK_SECRET_KEY = "test-clerk-secret";
  return import("../src/lib/report-api");
}

function gatewayCalls() {
  return fetchSpy.mock.calls.filter(([u]) => !String(u).startsWith(CLERK));
}

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public report never reaches the gateway for an unknown org", () => {
  for (const bad of ["x", "3f338e3a-e3c2-493b-a6dc-064d943f178e", "org_", "org_../../users", ""]) {
    it(`malformed id ${JSON.stringify(bad)}: 404, zero network calls`, async () => {
      const api = await load();
      await expect(api.adminGet("t", "/brands/b", bad)).rejects.toMatchObject({ status: 404 });
      await expect(api.adminPost("t", "/x", bad, {})).rejects.toMatchObject({ status: 404 });
      expect(await api.reportOrgExists(bad)).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }

  it("well-formed id Clerk does not know: 404, Clerk asked, gateway never called", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 404 }));
    const api = await load();
    await expect(api.adminGet("t", "/brands/b", "org_2zzzzzzzzzzzzzzzzzzzzzzzzzz")).rejects.toMatchObject({
      status: 404,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(`${CLERK}org_2zzzzzzzzzzzzzzzzzzzzzzzzzz`);
    expect(gatewayCalls()).toHaveLength(0);
  });

  it("Clerk outage fails closed: throws, gateway never called", async () => {
    fetchSpy.mockResolvedValue(new Response("boom", { status: 503 }));
    const api = await load();
    await expect(api.adminGet("t", "/brands/b", "org_2abcdefghijklmnopqrstuvwxyz")).rejects.toThrow(/Clerk 503/);
    expect(gatewayCalls()).toHaveLength(0);
  });

  it("real org: gateway called with the org header, Clerk asked once per process", async () => {
    fetchSpy.mockImplementation(async (u: string) =>
      String(u).startsWith(CLERK)
        ? new Response(JSON.stringify({ id: "org_2abcdefghijklmnopqrstuvwxyz" }), { status: 200 })
        : new Response(JSON.stringify({ brand: { id: "b" } }), { status: 200 }),
    );
    const api = await load();
    const org = "org_2abcdefghijklmnopqrstuvwxyz";
    await api.adminGet("t", "/brands/b", org);
    await api.adminGet("t", "/brands/b", org);
    const clerkCalls = fetchSpy.mock.calls.filter(([u]) => String(u).startsWith(CLERK));
    expect(clerkCalls).toHaveLength(1);
    expect(gatewayCalls()).toHaveLength(2);
    const headers = gatewayCalls()[0][1].headers as Record<string, string>;
    expect(headers["x-external-org-id"]).toBe(org);
  });
});

describe("every public report entry point checks the org first", () => {
  const root = path.resolve(__dirname, "../src/app");
  const files = [
    "report/[orgId]/[brandId]/[featureSlug]/layout.tsx",
    "api/report/[orgId]/[brandId]/[featureSlug]/lead-emails/route.ts",
    "api/report/[orgId]/[brandId]/[featureSlug]/quote-request/[requestId]/route.ts",
  ];
  for (const f of files) {
    it(`${f} calls reportOrgExists`, () => {
      expect(fs.readFileSync(path.join(root, f), "utf-8")).toContain("await reportOrgExists(orgId)");
    });
  }
});
