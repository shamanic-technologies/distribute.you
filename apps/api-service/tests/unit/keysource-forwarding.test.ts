import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Tests that all endpoints that trigger paid downstream work correctly
 * resolve keySource from billing-service and forward it.
 *
 * Endpoints tested:
 * 1. POST /v1/campaigns/:id/resume
 * 2. POST /v1/workflows/generate
 * 3. POST /v1/brand/icp-suggestion (covered in icp-suggestion-keytype.regression.test.ts)
 * 4. POST /v1/leads/search
 * 5. POST /v1/qualify
 * 6. POST /v1/brand/scrape
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

// Mock billing module
const mockFetchKeySource = vi.fn().mockResolvedValue("byok");
vi.mock("../../src/lib/billing.js", () => ({
  fetchKeySource: (...args: unknown[]) => mockFetchKeySource(...args),
}));

import campaignRouter from "../../src/routes/campaigns.js";
import workflowRouter from "../../src/routes/workflows.js";
import brandRouter from "../../src/routes/brand.js";
import leadRouter from "../../src/routes/leads.js";
import qualifyRouter from "../../src/routes/qualify.js";

function createApp(...routers: express.Router[]) {
  const app = express();
  app.use(express.json());
  for (const router of routers) {
    app.use("/v1", router);
  }
  return app;
}

let fetchCalls: Array<{ url: string; method?: string; body?: Record<string, unknown> }>;

beforeEach(() => {
  vi.restoreAllMocks();
  mockFetchKeySource.mockResolvedValue("byok");
  fetchCalls = [];

  global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    fetchCalls.push({ url, method: init?.method, body });
    return { ok: true, json: () => Promise.resolve({ campaign: { id: "c-1", status: "ongoing" } }) };
  });
});

