import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Tests for campaign creation with targetAudience field.
 * The api-service:
 * 1. Upserts brand via brand-service to get brandId
 * 2. Forwards targetAudience + brandId + budget to campaign-service
 * No ICP resolution — that's campaign-service's job.
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

  it("should upsert brand and forward targetAudience to campaign-service", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS startups with 10-50 employees in the US",
        targetOutcome: "Book sales demos",
        valueForTarget: "Access to enterprise analytics at startup pricing",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.campaign.id).toBe("campaign-123");

    // Verify brand upsert was called
    const brandCall = fetchCalls.find((c) => c.url.includes("/brands") && c.body?.appId === "mcpfactory");
    expect(brandCall).toBeDefined();
    expect(brandCall!.body!.url).toBe("https://example.com");
    expect(brandCall!.body!.clerkOrgId).toBe("org_test456");

    // Verify campaign-service received all fields
    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall).toBeDefined();
    expect(campaignCall!.body!.targetAudience).toBe("CTOs at SaaS startups with 10-50 employees in the US");
    expect(campaignCall!.body!.targetOutcome).toBe("Book sales demos");
    expect(campaignCall!.body!.valueForTarget).toBe("Access to enterprise analytics at startup pricing");
    expect(campaignCall!.body!.brandId).toBe("brand-uuid-123");
    expect(campaignCall!.body!.clerkOrgId).toBe("org_test456");

    // Verify NO Apollo fields were sent
    expect(campaignCall!.body!.personTitles).toBeUndefined();
    expect(campaignCall!.body!.qOrganizationKeywordTags).toBeUndefined();
    expect(campaignCall!.body!.organizationLocations).toBeUndefined();

    // Verify scraping is NOT called (handled by campaign-service DAG)
    const scrapeCall = fetchCalls.find((c) => c.url.includes("/scrape"));
    expect(scrapeCall).toBeUndefined();
  });

  it("should reject when targetAudience is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("should reject when brandUrl is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        targetAudience: "CTOs at SaaS companies",
        targetOutcome: "Book demos",
        valueForTarget: "Better analytics",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("should reject when targetAudience is empty string", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("should convert budget numbers to strings for campaign-service", async () => {
    const app = createApp();
    await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Budget Test",
        brandUrl: "https://example.com",
        targetAudience: "CEOs at fintech",
        targetOutcome: "Close deals",
        valueForTarget: "Better ROI",
        maxBudgetDailyUsd: 25,
        maxBudgetWeeklyUsd: 100,
      });

    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall!.body!.maxBudgetDailyUsd).toBe("25");
    expect(campaignCall!.body!.maxBudgetWeeklyUsd).toBe("100");
  });

  it("should fail when brand upsert fails", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/brands") && init?.method === "POST") {
        return {
          ok: false,
          status: 500,
          text: () => Promise.resolve(JSON.stringify({ error: "DB down" })),
        };
      }
      return { ok: true, json: () => Promise.resolve({}) };
    });

    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS",
        targetOutcome: "Book demos",
        valueForTarget: "Better tools",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(500);
  });
});
