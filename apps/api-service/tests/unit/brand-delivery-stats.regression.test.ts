/**
 * Regression test: the brand page was summing per-campaign delivery stats
 * from the email-gateway, but the gateway doesn't properly filter by campaignId,
 * so each campaign got org-wide totals. With N campaigns, sent/opened were
 * inflated by a factor of N.
 *
 * Fix: GET /v1/brands/:brandId/delivery-stats makes a single email-gateway call
 * with brandId filter, returning correct totals without duplication.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCallExternalService = vi.fn();
const mockCallService = vi.fn();
const mockBuildInternalHeaders = vi.fn(() => ({}));
const mockGetRunsBatch = vi.fn();

vi.mock("../../src/lib/service-client.js", () => ({
  callExternalService: (...args: unknown[]) => mockCallExternalService(...args),
  callService: (...args: unknown[]) => mockCallService(...args),
  externalServices: {
    emailSending: { url: "http://mock-email", apiKey: "k" },
    replyQualification: { url: "http://mock-rq", apiKey: "k" },
    lead: { url: "http://mock-lead", apiKey: "k" },
    campaign: { url: "http://mock-campaign", apiKey: "k" },
    key: { url: "http://mock-key", apiKey: "k" },
    scraping: { url: "http://mock-scraping", apiKey: "k" },
    lifecycle: { url: "http://mock-lifecycle", apiKey: "k" },
    brand: { url: "http://mock-brand", apiKey: "k" },
  },
  services: {
    emailgen: "http://mock-emailgen",
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
  AuthenticatedRequest: {},
}));

vi.mock("../../src/lib/internal-headers.js", () => ({
  buildInternalHeaders: (...args: unknown[]) => mockBuildInternalHeaders(...args),
}));

vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: (...args: unknown[]) => mockGetRunsBatch(...args),
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

describe("GET /v1/brands/:brandId/delivery-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call email-gateway with brandId filter and return aggregated stats", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      if (path === "/stats") {
        // Verify brandId is in the request body
        expect(opts.body.brandId).toBe("brand-123");
        expect(opts.body.appId).toBe("mcpfactory");
        return Promise.resolve({
          transactional: {
            emailsSent: 8, emailsDelivered: 7, emailsOpened: 3,
            emailsClicked: 1, emailsReplied: 2, emailsBounced: 1,
            repliesWillingToMeet: 1, repliesInterested: 1,
            repliesNotInterested: 0, repliesOutOfOffice: 0,
            repliesUnsubscribe: 0, recipients: 8,
          },
          broadcast: {
            emailsSent: 5, emailsDelivered: 4, emailsOpened: 2,
            emailsClicked: 0, emailsReplied: 1, emailsBounced: 0,
            repliesWillingToMeet: 0, repliesInterested: 0,
            repliesNotInterested: 1, repliesOutOfOffice: 0,
            repliesUnsubscribe: 0, recipients: 5,
          },
        });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/v1/brands/brand-123/delivery-stats");

    expect(res.status).toBe(200);
    expect(res.body.emailsSent).toBe(13); // 8 + 5
    expect(res.body.emailsOpened).toBe(5); // 3 + 2
    expect(res.body.emailsReplied).toBe(3); // 2 + 1
    expect(res.body.repliesWillingToMeet).toBe(1);
    expect(res.body.repliesNotInterested).toBe(1);
  });

  it("should return zeros when email-gateway fails", async () => {
    const app = createApp();

    mockCallExternalService.mockRejectedValue(new Error("gateway down"));

    const res = await request(app).get("/v1/brands/brand-123/delivery-stats");

    expect(res.status).toBe(200);
    expect(res.body.emailsSent).toBe(0);
    expect(res.body.emailsOpened).toBe(0);
    expect(res.body.emailsReplied).toBe(0);
  });

  it("should make exactly one email-gateway call (not N per-campaign calls)", async () => {
    const app = createApp();

    mockCallExternalService.mockResolvedValue({
      transactional: {
        emailsSent: 10, emailsDelivered: 10, emailsOpened: 5,
        emailsClicked: 2, emailsReplied: 1, emailsBounced: 0,
        repliesWillingToMeet: 0, repliesInterested: 0,
        repliesNotInterested: 0, repliesOutOfOffice: 0,
        repliesUnsubscribe: 0, recipients: 10,
      },
      broadcast: null,
    });

    await request(app).get("/v1/brands/brand-123/delivery-stats");

    // Should call email-gateway exactly once (not once per campaign)
    const emailGatewayCalls = mockCallExternalService.mock.calls.filter(
      (call: any[]) => call[1] === "/stats"
    );
    expect(emailGatewayCalls).toHaveLength(1);
  });
});

describe("Regression: brand stats must not multiply delivery stats by campaign count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("source code should have the brand-level delivery stats endpoint with brandId filter", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/campaigns.ts"),
      "utf-8"
    );

    // The endpoint should exist
    expect(content).toContain("/brands/:brandId/delivery-stats");
    // It should call fetchDeliveryStats with brandId
    expect(content).toContain("fetchDeliveryStats({ brandId }, orgId)");
  });

  it("dashboard brand page should use max (not sum) for delivery stats and support brand-level endpoint", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../../../apps/dashboard/src/app/(dashboard)/brands/[brandId]/mcp/sales-outreach/page.tsx"),
      "utf-8"
    );

    // Should import and use brand-level delivery stats as primary source
    expect(content).toContain("getBrandDeliveryStats");
    expect(content).toContain("brandDeliveryStats");

    // Should use Math.max for delivery stats fallback (not sum/reduce with +)
    expect(content).toContain("Math.max");

    // Should NOT sum delivery stats from per-campaign batch stats
    expect(content).not.toMatch(/acc\.emailsSent\s*\+/);
    expect(content).not.toMatch(/acc\.emailsOpened\s*\+/);
  });
});