// ---------------------------------------------------------------
// 1. POST /v1/campaigns/:id/resume
// ---------------------------------------------------------------
describe("POST /v1/campaigns/:id/resume — keySource forwarding", () => {
  it("should resolve keySource from billing-service and forward to campaign-service", async () => {
    const app = createApp(campaignRouter);
    const res = await request(app).post("/v1/campaigns/camp-123/resume").send({});

    expect(res.status).toBe(200);
    expect(mockFetchKeySource).toHaveBeenCalledWith("org_test456");

    const patchCall = fetchCalls.find((c) => c.url.includes("/campaigns/camp-123") && c.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(patchCall!.body!.keySource).toBe("byok");
    expect(patchCall!.body!.status).toBe("activate");
  });

  it("should forward keySource 'platform' when billing returns payg/trial", async () => {
    mockFetchKeySource.mockResolvedValue("platform");
    const app = createApp(campaignRouter);
    await request(app).post("/v1/campaigns/camp-123/resume").send({});

    const patchCall = fetchCalls.find((c) => c.url.includes("/campaigns/camp-123") && c.method === "PATCH");
    expect(patchCall!.body!.keySource).toBe("platform");
  });
});

// ---------------------------------------------------------------
// 2. POST /v1/workflows/generate
// ---------------------------------------------------------------
describe("POST /v1/workflows/generate — keySource forwarding", () => {
  it("should resolve keySource and forward to workflow-service", async () => {
    const app = createApp(workflowRouter);
    const res = await request(app)
      .post("/v1/workflows/generate")
      .send({ description: "Generate a cold outreach workflow for SaaS founders" });

    expect(res.status).toBe(200);
    expect(mockFetchKeySource).toHaveBeenCalledWith("org_test456");

    const generateCall = fetchCalls.find((c) => c.url.includes("/workflows/generate") && c.method === "POST");
    expect(generateCall).toBeDefined();
    expect(generateCall!.body!.keySource).toBe("byok");
    expect(generateCall!.body!.appId).toBe("mcpfactory");
    expect(generateCall!.body!.orgId).toBe("org_test456");
    expect(generateCall!.body!.userId).toBe("user_test123");
  });

  it("should forward keySource 'platform' when billing returns payg/trial", async () => {
    mockFetchKeySource.mockResolvedValue("platform");
    const app = createApp(workflowRouter);
    await request(app)
      .post("/v1/workflows/generate")
      .send({ description: "Generate a cold outreach workflow for SaaS founders" });

    const generateCall = fetchCalls.find((c) => c.url.includes("/workflows/generate") && c.method === "POST");
    expect(generateCall!.body!.keySource).toBe("platform");
  });
});

// ---------------------------------------------------------------
// 4. POST /v1/leads/search
// ---------------------------------------------------------------
describe("POST /v1/leads/search — keySource forwarding", () => {
  it("should resolve keySource and forward to lead-service", async () => {
    const app = createApp(leadRouter);
    const res = await request(app)
      .post("/v1/leads/search")
      .send({ person_titles: ["CTO"] });

    expect(res.status).toBe(200);
    expect(mockFetchKeySource).toHaveBeenCalledWith("org_test456");

    const searchCall = fetchCalls.find((c) => c.url.includes("/search") && c.method === "POST");
    expect(searchCall).toBeDefined();
    expect(searchCall!.body!.keySource).toBe("byok");
    expect(searchCall!.body!.appId).toBe("mcpfactory");
    expect(searchCall!.body!.orgId).toBe("org_test456");
    expect(searchCall!.body!.userId).toBe("user_test123");
  });

  it("should forward keySource 'platform' when billing returns payg/trial", async () => {
    mockFetchKeySource.mockResolvedValue("platform");
    const app = createApp(leadRouter);
    await request(app)
      .post("/v1/leads/search")
      .send({ person_titles: ["CTO"] });

    const searchCall = fetchCalls.find((c) => c.url.includes("/search") && c.method === "POST");
    expect(searchCall!.body!.keySource).toBe("platform");
  });
});

// ---------------------------------------------------------------
// 5. POST /v1/qualify
// ---------------------------------------------------------------
describe("POST /v1/qualify — keySource forwarding", () => {
  it("should resolve keySource and forward to reply-qualification service", async () => {
    const app = createApp(qualifyRouter);
    const res = await request(app)
      .post("/v1/qualify")
      .send({
        fromEmail: "prospect@example.com",
        toEmail: "sales@acme.com",
        bodyText: "Sounds interesting, let's chat next week.",
      });

    expect(res.status).toBe(200);
    expect(mockFetchKeySource).toHaveBeenCalledWith("org_test456");

    const qualifyCall = fetchCalls.find((c) => c.url.includes("/qualify") && c.method === "POST");
    expect(qualifyCall).toBeDefined();
    expect(qualifyCall!.body!.keySource).toBe("byok");
    expect(qualifyCall!.body!.appId).toBe("mcpfactory");
    expect(qualifyCall!.body!.userId).toBe("user_test123");
  });

  it("should forward keySource 'platform' when billing returns payg/trial", async () => {
    mockFetchKeySource.mockResolvedValue("platform");
    const app = createApp(qualifyRouter);
    await request(app)
      .post("/v1/qualify")
      .send({
        fromEmail: "prospect@example.com",
        toEmail: "sales@acme.com",
        bodyText: "Sounds interesting.",
      });

    const qualifyCall = fetchCalls.find((c) => c.url.includes("/qualify") && c.method === "POST");
    expect(qualifyCall!.body!.keySource).toBe("platform");
  });
});

// ---------------------------------------------------------------
// 6. POST /v1/brand/scrape
// ---------------------------------------------------------------
describe("POST /v1/brand/scrape — keySource forwarding", () => {
  it("should resolve keySource and forward to scraping-service", async () => {
    const app = createApp(brandRouter);
    const res = await request(app)
      .post("/v1/brand/scrape")
      .send({ url: "https://example.com" });

    expect(res.status).toBe(200);
    expect(mockFetchKeySource).toHaveBeenCalledWith("org_test456");

    const scrapeCall = fetchCalls.find((c) => c.url.includes("/scrape") && c.method === "POST");
    expect(scrapeCall).toBeDefined();
    expect(scrapeCall!.body!.keySource).toBe("byok");
    expect(scrapeCall!.body!.userId).toBe("user_test123");
  });

  it("should forward keySource 'platform' when billing returns payg/trial", async () => {
    mockFetchKeySource.mockResolvedValue("platform");
    const app = createApp(brandRouter);
    await request(app)
      .post("/v1/brand/scrape")
      .send({ url: "https://example.com" });

    const scrapeCall = fetchCalls.find((c) => c.url.includes("/scrape") && c.method === "POST");
    expect(scrapeCall!.body!.keySource).toBe("platform");
  });
});
