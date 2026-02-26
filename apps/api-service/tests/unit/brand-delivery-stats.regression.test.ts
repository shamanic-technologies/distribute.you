/**
 * Regression test: the brand page was summing per-campaign delivery stats
 * from the email-gateway, but the gateway doesn't properly filter by campaignId,
 * so each campaign got org-wide totals. With N campaigns, sent/opened were
 * inflated by a factor of N.
 *
 * Fix: GET /v1/brands/:brandId/delivery-stats makes a single email-gateway call
 * with brandId filter, returning only broadcast (outreach) stats.
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
    emailgen: { url: "http://mock-emailgen", apiKey: "k" },
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

  it("should return only broadcast (outreach) stats, ignoring transactional", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      if (path === "/stats") {
        expect(opts.body.brandId).toBe("brand-123");
        expect(opts.body.appId).toBe("mcpfactory");
        return Promise.resolve({
          transactional: {
            emailsSent: 50, emailsDelivered: 48, emailsOpened: 30,
            emailsClicked: 5, emailsReplied: 10, emailsBounced: 2,
            repliesWillingToMeet: 3, repliesInterested: 2,
            repliesNotInterested: 1, repliesOutOfOffice: 1,
            repliesUnsubscribe: 0, recipients: 50,
          },
          broadcast: {
            emailsSent: 6, emailsDelivered: 6, emailsOpened: 4,
            emailsClicked: 0, emailsReplied: 1, emailsBounced: 0,
            repliesWillingToMeet: 0, repliesInterested: 0,
            repliesNotInterested: 1, repliesOutOfOffice: 0,
            repliesUnsubscribe: 0, recipients: 6,
          },
        });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/v1/brands/brand-123/delivery-stats");

    expect(res.status).toBe(200);
    // Should return ONLY broadcast stats, not transactional
    expect(res.body.emailsSent).toBe(6);
    expect(res.body.emailsOpened).toBe(4);
    expect(res.body.emailsReplied).toBe(1);
    expect(res.body.repliesNotInterested).toBe(1);
    // Transactional values (50, 30, 10) must NOT appear
    expect(res.body.emailsSent).not.toBe(56); // not 50+6
    expect(res.body.emailsSent).not.toBe(50);
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

  it("should return zeros when broadcast is null (only transactional exists)", async () => {
    const app = createApp();

    mockCallExternalService.mockResolvedValue({
      transactional: {
        emailsSent: 50, emailsDelivered: 48, emailsOpened: 30,
        emailsClicked: 5, emailsReplied: 10, emailsBounced: 2,
        repliesWillingToMeet: 3, repliesInterested: 2,
        repliesNotInterested: 1, repliesOutOfOffice: 1,
        repliesUnsubscribe: 0, recipients: 50,
      },
      broadcast: null,
    });

    const res = await request(app).get("/v1/brands/brand-123/delivery-stats");

    expect(res.status).toBe(200);
    // No broadcast = no outreach stats, should be zeros
    expect(res.body.emailsSent).toBe(0);
    expect(res.body.emailsOpened).toBe(0);
    expect(res.body.emailsReplied).toBe(0);
  });

  it("should make exactly one email-gateway call", async () => {
    const app = createApp();

    mockCallExternalService.mockResolvedValue({
      transactional: null,
      broadcast: {
        emailsSent: 3, emailsDelivered: 3, emailsOpened: 1,
        emailsClicked: 0, emailsReplied: 0, emailsBounced: 0,
        repliesWillingToMeet: 0, repliesInterested: 0,
        repliesNotInterested: 0, repliesOutOfOffice: 0,
        repliesUnsubscribe: 0, recipients: 3,
      },
    });

    await request(app).get("/v1/brands/brand-123/delivery-stats");

    const emailGatewayCalls = mockCallExternalService.mock.calls.filter(
      (call: any[]) => call[1] === "/stats"
    );
    expect(emailGatewayCalls).toHaveLength(1);
  });
});

describe("Regression: fetchDeliveryStats must use broadcast only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchDeliveryStats should only read broadcast stats in source code", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/campaigns.ts"),
      "utf-8"
    );

    // The endpoint should exist
    expect(content).toContain("/brands/:brandId/delivery-stats");
    // Should only use broadcast, not sum transactional + broadcast
    expect(content).toContain("Only use broadcast stats");
    expect(content).not.toMatch(/sum\(t\?\.emails/);
  });

  it("brand page should use brand-level delivery stats without fallback", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../../../apps/dashboard/src/app/(dashboard)/brands/[brandId]/workflows/[sectionKey]/page.tsx"),
      "utf-8"
    );

    expect(content).toContain("getBrandDeliveryStats");
    // Should NOT fall back to per-campaign sum for delivery stats
    expect(content).not.toMatch(/brandDelivery\?\.\w+ \?\? campaignTotals\.\w+/);
  });
});
