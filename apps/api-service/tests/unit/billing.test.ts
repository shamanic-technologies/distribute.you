import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: vi.fn(),
  requireOrg: vi.fn(),
  requireUser: vi.fn(),
  AuthenticatedRequest: {},
}));

vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

import { fetchKeySource } from "../../src/lib/billing.js";

function mockBillingAccountResponse(billingMode: string) {
  return new Response(
    JSON.stringify({
      id: "acc-1",
      orgId: "org-123",
      appId: "mcpfactory",
      billingMode,
      creditBalanceCents: 200,
      hasPaymentMethod: false,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("fetchKeySource", () => {
  let fetchCalls: Array<{ url: string; headers?: Record<string, string> }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchCalls = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = Object.fromEntries(
        Object.entries(init?.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      fetchCalls.push({ url, headers });

      if (url.includes("/v1/accounts")) {
        return mockBillingAccountResponse("trial");
      }

      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call GET /v1/accounts (upsert) with required headers including x-key-source", async () => {
    await fetchKeySource("org-123");

    const billingCall = fetchCalls.find((c) => c.url.includes("/v1/accounts"));
    expect(billingCall).toBeDefined();
    expect(billingCall!.url).not.toContain("/v1/accounts/balance");
    expect(billingCall!.headers!["x-app-id"]).toBe("mcpfactory");
    expect(billingCall!.headers!["x-org-id"]).toBe("org-123");
    expect(billingCall!.headers!["x-key-source"]).toBe("platform");
  });

  it("should return 'platform' for trial billing mode", async () => {
    const result = await fetchKeySource("org-123");
    expect(result).toBe("platform");
  });

  it("should return 'platform' for payg billing mode", async () => {
    global.fetch = vi.fn().mockResolvedValue(mockBillingAccountResponse("payg"));

    const result = await fetchKeySource("org-123");
    expect(result).toBe("platform");
  });

  it("should return 'byok' for byok billing mode", async () => {
    global.fetch = vi.fn().mockResolvedValue(mockBillingAccountResponse("byok"));

    const result = await fetchKeySource("org-123");
    expect(result).toBe("byok");
  });

  it("should throw when billing-service is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    await expect(fetchKeySource("org-123")).rejects.toThrow("Connection refused");
  });

  it("should throw when billing-service returns an error", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchKeySource("org-123")).rejects.toThrow();
  });
});
