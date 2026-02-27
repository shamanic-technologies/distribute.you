import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Tests for campaign creation with targetAudience field.
 * The api-service:
 * 1. Upserts brand via brand-service to get brandId
 * 2. Resolves keySource from billing-service
 * 3. Forwards targetAudience + brandId + budget to campaign-service
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
  requireUser: (req: any, res: any, next: any) => {
    if (!req.userId) return res.status(401).json({ error: "User identity required" });
    next();
  },
  AuthenticatedRequest: {},
}));

// Mock runs-client
vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
  createRun: vi.fn().mockResolvedValue({ id: "parent-run-123" }),
  updateRun: vi.fn().mockResolvedValue({ id: "parent-run-123", status: "failed" }),
}));

// Mock billing module — default to "byok"
const mockFetchKeySource = vi.fn().mockResolvedValue("byok");
vi.mock("../../src/lib/billing.js", () => ({
  fetchKeySource: (...args: unknown[]) => mockFetchKeySource(...args),
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
    mockFetchKeySource.mockResolvedValue("byok");
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
        workflowName: "sales-email-cold-outreach-sienna",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS startups with 10-50 employees in the US",
        targetOutcome: "Book sales demos",
        valueForTarget: "Access to enterprise analytics at startup pricing",
        urgency: "Recruitment closes in 30 days",
        scarcity: "Only 10 spots available worldwide",
        riskReversal: "Free trial for 2 weeks, no commitment",
        socialProof: "Backed by 60 sponsors including Acme, Globex",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.campaign.id).toBe("campaign-123");

    // Verify brand upsert was called
    const brandCall = fetchCalls.find((c) => c.url.includes("/brands") && c.body?.appId === "mcpfactory");
    expect(brandCall).toBeDefined();
    expect(brandCall!.body!.url).toBe("https://example.com");
    expect(brandCall!.body!.orgId).toBe("org_test456");

    // Verify campaign-service received all fields including workflowName and derived type
    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall).toBeDefined();
    expect(campaignCall!.body!.workflowName).toBe("sales-email-cold-outreach-sienna");
    expect(campaignCall!.body!.type).toBe("cold-email-outreach");
    expect(campaignCall!.body!.targetAudience).toBe("CTOs at SaaS startups with 10-50 employees in the US");
    expect(campaignCall!.body!.targetOutcome).toBe("Book sales demos");
    expect(campaignCall!.body!.valueForTarget).toBe("Access to enterprise analytics at startup pricing");
    expect(campaignCall!.body!.urgency).toBe("Recruitment closes in 30 days");
    expect(campaignCall!.body!.scarcity).toBe("Only 10 spots available worldwide");
    expect(campaignCall!.body!.riskReversal).toBe("Free trial for 2 weeks, no commitment");
    expect(campaignCall!.body!.socialProof).toBe("Backed by 60 sponsors including Acme, Globex");
    expect(campaignCall!.body!.brandId).toBe("brand-uuid-123");
    expect(campaignCall!.body!.orgId).toBe("org_test456");
    expect(campaignCall!.body!.keySource).toBe("byok");

    // Verify NO Apollo fields were sent
    expect(campaignCall!.body!.personTitles).toBeUndefined();
    expect(campaignCall!.body!.qOrganizationKeywordTags).toBeUndefined();
    expect(campaignCall!.body!.organizationLocations).toBeUndefined();

    // Verify scraping is NOT called (handled by campaign-service DAG)
    const scrapeCall = fetchCalls.find((c) => c.url.includes("/scrape"));
    expect(scrapeCall).toBeUndefined();
  });

  it("should resolve keySource from billing-service and forward to campaign-service", async () => {
    mockFetchKeySource.mockResolvedValue("platform");

    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Platform Key Campaign",
        workflowName: "sales-email-cold-outreach-sienna",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS startups",
        targetOutcome: "Book sales demos",
        valueForTarget: "Access to enterprise analytics",
        urgency: "Recruitment closes in 30 days",
        scarcity: "Only 10 spots available",
        riskReversal: "Free trial for 2 weeks",
        socialProof: "Backed by 60 sponsors",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(200);
    expect(mockFetchKeySource).toHaveBeenCalledWith("org_test456");

    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall).toBeDefined();
    expect(campaignCall!.body!.keySource).toBe("platform");
  });

  it("should default to 'platform' keySource when billing-service is unreachable", async () => {
    mockFetchKeySource.mockResolvedValue("platform"); // billing.ts fallback

    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Fallback Campaign",
        workflowName: "sales-email-cold-outreach-sienna",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS startups",
        targetOutcome: "Book sales demos",
        valueForTarget: "Access to enterprise analytics",
        urgency: "Recruitment closes in 30 days",
        scarcity: "Only 10 spots available",
        riskReversal: "Free trial for 2 weeks",
        socialProof: "Backed by 60 sponsors",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(200);

    const campaignCall = fetchCalls.find((c) => c.url.includes("/campaigns") && c.body?.appId === "mcpfactory");
    expect(campaignCall!.body!.keySource).toBe("platform");
  });

  it("should reject when targetAudience is missing with didactic error", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetOutcome: "Book demos",
        valueForTarget: "Better analytics",
        urgency: "Ends soon",
        scarcity: "Limited spots",
        riskReversal: "Free trial",
        socialProof: "500+ customers",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("targetAudience");
    expect(res.body.hint).toBeDefined();
    const field = res.body.missingFields.find((f: { field: string }) => f.field === "targetAudience");
    expect(field).toBeDefined();
    expect(field.description).toContain("who you want to reach");
    expect(field.example).toBeDefined();
  });

  it("should reject when brandUrl is missing with didactic error", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        targetAudience: "CTOs at SaaS companies",
        targetOutcome: "Book demos",
        valueForTarget: "Better analytics",
        urgency: "Ends soon",
        scarcity: "Limited spots",
        riskReversal: "Free trial",
        socialProof: "500+ customers",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("brandUrl");
    const field = res.body.missingFields.find((f: { field: string }) => f.field === "brandUrl");
    expect(field).toBeDefined();
    expect(field.description).toContain("URL");
    expect(field.example).toBeDefined();
  });

  it("should reject when targetAudience is empty string with didactic error", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "",
        targetOutcome: "Book demos",
        valueForTarget: "Better analytics",
        urgency: "Ends soon",
        scarcity: "Limited spots",
        riskReversal: "Free trial",
        socialProof: "500+ customers",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("targetAudience");
    const field = res.body.missingFields.find((f: { field: string }) => f.field === "targetAudience");
    expect(field).toBeDefined();
    expect(field.description).toBeDefined();
  });

  it("should reject when urgency is missing with didactic error including description and example", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS companies",
        targetOutcome: "Book demos",
        valueForTarget: "Better analytics",
        scarcity: "Limited spots",
        riskReversal: "Free trial",
        socialProof: "500+ customers",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("urgency");
    const field = res.body.missingFields.find((f: { field: string }) => f.field === "urgency");
    expect(field).toBeDefined();
    expect(field.description).toContain("time-based");
    expect(field.example).toContain("March");
  });

  it("should reject when socialProof is empty string with didactic error including description and example", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Test Campaign",
        brandUrl: "https://example.com",
        targetAudience: "CTOs",
        targetOutcome: "Book demos",
        valueForTarget: "Better analytics",
        urgency: "Ends soon",
        scarcity: "Limited spots",
        riskReversal: "Free trial",
        socialProof: "",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("socialProof");
    const field = res.body.missingFields.find((f: { field: string }) => f.field === "socialProof");
    expect(field).toBeDefined();
    expect(field.description).toContain("credibility");
    expect(field.example).toBeDefined();
  });

  it("should convert budget numbers to strings for campaign-service", async () => {
    const app = createApp();
    await request(app)
      .post("/v1/campaigns")
      .send({
        name: "Budget Test",
        workflowName: "sales-email-cold-outreach-sienna",
        brandUrl: "https://example.com",
        targetAudience: "CEOs at fintech",
        targetOutcome: "Close deals",
        valueForTarget: "Better ROI",
        urgency: "Q1 pricing ends March 31",
        scarcity: "3 slots left this quarter",
        riskReversal: "Money-back guarantee",
        socialProof: "Used by 200+ fintech companies",
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
        workflowName: "sales-email-cold-outreach-sienna",
        brandUrl: "https://example.com",
        targetAudience: "CTOs at SaaS",
        targetOutcome: "Book demos",
        valueForTarget: "Better tools",
        urgency: "Ends soon",
        scarcity: "Limited spots",
        riskReversal: "Free trial",
        socialProof: "500+ customers",
        maxBudgetDailyUsd: 10,
      });

    expect(res.status).toBe(500);
  });
});
