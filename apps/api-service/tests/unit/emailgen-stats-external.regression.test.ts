/**
 * Regression test: emailsGenerated was showing 0 on the campaign stats page
 * because the api-service called content-generation via Railway internal
 * networking (callService) which silently failed, falling back to 0.
 *
 * Fix: moved emailgen to externalServices (public URL via callExternalService)
 * to match all other working service calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCallExternalService = vi.fn();

vi.mock("../../src/lib/service-client.js", () => ({
  callExternalService: (...args: unknown[]) => mockCallExternalService(...args),
  externalServices: {
    emailgen: { url: "http://mock-emailgen", apiKey: "k" },
    emailSending: { url: "http://mock-email", apiKey: "k" },
    replyQualification: { url: "http://mock-rq", apiKey: "k" },
    lead: { url: "http://mock-lead", apiKey: "k" },
    campaign: { url: "http://mock-campaign", apiKey: "k" },
    key: { url: "http://mock-key", apiKey: "k" },
    scraping: { url: "http://mock-scraping", apiKey: "k" },
    lifecycle: { url: "http://mock-lifecycle", apiKey: "k" },
    brand: { url: "http://mock-brand", apiKey: "k" },
    runs: { url: "http://mock-runs", apiKey: "k" },
  },
  services: {
    client: "http://mock-client",
  },
}));

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.userId = "user1";
    _req.orgId = "org1";
    next();
  },
  requireOrg: (_req: any, _res: any, next: any) => next(),
  requireUser: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

vi.mock("../../src/lib/internal-headers.js", () => ({
  buildInternalHeaders: () => ({}),
}));

vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

import express from "express";
import request from "supertest";
import campaignsRouter from "../../src/routes/campaigns.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1", campaignsRouter);
  return app;
}

describe("Campaign stats: emailsGenerated from content-generation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return emailsGenerated from content-generation /stats via callExternalService", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((service: any, path: string, opts: any) => {
      // Content-generation /stats
      if (service.url === "http://mock-emailgen" && path === "/stats") {
        return Promise.resolve({ stats: { emailsGenerated: 5 } });
      }
      // Lead-service /stats
      if (service.url === "http://mock-lead" && path.startsWith("/stats")) {
        return Promise.resolve({ served: 3, buffered: 0, skipped: 0 });
      }
      // Email-gateway /stats
      if (service.url === "http://mock-email" && path === "/stats") {
        return Promise.resolve({
          transactional: null,
          broadcast: { emailsSent: 4, emailsDelivered: 4, emailsOpened: 2, emailsClicked: 0, emailsReplied: 1, emailsBounced: 0, repliesWillingToMeet: 0, repliesInterested: 0, repliesNotInterested: 0, repliesOutOfOffice: 0, repliesUnsubscribe: 0 },
        });
      }
      // Campaign-service budget
      if (path === "/campaigns/batch-budget-usage") {
        return Promise.resolve({ results: {} });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/v1/campaigns/test-campaign-id/stats");

    expect(res.status).toBe(200);
    expect(res.body.emailsGenerated).toBe(5);
    expect(res.body.leadsServed).toBe(3);
    expect(res.body.emailsSent).toBe(4);
  });

  it("should call content-generation via externalServices (not internal services)", () => {
    const fs = require("fs");
    const path = require("path");
    const campaignsSource = fs.readFileSync(
      path.join(__dirname, "../../src/routes/campaigns.ts"),
      "utf-8"
    );

    // Must use callExternalService + externalServices.emailgen, not callService + services.emailgen
    expect(campaignsSource).toContain("externalServices.emailgen");
    expect(campaignsSource).not.toContain("services.emailgen");
  });

  it("should default emailsGenerated to 0 when content-generation fails", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((service: any, path: string) => {
      if (service.url === "http://mock-emailgen") {
        return Promise.reject(new Error("service unavailable"));
      }
      if (service.url === "http://mock-lead" && path.startsWith("/stats")) {
        return Promise.resolve({ served: 2, buffered: 0, skipped: 0 });
      }
      if (service.url === "http://mock-email" && path === "/stats") {
        return Promise.resolve({ transactional: null, broadcast: { emailsSent: 1, emailsDelivered: 1, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0, emailsBounced: 0, repliesWillingToMeet: 0, repliesInterested: 0, repliesNotInterested: 0, repliesOutOfOffice: 0, repliesUnsubscribe: 0 } });
      }
      if (path === "/campaigns/batch-budget-usage") {
        return Promise.resolve({ results: {} });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/v1/campaigns/test-campaign-id/stats");

    expect(res.status).toBe(200);
    // Gracefully defaults to 0 when service fails
    expect(res.body.emailsGenerated).toBe(0);
    // Other stats still work
    expect(res.body.leadsServed).toBe(2);
    expect(res.body.emailsSent).toBe(1);
  });

  it("should pass x-org-id header to content-generation", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((service: any, path: string, opts: any) => {
      if (service.url === "http://mock-emailgen" && path === "/stats") {
        // Verify the org header is passed
        expect(opts.headers["x-org-id"]).toBe("org1");
        return Promise.resolve({ stats: { emailsGenerated: 2 } });
      }
      if (path === "/campaigns/batch-budget-usage") {
        return Promise.resolve({ results: {} });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/v1/campaigns/test-campaign-id/stats");
    expect(res.status).toBe(200);
    expect(res.body.emailsGenerated).toBe(2);
  });
});
