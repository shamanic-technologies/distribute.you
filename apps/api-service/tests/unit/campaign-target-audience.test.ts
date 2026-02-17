import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Tests for campaign creation with targetAudience field.
 * When targetAudience is provided (and no Apollo fields), the api-service should:
 * 1. Upsert brand via brand-service to get brandId
 * 2. Call brand-service /icp-suggestion with targetAudience to resolve Apollo params
 * 3. Forward resolved params to campaign-service
 */

// Mock auth middleware
vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = "user_test123";
    req.orgId = "org_test456";
    req.authType = "jwt";
    next();
  },
  requireOrg: (req: any, res: any, next: any) => {
    if (!req.orgId) return res.status(400).json({ error: "Organization context required" });
    next();
  },
  AuthenticatedRequest: {},
}));

// Mock runs-client
vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

import campaignRouter from "../../src/routes/campaigns.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1", campaignRouter);
  return app;
}

describe("POST /v1/campaigns with targetAudience", () => {
  let fetchCalls: Array<{ url: string; body?: Record<string, unknown> }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchCalls = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, body });

      // Brand upsert
      if (url.includes("/brands") && init?.method === "POST") {
        return {
          ok: true,
          json: () => Promise.resolve({ brandId: "brand-uuid-123", domain: "example.com", name: "Example", created: false }),
        };
      }

      // Scraping (fire-and-forget)
      if (url.includes("/scrape")) {
        return {
          ok: true,
          json: () => Promise.resolve({ id: "scrape-123" }),
        };
      }

      // ICP suggestion
      if (url.includes("/icp-suggestion")) {
        return {
          ok: true,
          json: () => Promise.resolve({
            icp: {
              person_titles: ["CTO", "VP Engineering"],
              organization_locations: ["United States"],
              q_organization_keyword_tags: ["SaaS", "B2B"],
              organization_num_employees_ranges: ["11,50"],
            },
          }),
        };
      }

      // Campaign creation
      if (url.includes("/campaigns") && init?.method === "POST") {
        return {
          ok: true,
          json: () => Promise.resolve({
            campaign: { id: "campaign-123", brandId: "brand-uuid-123", name: body?.name, status: "ongoing" },
          }),
        };
      }

      // Lifecycle email (fire-and-forget)
      if (url.includes("/send")) {
        return { ok: true, json: () => Promise.resolve({}) };
      }

      return { ok: true, json: () => Promise.resolve({}) };
    });
  });

  it("should resolve targetAudience to Apollo params via ICP suggestion", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS startups with 10-50 employees in the US",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.campaign.id).toBe("campaign-123");

    // Verify brand upsert was called
    const brandCall = fetchCalls.find((c) => c.url.includes("/brands") && c.body?.appId === "mcpfactory");
    expect(brandCall).toBeDefined();
    expect(brandCall!.body!.url).toBe("https://example.com");
    expect(brandCall!.body!.clerkOrgId).toBe("org_test456");

    // Verify ICP suggestion was called with targetAudience
    const icpCall = fetchCalls.find((c) => c.url.includes("/icp-suggestion"));
    expect(icpCall).toBeDefined();
    expect(icpCall!.body!.targetAudience).toBe("CTOs at SaaS startups with 10-50 employees in the US");
    expect(icpCall!.body!.url).toBe("https://example.com");

    // Verify campaign-service received resolved Apollo fields
    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall).toBeDefined();
    expect(campaignCall!.body!.personTitles).toEqual(["CTO", "VP Engineering"]);
    expect(campaignCall!.body!.organizationLocations).toEqual(["United States"]);
    expect(campaignCall!.body!.qOrganizationKeywordTags).toEqual(["SaaS", "B2B"]);
    expect(campaignCall!.body!.brandId).toBe("brand-uuid-123");
    expect(campaignCall!.body!.targetAudience).toBe("CTOs at SaaS startups with 10-50 employees in the US");
  });

  it("should skip ICP resolution when Apollo fields are provided directly", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS companies",
        personTitles: ["CEO"],
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(200);

    // ICP suggestion should NOT be called when Apollo fields are already provided
    const icpCall = fetchCalls.find((c) => c.url.includes("/icp-suggestion"));
    expect(icpCall).toBeUndefined();

    // Campaign-service should receive the original Apollo fields
    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall!.body!.personTitles).toEqual(["CEO"]);
  });

  it("should continue campaign creation when ICP suggestion fails", async () => {
    // Override fetch to make ICP suggestion fail
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, body });

      if (url.includes("/brands") && init?.method === "POST") {
        return {
          ok: true,
          json: () => Promise.resolve({ brandId: "brand-uuid-123", domain: "example.com", name: "Example", created: false }),
        };
      }

      if (url.includes("/scrape")) {
        return { ok: true, json: () => Promise.resolve({}) };
      }

      if (url.includes("/icp-suggestion")) {
        return {
          ok: false,
          status: 500,
          text: () => Promise.resolve(JSON.stringify({ error: "AI service unavailable" })),
        };
      }

      if (url.includes("/campaigns") && init?.method === "POST") {
        return {
          ok: true,
          json: () => Promise.resolve({
            campaign: { id: "campaign-456", brandId: "brand-uuid-123", name: body?.name, status: "ongoing" },
          }),
        };
      }

      if (url.includes("/send")) {
        return { ok: true, json: () => Promise.resolve({}) };
      }

      return { ok: true, json: () => Promise.resolve({}) };
    });

    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS startups",
        maxBudgetDailyUsd: 10,
      });

    // Campaign should still be created even if ICP resolution fails
    expect(res.status).toBe(200);
    expect(res.body.campaign.id).toBe("campaign-456");
  });

  it("should convert budget numbers to strings for campaign-service", async () => {
    const app = createApp();
    await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Budget Test",
        brandUrl: "https://example.com",
        targetAudience: "CEOs at fintech",
        maxBudgetDailyUsd: 25,
        maxBudgetWeeklyUsd: 100,
      });

    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall!.body!.maxBudgetDailyUsd).toBe("25");
    expect(campaignCall!.body!.maxBudgetWeeklyUsd).toBe("100");
  });
});
