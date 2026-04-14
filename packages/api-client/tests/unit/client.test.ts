import { describe, it, expect, vi, beforeEach } from "vitest";
import { DistributeClient, DistributeApiError } from "../../src/client.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 400,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response;
}

describe("DistributeClient", () => {
  let client: DistributeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DistributeClient({ apiKey: "test-key", baseUrl: "https://api.test.com" });
  });

  it("sends API key header on every request", async () => {
    mockFetch.mockResolvedValue(mockResponse({ userId: "u1", orgId: "o1", authType: "user_key" }));
    await client.getMe();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/v1/me",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "test-key" }),
      }),
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    const c = new DistributeClient({ apiKey: "k", baseUrl: "https://api.test.com/" });
    mockFetch.mockResolvedValue(mockResponse({ userId: "u1", orgId: "o1", authType: "user_key" }));
    await c.getMe();
    expect(mockFetch).toHaveBeenCalledWith("https://api.test.com/v1/me", expect.anything());
  });

  it("throws DistributeApiError on non-OK response", async () => {
    mockFetch.mockResolvedValue(mockResponse({ error: "Unauthorized" }, 401));
    await expect(client.getMe()).rejects.toThrow(DistributeApiError);
    try {
      await client.getMe();
    } catch (err) {
      expect(err).toBeInstanceOf(DistributeApiError);
      expect((err as DistributeApiError).status).toBe(401);
    }
  });

  it("defaults baseUrl to https://api.distribute.you", () => {
    const c = new DistributeClient({ apiKey: "k" });
    mockFetch.mockResolvedValue(mockResponse({ userId: "u1", orgId: "o1", authType: "user_key" }));
    c.getMe();
    expect(mockFetch).toHaveBeenCalledWith("https://api.distribute.you/v1/me", expect.anything());
  });

  describe("brands", () => {
    it("listBrands calls GET /v1/brands", async () => {
      mockFetch.mockResolvedValue(mockResponse({ brands: [] }));
      const result = await client.listBrands();
      expect(result).toEqual({ brands: [] });
      expect(mockFetch).toHaveBeenCalledWith("https://api.test.com/v1/brands", expect.objectContaining({ method: "GET" }));
    });

    it("createBrand calls POST /v1/brands with url body", async () => {
      mockFetch.mockResolvedValue(mockResponse({ brandId: "b1", domain: "acme.com", name: "Acme", created: true }));
      const result = await client.createBrand("https://acme.com");
      expect(result.brandId).toBe("b1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/v1/brands",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ url: "https://acme.com" }),
        }),
      );
    });
  });

  describe("campaigns", () => {
    it("listCampaigns with brandId adds query params", async () => {
      mockFetch.mockResolvedValue(mockResponse({ campaigns: [] }));
      await client.listCampaigns({ brandId: "b1" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("brandId=b1");
      expect(url).toContain("status=all");
    });

    it("createCampaign sends POST with params", async () => {
      mockFetch.mockResolvedValue(mockResponse({ campaign: { id: "c1", name: "Test", status: "running" } }));
      await client.createCampaign({
        name: "Test",
        workflowSlug: "wf-1",
        brandUrls: ["https://acme.com"],
        maxBudgetDailyUsd: "50",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/v1/campaigns",
        expect.objectContaining({ method: "POST" }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.name).toBe("Test");
      expect(body.workflowSlug).toBe("wf-1");
      expect(body.brandUrls).toEqual(["https://acme.com"]);
    });

    it("stopCampaign calls POST /v1/campaigns/:id/stop", async () => {
      mockFetch.mockResolvedValue(mockResponse({ campaign: { id: "c1", status: "stopped" } }));
      await client.stopCampaign("c1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/v1/campaigns/c1/stop",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("features", () => {
    it("listFeatures with implemented filter", async () => {
      mockFetch.mockResolvedValue(mockResponse({ features: [] }));
      await client.listFeatures({ implemented: true });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("implemented=true");
    });

    it("getFeatureStats with groupBy", async () => {
      mockFetch.mockResolvedValue(mockResponse({ featureSlug: "s", systemStats: {} }));
      await client.getFeatureStats("sales-email", { groupBy: "brandId", brandId: "b1" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("groupBy=brandId");
      expect(url).toContain("brandId=b1");
    });
  });

  describe("press kits", () => {
    it("generatePressKit sends headers for brand/campaign context", async () => {
      mockFetch.mockResolvedValue(mockResponse({ mediaKitId: "mk1" }));
      await client.generatePressKit("Create a press kit", { brandId: "b1", campaignId: "c1" });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["x-brand-id"]).toBe("b1");
      expect(headers["x-campaign-id"]).toBe("c1");
    });
  });

  describe("billing", () => {
    it("getBillingBalance returns balance", async () => {
      mockFetch.mockResolvedValue(mockResponse({ balance_cents: 5000, depleted: false }));
      const result = await client.getBillingBalance();
      expect(result.balance_cents).toBe(5000);
      expect(result.depleted).toBe(false);
    });
  });
});
